#!/usr/bin/env bun

/**
 * Git Safety Hook
 *
 * PreToolUse hook that blocks destructive git commands.
 * Returns exit code 2 with permissionDecision: "deny" for blocked commands.
 */

import { postEvent } from './event-bus-client'

interface PreToolUseHookInput {
	tool_name: string
	tool_input?: {
		command?: unknown
		file_path?: unknown
	}
	cwd?: string
}

interface PreToolUseHookSpecificOutput {
	hookEventName: 'PreToolUse'
	permissionDecision: 'deny'
	permissionDecisionReason?: string
}

const PROTECTED_BRANCHES = ['main', 'master']

/**
 * Patterns that identify a commit as a legitimate WIP checkpoint.
 * Only commits matching these patterns may use --no-verify.
 */
const WIP_MESSAGE_PATTERNS = [/chore\(wip\):/, /wip:/i]

const PROTECTED_FILE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
	{
		pattern: /\.env($|\.)/,
		reason: '.env files may contain secrets.',
	},
	{
		pattern: /credentials/,
		reason: 'Credential files should not be modified by agents.',
	},
	{
		pattern: /\.git\//,
		reason: 'Direct .git directory modifications are dangerous.',
	},
]

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
	{
		pattern: /git\s+push\s+.*(?:--force|-f)(?:\s|$)/,
		reason:
			'Force push can destroy remote history. Use --force-with-lease if you must.',
	},
	{
		pattern: /git\s+reset\s+--hard/,
		reason: 'Hard reset destroys uncommitted changes permanently.',
	},
	{
		pattern: /git\s+clean\s+.*-f/,
		reason: 'git clean -f permanently deletes untracked files.',
	},
	{
		pattern: /git\s+checkout\s+\.\s*(?:$|[;&|])/,
		reason: 'git checkout . discards all unstaged changes permanently.',
	},
	{
		pattern: /git\s+restore\s+\.\s*(?:$|[;&|])/,
		reason: 'git restore . discards all unstaged changes permanently.',
	},
	{
		pattern: /git\s+branch\s+.*-D\s/,
		reason: 'git branch -D force-deletes a branch even if not merged.',
	},
	{
		pattern:
			/(?:^|[;&|]\s*)git\s+(?:-C\s+\S+\s+)?worktree\s+remove\s+.*(?:--force|-f)\b/,
		reason:
			'Force-removing a worktree can destroy uncommitted work. Use `bunx @side-quest/git worktree delete` which checks status first.',
	},
]

/**
 * Custom checkers for patterns that are too complex for a single regex.
 * Each returns a block reason string, or null if allowed.
 */
const CUSTOM_CHECKERS: Array<(command: string) => string | null> = [
	/**
	 * Block `rm` with recursive+force flags targeting .worktrees paths.
	 * Catches combined flags (-rf, -fr), split flags (-r -f), -- separator,
	 * and flags mixed with other options (-rfi, etc.).
	 */
	(command) => {
		// Match rm followed by flags/-- then a .worktrees path
		const rmMatch = command.match(
			/(?:^|[;&|]\s*)rm\s+((?:-[a-zA-Z]+\s+)*)(?:--\s+)?(\S*\.worktrees(?:[/\\]|\s|$))/,
		)
		if (!rmMatch) return null

		// Collect all flag characters from all flag groups
		const flagsStr = rmMatch[1] || ''
		const allFlags = [...flagsStr.matchAll(/-([a-zA-Z]+)/g)]
			.map((m) => m[1])
			.join('')

		// Both -r and -f must be present (in any order, any group)
		if (allFlags.includes('r') && allFlags.includes('f')) {
			return 'Deleting .worktrees/ directly bypasses git worktree cleanup. Use `bunx @side-quest/git worktree clean` instead.'
		}
		return null
	},
]

export function checkCommand(command: string): {
	blocked: boolean
	reason?: string
} {
	for (const { pattern, reason } of BLOCKED_PATTERNS) {
		if (pattern.test(command)) {
			return { blocked: true, reason }
		}
	}
	for (const checker of CUSTOM_CHECKERS) {
		const reason = checker(command)
		if (reason) {
			return { blocked: true, reason }
		}
	}
	return { blocked: false }
}

export function checkFileEdit(filePath: string): {
	blocked: boolean
	reason?: string
} {
	for (const { pattern, reason } of PROTECTED_FILE_PATTERNS) {
		if (pattern.test(filePath)) {
			return { blocked: true, reason }
		}
	}
	return { blocked: false }
}

/**
 * Analyzes a command to determine if it's a git commit and what kind.
 * A legitimate WIP checkpoint requires both --no-verify AND a WIP message pattern.
 */
export function isCommitCommand(command: string): {
	isCommit: boolean
	hasNoVerify: boolean
	hasWipMessage: boolean
} {
	const commitPattern = /(?:^|&&\s*|;\s*)git\s+commit(?:\s|$)/
	const isCommit = commitPattern.test(command)
	if (!isCommit) {
		return { isCommit: false, hasNoVerify: false, hasWipMessage: false }
	}

	const hasNoVerify = command.includes('--no-verify')
	const hasWipMessage = WIP_MESSAGE_PATTERNS.some((p) => p.test(command))

	return { isCommit: true, hasNoVerify, hasWipMessage }
}

