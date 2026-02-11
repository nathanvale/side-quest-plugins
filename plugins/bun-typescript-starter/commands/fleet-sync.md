---
name: fleet-sync
description: Audit and sync all downstream repos from bun-typescript-starter in parallel waves
argument-hint: "[--wave-size N] [--repos a,b,c] [--dry-run] [--workflows-only] [--settings-only]"
allowed-tools: Bash(git *), Bash(gh *), Bash(op *), Bash(python3 *), Bash(rm -rf /tmp/template-sync*), Bash(mkdir *), Read, Glob, Grep, Task, AskUserQuestion
---

# Fleet Sync

Audit and sync all downstream repos created from `nathanvale/bun-typescript-starter` in parallel waves.

## Usage

```
/bun-typescript-starter:fleet-sync
/bun-typescript-starter:fleet-sync --dry-run
/bun-typescript-starter:fleet-sync --repos side-quest-git,side-quest-core
/bun-typescript-starter:fleet-sync --wave-size 5
/bun-typescript-starter:fleet-sync --workflows-only
/bun-typescript-starter:fleet-sync --settings-only
```

## Arguments

- `--wave-size N` - Number of repos to audit/fix in parallel (default: 3)
- `--repos a,b,c` - Comma-separated list of specific repos to process (default: all discovered)
- `--dry-run` - Audit and report only, stop after Step 5
- `--workflows-only` - Skip settings/credentials, only sync workflow files
- `--settings-only` - Skip workflows/credentials, only fix repo settings and branch protection

You are a fleet sync orchestrator. Follow these 10 steps to audit and sync all downstream repos from the bun-typescript-starter template.

Load `references/fleet-sync.md` for the audit checklist, sync-eligible paths, known divergences, and cleanup strategy.

---

## Step 1: Parse Canonical Settings

Extract the expected repo settings dynamically from the template's source of truth. Do NOT hardcode settings -- parse them at runtime so this command stays in sync automatically.

### Branch protection payload

Discover the template repo path dynamically. Check for a `TEMPLATE_REPO_PATH` environment variable first, then fall back to `~/code/bun-typescript-starter`:

```bash
TEMPLATE_REPO="${TEMPLATE_REPO_PATH:-$HOME/code/bun-typescript-starter}"
```

Read `$TEMPLATE_REPO/scripts/setup-protect.ts` and extract the `protectionPayload` JSON from the `JSON.stringify({...})` call (lines 68-84). Parse this into a variable for later comparison. This is the canonical branch protection config.

### Merge and workflow settings

Read the `commands/create.md` file and extract the two `gh api` calls in Step 5:

1. **Workflow permissions** - the `actions/permissions/workflow` PUT call:
   - `default_workflow_permissions=write`
   - `can_approve_pull_request_reviews=true`

2. **Merge settings** - the repo PATCH call:
   - `allow_squash_merge=true`
   - `allow_merge_commit=false`
   - `allow_rebase_merge=false`
   - `delete_branch_on_merge=true`
   - `allow_auto_merge=true`

Store these as the expected state for comparison in Step 4.

---

## Step 2: Discover Repos

Find all downstream repos created from the template.

```bash
gh repo list nathanvale --json name,isTemplate,templateRepository,isArchived,pushedAt \
  --limit 100 --jq '
    [.[] | select(
      .templateRepository.name == "bun-typescript-starter"
      or .name == "bun-typescript-starter"
    ) | select(.isArchived == false)]
  '
```

Parse the results into a list of `owner/repo` pairs with their last push date.

---

## Step 3: Triage

Present the discovered repos to the user for classification.

