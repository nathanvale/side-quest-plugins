# PLAN: Git Plugin Worktree Integration

**Date:** 2026-02-11
**Repo:** `side-quest-plugins/plugins/git`
**Depends on:** `@side-quest/git` CLI (P0/P1 features), `@side-quest/core` P0.0 (`getMainWorktreeRoot`)

---

## 1. New `/git:worktree` Slash Command

**Why:** No existing slash command for worktrees. Currently only reachable via git-expert skill routing. A dedicated command is more discoverable.

**Create:** `plugins/git/commands/worktree.md`

```markdown
---
description: Manage git worktrees - create, list, delete, sync, clean, and status
model: sonnet
allowed-tools: Bash(bunx @side-quest/git:*), Bash(git worktree:*), Bash(git branch:*), Bash(git status:*), Bash(git rev-parse:*)
argument-hint: <create|list|delete|sync|clean|status> [branch-name]
---

Use the **git-expert** skill to manage git worktrees. $ARGUMENTS
```

**Feature gating:** The slash command exposes all subcommands in the description, but the WORKTREE.md skill routes to only the subcommands available at the current phase. Subcommands that don't exist yet (e.g., `status` before P1.4 ships) result in a clear message: "The `status` subcommand requires @side-quest/git v0.X.0 or later. Currently available: create, list, delete." This is handled in the skill routing, not the command definition -- the command file stays stable.

**Modify:** `plugins/git/.claude-plugin/plugin.json` - Add `"./commands/worktree.md"` to commands array.

**Modify:** `plugins/git/hooks/git-context-loader.ts` - Update routing table:
```
| Manage worktrees | /git:worktree (create, list, delete, sync, clean, status) |
| Anything else git | git-expert skill (history, changelog, compare, review) |
```

**Modify:** `plugins/git/README.md` - Add to slash commands list.

**Dependencies:** None for the command file itself. Feature gating in WORKTREE.md skill handles CLI availability.

**Sequencing note:** This can ship in Phase 1a. The command delegates to the skill, and the skill handles feature gating. No CLI dependency for the command definition.

---

## 2. WORKTREE.md Skill Updates

**Modify:** `plugins/git/skills/git-expert/WORKTREE.md`

Add three new operation sections after "Init":

### Sync
```markdown
### Sync

Re-copy config files from the main worktree to an existing worktree:

1. If no branch specified, run `list` first and ask which worktree to sync
2. Execute: `bunx @side-quest/git worktree sync <branch-name> [--all] [--dry-run]`
3. Report which files were updated (the CLI returns per-file detail in `files` array)

Use when: .env or .claude configs changed in main and need propagating.
```

### Clean
```markdown
### Clean

Batch-delete worktrees that are merged and clean:

1. Preview: `bunx @side-quest/git worktree clean --dry-run`
2. Show user which worktrees would be removed
3. Confirm before proceeding
4. Execute: `bunx @side-quest/git worktree clean [--delete-branches]`

Safety: Only removes merged+clean worktrees. Never dirty without --force.
```

### Status
```markdown
### Status

Show enriched status: `bunx @side-quest/git worktree status [--pr]`

Displays: Branch, commits ahead/behind, PR status, last activity, dirty/clean.

**Note:** Requires @side-quest/git P1.4 (enhanced status). If not available, fall back to
`bunx @side-quest/git worktree list` which provides basic branch/path/dirty info.
```

### Install guidance update

Update the existing Create section to reflect the install ownership decision:

```markdown
### Create (updated)

Create a new worktree for a branch:

1. Execute: `bunx @side-quest/git worktree create <branch-name> --no-fetch --no-install`
2. The CLI creates the worktree and copies config files. It does NOT install dependencies.
3. If the user's shell uses fnm/nvm, Node version switching happens outside the CLI.
4. To install dependencies: `bunx @side-quest/git worktree install <path>`
5. For attach-to-existing (branch already has worktree), the CLI re-syncs files automatically.

The --no-install flag is the default. Install is a separate step because bash callers
need to switch Node versions between create and install.
```

**Update CLI Reference** to include all new commands.

**Observability section (aligned with EventEnvelope schema):**

Events emitted by CLI commands use the `EventEnvelope` schema from `@side-quest/git/events`. The payload is the command's typed result object:

