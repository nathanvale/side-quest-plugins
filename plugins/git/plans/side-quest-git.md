# PLAN: @side-quest/git Worktree Lifecycle & Observability Roadmap

**Date:** 2026-02-11
**Repo:** `/Users/nathanvale/code/side-quest-git`
**Package:** `@side-quest/git`

---

## Architecture Overview

The package currently has these worktree commands: `create`, `list`, `delete`, `check`, `init`. All output JSON on stdout (exit 0) or `{"error":"..."}` on stderr (exit non-zero). The CLI entrypoint is `src/worktree/cli.ts`.

Three-layer architecture:
```
Layer 1: @side-quest/git       -- worktree lifecycle (TypeScript, JSON output)
Layer 2: Event bus              -- hooks POST to local server, WebSocket broadcast
Layer 3: Bash scripts (dotfiles) -- fzf picker -> Layer 1 -> tmux session spawn
```

**JSON output protocol:** Exit 0 = structured JSON on stdout. Exit non-zero = `{"error":"..."}` on stderr via `safeJsonStringify` from `@side-quest/core/utils`. Never merge streams. This is the contract bash consumers depend on.

**Worktree root resolution:** All commands that need the repo root MUST use `getMainWorktreeRoot()` (P0.0 prerequisite), NOT `getGitRoot()`. The latter uses `--show-toplevel` which returns the worktree path inside linked worktrees, fragmenting paths, Cortex keying, and event bus repo identification.

---

## P0 - Foundation (Unblocks Bash Migration)

### P0.0: getMainWorktreeRoot Prerequisite

**What:** Add `getMainWorktreeRoot(cwd)` to `@side-quest/core/git`. This is the **first thing to ship** because every P0 feature depends on correct repo root resolution. `getGitRoot()` uses `--show-toplevel` which returns the wrong path inside linked worktrees.

**Files:**
- **Modify** `@side-quest/core` -- `src/git/index.ts` - Add `getMainWorktreeRoot()` and `isInsideWorktree()`
- **Modify** `@side-quest/core` -- `src/git/index.test.ts` - Tests
- **Modify** `@side-quest/git` -- `package.json` - Bump `@side-quest/core` dependency

**API:**
```typescript
/**
 * Returns the real repo root from any worktree.
 * Uses `git rev-parse --git-common-dir` which returns the main .git dir
 * even when called from a linked worktree.
 *
 * From main worktree:    --git-common-dir returns ".git" (relative)
 * From linked worktree:  --git-common-dir returns absolute path to main .git
 * Both resolve correctly via resolve(cwd, result, '..').
 */
export async function getMainWorktreeRoot(cwd: string): Promise<string | null>

/**
 * Returns true if CWD is inside a linked worktree (not the main worktree).
 * Derived from: getMainWorktreeRoot(cwd) !== getGitRoot(cwd)
 */
export async function isInsideWorktree(cwd: string): Promise<boolean>
```

**Tests:**
- Main worktree: returns same as `getGitRoot()`
- Linked worktree: returns main repo root (not worktree path)
- Non-git directory: returns null
- Bare repo: returns null

**Dependencies:** None -- ships to `@side-quest/core` first, then `@side-quest/git` bumps the dep.

---

### P0.1: Smart Install Detection

**What:** Port `should_run_install()` from bash (worktree-ai.sh:437-457). Checks if `node_modules` exists and if any lockfile is newer. Also provides the `worktree install` subcommand for bash callers that defer install until after Node version switching.

**IMPORTANT:** The `create` command does NOT auto-install. Bash needs the sequence: `create --no-install` -> `switch_node_version` (bash) -> `worktree install` (CLI). Auto-install would run under the wrong Node version. The `--no-install` flag on `create` defaults to true when called programmatically; the CLI exposes `worktree install <path>` as a separate subcommand.

**Files:**
- **Create** `src/worktree/install.ts` - `shouldRunInstall()` and `runInstall()`
- **Create** `src/worktree/install.test.ts`
- **Modify** `src/worktree/detect-pm.ts` - Add `detectLockfile()` (returns path), split `detectPackageManager()` (returns name) from `detectInstallCommand()` (returns full command)
- **Modify** `src/worktree/cli.ts` - Add `worktree install <path>` subcommand
- **Modify** `src/worktree/index.ts` - Export new functions

**API:**
```typescript
/** Check if node_modules needs a fresh install based on lockfile mtime. */
export function shouldRunInstall(dir: string): boolean

/** Result of running package install. */
export interface InstallResult {
  readonly status: 'installed' | 'up-to-date' | 'no-package-json' | 'failed'
  readonly packageManager: string | null  // 'bun' | 'yarn' | 'pnpm' | 'npm' | null
  readonly durationMs: number | null
  readonly error: string | null           // non-null only when status === 'failed'
}

/** Run package install. Returns result regardless of outcome (never throws). */
export async function runInstall(
  dir: string,
  options?: {
    force?: boolean      // skip mtime check, always install
    ci?: boolean         // use frozen-lockfile/ci flags (default: true)
    timeoutMs?: number   // install timeout (default: 120_000)
  }
): Promise<InstallResult>
```

**CLI:**
```bash
# Standalone install (called by bash after node version switch)
side-quest-git worktree install /path/to/worktree
side-quest-git worktree install /path/to/worktree --force
```

**Design decisions:**
- `InstallResult` uses a single `status` discriminant instead of separate `ran`/`skipped` booleans. This prevents impossible states (e.g. `ran: true, skipped: true`).
- `ci: true` by default -- matches bash behavior (`CI=true bun install --frozen-lockfile`).
- `runInstall` never throws. Failures are captured in `status: 'failed'` + `error` string. The CLI caller decides whether to propagate.
- `create.ts` does NOT call `runInstall` directly. It exposes a `--no-install` flag (default behavior) and bash calls `worktree install` separately after node switching.

**Dependencies:** P0.0 (needs `getMainWorktreeRoot` for resolving repo context)

**Tests:**
- Mtime combinations: lockfile newer, node_modules newer, both missing, lockfile missing
- Timeout: mock a slow install, verify timeout error after configured ms
- PM not found: mock missing `bun` command, verify `status: 'failed'` with clear error
- Install failure: mock non-zero exit, verify `status: 'failed'` with stderr captured
- No lockfile: verify `status: 'no-package-json'`
- Force flag: verify install runs even when mtime says up-to-date
- `worktree install` CLI: verify JSON output matches `InstallResult` contract

---

### P0.2: Worktree Sync Command

**What:** Re-copies config files from main worktree to one or all worktrees. The "attach-to-existing" file sync extracted as standalone command.

