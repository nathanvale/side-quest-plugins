#!/usr/bin/env bun

/**
 * Stop hook: Run project-wide tsc type checking at session end.
 *
 * Self-contained — uses only Bun built-in APIs.
 * Detects Bun workspace vs single package, runs appropriate command.
 * Reports ALL type errors (TypeScript errors cascade across files).
 * Exit 0 = clean, Exit 2 = type errors (blocking).
 */

import { existsSync, readFileSync } from 'node:fs'

const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']

async function getGitRoot(): Promise<string | null> {
	const proc = Bun.spawn(['git', 'rev-parse', '--show-toplevel'], {
		stdout: 'pipe',
		stderr: 'pipe',
	})
	if ((await proc.exited) !== 0) return null
	return (await new Response(proc.stdout).text()).trim() || null
}

async function hasChangedTsFiles(): Promise<boolean> {
	const commands = [
		['git', 'diff', '--cached', '--name-only'],
		['git', 'diff', '--name-only'],
		['git', 'ls-files', '--others', '--exclude-standard'],
	]

	for (const cmd of commands) {
		const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
		await proc.exited
		const output = await new Response(proc.stdout).text()
		for (const file of output.trim().split('\n')) {
			if (file && TS_EXTENSIONS.some((ext) => file.endsWith(ext))) {
				return true
			}
		}
	}
	return false
}

function isWorkspace(root: string): boolean {
	try {
		const pkg = JSON.parse(readFileSync(`${root}/package.json`, 'utf-8'))
		return Array.isArray(pkg.workspaces) && pkg.workspaces.length > 0
	} catch {
		return false
	}
}

interface TscError {
	file: string
	line: number
	col: number
	message: string
}

function parseTscOutput(output: string): TscError[] {
	const errors: TscError[] = []
	const pattern = /^(.+?)\((\d+),(\d+)\):\s*error\s+TS\d+:\s*(.+)$/gm
	for (const match of output.matchAll(pattern)) {
		const [, file, line, col, message] = match
		if (file && line && col && message) {
			errors.push({
				file,
				line: Number.parseInt(line, 10),
				col: Number.parseInt(col, 10),
				message,
			})
		}
	}
	return errors
}

async function main() {
	const root = await getGitRoot()
	if (!root) process.exit(0)

	if (!existsSync(`${root}/tsconfig.json`)) process.exit(0)
	if (!(await hasChangedTsFiles())) process.exit(0)

	const cmd = isWorkspace(root)
		? ['bun', 'run', '--filter', '*', 'typecheck']
		: ['bunx', 'tsc', '--noEmit', '--pretty', 'false']

	const proc = Bun.spawn(cmd, {
		cwd: root,
		stdout: 'pipe',
		stderr: 'pipe',
		env: { ...process.env, CI: 'true' },
	})

	const exitCode = await proc.exited
	if (exitCode === 0) process.exit(0)

	const stdout = await new Response(proc.stdout).text()
	const stderr = await new Response(proc.stderr).text()
	const errors = parseTscOutput(`${stdout}${stderr}`)

	if (errors.length > 0) {
		console.error(
			JSON.stringify({
				tool: 'tsc-ci',
				status: 'error',
				errorCount: errors.length,
				errors: errors.slice(0, 30),
			}),
		)
		process.exit(2)
	}

	process.exit(0)
}

main()
