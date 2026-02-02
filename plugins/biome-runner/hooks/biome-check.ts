#!/usr/bin/env bun

/**
 * PostToolUse hook: Auto-fix formatting and lint after Write/Edit.
 *
 * Self-contained — uses only Bun built-in APIs.
 * Runs biome check --write, then checks for remaining errors.
 * Exit 0 = clean, Exit 2 = unfixable errors (blocking).
 */

import { existsSync } from 'node:fs'

const SUPPORTED_EXTENSIONS = [
	'.js',
	'.ts',
	'.jsx',
	'.tsx',
	'.mjs',
	'.mts',
	'.cjs',
	'.cts',
	'.json',
	'.jsonc',
]

interface HookInput {
	tool_name: string
	tool_input?: {
		file_path?: string
		edits?: Array<{ file_path: string }>
	}
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

async function getGitRoot(): Promise<string | null> {
	const proc = Bun.spawn(['git', 'rev-parse', '--show-toplevel'], {
		stdout: 'pipe',
		stderr: 'pipe',
	})
	if ((await proc.exited) !== 0) return null
	return (await new Response(proc.stdout).text()).trim() || null
}

async function hasBiomeConfig(): Promise<boolean> {
	const root = await getGitRoot()
	if (!root) return false
	return existsSync(`${root}/biome.json`) || existsSync(`${root}/biome.jsonc`)
}

async function main() {
	if (!(await hasBiomeConfig())) process.exit(0)

	const input = await Bun.stdin.text()
	let hookInput: HookInput
	try {
		hookInput = JSON.parse(input)
	} catch {
		process.exit(0)
	}

	const filePaths = extractFilePaths(hookInput).filter((f) =>
		SUPPORTED_EXTENSIONS.some((ext) => f.endsWith(ext)),
	)

	if (filePaths.length === 0) process.exit(0)

	const diagnostics: Array<{
		file: string
		line: number
		code: string
		message: string
	}> = []

	for (const filePath of filePaths) {
		// Fix what can be fixed
		const fixProc = Bun.spawn(
			[
				'bunx',
				'@biomejs/biome',
				'check',
				'--write',
				'--no-errors-on-unmatched',
				filePath,
			],
			{ stdout: 'pipe', stderr: 'pipe' },
		)
		await fixProc.exited

		// Check for remaining issues
		const checkProc = Bun.spawn(
			[
				'bunx',
				'@biomejs/biome',
				'check',
				'--reporter=json',
				'--no-errors-on-unmatched',
				'--colors=off',
				filePath,
			],
			{
				stdout: 'pipe',
				stderr: 'pipe',
				env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
			},
		)

		const exitCode = await checkProc.exited
		if (exitCode === 0) continue

		const stdout = await new Response(checkProc.stdout).text()
		if (!stdout.trim()) continue

		try {
			const report = JSON.parse(stdout)
			if (report.diagnostics) {
				for (const d of report.diagnostics) {
					if (d.severity === 'error') {
						diagnostics.push({
							file: d.location?.path?.file || filePath,
							line: d.location?.span?.start?.line || 0,
							code: d.category || 'unknown',
							message: d.description || d.message,
						})
					}
				}
			}
		} catch {
			// Parse failed, skip
		}
	}

	if (diagnostics.length > 0) {
		console.error(
			JSON.stringify({
				tool: 'biome',
				status: 'error',
				files_processed: filePaths.length,
				diagnostics,
				hint: 'MUST use biome_lintFix MCP tool to fix these errors',
			}),
		)
		process.exit(2)
	}

	process.exit(0)
}

main()
