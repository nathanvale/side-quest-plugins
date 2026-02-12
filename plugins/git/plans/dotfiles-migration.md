# Dotfiles Tmux Worktree Migration

**Date:** 2026-02-11
**Repo:** `~/code/dotfiles`
**Depends on:** `@side-quest/git` P0 features

---

## Architecture

```
Current:  tmux binding -> worktree-ai.sh (770 lines, raw git commands)
Target:   tmux binding -> worktree-ai.sh (thin wrapper, fzf + tmux only)
                            -> bunx @side-quest/git worktree <command> (engine)
```

The bash scripts STAY as the interactive/tmux orchestration layer. They become thin wrappers that call `@side-quest/git` for git operations.

---

## 1. What Stays in Bash (and Should Never Move)

These are intrinsically shell/terminal concerns:

| Capability | Why it stays |
|-----------|-------------|
| fzf picker (`pick_branch`) | stdin/tty handling, display-popup context, ANSI formatting |
| `list_remote_branches()` / `list_local_branches()` | Picker data for fzf -- raw git branch output formatted for display. No CLI equivalent needed. |
| tmux session creation (`create_ai_session`) | tmux API, pane splits, send-keys, window management |
| tmux session teardown (`kill_session_if_exists`) | tmux has-session/kill-session with poll verification |
| Session file handoff (`~/.cache/tmux-worktree-session`) | tmux switch-client integration |
| Interactive prompts (`prompt_new_branch`) | /dev/tty redirection after fzf |
| tmux.conf bindings | tmux configuration |
| Node version switching (`switch_node_version`) | fnm/nvm are shell tools that modify shell env |

---

## 2. What Moves to @side-quest/git

| Bash function | Replaced by | Notes |
|---|---|---|
| `ensure_worktree()` (lines 551-620) | `bunx @side-quest/git worktree create <branch>` | Handles local/remote/new branch detection |
| `copy_untracked_files()` (lines 127-267) | Already in `@side-quest/git` as `copy-files.ts` | Glob-based, root + recursive |
| `detect_package_manager()` (lines 272-326) | Already in `@side-quest/git` as `detect-pm.ts` | Lock file priority detection |
| `should_run_install()` (lines 437-457) | `@side-quest/git` P0.1 `shouldRunInstall()` | **Needs to be added** |
| `run_package_install()` (lines 351-432) | `@side-quest/git` P0.1 `runInstallIfNeeded()` | **Needs to be added** |
| Attach-to-existing flow (lines 754-765) | `@side-quest/git` P0.3 attach mode | `create` returns `attached: true` |
| `list_worktrees()` (lines 460-474) | `bunx @side-quest/git worktree list` | JSON output, richer status |
| `list_worktree_for_picker()` (delete.sh:167-193) | `bunx @side-quest/git worktree list --all` | With dirty/merged/commits-ahead |
| `list_orphan_branches()` (delete.sh:196-222) | `bunx @side-quest/git worktree orphans` | **P0.4** |
| `is_worktree_clean()` / `is_branch_merged()` | `bunx @side-quest/git worktree check <branch>` | Already exists |
| `get_branch_status()` (delete.sh:53-100) | Included in `worktree list` and `worktree status` output | commits-ahead count |
| Batch delete logic (delete.sh:323-513) | `bunx @side-quest/git worktree clean` | **P0.5** |

---

## 2b. Additional CLI Features Needed

### `worktree create --base <branch>` flag

The bash `ensure_worktree()` accepts a `$base` parameter when the fzf picker selects a specific branch to branch from. TypeScript currently auto-detects. Add:

```bash
bunx @side-quest/git worktree create feat/my-feature --base develop --no-fetch
```

**Modify:** `src/worktree/create.ts` - Add `base?: string` to options. If provided, use directly: `git worktree add -b <branch> <path> <base>`.

### `getMainWorktreeRoot()` fix in CLI

Same Cortex keying bug exists in the CLI itself. If you run `bunx @side-quest/git worktree create` from inside an existing worktree, `getGitRoot()` returns the worktree path, not main repo. Fix with `--git-common-dir` (same as plugin fix).

**Modify:** `src/git/git-root.ts` - Add `getMainWorktreeRoot()` using `--git-common-dir`, use it in `cli.ts`.

### Behavioral gaps between bash and TypeScript

