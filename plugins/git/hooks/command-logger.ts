#!/usr/bin/env bun

/**
 * Command Logger Hook
 *
 * PostToolUse hook that logs Bash commands to an audit trail.
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

interface PostToolUseHookInput {
	tool_name: string
	tool_input?: {
		command?: unknown
	}
	session_id?: string
	cwd?: string
}

export interface CommandLogEntry {
	timestamp: string
	session_id: string
	cwd: string
	command: string
}

export function createLogEntry(
	input: PostToolUseHookInput,
): CommandLogEntry | null {
	if (input.tool_name !== 'Bash') {
		return null
	}

	const command = input.tool_input?.command
	if (typeof command !== 'string') {
		return null
	}

	return {
		timestamp: new Date().toISOString(),
		session_id: input.session_id || 'unknown',
		cwd: input.cwd || 'unknown',
		command,
	}
}

if (import.meta.main) {
	try {
		let input: PostToolUseHookInput
		try {
			input = (await Bun.stdin.json()) as PostToolUseHookInput
		} catch {
			process.exit(0)
		}

		const entry = createLogEntry(input)
		if (!entry) {
			process.exit(0)
		}

		const logDir = join(homedir(), '.claude', 'logs')
		const logPath = join(logDir, 'git-command-log.jsonl')

		await Bun.spawn(['mkdir', '-p', logDir], {
			stdout: 'pipe',
			stderr: 'pipe',
		}).exited

		const file = Bun.file(logPath)
		const existing = (await file.exists()) ? await file.text() : ''
		const separator = existing.endsWith('\n') || existing === '' ? '' : '\n'
		await Bun.write(
			logPath,
			`${existing}${separator}${JSON.stringify(entry)}\n`,
		)
	} catch {
		// fire and forget
	}

	process.exit(0)
}
