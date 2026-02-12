import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _resetCaches, postEvent } from './event-bus-client'
import { getStableRepoName } from './git-status-parser'

/**
 * Helper to create a temp HOME directory with the expected port file path.
 * Returns the temp HOME path and cleanup function.
 */
async function createPortFileSetup(portContent: string): Promise<{
	tempHome: string
	cleanup: () => void
}> {
	const repoName = await getStableRepoName(process.cwd())
	const tempHome = join(
		tmpdir(),
		`event-bus-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
	)
	const portDir = join(tempHome, '.cache', 'side-quest-git', repoName)
	mkdirSync(portDir, { recursive: true })
	writeFileSync(join(portDir, 'events.port'), portContent)

	return {
		tempHome,
		cleanup: () => rmSync(tempHome, { recursive: true, force: true }),
	}
}

describe('event-bus-client', () => {
	const originalHome = process.env.HOME
	const servers: Array<ReturnType<typeof Bun.serve>> = []

	afterEach(() => {
		process.env.HOME = originalHome
		delete process.env.SIDE_QUEST_EVENTS
		_resetCaches()
	})

	afterAll(() => {
		for (const server of servers) {
			server.stop(true)
		}
	})

	test('port file missing returns silently (no throw)', async () => {
		const tempHome = join(
			tmpdir(),
			`event-bus-no-port-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		)
		mkdirSync(tempHome, { recursive: true })
		process.env.HOME = tempHome

		// Should resolve without throwing -- no port file exists
		await expect(postEvent(process.cwd(), 'session.started', {})).resolves.toBeUndefined()

		rmSync(tempHome, { recursive: true, force: true })
	})

	test('invalid port file content returns silently', async () => {
		const { tempHome, cleanup } = await createPortFileSetup('not-a-number')
		process.env.HOME = tempHome

		await expect(postEvent(process.cwd(), 'session.started', {})).resolves.toBeUndefined()

		cleanup()
	})

	test('successful POST sends correct EventEnvelope shape', async () => {
		let receivedBody: Record<string, unknown> | null = null
		const resolver = Promise.withResolvers<void>()

		const server = Bun.serve({
			port: 0,
			fetch: async (req) => {
				receivedBody = (await req.json()) as Record<string, unknown>
				resolver.resolve()
				return new Response('ok', { status: 200 })
			},
		})
		servers.push(server)

		const { tempHome, cleanup } = await createPortFileSetup(String(server.port))
		process.env.HOME = tempHome

		await postEvent(process.cwd(), 'session.started', { foo: 'bar' }, 'test-correlation-123')

		// Wait for the server to receive the request
		await resolver.promise

		expect(receivedBody).not.toBeNull()
		expect(receivedBody!.schemaVersion).toBe(1)
		expect(receivedBody!.type).toBe('session.started')
		expect(receivedBody!.timestamp).toBeTypeOf('string')
		expect(receivedBody!.correlationId).toBe('test-correlation-123')
		expect(receivedBody!.source).toBe('hook')
		expect(receivedBody!.repo).toBeTypeOf('string')
		expect(receivedBody!.gitRoot).toBeTypeOf('string')
		expect(receivedBody!.data).toEqual({ foo: 'bar' })

		cleanup()
	})

	test('AbortController fires when server hangs (completes within 1500ms)', async () => {
		const server = Bun.serve({
			port: 0,
			fetch: async () => {
				// Simulate a server that never responds by waiting longer than EMISSION_TIMEOUT_MS
				await Bun.sleep(10_000)
				return new Response('too late', { status: 200 })
			},
		})
		servers.push(server)

		const { tempHome, cleanup } = await createPortFileSetup(String(server.port))
		process.env.HOME = tempHome

		const start = Date.now()
		// Should resolve without throwing even though the server hangs
		await expect(postEvent(process.cwd(), 'session.started', {})).resolves.toBeUndefined()
		const elapsed = Date.now() - start

		// Should complete in well under 1500ms (abort fires at 500ms + some overhead)
		expect(elapsed).toBeLessThan(1500)

		cleanup()
	}, 5000)

	test('server error (500) does not throw', async () => {
		const server = Bun.serve({
			port: 0,
			fetch: () => {
				return new Response('Internal Server Error', { status: 500 })
			},
		})
		servers.push(server)

		const { tempHome, cleanup } = await createPortFileSetup(String(server.port))
		process.env.HOME = tempHome

		await expect(
			postEvent(process.cwd(), 'safety.blocked', { reason: 'test' }),
		).resolves.toBeUndefined()

		cleanup()
	})

	test('SIDE_QUEST_EVENTS=0 skips emission entirely', async () => {
		let requestReceived = false
		const server = Bun.serve({
			port: 0,
			fetch: async () => {
				requestReceived = true
				return new Response('ok', { status: 200 })
			},
		})
		servers.push(server)

		const { tempHome, cleanup } = await createPortFileSetup(String(server.port))
		process.env.HOME = tempHome
		process.env.SIDE_QUEST_EVENTS = '0'

		await postEvent(process.cwd(), 'session.started', { foo: 'bar' })

		// Give the server a moment to receive any stray request
		await Bun.sleep(50)

		expect(requestReceived).toBe(false)

		cleanup()
	})

	test('portCheckFailed negative cache skips subsequent calls', async () => {
		// First call: no port file -- sets portCheckFailed
		const tempHome = join(
			tmpdir(),
			`event-bus-neg-cache-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		)
		mkdirSync(tempHome, { recursive: true })
		process.env.HOME = tempHome

		await postEvent(process.cwd(), 'session.started', {})

		// Now create a port file with a server -- second call should still skip
		let requestReceived = false
		const server = Bun.serve({
			port: 0,
			fetch: async () => {
				requestReceived = true
				return new Response('ok', { status: 200 })
			},
		})
		servers.push(server)

		const repoName = await getStableRepoName(process.cwd())
		const portDir = join(tempHome, '.cache', 'side-quest-git', repoName)
		mkdirSync(portDir, { recursive: true })
		writeFileSync(join(portDir, 'events.port'), String(server.port))

		await postEvent(process.cwd(), 'session.started', { foo: 'bar' })
		await Bun.sleep(50)

		// The negative cache should prevent reaching the server
		expect(requestReceived).toBe(false)

		rmSync(tempHome, { recursive: true, force: true })
	})
})