**Files:**
- **Create** `src/worktree/sync.ts`
- **Create** `src/worktree/sync.test.ts`
- **Modify** `src/worktree/cli.ts` - Add `sync` subcommand
- **Modify** `src/worktree/types.ts` - Add `SyncResult`
- **Modify** `src/worktree/index.ts`

**CLI:**
```bash
side-quest-git worktree sync feat/my-branch
side-quest-git worktree sync --all
side-quest-git worktree sync feat/my-branch --dry-run
```

**API:**
```typescript
export interface SyncedFile {
  readonly relativePath: string
  readonly action: 'copied' | 'skipped' | 'error'
  readonly reason?: string  // 'identical' for skipped, error message for error
}

export interface SyncResult {
  readonly branch: string
  readonly path: string
  readonly filesCopied: number
  readonly filesSkipped: number
  readonly files: readonly SyncedFile[]  // file-level detail for dry-run and bash integration
  readonly dryRun: boolean
}

export async function syncWorktree(gitRoot: string, branchName: string, options?: { dryRun?: boolean }): Promise<SyncResult>
export async function syncAllWorktrees(gitRoot: string, options?: { dryRun?: boolean }): Promise<SyncResult[]>
```

**Design:** Wraps existing `copyWorktreeFiles` with content-hash comparison to skip identical files. Uses `fastHash` from `@side-quest/core/hash` for speed (non-crypto, content comparison only). File-level `SyncedFile` array enables bash to show which files changed.

