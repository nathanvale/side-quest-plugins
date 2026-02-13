# Plan: Dotfiles Tmux Worktree Migration

## Task Description
Migrate the tmux worktree bash scripts (`worktree-ai.sh` ~770 lines, `worktree-delete.sh`) in `~/code/dotfiles` from raw git commands to thin wrappers around `bunx @side-quest/git worktree <command>`. The bash scripts keep ownership of fzf pickers, tmux session management, node version switching, and interactive UX. All git worktree operations move to the TypeScript CLI.

This is a two-repo effort:
1. **@side-quest/git** (upstream CLI) - Close feature gaps that the bash scripts depend on
2. **~/code/dotfiles** (downstream consumer) - Add `USE_SIDEQUEST` toggle, sidequest wrappers, validation, cutover, cleanup

## Objective
When complete:
- `worktree-ai.sh` drops from ~770 to ~200 lines (fzf + tmux only) -- note: line count increases during dual-mode phase, reduction only after native cleanup
- `worktree-delete.sh` drops similarly (fzf + tmux + jq parsing) -- same caveat
- All git worktree logic is in TypeScript with tests and JSON contracts
- Bash scripts consume CLI JSON output via `jq`
- Rollback is instant via `USE_SIDEQUEST=0`

## Problem Statement
The bash worktree scripts are 770+ lines of untestable shell code handling complex git operations (branch detection, file copying, package manager detection, install, batch delete). These same operations are now implemented (or planned) in `@side-quest/git` with tests, type safety, and structured JSON output. The migration eliminates duplication and makes the worktree engine testable.

## Solution Approach
A 2-phase migration with env toggle rollback:
1. **Phase 1 (Implement + Smoke Test)**: Close upstream gaps, add `USE_SIDEQUEST` env var with wrappers behind it, run smoke tests (create -> install -> delete in temp repo). Native code stays intact.
2. **Phase 2 (Cutover + Rollback Window)**: Flip default to `USE_SIDEQUEST=1`. Monitor for 1-2 days with instant `USE_SIDEQUEST=0` rollback available. After confidence period, remove native code paths in a separate cleanup plan.

**Why 2 phases, not 4:** This is personal dotfiles, not a multi-tenant service. A week-long read-only validation phase and separate cutover monitoring are overkill. Smoke tests plus a short rollback window are sufficient.

## Relevant Files

### @side-quest/git (upstream - gaps to close)
- `src/worktree/create.ts` - Missing `--base` flag for explicit base branch
- `src/worktree/list.ts` - Missing `commitsAhead` and `status` fields
- `src/worktree/delete.ts` (`checkBeforeDelete`) - Missing `commitsAhead` and `status` fields
- `src/worktree/cli.ts` - CLI entrypoint, needs `--base` flag wiring and `worktree install` subcommand
- `src/worktree/types.ts` - Type definitions need `commitsAhead`, `status` fields (additive-only, backward-compatible)
- `src/worktree/detect-pm.ts` - Already has split functions (confirmed)
- `src/worktree/install.ts` - Already exists (confirmed), needs CLI subcommand exposure
- `src/worktree/sync.ts` - Already exists (confirmed)
- `src/worktree/orphans.ts` - Already exists (confirmed)
- `src/worktree/clean.ts` - Already exists (confirmed)
- `src/worktree/status.ts` - Has `commitsAhead` already, needs to feed into `list` and `check`

### ~/code/dotfiles (downstream - scripts to refactor)
- `bin/tmux/worktree-ai.sh` - Main create flow (~770 lines)
- `bin/tmux/worktree-delete.sh` - Delete/clean flow
- `.tmux.conf` - Keybindings (no changes needed)

### Reference
- `plugins/git/plans/dotfiles-migration.md` - Source migration plan with review findings
- `plugins/git/plans/side-quest-git.md` - CLI roadmap (P0/P1/P2)

### New Files
- `~/code/dotfiles/bin/tmux/sidequest-common.sh` - Shared toggle, preflight, version check, and helper functions (sourced by both scripts with fail-open)
- `~/code/dotfiles/bin/tmux/test-migration.sh` - Focused smoke test (create -> install -> delete + cross-mode check)

## Implementation Phases

### Phase 1: Implement Behind Flag

#### 1a: Close Upstream Gaps (in @side-quest/git)

Before the bash scripts can consume the CLI, these 3 gaps must be closed:

**Gap 1: `--base` flag on create**
- `create.ts` currently auto-detects base branch
- Bash's fzf picker lets users select a specific base branch
- Add `base?: string` option to `createWorktree()`, wire to CLI as `--base`