| # | Bash | TypeScript | Fix |
|---|------|-----------|-----|
| 1 | `copy_untracked_files()` skips existing | `copyWorktreeFiles()` overwrites | Add `skipExisting` option, default true for sync |
| 2 | `detect_package_manager()` checks `packageManager` field AND returns PM name ("bun") | Only checks lockfiles, `detectInstallCommand()` returns "bun install" | Add `packageManager` field fallback. Add `detectPackageManager()` that returns name only + `detectInstallCommand()` that returns full command. Bash needs the name for `command -v` check, not the command string. |
| 3 | `run_package_install()` uses `CI=true`, `--frozen-lockfile`, timeout | `runPostCreate()` runs bare command | **DECISION: CLI owns installation.** See Section 2c below. |
| 4 | `ensure_worktree()` accepts explicit base branch | Auto-detects base | Add `--base` flag (above) |
| 5 | `get_repo_root()` resolves via `--git-common-dir` | `getGitRoot()` uses `--show-toplevel` | Add `getMainWorktreeRoot()` (above) |
| 6 | `WORKTREE_COPY_PATTERNS` / `WORKTREE_COPY_RECURSIVE` env vars override defaults | `.worktrees.json` or auto-detection only | CLI reads env vars as fallback when no `.worktrees.json` exists. Warn if env vars are set AND `.worktrees.json` exists (potential conflict). |
| 7 | `should_run_install()` compares lockfile mtime vs `node_modules` mtime | `runPostCreate()` runs unconditionally | P0.1 `shouldRunInstall()` must implement mtime comparison. See `statSync` from `@side-quest/core/fs`. |
| 8 | `get_default_branch()` tries main, master, develop | `getRemoteDefaultBranch()` tries origin/main, origin/master, HEAD | Add `develop` as fallback for git-flow teams |

### 2c. Install Ownership Decision

**The CLI owns package installation.** This is the single most important architectural decision in the migration.

**Why CLI, not bash:**
- Installation depends on lockfile detection, package manager detection, and staleness checks -- all already in TypeScript
- Splitting ownership means maintaining install logic in two languages
- The CLI can test installation end-to-end; bash install is untestable
- Bash's ~150 lines of install logic is the biggest complexity reduction in the migration

**What the CLI must implement (P0.1 parity with bash):**

| Bash behavior | CLI requirement |
|--------------|----------------|
| `CI=true` env var | `runInstallIfNeeded()` sets `CI=true` in spawn env |
| `--frozen-lockfile` / `--no-audit` / etc. | Per-PM flag table: bun=`--frozen-lockfile`, yarn=`--frozen-lockfile`, pnpm=`--frozen-lockfile`, npm=`--ci` |
| 120s timeout | `spawnWithTimeout(cmd, 120_000)` from `@side-quest/core/spawn` |
| Skip if `node_modules` newer than lockfile | `statSync` mtime comparison from `@side-quest/core/fs` |
| `command -v $pm` check before install | `commandExists` from `@side-quest/core/spawn` |
| Return PM name for bash `command -v` | JSON output includes `packageManager: "bun"` field |

**Node version sequencing:** Bash calls `switch_node_version()` BEFORE calling the CLI. The CLI's install step uses whatever `node`/`bun` is on PATH at that point. This is correct -- bash controls the shell env, CLI respects it.

**Fallback when fnm/nvm missing:** `switch_node_version()` already silently succeeds if neither is installed (lines 339-346 both guarded by `command -v`/file checks). The CLI install runs with the system default Node. This is acceptable -- if the user hasn't set up fnm/nvm, they're already running with system Node.

---

## 3. JSON Output Contracts

The bash scripts will parse CLI output with `jq`. These are the contracts.

**Protocol:** Exit 0 = JSON on stdout. Exit non-zero = `{"error":"..."}` on stderr. Bash checks `$?` first, then parses the appropriate stream. Success output never goes to stderr. Errors never go to stdout. Git subprocess warnings are suppressed (`2>/dev/null` on git commands inside the CLI).

**Implementation:** CLI uses `safeJsonStringify` from `@side-quest/core/utils` for all JSON output (handles circular refs, never crashes mid-serialization). Errors use `getErrorMessage` from `@side-quest/core/utils` + `StructuredError` from `@side-quest/core/errors` for typed error handling. Unhandled exceptions caught at CLI top-level with generic `{"error":"Internal error: ..."}` shape on stderr.

### `worktree create`
```json
{
  "branch": "feat/auth",
  "path": "/abs/path/.worktrees/feat-auth",
  "filesCopied": 5,
  "installResult": {
    "ran": true,
    "skipped": false,
    "reason": "installed",
    "output": "bun install v1.2.3...",
    "packageManager": "bun"
  },
  "configAutoDetected": false,
  "attached": false
}
```

**Note:** `attached` field requires P0.3 (attach flow). Until P0.3 ships, `create` for an existing branch returns exit non-zero + `{"error":"Worktree already exists at ..."}`. The bash integration test for attach mode (Section 7) is blocked on P0.3 -- marked explicitly.

### `worktree list`
```json
[
  {
    "branch": "feat/auth",
    "path": "/abs/path/.worktrees/feat-auth",
    "head": "abc1234",
    "dirty": false,
    "merged": false,
    "commitsAhead": 3,
    "status": "3 ahead",
    "isMain": false
  }
]
```

**Note:** `commitsAhead` (number) and `status` (string: "pristine" | "merged" | "N ahead" | "unknown") both included. Bash delete picker uses `status` for display, bash logic uses `commitsAhead` for comparisons. No need to synthesize from booleans.