| Operation | Event Type | Payload type (from @side-quest/git) |
|-----------|-----------|-------------------------------------|
| create | `worktree.created` | `CreateResult` (includes `branch`, `path`, `filesCopied`, `attached`) |
| delete | `worktree.deleted` | `DeleteResult` |
| sync | `worktree.synced` | `SyncResult` (includes `branch`, `filesCopied`, `filesSkipped`, `files[]`) |
| clean | `worktree.cleaned` | `CleanResult` (includes `deleted[]`, `skipped[]`, `orphansDeleted[]`) |
| install | `worktree.installed` | `InstallResult` (includes `status`, `packageManager`, `durationMs`) |

**Note:** These are the typed result objects defined in `@side-quest/git`, not ad-hoc field names. See side-quest-git.md for the full type definitions.

**Dependencies:** @side-quest/git P0 commands for sync/clean. P1.4 for status (with fallback to list).

---

## 3. Hook Event Forwarding

### 3a. Stable repo root utility

**CRITICAL FIX:** Replace local `getStableRepoRoot()` with `getMainWorktreeRoot()` from `@side-quest/core/git` (shipped in P0.0).

**Previous approach (local implementation):** The original plan proposed implementing `getStableRepoRoot()` directly in `git-status-parser.ts` using raw `Bun.spawn`. This creates divergence risk with the `@side-quest/core/git` module.

**Updated approach:** Import `getMainWorktreeRoot` from `@side-quest/core/git` after P0.0 ships. This function uses `git rev-parse --git-common-dir` and handles both relative (`.git`) and absolute paths correctly.

**Modify:** `plugins/git/hooks/git-status-parser.ts` - Add:

```typescript
import { getMainWorktreeRoot } from '@side-quest/core/git'

/**
 * Returns a stable repo name that is consistent across all worktrees.
 * Uses getMainWorktreeRoot (not getGitRoot) to get the real repo root.
 */
export async function getStableRepoName(cwd: string): Promise<string> {
  const root = await getMainWorktreeRoot(cwd)
  return root?.split('/').pop() || 'unknown'
}
```

**Note:** `getStableRepoName` is implemented inline here (not upstreamed) because repo naming policy is domain-specific. See side-quest-git.md "Removed from candidates" for rationale.

**Dependencies:** `@side-quest/core` P0.0 (`getMainWorktreeRoot`). This means Section 3a is NOT Phase 1a -- it ships after P0.0.

### 3b. Event bus client

**Create:** `plugins/git/hooks/event-bus-client.ts`

**Port/server discovery (repo-scoped):**

The event server writes PID/port files to `~/.cache/side-quest-git/<repo-name>/events.{port,pid}` (defined in side-quest-git.md P1.2). The client discovers the server by:

1. Compute repo name: `getStableRepoName(cwd)`
2. Read port file: `~/.cache/side-quest-git/<repo-name>/events.port`
3. If port file missing or stale (PID check), skip emission silently

This replaces the hardcoded `127.0.0.1:7483` and `~/.claude/event-bus.json` config from the original plan. No custom config file needed.

**Event emission with proper envelope:**

