---
name: sync
description: Pull infrastructure upgrades from bun-typescript-starter into your downstream repo
disable-model-invocation: true
context: fork
allowed-tools: Bash(git *), Bash(gh *), Bash(bun *), Bash(diff *), Read, Glob, Grep, AskUserQuestion
---

# Sync Template Updates

Pull infrastructure upgrades from `nathanvale/bun-typescript-starter` into your downstream repo.

## Usage

```
/bun-typescript-starter:sync
```

## Examples

```
# From inside a repo created from bun-typescript-starter
/bun-typescript-starter:sync
```

You are a template sync assistant. Follow this workflow to pull upstream infrastructure changes into the current repo.

## Step 1: Detect Downstream Repo

Verify the current working directory is a repo derived from `bun-typescript-starter`. Check in order:

1. **Git remote**: Does a `template` remote already exist?
   ```bash
   git remote get-url template 2>/dev/null
   ```

2. **GitHub API**: Does the repo know its template?
   ```bash
   gh api repos/{owner}/{repo} --jq '.template_repository.full_name' 2>/dev/null
   ```

3. **File fingerprint**: Look for telltale files that only exist in bun-typescript-starter derivatives:
   - `.changeset/config.json` with `@changesets/changelog-github`
   - `bunup.config.ts`
   - `.github/workflows/pr-quality.yml` with the "All checks passed" gate pattern
   - `commitlint.config.mjs` with the same rule set

If none of these match, warn the user: "This doesn't look like a bun-typescript-starter repo. Are you sure you want to continue?" Use AskUserQuestion to confirm.

## Step 2: Ensure Template Remote

If the `template` remote doesn't exist, add it:

```bash
git remote add template https://github.com/nathanvale/bun-typescript-starter.git
```

Then fetch:

```bash
git fetch template --no-tags
```

## Step 3: Preview Changes

Show what's changed upstream, filtered to **infrastructure files only**.

These are the sync-eligible paths (infrastructure that should be kept in sync):

```
.github/workflows/**
.github/scripts/**
.github/actions/**
.github/dependabot.yml
.husky/**
biome.json
commitlint.config.mjs
tsconfig.base.json
.editorconfig
.pre-commit-config.yaml
.bun-version
.nvmrc
```

These paths are **excluded** (project-specific, never sync):

```
src/**
tests/**
scripts/setup.ts
package.json
bun.lock
README.md
CHANGELOG.md
LICENSE
.changeset/**
.claude/**
bunup.config.ts
tsconfig.json
tsconfig.eslint.json
```

Generate the filtered diff:

```bash
git diff HEAD...template/main -- \
  .github/ \
  .husky/ \
  biome.json \
  commitlint.config.mjs \
  tsconfig.base.json \
  .editorconfig \
  .pre-commit-config.yaml \
  .bun-version \
  .nvmrc
```

Also show a summary of which files have changes:

```bash
git diff HEAD...template/main --stat -- \
  .github/ \
  .husky/ \
  biome.json \
  commitlint.config.mjs \
  tsconfig.base.json \
  .editorconfig \
  .pre-commit-config.yaml \
  .bun-version \
  .nvmrc
```

If there are no changes, report "You're up to date with the template!" and stop.

## Step 4: Present Options

Show the user the file-level summary and ask how they want to proceed using AskUserQuestion:

- **Apply all** — Merge all infrastructure changes in one go
- **Select files** — Cherry-pick which files to update
- **Preview full diff** — Show the complete diff before deciding
- **Cancel** — Do nothing

## Step 5: Apply Changes

### Apply All

Check out the infrastructure files from the template:

```bash
git checkout template/main -- <file1> <file2> ...
```

Only check out files that appeared in the diff (don't blindly check out all sync-eligible paths — that would overwrite intentional local customizations in files that haven't changed upstream).

Stage and commit:

```bash
git add .
git commit -m "chore: sync infrastructure from bun-typescript-starter"
```

### Select Files

