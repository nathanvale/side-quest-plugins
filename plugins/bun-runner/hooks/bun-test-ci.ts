#!/usr/bin/env bun

/**
 * Stop hook: Run tests for all changed test files at session end.
 *
 * Self-contained — uses only Bun built-in APIs.
 * Always exits 0 (informational, non-blocking).
 */

const TEST_EXTENSIONS = ['.test.ts', '.test.tsx']

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
	const testFiles = await getChangedFiles(TEST_EXTENSIONS)
	if (testFiles.length === 0) process.exit(0)

	const failures: Array<{ file: string; summary: string }> = []

	for (const testFile of testFiles) {
		const proc = Bun.spawn(['bun', 'test', testFile], {
			stdout: 'pipe',
			stderr: 'pipe',
		})
		const exitCode = await proc.exited
		if (exitCode !== 0) {
			const stdout = await new Response(proc.stdout).text()
			const stderr = await new Response(proc.stderr).text()
			const output = `${stdout}${stderr}`.trim()
			const failLines = output
				.split('\n')
				.filter(
					(l) => l.includes('✗') || l.includes('error') || l.includes('FAIL'),
				)
			failures.push({
				file: testFile,
				summary: failLines.slice(0, 5).join('\n'),
			})
		}
	}

	if (failures.length > 0) {
		console.error(
			JSON.stringify({
				tool: 'bun-test-ci',
				status: 'fail',
				totalFiles: testFiles.length,
				failedFiles: failures.length,
				failures,
			}),
		)
	}

	process.exit(0)
}

main()
