#!/usr/bin/env bun

/**
 * Observability hook -- dumb pipe.
 *
 * Reads Claude Code's stdin JSON, POSTs it raw to the observability server,
 * and exits. All event enrichment (type mapping, payload extraction, envelope
 * generation) happens server-side.
 *
 * Zero external dependencies. Marketplace-compatible.
 *
 * Usage: echo '{"session_id":"..."}' | bun run emit-event.ts session-start
 */

// Self-destruct timer: MUST be first executable line.
// Claude Code may not enforce timeouts on async hooks (issue #25700).
const selfDestruct = setTimeout(() => process.exit(0), 4500)

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const PORT_FILE = join(
	homedir(),
	'.cache',
	'side-quest-observability',
	'events.port',
)
const TIMEOUT_MS = 500
const DEBUG = process.env.SIDE_QUEST_HOOK_DEBUG === '1'

async function main(): Promise<void> {
	// Kill switch
	if (process.env.SIDE_QUEST_EVENTS === '0') return

	const eventName = process.argv[2]
	if (!eventName) return

	// Read stdin
	let stdin: string
	try {
		stdin = readFileSync('/dev/stdin', 'utf-8')
	} catch {
		return
	}

	// OOM protection: reject > 1MB before JSON.parse
	if (stdin.length > 1_000_000) return

	// Validate JSON (don't send garbage to the server)
	try {
		JSON.parse(stdin)
	} catch {
		return
	}

	// Discover server
	if (!existsSync(PORT_FILE)) return
	const port = parseInt(readFileSync(PORT_FILE, 'utf-8').trim(), 10)
	if (Number.isNaN(port)) return

	// POST raw stdin to server -- server does all enrichment
	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
	try {
		await fetch(`http://127.0.0.1:${port}/events/${eventName}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: stdin,
			signal: controller.signal,
		})
	} catch (err) {
		if (DEBUG) console.error(`[obs-hook] ${err}`)
	} finally {
		clearTimeout(timeout)
	}
}

main()
	.catch(() => {})
	.finally(() => {
		clearTimeout(selfDestruct)
		process.exit(0)
	})
