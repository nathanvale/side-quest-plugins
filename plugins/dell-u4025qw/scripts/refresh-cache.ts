#!/usr/bin/env bun

/**
 * SessionStart hook: Refresh community intelligence cache for the Dell U4025QW skill.
 *
 * Self-contained - uses only Bun built-in APIs.
 * Registered via hooks/hooks.json (plugin-level hook on SessionStart:startup).
 *
 * NOTE: This was originally a PreToolUse:Read hook in SKILL.md frontmatter,
 * but plugin skill frontmatter hooks are broken (anthropics/claude-code#17688).
 * Moved to plugin-level hooks/hooks.json as a workaround.
 *
 * - Reads cache/last-updated.json to check staleness
 * - If next_update_after is in the future, exits 0 (no-op, <1ms)
 * - If stale or missing, runs @side-quest/last-30-days for each topic
 * - Writes results to cache/community-intel.md
 * - Updates cache/last-updated.json with new 30-day cycle
 *
 * Exit 0 = success (always non-blocking).
 */

import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'

const TOPICS = [
	'Dell U4025QW firmware update issues',
	'Dell U4025QW macOS color calibration Display P3 settings',
	'Dell U4025QW KVM switching multiple Mac computers',
	'Dell U4025QW sleep wake disconnect Thunderbolt macOS',
	'Dell U4025QW BetterDisplay Lunar MonitorControl m1ddc macOS',
	'Dell U4025QW HiDPI scaling resolution macOS',
]

const REFRESH_INTERVAL_DAYS = 30
const QUERY_TIMEOUT_MS = 60_000

type RefreshStatus = 'fresh' | 'no_cache' | 'refreshed' | 'failed'

interface QueryError {
	topic: string
	reason: string
	stdout?: string
	stderr?: string
}

/** Collects diagnostics throughout the run, emitted in the final status. */
const diagnostics: QueryError[] = []

/**
 * Write a JSON status line to stdout for observability.
 *
 * Hooks only capture stdout - stderr is silently dropped.
 * All diagnostics are included here so failures are visible
 * in the debug log regardless of how the script is invoked.
 */
function emitStatus(status: RefreshStatus, detail?: string): void {
	const obj: Record<string, unknown> = { status }
	if (detail) obj.detail = detail
	if (diagnostics.length > 0) obj.errors = diagnostics
	console.log(JSON.stringify(obj))
}

interface CacheMetadata {
	last_updated: string
	topics_researched: string[]
	next_update_after: string
}

/**
 * Matches the serialized output shape from `@side-quest/last-30-days --emit=json`.
 * This is the `reportToDict()` output, not the internal `Report` type.
 */
interface Last30DaysReport {
	topic: string
	range?: { from: string; to: string }
	reddit: Array<{
		title: string
		url: string
		subreddit: string
		date: string | null
		why_relevant: string
		score: number
		comment_insights: string[]
	}>
	x: Array<{
		text: string
		url: string
		author_handle: string
		date: string | null
		why_relevant: string
		score: number
	}>
	web: Array<{
		title: string
		url: string
		source_domain: string
		snippet: string
		why_relevant: string
		score: number
	}>
}

/** Resolve the skill cache directory from CLAUDE_PLUGIN_ROOT. */
function getCacheDir(): string {
	const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT
	if (!pluginRoot) {
		throw new Error('CLAUDE_PLUGIN_ROOT environment variable is not set')
	}
	return join(pluginRoot, 'skills', 'dell-u4025qw', 'cache')
}

const MAX_CACHE_AGE_DAYS = 60

/** Check whether the cache is still fresh. */
function isCacheFresh(cacheDir: string): boolean {
	const metadataPath = join(cacheDir, 'last-updated.json')
	if (!existsSync(metadataPath)) return false

	// Cache requires both metadata and the actual intel file
	if (!existsSync(join(cacheDir, 'community-intel.md'))) return false

	try {
		const text = readFileSync(metadataPath, 'utf-8')
		const metadata: CacheMetadata = JSON.parse(text)

		// Guard against clock skew: if last_updated is > 60 days old, force refresh
		const lastUpdated = new Date(metadata.last_updated)
		const ageMs = Date.now() - lastUpdated.getTime()
		if (ageMs > MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000) return false

		const nextUpdate = new Date(metadata.next_update_after)
		return nextUpdate.getTime() > Date.now()
	} catch {
		return false
	}
}

