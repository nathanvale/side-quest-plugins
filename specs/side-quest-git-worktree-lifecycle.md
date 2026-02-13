# Plan: @side-quest/git Worktree Lifecycle & Observability

## Task Description

Implement the full P0 (Foundation) and P1 (Observability) feature set for `@side-quest/git`, the TypeScript CLI that powers git worktree lifecycle management. This package is Layer 1 of a three-layer architecture where bash scripts (Layer 3) call this CLI for all git operations, and a plugin event bus (Layer 2) integrates with Claude Code hooks.

The work spans two repositories:
- **@side-quest/core** (`/Users/nathanvale/code/side-quest-core`) -- upstream prerequisite utility
- **@side-quest/git** (`/Users/nathanvale/code/side-quest-git`) -- main implementation target

## Objective

When this plan is complete:
1. `getMainWorktreeRoot()` exists in @side-quest/core and is published
2. @side-quest/git has 6 new CLI subcommands: `install`, `sync`, `orphans`, `clean`, `status`, `events`
3. Existing `create` command supports attach-to-existing flow
4. Event bus server runs locally with HTTP POST + WebSocket broadcast
5. All CLI commands emit events to the bus (fire-and-forget)
6. `status --watch` provides a live terminal dashboard
7. All features have comprehensive test coverage
8. All features use @side-quest/core utilities (no ad-hoc reimplementations)

## Problem Statement

The current `@side-quest/git` CLI has only basic worktree commands (create, list, delete, check, init). Bash scripts in dotfiles contain ~770 lines of raw git commands for install detection, file syncing, orphan cleanup, and batch operations. These need to be extracted into the typed, tested CLI layer so bash becomes a thin fzf/tmux wrapper. Additionally, there's no observability -- no way to see what happened across worktrees without manual git commands.

## Solution Approach

Implement in strict dependency order across 8 phases, each producing a shippable increment:

1. **P0.0**: Ship `getMainWorktreeRoot()` to @side-quest/core (unblocks everything)
2. **P0.1**: Smart install detection + `worktree install` subcommand
3. **P0.2**: Worktree sync command (re-copy config files)
4. **P0.3**: Attach-to-existing flow in `create` command
5. **P0.4**: Orphan branch discovery
6. **P0.5**: Batch clean command
7. **P1.1-P1.3**: Event schema, server, and CLI emission
8. **P1.4-P1.5**: Enhanced status + watch TUI

## Relevant Files

### @side-quest/core (prerequisite -- P0.0 only)

- `src/git/index.ts` -- Add `getMainWorktreeRoot()` and `isInsideWorktree()`. Currently has `getGitRoot()` which uses `--show-toplevel` (wrong for linked worktrees).
- `src/git/index.test.ts` -- Add tests for new functions.

### @side-quest/git (main target)

**Existing files to modify:**
- `src/worktree/cli.ts` -- CLI entrypoint. Currently handles 5 subcommands (create, list, delete, check, init). Needs 4 new subcommands (install, sync, orphans, clean, status) plus events namespace.
- `src/worktree/create.ts` -- Currently throws on existing worktree. Needs attach-to-existing flow.
- `src/worktree/create.test.ts` -- Add attach-to-existing tests.
- `src/worktree/detect-pm.ts` -- Currently only has `detectInstallCommand()`. Needs `detectPackageManager()` (returns name) and `detectLockfile()` (returns path).
- `src/worktree/detect-pm.test.ts` -- Add tests for new functions.
- `src/worktree/types.ts` -- Add `SyncResult`, `SyncedFile`, `InstallResult`, `OrphanBranch`, `OrphanStatus`, `CleanResult`, `CleanedWorktree`, `SkippedWorktree`, `SkipReason`, `WorktreeStatus`.
- `src/worktree/index.ts` -- Export barrel. Add all new functions and types.
- `src/worktree/list.ts` -- Add `--include-orphans` support.
- `src/worktree/list.test.ts` -- Add orphan inclusion tests.
- `src/git/git-root.ts` -- Replace `getGitRoot()` internals to use `getMainWorktreeRoot()` from core.
- `package.json` -- Bump `@side-quest/core` dependency. Add `./events` subpath export.

### New Files

