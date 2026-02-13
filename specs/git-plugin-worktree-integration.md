# Plan: Git Plugin Worktree Integration

## Task Description

Wire the published `@side-quest/git` v0.1.0 CLI into the `side-quest-plugins/plugins/git` Claude Code plugin. This adds a `/git:worktree` slash command, updates the git-expert WORKTREE.md skill with sync/clean/status operations, integrates event bus forwarding into all 5 lifecycle hooks, fixes the cortex worktree keying bug in session-summary.ts, adds worktree safety patterns to git-safety.ts, and updates the context loader routing table.

## Objective

When complete, Claude Code users with the git plugin installed can:
1. Run `/git:worktree create|list|delete|sync|clean|status` via a dedicated slash command
2. Have all 5 lifecycle hooks emit structured events to the `@side-quest/git` event bus (when running)
3. Share cortex memory across all worktrees of the same repo (keying fix)
4. Be protected from destructive worktree operations (force-remove, .worktrees/ deletion)

## Problem Statement

The `@side-quest/git` v0.1.0 CLI is published with full worktree lifecycle management and event observability, but the Claude Code plugin doesn't use it yet. The plugin has three specific issues:
1. No slash command for worktrees -- users must go through the git-expert skill indirectly
2. Cortex keying bug -- `session-summary.ts` uses `--show-toplevel` which returns the worktree path in linked worktrees, fragmenting session memory
3. No event forwarding -- hooks don't emit events to the event bus, so worktree activity is invisible to observability tooling

## Solution Approach

1. **Slash command + skill updates**: Create `commands/worktree.md` and extend WORKTREE.md with sync, clean, and status operations
2. **Event bus client**: Create `hooks/event-bus-client.ts` with fire-and-forget HTTP POST using `AbortController` (not `withTimeout` -- we need actual request cancellation)
3. **Hook integration**: Add `postEvent()` calls to all 5 hooks with proper `EventEnvelope` shape
4. **Cortex fix**: Replace `getGitRoot()` (uses `--show-toplevel`) with `getMainWorktreeRoot()` from `@side-quest/core/git`
5. **Safety patterns**: Add 2 new regex patterns to `BLOCKED_PATTERNS` array

## Relevant Files

Use these files to complete the task:

**Plugin manifest and registration:**
- `plugins/git/.claude-plugin/plugin.json` -- Plugin manifest. Add `./commands/worktree.md` to commands array
- `plugins/git/hooks/hooks.json` -- Hook registrations. No changes needed (hooks already registered)

**Hook files to modify:**
- `plugins/git/hooks/git-safety.ts` -- Add 2 worktree safety regex patterns to BLOCKED_PATTERNS
- `plugins/git/hooks/git-context-loader.ts` -- Update routing table to include `/git:worktree`
- `plugins/git/hooks/session-summary.ts` -- Replace `getGitRoot()` with `getMainWorktreeRoot()` (cortex keying fix)
- `plugins/git/hooks/command-logger.ts` -- Add event emission via `postEvent()`
- `plugins/git/hooks/auto-commit-on-stop.ts` -- Add event emission via `postEvent()`

**Shared utilities:**
- `plugins/git/hooks/git-status-parser.ts` -- Add `getStableRepoName()` utility using `getMainWorktreeRoot`

**Skill files:**
- `plugins/git/skills/git-expert/WORKTREE.md` -- Add Sync, Clean, Status sections. Update Create section. Update CLI Reference
- `plugins/git/README.md` -- Add `/git:worktree` to slash commands list

**External dependencies (published, not modified):**
- `@side-quest/git` v0.1.0 -- Worktree CLI, event schema (`EventEnvelope`, `createEvent`, `HookEventType`), event server
- `@side-quest/core` -- `getMainWorktreeRoot` from `@side-quest/core/git`, `pathExistsSync` from `@side-quest/core/fs`, `getErrorMessage`/`safeJsonStringify` from `@side-quest/core/utils`, `generateCorrelationId` from `@side-quest/core/instrumentation`

