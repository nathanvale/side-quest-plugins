#!/usr/bin/env bun

/**
 * PostToolUse hook: Run tsc type checking on edited TypeScript files.
 *
 * Self-contained — uses only Bun built-in APIs.
 * Groups files by nearest tsconfig, runs tsc once per package.
 * Exit 0 = clean, Exit 2 = type errors (blocking).
 */

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const TS_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts']
const CONFIG_FILES = ['tsconfig.json', 'jsconfig.json']

interface HookInput {
	tool_name: string
	tool_input?: {
		file_path?: string
		edits?: Array<{ file_path: string }>
	}
}

interface TscError {
	file: string
	line: number
	col: number
	message: string
}

function extractFilePaths(input: HookInput): string[] {
	const paths: string[] = []
	if (input.tool_input?.file_path) paths.push(input.tool_input.file_path)
	if (input.tool_input?.edits) {
		for (const edit of input.tool_input.edits) {
			if (edit.file_path && !paths.includes(edit.file_path)) {
				paths.push(edit.file_path)
			}
		}
	}
	return paths
}

function findNearestConfig(filePath: string): string | null {
	let dir = dirname(resolve(filePath))
	const root = '/'
	while (dir !== root) {
		for (const configFile of CONFIG_FILES) {
			const candidate = join(dir, configFile)
			if (existsSync(candidate)) return dir
		}
		const parent = dirname(dir)
		if (parent === dir) break
		dir = parent
	}
	return null
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
	const input = await Bun.stdin.text()
	let hookInput: HookInput
	try {
		hookInput = JSON.parse(input)
	} catch {
		process.exit(0)
	}

	const filePaths = extractFilePaths(hookInput).filter((f) =>
		TS_EXTENSIONS.some((ext) => f.endsWith(ext)),
	)

	if (filePaths.length === 0) process.exit(0)

	// Group files by nearest tsconfig directory
	const byConfigDir = new Map<string, string[]>()
	for (const filePath of filePaths) {
		const configDir = findNearestConfig(filePath)
		if (!configDir) continue
		const files = byConfigDir.get(configDir) || []
		files.push(filePath)
		byConfigDir.set(configDir, files)
	}

	const allErrors: TscError[] = []

	for (const [cwd, editedFiles] of byConfigDir) {
		const proc = Bun.spawn(['bunx', 'tsc', '--noEmit', '--pretty', 'false'], {
			cwd,
			stdout: 'pipe',
			stderr: 'pipe',
			env: { ...process.env, CI: 'true' },
		})
		const exitCode = await proc.exited
		if (exitCode === 0) continue

		const stdout = await new Response(proc.stdout).text()
		const stderr = await new Response(proc.stderr).text()
		const errors = parseTscOutput(`${stdout}${stderr}`)

		// Filter to only errors in edited files
		const editedBasenames = new Set(
			editedFiles.map((f) => resolve(f).replace(`${cwd}/`, '')),
		)
		for (const error of errors) {
			if (editedBasenames.has(error.file)) {
				allErrors.push(error)
			}
		}
	}

	if (allErrors.length > 0) {
		console.error(
			JSON.stringify({
				tool: 'tsc',
				status: 'error',
				errorCount: allErrors.length,
				errors: allErrors.slice(0, 20),
			}),
		)
		process.exit(2)
	}

	process.exit(0)
}

main()