Split repos into categories:
- **Production** - Active repos with recent pushes and real package names
- **Test/Toy** - Repos that look like experiments (e.g., names containing "test", "playground", "scratch")
- **Template** - The `bun-typescript-starter` repo itself (audit but don't sync)

Use AskUserQuestion (multiSelect) to confirm:
1. Which repos to include in the audit
2. Which repos to skip entirely
3. Which repos to archive (mark as test/toy)

If `--repos` flag was provided, skip triage and use the specified repos.

---

## Step 4: Audit

Check each repo's infrastructure health against the template. Run in **parallel waves** using the Task tool with Explore agents.

### Pre-audit: Template changelog

Before launching audit waves, gather the template's recent infrastructure changes:

```bash
git -C "$TEMPLATE_REPO" log --oneline --no-merges -- \
  .github/ .husky/ biome.json commitlint.config.mjs scripts/setup-protect.ts
```

This produces a list of template improvements (e.g., "remove 1Password dependency", "bump harden-runner", "handle 403/404 in pre-push"). Each audit agent uses this to report which improvements are missing per repo.

### Audit agent prompt

For each wave of repos, launch Task agents (subagent_type: general-purpose) with this prompt template. The audit requires shell operations (git clone, gh api, grep, diff) so the agent must have Bash access. Replace `{REPO}`, `{OWNER}`, `{PROTECTION_PAYLOAD}`, `{MERGE_SETTINGS}`, `{WORKFLOW_PERMS}`, and `{TEMPLATE_CHANGELOG}` with actual values:

```
Audit the GitHub repository {OWNER}/{REPO} against the bun-typescript-starter template.

Check these 12 items and report status for each (pass/fail/warning):

1. **Workflow files** - Compare .github/workflows/ against template.
   Clone to /tmp/template-sync-audit/{REPO}, add template remote, fetch.
   ```bash
   git clone --depth 1 https://github.com/{OWNER}/{REPO}.git /tmp/template-sync-audit/{REPO}
   cd /tmp/template-sync-audit/{REPO}
   git remote add template https://github.com/nathanvale/bun-typescript-starter.git
   git fetch template main --depth 1
   git diff HEAD..template/main --stat -- .github/workflows/
   ```

2. **Action version drift** - Check if action SHAs in workflows match template versions.
   Compare the SHA pinned versions of key actions (actions/checkout, step-security/harden-runner, etc.)

3. **1Password remnants** - Search for `load-secrets-action` or `OP_SERVICE_ACCOUNT_TOKEN` in workflow YAML:
   ```bash
   grep -r "load-secrets-action\|OP_SERVICE_ACCOUNT_TOKEN" /tmp/template-sync-audit/{REPO}/.github/ || echo "CLEAN"
   ```

4. **Legacy release.yml** - Check if the old `release.yml` still exists (should be removed, consolidated into publish.yml):
   ```bash
   [ -f /tmp/template-sync-audit/{REPO}/.github/workflows/release.yml ] && echo "PRESENT" || echo "CLEAN"
   ```

5. **APP_ID/APP_PRIVATE_KEY** - Check if these credentials are set:
   ```bash
   gh variable list --repo {OWNER}/{REPO} --json name --jq '.[].name' | grep -q APP_ID && echo "SET" || echo "MISSING"
   gh secret list --repo {OWNER}/{REPO} --json name --jq '.[].name' | grep -q APP_PRIVATE_KEY && echo "SET" || echo "MISSING"
   ```

6. **Branch protection** - Fetch current protection and compare against expected:
   ```bash
   gh api repos/{OWNER}/{REPO}/branches/main/protection 2>&1
   ```
   Expected payload: {PROTECTION_PAYLOAD}

7. **Merge settings** - Check repo settings:
   ```bash
   gh api repos/{OWNER}/{REPO} --jq '{
     allow_squash_merge, allow_merge_commit, allow_rebase_merge,
     delete_branch_on_merge, allow_auto_merge
   }'
   ```
   Expected: {MERGE_SETTINGS}

8. **Workflow permissions** - Check Actions permissions:
   ```bash
   gh api repos/{OWNER}/{REPO}/actions/permissions/workflow 2>&1
   ```
   Expected: {WORKFLOW_PERMS}

9. **Pre-push hook** - Check if .husky/pre-push exists and matches template:
   ```bash
   diff /tmp/template-sync-audit/{REPO}/.husky/pre-push <(git -C /tmp/template-sync-audit/{REPO} show template/main:.husky/pre-push) 2>/dev/null || echo "DIFFERS or MISSING"
   ```

10. **Dependabot config** - Check .github/dependabot.yml exists and matches:
    ```bash
    diff /tmp/template-sync-audit/{REPO}/.github/dependabot.yml <(git -C /tmp/template-sync-audit/{REPO} show template/main:.github/dependabot.yml) 2>/dev/null || echo "DIFFERS or MISSING"
    ```

11. **biome.json** - Check if biome config matches template:
    ```bash
    diff /tmp/template-sync-audit/{REPO}/biome.json <(git -C /tmp/template-sync-audit/{REPO} show template/main:biome.json) 2>/dev/null || echo "DIFFERS or MISSING"
    ```

12. **Template improvements** - Check which of these template commits are NOT reflected in the downstream repo's files:
    {TEMPLATE_CHANGELOG}
    For each commit, check if the changed file in the downstream repo matches the template version. Report "missing N template improvements" with specific commit descriptions.

Clean up: rm -rf /tmp/template-sync-audit/{REPO}

Return a structured report:
- Repo: {OWNER}/{REPO}
- Overall status: GREEN (all pass) / YELLOW (warnings) / RED (failures)
- Per-check results table
- Missing template improvements list
- Recommended actions
```