```typescript
import { createEvent, type EventEnvelope, type HookEventType } from '@side-quest/git/events'
import { getMainWorktreeRoot } from '@side-quest/core/git'
import { getStableRepoName } from './git-status-parser'
import { withTimeout } from '@side-quest/core/concurrency'
import { pathExistsSync } from '@side-quest/core/fs'
import { safeJsonStringify } from '@side-quest/core/utils'
import { getErrorMessage } from '@side-quest/core/utils'
import { generateCorrelationId } from '@side-quest/core/instrumentation'

const EMISSION_TIMEOUT_MS = 500

/**
 * Fire-and-forget event emission. Never throws, never blocks beyond timeout.
 *
 * Error policy: errors are logged to stderr (not silently swallowed) so hook
 * failures are diagnosable. But they never propagate -- the hook continues.
 */
export async function postEvent(
  cwd: string,
  type: HookEventType,
  data: Record<string, unknown>,
  correlationId?: string,
): Promise<void> {
  try {
    const repoName = await getStableRepoName(cwd)
    const portFile = `${process.env.HOME}/.cache/side-quest-git/${repoName}/events.port`

    if (!pathExistsSync(portFile)) return  // server not running, skip silently

    const port = parseInt(await Bun.file(portFile).text(), 10)
    if (isNaN(port)) return

    const gitRoot = await getMainWorktreeRoot(cwd) || cwd

    const event = createEvent(type, data, {
      repo: repoName,
      gitRoot,
      source: 'hook',
      correlationId: correlationId || generateCorrelationId(),
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), EMISSION_TIMEOUT_MS)

    try {
      await fetch(`http://127.0.0.1:${port}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: safeJsonStringify(event),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (err) {
    // Log to stderr for diagnosability, but never propagate
    console.error(`[event-bus] emission failed: ${getErrorMessage(err)}`)
  }
}
```

**Why `AbortController` instead of `withTimeout`:** The review correctly identified that `withTimeout` is a Promise.race -- it doesn't cancel the underlying `fetch`. Using `AbortController` with `signal` actually cancels the HTTP request, freeing the socket. This is important for hooks running under tight latency budgets.

### 3c. Integration into all 5 hooks

Each hook imports `postEvent` and calls it alongside existing logic:

| Hook | Event Type | When |
|------|-----------|------|
| git-context-loader.ts | `session.started` | Always |
| git-safety.ts | `safety.blocked` | On deny only |
| command-logger.ts | `command.executed` | Always |
| session-summary.ts | `session.compacted` | Always |
| auto-commit-on-stop.ts | `session.ended` | Always |

**Event name fix:** The original plan used `session.stopped` for `auto-commit-on-stop.ts`. The correct name per the EventEnvelope schema (side-quest-git.md P1.1) is `session.ended`.

**Error handling policy:** Each hook call is wrapped in try/catch. On failure:
- Log to stderr: `[event-bus] emission failed: <error message>` (NOT silent swallow)
- Continue hook execution -- never blocks Claude
- This is diagnosable via `claude --debug` or hook logs

**Latency budget:** The 500ms timeout applies to the HTTP POST only. Combined with the ~20ms `getStableRepoName` git spawn, worst case is ~520ms added to hook execution. For hooks already running <100ms, this is the budget. Monitor in practice -- if hooks exceed 1s total, reduce timeout to 200ms.

**Dependencies:**
- `@side-quest/core` P0.0 (`getMainWorktreeRoot`) -- for stable repo name
- `@side-quest/git` P1.1 (event schema) -- for `EventEnvelope`, `createEvent`, type definitions
- `@side-quest/git` P1.2 (event server) -- server must exist to receive events

All three must ship before hook event forwarding can be implemented.

---

## 4. Cortex Worktree Keying Fix

**Confirmed bug:** `session-summary.ts` uses `git rev-parse --show-toplevel` which returns the worktree directory, not the main repo.

```
# From main worktree:
--show-toplevel -> /Users/nathanvale/code/side-quest-plugins
basename -> side-quest-plugins

# From linked worktree:
--show-toplevel -> /Users/nathanvale/code/side-quest-plugins/.worktrees/feat-git-worktree
basename -> feat-git-worktree  <-- WRONG: fragments session memory
```

**Fix:** Replace `getGitRoot()` with `getMainWorktreeRoot()` from `@side-quest/core/git` (P0.0).

**Modify:** `plugins/git/hooks/session-summary.ts`

```typescript
// Before:
import { getGitRoot } from './git-status-parser'  // uses --show-toplevel
const repoRoot = await getGitRoot(input.cwd)