/** Check whether a report has any actual data across all source arrays. */
function hasData(report: Last30DaysReport): boolean {
	return report.reddit.length + report.x.length + report.web.length > 0
}

/** Resolve the full path to bunx so spawning works even with a minimal PATH. */
function resolveBunx(): string {
	const candidates = [
		Bun.which('bunx'),
		'/opt/homebrew/bin/bunx',
		'/usr/local/bin/bunx',
	]
	for (const c of candidates) {
		if (c && existsSync(c)) return c
	}
	return 'bunx' // fall back to PATH lookup
}

/** Run a single last-30-days query and return parsed JSON or null. */
async function runQuery(topic: string): Promise<Last30DaysReport | null> {
	const bunx = resolveBunx()

	let proc: ReturnType<typeof Bun.spawn>
	try {
		proc = Bun.spawn(
			[
				bunx,
				'--bun',
				'@side-quest/last-30-days',
				topic,
				'--emit=json',
				'--quick',
			],
			{
				stdout: 'pipe',
				stderr: 'pipe',
				env: { ...process.env, NO_COLOR: '1' },
			},
		)
	} catch (err) {
		diagnostics.push({
			topic,
			reason: `spawn failed: ${String(err)}`,
		})
		return null
	}

	const exitCode = await Promise.race([
		proc.exited,
		new Promise<null>((resolve) =>
			setTimeout(() => {
				proc.kill()
				resolve(null)
			}, QUERY_TIMEOUT_MS),
		),
	])

	if (exitCode === null) {
		diagnostics.push({
			topic,
			reason: `timeout after ${QUERY_TIMEOUT_MS}ms`,
		})
		return null
	}

	const stdout = await new Response(proc.stdout as ReadableStream).text()
	const stderr = await new Response(proc.stderr as ReadableStream).text()

	if (exitCode !== 0) {
		diagnostics.push({
			topic,
			reason: `exit code ${exitCode}`,
			stderr: stderr.slice(0, 300),
		})
		return null
	}

	try {
		const parsed = JSON.parse(stdout.trim())
		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			!Array.isArray(parsed.reddit) ||
			!Array.isArray(parsed.x) ||
			!Array.isArray(parsed.web)
		) {
			diagnostics.push({
				topic,
				reason: `unexpected shape: ${JSON.stringify(parsed).slice(0, 200)}`,
			})
			return null
		}
		return parsed as Last30DaysReport
	} catch {
		diagnostics.push({
			topic,
			reason: 'stdout was not valid JSON',
			stdout: stdout.slice(0, 300),
			stderr: stderr.slice(0, 300),
		})
		return null
	}
}

/** Format results into a markdown summary. */
function formatMarkdown(
	results: Array<Last30DaysReport | null>,
	updatedAt: string,
): string {
	const TOP_N = 5
	const lines: string[] = [
		'# Community Intelligence',
		'',
		`Auto-generated by \`refresh-cache.ts\` on ${updatedAt}.`,
		'Refreshed every 30 days from `@side-quest/last-30-days` research.',
		'',
	]

	for (const result of results) {
		if (!result) continue

		lines.push(`## ${result.topic}`, '')

		if (!hasData(result)) {
			lines.push('No significant community activity found for this topic.', '')
			continue
		}

		const allUrls: string[] = []

		// Reddit
		if (result.reddit.length > 0) {
			const sorted = [...result.reddit].sort((a, b) => b.score - a.score)
			lines.push('### Reddit', '')
			for (const item of sorted.slice(0, TOP_N)) {
				lines.push(`- [${item.title}](${item.url}) (r/${item.subreddit})`)
				lines.push(`  ${item.why_relevant}`)
				if (item.comment_insights.length > 0) {
					for (const insight of item.comment_insights) {
						lines.push(`  - ${insight}`)
					}
				}
				allUrls.push(item.url)
			}
			lines.push('')
		}

		// X posts
		if (result.x.length > 0) {
			const sorted = [...result.x].sort((a, b) => b.score - a.score)
			lines.push('### X (Twitter)', '')
			for (const item of sorted.slice(0, TOP_N)) {
				const preview =
					item.text.length > 120 ? `${item.text.slice(0, 120)}...` : item.text
				lines.push(`- [@${item.author_handle}](${item.url}): "${preview}"`)
				lines.push(`  ${item.why_relevant}`)
				allUrls.push(item.url)
			}
			lines.push('')
		}

		// Web results
		if (result.web.length > 0) {
			const sorted = [...result.web].sort((a, b) => b.score - a.score)
			lines.push('### Web', '')
			for (const item of sorted.slice(0, TOP_N)) {
				lines.push(`- [${item.title}](${item.url}) (${item.source_domain})`)
				lines.push(`  ${item.snippet}`)
				allUrls.push(item.url)
			}
			lines.push('')
		}

		// Sources list
		if (allUrls.length > 0) {
			lines.push('### Sources', '')
			for (const url of allUrls) {
				lines.push(`- ${url}`)
			}
			lines.push('')
		}
	}

	return lines.join('\n')
}