**P0 Foundation:**
- `src/worktree/install.ts` -- `shouldRunInstall()`, `runInstall()`
- `src/worktree/install.test.ts`
- `src/worktree/sync.ts` -- `syncWorktree()`, `syncAllWorktrees()`
- `src/worktree/sync.test.ts`
- `src/worktree/orphans.ts` -- `listOrphanBranches()`
- `src/worktree/orphans.test.ts`
- `src/worktree/clean.ts` -- `cleanWorktrees()`
- `src/worktree/clean.test.ts`

**P1 Observability:**
- `src/events/types.ts` -- `EventEnvelope`, `EventType`, `EventDataMap`
- `src/events/schema.ts` -- `createEvent()` factory
- `src/events/schema.test.ts`
- `src/events/index.ts` -- Events barrel
- `src/events/server.ts` -- `Bun.serve()` HTTP + WebSocket event bus
- `src/events/server.test.ts`
- `src/events/client.ts` -- WebSocket client for consumers
- `src/events/store.ts` -- In-memory ring buffer + JSONL persistence
- `src/events/emit.ts` -- Fire-and-forget HTTP POST emitter
- `src/events/emit.test.ts`
- `src/worktree/status.ts` -- `getWorktreeStatus()`
- `src/worktree/status.test.ts`
- `src/worktree/watch.ts` -- `--watch` TUI mode

## Implementation Phases

### Phase 1: Foundation (P0.0-P0.2)

**P0.0: getMainWorktreeRoot** (upstream to @side-quest/core)
- Add `getMainWorktreeRoot(cwd)` using `git rev-parse --git-common-dir`
- Add `isInsideWorktree(cwd)` derived helper
- Test in main worktree, linked worktree, non-git, bare repo
- Publish new @side-quest/core version, bump dep in @side-quest/git

**P0.1: Smart Install Detection**
- Create `install.ts` with `shouldRunInstall()` (mtime comparison) and `runInstall()` (never throws)
- Split `detect-pm.ts`: add `detectPackageManager()` (returns name), `detectLockfile()` (returns path)
- Add `worktree install <path>` CLI subcommand
- `InstallResult` uses single `status` discriminant: `'installed' | 'up-to-date' | 'no-package-json' | 'failed'`

**P0.2: Worktree Sync**
- Create `sync.ts` with content-hash comparison (fastHash) to skip identical files
- `SyncedFile` provides per-file action/reason detail
- CLI: `worktree sync <branch>`, `worktree sync --all`, `--dry-run`

### Phase 2: Core Implementation (P0.3-P0.5)

**P0.3: Attach-to-Existing**
- Modify `create.ts` to sync files instead of throwing when worktree exists
- `CreateResult` gains `attached: boolean` and `syncResult?: SyncResult`
- Breaking change mitigated with `--no-attach` flag and `{ attach: false }` API option

**P0.4: Orphan Branch Discovery**
- Create `orphans.ts` with type-safe `OrphanStatus` union
- CLI: `worktree orphans`, `worktree list --include-orphans`
- `commitsAhead` is always a number (-1 for unknown)

**P0.5: Batch Clean**
- Create `clean.ts` with `SkipReason` typed union (5 values)
- `--force` deletes dirty/unmerged but NEVER main worktree
- `--include-orphans` leverages P0.4
- Partial failure model: one delete fails, others continue

### Phase 3: Observability & Polish (P1.1-P1.5)

**P1.1: Event Schema**
- Define `EventEnvelope` with `schemaVersion`, `correlationId`, `source`, `repo`, `gitRoot`
- CLI domain (`worktree.*`) vs hook domain (`session.*`, `safety.*`, `command.*`)
- Hook data is `Record<string, unknown>` -- plugin owns the shape

**P1.2: Event Bus Server**
- `Bun.serve()` with POST /events, GET /events, GET /health, WS /ws
- Ring buffer (1000 events) + JSONL persistence
- Port/PID files at `~/.cache/side-quest-git/<repo-name>/events.{port,pid}`

**P1.3: CLI Event Emission**
- Fire-and-forget HTTP POST from each CLI command
- 500ms timeout via AbortController, silent fail
- <5ms latency budget when server is absent

**P1.4: Enhanced Status**
- `getWorktreeStatus()` with commits ahead/behind, PR info via `gh`
- Graceful degradation when `gh` is missing or rate-limited
- Bounded concurrency via `processInParallelChunks` (default 4)