// After:
import { getMainWorktreeRoot } from '@side-quest/core/git'
const repoRoot = await getMainWorktreeRoot(input.cwd)
```

**Impact:** All worktrees now share `~/.claude/cortex/side-quest-plugins.jsonl` instead of fragmenting into separate files per worktree name.

**Cortex migration:** Existing worktree-named Cortex files (e.g., `feat-git-worktree.jsonl`) won't auto-merge. This is documented as a known limitation:
- Old entries remain on disk but won't be consulted after the fix
- No auto-migration script in v1 -- manual `cat` merge if needed
- Add a note in the README explaining the one-time transition

**Dependencies:** `@side-quest/core` P0.0 (`getMainWorktreeRoot`). This fix ships when P0.0 is available, NOT "immediately."

---

## 5. Research Artifact

**Create:** `plugins/git/research/git-worktree-deep-dive-2026-02-11.md`

Structure:
- Competitive landscape (Worktrunk, gwq, ccswarm, ccmanager, gion)
- Architecture decisions (3-layer model, event bus pattern, Cortex keying fix)
- Community research stats (24 X posts, 6,703 likes, overwhelmingly positive sentiment)
- Phased roadmap summary
- Reference links

**Dependencies:** None

---

## 6. git-safety.ts Updates

**Modify:** `plugins/git/hooks/git-safety.ts`

Add two new blocked patterns:

```typescript
{
  pattern: /git\s+worktree\s+remove\s+.*(?:--force|-f)\b/,
  reason: 'Force-removing a worktree can destroy uncommitted work. Use `bunx @side-quest/git worktree delete` which checks status first.',
},
{
  pattern: /rm\s+(?:-rf|-fr)\s+.*[/\\]\.worktrees(?:[/\\]|$)/,
  reason: 'Deleting .worktrees/ directly bypasses git worktree cleanup. Use `bunx @side-quest/git worktree clean` instead.',
},
```

**Pattern improvements from review:**
- First pattern: Added `-f` short flag variant (was only matching `--force`)
- Second pattern: Tightened to require `.worktrees` as a path segment (`/` or `\` boundary or end-of-string), preventing false positives on strings that merely contain `.worktrees` as a substring (e.g., `rm -rf /tmp/test.worktrees-backup`)

**Dependencies:** None (can ship immediately)

---

## 7. Test Strategy

This plan introduces a new command, hook behavior changes, and cross-process networking. All need explicit test coverage.

### Unit tests

| Component | Test file | What to test |
|-----------|----------|-------------|
| Safety regex patterns | `git-safety.test.ts` | True positive matrix: `git worktree remove foo --force`, `git worktree remove foo -f`, `rm -rf /path/.worktrees/`, `rm -rf .worktrees`. False positive matrix: `echo "git worktree remove"`, `rm -rf /tmp/test.worktrees-backup`, `git worktree remove foo` (without force). |
| `getStableRepoName` | `git-status-parser.test.ts` | Main worktree returns basename. Linked worktree returns main repo basename. Non-git dir returns 'unknown'. |
| `postEvent` | `event-bus-client.test.ts` | Events arrive with correct `EventEnvelope` shape (schemaVersion, correlationId, source='hook'). Server down returns silently (stderr log, no throw). Port file missing skips silently. Timeout at 500ms actually aborts. |

### Integration tests

| Scenario | What to verify |
|----------|---------------|
| Hook latency under server-down | `postEvent` with no running server completes in <50ms (port file check + early return). No 500ms wait when PID file is missing. |
| Hook latency under server timeout | Mock server that never responds. Verify `postEvent` completes in ~500ms (not hanging). |
| Event envelope contract | Start real event server, emit from hook, query `GET /events`, verify envelope matches `EventEnvelope` type exactly. |
| Cortex keying in worktree | Create linked worktree, run `session-summary.ts` hook, verify Cortex file is named after main repo (not worktree). |
| Slash command routing | Run `/git:worktree list` via Claude, verify it routes through git-expert skill and returns JSON output. |

### Acceptance criteria

- [ ] All safety regex patterns pass true/false positive matrix
- [ ] `postEvent` never throws, never hangs beyond 500ms
- [ ] Hook total execution time stays under 1s (measured)
- [ ] Cortex files use stable repo name across all worktrees
- [ ] Event envelope includes schemaVersion, correlationId, source, timestamp
- [ ] Slash command works for available subcommands, shows clear message for unavailable ones

---

## Dependency Map & Sequencing

```
Phase 1a (after P0.0 ships -- NOT "immediately"):
  1. Cortex keying fix (session-summary.ts -- needs getMainWorktreeRoot from P0.0)
  2. Safety hook patterns (git-safety.ts -- truly no deps, can ship now)
  3. Slash command definition (commands/worktree.md + plugin.json -- no deps)
  4. Context loader routing update (git-context-loader.ts -- no deps)
  5. README update

Phase 1b (depends on @side-quest/git CLI -- staggered, not one block):
  Phase 1b.1 (after P0.2 + P0.5 ship):
    6. WORKTREE.md skill updates for sync/clean (needs sync, clean to exist)
  Phase 1b.2 (after P1.1 schema lock):
    7. Event bus client (needs EventEnvelope types)
  Phase 1b.3 (after P1.2 event server ships):
    8. Hook event forwarding (needs event server running + client from 1b.2)
  Phase 1b.4 (after P1.4 status ships):
    9. WORKTREE.md status section update (until then, falls back to list)

