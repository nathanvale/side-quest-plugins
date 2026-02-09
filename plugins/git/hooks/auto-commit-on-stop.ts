#!/usr/bin/env bun

/**
 * Auto-Commit On Stop Hook
 *
 * Stop hook that creates WIP checkpoints for tracked changes.
 */

import { readFile } from 'node:fs/promises'

interface StopHookInput {
	cwd: string
	transcript_path: string
	stop_hook_active?: boolean
}

interface GitStatus {
	staged: number
	modified: number
	untracked: number
}

export function parseGitStatus(output: string): GitStatus {
	const lines = output.split('\n').filter((line) => line.trim() !== '')
	let staged = 0
	let modified = 0
	let untracked = 0

	for (const line of lines) {
		if (line.startsWith('##')) {
			continue
		}

		const indexStatus = line[0]
		const workTreeStatus = line[1]

		if (indexStatus === '?' || line.startsWith('??')) {
			untracked++
			continue
		}

		if (indexStatus !== ' ' && indexStatus !== '?') {
			staged++
		}
		if (workTreeStatus !== ' ' && workTreeStatus !== '?') {
			modified++
		}
	}

	return { staged, modified, untracked }
}

async function runGit(
	args: string[],
	cwd: string,
): Promise<{ stdout: string; exitCode: number }> {
	const proc = Bun.spawn(['git', ...args], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const stdout = await new Response(proc.stdout).text()
	const exitCode = await proc.exited
	return { stdout, exitCode }
}

export async function getGitStatus(cwd: string): Promise<GitStatus | null> {
	const result = await runGit(['status', '--porcelain'], cwd)
	if (result.exitCode !== 0) {
		return null
	}
	return parseGitStatus(result.stdout)
}

export async function getLastUserPrompt(
	transcriptPath: string,
): Promise<string | null> {
	try {
		const content = await readFile(transcriptPath, 'utf-8')
		const lines = content.split('\n').filter((line) => line.trim() !== '')

		let lastUserPrompt: string | null = null
		for (const line of lines) {
			try {
				const parsed = JSON.parse(line)
				if (parsed.type === 'user' && parsed.message?.content) {
					lastUserPrompt = parsed.message.content
				}
			} catch {
				// skip malformed lines
			}
		}

		return lastUserPrompt
	} catch {
		return null
	}
}

export function truncateForSubject(text: string, maxLen: number): string {
	if (text.length <= maxLen) {
		return text
	}
	return `${text.slice(0, maxLen - 3)}...`
}

export function generateCommitMessage(prompt: string | null): string {
	const subjectMaxLen = 50
	const effectivePrompt =
		typeof prompt === 'string' && prompt.trim() !== ''
			? prompt
			: 'session checkpoint'
	const truncatedPrompt = truncateForSubject(effectivePrompt, subjectMaxLen)

	return `chore(wip): ${truncatedPrompt}\n\nSession work in progress - run /git:commit to squash.`
}

export async function createAutoCommit(
	cwd: string,
	message: string,
): Promise<boolean> {
	const addResult = await runGit(['add', '-u'], cwd)
	if (addResult.exitCode !== 0) {
		return false
	}

	const commitResult = await runGit(
		['commit', '--no-verify', '-m', message],
		cwd,
	)
	return commitResult.exitCode === 0
}

export function printUserNotification(commitMessage: string): void {
	const subjectLine = commitMessage.split('\n')[0]
	console.log(`✓ WIP checkpoint saved: ${subjectLine}`)
	console.log('  Run /git:commit when ready to finalize')
}

if (import.meta.main) {
	try {
		let input: StopHookInput
		try {
			input = (await Bun.stdin.json()) as StopHookInput
		} catch {
			process.exit(0)
		}

		if (input.stop_hook_active) {
			process.exit(0)
		}

		const status = await getGitStatus(input.cwd)
		if (!status) {
			process.exit(0)
		}

		if (status.staged === 0 && status.modified === 0) {
			process.exit(0)
		}

		const lastPrompt = await getLastUserPrompt(input.transcript_path)
		const commitMessage = generateCommitMessage(lastPrompt)
		const success = await createAutoCommit(input.cwd, commitMessage)

		if (success) {
			printUserNotification(commitMessage)
		} else {
			console.error(
				'Warning: Failed to create WIP commit. Changes remain uncommitted.',
			)
		}
	} catch {
		// never crash the hook
	}

	process.exit(0)
}