**P1.5: Watch TUI**
- `status --watch` with ANSI table output
- WebSocket subscription when event server running, polling fallback
- Requires `isTTY` check, refuses on non-terminal

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. Use Task and Task* tools only.
- Take note of the session id (agentId) of each team member for resume operations.

### Team Members

- Builder
  - Name: builder-core-git
  - Role: Implement getMainWorktreeRoot in @side-quest/core
  - Agent Type: general-purpose
  - Resume: true

- Validator
  - Name: validator-core-git
  - Role: Validate P0.0 types, tests, and exports
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-install
  - Role: Implement install detection and CLI subcommand (P0.1)
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-sync
  - Role: Implement sync command (P0.2)
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-attach
  - Role: Implement attach-to-existing flow in create (P0.3)
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-orphans
  - Role: Implement orphan branch discovery (P0.4)
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-clean
  - Role: Implement batch clean command (P0.5)
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-events-schema
  - Role: Implement event schema and envelope factory (P1.1)
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-events-server
  - Role: Implement event bus server (P1.2)
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-events-emit
  - Role: Add event emission to all CLI commands (P1.3)
  - Agent Type: general-purpose
  - Resume: true

- Builder
  - Name: builder-status
  - Role: Implement enhanced status and watch TUI (P1.4 + P1.5)
  - Agent Type: general-purpose
  - Resume: true

- Validator
  - Name: validator-p0
  - Role: Validate all P0 features (types, tests, exports, CLI integration)
  - Agent Type: general-purpose
  - Resume: true

- Validator
  - Name: validator-p1
  - Role: Validate all P1 features (events, server, emission, status, watch)
  - Agent Type: general-purpose
  - Resume: true

- Validator
  - Name: validator-final
  - Role: Run full validation suite (bun test, tsc, biome) and verify all acceptance criteria
  - Agent Type: general-purpose
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. Implement getMainWorktreeRoot in @side-quest/core (P0.0)
- **Task ID**: p0-0-main-worktree-root
- **Depends On**: none
- **Assigned To**: builder-core-git
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repo**: `/Users/nathanvale/code/side-quest-core`
- Add `getMainWorktreeRoot(cwd: string): Promise<string | null>` to `src/git/index.ts`
  - Use `git rev-parse --git-common-dir` which returns `.git` (relative) from main worktree and absolute path from linked worktree
  - Resolve via `resolve(cwd, result, '..')` for both cases
  - Return `null` if not in a git repo
- Add `isInsideWorktree(cwd: string): Promise<boolean>` as inline derivation:
  - `getMainWorktreeRoot(cwd) !== getGitRoot(cwd)` (where results are non-null)
  - Note: this is a convenience function, NOT an export to core. Implement inline in @side-quest/git where needed.
- Actually, per the plan, `isInsideWorktree` was removed from upstream candidates. Only add `getMainWorktreeRoot` to core.
- Add tests in `src/git/index.test.ts`:
  - Main worktree: returns same as `getGitRoot()`
  - Linked worktree: returns main repo root (not worktree path)
  - Non-git directory: returns `null`
  - Bare repo: returns `null` (or the bare repo path -- test actual behavior)
- Export from `src/git/index.ts` barrel
- Run `bun test src/git/index.test.ts` to verify
- Run `bun run validate` to ensure no regressions

### 2. Validate P0.0 implementation
- **Task ID**: validate-p0-0
- **Depends On**: p0-0-main-worktree-root
- **Assigned To**: validator-core-git
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repo**: `/Users/nathanvale/code/side-quest-core`
- Read the implementation and verify:
  - `getMainWorktreeRoot` uses `--git-common-dir` (not `--show-toplevel`)
  - Return type is `Promise<string | null>`
  - Function has JSDoc explaining the `--git-common-dir` behavior
  - Tests cover all 4 cases (main, linked, non-git, bare)
  - Function is exported from `src/git/index.ts`
- Run `bun test` (all tests, not just git)
- Run `bunx tsc --noEmit`
- Run `bunx biome ci .`
- If any issues found, report them for builder-core-git to fix

### 3. Bump @side-quest/core dep in @side-quest/git
- **Task ID**: bump-core-dep
- **Depends On**: validate-p0-0
- **Assigned To**: builder-install
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Update `package.json` to point `@side-quest/core` to the local build or bumped version
- Update `src/git/git-root.ts` to import and use `getMainWorktreeRoot` from `@side-quest/core/git`
- Keep `getGitRoot()` as a wrapper for backward compat but add deprecation JSDoc
- Run `bun install` to verify resolution
- Run `bun test` to verify existing tests still pass