**Gap 2: `commitsAhead` and `status` in list/check output**
- `list.ts` returns `{ branch, path, head, dirty, merged, isMain }` - no commits ahead
- `status.ts` has this data via `getWorktreeStatus()` but it's not in list output
- Bash needs `commitsAhead: number` for logic and display text for pickers
- Enrich `WorktreeInfo` in `list.ts` and `DeleteCheck` in `delete.ts` with these fields
- **Status string contract**: `status` is a convenience display field only, NOT a control/safety field. Bash wrappers should derive their own display text from `dirty`, `merged`, and `commitsAhead` (the typed source-of-truth fields) rather than coupling to exact status string formatting. The `status` field is for human consumption in `--json` output.
- **IMPORTANT: Use lightweight `git rev-list --count <base>..<branch>` directly, NOT `getWorktreeStatus()`.**
  `getWorktreeStatus()` spawns multiple git processes per worktree (rev-list, last commit, optional PR lookup).
  For picker UX on repos with 10+ worktrees, full status enrichment would be 30-50+ git calls.
  Reserve full `getWorktreeStatus()` for the `status --pr` command only.

**Gap 3: `worktree install` CLI subcommand** (hard blocker)
- `install.ts` exists but is not exposed as a standalone CLI subcommand
- Downstream bash scripts depend on `$SIDEQUEST_GIT_CMD worktree install "$worktree_path"` in the 3-step install sequence
- Wire `worktree install <path>` in `cli.ts` that calls `shouldRunInstall()` + `runInstall()`
- Return JSON: `{ "installed": boolean, "command": string | null, "skipped": boolean }`
- Without this subcommand the install sequence cannot function

#### 1b: Bash Script Wrappers (in ~/code/dotfiles)

Add `USE_SIDEQUEST` toggle and sidequest wrapper functions to both scripts. Native code stays intact.

**Shared helper: `sidequest-common.sh`** (sourced by both scripts)
- Centralizes toggle, preflight, and CLI command resolution so the two scripts can't drift
- **Configuration reference** (printed by `sidequest_preflight` on first run, also as header comment in the file):
  ```
  # Configuration (all env vars, set in .bashrc/.zshrc or inline):
  #   USE_SIDEQUEST=0|1       - Toggle CLI mode (default: 0 = native)
  #   SIDEQUEST_GIT_CMD=...   - CLI command override (default: bunx @side-quest/git@0.2.0)
  #   SIDEQUEST_LOG=~/.cache/sidequest-worktree.log  - Operation log path
  ```
- `SIDEQUEST_GIT_CMD="${SIDEQUEST_GIT_CMD:-bunx @side-quest/git}"` -- allows local dev override (e.g., `SIDEQUEST_GIT_CMD="bun run /path/to/local/cli.ts"`)
- `USE_SIDEQUEST="${USE_SIDEQUEST:-0}"` toggle
- Preflight: `command -v bunx` auto-disables sidequest mode (non-fatal); `command -v jq` hard-fails **only when sidequest mode is active** (not always)
- **Runtime version/capability check**: `timeout 5 $SIDEQUEST_GIT_CMD --version` must return >= minimum required version within 5 seconds. If version check fails, times out, or `bunx` can't reach registry, auto-fallback to native with clear message to stderr: `"[worktree] CLI version check failed (timeout/error), using native mode"`.
- **Mode behavior under failure**: `USE_SIDEQUEST` accepts `0` or `1` only. Any other value (empty, typo) is treated as `0` (native). When CLI returns non-zero, wrappers parse `{"error":"..."}` from stderr and display: short summary, command attempted, and recovery command. Raw JSON is never shown to the user in popup context.
- `node -v` guard before install step to verify version switch was effective
- Pin version during migration: `SIDEQUEST_GIT_CMD="${SIDEQUEST_GIT_CMD:-bunx @side-quest/git@0.2.0}"` (update version as gaps are published)
- **Defensive sourcing**: Each script must source with fail-open behavior using `BASH_SOURCE` (not `$0`, which can be `-bash` in tmux popup login shells):
  ```bash
  COMMON="$(dirname "${BASH_SOURCE[0]}")/sidequest-common.sh"
  if [[ -f "$COMMON" ]]; then
    source "$COMMON" || { USE_SIDEQUEST=0; echo "[worktree] sidequest-common.sh failed to source, falling back to native" >&2; }
  else
    USE_SIDEQUEST=0
  fi
  ```
  This prevents hard failures if the helper is missing, has syntax errors, or has incompatible function signatures.

Key design decisions:
- Install sequence: `create --no-install` -> `switch_node_version` (bash) -> verify `node -v` -> `worktree install` (CLI)
- Stderr capture: `2>"$stderr_file"` not `2>&1` (keeps streams separate)
- **Wrapper error format**: When CLI returns non-zero, wrappers extract `error` from stderr JSON and display a human-readable message:
  ```
  [worktree] create failed: <error message>
  [worktree] command: bunx @side-quest/git worktree create feat/x --no-install --json
  [worktree] recovery: git worktree remove --force /path/to/.worktrees/feat-x
  [worktree] log: ~/.cache/sidequest-worktree.log
  ```
  Never pass raw JSON through to the user in popup context.
