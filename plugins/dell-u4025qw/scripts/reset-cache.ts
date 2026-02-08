#!/usr/bin/env bun

/**
 * Developer utility: reset the Dell U4025QW community intel cache.
 *
 * Deletes community-intel.md and last-updated.json from the cache directory,
 * preserving .gitkeep and the directory itself.
 *
 * Usage: bun run plugins/dell-u4025qw/scripts/reset-cache.ts
 */

import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const cacheDir = join(
	import.meta.dirname,
	'..',
	'skills',
	'dell-u4025qw',
	'cache',
)

const files = ['community-intel.md', 'last-updated.json']

for (const file of files) {
	const path = join(cacheDir, file)
	if (existsSync(path)) {
		unlinkSync(path)
		console.log(`removed: ${file}`)
	} else {
		console.log(`skipped: ${file} (not found)`)
	}
}

console.log('cache reset complete')