Phase 1c (documentation):
  10. Research artifact
```

**Key changes from previous sequencing:**
- Phase 1a items 1 and 4 depend on P0.0 (`getMainWorktreeRoot`). Only items 2, 3, 5 are truly immediate.
- Phase 1b is split into 4 sub-phases with different readiness gates, not one monolithic block.
- Event forwarding (1b.3) explicitly waits for schema lock (P1.1) before any hook produces events. This honors the "no producers before schema review" rule from the updated roadmap.
- Status skill update (1b.4) is separate from sync/clean updates (1b.1) because they have different CLI dependencies.

---

## @side-quest/core Utility Mapping

The plugin hooks and utilities should leverage `@side-quest/core` wherever possible for consistent patterns across the SideQuest ecosystem.

**Dependency declaration:** The plugin must add `@side-quest/core` as a dependency. Currently `plugins/git/package.json` does not declare this. Add:

```json
{
  "dependencies": {
    "@side-quest/core": "^0.X.0"
  }
}
```

The exact version depends on when P0.0 ships. The dependency is on the published package, not a local path.

### 3a. Stable repo root utility

| Need | Core utility | Import | Notes |
|------|-------------|--------|-------|
| Get real repo root (not worktree path) | `getMainWorktreeRoot` | `@side-quest/core/git` | P0.0 prerequisite. Replaces local `getStableRepoRoot`. |
| Assert git repo before operations | `assertGitRepo` | `@side-quest/core/git` | Use at function entry |

**Note:** `getMainWorktreeRoot(cwd)` takes an explicit `cwd` parameter -- it does NOT use `process.cwd()`. This was flagged in the review: the current `getGitRoot()` in core is process-cwd based, but `getMainWorktreeRoot` (P0.0) accepts a cwd parameter.

### 3b. Event Bus Client (`event-bus-client.ts`)

| Need | Core utility | Import | Notes |
|------|-------------|--------|-------|
| HTTP abort timeout | `AbortController` | Built-in | NOT `withTimeout` -- we need actual request cancellation, not just promise race |
| Read port file | `Bun.file().text()` | Built-in | Simple file read, no config validation needed |
| Check if port file exists | `pathExistsSync` | `@side-quest/core/fs` | |
| Generate correlation ID | `generateCorrelationId` | `@side-quest/core/instrumentation` | |
| Categorize POST errors | `categorizeError` | `@side-quest/core/instrumentation` | For stderr logging |
| Safe JSON stringify for payload | `safeJsonStringify` | `@side-quest/core/utils` | |
| Extract error messages | `getErrorMessage` | `@side-quest/core/utils` | For stderr logging |

**Removed from mapping:**
- `validateConfigPath` -- no longer reading `~/.claude/event-bus.json`. Port discovery uses cache dir.
- `readJsonFileOrDefault` -- no config file to read.
- `expandTilde` -- not needed, using `process.env.HOME` directly.
- `withTimeout` -- replaced with `AbortController` for actual request cancellation.

### 3c. Hook Integration (all 5 hooks)

| Need | Core utility | Import |
|------|-------------|--------|
| Check PID file for server liveness | `pathExistsSync` | `@side-quest/core/fs` |
| Error extraction from catch | `getErrorMessage` | `@side-quest/core/utils` |

### Section 4. Cortex Keying Fix (`session-summary.ts`)

| Need | Core utility | Import |
|------|-------------|--------|
| Get real repo root | `getMainWorktreeRoot` | `@side-quest/core/git` |

### Section 6. Safety Hook (`git-safety.ts`)

No core utilities needed. The new patterns are static regex literals added to an existing array. `isRegexSafe` and `SHELL_METACHARACTERS` are unnecessary for static patterns that are defined at compile time -- they're for validating user-supplied patterns.

---

## Upstream Contributions to @side-quest/core

### Candidates (aligned with side-quest-git.md)

| Utility | Target module | Status | Notes |
|---------|--------------|--------|-------|
| `getMainWorktreeRoot(cwd)` | `@side-quest/core/git` | **PREREQUISITE (P0.0)** | Ships to core first. This plan depends on it. |
| `appendJsonlSync(filePath, record)` | `@side-quest/core/fs` | Candidate | Needed by event bus JSONL persistence. Max record size 1MB, throw on write failure. |
| `readJsonlSync<T>(filePath)` | `@side-quest/core/fs` | Candidate | Needed by event bus query replay. Skip malformed lines with warning. |
| `fireAndForget(fn, timeoutMs, opts)` | `@side-quest/core/concurrency` | Candidate | Explicit error policy required: `opts.onError: 'silent' \| 'log' \| 'callback'`. No blanket swallow. |

### Removed from candidates (per side-quest-git.md review)

| Utility | Reason |
|---------|--------|
| `isInsideWorktree(cwd)` | Derivable from `getMainWorktreeRoot(cwd) !== getGitRoot(cwd)`. One-liner, not worth core API surface. |
| `getStableRepoName(cwd)` | Naming policy (basename of root) is domain-specific. Different packages may want different naming. Implement inline. |

**Process:** Implement locally in `plugins/git/hooks/` first -> prove stability -> PR to `@side-quest/core` -> swap imports -> bump core dependency.

---

## Potential Challenges

1. **Hook latency budget:** Adding event emission to hooks. Worst case: 500ms timeout + 20ms git spawn = 520ms. Mitigation: check PID file first (fast path: <5ms when server isn't running). Monitor total hook execution time. If >1s, reduce timeout to 200ms.
2. **`AbortController` vs `withTimeout`:** Review identified that `withTimeout` is Promise.race only -- doesn't cancel the underlying fetch. Using `AbortController` with `signal` parameter on `fetch()` to actually cancel the HTTP request and free the socket.
3. **`resolve()` with relative `.git`:** From main worktree, `--git-common-dir` returns `.git` (relative). `resolve(cwd, '.git')` correctly resolves. From linked worktrees, returns absolute. Both cases handled by `getMainWorktreeRoot` in core.
4. **Event bus not running:** Check PID file before attempting POST. If missing, skip silently (<5ms). If present but server unreachable, timeout at 500ms with stderr log.
5. **Cortex migration:** Old worktree-named entries in `~/.claude/cortex/` won't merge. Documented as known limitation. No auto-migration in v1.
6. **`@side-quest/core` dependency resolution:** Plugin must declare `@side-quest/core` as a dependency in `package.json`. Currently undeclared. This is a one-time setup step.
7. **Error observability:** Empty catch blocks replaced with stderr logging. Failures are diagnosable via `claude --debug` or hook log inspection, but never propagate to block Claude.

---

## 8. Review Findings Addressed

This plan was reviewed by a staff engineer (Codex). Here's the resolution status of all findings:

### BLOCKING (8) -- all resolved

| # | Section | Finding | Resolution |
|---|---------|---------|-----------|
| 1 | 3c | Hook event envelope fields missing -- developers can't implement schema-valid producer | Fixed: Section 3b now shows full `createEvent()` call with `EventEnvelope` from `@side-quest/git/events`. All envelope fields (schemaVersion, correlationId, source, repo, gitRoot) are explicit in the code example. |
| 2 | 3c | Event name mismatch: `session.stopped` vs `session.ended` | Fixed: Changed to `session.ended` to match EventEnvelope schema in side-quest-git.md P1.1. |
| 3 | 3c | Dependencies missing P1.1 (only declared P1.2) | Fixed: Section 3c dependencies now list all three: P0.0 (getMainWorktreeRoot), P1.1 (event schema), P1.2 (event server). |
| 4 | 7 | No executable test strategy defined | Fixed: New Section 7 with unit test matrix, integration tests, and acceptance criteria. |
| 5 | 7 | No schema contract tests for hook-produced events | Fixed: Section 7 integration tests include "Event envelope contract" test that verifies against `EventEnvelope` type. |
| 6 | 3b | `withTimeout` is Promise.race only, doesn't cancel fetch | Fixed: Replaced `withTimeout` with `AbortController` + `signal` on `fetch()`. Explicit in code example and core mapping. |
| 7 | 3b | `validateConfigPath` incompatible with `~/.claude/` paths | Fixed: Removed `validateConfigPath` from mapping. Port discovery now uses `~/.cache/side-quest-git/<repo>/events.port` (no config file). |
| 8 | Seq | Phase 1a "ship immediately" doesn't hold with 8-week gating | Fixed: Phase 1a items 1 and 4 now depend on P0.0. Only safety patterns, slash command def, and README are truly immediate. Phase 1b split into 4 sub-phases with explicit readiness gates. |

### SHOULD-FIX (18) -- all resolved

| # | Section | Finding | Resolution |
|---|---------|---------|-----------|
| 9 | 3b | Event transport discovery incomplete -- hardcoded port, no repo scoping | Fixed: Port discovery reads `~/.cache/side-quest-git/<repo-name>/events.port`. Replaces hardcoded 127.0.0.1:7483 and ~/.claude/event-bus.json. |
| 10 | 1 | Slash command exposes subcommands not available at all phases | Fixed: Feature gating added -- skill routes to available commands, shows clear message for unavailable ones. |
| 11 | 2 | WORKTREE skill updates don't address install ownership | Fixed: "Create (updated)" section added with --no-install default and separate `worktree install` step. |
| 12 | 2 | Status dependency is P1.4, not P0 | Fixed: Status section notes P1.4 requirement with fallback to `list`. Dependencies updated. |
| 13 | 3a/4 | Re-implements repo-root logic locally instead of using P0.0 | Fixed: Local `getStableRepoRoot()` replaced with `getMainWorktreeRoot()` from `@side-quest/core/git`. |
| 14 | 2 | Observability payload examples conflict with typed result objects | Fixed: Observability table now references typed result objects (`CreateResult`, `SyncResult`, etc.) not ad-hoc field names. |
| 15 | Seq | Phase 1a Cortex fix marked immediate but depends on P0.0 | Fixed: Cortex fix moved after P0.0. Only items 2, 3, 5 are truly immediate. |
| 16 | 2 | Install ownership not reflected in skill guidance | Fixed: Create section updated with --no-install default and install handoff. |
| 17 | 3c | Empty catch everywhere creates observability blind spots | Fixed: stderr logging replaces empty catch. Failures diagnosable via `claude --debug`. |
| 18 | 3c | 500ms timeout without explicit latency budget at plugin level | Fixed: Latency budget documented (520ms worst case). PID file check fast path (<5ms). Monitoring guidance. |
| 19 | 6 | Safety regexes brittle -- missing -f variant, broad .worktrees matching | Fixed: First pattern adds `-f` variant. Second pattern tightened with path boundary. |
| 20 | 7 | No hook latency tests | Fixed: Section 7 includes "Hook latency under server-down" and "Hook latency under server timeout" integration tests. |
| 21 | 7 | No regex behavior tests | Fixed: Section 7 includes true/false positive matrix for safety patterns. |
| 22 | Core | `getGitRoot` mapping misleading -- no cwd parameter | Fixed: Note added that `getMainWorktreeRoot(cwd)` takes explicit cwd (unlike process-cwd-based `getGitRoot`). |
| 23 | Core | No declared `@side-quest/core` dependency in package.json | Fixed: Explicit dependency declaration added to core mapping section. |
| 24 | Upstream | `isInsideWorktree` proposed here but removed in side-quest-git.md | Fixed: Removed from candidates. Aligned with side-quest-git.md. |
| 25 | Upstream | `getStableRepoName` proposed here but flagged as domain logic | Fixed: Removed from candidates. Implemented inline. |
| 26 | Upstream | `fireAndForget` proposal lacks error policy | Fixed: Updated to require explicit `onError` option. Aligned with side-quest-git.md. |

### NIT (3) -- all resolved

| # | Section | Finding | Resolution |
|---|---------|---------|-----------|
| 27 | Upstream | Candidate set drift across plans | Fixed: All three plans now share the same 4 candidates with same status/notes. Removed 3 that were inconsistent. |
| 28 | 4 | Cortex migration not operationalized | Fixed: Documented as known limitation with manual merge option. README note added. No auto-migration in v1. |
| 29 | 6 | `isRegexSafe`/`SHELL_METACHARACTERS` unnecessary for static regex literals | Fixed: Removed from core mapping. Static patterns don't need runtime validation. |
| 30 | Seq | Phase 1b bundles items with different readiness gates | Fixed: Split into 4 sub-phases (1b.1 through 1b.4) with explicit CLI dependencies. |
| 31 | Seq | Plan doesn't honor "no producers before schema review" rule | Fixed: Phase 1b.3 (hook event forwarding) explicitly waits for P1.1 schema lock. |