### 4. Implement install detection and CLI subcommand (P0.1)
- **Task ID**: p0-1-install-detection
- **Depends On**: bump-core-dep
- **Assigned To**: builder-install
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Split `src/worktree/detect-pm.ts`:
  - Add `detectPackageManager(dir): string | null` -- returns PM name ('bun', 'yarn', 'pnpm', 'npm')
  - Add `detectLockfile(dir): string | null` -- returns lockfile path
  - Keep existing `detectInstallCommand(dir)` unchanged
  - Also check `packageManager` field in `package.json` as fallback
- Create `src/worktree/install.ts`:
  - `shouldRunInstall(dir: string): boolean` -- checks node_modules existence and lockfile mtime
  - `runInstall(dir, options?): Promise<InstallResult>` -- never throws
  - Use `pathExistsSync`, `statSync` from `@side-quest/core/fs`
  - Use `spawnWithTimeout` from `@side-quest/core/spawn` with configurable timeout (default 120s)
  - Use `commandExists` to verify PM is on PATH before running
- Add `InstallResult` type to `src/worktree/types.ts`:
  ```typescript
  export interface InstallResult {
    readonly status: 'installed' | 'up-to-date' | 'no-package-json' | 'failed'
    readonly packageManager: string | null
    readonly durationMs: number | null
    readonly error: string | null
  }
  ```
- Add `worktree install <path>` to `cli.ts`:
  - `--force` flag to skip mtime check
  - Output `InstallResult` as JSON
- Create `src/worktree/install.test.ts` with tests:
  - Mtime combos: lockfile newer, node_modules newer, both missing, lockfile missing
  - Timeout: mock slow install
  - PM not found: mock missing `bun` command
  - Install failure: mock non-zero exit
  - No lockfile: verify `status: 'no-package-json'`
  - Force flag: install runs even when up-to-date
  - CLI JSON output matches InstallResult contract
- Update `src/worktree/index.ts` exports
- Run `bun test --recursive`

### 5. Implement sync command (P0.2)
- **Task ID**: p0-2-sync
- **Depends On**: bump-core-dep
- **Assigned To**: builder-sync
- **Agent Type**: general-purpose
- **Parallel**: true (can run in parallel with P0.1)
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Add types to `src/worktree/types.ts`:
  ```typescript
  export interface SyncedFile {
    readonly relativePath: string
    readonly action: 'copied' | 'skipped' | 'error'
    readonly reason?: string
  }
  export interface SyncResult {
    readonly branch: string
    readonly path: string
    readonly filesCopied: number
    readonly filesSkipped: number
    readonly files: readonly SyncedFile[]
    readonly dryRun: boolean
  }
  ```
- Create `src/worktree/sync.ts`:
  - `syncWorktree(gitRoot, branchName, options?)` -- sync one worktree
  - `syncAllWorktrees(gitRoot, options?)` -- sync all non-main worktrees
  - Wraps existing `copyWorktreeFiles` with content-hash comparison
  - Use `fastHash` from `@side-quest/core/hash` for content comparison (non-crypto, fast)
  - Use `copyFileSync`, `ensureParentDirSync` from `@side-quest/core/fs`
  - Use `matchGlob`, `globFilesSync` from `@side-quest/core/glob`
  - For each file: hash source and dest, skip if identical, copy if different
- Add to `cli.ts`: `worktree sync <branch>`, `worktree sync --all`, `--dry-run`
- Create `src/worktree/sync.test.ts`:
  - Sync copies changed files
  - Sync skips identical files (verified via fastHash)
  - Sync reports per-file detail in `files` array
  - Dry-run returns correct counts without copying
  - Sync all worktrees
  - Error handling for missing worktree
- Update `src/worktree/index.ts` exports
- Run `bun test --recursive`

### 6. Implement orphan branch discovery (P0.4)
- **Task ID**: p0-4-orphans
- **Depends On**: bump-core-dep
- **Assigned To**: builder-orphans
- **Agent Type**: general-purpose
- **Parallel**: true (can run in parallel with P0.1 and P0.2)
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Add types to `src/worktree/types.ts`:
  ```typescript
  export type OrphanStatus = 'pristine' | 'merged' | 'ahead' | 'unknown'
  export interface OrphanBranch {
    readonly branch: string
    readonly status: OrphanStatus
    readonly commitsAhead: number
    readonly merged: boolean
  }
  ```
