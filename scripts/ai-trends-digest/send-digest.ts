#!/usr/bin/env bun

/**
 * AI Trends Digest - Send weekly email digest of AI trends
 *
 * Usage:
 *   bun run send-digest.ts                    # Send to default recipient
 *   bun run send-digest.ts --dry-run          # Preview without sending
 *   bun run send-digest.ts --recipient email  # Override recipient
 */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { Resend } from 'resend'
import { generateEmailHtml, generateEmailText } from './email-template'
import type { DigestConfig, ResearchResult } from './types'

/** Default research topics */
const DEFAULT_TOPICS = [
	'AI agentic workflows 2026 trends',
	'Claude Code MCP tools best practices',
	'AI coding assistants productivity',
]

/** Path to environment config */
const ENV_PATH = resolve(process.env.HOME || homedir(), '.config/research/.env')

/**
 * Load environment variables from config file
 */
async function loadEnv(): Promise<void> {
	if (!existsSync(ENV_PATH)) {
		console.error(`Config file not found: ${ENV_PATH}`)
		console.error('Run the setup instructions in /ai-trends-digest skill')
		process.exit(1)
	}

	const content = await Bun.file(ENV_PATH).text()
	for (const line of content.split('\n')) {
		const trimmed = line.trim()
		if (trimmed && !trimmed.startsWith('#')) {
			const [key, ...valueParts] = trimmed.split('=')
			const value = valueParts.join('=').replace(/^["']|["']$/g, '')
			if (key && value) {
				process.env[key] = value
			}
		}
	}
}

/**
 * Parse command line arguments
 */
function parseArgs(): DigestConfig {
	const args = process.argv.slice(2)
	const config: DigestConfig = {
		recipient: '',
		dryRun: false,
		topics: DEFAULT_TOPICS,
	}

	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--dry-run') {
			config.dryRun = true
		} else if (args[i] === '--recipient' && args[i + 1]) {
			config.recipient = args[i + 1]
			i++
		}
	}

	return config
}

/**
 * Run research for a single topic using @side-quest/last-30-days
 */
async function runResearch(topic: string): Promise<ResearchResult | null> {
	console.log(`  Researching: ${topic}`)

	try {
		const proc = Bun.spawn(
			['bunx', '--bun', '@side-quest/last-30-days', topic, '--emit=json'],
			{
				stdout: 'pipe',
				stderr: 'pipe',
				env: process.env,
			},
		)

		const [output, stderrOutput] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
		])
		const exitCode = await proc.exited

		if (exitCode !== 0) {
			console.error(
				`  Warning: Research failed for "${topic}": ${stderrOutput}`,
			)
			return null
		}

		// Parse JSON output
		const result = JSON.parse(output) as ResearchResult
		result.topic = topic
		return result
	} catch (error) {
		console.error(`  ⚠ Research error for "${topic}":`, error)
		return null
	}
}

/**
 * Get the week date string for email subject
 */
function getWeekDate(): string {
	const now = new Date()
	const options: Intl.DateTimeFormatOptions = {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
	}
	return now.toLocaleDateString('en-US', options)
}

/**
 * Main function
 */
async function main(): Promise<void> {
	console.log('🤖 AI Trends Digest\n')

	// Load environment
	await loadEnv()

	// Parse arguments
	const config = parseArgs()

	// Resolve recipient
	const recipient = config.recipient || process.env.DIGEST_RECIPIENT
	if (!recipient && !config.dryRun) {
		console.error('No recipient specified.')
		console.error('Either set DIGEST_RECIPIENT in ~/.config/research/.env')
		console.error('or use --recipient <email>')
		process.exit(1)
	}

	// Check API key for sending
	if (!config.dryRun && !process.env.RESEND_API_KEY) {
		console.error('RESEND_API_KEY not configured.')
		console.error('Add it to ~/.config/research/.env')
		process.exit(1)
	}

	// Run research for all topics
	console.log('📚 Running research...\n')
	const results: ResearchResult[] = []

	for (const topic of config.topics) {
		const result = await runResearch(topic)
		if (result) {
			results.push(result)
		}
	}

	if (results.length === 0) {
		console.error('\n✗ No research results. Cannot generate digest.')
		process.exit(1)
	}

	console.log(
		`\n✓ Research complete: ${results.length}/${config.topics.length} topics\n`,
	)

	// Generate email content
	const weekDate = getWeekDate()
	const subject = `AI Trends Digest - Week of ${weekDate}`
	const html = generateEmailHtml(results, weekDate)
	const text = generateEmailText(results, weekDate)

	// Dry run - just preview
	if (config.dryRun) {
		console.log('--- DRY RUN ---\n')
		console.log(`Would send to: ${recipient || '(no recipient configured)'}`)
		console.log(`Subject: ${subject}\n`)
		console.log('--- Plain Text Preview ---\n')
		console.log(text)
		console.log('\n--- HTML Preview ---\n')
		console.log('(HTML content generated, check email-template.ts for details)')
		console.log(`\nTo send for real, run without --dry-run`)
		return
	}

	// Send email via Resend
	console.log(`📧 Sending to ${recipient}...`)

	const resend = new Resend(process.env.RESEND_API_KEY)

	try {
		const { data, error } = await resend.emails.send({
			from: 'AI Trends Digest <digest@sidequest.dev>',
			to: recipient!,
			subject,
			html,
			text,
		})

		if (error) {
			console.error('\n✗ Failed to send email:', error)
			process.exit(1)
		}

		console.log('\n✓ Email sent successfully!')
		console.log(`  ID: ${data?.id}`)
		console.log(`  Recipient: ${recipient}`)
		console.log(`  Topics: ${config.topics.join(', ')}`)

		// Summary stats
		let totalReddit = 0
		let totalX = 0
		let totalWeb = 0
		for (const r of results) {
			totalReddit += r.reddit?.stats?.totalThreads ?? 0
			totalX += r.x?.stats?.totalPosts ?? 0
			totalWeb += r.web?.stats?.totalPages ?? 0
		}
		console.log(
			`  Sources: ${totalReddit} Reddit, ${totalX} X, ${totalWeb} web`,
		)
	} catch (error) {
		console.error('\n✗ Failed to send email:', error)
		process.exit(1)
	}
}

main().catch((error) => {
	console.error('Fatal error:', error)
	process.exit(1)
})