### `worktree check`
```json
{
  "path": "/abs/path/.worktrees/feat-auth",
  "branch": "feat/auth",
  "dirty": false,
  "merged": true,
  "commitsAhead": 0,
  "status": "merged",
  "exists": true
}
```

### `worktree orphans`
```json
[
  {
    "branch": "fix/old-thing",
    "status": "merged",
    "commitsAhead": 0
  }
]
```

### `worktree clean --dry-run`
```json
{
  "deleted": [],
  "skipped": [{"branch": "feat/wip", "path": "...", "reason": "dirty"}],
  "orphansDeleted": [],
  "branchesDeleted": [],
  "dryRun": true
}
```

**Note:** `branchesDeleted` distinguishes worktree removal from branch deletion for the bash two-step flow.

### Error shape (all commands)

**Stderr, exit non-zero:**
```json
{"error": "Not in a git repository"}
```

**Unhandled exception fallback:**
```json
{"error": "Internal error: Cannot read property 'foo' of undefined"}
```

---

## 4. Migration Strategy

### Phase 1: Parallel Mode (env toggle)

Add a `USE_SIDEQUEST` environment variable to `worktree-ai.sh`:

```bash
USE_SIDEQUEST="${USE_SIDEQUEST:-0}"

# Guard: auto-disable if bunx not available
if [[ "$USE_SIDEQUEST" == "1" ]] && ! command -v bunx &>/dev/null; then
    warning "bunx not found on PATH, falling back to native git"
    USE_SIDEQUEST=0
fi

ensure_worktree() {
    if [[ "$USE_SIDEQUEST" == "1" ]]; then
        ensure_worktree_sidequest "$@"
    else
        ensure_worktree_native "$@"
    fi
}
```

The `_sidequest` variant calls `bunx @side-quest/git worktree create` and parses JSON with `jq`. The `_native` variant is the current code, untouched.

**Same pattern for `worktree-delete.sh`:** `USE_SIDEQUEST=1` routes through CLI for listing, checking, and batch delete.

### Phase 2: Validation

Validate using **read-only commands** (list, check, orphans) that are safely idempotent -- NOT create, which is not idempotent:

```bash
# In worktree-ai.sh, temporarily:
# SAFE: compare list output (read-only, idempotent)
native_list=$(list_worktrees_native 2>/dev/null)
sidequest_list=$($SIDEQUEST_CMD worktree list 2>/dev/null | jq -r '...')
diff <(echo "$native_list") <(echo "$sidequest_list") || log_discrepancy "list" "$native_list" "$sidequest_list"

# SAFE: compare check output for each worktree (read-only)
for branch in $(list_branches); do
    native_check=$(is_worktree_clean_native "$branch" && echo "clean" || echo "dirty")
    sidequest_check=$($SIDEQUEST_CMD worktree check "$branch" 2>/dev/null | jq -r '.dirty | if . then "dirty" else "clean" end')
    [[ "$native_check" != "$sidequest_check" ]] && log_discrepancy "check:$branch" "$native_check" "$sidequest_check"
done
```

**Automated logging:** Discrepancies logged to `~/.cache/tmux-worktree-validation.log` with timestamps. Review after 1 week with `cat ~/.cache/tmux-worktree-validation.log | sort | uniq -c | sort -rn`.

Fix any discrepancies:
- File copy patterns (bash uses env vars, TypeScript uses `.worktrees.json`)
- Package manager detection priority
- Branch name sanitization (both use `tr '/' '-'`)
- Error handling differences
- `WORKTREE_COPY_PATTERNS` env var migration

### Phase 3: Cutover

Flip default: `USE_SIDEQUEST="${USE_SIDEQUEST:-1}"`

Keep native code as fallback. Monitor for a week.

### Phase 4: Cleanup

Remove native git code paths from bash scripts. The scripts become ~200 lines of:
- fzf picker UI
- `jq` parsing of CLI JSON output
- tmux session management
- Node version switching

---

## 5. Detailed Refactored Script Structure

### worktree-ai.sh (after migration)