- Create `src/worktree/orphans.ts`:
  - `listOrphanBranches(gitRoot, options?)` -- list branches without worktrees
  - Use `getMainWorktreeRoot` from `@side-quest/core/git` (NOT getGitRoot)
  - Use `spawnAndCollect` for git commands
  - Default protected branches: main, master, develop
  - Options: `{ protectedBranches?: readonly string[] }`
  - Determine status via `git merge-base --is-ancestor` and `git rev-list --count`
- Add to `cli.ts`: `worktree orphans`
- Modify `list.ts`: add `--include-orphans` flag support
- Create `src/worktree/orphans.test.ts`:
  - Lists branches without worktrees
  - Excludes protected branches
  - Correctly identifies merged vs ahead status
  - commitsAhead is accurate count
  - Empty result when all branches have worktrees
- Update `src/worktree/index.ts` exports
- Run `bun test --recursive`

### 7. Implement attach-to-existing flow (P0.3)
- **Task ID**: p0-3-attach
- **Depends On**: p0-2-sync
- **Assigned To**: builder-attach
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Modify `src/worktree/create.ts`:
  - When `pathExistsSync(worktreePath)` is true AND `options.attach !== false`:
    - Call `syncWorktree()` instead of throwing
    - Return `CreateResult` with `attached: true` and `syncResult`
  - When `options.attach === false`: throw as before (backward compat)
- Extend `CreateResult` in `types.ts`:
  ```typescript
  export interface CreateResult {
    readonly branch: string
    readonly path: string
    readonly filesCopied: number
    readonly postCreateOutput: string | null
    readonly configAutoDetected: boolean
    readonly attached: boolean
    readonly syncResult?: SyncResult
  }
  ```
- Add `--no-attach` flag to CLI create command
- Modify `src/worktree/create.test.ts`:
  - Attach: existing worktree syncs files, returns `attached: true`
  - Attach: `syncResult` contains per-file detail
  - No-attach: existing worktree throws (backward compat)
  - Partial failure: some files sync, some error
- Run `bun test --recursive`

### 8. Implement batch clean command (P0.5)
- **Task ID**: p0-5-clean
- **Depends On**: p0-4-orphans
- **Assigned To**: builder-clean
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Add types to `src/worktree/types.ts`:
  ```typescript
  export type SkipReason = 'dirty' | 'unmerged' | 'is-main' | 'checked-out-elsewhere' | 'delete-failed'
  export interface CleanedWorktree {
    readonly branch: string
    readonly path: string
    readonly branchDeleted: boolean
  }
  export interface SkippedWorktree {
    readonly branch: string
    readonly path: string
    readonly reason: SkipReason
    readonly error?: string
  }
  export interface CleanResult {
    readonly deleted: readonly CleanedWorktree[]
    readonly skipped: readonly SkippedWorktree[]
    readonly orphansDeleted: readonly OrphanBranch[]
    readonly dryRun: boolean
    readonly forced: boolean
  }
  ```
- Create `src/worktree/clean.ts`:
  - `cleanWorktrees(gitRoot, options?)` -- batch delete merged+clean worktrees
  - Use `processInParallelChunks` from `@side-quest/core/concurrency`
  - Use `spawnAndCollect` for git worktree remove and git branch -d/-D
  - Without `--force`: only merged AND clean worktrees
  - With `--force`: all non-main worktrees (warning to stderr)
  - `--force` NEVER deletes main worktree
  - `--delete-branches`: uses `-d` (or `-D` with force)
  - `--include-orphans`: also cleans merged orphan branches via P0.4
  - Partial failure: one delete fails, others continue
- Add to `cli.ts`: `worktree clean [--dry-run] [--force] [--delete-branches] [--include-orphans]`
- Create `src/worktree/clean.test.ts`:
  - Unit: merged+clean deleted, dirty skipped, unmerged skipped
  - Unit: `--force` deletes dirty and unmerged
  - Unit: `--force` still skips main worktree
  - Unit: `--dry-run` returns correct counts without deleting
  - Unit: `--delete-branches` calls git branch -d (or -D with force)
  - Integration: create repo with mix of states, run clean, verify filesystem
  - Integration: partial failure (one delete fails) -- others succeed
  - Integration: `--include-orphans` cleans merged orphan branches