### New Files

- `plugins/git/commands/worktree.md` -- New slash command definition
- `plugins/git/hooks/event-bus-client.ts` -- Fire-and-forget event poster with `AbortController` timeout
- `plugins/git/hooks/git-safety.test.ts` -- Unit tests for new safety patterns
- `plugins/git/hooks/git-status-parser.test.ts` -- Unit tests for `getStableRepoName`
- `plugins/git/hooks/event-bus-client.test.ts` -- Unit tests for `postEvent`

## Implementation Phases

### Phase 1: Foundation (no external deps)

Safety patterns, slash command, and context loader routing. These are purely additive changes with no dependency on published packages.

1. Add 2 worktree safety regex patterns to `git-safety.ts`
2. Create `commands/worktree.md` slash command
3. Register command in `plugin.json`
4. Update routing table in `git-context-loader.ts`
5. Write safety pattern tests (`git-safety.test.ts`)

### Phase 2: Core Integration (depends on @side-quest/core + @side-quest/git)

Event bus client, cortex keying fix, and hook event forwarding.

1. Add `getStableRepoName()` to `git-status-parser.ts` (imports `getMainWorktreeRoot` from `@side-quest/core/git`)
2. Fix cortex keying in `session-summary.ts` (replace `getGitRoot` with `getMainWorktreeRoot`)
3. Create `event-bus-client.ts` with `postEvent()` function
4. Integrate `postEvent()` into all 5 hooks
5. Write tests for `getStableRepoName`, `postEvent`, and cortex keying

### Phase 3: Skill Updates + Documentation

WORKTREE.md skill extensions and README updates.

1. Add Sync, Clean, Status sections to WORKTREE.md
2. Update Create section for `--no-install` default
3. Add observability event table
4. Update CLI Reference
5. Update README.md with `/git:worktree` in slash commands list

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. Use Task and Task* tools only.
- Take note of the session id (agentId) of each team member for resume operations.

### Model Selection Guide

| Role | Model | Rationale |
|------|-------|-----------|
| All builders | sonnet | Executes well-specified tasks reliably |
| All validators | haiku | Mechanical checks: read files, run commands, report PASS/FAIL |

### Team Members

- Builder
  - Name: builder-safety
  - Role: Safety patterns and slash command (Phase 1)
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-event-bus
  - Role: Event bus client and hook integration (Phase 2 core)
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-cortex-fix
  - Role: Cortex keying fix and stable repo name utility (Phase 2)
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-skill-docs
  - Role: WORKTREE.md skill updates and README (Phase 3)
  - Agent Type: general-purpose
  - Model: haiku
  - Resume: true

- Validator
  - Name: validator-phase1
  - Role: Validate Phase 1 changes (safety tests, command registration, routing)
  - Agent Type: general-purpose
  - Model: haiku
  - Resume: true

- Validator
  - Name: validator-phase2
  - Role: Validate Phase 2 changes (event bus, cortex fix, hook integration)
  - Agent Type: general-purpose
  - Model: haiku
  - Resume: true

- Validator
  - Name: validator-final
  - Role: Full validation pass (all tests, biome, tsc, acceptance criteria)
  - Agent Type: general-purpose
  - Model: haiku
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. Add Worktree Safety Patterns
- **Task ID**: safety-patterns
- **Depends On**: none
- **Assigned To**: builder-safety
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (with task 2)
- Add 2 new entries to the `BLOCKED_PATTERNS` array in `plugins/git/hooks/git-safety.ts`:
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
- Create `plugins/git/hooks/git-safety.test.ts` with true/false positive matrix:
  - **True positives**: `git worktree remove foo --force`, `git worktree remove foo -f`, `rm -rf /path/.worktrees/`, `rm -rf .worktrees`, `rm -fr .worktrees/feat-branch`
  - **False positives**: `echo "git worktree remove"`, `rm -rf /tmp/test.worktrees-backup`, `git worktree remove foo` (without force flag), `git worktree list`