```bash
#!/bin/bash
# ~200 lines total

# CONFIGURATION
SIDEQUEST_CMD="bunx @side-quest/git"

# PREFLIGHT
command -v jq &>/dev/null || { echo "ERROR: jq is required" >&2; exit 1; }
command -v bunx &>/dev/null || { echo "ERROR: bunx is required (install bun)" >&2; exit 1; }

# HELPERS (stay in bash)
pick_branch()           # fzf picker - unchanged
list_local_branches()   # git branch output for fzf - stays in bash
list_remote_branches()  # git branch -r output for fzf - stays in bash
prompt_new_branch()     # interactive prompt - unchanged
create_ai_session()     # tmux session creation - unchanged
switch_node_version()   # fnm/nvm - unchanged
cleanup_session_file()  # unchanged

# GIT OPERATIONS (delegated to CLI)
ensure_worktree() {
    local branch="$1"
    local base="${2:-}"  # optional base branch from picker
    local args=("worktree" "create" "$branch" "--no-fetch")
    [[ -n "$base" ]] && args+=("--base" "$base")

    local result stderr_file
    stderr_file=$(mktemp)
    result=$($SIDEQUEST_CMD "${args[@]}" 2>"$stderr_file")
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        local err_msg
        err_msg=$(jq -r '.error // "Unknown error"' < "$stderr_file" 2>/dev/null || cat "$stderr_file")
        rm -f "$stderr_file"
        # Recover from partial state: prune dangling worktree refs
        git worktree prune 2>/dev/null
        error "$err_msg"
        return 1
    fi
    rm -f "$stderr_file"

    # Extract path from JSON
    local worktree_path
    worktree_path=$(echo "$result" | jq -r '.path')

    # Node version switching (stays in bash - shell env concern)
    # Must happen BEFORE any further CLI calls that depend on Node
    switch_node_version "$worktree_path"

    echo "$worktree_path"
}

list_for_picker() {
    # Get JSON list, format for fzf
    $SIDEQUEST_CMD worktree list 2>/dev/null | jq -r '.[] | "\(.branch)\t\(.status)\t\(.path)"'
}

# MAIN (simplified)
main() {
    check_git_repo
    cleanup_session_file

    # ... fzf picker logic (unchanged) ...

    worktree_path=$(ensure_worktree "$branch" "$base")
    create_ai_session "$worktree_path" "$branch"
}
```

### worktree-delete.sh (after migration)

```bash
#!/bin/bash
# ~200 lines total

# GIT OPERATIONS (delegated to CLI)
list_for_picker() {
    # Merge worktree list + orphan branches for fzf
    local worktrees orphans
    worktrees=$($SIDEQUEST_CMD worktree list 2>/dev/null | jq -r '.[] | "\(.branch)\t\(.status)\t\(.path)"')
    orphans=$($SIDEQUEST_CMD worktree orphans 2>/dev/null | jq -r '.[] | "\(.branch)\t\(.status)\torphan"')
    # Format for fzf with status indicators
    printf "%s\n%s" "$worktrees" "$orphans"
}

batch_delete() {
    # For clean+merged: use CLI clean command
    $SIDEQUEST_CMD worktree clean --delete-branches 2>/dev/null

    # For dirty (user chose force): use CLI delete --force
    $SIDEQUEST_CMD worktree delete "$branch" --force --delete-branch 2>/dev/null
}

# STAYS IN BASH
pick_worktrees()        # fzf multi-select - unchanged
kill_session_if_exists() # tmux teardown - unchanged
single_delete()         # interactive UX - uses CLI for git ops
```

---

## 6. Risk Mitigation

### The bash scripts work TODAY. Migration must not break them.

**Rollback mechanism:** `USE_SIDEQUEST=0` instantly reverts to native git commands. No code deleted until Phase 4.

**Key risks:**

| Risk | Mitigation |
|------|-----------|
| `bunx` cache corruption | Document `rm -rf /private/var/folders/...bunx-501-@side-quest/` fix |
| `bunx` cold start (3-5s on fresh cache) | Document `bun add -g @side-quest/git` as perf optimization (avoids download). Cold start is acceptable in popup context but global install is better UX. |
| `bunx` not on PATH in tmux popup | Preflight `command -v bunx` check with graceful fallback to `USE_SIDEQUEST=0`. Document: test `which bunx` from within `tmux run-shell` to verify. |
| tmux popup doesn't source shell profile | Document: verify with `tmux display-popup -E 'echo $PATH | tr ":" "\n" | grep bun'`. If missing, add explicit PATH in tmux.conf. |
| `.worktrees.json` drift from bash env vars | CLI reads `WORKTREE_COPY_PATTERNS` / `WORKTREE_COPY_RECURSIVE` as fallback when no `.worktrees.json`. Warns if both are set. Validate in Phase 2. |
| Lock file detection differences | Both use same priority: bun > yarn > pnpm > npm; test edge cases |
| Error output format differences | CLI: exit 0 + JSON on stdout, exit non-zero + JSON on stderr. Bash checks `$?` first. |
| `jq` not installed | Add `command -v jq` check at top of script, hard error (not just warn -- jq is required) |
| CLI crashes mid-create (OOM, SIGKILL, bunx corruption) | Bash wrapper runs `git worktree prune` before retry. Detects orphaned state by checking if worktree path exists but CLI returned non-zero. |
| `git fetch` hangs on slow network (create.ts default) | Bash wrapper passes `--no-fetch` by default. Fetch is a bash-level concern (user expects instant tmux popup response). |
| Concurrent tmux popups creating same worktree | Known race condition (exists in bash too). Document as limitation. Future: consider `flock` in CLI. |
| Disk space exhaustion during create | CLI propagates clear error: `{"error":"Failed to create worktree: No space left on device"}` not generic message. |