**Dependencies:** None (install is not sync's concern -- bash calls `worktree install` separately)

---

### P0.3: Attach-to-Existing Worktree Flow

**What:** When `create` is called for a branch that already has a worktree, re-sync files instead of throwing. Install is NOT automatic -- bash handles that separately.

**Files:**
- **Modify** `src/worktree/create.ts` - Change existing-path check from throw to attach flow
- **Modify** `src/worktree/types.ts` - Extend `CreateResult`
- **Modify** `src/worktree/create.test.ts`

**Behavior:**
```typescript
export interface CreateResult {
  // ...existing fields...
  readonly attached: boolean     // true = existing worktree, synced
  readonly syncResult?: SyncResult  // present when attached: true
}
```

When `attached: true`: sync files (P0.2). No install -- that's bash's job after node version switching.

**Breaking change mitigation:** The default behavior changes from throw-on-existing to attach-on-existing. To protect existing scripts:
- **CLI:** `--no-attach` flag preserves the throw behavior
- **API:** `createWorktree(gitRoot, branch, { attach: false })` preserves throw behavior
- **Docs:** Changelog entry noting the behavioral change

**Partial failure model:** If sync partially fails (some files copy, some error), the `CreateResult` still returns `attached: true` with `syncResult.files` showing per-file status. The caller decides severity.

**Dependencies:** P0.0, P0.2

---

### P0.4: Orphan Branch Discovery

**What:** Lists local branches without worktrees, excluding protected branches. Port of `list_orphan_branches()` from worktree-delete.sh:196-222.

**Files:**
- **Create** `src/worktree/orphans.ts`
- **Create** `src/worktree/orphans.test.ts`
- **Modify** `src/worktree/cli.ts` - Add `orphans` subcommand
- **Modify** `src/worktree/list.ts` - Add `--include-orphans` support
- **Modify** `src/worktree/types.ts` - Add `OrphanBranch`
- **Modify** `src/worktree/index.ts`

**API:**
```typescript
export type OrphanStatus = 'pristine' | 'merged' | 'ahead' | 'unknown'

export interface OrphanBranch {
  readonly branch: string
  readonly status: OrphanStatus  // type-safe enum, not display string
  readonly commitsAhead: number  // 0 for pristine/merged, N for ahead, -1 for unknown
  readonly merged: boolean       // has the branch been merged into main?
}

export async function listOrphanBranches(
  gitRoot: string,
  options?: { protectedBranches?: readonly string[] }
): Promise<OrphanBranch[]>
```

**CLI:**
```bash
side-quest-git worktree orphans
side-quest-git worktree list --include-orphans
```

**Design decisions:**
- `status` is a type-safe `OrphanStatus` union, not a display string like `'3 ahead'`. Display formatting is the CLI/TUI layer's job.
- `commitsAhead` is always a number (-1 for unknown), not `number | null`, to simplify downstream comparisons.
- Uses `getMainWorktreeRoot()` (P0.0) instead of `getGitRoot()` for correct root resolution in linked worktrees.
- `list --include-orphans` modifies the `list.ts` command output to append orphan entries with a `type: 'orphan'` discriminant.

**Dependencies:** P0.0

---

### P0.5: Worktree Clean Command (Batch Delete)

**What:** Batch-delete worktrees that are merged+clean. Non-interactive engine for what `batch_delete()` does in bash.

**Files:**
- **Create** `src/worktree/clean.ts`
- **Create** `src/worktree/clean.test.ts`
- **Modify** `src/worktree/cli.ts` - Add `clean` subcommand
- **Modify** `src/worktree/types.ts` - Add `CleanResult`
- **Modify** `src/worktree/index.ts`

**CLI:**
```bash
side-quest-git worktree clean --dry-run
side-quest-git worktree clean
side-quest-git worktree clean --delete-branches
side-quest-git worktree clean --include-orphans
side-quest-git worktree clean --force
```

**`--force` semantics (explicitly defined):**
- Without `--force`: only deletes worktrees that are BOTH merged AND clean (no uncommitted changes). This is the safe default.
- With `--force`: deletes ALL non-main worktrees regardless of dirty/unmerged status. This is destructive. The CLI outputs a warning to stderr before proceeding: `"Warning: --force will delete dirty and unmerged worktrees. N worktrees will be removed."`. In `--dry-run` mode, `--force` shows what WOULD be deleted without the warning.
- `--force` never deletes the main worktree (the one where `.git` is a directory, not a file).
- `--force` combined with `--delete-branches` uses `git branch -D` (force delete) instead of `git branch -d` (safe delete).

**API:**
```typescript
export type SkipReason =
  | 'dirty'
  | 'unmerged'
  | 'is-main'
  | 'checked-out-elsewhere'
  | 'delete-failed'

export interface CleanedWorktree {
  readonly branch: string
  readonly path: string
  readonly branchDeleted: boolean
}

export interface SkippedWorktree {
  readonly branch: string
  readonly path: string
  readonly reason: SkipReason
  readonly error?: string  // present when reason is 'delete-failed'
}

export interface CleanResult {
  readonly deleted: readonly CleanedWorktree[]
  readonly skipped: readonly SkippedWorktree[]
  readonly orphansDeleted: readonly OrphanBranch[]  // full OrphanBranch objects, not just strings
  readonly dryRun: boolean
  readonly forced: boolean
}

export async function cleanWorktrees(gitRoot: string, options?: {
  dryRun?: boolean; deleteBranches?: boolean; includeOrphans?: boolean; force?: boolean
}): Promise<CleanResult>
```

**Design decisions:**
- `SkipReason` is a typed union with 5 values (expanded from 3). `'checked-out-elsewhere'` handles the case where a branch is checked out in another worktree. `'delete-failed'` captures unexpected git errors during deletion.
- `orphansDeleted` returns full `OrphanBranch[]` objects (not just `string[]`) so callers get status/commits-ahead context.
- `CleanResult.forced` tells the consumer whether force mode was used, for logging/audit purposes.

**Tests:**
- Unit: clean+merged worktrees deleted, dirty skipped, unmerged skipped
- Unit: `--force` deletes dirty and unmerged
- Unit: `--force` still skips main worktree
- Unit: `--dry-run` returns correct counts without deleting
- Unit: `--delete-branches` calls `git branch -d` (or `-D` with force)
- Integration: create repo with mix of states, run clean, verify filesystem
- Integration: partial failure (one delete fails mid-batch) -- verify others still succeed and failed one appears in `skipped` with `delete-failed` reason
- Integration: `--include-orphans` cleans merged orphan branches

**Dependencies:** P0.0, P0.4 (for orphan support)

---

## P1 - Observability Infrastructure

### P1.1: Event Schema Definition

**What:** Type definitions and envelope structure for all events flowing through the event bus. Defines the wire format contract between producers (CLI commands, plugin hooks) and consumers (event server, watch TUI, bash scripts).

**Files:**
- **Create** `src/events/types.ts`
- **Create** `src/events/schema.ts` - Envelope factory and validation
- **Create** `src/events/schema.test.ts`
- **Create** `src/events/index.ts`
- **Modify** `package.json` - Add `./events` subpath export

**Event envelope (all events share this shape):**
```typescript
export interface EventEnvelope<T extends EventType = EventType> {
  /** Schema version for forward/backward compatibility. Semver string. */
  readonly schemaVersion: '1.0.0'
  /** Unique event ID. */
  readonly id: string
  /** ISO 8601 timestamp. Always UTC. */
  readonly timestamp: string
  /** Event type discriminant. */
  readonly type: T
  /** Stable repo name (from getMainWorktreeRoot + basename). */
  readonly repo: string
  /** Absolute path to main worktree root. */
  readonly gitRoot: string
  /** Producer identifier: 'cli' for @side-quest/git commands, 'hook' for plugin hooks. */
  readonly source: 'cli' | 'hook'
  /** Correlation ID for tracing related events across producers. */
  readonly correlationId: string
  /** Event-specific payload. Shape depends on `type`. */
  readonly data: EventDataMap[T]
}
```

**Domain boundary rules:**
- **CLI domain events** (`worktree.*`): Produced by `@side-quest/git` commands. Schema owned by this package.
- **Hook domain events** (`session.*`, `safety.*`, `command.*`): Produced by plugin hooks. Schema owned by `plugins/git`. This package only defines the envelope + the `type` string. The `data` payload for hook events is `Record<string, unknown>` -- the plugin defines the shape.

This separation means `@side-quest/git` doesn't import plugin types, and the plugin doesn't import CLI result types. The event bus is the integration point.

**CLI event types and payloads:**
```typescript
export type CliEventType =
  | 'worktree.created'
  | 'worktree.deleted'
  | 'worktree.synced'
  | 'worktree.cleaned'
  | 'worktree.attached'
  | 'worktree.installed'

export type HookEventType =
  | 'session.started'
  | 'session.ended'
  | 'session.compacted'
  | 'safety.blocked'
  | 'command.executed'

export type EventType = CliEventType | HookEventType

export interface EventDataMap {
  'worktree.created': CreateResult
  'worktree.deleted': DeleteResult
  'worktree.synced': SyncResult
  'worktree.cleaned': CleanResult
  'worktree.attached': CreateResult  // with attached: true
  'worktree.installed': InstallResult
  // Hook events use opaque data -- plugin defines the shape
  'session.started': Record<string, unknown>
  'session.ended': Record<string, unknown>
  'session.compacted': Record<string, unknown>
  'safety.blocked': Record<string, unknown>
  'command.executed': Record<string, unknown>
}
```

**Factory:**
```typescript
/** Create an event with auto-generated id, timestamp, correlationId. */
export function createEvent<T extends EventType>(
  type: T,
  data: EventDataMap[T],
  context: { repo: string; gitRoot: string; source: 'cli' | 'hook'; correlationId?: string }
): EventEnvelope<T>
```

**Dependencies:** None

**Tests:**
- `createEvent` generates valid envelope (id is string, timestamp is ISO 8601 UTC, schemaVersion is '1.0.0')
- Correlation ID is auto-generated when not provided, passed through when provided
- TypeScript compiler enforces `data` shape matches `type` (compile-time test)

---

### P1.2: Event Bus Server (HTTP + WebSocket)

**What:** Lightweight local server using `Bun.serve()`. Receives events via HTTP POST, broadcasts via WebSocket, persists to JSONL.

**Files:**
- **Create** `src/events/server.ts`
- **Create** `src/events/client.ts`
- **Create** `src/events/store.ts` - In-memory ring buffer + JSONL
- **Create** `src/events/server.test.ts`
- **Modify** `src/worktree/cli.ts` - Add `events` subcommand namespace

**Endpoints:**
- `POST /events` - Submit event(s). Body: single JSON event or newline-delimited JSONL.
- `GET /events` - Query with `?type=`, `?since=`, `?limit=`. Returns JSON array.
- `GET /health` - Server health check. Returns `{"status":"ok","uptime":N,"events":N}`.
- `WS /ws` - Real-time event stream. Optional `?type=` filter.

**CLI:**
```bash
side-quest-git events start [--port 7483]
side-quest-git events tail [--type worktree.*]
```

**Operational semantics (explicitly defined):**

| Concern | Behavior |
|---------|----------|
| **Ordering** | Events are stored in arrival order. No reordering. WebSocket broadcasts preserve insertion order. `GET /events` returns oldest-first by default. |
| **Replay** | `GET /events?since=<iso-timestamp>` returns events after timestamp. `GET /events?limit=N` returns last N. Both filter from the in-memory ring buffer. No disk replay in v1 -- ring buffer is the source of truth during server lifetime. |
| **Retention** | In-memory ring buffer holds last 1000 events (configurable via `--max-events`). JSONL file on disk is append-only, never truncated by the server. Disk rotation is the user's responsibility (logrotate, cron, etc.) in v1. |
| **Crash recovery** | On restart, the server starts with an empty ring buffer. It does NOT replay from JSONL. JSONL is a persistence layer for external analysis, not a WAL. This is acceptable for a local dev tool -- events during downtime are lost from the buffer, but preserved on disk. |
| **Port/PID files** | Written to `~/.cache/side-quest-git/<repo-name>/events.{port,pid}`. Keyed by repo name (from `getMainWorktreeRoot` + basename) to avoid cross-repo contention. Stale PID files detected via `kill(pid, 0)` check before starting. |
| **Persistence** | JSONL append uses `appendToFileSync` (not `withFileLock`). Single-writer model -- only the event server writes to this file. No lock contention. |

**Dependencies:** P0.0 (for repo-scoped PID/port files), P1.1

---

### P1.3: CLI Event Emission

**What:** Fire-and-forget HTTP POST from CLI commands to event server. This section covers CLI-side emission only. Plugin hook emission is defined in the plugin-integration plan.

**Name clarification:** This section was previously "Hook Integration" but its scope is CLI command emitters, not plugin hooks. Renamed to avoid confusion.

**Files:**
- **Create** `src/events/emit.ts` - Fire-and-forget emitter (500ms timeout, silent fail)
- **Modify** `src/worktree/create.ts` - Emit `worktree.created` (or `worktree.attached`)
- **Modify** `src/worktree/delete.ts` - Emit `worktree.deleted`
- **Modify** `src/worktree/sync.ts` - Emit `worktree.synced`
- **Modify** `src/worktree/clean.ts` - Emit `worktree.cleaned`
- **Modify** `src/worktree/install.ts` - Emit `worktree.installed`

**Producer/consumer alignment:**

| CLI command | Event emitted | Plugin hook (separate plan) | Event emitted |
|-------------|---------------|----------------------------|---------------|
| `worktree create` | `worktree.created` | `git-context-loader.ts` | `session.started` |
| `worktree create` (attach) | `worktree.attached` | `git-safety.ts` | `safety.blocked` |
| `worktree delete` | `worktree.deleted` | `command-logger.ts` | `command.executed` |
| `worktree sync` | `worktree.synced` | `session-summary.ts` | `session.compacted` |
| `worktree clean` | `worktree.cleaned` | `auto-commit-on-stop.ts` | `session.ended` |
| `worktree install` | `worktree.installed` | | |

**Emitter API:**
```typescript
/** Fire-and-forget event emission. Never throws. 500ms timeout. */
export async function emitEvent(event: EventEnvelope): Promise<void>

/** Check if event server is running for this repo. */
export function isEventServerRunning(repoName: string): boolean
```

**Tests:**
- Mock HTTP server, verify events arrive with correct envelope shape
- Server down: verify `emitEvent` returns silently (no throw, no hang)
- Timeout: verify 500ms deadline actually aborts
- Latency budget: verify emission adds <5ms to command execution (timer test)

**Dependencies:** P1.1, P1.2

---

### P1.4: Enhanced Worktree Status

**What:** Richer than `list` -- includes commits ahead/behind, PR status via `gh`, last commit timestamp.

**Files:**
- **Create** `src/worktree/status.ts`
- **Create** `src/worktree/status.test.ts`
- **Modify** `src/worktree/cli.ts` - Add `status` subcommand
- **Modify** `src/worktree/types.ts` - Add `WorktreeStatus`

**CLI:**
```bash
side-quest-git worktree status
side-quest-git worktree status --pr     # includes PR info (slower)
```

**API:**
```typescript
export interface WorktreeStatus {
  readonly branch: string
  readonly path: string
  readonly isMain: boolean
  readonly dirty: boolean
  readonly commitsAhead: number
  readonly commitsBehind: number
  readonly lastCommitAt: string | null  // ISO 8601
  readonly lastCommitMessage: string | null
  /** PR info. Only populated when --pr flag is used. null otherwise. */
  readonly pr: {
    readonly number: number
    readonly status: 'open' | 'merged' | 'closed'
    readonly url: string
  } | null
}

export async function getWorktreeStatus(
  gitRoot: string,
  options?: {
    includePr?: boolean
    concurrency?: number  // max parallel git/gh calls, default 4
  }
): Promise<WorktreeStatus[]>
```

**Graceful degradation:**
- `gh` not installed: `pr` field is `null` even with `--pr` flag. No error, just a note in stderr: `"Note: 'gh' not found, PR info unavailable"`
- `gh` auth failure: same as above, `pr: null` with stderr note
- `gh` rate limit: stop PR lookups after first 429, set remaining to `null`
- Detached HEAD: `branch` is the commit SHA, `commitsAhead`/`commitsBehind` are 0

**Concurrency:** Uses `processInParallelChunks` with configurable max (default 4) to avoid spawning dozens of `git` and `gh` processes simultaneously.

**Dependencies:** P0.0

---

### P1.5: Worktree Status --watch TUI

**What:** Live terminal dashboard, refreshes via WebSocket or poll fallback.

**Files:**
- **Create** `src/worktree/watch.ts`
- **Modify** `src/worktree/cli.ts` - Wire `--watch` flag

**CLI:**
```bash
side-quest-git worktree status --watch
side-quest-git worktree status --watch --interval 5
```

**TUI vs JSON architecture:** The `--watch` flag outputs ANSI-formatted text to stdout, which is an exception to the "all output JSON" rule. This is acceptable because:
1. `--watch` is explicitly a human-interactive mode (not scriptable)
2. It requires `isTTY` check -- refuses to start if stdout is not a terminal
3. Without `--watch`, `status` still outputs JSON as normal

**MVP scope (keep simple):** For v1, use only `table`, `color`, and `isTTY` from `@side-quest/core/terminal`. Skip spinner, progressBar, box, truncate until needed. The watch loop is a `setInterval` that clears and redraws the table. If event server is running, subscribe to WebSocket for push updates; otherwise poll on interval.

**Dependencies:** P1.4. P1.2 is optional enhancement (degrades to polling).

**Sequencing note:** Ship P1.5 in a separate week from P1.3, not the same week. P1.2 (event server) is the bottleneck -- let it stabilize before adding consumers.

---

## P2 - Advanced Features (Needs-Design Milestones)

**Scope clarification:** P2 features are not fully specified. Each is a "needs design" milestone that requires a focused design doc before implementation begins. This section captures intent and known constraints, not implementation-ready specifications.

### P2.1: Symlink Mode for Config Files

**Status:** Needs design doc before implementation.

**Intent:** Instead of copying `.claude`, `.kit` etc. to each worktree, create relative symlinks back to the main worktree. Changes in main are instantly visible in all worktrees.

**Config extension to `.worktrees.json`:**
```json
{
  "copy": [".env", ".env.*"],
  "symlink": [".claude", ".kit", "**/*.kit"]
}
```

**Known design questions (must resolve in design doc):**
1. **Conflict resolution:** What happens when a pattern appears in both `copy` and `symlink`? Current proposal: `symlink` wins with a warning. Alternative: error.
2. **Existing files:** When switching from copy to symlink mode, what happens to existing copied files? Delete and replace? Error?
3. **Symlink safety:** How to prevent symlinks that escape the repo root? `validatePathSafety` from core, but need to define exact rules.
4. **Circular symlinks:** How to detect and prevent symlink loops?
5. **Platform behavior:** Symlinks on Windows (if we ever support it) require admin privileges or developer mode.
6. **Sync interaction:** Does `worktree sync` re-evaluate symlinks? Or leave them alone?

**Files (tentative):**
- **Modify** `src/worktree/copy-files.ts` - Add symlink mode
- **Modify** `src/worktree/config.ts` - Parse `symlink` field
- **Modify** `src/worktree/types.ts` - Extend `WorktreeConfig`
- **Create** `src/worktree/symlink.test.ts`

**Dependencies:** Design doc approval. No code dependency on P0/P1.

---

### P2.2: Cortex Worktree Keying

**Status:** Needs design doc. Ownership is primarily in the **plugin** (plugins/git), not this CLI package. Moved to plugin-integration plan as the primary owner.

**What this package provides:** `getMainWorktreeRoot()` (P0.0) and `getStableRepoName()` -- the building blocks that the plugin's `session-summary.ts` uses to fix Cortex keying. The fix itself lives in the plugin.

**Cross-reference:** See `plugins/git/plans/plugin-integration.md` Section 4 (Cortex Worktree Keying Fix) for the actual implementation plan.

---

### P2.3: Worktree Spawn Config

**Status:** Needs design doc before implementation.

**Intent:** Output tmux session config as JSON for bash to consume, separating "what to create" (TypeScript, JSON) from "how to create it" (bash, tmux commands).

**JSON contract (v1 proposal -- needs review):**
```typescript
export interface SpawnConfig {
  /** Schema version for forward compatibility. */
  readonly schemaVersion: '1.0.0'
  /** Tmux session name. Matches bash convention: ${repo}-wt-${branch} with dots -> hyphens. */
  readonly sessionName: string
  /** Absolute path to the worktree. */
  readonly worktreePath: string
  /** Branch name. */
  readonly branch: string
  /** Suggested windows for the session. Bash consumer decides what to actually create. */
  readonly windows: readonly Array<{
    readonly name: string
    readonly command?: string
  }>
}
```

**Design decisions to resolve:**
1. **Session naming ownership:** Should the CLI own `getSessionName()` or should bash? Current proposal: CLI provides the function, bash can override. But this leaks tmux concerns into the CLI. Alternative: CLI outputs branch+repo, bash computes session name.
2. **Window definitions:** Are these prescriptive (CLI decides layout) or advisory (bash decides)? Current proposal: advisory -- bash is the tmux expert.
3. **Versioning:** `schemaVersion` field enables forward compatibility. Bash should check `schemaVersion` and error on unknown versions.

**Consumer contract test:** Before shipping, create a bash test that parses the JSON output with `jq` and verifies all expected fields exist. This is the integration test.

**CLI:**
```bash
side-quest-git worktree spawn feat/my-branch --config-only
```

**Dependencies:** Design doc approval. P0.3 (uses create/attach flow).

---

## Implementation Sequencing

```
Week 0:  P0.0 (getMainWorktreeRoot) -- upstream to @side-quest/core, bump dep
         Prereq for everything. Small, focused PR.

Week 1:  P0.1 (smart install + worktree install subcommand) + P0.4 (orphan discovery)
         Parallel, both depend only on P0.0.

Week 2:  P0.2 (sync command)
         No dependency on P0.1 (install is separate concern now).

Week 3:  P0.3 (attach flow) + P0.5 (clean command)
         P0.3 needs P0.2. P0.5 needs P0.4.

Week 4:  P1.1 (event schema) -- schema lock before any producers/consumers
         Also: P1.4 (status command) -- parallel, no event deps.

Week 5:  P1.2 (event server)
         Needs P1.1. Let it stabilize for a week before adding producers.

Week 6:  P1.3 (CLI event emission)
         Needs P1.2 running. Integration testing with real server.

Week 7:  P1.5 (watch TUI)
         Needs P1.4. Optional P1.2 enhancement.

Week 8+: P2.* design docs, then implementation as bandwidth allows.
```

**Key differences from previous 6-week plan:**
- Added Week 0 for `getMainWorktreeRoot` prerequisite
- Extended to 8 weeks (more realistic given cross-repo contracts)
- P1.3 and P1.5 no longer share a week (de-risked)
- P1.1 is explicitly a "schema lock" milestone -- no producers ship until schema is reviewed
- P2.* are design-doc-first, not code-first
- Biggest schedule risk is unspecified contracts (events, spawn config, symlink semantics), not coding speed

---

## @side-quest/core Utility Mapping

Every feature below MUST use `@side-quest/core` utilities instead of ad-hoc implementations. This ensures consistent patterns, tested edge cases, and Bun-native performance.

### P0.1: Smart Install Detection (`install.ts`)

| Need | Core utility | Import |
|------|-------------|--------|
| Check if `node_modules` exists | `pathExistsSync` | `@side-quest/core/fs` |
| Check if lockfile exists | `pathExistsSync` | `@side-quest/core/fs` |
| Compare lockfile mtime vs node_modules mtime | `statSync` (`.mtime`) | `@side-quest/core/fs` |
| Check if package.json exists | `findUpSync('package.json')` | `@side-quest/core/fs` |
| Read `packageManager` field from package.json | `readJsonFileSync` | `@side-quest/core/fs` |
| Run install command | `spawnWithTimeout` (with CI timeout) | `@side-quest/core/spawn` |
| Check if `bun`/`yarn`/`pnpm` exists on PATH | `commandExists` | `@side-quest/core/spawn` |
| Test setup: temp dirs with files | `setupTestDir`, `cleanupTestDir` | `@side-quest/core/testing` |
| Test setup: write test lockfiles | `writeTestFile` | `@side-quest/core/testing` |

### P0.2: Worktree Sync (`sync.ts`)

| Need | Core utility | Import | Decision |
|------|-------------|--------|----------|
| Content comparison (skip identical files) | `fastHash` | `@side-quest/core/hash` | Use `fastHash` (non-crypto, fast) for file comparison. `sha256File` is overkill for local content diffing -- reserve for integrity checks. |
| Copy files (reuse existing) | `copyFileSync` | `@side-quest/core/fs` | |
| Walk directory for recursive patterns | `walkDirectory` | `@side-quest/core/fs` | |
| Glob matching for patterns | `matchGlob`, `globFilesSync` | `@side-quest/core/glob` | |
| Multiple pattern matching | `matchAnyGlob`, `globFilesMultiSync` | `@side-quest/core/glob` | |
| Ensure parent dirs exist | `ensureParentDirSync` | `@side-quest/core/fs` | |

### P0.3: Attach-to-Existing (`create.ts`)

| Need | Core utility | Import |
|------|-------------|--------|
| Check if worktree path exists | `pathExistsSync`, `isDirectorySync` | `@side-quest/core/fs` |
| Resolve main repo root (not worktree) | `getMainWorktreeRoot` | `@side-quest/core/git` (after P0.0) |

### P0.4: Orphan Branch Discovery (`orphans.ts`)

| Need | Core utility | Import |
|------|-------------|--------|
| Run `git branch`, `git log`, `git merge-base` | `spawnAndCollect` | `@side-quest/core/spawn` |
| Parse git output | `spawnAndCollect` (returns `.stdout`) | `@side-quest/core/spawn` |
| Get repo root for context | `getMainWorktreeRoot` | `@side-quest/core/git` (NOT `getGitRoot`) |
| Assert we're in a git repo | `assertGitRepo` | `@side-quest/core/git` |

### P0.5: Worktree Clean (`clean.ts`)

| Need | Core utility | Import |
|------|-------------|--------|
| Batch process worktrees | `processInParallelChunks` | `@side-quest/core/concurrency` |
| Remove worktree directories | `removeDirSync` | `@side-quest/core/fs` |
| Run git worktree remove | `spawnAndCollect` | `@side-quest/core/spawn` |
| Run git branch -d/-D | `spawnAndCollect` | `@side-quest/core/spawn` |
| Structured error for skip reasons | `StructuredError` | `@side-quest/core/errors` |

### P1.1: Event Schema (`events/types.ts`)

| Need | Core utility | Import |
|------|-------------|--------|
| Generate event IDs | `nanoId` | `@side-quest/core/utils` |
| Generate correlation IDs | `generateCorrelationId` | `@side-quest/core/instrumentation` |
| Timestamp generation | `new Date().toISOString()` | Built-in (not `formatDuration` -- that's for durations, not timestamps) |

### P1.2: Event Bus Server (`events/server.ts`)

| Need | Core utility | Import |
|------|-------------|--------|
| JSONL persistence (append events) | `appendToFileSync` | `@side-quest/core/fs` (single-writer, no lock needed) |
| Read JSONL for query replay | `readLinesSync` | `@side-quest/core/fs` |
| Safe JSON parse per line | `safeJsonParse` | `@side-quest/core/utils` |
| Port/PID file management | `writeTextFileSyncAtomic`, `ensureCacheDir` | `@side-quest/core/fs` |
| Check if port file is stale | `isFileStale` | `@side-quest/core/fs` |
| Structured logging | `createPluginLogger` | `@side-quest/core/logging` |
| Metrics collection | `MetricsCollector` | `@side-quest/core/logging` |
| Operation observability | `observe` | `@side-quest/core/instrumentation` |

### P1.3: CLI Event Emission (`events/emit.ts`)

| Need | Core utility | Import |
|------|-------------|--------|
| HTTP POST with timeout | `withTimeout` | `@side-quest/core/concurrency` |
| Correlation ID for tracing | `generateCorrelationId` | `@side-quest/core/instrumentation` |
| Error categorization | `categorizeError`, `getErrorCategory` | `@side-quest/core/instrumentation` |
| Check if event server is running | `pathExistsSync` (check PID file) | `@side-quest/core/fs` |

### P1.4: Enhanced Status (`status.ts`)

| Need | Core utility | Import |
|------|-------------|--------|
| Run `gh pr list`, `git log` in parallel | `processInParallelChunks` | `@side-quest/core/concurrency` |
| Spawn gh CLI | `spawnAndCollect` | `@side-quest/core/spawn` |
| Check if `gh` is installed | `isToolAvailable` | `@side-quest/core/spawn` |
| Parse JSON from gh output | `safeJsonParse` | `@side-quest/core/utils` |
| Format duration (last activity) | `formatDuration` | `@side-quest/core/formatters` |

### P1.5: Watch TUI (`watch.ts`)

| Need | Core utility | Import |
|------|-------------|--------|
| ANSI table rendering | `table` | `@side-quest/core/terminal` |
| Color output | `color` | `@side-quest/core/terminal` |
| TTY detection | `isTTY` | `@side-quest/core/terminal` |
| Debounce WebSocket updates | `debounce` | `@side-quest/core/utils` |

### P2.1: Symlink Mode (`copy-files.ts` extension)

| Need | Core utility | Import |
|------|-------------|--------|
| Detect existing symlinks | `isSymlinkSync` | `@side-quest/core/fs` |
| Validate symlink paths (no escape) | `validatePathSafety` | `@side-quest/core/fs` |
| Create glob matcher for symlink patterns | `createGlobMatcher` | `@side-quest/core/glob` |

### CLI-wide Patterns (already in use, confirm/expand)

| Need | Core utility | Import |
|------|-------------|--------|
| Parse CLI args | `parseArgs`, `getStringFlag`, `normalizeFlags` | `@side-quest/core/cli` |
| Output errors to stderr | `outputError` | `@side-quest/core/cli` |
| Check if running as main script | `isMainScript` | `@side-quest/core/terminal` |
| Output format flag | `parseOutputFormat`, `OutputFormat` | `@side-quest/core/terminal` |
| Safe JSON stringify (circular refs) | `safeJsonStringify` | `@side-quest/core/utils` |
| Extract error messages | `getErrorMessage` | `@side-quest/core/utils` |
| Structured errors with types | `StructuredError` | `@side-quest/core/errors` |
| Recoverable error detection | `isRecoverableError` | `@side-quest/core/errors` |
| Validate shell commands | `validateShellSafePattern`, `escapeShellArg` | `@side-quest/core/validation` + `@side-quest/core/spawn` |
| Validate glob patterns in config | `validateGlob`, `isValidGlob` | `@side-quest/core/validation` |
| Validate filenames for subprocess | `validateFilenameForSubprocess` | `@side-quest/core/fs` |

### Testing Strategy (all test files)

| Need | Core utility | Import |
|------|-------------|--------|
| Create temp directories | `setupTestDir` | `@side-quest/core/testing` |
| Cleanup temp directories | `cleanupTestDir` | `@side-quest/core/testing` |
| Write test fixtures | `writeTestFile` | `@side-quest/core/testing` |
| Read test output files | `readTestFile` | `@side-quest/core/testing` |
| Check test file existence | `testFileExists` | `@side-quest/core/testing` |
| Isolated temp dir per test | `createTempDir` | `@side-quest/core/testing` |
| Deep equality assertions | `deepEquals` | `@side-quest/core/fs` |

---

## Upstream Contributions to @side-quest/core

When building features for `@side-quest/git`, any utility that is **generic enough for reuse across SideQuest packages** should be contributed upstream to `@side-quest/core` rather than kept local.

### Candidates Identified During Planning

| Utility | Target module | Status | Notes |
|---------|--------------|--------|-------|
| `getMainWorktreeRoot(cwd)` | `@side-quest/core/git` | **PREREQUISITE (P0.0)** | Ships first. Every P0 feature depends on this. `getGitRoot()` is wrong for linked worktrees. |
| `appendJsonlSync(filePath, record)` | `@side-quest/core/fs` | Candidate | Atomic JSONL append (JSON.stringify + newline). Define max record size (1MB default) and behavior on write failure (throw, not silent). |
| `readJsonlSync<T>(filePath)` | `@side-quest/core/fs` | Candidate | Parse JSONL into typed array. Define behavior for files >100MB (streaming alternative) and malformed lines (skip with warning vs throw). |
| `fireAndForget(fn, timeoutMs, opts)` | `@side-quest/core/concurrency` | Candidate | Requires explicit error policy: `opts.onError: 'silent' | 'log' | 'callback'`. Default 'silent' matches hook use case but caller must opt in explicitly. No blanket swallow. |

### Removed from candidates

| Utility | Reason |
|---------|--------|
| `isInsideWorktree(cwd)` | Derivable from `getMainWorktreeRoot(cwd) !== getGitRoot(cwd)`. Adding a one-liner to core is API bloat. Implement inline where needed. |
| `getStableRepoName(cwd)` | Naming policy (basename of root) is borderline domain logic. Different packages might want different naming. Implement inline: `(await getMainWorktreeRoot(cwd))?.split('/').pop()`. |
| `spawnAndCollectSync` | Already exists as `spawnSyncCollect` in `@side-quest/core/spawn`. No new utility needed -- just use the existing name. |

### Process

1. **Prove the pattern locally first** -- implement in `@side-quest/git` or the plugin
2. **Once stable and tested** -- open a PR to `@side-quest/core` with the utility + tests
3. **Then swap the import** -- replace local implementation with the core import
4. **Bump `@side-quest/core` dependency** -- update `package.json` in `@side-quest/git`

### Criteria for Upstream

A utility belongs in `@side-quest/core` if it meets ALL of:
- Used (or could be used) by 2+ packages in the SideQuest ecosystem
- Has no domain-specific logic (no worktree concepts, no event bus concepts)
- Is small enough to test in isolation
- Follows existing module conventions (Bun-native, named exports, JSDoc)

---

## Conventions

- Files: kebab-case (`copy-files.ts`)
- Tests: colocated `*.test.ts`
- Types: separate `types.ts`, all `readonly`
- Exports: named only, via `index.ts` barrels
- JSDoc on every exported function
- JSON output: `console.log(safeJsonStringify(data, null, 2))` -- always use `safeJsonStringify`
- Errors: `console.error(safeJsonStringify({ error: getErrorMessage(e) }))` then `process.exit(1)`
- Processes: `spawnAndCollect` from `@side-quest/core/spawn`
- Repo root: `getMainWorktreeRoot` from `@side-quest/core/git` (never `getGitRoot` for path-sensitive operations)
- Testing: `setupTestDir`/`cleanupTestDir` from `@side-quest/core/testing`
- Logging: `createPluginLogger` from `@side-quest/core/logging`
- Observability: `observe`/`observeSync` from `@side-quest/core/instrumentation`
- Terminal output: `table`/`color`/`box` from `@side-quest/core/terminal`

---

## 12. Review Findings Addressed

This plan was reviewed by a staff engineer. Here's the resolution status of all findings:

### BLOCKING (11) -- all resolved

| # | Section | Finding | Resolution |
|---|---------|---------|-----------|
| 1 | P0.1 | Auto-install in create/attach conflicts with migration's deferred install pattern | Fixed: `create` no longer auto-installs. Added `--no-install` as default behavior and new `worktree install <path>` subcommand. Bash sequence: create -> switch node -> install. |
| 2 | P0.4 | Uses `getGitRoot` which is wrong for linked worktrees | Fixed: All P0.4 core mapping now uses `getMainWorktreeRoot` from P0.0. Explicit call-out in table. |
| 3 | P0.5 | `--force` semantics underspecified | Fixed: Explicit behavior table defining force vs non-force for dirty, unmerged, main worktree, and branch deletion. Warning message specified. |
| 4 | P1.1 | Event envelope missing (schema version, timestamp, source, correlation ID) | Fixed: Full `EventEnvelope` type defined with `schemaVersion`, `timestamp` (ISO 8601 UTC), `source`, `correlationId`, `repo`, `gitRoot`. |
| 5 | P1.1 | Schema mixes CLI and plugin hook domains | Fixed: Explicit domain boundary rules. CLI owns `worktree.*` events. Plugin owns `session.*`/`safety.*`/`command.*` events. Hook data is `Record<string, unknown>`. |
| 6 | P1.2 | Ordering, replay, retention, crash-recovery unspecified | Fixed: Explicit "Operational semantics" table covering all four concerns. Ring buffer for live queries, JSONL for persistence, no crash replay in v1. |
| 7 | P1.3 | Producer/schema mismatch between P1.1, P1.3, and plugin plan | Fixed: Producer/consumer alignment table showing exact mapping between CLI commands, event types, plugin hooks, and their events. Section renamed to "CLI Event Emission" for clarity. |
| 8 | P2.1 | Under-specified (no files, signatures, flags, tests) | Fixed: Reclassified as "Needs design doc" milestone. Listed 6 open design questions. Tentative file list included. No code ships without design doc approval. |
| 9 | P2.1 | Symlink safety model incomplete | Fixed: Safety questions (escape, loops, replacement policy) explicitly listed as design doc requirements. |
| 10 | P2.2 | "Investigate" is not implementable | Fixed: Reframed. Ownership moved to plugin plan. This package provides building blocks (P0.0). Cross-reference added. |
| 11 | P2.3 | JSON contract undefined | Fixed: v1 `SpawnConfig` contract defined with `schemaVersion`, fields, and versioning strategy. Marked as needing design doc review. Consumer contract test required. |

### SHOULD-FIX (20) -- all resolved

| # | Section | Finding | Resolution |
|---|---------|---------|-----------|
| 12 | P0.1 | InstallResult has redundant/footgun state (ran, skipped, reason) | Fixed: Replaced with single `status` discriminant: `'installed' | 'up-to-date' | 'no-package-json' | 'failed'`. No impossible states. |
| 13 | P0.1 | Tests only cover mtime combos | Fixed: Test list expanded to include timeout, PM-not-found, install-failure, lockfile-absence, force flag, and CLI JSON output. |
| 14 | P0.2 | Declared dependency on P0.1 not reflected in API | Fixed: Dependency removed. Install is no longer sync's concern. Bash calls `worktree install` separately. |
| 15 | P0.2 | SyncResult lacks file-level reporting | Fixed: Added `SyncedFile` type with `relativePath`, `action`, `reason`. `SyncResult.files` array provides per-file detail for bash integration. |
| 16 | P0.2 | Both sha256File and fastHash without decision rule | Fixed: Decision made -- use `fastHash` for content comparison (fast, non-crypto). `sha256File` reserved for integrity checks. Noted in core mapping table. |
| 17 | P0.3 | Default behavior changes from throw to attach (regression risk) | Fixed: `--no-attach` flag and `{ attach: false }` API option preserve throw behavior. Breaking change documented for changelog. |
| 18 | P0.3 | `attached: boolean` too thin; no partial-failure model | Fixed: `syncResult?: SyncResult` field added. Per-file status via `SyncedFile` shows partial failures. Caller decides severity. |
| 19 | P0.3 | Uses ad-hoc --git-common-dir spawn, doesn't make getMainWorktreeRoot prerequisite | Fixed: P0.3 core mapping now uses `getMainWorktreeRoot` from `@side-quest/core/git` (P0.0 prerequisite). |
| 20 | P0.4 | status: string with display-ish values is not type-safe | Fixed: `OrphanStatus` typed union: `'pristine' | 'merged' | 'ahead' | 'unknown'`. Display formatting is CLI/TUI layer's job. |
| 21 | P0.4 | `list --include-orphans` omits required list command changes | Fixed: `list.ts` explicitly listed in Files section. Orphan entries append with `type: 'orphan'` discriminant. |
| 22 | P0.5 | CleanResult skip reasons too narrow, orphansDeleted is just string[] | Fixed: `SkipReason` expanded to 5 values. `orphansDeleted` returns full `OrphanBranch[]` objects. |
| 23 | P0.5 | Needs high-risk integration tests | Fixed: Test section lists unit AND integration tests including partial failure, checked-out-elsewhere, rollback scenarios. |
| 24 | P1.1 | formatDuration for timestamps is wrong abstraction | Fixed: Timestamps use `new Date().toISOString()` (built-in). `formatDuration` reserved for duration display in P1.4. |
| 25 | P1.2 | Single cache PID/port file risks cross-repo contention | Fixed: Files now scoped to `~/.cache/side-quest-git/<repo-name>/events.{port,pid}`. |
| 26 | P1.2 | File-locking approach unclear for append-heavy JSONL | Fixed: Single-writer model (only event server writes). `appendToFileSync` without lock. Explicit in operational semantics table. |
| 27 | P1.3 | Section name "Hook Integration" but scope is CLI emitters | Fixed: Renamed to "CLI Event Emission". |
| 28 | P1.3 | No latency-budget/non-blocking tests | Fixed: Test section includes "verify emission adds <5ms to command execution" timer test. |
| 29 | P1.4 | Missing behavior for no gh, unauthenticated gh, rate limits | Fixed: "Graceful degradation" section with explicit behavior for each failure mode. |
| 30 | P1.4 | Parallel gh + git calls need bounded concurrency | Fixed: `concurrency` option (default 4) on `getWorktreeStatus`. Uses `processInParallelChunks`. |
| 31 | P1.5 | TUI output conflicts with "all output JSON" architecture | Fixed: Explicit exception documented. `--watch` requires `isTTY`, refuses on non-terminal. Without `--watch`, output is still JSON. |

### NIT + SHOULD-FIX (remaining) -- all resolved

| # | Section | Finding | Resolution |
|---|---------|---------|-----------|
| 32 | P1.5 | Terminal utility list over-engineered for MVP | Fixed: MVP scope trimmed to `table`, `color`, `isTTY` only. Skip spinner, progressBar, box, truncate until needed. |
| 33 | P1.5 | Coupling with P1.3 in Week 6 is aggressive | Fixed: P1.5 moved to Week 7. P1.3 in Week 6 alone. De-risked. |
| 34 | P2.2 | Scope is mainly plugin/Cortex, not CLI package | Fixed: Ownership moved to plugin plan. CLI provides building blocks only. Cross-reference added. |
| 35 | P2.3 | Tmux naming convention leaks dotfiles concerns into CLI | Fixed: Design question #1 explicitly asks whether CLI or bash owns session naming. |
| 36 | P2.3 | No consumer-contract tests | Fixed: "Consumer contract test" requirement added -- bash test that parses JSON with jq. |
| 37 | Upstream | getMainWorktreeRoot should be prerequisite, not optional | Fixed: Promoted to P0.0 -- ships before all other features. |
| 38 | Upstream | isInsideWorktree is derivable, avoid API bloat | Fixed: Removed from candidates. One-liner inline where needed. |
| 39 | Upstream | getStableRepoName is borderline domain logic | Fixed: Removed from candidates. Inline implementation. |
| 40 | Upstream | appendJsonlSync/readJsonlSync need size/streaming behavior defined | Fixed: Max record size (1MB) and large file behavior documented. |
| 41 | Upstream | fireAndForget silent swallow is risky | Fixed: Requires explicit `onError` policy: `'silent' | 'log' | 'callback'`. No blanket swallow. |
| 42 | Upstream | spawnAndCollectSync is duplicate naming drift | Fixed: Removed from candidates. Use existing `spawnSyncCollect`. |
| 43 | Sequencing | 6 weeks optimistic | Fixed: Extended to 8 weeks with Week 0 for prerequisite and P1.5 separated from P1.3. |
| 44 | Sequencing | Biggest risk is unspecified contracts | Fixed: P2.* reclassified as "Needs design doc". P1.1 is "schema lock" milestone. Contracts defined for P0/P1. |
