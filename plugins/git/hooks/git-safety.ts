#!/usr/bin/env bun

/**
 * Git Safety Hook
 *
 * PreToolUse hook that blocks destructive git commands.
 * Returns exit code 2 with permissionDecision: "deny" for blocked commands.
 */

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
				process.exit(2)
			}
		}
	} catch {
		// never crash the hook
	}

	process.exit(0)
}
