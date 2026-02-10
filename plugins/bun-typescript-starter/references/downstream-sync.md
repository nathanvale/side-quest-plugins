# Downstream Sync

How to keep repos created from `nathanvale/bun-typescript-starter` in sync with template improvements.

## The Problem

GitHub template repos don't preserve commit history. When you "Use this template," the new repo gets a clean initial commit with no link back to the template. There's no built-in mechanism to pull future template updates.

## Strategy 1: `actions-template-sync` (Recommended)

[actions-template-sync](https://github.com/AndreasAugustin/actions-template-sync) is a GitHub Action that automatically syncs downstream repos with their source template.

### Setup

Add this workflow to your downstream repo (`.github/workflows/template-sync.yml`):

```yaml
name: Template Sync
on:
  schedule:
    - cron: '0 3 * * 1'  # Weekly Monday 03:00 UTC
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: AndreasAugustin/actions-template-sync@v6
        with:
          source_repo_path: nathanvale/bun-typescript-starter
          upstream_branch: main
          pr_title: 'chore: sync with upstream template'
          pr_labels: template-sync
```

### How It Works

1. Fetches latest from the template repo
2. Compares with current downstream repo
3. Opens a PR with any differences
4. You review and merge (resolving conflicts as needed)

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `source_repo_path` | Required | Template repo (`owner/repo`) |
| `upstream_branch` | `main` | Branch to sync from |
| `pr_title` | | Title for sync PRs |
| `pr_labels` | | Labels to add to sync PRs |
| `ignore_path_pattern` | | Glob patterns to exclude from sync |

### Recommended Ignore Patterns

```yaml
ignore_path_pattern: |
  src/**
  tests/**
  README.md
  CHANGELOG.md
  package.json
```

This syncs only infrastructure files (workflows, configs, hooks) while ignoring your project-specific code.

## Strategy 2: Selective File Checkout (Recommended for Manual Sync)

Precise control over which files to sync, skipping project-specific divergences.

### Setup (one-time)

```bash
git remote add template git@github.com:nathanvale/bun-typescript-starter.git
```

### Sync Workflow

```bash
# 1. Fetch latest template
git fetch template main

# 2. Compare infra files only (skip src/, tests/, package.json)
git diff main..template/main --stat -- '.github/' '.husky/' '.changeset/config.json'

# 3. Review the full diff to understand changes
git diff main..template/main -- '.github/' '.husky/'

# 4. Create a sync branch
git checkout -b chore/sync-template-upstream

# 5. Checkout specific files from template
git checkout template/main -- \
  .github/workflows/pr-quality.yml \
  .github/workflows/publish.yml \
  .github/workflows/version-packages-auto-merge.yml \
  .husky/pre-push

# 6. Delete files removed in template
git rm .github/workflows/release.yml  # if present

# 7. Commit, push, PR
git commit -m "chore: sync workflow and husky files from template"
git push -u origin chore/sync-template-upstream
gh pr create --title "chore: sync with upstream template"
```

### Common Intentional Divergences (Skip These)

| File | Reason |
|------|--------|
| `.changeset/config.json` | Has real repo name vs template `{{PLACEHOLDER}}` |
| `scripts/setup.ts` | Template scaffolding, not needed in real projects |
| `node-compat.yml` | Remove if repo has Bun-only dependencies |
| `package.json` | Project-specific deps, scripts, exports |
| `src/**`, `tests/**` | Project code |

## Strategy 3: Git Remote Upstream (Full Merge)

Merges all template changes. Use when divergences are minimal.

### Setup (one-time)

```bash
git remote add template git@github.com:nathanvale/bun-typescript-starter.git
```

### Pull Template Updates

```bash
git fetch template
git merge template/main --allow-unrelated-histories
# Resolve conflicts
git push
```

### Push Fixes Upstream

When you find a template bug while using it, create a branch and PR rather than pushing directly to main:

```bash
# Fix the issue in your project, then push to a branch on the template
git add . && git commit -m "fix: description"

# Create a fix branch on the template (never push directly to main)
git push template HEAD:fix/<short-description>

# Create PR via GitHub CLI
gh pr create --repo nathanvale/bun-typescript-starter \
  --head fix/<short-description> \
  --title "fix: description" \
  --body "Fix discovered in downstream repo"
```

**Warning**: Never push directly to `template/main` — it bypasses branch protection and CI checks, and could break all downstream repos. Always use a branch and PR.

**Note**: Pushing upstream requires write access to the template repo. Alternatively, use `/bun-typescript-starter:fix` which handles the full workflow.

## Strategy 3: Manual Cherry-Pick

For one-off fixes when you don't want automated sync.

### From Template to Downstream

```bash
# In your downstream repo
git remote add template git@github.com:nathanvale/bun-typescript-starter.git
git fetch template

# Cherry-pick specific commits
git cherry-pick <commit-sha>

# Or diff and apply manually
git diff template/main -- .github/ | git apply
```

### From Downstream to Template

```bash
# In the template repo (or use /bun-typescript-starter:fix)
# Identify the fix commit in downstream
git cherry-pick <commit-sha>
# Or manually recreate the fix
```

## Strategy 4: Manual Diff-Based

For maximum control over what gets synced.

```bash
# Clone template to temp location
git clone git@github.com:nathanvale/bun-typescript-starter.git /tmp/template

# Compare specific directories
diff -rq /tmp/template/.github your-project/.github
diff -rq /tmp/template/.husky your-project/.husky

# Selectively copy updated files
cp /tmp/template/.github/workflows/pr-quality.yml your-project/.github/workflows/
```

## Recommendations

| Scenario | Strategy |
|----------|----------|
| Multiple downstream repos, ongoing sync | `actions-template-sync` |
| Single downstream repo, frequent updates | Git remote upstream |
| One-off fix from specific commit | Cherry-pick |
| Cautious, selective updates | Manual diff |

The `/bun-typescript-starter:create` command offers to install `actions-template-sync` during setup.