### 2. Create Slash Command and Update Routing
- **Task ID**: slash-command
- **Depends On**: none
- **Assigned To**: builder-safety
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (with task 1)
- Create `plugins/git/commands/worktree.md`:
  ```markdown
  ---
  description: Manage git worktrees - create, list, delete, sync, clean, and status
  model: sonnet
  allowed-tools: Bash(bunx @side-quest/git:*), Bash(git worktree:*), Bash(git branch:*), Bash(git status:*), Bash(git rev-parse:*)
  argument-hint: <create|list|delete|sync|clean|status> [branch-name]
  ---

  Use the **git-expert** skill to manage git worktrees. $ARGUMENTS
  ```
- Add `"./commands/worktree.md"` to the `commands` array in `plugins/git/.claude-plugin/plugin.json`
- Update the routing table in `plugins/git/hooks/git-context-loader.ts` `formatAdditionalContext()`:
  - Add row: `| Manage worktrees | /git:worktree (create, list, delete, sync, clean, status) |`
  - Change "Anything else git" row to: `| Anything else git | git-expert skill (history, changelog, compare, review) |`

### 3. Validate Phase 1
- **Task ID**: validate-phase1
- **Depends On**: safety-patterns, slash-command
- **Assigned To**: validator-phase1
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: false
- Run safety pattern tests: `bun test plugins/git/hooks/git-safety.test.ts`
- Verify `plugin.json` has 10 commands (was 9)
- Verify `worktree.md` command file exists and has correct frontmatter
- Verify `git-context-loader.ts` routing table includes worktree row
- Run `bunx biome check plugins/git/` -- verify no format/lint errors
- Check that existing `checkCommand` function still blocks all original patterns

### 4. Add Stable Repo Name Utility
- **Task ID**: stable-repo-name
- **Depends On**: validate-phase1
- **Assigned To**: builder-cortex-fix
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (with task 5)
- Add `getStableRepoName()` to `plugins/git/hooks/git-status-parser.ts`:
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
- Create `plugins/git/hooks/git-status-parser.test.ts`:
  - Test `parsePorcelainStatus` (existing function -- basic regression tests)
  - Test `getStableRepoName` returns basename of main repo root
  - Test `getStableRepoName` returns 'unknown' for non-git directory

