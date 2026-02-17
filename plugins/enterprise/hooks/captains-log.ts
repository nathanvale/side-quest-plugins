#!/usr/bin/env bun

/**
 * Captain's Log -- Stop Hook
 *
 * Fires at session end. Parses the session transcript for Enterprise command
 * activity and writes structured JSONL events to logs/captains-log-{date}.jsonl.
 *
 * Why a Stop hook instead of PostToolUse:
 * - Stop hook gets the full transcript with all tool results (tokens, duration)
 * - PostToolUse can't see Task output -- only tool_input is available
 * - Captain's Log is retrospective (/enterprise:log reads it later), not real-time
 * - Single write at session end is simpler and avoids duplicate events
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StopHookInput {
	session_id: string
	cwd: string
	transcript_path: string
	stop_hook_active?: boolean
}

interface TranscriptLine {
	type: string
	message?: {
		role?: string
		content?: unknown
	}
}

interface ToolUseBlock {
	type: 'tool_use'
	name: string
	input: Record<string, unknown>
}

interface ToolResultBlock {
	type: 'tool_result'
	content: string
}

interface LogEvent {
	ts: string
	event: string
	command: string
	officer: string
	summary: string
	[key: string]: unknown
}

// ---------------------------------------------------------------------------
// Event detection patterns
// ---------------------------------------------------------------------------

/** Maps Skill invocations to log events */
const SKILL_EVENT_MAP: Record<
	string,
	{ event: string; officer: string; command: string }
> = {
	'enterprise:document': {
		event: 'documentation_completed',
		officer: 'spock',
		command: 'document',
	},
	'enterprise:scan': {
		event: 'scan_completed',
		officer: 'mccoy',
		command: 'scan',
	},
	'enterprise:refit': {
		event: 'refit_completed',
		officer: 'scotty',
		command: 'refit',
	},
	'enterprise:chart': {
		event: 'plan_created',
		officer: 'spock',
		command: 'chart',
	},
	'enterprise:engage': {
		event: 'engage_started',
		officer: 'spock',
		command: 'engage',
	},
	'enterprise:orders': {
		event: 'orders_received',
		officer: 'spock',
		command: 'orders',
	},
	'enterprise:hail': {
		event: 'hail_completed',
		officer: 'spock',
		command: 'hail',
	},
	'enterprise:log': { event: 'log_viewed', officer: 'spock', command: 'log' },
}

/** Maps Task description prefixes to log events */
const TASK_EVENT_PATTERNS: Array<{
	pattern: RegExp
	event: string
	officer: string
	command: string
}> = [
	// More specific patterns first -- "Builder: fix" before generic "Builder:"
	{
		pattern: /^Builder: fix\s+(.+)/i,
		event: 'fix_applied',
		officer: 'scotty',
		command: 'engage',
	},
	{
		pattern: /^Builder:\s*(.+)/i,
		event: 'implementation_completed',
		officer: 'scotty',
		command: 'engage',
	},
	{
		pattern: /^Validator:\s*(?:review\s+)?(.+)/i,
		event: 'review_completed',
		officer: 'mccoy',
		command: 'engage',
	},
	{
		pattern: /^Ship's Computer:\s*(.+)/i,
		event: 'computer_dispatch',
		officer: 'computer',
		command: 'document',
	},
]

// ---------------------------------------------------------------------------
// Transcript parsing
// ---------------------------------------------------------------------------

/**
 * Reads the transcript JSONL and extracts Enterprise-relevant tool calls.
 * Each line in the transcript is a JSON object with a `type` field.
 * Assistant messages contain `content` arrays with tool_use blocks.
 */
function parseTranscript(transcriptPath: string): LogEvent[] {
	const events: LogEvent[] = []
	const seenSkills = new Set<string>()

	let lines: string[]
	try {
		const raw = readFileSync(transcriptPath, 'utf-8')
		lines = raw.split('\n').filter((l) => l.trim())
	} catch {
		// Transcript unreadable -- exit silently
		return []
	}

	for (const line of lines) {
		let entry: TranscriptLine
		try {
			entry = JSON.parse(line)
		} catch {
			continue
		}

		// Only process assistant messages
		if (entry.message?.role !== 'assistant') continue

		const content = entry.message.content
		if (!Array.isArray(content)) continue

		for (const block of content) {
			const toolBlock = block as ToolUseBlock
			if (toolBlock.type !== 'tool_use') continue

			// Detect Skill invocations (e.g., /enterprise:document)
			if (toolBlock.name === 'Skill') {
				const skillName = String(toolBlock.input?.skill || '')
				const mapping = SKILL_EVENT_MAP[skillName]
				if (mapping) {
					// Deduplicate -- one event per skill invocation per session
					const key = `${mapping.event}:${skillName}`
					if (seenSkills.has(key)) continue
					seenSkills.add(key)

					events.push({
						ts: new Date().toISOString(),
						event: mapping.event,
						command: mapping.command,
						officer: mapping.officer,
						summary: `${mapping.command}: ${String(toolBlock.input?.args || '').slice(0, 100) || 'invoked'}`,
						telemetry: {
							tokens_in: 0,
							tokens_out: 0,
							model: 'unknown',
							duration_s: 0,
							sub_agents: 0,
							cost_est: '$0.00',
						},
					})
				}
			}

			// Detect Task dispatches with Enterprise patterns
			if (toolBlock.name === 'Task') {
				const description = String(toolBlock.input?.description || '')
				for (const pat of TASK_EVENT_PATTERNS) {
					const match = description.match(pat.pattern)
					if (match) {
						// More specific patterns first -- "Builder: fix" before "Builder:"
						events.push({
							ts: new Date().toISOString(),
							event: pat.event,
							command: pat.command,
							officer: pat.officer,
							summary: description.slice(0, 120),
							telemetry: {
								tokens_in: 0,
								tokens_out: 0,
								model: String(toolBlock.input?.model || 'sonnet'),
								duration_s: 0,
								sub_agents: 1,
								cost_est: '$0.00',
							},
						})
						break // First match wins
					}
				}
			}
		}
	}

	return events
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	// 1. Read stdin for StopHookInput
	let input: StopHookInput
	try {
		const stdin = readFileSync('/dev/stdin', 'utf-8')
		input = JSON.parse(stdin)
	} catch {
		// No valid input -- exit cleanly
		process.exit(0)
	}

	// 2. Guard against recursion
	if (input.stop_hook_active) {
		process.exit(0)
	}

	// 3. Must have a transcript path
	if (!input.transcript_path) {
		process.exit(0)
	}

	// 4. Parse transcript for Enterprise events
	const events = parseTranscript(input.transcript_path)
	if (events.length === 0) {
		// No Enterprise activity this session -- nothing to log
		process.exit(0)
	}

	// 5. Write events to JSONL
	const today = new Date().toISOString().slice(0, 10)
	const logsDir = join(input.cwd, 'logs')
	const logFile = join(logsDir, `captains-log-${today}.jsonl`)

	if (!existsSync(logsDir)) {
		mkdirSync(logsDir, { recursive: true })
	}

	const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n'
	appendFileSync(logFile, lines)

	process.exit(0)
}

main()