### Wave execution

Process repos in waves of `--wave-size` (default 3):

```
Wave 1: [repo1, repo2, repo3]  -- launch 3 Task agents in parallel
Wave 2: [repo4, repo5, repo6]  -- after wave 1 completes
...
```

Collect all audit results before proceeding.

---

## Step 5: Report

Aggregate audit results into a summary table.

### Tier classification

- **GREEN** - All checks pass, fully in sync with template
- **YELLOW** - Minor drift (action versions, non-critical settings, 1-2 missing improvements)
- **RED** - Critical issues (missing credentials, 1Password remnants, broken branch protection, legacy workflows)

### Report format

Present to the user:

```
Fleet Sync Audit Report
========================

GREEN (N repos):
  repo-a .................. fully synced
  repo-b .................. fully synced

YELLOW (N repos):
  repo-c .................. action version drift (harden-runner), missing 2 template improvements
  repo-d .................. merge settings drift (allow_rebase_merge=true)

RED (N repos):
  repo-e .................. 1Password remnants, missing APP_ID/APP_PRIVATE_KEY, legacy release.yml
  repo-f .................. branch protection not configured, missing 5 template improvements

Template Changelog (not yet applied):
  16dd204 fix(ci): allow dependabot GHA bumps to auto-merge
  c7a5ace fix(ci): remove 1Password dependency from workflows
  590b6d9 fix(hooks): handle 403/404 in pre-push branch protection check
  ...
```

### Scope selection

Use AskUserQuestion to ask what to fix:

- **Fix everything** - Credentials + settings + workflows for all YELLOW/RED repos
- **Workflows only** - Only sync workflow files (creates PRs)
- **Settings only** - Only fix repo settings and branch protection (immediate API calls)
- **Credentials only** - Only set APP_ID/APP_PRIVATE_KEY where missing
- **Select repos** - Choose specific repos to fix
- **Done (dry run)** - Stop here, just wanted the report

If `--dry-run` was passed, show the report and stop. Do not proceed to Steps 6-9.
If `--workflows-only` was passed, skip to Step 8.
If `--settings-only` was passed, skip to Step 7.

---

## Step 6: Fix Credentials

Set APP_ID and APP_PRIVATE_KEY on repos that are missing them.

### Extract credentials once

Pull credentials from 1Password a single time (avoids session expiry mid-run):

