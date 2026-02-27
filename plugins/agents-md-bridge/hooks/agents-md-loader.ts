#!/usr/bin/env bun

/**
 * AGENTS.md Loader Hook
 *
 * SessionStart hook that auto-discovers AGENTS.md files in the project
 * hierarchy and injects their content into Claude Code session context.
 * Bridges the gap for the emerging AGENTS.md convention (GitHub issue #6235)
 * that Claude Code does not natively support.
 *
 * Output: Plain stdout text (avoids plugin hooks.json bug #16538 where
 * hookSpecificOutput.additionalContext is silently discarded).
 */

import { join, relative } from 'node:path'

// Safety: kill the process if it hangs
const selfDestruct = setTimeout(() => process.exit(0), 4500)

type SessionSource = 'startup' | 'resume' | 'compact' | 'clear'

interface SessionStartHookInput {
	session_id: string
	hook_event_name: string
	cwd: string
	source: SessionSource
}

/** Directories to skip during file discovery */
const EXCLUDED_DIRS = new Set([
	'node_modules',
	'.git',
	'dist',
	'build',
	'.next',
	'vendor',
])

/** Safety caps to prevent context window blowout */
const MAX_FILES = 10
const MAX_TOTAL_SIZE = 50 * 1024 // 50KB
const MAX_FILE_SIZE = 10 * 1024 // 10KB per file
const MAX_DEPTH = 5

interface DiscoveredFile {
	path: string
	relativePath: string
	depth: number
}

/**
 * Recursively discovers AGENTS.md files in the project directory.
 * Respects depth limits and excluded directories.
 */
async function discoverAgentsMd(
	cwd: string,
	dir: string,
	depth: number,
	results: DiscoveredFile[],
): Promise<void> {
	if (depth > MAX_DEPTH || results.length >= MAX_FILES) return

	try {
		const entries = await Array.fromAsync(
			new Bun.Glob('*').scan({ cwd: dir, onlyFiles: false, dot: false }),
		)

		for (const entry of entries) {
			if (results.length >= MAX_FILES) break

			const fullPath = join(dir, entry)

			if (entry === 'AGENTS.md') {
				results.push({
					path: fullPath,
					relativePath: relative(cwd, fullPath),
					depth,
				})
				continue
			}

			if (EXCLUDED_DIRS.has(entry)) continue

			// Check if it's a directory before recursing
			try {
				const stat = await Bun.spawn(['test', '-d', fullPath], {
					stdout: 'ignore',
					stderr: 'ignore',
				}).exited
				if (stat === 0) {
					await discoverAgentsMd(cwd, fullPath, depth + 1, results)
				}
			} catch {
				// skip inaccessible entries
			}
		}
	} catch {
		// skip inaccessible directories
	}
}

/**
 * Reads and formats discovered AGENTS.md files into context output.
 * Sorts by depth (root first) and enforces size limits.
 */
async function formatOutput(files: DiscoveredFile[]): Promise<string | null> {
	if (files.length === 0) return null

	// Sort by depth (root-level first), then by path for determinism
	files.sort(
		(a, b) => a.depth - b.depth || a.relativePath.localeCompare(b.relativePath),
	)

	const sections: string[] = []
	let totalSize = 0

	for (const file of files) {
		if (totalSize >= MAX_TOTAL_SIZE) break

		try {
			const bunFile = Bun.file(file.path)
			const size = bunFile.size

			if (size === 0) continue

			let content = await bunFile.text()

			// Truncate individual files at 10KB
			if (content.length > MAX_FILE_SIZE) {
				content = `${content.slice(0, MAX_FILE_SIZE)}\n\n[truncated -- file exceeds 10KB limit]`
			}

			// Check total size budget
			if (totalSize + content.length > MAX_TOTAL_SIZE) {
				const remaining = MAX_TOTAL_SIZE - totalSize
				content = `${content.slice(0, remaining)}\n\n[truncated -- total AGENTS.md content exceeds 50KB limit]`
			}

			const displayPath = file.relativePath.startsWith('.')
				? file.relativePath
				: `./${file.relativePath}`

			sections.push(`### ${displayPath}\n\n${content}`)
			totalSize += content.length
		} catch {
			// skip unreadable files
		}
	}

	if (sections.length === 0) return null

	return `## AGENTS.md Context (auto-injected)\n\n${sections.join('\n\n---\n\n')}`
}

if (import.meta.main) {
	try {
		let input: SessionStartHookInput
		try {
			input = (await Bun.stdin.json()) as SessionStartHookInput
		} catch {
			clearTimeout(selfDestruct)
			process.exit(0)
		}

		const relevantSources: SessionSource[] = [
			'startup',
			'resume',
			'compact',
			'clear',
		]
		if (!relevantSources.includes(input.source as SessionSource)) {
			clearTimeout(selfDestruct)
			process.exit(0)
		}

		const files: DiscoveredFile[] = []
		await discoverAgentsMd(input.cwd, input.cwd, 0, files)

		const output = await formatOutput(files)
		if (output) {
			console.log(output)
		}
	} catch {
		// never crash the hook
	}

	clearTimeout(selfDestruct)
	process.exit(0)
}