- Update `src/worktree/index.ts` exports
- Run `bun test --recursive`

### 9. Validate all P0 features
- **Task ID**: validate-p0
- **Depends On**: p0-1-install-detection, p0-2-sync, p0-3-attach, p0-4-orphans, p0-5-clean
- **Assigned To**: validator-p0
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Verify all new types are in `types.ts` with `readonly` fields
- Verify all new functions are exported from `index.ts`
- Verify all new CLI subcommands are in `cli.ts` and output JSON
- Verify all new functions have JSDoc
- Verify all tests pass: `bun test --recursive`
- Verify type check: `bunx tsc --noEmit`
- Verify lint: `bunx biome ci .`
- Verify CLI help text includes new subcommands
- Check that @side-quest/core utilities are used (not ad-hoc):
  - `pathExistsSync` (not fs.existsSync)
  - `spawnAndCollect` (not child_process)
  - `fastHash` (not crypto)
  - `processInParallelChunks` (not raw Promise.all)
  - `getMainWorktreeRoot` (not getGitRoot for path-sensitive ops)
- Report any issues for builders to fix

### 10. Implement event schema and factory (P1.1)
- **Task ID**: p1-1-event-schema
- **Depends On**: validate-p0
- **Assigned To**: builder-events-schema
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Create `src/events/types.ts`:
  - `EventEnvelope<T>` with schemaVersion, id, timestamp, type, repo, gitRoot, source, correlationId, data
  - `CliEventType`: worktree.created, worktree.deleted, worktree.synced, worktree.cleaned, worktree.attached, worktree.installed
  - `HookEventType`: session.started, session.ended, session.compacted, safety.blocked, command.executed
  - `EventType = CliEventType | HookEventType`
  - `EventDataMap` mapping types to payloads (CLI events use result types, hook events use `Record<string, unknown>`)
- Create `src/events/schema.ts`:
  - `createEvent(type, data, context)` -- factory with auto-generated id, timestamp, correlationId
  - Use `nanoId` from `@side-quest/core/utils` for event IDs
  - Use `generateCorrelationId` from `@side-quest/core/instrumentation` for correlation IDs
  - Timestamps: `new Date().toISOString()` (always UTC)
- Create `src/events/schema.test.ts`:
  - Envelope has valid id (string), timestamp (ISO 8601), schemaVersion ('1.0.0')
  - Correlation ID auto-generated when not provided
  - Correlation ID passed through when provided
  - TypeScript enforces data shape matches type (compile-time -- verify with tsc)
- Create `src/events/index.ts` barrel
- Add `./events` subpath export to `package.json`
- Run `bun test --recursive`

### 11. Implement event bus server (P1.2)
- **Task ID**: p1-2-event-server
- **Depends On**: p1-1-event-schema
- **Assigned To**: builder-events-server
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Create `src/events/store.ts`:
  - Ring buffer class (default 1000 events, configurable)
  - `push(event)`, `query(filter)`, `since(timestamp)`, `last(n)`
  - JSONL persistence: `appendToFileSync` from `@side-quest/core/fs`
- Create `src/events/server.ts`:
  - `Bun.serve()` with routes:
    - `POST /events` -- accept single JSON or JSONL, push to ring buffer
    - `GET /events` -- query with `?type=`, `?since=`, `?limit=`
    - `GET /health` -- `{"status":"ok","uptime":N,"events":N}`
    - `WS /ws` -- real-time broadcast with optional `?type=` filter
  - Port/PID files at `~/.cache/side-quest-git/<repo-name>/events.{port,pid}`
  - Use `getMainWorktreeRoot` for repo name derivation
  - Use `ensureCacheDir` from `@side-quest/core/fs`
  - Use `writeTextFileAtomic` for port/PID files
  - Stale PID detection via `kill(pid, 0)` check
- Create `src/events/client.ts`:
  - WebSocket client for consumers
  - Auto-reconnect on disconnect
  - Optional type filter
- Add to `cli.ts`: `events start [--port 7483]`, `events tail [--type worktree.*]`
- Create `src/events/server.test.ts`:
  - POST event, verify stored in ring buffer
  - GET /events returns events in order
  - GET /events?type= filters correctly
  - GET /events?since= returns events after timestamp
  - GET /health returns uptime and event count
  - WebSocket receives broadcast on POST
  - Ring buffer evicts oldest when full
  - JSONL file is appended on each event