async function main() {
	let cacheDir: string
	try {
		cacheDir = getCacheDir()
	} catch (err) {
		diagnostics.push({ topic: 'init', reason: String(err) })
		emitStatus('failed')
		process.exit(0)
	}

	// Ensure cache directory exists (fresh clones only have .gitkeep)
	mkdirSync(cacheDir, { recursive: true })

	// Fast path: cache is fresh
	if (isCacheFresh(cacheDir)) {
		emitStatus('fresh')
		process.exit(0)
	}

	const hadExistingCache = existsSync(join(cacheDir, 'community-intel.md'))

	// Run all topic queries in parallel
	const results = await Promise.all(TOPICS.map(runQuery))

	// If all queries failed, write a 4-hour backoff to cap retries at ~6/day
	const successCount = results.filter((r) => r !== null && hasData(r)).length
	if (successCount === 0) {
		const backoffHours = 4
		let preservedTimestamp = new Date().toISOString()
		const existingMetaPath = join(cacheDir, 'last-updated.json')
		if (existsSync(existingMetaPath)) {
			try {
				preservedTimestamp = JSON.parse(
					readFileSync(existingMetaPath, 'utf-8'),
				).last_updated
			} catch {
				// Use current time if metadata is corrupt
			}
		}
		const backoffMetadata: CacheMetadata = {
			last_updated: preservedTimestamp,
			topics_researched: TOPICS,
			next_update_after: new Date(
				Date.now() + backoffHours * 60 * 60 * 1000,
			).toISOString(),
		}
		const backoffPath = join(cacheDir, 'last-updated.json')
		const backoffTmp = `${backoffPath}.tmp`
		await Bun.write(
			backoffTmp,
			JSON.stringify(backoffMetadata, null, '\t') + '\n',
		)
		renameSync(backoffTmp, backoffPath)
		emitStatus(
			hadExistingCache ? 'failed' : 'no_cache',
			'all queries failed, backoff 4h',
		)
		process.exit(0)
	}

	const now = new Date()
	// If fewer than 50% of queries returned data, use shorter interval so thin cache self-heals
	const THIN_CACHE_INTERVAL_DAYS = 7
	const intervalDays =
		successCount < TOPICS.length / 2
			? THIN_CACHE_INTERVAL_DAYS
			: REFRESH_INTERVAL_DAYS
	const nextUpdate = new Date(
		now.getTime() + intervalDays * 24 * 60 * 60 * 1000,
	)
	const updatedAt = now.toISOString()

	// Write community-intel.md (atomic: write .tmp then rename)
	const markdown = formatMarkdown(results, updatedAt)
	const intelPath = join(cacheDir, 'community-intel.md')
	const intelTmp = `${intelPath}.tmp`
	await Bun.write(intelTmp, markdown)
	renameSync(intelTmp, intelPath)

	// Write last-updated.json (atomic: write .tmp then rename)
	const metadata: CacheMetadata = {
		last_updated: updatedAt,
		topics_researched: TOPICS,
		next_update_after: nextUpdate.toISOString(),
	}
	const metadataPath = join(cacheDir, 'last-updated.json')
	const metadataTmp = `${metadataPath}.tmp`
	await Bun.write(metadataTmp, JSON.stringify(metadata, null, '\t') + '\n')
	renameSync(metadataTmp, metadataPath)

	emitStatus(
		'refreshed',
		`${successCount}/${TOPICS.length} topics (interval: ${intervalDays}d)`,
	)
	process.exit(0)
}

main().catch((err) => {
	diagnostics.push({ topic: 'main', reason: `fatal: ${String(err)}` })
	emitStatus('failed')
	process.exit(0)
})
