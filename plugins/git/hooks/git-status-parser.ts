/**
 * Shared git status parser for porcelain output.
 *
 * Used by both git-context-loader (SessionStart) and auto-commit-on-stop (Stop)
 * to avoid duplicating porcelain parsing logic.
 */

export interface FileStatusCounts {
	staged: number
	modified: number
	untracked: number
}

/**
 * Parse `git status --porcelain [-b]` output into file status counts
 * and an optional branch name (present only when `-b` flag was used).
 */
export function parsePorcelainStatus(output: string): {
	branch: string | null
	counts: FileStatusCounts
} {
	const lines = output.split('\n')
	const branchLine = lines.find((line) => line.startsWith('##'))
	let branch: string | null = null
	if (branchLine) {
		const parsed = branchLine.slice(3).split('...')[0]
		if (parsed) {
			branch = parsed.trim()
		}
	}

	let staged = 0
	let modified = 0
	let untracked = 0

	for (const line of lines) {
		if (!line.trim() || line.startsWith('##')) {
			continue
		}

		const code = line.slice(0, 2)
		if (code.startsWith('?') || code === '??') {
			untracked++
			continue
		}

		if (code[0] !== ' ' && code[0] !== '?') {
			staged++
		}
		if (code[1] !== ' ' && code[1] !== '?') {
			modified++
		}
	}

	return { branch, counts: { staged, modified, untracked } }
}