- Run `bun test --recursive`

### 12. Add event emission to CLI commands (P1.3)
- **Task ID**: p1-3-event-emission
- **Depends On**: p1-2-event-server
- **Assigned To**: builder-events-emit
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Create `src/events/emit.ts`:
  - `emitEvent(event: EventEnvelope): Promise<void>` -- fire-and-forget
  - 500ms timeout via `AbortController` (NOT `withTimeout` which is Promise.race)
  - Silent fail -- never throws, never hangs
  - `isEventServerRunning(repoName): boolean` -- check PID file existence
  - Fast path: if no PID file, return immediately (<5ms)
- Modify each CLI command to emit after success:
  - `create.ts` -- emit `worktree.created` (or `worktree.attached`)
  - `delete.ts` -- emit `worktree.deleted`
  - `sync.ts` -- emit `worktree.synced`
  - `clean.ts` -- emit `worktree.cleaned`
  - `install.ts` -- emit `worktree.installed`
- Create `src/events/emit.test.ts`:
  - Mock HTTP server, verify events arrive with correct envelope
  - Server down: emitEvent returns silently
  - Timeout: 500ms deadline actually aborts
  - Latency: emission adds <5ms when server absent
- Run `bun test --recursive`

### 13. Implement enhanced status command (P1.4)
- **Task ID**: p1-4-status
- **Depends On**: validate-p0
- **Assigned To**: builder-status
- **Agent Type**: general-purpose
- **Parallel**: true (can run in parallel with P1.1-P1.3)
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Add `WorktreeStatus` type to `types.ts`:
  ```typescript
  export interface WorktreeStatus {
    readonly branch: string
    readonly path: string
    readonly isMain: boolean
    readonly dirty: boolean
    readonly commitsAhead: number
    readonly commitsBehind: number
    readonly lastCommitAt: string | null
    readonly lastCommitMessage: string | null
    readonly pr: { readonly number: number; readonly status: 'open' | 'merged' | 'closed'; readonly url: string } | null
  }
  ```
- Create `src/worktree/status.ts`:
  - `getWorktreeStatus(gitRoot, options?)` -- rich status for all worktrees
  - Use `processInParallelChunks` with configurable concurrency (default 4)
  - Use `isToolAvailable` to check for `gh`
  - Use `safeJsonParse` for `gh` JSON output
  - Graceful degradation: `pr: null` when `gh` missing, auth failure, or rate limit
- Add to `cli.ts`: `worktree status [--pr]`
- Create `src/worktree/status.test.ts`:
  - Returns status for all worktrees
  - Includes commits ahead/behind
  - PR info populated when --pr flag used (mock gh)
  - Graceful degradation when gh not available
  - Respects concurrency limit
- Update `src/worktree/index.ts` exports
- Run `bun test --recursive`

### 14. Implement watch TUI (P1.5)
- **Task ID**: p1-5-watch
- **Depends On**: p1-4-status
- **Assigned To**: builder-status
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Create `src/worktree/watch.ts`:
  - Watch loop: `setInterval` that clears and redraws table
  - Use `table`, `color`, `isTTY` from `@side-quest/core/terminal`
  - If event server running: subscribe WebSocket for push updates
  - Otherwise: poll on interval (default 5s)
  - Requires `isTTY` check -- refuse if stdout not a terminal
  - ANSI output (exception to JSON-only rule, documented)
- Add `--watch` and `--interval` flags to `worktree status` in `cli.ts`
- No automated tests for TUI output (manual verification)
- Run `bun test --recursive` to ensure no regressions

### 15. Validate all P1 features
- **Task ID**: validate-p1
- **Depends On**: p1-3-event-emission, p1-4-status, p1-5-watch
- **Assigned To**: validator-p1
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repo**: `/Users/nathanvale/code/side-quest-git`
- Verify event schema types are complete and exported
- Verify event server starts and accepts POST requests
- Verify CLI commands emit events after operations
- Verify status command works with and without --pr
- Verify --watch mode starts (manual check in terminal)
- Verify package.json has `./events` subpath export
- Run `bun test --recursive`
- Run `bunx tsc --noEmit`
- Run `bunx biome ci .`
- Report any issues for builders to fix