### Node version switching

**Stays in bash.** fnm/nvm modify the shell environment (`PATH`, etc.). Calling them from TypeScript via `shellExec` wouldn't affect the subsequent tmux session's environment. The bash script must run `fnm use` / `nvm use` in the shell context where it matters.

**Sequence is critical:**
1. Bash calls `switch_node_version("$worktree_path")` -- sets correct Node
2. Bash then calls CLI (which uses whatever `node`/`bun` is now on PATH)
3. CLI's `runInstallIfNeeded()` runs install under the correct Node version

**Wait -- this means the refactored `ensure_worktree()` must call `switch_node_version` BEFORE the CLI runs install.** But `create --no-fetch` (Section 5) already handles this: the CLI creates the worktree and copies files, bash switches Node, then if install is needed, bash calls `$SIDEQUEST_CMD worktree install "$worktree_path"` (a separate command) AFTER node switching.

**Revised sequence:**
1. `$SIDEQUEST_CMD worktree create "$branch" --no-fetch --no-install` -- creates worktree + copies files only
2. `switch_node_version "$worktree_path"` -- bash switches Node
3. `$SIDEQUEST_CMD worktree install "$worktree_path"` -- CLI runs install under correct Node

This requires a new `worktree install <path>` subcommand that runs `shouldRunInstall()` + `runInstallIfNeeded()` on an existing worktree. **Add to P0.1 scope.**

**Fallback when fnm/nvm missing:** `switch_node_version()` silently succeeds (guarded by `command -v`). Install runs with system Node. Acceptable.

---

## 7. Test Plan

### Unit: Verify JSON contract compatibility

```bash
# Create a test repo with realistic structure, run CLI, verify jq parsing
result=$(bunx @side-quest/git worktree create test-branch --no-fetch --no-install 2>/dev/null)
exit_code=$?
[[ $exit_code -eq 0 ]] || echo "FAIL: non-zero exit"
path=$(echo "$result" | jq -r '.path')
[[ -d "$path" ]] || echo "FAIL: path doesn't exist"
branch=$(echo "$result" | jq -r '.branch')
[[ "$branch" == "test-branch" ]] || echo "FAIL: branch mismatch"
```

### Integration: End-to-end worktree lifecycle

```bash
#!/bin/bash
# test-migration.sh
set -euo pipefail

PASS=0; FAIL=0
pass() { echo "PASS: $1"; ((PASS++)); }
fail() { echo "FAIL: $1"; ((FAIL++)); }

# Setup: realistic repo structure
REPO=$(mktemp -d)/test-repo
git init "$REPO"
cd "$REPO"
git commit --allow-empty -m "init"

# Add realistic project files
cat > package.json << 'EOF'
{"name":"test","packageManager":"bun@1.2.3","dependencies":{}}
EOF
touch bun.lockb
echo "SECRET=foo" > .env
mkdir -p .claude && echo "{}" > .claude/settings.json
cat > .worktrees.json << 'EOF'
{"copy":[".env",".env.*",".claude/**/*"],"exclude":["node_modules"]}
EOF
git add -A && git commit -m "add project files"

# Test create (with --no-install to avoid actual bun install)
result=$(bunx @side-quest/git worktree create feat/test --no-fetch --no-install 2>/dev/null)
path=$(echo "$result" | jq -r '.path')
[[ -d "$path" ]] && pass "create: worktree exists" || fail "create: worktree missing"
[[ -f "$path/.env" ]] && pass "create: .env copied" || fail "create: .env not copied"
[[ -f "$path/.claude/settings.json" ]] && pass "create: .claude copied" || fail "create: .claude not copied"

# Test list
count=$(bunx @side-quest/git worktree list 2>/dev/null | jq 'length')
[[ "$count" -ge 1 ]] && pass "list: found worktrees" || fail "list: empty"

# Test list has status fields
has_status=$(bunx @side-quest/git worktree list 2>/dev/null | jq '.[0] | has("status", "commitsAhead")')
[[ "$has_status" == "true" ]] && pass "list: has status fields" || fail "list: missing status fields"

# Test check
check=$(bunx @side-quest/git worktree check feat/test 2>/dev/null)
exists=$(echo "$check" | jq -r '.exists')
[[ "$exists" == "true" ]] && pass "check: exists" || fail "check: not found"

# Test attach (create again) -- BLOCKED on P0.3, skip if not implemented
result2=$(bunx @side-quest/git worktree create feat/test --no-fetch --no-install 2>/dev/null)
if [[ $? -eq 0 ]]; then
    attached=$(echo "$result2" | jq -r '.attached')
    [[ "$attached" == "true" ]] && pass "attach: returned attached=true" || fail "attach: not attached"
else
    echo "SKIP: attach (P0.3 not yet implemented)"
fi

# Test delete
bunx @side-quest/git worktree delete feat/test --delete-branch 2>/dev/null
count=$(bunx @side-quest/git worktree list 2>/dev/null | jq 'length')
[[ "$count" -eq 0 ]] && pass "delete: worktree removed" || fail "delete: worktree still exists"

# Test error handling: create with invalid branch name
err_result=$(bunx @side-quest/git worktree create "feat/test branch with spaces" --no-fetch --no-install 2>&1)
if [[ $? -ne 0 ]]; then
    has_error=$(echo "$err_result" | jq -e '.error' 2>/dev/null && echo "true" || echo "false")
    [[ "$has_error" == "true" ]] && pass "error: JSON error shape on failure" || fail "error: no JSON error shape"
else
    fail "error: should have failed on invalid branch name"
fi

# Test error handling: create in non-git directory
err_result2=$(cd /tmp && bunx @side-quest/git worktree create feat/nope 2>&1)
[[ $? -ne 0 ]] && pass "error: non-zero exit for non-git dir" || fail "error: should fail outside git repo"

# Summary
echo "---"
echo "Results: $PASS passed, $FAIL failed"

# Cleanup
rm -rf "$(dirname "$REPO")"
```

