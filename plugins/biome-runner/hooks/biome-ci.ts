#!/usr/bin/env bun

/**
 * Stop hook: Run biome ci on all changed files at session end.
 *
 * Self-contained — uses only Bun built-in APIs.
 * Exit 0 = clean, Exit 2 = errors found (blocking).
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

async function getChangedFiles(extensions: string[]): Promise<string[]> {
	const commands = [
		['git', 'diff', '--cached', '--name-only'],
		['git', 'diff', '--name-only'],
		['git', 'ls-files', '--others', '--exclude-standard'],
	]

	const files = new Set<string>()
	const results = await Promise.all(
		commands.map(async (cmd) => {
			const proc = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
			await proc.exited
			return (await new Response(proc.stdout).text()).trim()
		}),
	)

	for (const result of results) {
		for (const file of result.split('\n')) {
			if (file && extensions.some((ext) => file.endsWith(ext))) {
				files.add(file)
			}
		}
	}

	return Array.from(files)
}

async function main() {
	if (!(await hasBiomeConfig())) process.exit(0)

	const changedFiles = await getChangedFiles(SUPPORTED_EXTENSIONS)
	if (changedFiles.length === 0) process.exit(0)

	// Run biome ci on all changed files at once
	const proc = Bun.spawn(
		[
			'bunx',
			'@biomejs/biome',
			'ci',
			'--reporter=json',
			'--no-errors-on-unmatched',
			'--colors=off',
			...changedFiles,
		],
		{
			stdout: 'pipe',
			stderr: 'pipe',
			env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
		},
	)

	const exitCode = await proc.exited
	if (exitCode === 0) process.exit(0)

	const stdout = await new Response(proc.stdout).text()
	if (!stdout.trim()) process.exit(0)

	const diagnostics: Array<{
		file: string
		line: number
		code: string
		message: string
	}> = []

	try {
		const report = JSON.parse(stdout)
		if (report.diagnostics) {
			for (const d of report.diagnostics) {
				if (d.severity === 'error' || d.severity === 'warning') {
					diagnostics.push({
						file: d.location?.path?.file || 'unknown',
						line: d.location?.span?.start?.line || 0,
						code: d.category || 'unknown',
						message: d.description || d.message,
					})
				}
			}
		}
	} catch {
		// Parse failed
	}

	if (diagnostics.length > 0) {
		console.error(
			JSON.stringify({
				tool: 'biome-ci',
				status: 'error',
				filesChecked: changedFiles.length,
				diagnostics,
			}),
		)
		process.exit(2)
	}

	process.exit(0)
}

main()