async function runGit(
	args: string[],
	cwd?: string,
): Promise<{ stdout: string; exitCode: number }> {
	const proc = Bun.spawn(['git', ...args], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const stdout = await new Response(proc.stdout).text()
	const exitCode = await proc.exited
	return { stdout: stdout.trim(), exitCode }
}

export async function getCurrentBranch(cwd?: string): Promise<string | null> {
	try {
		const result = await runGit(['branch', '--show-current'], cwd)
		if (result.exitCode !== 0) {
			return null
		}
		return result.stdout || null
	} catch {
		return null
	}
}

if (import.meta.main) {
	try {
		let input: PreToolUseHookInput
		try {
			input = (await Bun.stdin.json()) as PreToolUseHookInput
		} catch {
			process.exit(0)
		}

		const toolInput = input.tool_input

		if (input.tool_name === 'Write' || input.tool_name === 'Edit') {
			const filePath = toolInput?.file_path
			if (typeof filePath !== 'string') {
				process.exit(0)
			}

			const fileResult = checkFileEdit(filePath)
			if (fileResult.blocked) {
				const hookSpecificOutput: PreToolUseHookSpecificOutput = {
					hookEventName: 'PreToolUse',
					permissionDecision: 'deny',
					permissionDecisionReason: fileResult.reason,
				}
				console.log(JSON.stringify({ hookSpecificOutput }))
				try {
					await postEvent(input.cwd || process.cwd(), 'safety.blocked', {
						tool: input.tool_name,
						reason: hookSpecificOutput.permissionDecisionReason,
					})
				} catch {
					// event emission is best-effort
				}
				process.exit(2)
			}

			process.exit(0)
		}

		if (input.tool_name !== 'Bash') {
			process.exit(0)
		}

		const command = toolInput?.command
		if (typeof command !== 'string') {
			process.exit(0)
		}

		const commandResult = checkCommand(command)
		if (commandResult.blocked) {
			const hookSpecificOutput: PreToolUseHookSpecificOutput = {
				hookEventName: 'PreToolUse',
				permissionDecision: 'deny',
				permissionDecisionReason: commandResult.reason,
			}
			console.log(JSON.stringify({ hookSpecificOutput }))
			try {
				await postEvent(input.cwd || process.cwd(), 'safety.blocked', {
					tool: input.tool_name,
					reason: hookSpecificOutput.permissionDecisionReason,
				})
			} catch {
				// event emission is best-effort
			}
			process.exit(2)
		}

		const commitCheck = isCommitCommand(command)
		if (commitCheck.isCommit) {
			const isLegitimateWip =
				commitCheck.hasNoVerify && commitCheck.hasWipMessage

			// Block ALL commits on protected branches (including WIP checkpoints)
			const branch = await getCurrentBranch(input.cwd)
			if (branch && PROTECTED_BRANCHES.includes(branch)) {
				const hookSpecificOutput: PreToolUseHookSpecificOutput = {
					hookEventName: 'PreToolUse',
					permissionDecision: 'deny',
					permissionDecisionReason: [
						`BLOCKED: Cannot commit directly to ${branch}.`,
						'',
						'Create a feature branch first:',
						'  git checkout -b <type>/<description>',
						'',
						'Then commit on the new branch.',
					].join('\n'),
				}
				console.log(JSON.stringify({ hookSpecificOutput }))
				try {
					await postEvent(input.cwd || process.cwd(), 'safety.blocked', {
						tool: input.tool_name,
						reason: hookSpecificOutput.permissionDecisionReason,
					})
				} catch {
					// event emission is best-effort
				}
				process.exit(2)
			}

			// Block --no-verify on non-WIP commits (prevents bypassing pre-commit hooks)
			if (commitCheck.hasNoVerify && !isLegitimateWip) {
				const hookSpecificOutput: PreToolUseHookSpecificOutput = {
					hookEventName: 'PreToolUse',
					permissionDecision: 'deny',
					permissionDecisionReason: [
						'BLOCKED: --no-verify is only allowed for WIP checkpoint commits.',
						'',
						'For regular commits, remove --no-verify so pre-commit hooks run.',
						'For WIP checkpoints, use a WIP message pattern:',
						'  git commit --no-verify -m "chore(wip): <description>"',
					].join('\n'),
				}
				console.log(JSON.stringify({ hookSpecificOutput }))
				try {
					await postEvent(input.cwd || process.cwd(), 'safety.blocked', {
						tool: input.tool_name,
						reason: hookSpecificOutput.permissionDecisionReason,
					})
				} catch {
					// event emission is best-effort
				}
				process.exit(2)
			}
		}
	} catch {
		// never crash the hook
	}

	process.exit(0)
}
