#!/usr/bin/env bun

/**
 * PostToolUse hook: Run tests for edited test files.
 *
 * Self-contained — uses only Bun built-in APIs.
 * Fires after Write/Edit on .test.ts/.test.tsx files.
 * Always exits 0 (informational, non-blocking).
 */

const TEST_EXTENSIONS = ['.test.ts', '.test.tsx']

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

async function isInGitRepo(filePath: string): Promise<boolean> {
	const proc = Bun.spawn(['git', 'rev-parse', '--show-toplevel'], {
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const exitCode = await proc.exited
	if (exitCode !== 0) return false
	const root = (await new Response(proc.stdout).text()).trim()
	return filePath.startsWith(root)
}

async function main() {
	const input = await Bun.stdin.text()
	let hookInput: HookInput
	try {
		hookInput = JSON.parse(input)
	} catch {
		process.exit(0)
	}

	const filePaths = extractFilePaths(hookInput)
	const testFiles = filePaths.filter((f) =>
		TEST_EXTENSIONS.some((ext) => f.endsWith(ext)),
	)

	if (testFiles.length === 0) process.exit(0)

	for (const testFile of testFiles) {
		if (!(await isInGitRepo(testFile))) continue

		const proc = Bun.spawn(['bun', 'test', testFile], {
			stdout: 'pipe',
			stderr: 'pipe',
		})
		const exitCode = await proc.exited
		const stdout = await new Response(proc.stdout).text()
		const stderr = await new Response(proc.stderr).text()
		const output = `${stdout}${stderr}`.trim()

		if (exitCode !== 0 && output) {
			// Extract just the failure lines for token efficiency
			const lines = output.split('\n')
			const failures = lines.filter(
				(l) => l.includes('✗') || l.includes('error') || l.includes('FAIL'),
			)
			if (failures.length > 0) {
				console.error(
					JSON.stringify({
						tool: 'bun-test',
						status: 'fail',
						file: testFile,
						failures: failures.slice(0, 10),
					}),
				)
			}
		}
	}

	process.exit(0)
}

main()