```bash
# App ID
APP_ID_VALUE=$(op item get "chatline-changesets-bot" --vault="API Credentials" --fields label="App Id" --reveal)

# Private key -- MUST use --format json to preserve PEM format
APP_PRIVATE_KEY_VALUE=$(op item get "chatline-changesets-bot" --vault="API Credentials" \
  --fields label=credential --reveal --format json \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['value'])")
```

**Why `--format json`**: Without it, `op item get --reveal` wraps multi-line PEM values in double quotes, corrupting the format. The `create-github-app-token` action then fails with `ERR_OSSL_UNSUPPORTED: DECODER routines::unsupported`.

### Apply to each repo

For each repo missing credentials, run in parallel (direct Bash, no sub-agents needed):

```bash
# Set APP_ID (variable, not secret)
gh variable set APP_ID --repo {OWNER}/{REPO} --body "$APP_ID_VALUE"

# Set APP_PRIVATE_KEY (secret)
gh secret set APP_PRIVATE_KEY --repo {OWNER}/{REPO} <<< "$APP_PRIVATE_KEY_VALUE"
```

### Remove legacy 1Password token

If the audit found `OP_SERVICE_ACCOUNT_TOKEN` as a secret:

```bash
gh secret delete OP_SERVICE_ACCOUNT_TOKEN --repo {OWNER}/{REPO} 2>/dev/null || true
```

Report which repos had credentials set/updated.

---

## Step 7: Fix Repo Settings

Apply merge settings, workflow permissions, and branch protection to drifted repos. Run in parallel (direct Bash calls, one per repo).

### Merge settings

For each repo with merge settings drift:

```bash
gh api repos/{OWNER}/{REPO} --method PATCH \
  -F allow_squash_merge=true \
  -F allow_merge_commit=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true \
  -F allow_auto_merge=true
```

### Workflow permissions

For each repo with workflow permission drift:

```bash
gh api repos/{OWNER}/{REPO}/actions/permissions/workflow \
  --method PUT \
  -f default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=true
```

### Branch protection

For each repo with branch protection drift, apply the payload parsed in Step 1:

```bash
gh api repos/{OWNER}/{REPO}/branches/main/protection \
  --method PUT \
  -H 'Accept: application/vnd.github+json' \
  --input - <<'PROTECTION_EOF'
<insert protection payload JSON from Step 1>
PROTECTION_EOF
```

If branch protection returned 404 (not configured at all), apply the full payload to set it up from scratch.

Report which repos had settings updated and what changed.

---

## Step 8: Fix Workflows

Sync workflow files from the template to downstream repos. Run in **parallel waves** using Task agents with Bash.

### Workflow fix agent prompt

For each wave of repos, launch Task agents (subagent_type: Bash) with this prompt. Replace `{REPO}`, `{OWNER}`, and `{CHANGED_FILES}` with actual values:

```
Sync template workflow files to {OWNER}/{REPO}.

1. Clone the repo and add template remote:
   ```bash
   mkdir -p /tmp/template-sync
   GIT_DIR="" GIT_WORK_TREE="" git clone https://github.com/{OWNER}/{REPO}.git /tmp/template-sync/{REPO}
   cd /tmp/template-sync/{REPO}
   git remote add template https://github.com/nathanvale/bun-typescript-starter.git
   git fetch template main
   ```

2. Check for existing sync PRs:
   ```bash
   EXISTING=$(gh pr list --repo {OWNER}/{REPO} --head chore/sync-template-upstream --json number --jq '.[0].number')
   if [ -n "$EXISTING" ]; then
     echo "SKIP: PR #$EXISTING already open"
     rm -rf /tmp/template-sync/{REPO}
     exit 0
   fi
   ```

3. Create sync branch:
   ```bash
   cd /tmp/template-sync/{REPO}
   git checkout -b chore/sync-template-upstream
   ```

4. Selective checkout of changed files:
   ```bash
   cd /tmp/template-sync/{REPO}
   # Only checkout files that exist on template/main to avoid pathspec errors
   # from downstream-only workflows or project-specific files
   for f in {CHANGED_FILES}; do
     git show template/main:"$f" >/dev/null 2>&1 && git checkout template/main -- "$f"
   done
   ```

   The changed files list comes from the audit diff. Filter to template-managed files only -- skip any downstream-only workflows that don't exist upstream. Always include:
   - Workflow files that differ from template (and exist on template/main)
   - `.husky/pre-push` if it differs
   - `biome.json` if it differs
   - `commitlint.config.mjs` if it differs

5. Delete legacy files if present:
   ```bash
   cd /tmp/template-sync/{REPO}
   [ -f .github/workflows/release.yml ] && git rm .github/workflows/release.yml
   ```

6. Commit:
   ```bash
   cd /tmp/template-sync/{REPO}
   git add -A
   git commit -m "chore: sync infrastructure from bun-typescript-starter