### 5. Fix Cortex Worktree Keying
- **Task ID**: cortex-fix
- **Depends On**: validate-phase1
- **Assigned To**: builder-cortex-fix
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (with task 4, same builder does both sequentially)
- In `plugins/git/hooks/session-summary.ts`:
  - Replace local `getGitRoot()` function (lines 168-174, uses `--show-toplevel`) with import:
    ```typescript
    import { getMainWorktreeRoot } from '@side-quest/core/git'
    ```
  - Replace usage at line 236: `const gitRoot = await getGitRoot(input.cwd)` with `const gitRoot = await getMainWorktreeRoot(input.cwd)`
  - Remove the local `getGitRoot` function entirely (it's now unused)
  - Keep `isGitRepo` since it uses `--git-dir` (different purpose)
- Impact: All worktrees now share `~/.claude/cortex/side-quest-plugins.jsonl` instead of fragmenting

### 6. Create Event Bus Client
- **Task ID**: event-bus-client
- **Depends On**: stable-repo-name
- **Assigned To**: builder-event-bus
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false
- Create `plugins/git/hooks/event-bus-client.ts`:
  ```typescript
  import { createEvent, type HookEventType } from '@side-quest/git/events'
  import { getMainWorktreeRoot } from '@side-quest/core/git'
  import { getStableRepoName } from './git-status-parser'
  import { pathExistsSync } from '@side-quest/core/fs'
  import { safeJsonStringify, getErrorMessage } from '@side-quest/core/utils'
  import { generateCorrelationId } from '@side-quest/core/instrumentation'

  const EMISSION_TIMEOUT_MS = 500

  /**
   * Fire-and-forget event emission. Never throws, never blocks beyond timeout.
   *
   * Error policy: errors logged to stderr (diagnosable via claude --debug),
   * but never propagate -- the hook continues.
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

      if (!pathExistsSync(portFile)) return

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
      console.error(`[event-bus] emission failed: ${getErrorMessage(err)}`)
    }
  }
  ```
- Create `plugins/git/hooks/event-bus-client.test.ts`:
  - Test: port file missing returns silently (no throw)
  - Test: invalid port file content (NaN) returns silently
  - Test: successful POST sends correct EventEnvelope shape (mock server)
  - Test: AbortController fires at 500ms when server hangs (mock server that never responds)
  - Test: server error (500 response) logs to stderr but doesn't throw

### 7. Integrate Event Emission into Hooks
- **Task ID**: hook-events
- **Depends On**: event-bus-client, cortex-fix
- **Assigned To**: builder-event-bus
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false
- Add `postEvent()` calls to each hook (import from `./event-bus-client`):

  **git-context-loader.ts** (SessionStart):
  ```typescript
  // After console.log(formatAdditionalContext(...)):
  await postEvent(input.cwd, 'session.started', {
    source: input.source,
    branch: context.branch,
    status: context.status,
  })
  ```

  **git-safety.ts** (PreToolUse -- on deny only):
  ```typescript
  // After console.log(JSON.stringify({ hookSpecificOutput })):
  await postEvent(input.cwd || process.cwd(), 'safety.blocked', {
    tool: input.tool_name,
    reason: hookSpecificOutput.permissionDecisionReason,
  })
  ```

  **command-logger.ts** (PostToolUse):
  ```typescript
  // After appendFile(logPath, ...):
  await postEvent(entry.cwd, 'command.executed', {
    command: entry.command,
    session_id: entry.session_id,
  })
  ```

  **session-summary.ts** (PreCompact):
  ```typescript
  // After console.log(JSON.stringify({ hookSpecificOutput })):
  await postEvent(input.cwd, 'session.compacted', {
    cortexEntries: cortexEntries.length,
    repoName,
  })
  ```

  **auto-commit-on-stop.ts** (Stop):
  ```typescript
  // After printUserNotification(commitMessage):
  await postEvent(input.cwd, 'session.ended', {
    committed: success,
    branch: await getCurrentBranch(input.cwd),
  })
  ```

- Each `postEvent()` call is inside a try/catch to never crash the hook
- Event types match the `HookEventType` union from `@side-quest/git/events`: `session.started`, `safety.blocked`, `command.executed`, `session.compacted`, `session.ended`

### 8. Validate Phase 2
- **Task ID**: validate-phase2
- **Depends On**: hook-events
- **Assigned To**: validator-phase2
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: false
- Run all hook tests: `bun test plugins/git/hooks/`
- Verify `session-summary.ts` no longer contains `--show-toplevel`
- Verify all 5 hooks import and call `postEvent()`
- Verify `event-bus-client.ts` uses `AbortController` (not `withTimeout`)
- Verify event types match `HookEventType` schema: `session.started`, `safety.blocked`, `command.executed`, `session.compacted`, `session.ended`
- Run `bunx biome check plugins/git/` -- no format/lint errors
- Check that each hook's try/catch still exits cleanly on failure (never crash)

### 9. Update WORKTREE.md Skill
- **Task ID**: skill-updates
- **Depends On**: validate-phase2
- **Assigned To**: builder-skill-docs
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: true (with task 10)
- Add three new operation sections to `plugins/git/skills/git-expert/WORKTREE.md` after "Init":

  **Sync section:**
  ```markdown
  ### Sync

  Re-copy config files from the main worktree to an existing worktree:

  1. If no branch specified, run `list` first and ask which worktree to sync
  2. Execute: `bunx @side-quest/git worktree sync <branch-name> [--all] [--dry-run]`
  3. Report which files were updated (the CLI returns per-file detail in `files` array)

  Use when: .env or .claude configs changed in main and need propagating.
  ```

  **Clean section:**
  ```markdown
  ### Clean

  Batch-delete worktrees that are merged and clean:

  1. Preview: `bunx @side-quest/git worktree clean --dry-run`
  2. Show user which worktrees would be removed
  3. Confirm before proceeding
  4. Execute: `bunx @side-quest/git worktree clean [--delete-branches]`

  Safety: Only removes merged+clean worktrees. Never dirty without --force.
  ```

  **Status section:**
  ```markdown
  ### Status

  Show enriched status: `bunx @side-quest/git worktree status [--pr]`

  Displays: Branch, commits ahead/behind, PR status, last activity, dirty/clean.

  **Note:** Requires @side-quest/git v0.1.0+. Falls back to
  `bunx @side-quest/git worktree list` for basic branch/path/dirty info.
  ```

- Update existing **Create** section to reflect `--no-install` default:
  ```markdown
  ### Create (default when branch name provided)

  1. **If no `.worktrees.json` exists**, run the CLI `init` command first and show the user what was auto-detected. Ask if they want to adjust before continuing.
  2. **Suggest a branch name** if the user gave a description instead of a branch name (same logic as before)
  3. **Confirm** the branch name with the user
  4. **Execute**:
     ```bash
     bunx @side-quest/git worktree create <branch-name> --no-fetch --no-install
     ```
  5. The CLI creates the worktree and copies config files. It does NOT install dependencies.
  6. To install dependencies: `bunx @side-quest/git worktree install <path>`
  7. For attach-to-existing (branch already has worktree), the CLI re-syncs files automatically.
  8. **Report** the result: worktree path, files copied, attached status
  ```

- Add **Observability** section:
  ```markdown
  ## Observability

  Events emitted by CLI commands use the `EventEnvelope` schema from `@side-quest/git/events`:

  | Operation | Event Type | Payload Type |
  |-----------|-----------|-------------|
  | create | `worktree.created` | `CreateResult` |
  | delete | `worktree.deleted` | `DeleteResult` |
  | sync | `worktree.synced` | `SyncResult` |
  | clean | `worktree.cleaned` | `CleanResult` |
  | install | `worktree.installed` | `InstallResult` |
  ```

- Update **CLI Reference** to include all commands:
  ```bash
  bunx @side-quest/git worktree create <branch> [--no-install] [--no-fetch] [--attach]
  bunx @side-quest/git worktree list [--all]
  bunx @side-quest/git worktree check <branch>
  bunx @side-quest/git worktree delete <branch> [--force] [--delete-branch]
  bunx @side-quest/git worktree init
  bunx @side-quest/git worktree sync <branch> [--all] [--dry-run]
  bunx @side-quest/git worktree clean [--dry-run] [--delete-branches] [--force]
  bunx @side-quest/git worktree status [--pr]
  bunx @side-quest/git worktree install <path>
  bunx @side-quest/git worktree orphans [--delete]
  ```

### 10. Update README
- **Task ID**: readme-update
- **Depends On**: validate-phase2
- **Assigned To**: builder-skill-docs
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: true (with task 9, same builder does both)
- Add `/git:worktree` to the slash commands list in `plugins/git/README.md`:
  ```markdown
  - `/git:worktree <subcommand>` - Manage git worktrees (create, list, delete, sync, clean, status)
  ```
- Add worktree mention to the git-expert skill section:
  ```markdown
  - "Manage my worktrees" -> Worktree lifecycle management
  ```
- Add note about cortex keying fix if relevant

### 11. Final Validation
- **Task ID**: validate-all
- **Depends On**: skill-updates, readme-update
- **Assigned To**: validator-final
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: false
- Run all tests: `bun test plugins/git/hooks/`
- Run biome: `bunx biome check plugins/git/`
- Verify all acceptance criteria:
  - [ ] `plugin.json` has 10 commands including `./commands/worktree.md`
  - [ ] `commands/worktree.md` exists with correct frontmatter (model: sonnet, allowed-tools list)
  - [ ] `git-context-loader.ts` routing table includes worktree row
  - [ ] `git-safety.ts` has 8 blocked patterns (was 6, added 2)
  - [ ] Safety regex tests pass: true/false positive matrix complete
  - [ ] `git-status-parser.ts` exports `getStableRepoName()` with tests
  - [ ] `session-summary.ts` uses `getMainWorktreeRoot` not `--show-toplevel`
  - [ ] `event-bus-client.ts` exists with `postEvent()` using `AbortController`
  - [ ] All 5 hooks call `postEvent()` with correct event types
  - [ ] `postEvent()` never throws, never blocks beyond 500ms
  - [ ] WORKTREE.md has Sync, Clean, Status sections
  - [ ] WORKTREE.md Create section uses `--no-install --no-fetch`
  - [ ] WORKTREE.md CLI Reference includes all 10 commands
  - [ ] README includes `/git:worktree` in commands list
  - [ ] No `--show-toplevel` usage remains in any hook file (cortex fix verified)

## Acceptance Criteria

1. `plugin.json` registers 10 commands (was 9, added worktree.md)
2. `/git:worktree` command delegates to git-expert skill
3. All 2 new safety regex patterns pass true/false positive matrix
4. `getStableRepoName()` returns consistent name across main and linked worktrees
5. `session-summary.ts` uses `getMainWorktreeRoot` -- cortex files keyed by main repo name
6. `postEvent()` never throws, never blocks beyond 500ms, logs errors to stderr
7. All 5 hooks emit events with correct `HookEventType` values
8. Event envelopes include schemaVersion, correlationId, source='hook', repo, gitRoot
9. WORKTREE.md has Sync, Clean, Status sections with correct CLI commands
10. All tests pass, biome clean, no TypeScript errors

## Validation Commands

- `bun test plugins/git/hooks/` -- run all hook tests
- `bunx biome check plugins/git/` -- lint and format check
- `bunx tsc --noEmit` -- verify no type errors (if tsconfig covers plugin)

## Notes

### Dependencies

- `@side-quest/git` v0.1.0 is published on npm ([release](https://github.com/nathanvale/side-quest-git/releases/tag/v0.1.0))
- `@side-quest/core` must be available with `getMainWorktreeRoot` in `@side-quest/core/git`
- Plugin hooks use `Bun.spawn` for git commands (no dependency on `@side-quest/core/spawn`)
- No `package.json` exists in the plugin directory -- hooks use `import` directly and rely on the monorepo's root dependencies

### Event Types (from @side-quest/git/events)

Hook events use the `HookEventType` union:
- `session.started` -- SessionStart hook
- `safety.blocked` -- PreToolUse deny hook
- `command.executed` -- PostToolUse Bash hook
- `session.compacted` -- PreCompact hook
- `session.ended` -- Stop hook (NOT `session.stopped`)

CLI events use `CliEventType` (emitted by the CLI itself, not hooks):
- `worktree.created`, `worktree.deleted`, `worktree.synced`, `worktree.cleaned`, `worktree.installed`

### Cortex Migration

Old worktree-named cortex files (e.g., `feat-git-worktree.jsonl`) won't auto-merge. This is a known limitation:
- Old entries remain on disk but won't be consulted after the fix
- No auto-migration in v1 -- manual `cat` merge if needed

### Latency Budget

Adding event emission to hooks has a worst case of ~520ms (500ms timeout + 20ms git spawn). Fast path when server isn't running: <5ms (port file existence check only). If total hook execution exceeds 1s in practice, reduce `EMISSION_TIMEOUT_MS` to 200ms.

### Review Findings

This plan incorporates all 31 review findings from the Codex staff engineer review documented in `plugins/git/plans/plugin-integration.md` Section 8. Key resolutions:
- AbortController instead of withTimeout (finding #6)
- Port discovery from cache dir instead of hardcoded port (finding #9)
- session.ended not session.stopped (finding #2)
- Full EventEnvelope fields in code examples (finding #1)
- stderr logging instead of empty catch (finding #17)
- Explicit latency budget (finding #18)