- Error recovery: targeted `git worktree remove --force "$worktree_path"` on create failure. If remove fails (stale admin entry), fallback to `git worktree prune --expire now` and verify entry gone via `git worktree list --porcelain`. Reserve broad `prune` for this fallback only, not as primary cleanup.
- Rollback on partial failure: if create succeeds but install fails, keep the worktree and open tmux session (user can retry install manually or fall back to native). Print recovery command to stderr AND persist to `~/.cache/sidequest-worktree-last-error.txt` (survives popup close).
- **Operation log**: Append one line per CLI call to `${SIDEQUEST_LOG:-~/.cache/sidequest-worktree.log}` with format: `timestamp mode(cli/native) command branch/path exit_code [error_summary]`. Enables 3am debugging without reproducing the issue.
- **Create pipeline state handling**: The 4-step sequence (create -> switch_node -> verify -> install) is non-atomic. If interrupted mid-sequence, state is ambiguous. Each step should be idempotent or safely re-runnable:
  - `create --no-install`: **must check if worktree already exists at path BEFORE calling `git worktree add`** (git fails hard if path exists). Use `git worktree list --porcelain | grep "worktree $path"` or check if path is already a worktree. If exists, skip creation and proceed to install.
  - `switch_node_version`: always safe to re-run
  - `node -v` check: read-only
  - `worktree install`: if `node_modules` exists, skip or re-run (package managers handle this)
