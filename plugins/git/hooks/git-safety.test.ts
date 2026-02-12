import { describe, expect, test } from 'bun:test'
import { checkCommand } from './git-safety.ts'

describe('git-safety worktree patterns', () => {
	describe('git worktree remove --force', () => {
		test.each([
			['git worktree remove foo --force'],
			['git worktree remove foo -f'],
			['git -C /repo worktree remove foo --force'],
			['git -C /repo worktree remove foo -f'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('Force-removing a worktree')
		})

		test.each([
			['git worktree remove foo'],
			['git worktree list'],
			['echo "git worktree remove foo --force"'],
			['echo git worktree remove foo --force'],
		])('allows: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(false)
		})
	})

	describe('rm -rf .worktrees/', () => {
		test.each([
			['rm -rf /path/.worktrees/'],
			['rm -rf .worktrees'],
			['rm -fr .worktrees/feat-branch'],
			['rm -r -f .worktrees'],
			['rm -f -r .worktrees/'],
			['rm -rf -- .worktrees'],
			['rm -r -f -- .worktrees/foo'],
		])('blocks: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(true)
			expect(result.reason).toContain('Deleting .worktrees/ directly bypasses')
		})

		test.each([
			['rm -rf /tmp/test.worktrees-backup'],
			['rm -r .worktrees'],
			['rm .worktrees'],
			['echo rm -rf .worktrees'],
			['echo "rm -rf .worktrees"'],
		])('allows: %s', (command) => {
			const result = checkCommand(command)
			expect(result.blocked).toBe(false)
		})
	})
})
