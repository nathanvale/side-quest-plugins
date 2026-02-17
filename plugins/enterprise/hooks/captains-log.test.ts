import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Runs the captains-log.ts hook as a subprocess, piping the given
 * StopHookInput as JSON on stdin and pointing transcript_path at
 * the given transcript fixture.
 */
async function runHook(input: Record<string, unknown>): Promise<{ exitCode: number }> {
	const hookPath = join(import.meta.dir, 'captains-log.ts')
	const proc = Bun.spawn(['bun', 'run', hookPath], {
		stdin: new Blob([JSON.stringify(input)]),
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const exitCode = await proc.exited
	return { exitCode }
}

/** Build a transcript JSONL string from assistant tool_use blocks. */
function buildTranscript(blocks: Array<{ name: string; input: Record<string, unknown> }>): string {
	const line = {
		type: 'assistant',
		message: {
			role: 'assistant',
			content: blocks.map((b) => ({
				type: 'tool_use',
				name: b.name,
				input: b.input,
			})),
		},
	}
	return JSON.stringify(line) + '\n'
}

describe('captains-log stop hook', () => {
	let tmpDir: string

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), 'captains-log-test-'))
	})

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true })
	})

	test('exits cleanly with empty stdin', async () => {
		const proc = Bun.spawn(['bun', 'run', join(import.meta.dir, 'captains-log.ts')], {
			stdin: new Blob(['']),
			stdout: 'pipe',
			stderr: 'pipe',
		})
		expect(await proc.exited).toBe(0)
	})

	test('exits cleanly when stop_hook_active is true', async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')
		writeFileSync(
			transcriptPath,
			buildTranscript([{ name: 'Skill', input: { skill: 'enterprise:document', args: 'src/' } }]),
		)

		const result = await runHook({
			session_id: 'test-1',
			cwd: tmpDir,
			transcript_path: transcriptPath,
			stop_hook_active: true,
		})

		expect(result.exitCode).toBe(0)
		// Should NOT have written any log file
		expect(existsSync(join(tmpDir, 'logs'))).toBe(false)
	})

	test('exits cleanly with no Enterprise activity', async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')
		// A session that only uses Read/Grep -- no Enterprise commands
		writeFileSync(
			transcriptPath,
			buildTranscript([
				{ name: 'Read', input: { file_path: '/some/file.ts' } },
				{ name: 'Grep', input: { pattern: 'foo', path: '/some/dir' } },
			]),
		)

		const result = await runHook({
			session_id: 'test-2',
			cwd: tmpDir,
			transcript_path: transcriptPath,
		})

		expect(result.exitCode).toBe(0)
		expect(existsSync(join(tmpDir, 'logs'))).toBe(false)
	})

	test('detects Skill call to enterprise:document', async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')
		writeFileSync(
			transcriptPath,
			buildTranscript([
				{ name: 'Skill', input: { skill: 'enterprise:document', args: 'src/utils' } },
			]),
		)

		const result = await runHook({
			session_id: 'test-3',
			cwd: tmpDir,
			transcript_path: transcriptPath,
		})

		expect(result.exitCode).toBe(0)

		const today = new Date().toISOString().slice(0, 10)
		const logFile = join(tmpDir, 'logs', `captains-log-${today}.jsonl`)
		expect(existsSync(logFile)).toBe(true)

		const lines = readFileSync(logFile, 'utf-8').trim().split('\n')
		expect(lines).toHaveLength(1)

		const event = JSON.parse(lines[0]!)
		expect(event.event).toBe('documentation_completed')
		expect(event.command).toBe('document')
		expect(event.officer).toBe('spock')
		expect(event.summary).toContain('src/utils')
		expect(event.ts).toBeDefined()
		expect(event.telemetry).toBeDefined()
	})

	test('detects Skill call to enterprise:scan', async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')
		writeFileSync(
			transcriptPath,
			buildTranscript([
				{ name: 'Skill', input: { skill: 'enterprise:scan', args: '--focus security src/' } },
			]),
		)

		const result = await runHook({
			session_id: 'test-4',
			cwd: tmpDir,
			transcript_path: transcriptPath,
		})

		expect(result.exitCode).toBe(0)

		const today = new Date().toISOString().slice(0, 10)
		const logFile = join(tmpDir, 'logs', `captains-log-${today}.jsonl`)
		const lines = readFileSync(logFile, 'utf-8').trim().split('\n')
		const event = JSON.parse(lines[0]!)

		expect(event.event).toBe('scan_completed')
		expect(event.officer).toBe('mccoy')
	})

	test('detects Builder Task dispatch', async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')
		writeFileSync(
			transcriptPath,
			buildTranscript([
				{
					name: 'Task',
					input: {
						description: 'Builder: implement JWT middleware',
						subagent_type: 'enterprise:builder-scotty',
						model: 'sonnet',
					},
				},
			]),
		)

		const result = await runHook({
			session_id: 'test-5',
			cwd: tmpDir,
			transcript_path: transcriptPath,
		})

		expect(result.exitCode).toBe(0)

		const today = new Date().toISOString().slice(0, 10)
		const logFile = join(tmpDir, 'logs', `captains-log-${today}.jsonl`)
		const lines = readFileSync(logFile, 'utf-8').trim().split('\n')
		const event = JSON.parse(lines[0]!)

		expect(event.event).toBe('implementation_completed')
		expect(event.officer).toBe('scotty')
		expect(event.summary).toContain('Builder: implement JWT middleware')
		expect(event.telemetry.model).toBe('sonnet')
	})

	test('detects "Builder: fix" as fix_applied (not implementation_completed)', async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')
		writeFileSync(
			transcriptPath,
			buildTranscript([
				{
					name: 'Task',
					input: {
						description: 'Builder: fix missing error handling',
						subagent_type: 'enterprise:builder-scotty',
						model: 'sonnet',
					},
				},
			]),
		)

		const result = await runHook({
			session_id: 'test-6',
			cwd: tmpDir,
			transcript_path: transcriptPath,
		})

		expect(result.exitCode).toBe(0)

		const today = new Date().toISOString().slice(0, 10)
		const logFile = join(tmpDir, 'logs', `captains-log-${today}.jsonl`)
		const lines = readFileSync(logFile, 'utf-8').trim().split('\n')
		const event = JSON.parse(lines[0]!)

		expect(event.event).toBe('fix_applied')
		expect(event.officer).toBe('scotty')
	})

	test('detects Validator Task dispatch', async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')
		writeFileSync(
			transcriptPath,
			buildTranscript([
				{
					name: 'Task',
					input: {
						description: 'Validator: review JWT middleware',
						subagent_type: 'enterprise:validator-mccoy',
						model: 'opus',
					},
				},
			]),
		)

		const result = await runHook({
			session_id: 'test-7',
			cwd: tmpDir,
			transcript_path: transcriptPath,
		})

		expect(result.exitCode).toBe(0)

		const today = new Date().toISOString().slice(0, 10)
		const logFile = join(tmpDir, 'logs', `captains-log-${today}.jsonl`)
		const lines = readFileSync(logFile, 'utf-8').trim().split('\n')
		const event = JSON.parse(lines[0]!)

		expect(event.event).toBe('review_completed')
		expect(event.officer).toBe('mccoy')
		expect(event.telemetry.model).toBe('opus')
	})

	test("detects Ship's Computer dispatch", async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')
		writeFileSync(
			transcriptPath,
			buildTranscript([
				{
					name: 'Task',
					input: {
						description: "Ship's Computer: readme for src/utils",
						subagent_type: 'enterprise:ships-computer-cpu',
						model: 'sonnet',
					},
				},
			]),
		)

		const result = await runHook({
			session_id: 'test-8',
			cwd: tmpDir,
			transcript_path: transcriptPath,
		})

		expect(result.exitCode).toBe(0)

		const today = new Date().toISOString().slice(0, 10)
		const logFile = join(tmpDir, 'logs', `captains-log-${today}.jsonl`)
		const lines = readFileSync(logFile, 'utf-8').trim().split('\n')
		const event = JSON.parse(lines[0]!)

		expect(event.event).toBe('computer_dispatch')
		expect(event.officer).toBe('computer')
	})

	test('multi-command session produces multiple events', async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')

		// Simulate a session: chart -> engage -> builder -> validator
		const transcript = [
			buildTranscript([
				{ name: 'Skill', input: { skill: 'enterprise:chart', args: 'add auth middleware' } },
			]),
			buildTranscript([
				{ name: 'Skill', input: { skill: 'enterprise:engage', args: '--plan specs/auth-plan.md' } },
			]),
			buildTranscript([
				{
					name: 'Task',
					input: { description: 'Builder: implement auth middleware', model: 'sonnet' },
				},
			]),
			buildTranscript([
				{
					name: 'Task',
					input: { description: 'Validator: review auth middleware', model: 'opus' },
				},
			]),
		].join('')

		writeFileSync(transcriptPath, transcript)

		const result = await runHook({
			session_id: 'test-9',
			cwd: tmpDir,
			transcript_path: transcriptPath,
		})

		expect(result.exitCode).toBe(0)

		const today = new Date().toISOString().slice(0, 10)
		const logFile = join(tmpDir, 'logs', `captains-log-${today}.jsonl`)
		const lines = readFileSync(logFile, 'utf-8').trim().split('\n')

		expect(lines.length).toBe(4)

		const events = lines.map((l) => JSON.parse(l))
		expect(events[0].event).toBe('plan_created')
		expect(events[1].event).toBe('engage_started')
		expect(events[2].event).toBe('implementation_completed')
		expect(events[3].event).toBe('review_completed')
	})

	test('deduplicates repeated Skill calls', async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')
		// Same skill invoked twice (e.g., user ran /enterprise:scan twice)
		const transcript = [
			buildTranscript([{ name: 'Skill', input: { skill: 'enterprise:scan', args: 'src/' } }]),
			buildTranscript([{ name: 'Skill', input: { skill: 'enterprise:scan', args: 'src/' } }]),
		].join('')

		writeFileSync(transcriptPath, transcript)

		const result = await runHook({
			session_id: 'test-10',
			cwd: tmpDir,
			transcript_path: transcriptPath,
		})

		expect(result.exitCode).toBe(0)

		const today = new Date().toISOString().slice(0, 10)
		const logFile = join(tmpDir, 'logs', `captains-log-${today}.jsonl`)
		const lines = readFileSync(logFile, 'utf-8').trim().split('\n')

		// Should only have 1 event, not 2
		expect(lines).toHaveLength(1)
	})

	test('creates logs/ directory if it does not exist', async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')
		writeFileSync(
			transcriptPath,
			buildTranscript([{ name: 'Skill', input: { skill: 'enterprise:chart', args: 'something' } }]),
		)

		expect(existsSync(join(tmpDir, 'logs'))).toBe(false)

		await runHook({
			session_id: 'test-11',
			cwd: tmpDir,
			transcript_path: transcriptPath,
		})

		expect(existsSync(join(tmpDir, 'logs'))).toBe(true)
	})

	test('ignores non-assistant transcript lines', async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')
		// User message that mentions enterprise skill -- should be ignored
		const userLine = JSON.stringify({
			type: 'user',
			message: {
				role: 'user',
				content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'enterprise:document' } }],
			},
		})
		writeFileSync(transcriptPath, userLine + '\n')

		const result = await runHook({
			session_id: 'test-12',
			cwd: tmpDir,
			transcript_path: transcriptPath,
		})

		expect(result.exitCode).toBe(0)
		expect(existsSync(join(tmpDir, 'logs'))).toBe(false)
	})

	test('Skill with no args uses "invoked" as summary fallback', async () => {
		const transcriptPath = join(tmpDir, 'transcript.jsonl')
		writeFileSync(
			transcriptPath,
			buildTranscript([{ name: 'Skill', input: { skill: 'enterprise:log' } }]),
		)

		await runHook({
			session_id: 'test-13',
			cwd: tmpDir,
			transcript_path: transcriptPath,
		})

		const today = new Date().toISOString().slice(0, 10)
		const logFile = join(tmpDir, 'logs', `captains-log-${today}.jsonl`)
		const event = JSON.parse(readFileSync(logFile, 'utf-8').trim())

		expect(event.summary).toBe('log: invoked')
	})
})
