import { getMainWorktreeRoot, getStableRepoName } from './git-status-parser'

const EMISSION_TIMEOUT_MS = 500
const SCHEMA_VERSION = 1

/** Event types emitted by hook lifecycle */
export type HookEventType =
	| 'session.started'
	| 'safety.blocked'
	| 'command.executed'
	| 'session.compacted'
	| 'session.ended'

interface EventEnvelope {
	schemaVersion: number
	type: HookEventType
	timestamp: string
	correlationId: string
	source: 'hook'
	repo: string
	gitRoot: string
	data: Record<string, unknown>
}

/**
 * Module-level cache for repo identity.
 * Repo name and git root don't change mid-process, so we resolve once
 * and reuse for all subsequent postEvent calls (avoids 2 git spawns per call).
 */
let cachedIdentity: { repoName: string; gitRoot: string } | null = null

/** Negative cache -- if port file was missing on first check, skip future checks. */
let portCheckFailed = false

/** Resolve repo identity once, cache for process lifetime. */
async function getRepoIdentity(
	cwd: string,
): Promise<{ repoName: string; gitRoot: string }> {
	if (!cachedIdentity) {
		const repoName = await getStableRepoName(cwd)
		const gitRoot = (await getMainWorktreeRoot(cwd)) || cwd
		cachedIdentity = { repoName, gitRoot }
	}
	return cachedIdentity
}

/**
 * Generate a simple correlation ID for event tracing.
 */
function generateCorrelationId(): string {
	return `hook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Fire-and-forget event emission. Never throws, never blocks beyond timeout.
 *
 * Error policy: errors logged to stderr (diagnosable via claude --debug),
 * but never propagate -- the hook continues.
 */
export async function postEvent(
	cwd: string,
	type: HookEventType,
	data: Record<string, unknown>,
	correlationId?: string,
): Promise<void> {
	if (process.env.SIDE_QUEST_EVENTS === '0') return
	if (portCheckFailed) return
	try {
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), EMISSION_TIMEOUT_MS)
		try {
			await postEventInner(cwd, type, data, correlationId, controller.signal)
		} finally {
			clearTimeout(timeoutId)
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err)
		console.error(`[event-bus] emission failed: ${message}`)
	}
}

async function postEventInner(
	cwd: string,
	type: HookEventType,
	data: Record<string, unknown>,
	correlationId: string | undefined,
	signal: AbortSignal,
): Promise<void> {
	const { repoName, gitRoot } = await getRepoIdentity(cwd)
	const portFile = `${process.env.HOME}/.cache/side-quest-git/${repoName}/events.port`

	const file = Bun.file(portFile)
	if (!(await file.exists())) {
		portCheckFailed = true
		return
	}

	const port = parseInt(await file.text(), 10)
	if (Number.isNaN(port)) return

	const event: EventEnvelope = {
		schemaVersion: SCHEMA_VERSION,
		type,
		timestamp: new Date().toISOString(),
		correlationId: correlationId || generateCorrelationId(),
		source: 'hook',
		repo: repoName,
		gitRoot,
		data,
	}

	await fetch(`http://127.0.0.1:${port}/events`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(event),
		signal,
	})
}

/**
 * Reset module-level caches. Exposed for testing only.
 * @internal
 */
export function _resetCaches(): void {
	cachedIdentity = null
	portCheckFailed = false
}