- `--json` flag explicitly on all CLI calls (don't rely on default output format)
- **Path normalization**: Use `realpath` when comparing paths between native and CLI output. Native may use relative `.worktrees/...` while CLI may emit absolute/canonical paths.

**Cross-mode compatibility matrix** (must hold during dual-mode phase):

| Scenario | Must work? | Notes |
|----------|-----------|-------|
| Native create -> CLI list/delete | Yes | CLI must read standard git worktree metadata |
| CLI create -> Native list/delete | Yes | CLI must produce standard branch names, directory layout, git metadata |
| Mixed lifecycle (some ops CLI, some native) | Yes | Both use same underlying `git worktree` commands |

`USE_SIDEQUEST=0` is only safe if CLI-created worktrees are indistinguishable from native-created ones at the git level. The CLI wraps the same git commands, so this should hold, but smoke tests must verify the matrix above.

**Batch delete error semantics**: When deleting multiple worktrees, continue through all selections, collect per-item failures, print summary, exit non-zero if any failed. Do not abort on first failure.

#### 1c: Smoke Tests (in ~/code/dotfiles)

- `test-migration.sh` runs a focused smoke test: create -> install -> delete in a temp repo
- Catches shell quoting, path, env, and JSON parsing integration bugs
- Not a full lifecycle harness -- upstream TS tests cover logic; this covers bash integration

### Phase 2: Cutover + Rollback Window

- Flip `USE_SIDEQUEST` default to 1 in `sidequest-common.sh`
- Monitor for 1-2 days with `USE_SIDEQUEST=0` available as instant rollback
- After confidence period, native code cleanup is a separate plan

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. Use Task and Task* tools only.
- Take note of the session id (agentId) of each team member for resume operations.

### Model Selection Guide

| Role | Model | Rationale |
|------|-------|-----------|
| All builders | sonnet | Executes well-specified tasks reliably |
| All validators | haiku | Mechanical checks: read files, run commands, report PASS/FAIL |

### Team Members (3 streams)

- Builder
  - Name: builder-upstream
  - Role: Close 3 feature gaps in @side-quest/git (create --base, list enrichment, install subcommand) + validate
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-bash
  - Role: Create sidequest-common.sh, add USE_SIDEQUEST toggle and sidequest wrappers to both scripts, create smoke test script
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-final
  - Role: Full end-to-end validation of both repos (types, tests, lint, syntax, contracts, cross-mode compatibility)
  - Agent Type: general-purpose
  - Model: haiku
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. Add --base flag to worktree create
- **Task ID**: upstream-create-base
- **Depends On**: none
- **Assigned To**: builder-upstream
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false
- In `/Users/nathanvale/code/side-quest-git/src/worktree/create.ts`:
  - Add `base?: string` to `CreateOptions` interface
  - If `base` is provided, skip auto-detection and use `git worktree add -b <branch> <path> <base>` directly
  - If `base` is provided but doesn't exist as a ref, return clear error
- In `src/worktree/cli.ts`: Wire `--base` flag to `createWorktree()` options
- In `src/worktree/create.test.ts`: Add tests for explicit base branch

### 2. Enrich list and check output with commitsAhead/status
- **Task ID**: upstream-enrich-list-check
- **Depends On**: none
- **Assigned To**: builder-upstream
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (with task 1)
- In `src/worktree/types.ts`:
  - Add `commitsAhead?: number` and `status?: string` to `WorktreeInfo` (optional -- backward-compatible, existing consumers unaffected)
  - Add `commitsAhead?: number` and `status?: string` to `DeleteCheck` (optional -- backward-compatible)
- In `src/worktree/list.ts`:
  - **Use lightweight `git rev-list --count <mainBranch>..<branch>` directly per worktree**
  - Do NOT use `getWorktreeStatus()` -- it spawns multiple git processes per worktree (rev-list + last commit + optional PR lookup) and would cause 30-50+ git calls on repos with 10+ worktrees
  - Compute `status` string: "pristine" (0 ahead, clean, not merged to main), "merged" (merged), "N ahead" (N > 0), "unknown" (error)
- In `src/worktree/delete.ts` (`checkBeforeDelete`):
  - Add same lightweight enrichment to `DeleteCheck` output
- In existing tests: Update assertions for new fields

### 3. Expose worktree install as CLI subcommand
- **Task ID**: upstream-install-subcommand
- **Depends On**: none
- **Assigned To**: builder-upstream
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (with tasks 1, 2)
- In `src/worktree/cli.ts`:
  - Add `worktree install <path> [--json]` subcommand
  - Calls `shouldRunInstall(path)` to check if install is needed
  - If needed, calls `detectInstallCommand(path)` + spawns install
  - JSON output: `{ "installed": boolean, "command": string | null, "skipped": boolean, "reason": string }`
- In `src/worktree/install.test.ts`: Add tests for CLI subcommand
- **This is a hard blocker** -- the 3-step install sequence depends on this subcommand existing

### 4. Validate upstream changes
- **Task ID**: validate-upstream
- **Depends On**: upstream-create-base, upstream-enrich-list-check, upstream-install-subcommand
- **Assigned To**: builder-upstream (self-validates after all gaps closed)
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false
- In `/Users/nathanvale/code/side-quest-git/`:
  - Run `bunx tsc --noEmit` - verify no type errors
  - Run `bun test` - verify all tests pass
  - Run `bunx biome ci .` - verify lint/format
  - Verify `create --base` flag appears in CLI help
  - Verify `install <path>` subcommand exists in CLI help
  - Verify `list` output includes `commitsAhead` and `status` fields
  - Verify `check` output includes `commitsAhead` and `status` fields
  - Verify new type fields are optional (backward-compatible)
  - Report PASS/FAIL for each check

### 5. Create shared helper (sidequest-common.sh)
- **Task ID**: bash-common-helper
- **Depends On**: validate-upstream
- **Assigned To**: builder-bash
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false
- Create `~/code/dotfiles/bin/tmux/sidequest-common.sh`:
  - Header comment with configuration reference (all env vars, defaults, log path)
  - `SIDEQUEST_GIT_CMD="${SIDEQUEST_GIT_CMD:-bunx @side-quest/git@0.2.0}"` (pinned version, overridable for local dev)
  - `USE_SIDEQUEST="${USE_SIDEQUEST:-0}"` toggle (only `0` or `1` valid; any other value treated as `0`)
  - `SIDEQUEST_LOG="${SIDEQUEST_LOG:-$HOME/.cache/sidequest-worktree.log}"` log path
  - `sidequest_preflight()` function: auto-disable if `bunx` not on PATH; hard-fail on missing `jq` only when sidequest active; runtime version check (`timeout 5 $SIDEQUEST_GIT_CMD --version` >= minimum) with auto-fallback to native on failure; print mode banner once: `"[worktree] mode: cli"` or `"[worktree] mode: native"`
  - `sidequest_log()` function: append one-line operation log to `$SIDEQUEST_LOG` (timestamp, mode, command, branch/path, exit_code, error_summary)
  - `sidequest_error()` function: format human-readable error message (short summary, command attempted, recovery command, log path) -- never pass raw JSON through
  - `sidequest_verify_node()` function: runs `node -v` and logs result before install
  - `sidequest_recover_create()` function: targeted `git worktree remove --force "$1"`, fallback `git worktree prune --expire now` + verify via `git worktree list --porcelain`
  - `sidequest_check_worktree_exists()` function: check if worktree already exists at path via `git worktree list --porcelain`

### 6. Add USE_SIDEQUEST toggle to worktree-ai.sh
- **Task ID**: bash-create-wrapper
- **Depends On**: bash-common-helper
- **Assigned To**: builder-bash
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false
- In `~/code/dotfiles/bin/tmux/worktree-ai.sh`:
  - Source `sidequest-common.sh` with defensive fail-open using `BASH_SOURCE` (if missing or source fails, `USE_SIDEQUEST=0`)
  - Create `ensure_worktree_cli()` function:
    - Build args array: `worktree create "$branch" --no-fetch --no-install --json`
    - Add `--base "$base"` if provided
    - Capture stderr to temp file: `2>"$stderr_file"`
    - Parse JSON with `jq -r '.path'`
    - **Before create**: call `sidequest_check_worktree_exists "$worktree_path"` -- if exists, skip creation
    - On failure: call `sidequest_error` (formatted message + persist to cache) + `sidequest_recover_create "$worktree_path"` + `sidequest_log`
    - On success: call `switch_node_version "$worktree_path"`, verify with `sidequest_verify_node`, then `$SIDEQUEST_GIT_CMD worktree install "$worktree_path" --json` + `sidequest_log`
    - If install fails: keep worktree, open tmux session anyway (unbootstrapped), call `sidequest_error` (recovery command persisted to `~/.cache/sidequest-worktree-last-error.txt`)
  - Create `list_for_picker_cli()` function:
    - Call `$SIDEQUEST_GIT_CMD worktree list --json`
    - Format with `jq` for fzf display
  - Add dispatcher at entry point: `ensure_worktree()` checks toggle and calls `ensure_worktree_cli()` or falls through to existing code
  - **No rename churn**: Keep original function names intact. Add new `_cli` variants alongside them. The dispatcher selects at the top level only -- existing callsites within native code are untouched.

### 7. Add USE_SIDEQUEST toggle to worktree-delete.sh
- **Task ID**: bash-delete-wrapper
- **Depends On**: validate-upstream
- **Assigned To**: builder-bash
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false (sequential after task 6, same builder)
- In `~/code/dotfiles/bin/tmux/worktree-delete.sh`:
  - Source `sidequest-common.sh` with defensive fail-open using `BASH_SOURCE` (if missing or source fails, `USE_SIDEQUEST=0`)
  - Create `list_for_picker_cli()`:
    - Merge `worktree list --json` + `worktree orphans --json` output
    - Format for fzf with status indicators
  - Create `batch_delete_cli()`:
    - **Do NOT use `worktree clean --delete-branches`** -- it's atomic and removes user's ability to selectively keep branches. This would be a UX and safety regression.
    - Instead, iterate user's fzf selections and call `$SIDEQUEST_GIT_CMD worktree delete "$branch" --json` individually for each
    - After worktree removal, present second fzf picker for branch deletion (preserving existing two-step UX)
    - **Batch ordering**: remove ALL worktrees first (phase 1), then present branch picker for surviving branches (phase 2). This prevents cascading failures where branch deletion affects subsequent worktree removals.
    - **Batch error handling**: continue through all selections, collect per-item failures, print summary, exit non-zero if any failed. Do not abort on first failure.
    - For force delete: call `$SIDEQUEST_GIT_CMD worktree delete "$branch" --force --delete-branch --json`
  - Create `single_delete_cli()`:
    - Call `$SIDEQUEST_GIT_CMD worktree check "$branch" --json` for pre-delete status
    - Call `$SIDEQUEST_GIT_CMD worktree delete "$branch" [--force] [--delete-branch] --json`
  - Keep ALL native code intact (no renames, add `_cli` variants alongside with dispatcher)

### 8. Validate bash scripts
- **Task ID**: validate-bash
- **Depends On**: bash-common-helper, bash-create-wrapper, bash-delete-wrapper
- **Assigned To**: validator-final
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: false
- In `~/code/dotfiles/bin/tmux/`:
  - Verify `sidequest-common.sh` exists with config reference header comment
  - Verify sourced by both scripts using `BASH_SOURCE` (not `$0`)
  - Verify `USE_SIDEQUEST` toggle is in shared helper (not duplicated)
  - Verify `SIDEQUEST_GIT_CMD` is overridable for local dev
  - Verify preflight: `command -v bunx` auto-disables, `command -v jq` fails only when sidequest active
  - Verify stderr is captured to temp file (not `2>&1`)
  - Verify `--json` flag on all CLI calls
  - Verify targeted recovery (`git worktree remove --force`) NOT global `git worktree prune`
  - Verify `--no-fetch --no-install` on create calls
  - Verify install sequence: create -> switch_node_version -> verify node -v -> worktree install
  - Verify batch delete uses individual `worktree delete` calls (NOT `worktree clean --delete-branches`)
  - Verify native code is untouched (no renames, original function names preserved)
  - Verify `USE_SIDEQUEST=0` disables all CLI paths
  - Verify defensive sourcing uses `BASH_SOURCE` and catches source failures (not just missing file)
  - Verify runtime version check has `timeout 5` wrapper
  - Verify mode banner printed on first run
  - Verify operation log written to `$SIDEQUEST_LOG`
  - Verify error messages are human-readable (not raw JSON)
  - Verify recovery commands persisted to `~/.cache/sidequest-worktree-last-error.txt`
  - Verify batch delete ordering: worktrees first, then branches
  - Verify batch delete continues through failures (not abort-on-first)
  - Verify worktree existence check before `git worktree add`
  - Verify path normalization with `realpath` in comparison code
  - Run `bash -n sidequest-common.sh`, `bash -n worktree-ai.sh`, `bash -n worktree-delete.sh` for syntax check
  - Report PASS/FAIL for each check

### 9. Create smoke test script
- **Task ID**: create-test-scripts
- **Depends On**: validate-bash
- **Assigned To**: builder-bash
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false
- Create `~/code/dotfiles/bin/tmux/test-migration.sh`:
  - Focused smoke test: create -> install -> delete in temp repo
  - Creates temp git repo with realistic structure (package.json, lockfile, .worktrees.json)
  - Verifies cross-mode compatibility in BOTH directions:
    - CLI-created worktree visible to native `git worktree list`
    - Native-created worktree visible to CLI `worktree list --json`
  - Tests path normalization (compare `realpath` of native vs CLI paths)
  - Uses PASS/FAIL counters
  - Cleans up temp repo
  - Catches shell quoting, path, env, and JSON parsing integration bugs
  - Not a full lifecycle harness -- upstream TS tests cover logic

### 10. Final Validation
- **Task ID**: validate-all
- **Depends On**: validate-bash, create-test-scripts
- **Assigned To**: validator-final
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: false
- Verify @side-quest/git all tests pass and types clean
- Verify `worktree install <path>` subcommand exists
- Verify new type fields (`commitsAhead`, `status`) are optional (backward-compatible)
- Verify all bash scripts pass `bash -n` syntax check (sidequest-common.sh, worktree-ai.sh, worktree-delete.sh)
- Verify `sidequest-common.sh` is sourced by both scripts (not duplicated toggle logic)
- Verify defensive sourcing uses `BASH_SOURCE`, catches source failures, falls back to native
- Verify `SIDEQUEST_GIT_CMD` is overridable
- Verify runtime version check has `timeout 5` and auto-fallback to native
- Verify `USE_SIDEQUEST=0` is the default (Phase 1 = behind flag, not auto-enabled)
- Verify config reference in `sidequest-common.sh` header comment
- Verify operation log written on each CLI call
- Verify error messages are human-readable (not raw JSON)
- Verify recovery commands persisted to cache file
- Verify `--json` flag on all CLI calls in sidequest wrappers
- Verify targeted recovery (`git worktree remove --force`) with prune fallback
- Verify batch delete uses individual `worktree delete` with continue-on-failure semantics
- Verify test-migration.sh is executable, has cleanup, and tests cross-mode compatibility
- Verify JSON contract shapes match between CLI output and jq parsing in bash
- Verify error shapes: exit non-zero + `{"error":"..."}` on stderr
- Verify path normalization with `realpath` in comparison code
- Report comprehensive PASS/FAIL summary

## Acceptance Criteria

**Measurable outcomes:**
1. `USE_SIDEQUEST=1` mode: create, install, list, delete all work end-to-end via CLI wrappers
2. `USE_SIDEQUEST=0` mode: all existing behavior unchanged (no regression)
3. Cross-mode: CLI-created worktrees work with native code, and vice versa
4. All `@side-quest/git` tests pass, types clean, lint clean
5. All bash scripts pass `bash -n` syntax check
6. `test-migration.sh` smoke test passes (create -> install -> delete in temp repo)

**Specific contract checks:**
7. `worktree create --base` flag works
8. `worktree list` includes optional `commitsAhead`/`status` fields (backward-compatible); `status` is display-only, bash derives logic from typed fields
9. `worktree install <path>` subcommand exists and returns JSON
10. Defensive sourcing uses `BASH_SOURCE`, catches source failures, falls back to native
11. Runtime version check with 5s timeout auto-falls back to native on failure
12. Batch delete: worktrees removed first, then branch picker, continue-on-failure
13. Native code untouched (no renames, original function names preserved)
14. Error messages human-readable (not raw JSON), recovery commands persisted to cache file
15. Operation log written to `$SIDEQUEST_LOG` on each CLI call

## Validation Commands
- `bun test` -- run all tests (in @side-quest/git repo)
- `bunx tsc --noEmit` -- verify no type errors (in @side-quest/git repo)
- `bunx biome ci .` -- lint and format check (in @side-quest/git repo)
- `bash -n sidequest-common.sh` -- syntax check (in dotfiles repo)
- `bash -n worktree-ai.sh` -- syntax check (in dotfiles repo)
- `bash -n worktree-delete.sh` -- syntax check (in dotfiles repo)
- `bash test-migration.sh` -- smoke test (in dotfiles repo)

## Notes

### Key Architectural Decisions (from migration plan + staff review)

1. **CLI owns package installation** - Bash calls `worktree install` as a separate step after node version switching. Install logic should not live in two languages. The `worktree install` CLI subcommand is a hard prerequisite (Gap 3).

2. **Streams never merge** - CLI uses exit 0 + stdout JSON for success, exit non-zero + stderr JSON for errors. Bash captures stderr to temp file, checks `$?` first. All calls use `--json` flag explicitly.

3. **Install sequence is 4-step, each step idempotent** - `create --no-install` (with existence check first) -> `switch_node_version` (bash) -> verify `node -v` -> `worktree install` (CLI). If interrupted mid-sequence, any step can be safely re-run.

4. **Targeted error recovery with fallback** - On create failure, use `git worktree remove --force <path>` (targeted). If that fails (stale admin entry), fallback to `git worktree prune --expire now` + verify. Note: `prune --expire now` is repo-wide (affects all stale entries, not just the target). This is an accepted tradeoff -- git has no single-entry prune, and stale entries should be cleaned anyway. On install failure, keep the worktree and open tmux session.

5. **Selective branch deletion preserved** - Batch delete uses individual `worktree delete` calls per user selection with continue-on-failure semantics. NOT atomic `worktree clean --delete-branches`.

6. **Cross-mode compatibility** - CLI-created worktrees must be indistinguishable from native-created ones at the git level. Both modes must interoperate during dual-mode phase.

7. **Defensive sourcing and fail-open** - Scripts source `sidequest-common.sh` via `BASH_SOURCE` with fail-open (if missing or source fails, `USE_SIDEQUEST=0`). Runtime version check with 5s timeout auto-falls back to native. Partial deploy cannot break existing functionality.

8. **Type changes are additive-only** - New fields (`commitsAhead`, `status`) on `WorktreeInfo`/`DeleteCheck` are optional. Existing consumers unaffected. `status` is display-only -- bash derives logic from typed boolean/number fields.

9. **Human-readable errors, not raw JSON** - Wrappers parse CLI stderr JSON and display formatted messages with recovery commands. Recovery commands persisted to `~/.cache/sidequest-worktree-last-error.txt` (survives popup close). Operation log at `$SIDEQUEST_LOG` for debugging.

10. **No rename churn** - Original function names preserved. New `_cli` variants added alongside with a dispatcher at the entry point only.

### Dependencies

- `@side-quest/git` must be published with all 3 gaps closed before bash wrappers can function in production
- For local development: `SIDEQUEST_GIT_CMD="bun run /path/to/local/cli.ts"` overrides `bunx` resolution
- Pin version during migration: `bunx @side-quest/git@0.2.0` (not floating `latest`)
- `jq` must be installed on the system (hard requirement when sidequest mode active)
- `bunx` must be on PATH in tmux popup context (verify with tmux popup PATH test)

### Risk Mitigations

- `USE_SIDEQUEST=0` instantly reverts to native code (no code deleted until cleanup plan)
- Defensive sourcing via `BASH_SOURCE`: scripts fail-open to native if `sidequest-common.sh` is missing or has errors
- Runtime version check with 5s timeout: auto-fallback to native if CLI version check fails, times out, or registry unreachable
- Auto-disable if `bunx` not found on PATH (non-fatal, falls back to native)
- Targeted `git worktree remove --force` on create failure, with `prune --expire now` fallback
- If install fails after create: keep worktree, open tmux session, print recovery command AND persist to cache file
- Cross-mode compatibility: CLI-created worktrees interoperate with native code
- `--no-fetch` by default prevents network hangs in tmux popup context
- `--json` explicit on all CLI calls (don't rely on default output format)
- Pinned version prevents surprise behavior changes during migration
- Type changes additive-only (backward-compatible JSON output)
- Batch delete: worktrees removed first, then branches; continues through failures, collects summary
- Human-readable error messages (not raw JSON) with persistent recovery commands
- Operation log for debugging: `~/.cache/sidequest-worktree.log`

### Scope Exclusions

- **Native code cleanup** is not part of this plan (separate plan after confidence period)
- **`skipExisting` on copy-files** (Gap 3 from original plan) - deferred, not needed for migration (scripts are copy-driven, not sync-driven)
- **`develop` fallback in integration branch** (Gap 4 from original plan) - deferred, speculative unless a concrete repo needs it
- **Env var fallback for copy patterns** (Gap 5 from original plan) - deferred, bash can pass `--copy` or rely on `.worktrees.json`
- **Monorepo workspaces** - out of scope for v1
- **Submodules** - neither bash nor TypeScript handles this, not a regression
- **Concurrent tmux popup race conditions** - known limitation, same as bash

### Staff Review Resolution

#### Round 1: Architect pass
Review: `specs/reviews/dotfiles-worktree-migration-review.md`

**Critical issues (7) - all resolved:**

| # | Finding | Resolution |
|---|---------|------------|
| 1 | `worktree install` missing as CLI subcommand | Added Gap 3 (install subcommand) |
| 2 | Gap 2 performance regression risk | Specified lightweight `git rev-list --count` only |
| 3 | Branch semantics inconsistent | Deferred Gap 4 (develop fallback) to post-migration |
| 4 | Delete flow UX regression | Changed to individual `worktree delete` calls |
| 5 | Config precedence ambiguous | Deferred Gap 5 (env var fallback) to post-migration |
| 6 | Cross-repo version coupling | Added `SIDEQUEST_GIT_CMD` override + pinned version |
| 7 | `git worktree prune` too aggressive | Changed to targeted `git worktree remove --force` |

#### Round 2, Pass 1: Skeptic
Review: `specs/reviews/dotfiles-worktree-migration-review-pass-1.md`

**Critical findings applied:**

| # | Finding | Resolution |
|---|---------|------------|
| 1 | Scope too broad -- Gaps 3/4/5 not needed | Cut from migration scope, moved to Scope Exclusions |
| 2 | 4-phase plan overcautious for dotfiles | Collapsed to 2 phases: implement behind flag + cutover with rollback window |
| 3 | 19 acceptance criteria bloated | Reduced to 13 measurable outcomes |
| 4 | Versioning undefined | Added concrete release dependency (3 gaps, pinned version) |

**Important findings applied:**

| # | Finding | Resolution |
|---|---------|------------|
| 1 | 4 agent streams is overhead | Consolidated to 3 streams (upstream builder, bash builder, validator) |
| 2 | 1-week validation overkill | Changed to 1-2 day rollback window |
| 3 | `validate-migration.sh` unnecessary | Removed; smoke test script covers integration bugs |

#### Round 2, Pass 2: Migration Specialist
Review: `specs/reviews/dotfiles-worktree-migration-review-pass-2.md`

**Critical findings applied:**

| # | Finding | Resolution |
|---|---------|------------|
| 1 | No cross-mode compatibility contract | Added compatibility matrix (native<->CLI interop) |
| 2 | Create pipeline non-atomic, undefined mid-failure | Added state handling: each step idempotent/re-runnable |
| 3 | `remove --force` doesn't always clear stale entries | Added `prune --expire now` fallback + verify via porcelain |
| 4 | Version/capability skew unmanaged | Added runtime version check with auto-fallback to native |
| 5 | Partial deploy can break scripts | Added defensive sourcing with fail-open to native |
| 6 | Type changes need backward-compat | Made new fields optional (additive-only) |

**Important findings applied:**

| # | Finding | Resolution |
|---|---------|------------|
| 1 | Path normalization between modes | Added `realpath` normalization requirement |
| 2 | Batch delete error semantics undefined | Added continue-on-failure, collect summary |
| 3 | Tmux behavior on install failure unclear | Open session anyway, print recovery command |
| 4 | Line-count reduction timing misleading | Added caveat: increases during dual-mode, reduces after cleanup |

**Synthesis (from Migration Specialist):** Skeptic removed strategic overreach; Migration Specialist exposed operational risk in in-between states. Together, they de-risk most design-level concerns. Residual risk is concentrated in partial failures and skewed environments, not in the wrapper concept itself.

#### Round 3, Pass 1: Operator
Review: `specs/reviews/dotfiles-worktree-migration-review-r3-pass-1.md`

**Critical findings applied:**

| # | Finding | Resolution |
|---|---------|------------|
| 1 | Create idempotency asserted but not specified (`git worktree add` fails if path exists) | Added explicit existence check before `git worktree add` + `sidequest_check_worktree_exists()` helper |
| 2 | Defensive sourcing `$0` brittle in popup shells | Changed to `BASH_SOURCE[0]` + catch source failures (not just missing file) |
| 3 | Runtime version check has no timeout budget | Added `timeout 5` wrapper on `$SIDEQUEST_GIT_CMD --version` |
| 4 | `prune --expire now` is repo-wide, contradicts "targeted" | Acknowledged tradeoff in architectural decisions -- git has no single-entry prune |
| 5 | Smoke test doesn't cover tmux popup context | Acknowledged limitation; added cross-mode tests in both directions |

**Important findings applied:**

| # | Finding | Resolution |
|---|---------|------------|
| 1 | Batch delete ordering underspecified | Added two-phase ordering: worktrees first, then branch picker |
| 2 | Cross-mode matrix only tests one direction | Smoke test now tests both directions (CLI->native and native->CLI) |
| 3 | No durable operation log | Added `$SIDEQUEST_LOG` with one-line-per-operation format |
| 4 | No explicit cutover gate for 0.2.0 | Covered by existing `USE_SIDEQUEST=0` default + pinned version |

#### Round 3, Pass 2: DX Advocate
Review: `specs/reviews/dotfiles-worktree-migration-review-r3-pass-2.md`

**Critical findings applied:**

| # | Finding | Resolution |
|---|---------|------------|
| 1 | No single config source of truth | Added config reference header in `sidequest-common.sh` + `SIDEQUEST_LOG` env var |
| 2 | Mode behavior ambiguous under failure | Defined exact rules: invalid toggle = native, CLI non-zero = parse + format error |
| 3 | Error UX underspecified (raw JSON in popups) | Added `sidequest_error()` formatter: summary, command, recovery, log path |
| 4 | Recovery command lost when popup closes | Persist to `~/.cache/sidequest-worktree-last-error.txt` |
| 5 | Status string coupling brittle | Made `status` display-only; bash derives logic from typed fields |

**Important findings applied:**

| # | Finding | Resolution |
|---|---------|------------|
| 1 | Function naming ages poorly (`_sidequest`/`_native`) | Renamed to `_cli`/`_git` (intent-based, not implementation-based) |
| 2 | Task 5 overloaded for agent | Split into task 5 (common.sh) and task 6 (worktree-ai.sh) |
| 3 | Unnecessary rename churn | Keep original function names, add `_cli` variants with dispatcher |
| 4 | Migration tax vs short window | Narrowed toggle to entry-point dispatch only |

**Synthesis (from DX Advocate):** Technical migration path is now de-risked. Human-operability path was the remaining gap: config discoverability, mode ambiguity, and failure-message usability. With config contract, wrapper error contract, and popup recovery persistence locked down, residual risk is temporary complexity from dual-mode code and status string drift.