### 16. Final Validation
- **Task ID**: validate-all
- **Depends On**: validate-p0, validate-p1
- **Assigned To**: validator-final
- **Agent Type**: general-purpose
- **Parallel**: false
- **Repos**: `/Users/nathanvale/code/side-quest-core` and `/Users/nathanvale/code/side-quest-git`
- Run all validation commands in @side-quest/core:
  - `bun test`
  - `bunx tsc --noEmit`
  - `bunx biome ci .`
- Run all validation commands in @side-quest/git:
  - `bun test --recursive`
  - `bunx tsc --noEmit`
  - `bunx biome ci .`
- Verify CLI help shows all new subcommands:
  ```
  worktree create|list|delete|check|init|install|sync|orphans|clean|status
  events start|tail
  ```
- Verify all new types have `readonly` fields
- Verify all exported functions have JSDoc
- Verify no `getGitRoot()` usage in path-sensitive operations (should use `getMainWorktreeRoot`)
- Verify JSON output for each new CLI subcommand:
  - `side-quest-git worktree install --help` (or dry run)
  - `side-quest-git worktree sync --dry-run`
  - `side-quest-git worktree orphans`
  - `side-quest-git worktree clean --dry-run`
  - `side-quest-git worktree status`
- Verify acceptance criteria met

## Acceptance Criteria

1. `getMainWorktreeRoot()` is published in @side-quest/core and imported by @side-quest/git
2. `worktree install <path>` returns `InstallResult` JSON with status discriminant
3. `worktree sync <branch>` returns `SyncResult` JSON with per-file detail
4. `worktree sync --all` syncs all non-main worktrees
5. `worktree create <existing-branch>` attaches instead of throwing (with `--no-attach` escape hatch)
6. `worktree orphans` returns `OrphanBranch[]` with type-safe status
7. `worktree list --include-orphans` appends orphan entries
8. `worktree clean` deletes only merged+clean worktrees (respects `--force`, never deletes main)
9. `worktree clean --dry-run` shows what would be deleted without doing it
10. Event schema defines `EventEnvelope` with schemaVersion, correlationId, source, repo, gitRoot
11. Event server accepts POST /events, serves GET /events, broadcasts via WebSocket
12. All CLI commands emit events fire-and-forget (500ms timeout, silent fail)
13. `worktree status` returns `WorktreeStatus[]` with commits ahead/behind
14. `worktree status --pr` includes PR info (graceful degradation without gh)
15. `worktree status --watch` shows live ANSI table (requires TTY)
16. All tests pass: `bun test --recursive`
17. No type errors: `bunx tsc --noEmit`
18. No lint errors: `bunx biome ci .`
19. All @side-quest/core utilities used per the mapping (no ad-hoc reimplementations)
20. Zero use of `getGitRoot()` in path-sensitive worktree operations

## Validation Commands

- `bun test` -- run all tests (both repos)
- `bunx tsc --noEmit` -- verify no type errors (both repos)
- `bunx biome ci .` -- lint and format check (both repos)
- `bun run validate` -- full quality check in @side-quest/git

## Notes

### Cross-Repo Dependency
P0.0 ships to @side-quest/core first. All subsequent work in @side-quest/git depends on the new core version. During development, use `bun link` for local resolution. For CI, the core package must be published before @side-quest/git CI passes.

### JSON Output Contract
All CLI subcommands MUST output JSON on stdout (exit 0) or `{"error":"..."}` on stderr (exit non-zero). Use `safeJsonStringify` from `@side-quest/core/utils`. The only exception is `status --watch` which outputs ANSI (documented, requires TTY check).

### Breaking Change in P0.3
`create` changes default behavior from throw-on-existing to attach-on-existing. Mitigated with `--no-attach` flag and `{ attach: false }` API option. Document in changelog.

### Event Domain Boundaries
- CLI owns `worktree.*` events -- schema defined in this package
- Plugin owns `session.*`, `safety.*`, `command.*` events -- data is `Record<string, unknown>` here
- The event bus is the integration point, not direct imports

### P2 Features (Out of Scope)
P2.1 (Symlink Mode), P2.2 (Cortex Keying), P2.3 (Spawn Config) are "needs design doc" milestones. They are NOT part of this execution plan. Each requires a focused design doc before implementation begins.

### Source Plan
Full roadmap with all design decisions and Codex review findings: `plugins/git/plans/side-quest-git.md`
