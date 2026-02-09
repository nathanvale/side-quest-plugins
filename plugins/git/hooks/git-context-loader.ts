#!/usr/bin/env bun

/**
 * Git Context Loader Hook
 *
 * SessionStart hook that loads git context at startup.
 */

import { parsePorcelainStatus } from './git-status-parser'

interface SessionStartHookInput {
	cwd: string
	source: string
}

interface GitContext {
	branch: string
	status: {
		staged: number
		modified: number
		untracked: number
	}
	recentCommits: string[]
}

async function runGit(
	args: string[],
	cwd: string,
): Promise<{ stdout: string; exitCode: number }> {
	const proc = Bun.spawn(['git', ...args], {
		cwd,
		stdout: 'pipe',
		stderr: 'ignore',
	})
	const stdout = await new Response(proc.stdout).text()
	const exitCode = await proc.exited
	return { stdout: stdout.trim(), exitCode }
}

async function isGitRepo(cwd: string): Promise<boolean> {
	const { exitCode } = await runGit(['rev-parse', '--git-dir'], cwd)
	return exitCode === 0
}

async function getGitContext(cwd: string): Promise<GitContext | null> {
	if (!(await isGitRepo(cwd))) {
		return null
	}

	const statusResult = await runGit(['status', '--porcelain', '-b'], cwd)
	if (statusResult.exitCode !== 0) {
		return null
	}

	const { branch, counts } = parsePorcelainStatus(statusResult.stdout)

	const commitsResult = await runGit(
		['log', '--oneline', '-5', '--format=%h %s (%ar)'],
		cwd,
	)

	const recentCommits =
		commitsResult.exitCode === 0
			? commitsResult.stdout
					.split('\n')
					.map((line) => line.trim())
					.filter(Boolean)
			: []

	return {
		branch: branch || '(detached)',
		status: counts,
		recentCommits,
	}
}

function formatContext(context: GitContext): string {
	const { branch, status, recentCommits } = context
	let output = 'Git Context:\n'
	output += `  Branch: ${branch}\n`
	output += `  Status: ${status.staged} staged, ${status.modified} modified, ${status.untracked} untracked\n`
	output += '\nRecent commits:\n'

	if (recentCommits.length > 0) {
		for (const commit of recentCommits) {
			output += `  ${commit}\n`
		}
	} else {
		output += '  (no commits yet)\n'
	}

	output += '\nGit workflow: /git:commit, /git:squash, /git:checkpoint'
	output +=
		'\ngit-expert skill handles: commits, PRs, history, worktrees, changelog, branch compare, squash, safety guards'

	return output
}

function formatSystemMessage(context: GitContext): string {
	const { branch, status, recentCommits } = context
	const totalChanges = status.staged + status.modified + status.untracked
	const changesSuffix = totalChanges > 0 ? `, ${totalChanges} changes` : ''
	const lastCommit =
		recentCommits[0]?.split(' ').slice(1).join(' ') || 'no commits'
	return `Git: ${branch}${changesSuffix} | Last: ${lastCommit} | /git:commit /git:squash /git:checkpoint`
}

if (import.meta.main) {
	try {
		let input: SessionStartHookInput
		try {
			input = (await Bun.stdin.json()) as SessionStartHookInput
		} catch {
			process.exit(0)
		}

		if (input.source === 'startup') {
			const context = await getGitContext(input.cwd)
			if (context) {
				console.log(
					JSON.stringify({
						systemMessage: formatSystemMessage(context),
						hookSpecificOutput: {
							hookEventName: 'SessionStart',
							additionalContext: formatContext(context),
						},
					}),
				)
			}
		}
	} catch {
		// never crash the hook
	}

	process.exit(0)
}