Synced files:
{CHANGED_FILES_LIST}

Template improvements included:
{TEMPLATE_IMPROVEMENTS_LIST}"
   ```

7. Push and create PR:
   ```bash
   cd /tmp/template-sync/{REPO}
   git push -u origin chore/sync-template-upstream

   gh pr create --repo {OWNER}/{REPO} \
     --title "chore: sync infrastructure from bun-typescript-starter" \
     --body "$(cat <<'PR_EOF'
## Summary

Synced infrastructure files from the upstream template.

### Files changed
{CHANGED_FILES_LIST}

### Template improvements included
{TEMPLATE_IMPROVEMENTS_LIST}

### Verification

- [ ] CI passes
- [ ] No unintended changes to project-specific files
PR_EOF
)"
   ```

8. Cleanup:
   ```bash
   rm -rf /tmp/template-sync/{REPO}
   ```

Report: PR URL if created, or SKIP reason.
```

### Wave execution

Process repos in waves of `--wave-size` (default 3), same as audit. Collect all PR URLs.

---

## Step 9: Cleanup

Handle post-sync housekeeping. Use AskUserQuestion to confirm before each action.

### Close superseded Dependabot PRs

For repos that just got workflow sync PRs, check for Dependabot PRs that update actions to versions now included in the sync:

```bash
# For each synced repo
gh pr list --repo {OWNER}/{REPO} --author "app/dependabot" --state open \
  --json number,title --jq '.[] | select(.title | test("bump.*github-actions|chore\\(gha\\)"))'
```

For each matching Dependabot PR, close with a comment:

```bash
gh pr close {PR_NUMBER} --repo {OWNER}/{REPO} \
  --comment "Superseded by template sync PR -- the action version bump is included in the infrastructure sync."
```

### Archive test repos

If any repos were marked for archival in Step 3:

```bash
gh repo archive {OWNER}/{REPO} --yes
```

Present the list of cleanup actions and confirm with AskUserQuestion before executing.

---

## Step 10: Summary

Print a final summary table of everything that was done.

```
Fleet Sync Summary
==================

Repos audited: N
  GREEN: N (no changes needed)
  YELLOW: N (minor fixes applied)
  RED: N (critical fixes applied)

Credentials set:
  repo-e .................. APP_ID + APP_PRIVATE_KEY set, OP_SERVICE_ACCOUNT_TOKEN removed
  repo-f .................. APP_ID + APP_PRIVATE_KEY set

Settings fixed:
  repo-c .................. merge settings updated
  repo-d .................. branch protection applied
  repo-f .................. workflow permissions + merge settings + branch protection

PRs created:
  repo-e .................. https://github.com/nathanvale/repo-e/pull/42
  repo-f .................. https://github.com/nathanvale/repo-f/pull/15

Dependabot PRs closed:
  repo-e#38 .............. bump step-security/harden-runner (superseded)

Repos archived:
  test-playground ........ archived

Repos skipped (already synced):
  repo-a, repo-b
```

If any repos had errors or partial failures, list them separately with the error details so the user can follow up manually.