### Known limitations (not tested in v1)

- **Monorepo workspaces:** Multiple `package.json` files with per-package installs. Out of scope for v1 -- document as limitation.
- **Submodules:** Need `git submodule update --init` after creation. Neither bash nor TypeScript handles this. Not a regression.
- **Repos without remote origin:** `--no-fetch` makes this safe, but `list` may show incomplete merge status.

### Smoke: Automated Phase 2 validation

```bash
#!/bin/bash
# validate-migration.sh -- run during Phase 2 via alias
# Usage: alias worktree-validate='source ~/code/dotfiles/bin/tmux/validate-migration.sh'

LOG="$HOME/.cache/tmux-worktree-validation.log"
timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

log_discrepancy() {
    echo "$timestamp|$1|native=$2|cli=$3" >> "$LOG"
}

# Compare list output (safe, read-only, idempotent)
native_list=$(list_worktrees_native 2>/dev/null | sort)
cli_list=$($SIDEQUEST_CMD worktree list 2>/dev/null | jq -r '.[].branch' | sort)
if [[ "$native_list" != "$cli_list" ]]; then
    log_discrepancy "list" "$native_list" "$cli_list"
fi

# Compare check for each existing worktree (safe, read-only)
for wt_path in $(git worktree list --porcelain | grep "^worktree " | cut -d' ' -f2-); do
    branch=$(git -C "$wt_path" branch --show-current 2>/dev/null)
    [[ -z "$branch" ]] && continue
    native_dirty=$(cd "$wt_path" && [[ -n "$(git status --porcelain)" ]] && echo "dirty" || echo "clean")
    cli_dirty=$($SIDEQUEST_CMD worktree check "$branch" 2>/dev/null | jq -r 'if .dirty then "dirty" else "clean" end')
    if [[ "$native_dirty" != "$cli_dirty" ]]; then
        log_discrepancy "check:$branch" "$native_dirty" "$cli_dirty"
    fi
done

echo "Validation complete. Discrepancies: $(wc -l < "$LOG" 2>/dev/null || echo 0)"
```

### tmux session verification

```bash
# After create_ai_session, verify layout:
tmux list-windows -t "$session_name" -F '#{window_name}'
# Expected: ai, git, shell

tmux list-panes -t "$session_name:ai" -F '#{pane_current_command}'
# Expected: 4 panes
```

### tmux popup PATH verification

```bash
# Run once during setup to verify bunx is reachable from tmux context:
tmux display-popup -E 'which bunx && bunx --version || echo "FAIL: bunx not on PATH"'
```

---

## 8. Implementation Sequence

```
Step 1: Add USE_SIDEQUEST toggle to worktree-ai.sh (Phase 1)
        - Preflight checks: bunx, jq
        - Create ensure_worktree_sidequest() wrapper (stdout/stderr separation)
        - Create list_for_picker_sidequest() wrapper
        - Pass --no-fetch --no-install, handle install separately after node switch
        - Keep all native code intact
        Depends on: @side-quest/git P0.1 (smart install + worktree install subcommand) + P0.3 (attach)

Step 2: Add USE_SIDEQUEST toggle to worktree-delete.sh (Phase 1)
        - Create batch_delete_sidequest() wrapper
        - Create list_for_picker_sidequest() wrapper
        Depends on: @side-quest/git P0.4 (orphans) + P0.5 (clean)

Step 3: Validation (Phase 2)
        - Run validate-migration.sh via alias for 1 week
        - Compare list/check output only (read-only, idempotent)
        - Log discrepancies to ~/.cache/tmux-worktree-validation.log
        - Fix discrepancies
        Depends on: Steps 1-2

Step 4: Cutover (Phase 3)
        - Flip USE_SIDEQUEST default to 1
        - Monitor for 1 week

Step 5: Cleanup (Phase 4)
        - Remove native git code paths
        - Scripts drop from ~770 to ~200 lines
        Depends on: Confidence from Step 4
```

