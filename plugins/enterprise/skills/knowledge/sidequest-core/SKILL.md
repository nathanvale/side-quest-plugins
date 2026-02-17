---
name: sidequest-core
description: >
  Knowledge skill for SideQuest core utilities. Injected into Builder and
  Validator agents during engage to provide context about available utilities,
  patterns, and anti-patterns. Not user-invocable.
user-invocable: false
---

# Knowledge: SideQuest Core Utilities

This knowledge skill provides context about the `@side-quest/core` package and shared utilities. Injected into Builder (Scotty) and Validator (McCoy) agents during engage.

## Core Package Structure

```
core/
  src/
    spawn/          -- Process spawning and collection
    validation/     -- Input validation helpers
    test-utils/     -- Test utilities and helpers
    types/          -- Shared type definitions
    index.ts        -- Public API barrel export
```

## Key Utilities

### Spawn (`core/spawn`)

**`spawnAndCollect(command, args, options)`** -- Spawn a process and collect stdout/stderr.
- Returns `{ stdout, stderr, exitCode }`
- Handles timeout, signal forwarding, and cleanup
- Use this instead of raw `Bun.spawn` or `child_process`

**`spawnStreaming(command, args, options)`** -- Spawn with real-time output streaming.
- Returns an async iterator of output lines
- Use for long-running processes where you need incremental output

### Validation (`core/validation`)

**`validatePath(path)`** -- Validate and normalize a file path.
- Returns normalized absolute path or throws
- Handles relative paths, `~`, and symlinks

**`validateJson(input, schema)`** -- Validate JSON against a schema.
- Returns parsed object or throws with descriptive error
- Use for CLI argument parsing and config validation

**`validateRequired(value, name)`** -- Assert a value is defined.
- Throws with `"{name} is required"` if undefined/null

### Test Utilities (`core/test-utils`)

**`createTempDir()`** -- Create an isolated temporary directory.
- Returns `{ path, cleanup }` -- ALWAYS call cleanup in afterEach
- Isolated per test -- no cross-test pollution

**`mockStdio()`** -- Mock stdin/stdout/stderr for testing CLI tools.
- Returns `{ stdin, stdout, stderr, restore }` -- ALWAYS call restore

**`withTimeout(fn, ms)`** -- Wrap a test function with a timeout.
- Prevents hanging tests from blocking the suite

## What Builders Need

- **Use existing utilities** -- do not roll your own spawn, validation, or temp dir helpers
- **Import from barrel** -- `import { spawnAndCollect, validatePath } from '@side-quest/core'`
- **Follow existing patterns** -- look at how other plugins use these utilities before implementing
- **Error handling** -- core utilities throw descriptive errors; catch and wrap, do not swallow

## What Validators Should Flag

- Rolling custom spawn logic instead of using `spawnAndCollect`
- Rolling custom validation instead of using `validatePath`/`validateRequired`
- Not using `createTempDir` for test isolation
- Not calling cleanup/restore in afterEach
- Importing internal paths instead of the barrel export
- Swallowing errors from core utilities without re-throwing