If the user chose to select files, present the list of changed files and let them pick which ones to apply using AskUserQuestion (multiSelect). Then checkout only those files:

```bash
git checkout template/main -- <selected-file1> <selected-file2> ...
git add .
git commit -m "chore: sync selected files from bun-typescript-starter"
```

## Step 6: Handle Local Customizations

**Important**: `git checkout template/main -- <file>` silently overwrites local changes without merging. Before applying, check for local customizations in each file:

```bash
# For each file, compare local version with template version BEFORE overwriting
for file in <file1> <file2>; do
  if ! diff -q "$file" <(git show template/main:"$file") >/dev/null 2>&1; then
    echo "=== $file has local customizations ==="
    diff "$file" <(git show template/main:"$file")
  fi
done
```

For files with local customizations, ask the user how to resolve using AskUserQuestion:
- **Use template version** — Replace local file entirely with `git checkout template/main -- <file>`
- **Keep local version** — Skip this file
- **Manual merge** — Show both versions side-by-side, let the user decide what to keep

## Step 7: Post-Sync

After applying changes:

1. **Run validation**:
   ```bash
   bun run validate
   ```

2. **Show what was updated**: List the files that were synced with a brief description of what changed.

3. **Warn about package.json drift**: If the template has new devDependencies that the downstream repo is missing, mention them:
   ```bash
   # Compare devDependencies
   diff <(git show template/main:package.json | jq -r '.devDependencies | keys[]' | sort) \
        <(jq -r '.devDependencies | keys[]' package.json | sort)
   ```
   If there are new deps, suggest the user review and add them manually.

4. **Check branch protection drift**: Compare the repo's branch protection against the template's expected settings. This catches settings drift that file sync can't detect (e.g., missing required status checks, disabled conversation resolution).

   First, detect the repo owner and name:
   ```bash
   gh api repos/{owner}/{repo} --jq '.full_name'
   ```

   Then fetch the current branch protection and check each expected setting:
   ```bash
   # Get current branch protection as JSON
   gh api repos/{owner}/{repo}/branches/main/protection 2>&1
   ```

   Compare against these expected settings from the template's setup script:

   | Setting | Expected Value |
   |---------|---------------|
   | `required_status_checks.strict` | `true` |
   | `required_status_checks.checks` | Must include `{"context": "All checks passed"}` and `{"context": "CodeRabbit"}` |
   | `enforce_admins.enabled` | `true` |
   | `required_pull_request_reviews.dismiss_stale_reviews` | `true` |
   | `required_pull_request_reviews.required_approving_review_count` | `0` |
   | `required_linear_history.enabled` | `true` |
   | `required_conversation_resolution.enabled` | `true` |
   | `allow_force_pushes.enabled` | `false` |
   | `allow_deletions.enabled` | `false` |

   Report drift as a table showing each setting, expected value, and actual value. Only show rows that differ.

   If there is drift, ask the user with AskUserQuestion:
   - **Fix all** - Apply the expected branch protection settings via `gh api`
   - **Skip** - Leave branch protection as-is

   To fix, send the full protection payload:
   ```bash
   gh api repos/{owner}/{repo}/branches/main/protection \
     --method PUT \
     -H 'Accept: application/vnd.github+json' \
     --input - <<'EOF'
   {
     "required_status_checks": {
       "strict": true,
       "checks": [
         {"context": "All checks passed"},
         {"context": "CodeRabbit"}
       ]
     },
     "enforce_admins": true,
     "required_pull_request_reviews": {
       "dismiss_stale_reviews": true,
       "require_code_owner_reviews": false,
       "required_approving_review_count": 0
     },
     "restrictions": null,
     "required_linear_history": true,
     "required_conversation_resolution": true,
     "allow_force_pushes": false,
     "allow_deletions": false
   }
   EOF
   ```

   If branch protection is not configured at all (404 response), report this and offer to set it up from scratch using the same payload.

5. **Suggest next steps**:
   - Review the changes: `git diff HEAD~1`
   - Run tests: `bun test`
   - If anything breaks, revert: `git revert HEAD`