---

## 9. tmux.conf Binding Changes

**No changes needed** during migration. The bindings still call the same bash scripts:

```tmux
bind -T ai-agents w run-shell 'tmux display-popup -w 80% -h 70% -E "$HOME/code/dotfiles/bin/tmux/worktree-ai.sh" ...'
bind -T ai-agents W display-popup -w 80% -h 70% -E "$HOME/code/dotfiles/bin/tmux/worktree-delete.sh"
```

The scripts' internal implementation changes; the external interface stays identical.

---

## 10. @side-quest/core Utility Impact on CLI Contracts

The bash migration depends on `@side-quest/git` CLI producing reliable JSON output. Here's how `@side-quest/core` utilities strengthen the CLI that bash will consume.

**Important distinction:** This section documents what the CLI MUST use (not just what's available). These are implementation requirements for `@side-quest/git`, not aspirational mappings.

### Core utilities required for bash integration reliability

| CLI behavior bash depends on | Core utility in @side-quest/git | Status |
|------------------------------|-------------------------------|--------|
| JSON output never corrupted | `safeJsonStringify` from `@side-quest/core/utils` | **Must add** -- cli.ts currently uses raw `JSON.stringify` |
| Error shape always `{"error": "..."}` | `getErrorMessage` + `StructuredError` from `@side-quest/core/errors` | **Must add** -- cli.ts currently uses raw `Error` |
| File copy skips existing (sync) | `sha256File` from `@side-quest/core/fs` for content comparison | **Must add** -- copy-files.ts currently overwrites |
| Package manager detection matches bash | `findUpSync('package.json')` + `readJsonFileSync` from `@side-quest/core/fs` | **Must add** `packageManager` field check to detect-pm.ts |
| Install timeout works | `spawnWithTimeout` from `@side-quest/core/spawn` | **Must add** -- P0.1 requirement |
| Batch clean is safe | `processInParallelChunks` from `@side-quest/core/concurrency` | Future (P0.5) |
| Glob patterns validated on config load | `validateGlob` from `@side-quest/core/validation` | **Must add** -- config.ts doesn't validate patterns |
| Config path traversal blocked | `validatePathSafety` from `@side-quest/core/fs` | **Must add** -- copy-files.ts doesn't validate |

### Core utilities that improve test confidence for bash migration

| Test need | Core utility | Import |
|-----------|-------------|--------|
| Create test git repos | `setupTestDir` + `spawnAndCollect` for `git init` | `@side-quest/core/testing` + `@side-quest/core/spawn` |
| Write test config files | `writeTestFile` | `@side-quest/core/testing` |
| Verify file existence after copy | `testFileExists` | `@side-quest/core/testing` |
| Verify file content matches | `readTestFile` + `deepEquals` | `@side-quest/core/testing` + `@side-quest/core/fs` |
| Clean up after each test | `cleanupTestDir` | `@side-quest/core/testing` |
| Compare mtime for install detection | `statSync` | `@side-quest/core/fs` |

### Upstream contributions triggered by migration gaps

The bash-to-CLI migration also surfaces utilities worth upstreaming to `@side-quest/core`:

| Utility | Target module | Why the migration needs it |
|---------|--------------|---------------------------|
| `getMainWorktreeRoot(cwd)` | `@side-quest/core/git` | Bash's `get_repo_root()` uses `--git-common-dir`. TypeScript's `getGitRoot()` uses `--show-toplevel` (wrong inside worktrees). The CLI needs this fixed before bash can trust it. |
| `appendJsonlSync(filePath, record)` | `@side-quest/core/fs` | Event bus JSONL persistence. Currently manual `appendToFileSync(path, JSON.stringify(record) + '\n')`. Generic enough for any structured log. |
| `readJsonlSync<T>(filePath)` | `@side-quest/core/fs` | Event bus query replay. Currently manual `readLinesSync` + `safeJsonParse` per line. |
| `fireAndForget(fn, timeoutMs)` | `@side-quest/core/concurrency` | Every hook POST to event bus. `withTimeout` + silent catch is copy-pasted across 5 hooks. |

These are discovered during implementation, proven locally, then contributed upstream. The migration doesn't block on them -- local implementations work fine -- but upstreaming prevents duplication as the ecosystem grows.

### What this means for Phase 2 validation

When running native bash and CLI side-by-side during Phase 2, the core utilities ensure:

1. **`sha256File`** makes content comparison deterministic -- if bash and CLI produce the same file, hashes match
2. **`spawnWithTimeout`** ensures install never hangs -- bash has its own timeout, but CLI matching it prevents divergence
3. **`safeJsonStringify`** means `jq` parsing never fails on malformed JSON
4. **`validateGlob`** means `.worktrees.json` patterns can't cause unexpected behavior differences

---

## 11. Review Findings Addressed

This plan was reviewed by a staff engineer. Here's the resolution status of all findings:

### BLOCKING (3) -- all resolved

| # | Finding | Resolution |
|---|---------|-----------|
| 1.1 | `2>&1` merges stderr into JSON | Fixed: Section 5 now uses `2>"$stderr_file"` with separate stderr capture. Protocol defined in Section 3. |
| 2.1 | `attached` field missing from create | Documented: Section 3 marks `attached` as blocked on P0.3. Test marked as SKIP until P0.3 ships. |
| 3.1 | Gap #3 install ownership unresolved | Resolved: Section 2c -- **CLI owns installation**. Full parity table added. Node version sequencing solved via `--no-install` + separate `worktree install` subcommand. |

### SHOULD-FIX (13) -- all resolved

| # | Finding | Resolution |
|---|---------|-----------|
| 1.2 | No bunx availability check | Fixed: Section 4/5 -- preflight `command -v bunx` with fallback to `USE_SIDEQUEST=0` |
| 1.3 | Phase 2 dual-execution creates worktrees twice | Fixed: Section 4 -- Phase 2 now validates read-only commands only (list, check). |
| 1.4 | Rollback doesn't cover partial state | Fixed: Section 5 -- wrapper runs `git worktree prune` on CLI failure. |
| 2.2 | stderr handling unspecified | Fixed: Section 3 -- explicit protocol: exit 0 = stdout JSON, exit non-zero = stderr JSON. |
| 2.3 | `commitsAhead` missing from list | Fixed: Section 3 -- `commitsAhead` and `status` fields added to list and check contracts. |
| 2.5 | No `status` field on list items | Fixed: Section 3 -- `status` string field added ("pristine" / "merged" / "N ahead" / "unknown"). |
| 3.2 | `WORKTREE_COPY_PATTERNS` env var migration | Fixed: Gap #6 added to Section 2b. CLI reads env vars as fallback, warns on conflict. Risk table updated. |
| 3.3 | `shouldRunInstall()` mtime check unspecified | Fixed: Gap #7 added to Section 2b. References `statSync` from core. |
| 3.5 | `detectPackageManager()` returns command not name | Fixed: Gap #2 updated -- separate `detectPackageManager()` (returns name) and `detectInstallCommand()` (returns full command). |
| 4.1 | `git fetch` hangs on slow network | Fixed: Section 5/6 -- bash passes `--no-fetch` by default. Risk table updated. |
| 4.3 | Concurrent tmux popups race condition | Documented: Risk table -- known limitation, same as bash, consider `flock` in future. |
| 4.5 | tmux popup may not have user's PATH | Fixed: Section 6 risk table + Section 7 tmux popup PATH verification test added. |
| 5.1 | Test repo too simple | Fixed: Section 7 -- test now creates package.json, lockfile, .env, .claude/, .worktrees.json. |

### NIT (7) -- all resolved

| # | Finding | Resolution |
|---|---------|-----------|
| 2.4 | `branchesDeleted` field missing from clean | Fixed: Section 3 -- `branchesDeleted` field added to clean contract. |
| 3.4 | `list_remote_branches()` / `list_local_branches()` not mentioned | Fixed: Section 1 -- explicitly listed as staying in bash with explanation. |
| 3.6 | `develop` fallback missing | Fixed: Gap #8 added to Section 2b. |
| 4.2 | Disk space not addressed | Fixed: Risk table -- CLI propagates clear error message. |
| 4.4 | bunx cold start 3-5s | Fixed: Risk table -- document `bun add -g` as perf optimization. |
| 5.2 | No monorepo testing | Fixed: Section 7 "Known limitations" -- documented as out of scope for v1. |
| 5.3 | No submodule testing | Fixed: Section 7 "Known limitations" -- documented as known gap. |
| 5.4 | No error path testing | Fixed: Section 7 -- integration test now includes invalid branch name and non-git directory error cases. |
| 5.5 | Phase 2 validation not automated | Fixed: Section 7 -- `validate-migration.sh` script with logging to file. |
| 6.1 | Core utilities cited but not used | Fixed: Section 10 -- reframed as "must add" requirements, not aspirational. Each marked with current status. |
| 6.2 | `validateGlob`/`validatePathSafety` not called | Fixed: Section 10 -- marked as "must add" to config.ts and copy-files.ts. |
| 6.3 | Upstream contributions tangential | Kept but shortened. These are relevant because the migration surfaces the need (especially `getMainWorktreeRoot`). |

### Additional finding from review

| # | Finding | Resolution |
|---|---------|-----------|
| 7.1 | CLI install runs before Node version switch | Fixed: Section 6 "Node version switching" -- revised sequence: `create --no-install` -> `switch_node_version` -> `worktree install`. New `worktree install` subcommand added to P0.1 scope. |
