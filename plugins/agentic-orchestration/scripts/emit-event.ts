#!/usr/bin/env bun
/**
 * Fire-and-forget event emitter for the HOP Orchestrator.
 *
 * Why: The orchestrator (SKILL.md) is a markdown prompt that coordinates
 * Builder/Validator agents. It can't import TypeScript modules. This script
 * is called via Bash to publish orchestration lifecycle events to the
 * @side-quest/observability server if it's running. Fails silently if not.
 *
 * Usage: bun run scripts/emit-event.ts <event-type> '<json-data>'
 * Example: bun run scripts/emit-event.ts orchestration.started '{"prompt":"add hello world"}'
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Self-destruct after 2s (safety net) -- cleared in finally so process exits immediately
const killTimer = setTimeout(() => process.exit(0), 2000)

// Kill switch
if (process.env.SIDE_QUEST_EVENTS === '0') {
	clearTimeout(killTimer)
	process.exit(0)
}

const eventType = process.argv[2]
const jsonData = process.argv[3] || '{}'
if (!eventType) {
	clearTimeout(killTimer)
	process.exit(0)
}

// Discover server from global port file
const portFile = join(
	homedir(),
	'.cache',
	'side-quest-observability',
	'events.port',
)
let port: number
try {
	port = parseInt(readFileSync(portFile, 'utf-8').trim(), 10)
	if (Number.isNaN(port) || port <= 0) {
		clearTimeout(killTimer)
		process.exit(0)
	}
} catch {
	clearTimeout(killTimer)
	process.exit(0) // No server running -- silent exit
}

// POST partial envelope -- server wraps it
const controller = new AbortController()
const abortTimer = setTimeout(() => controller.abort(), 500)
try {
	await fetch(`http://127.0.0.1:${port}/events`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			type: eventType,
			app: 'agentic-orchestration',
			appRoot: process.cwd(),
			source: 'cli',
			data: JSON.parse(jsonData),
		}),
		signal: controller.signal,
	})
} catch {
	// Fire and forget -- never fail the orchestrator
} finally {
	clearTimeout(abortTimer)
	clearTimeout(killTimer)
}
