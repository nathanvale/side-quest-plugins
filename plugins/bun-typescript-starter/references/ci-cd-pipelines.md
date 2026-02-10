# CI/CD Pipelines

## Overview

15 GitHub Actions workflows organized into quality gates, release automation, and security scanning.

## Workflow Inventory

### Quality Gates (PR/Push)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-quality.yml` | PR + push to main | **Primary CI**: lint, typecheck, test, coverage, quality delta |
| `pr-title.yml` | PR (opened/edited) | Validate PR title follows conventional commit format |
| `commitlint.yml` | PR + push to main | Validate commit messages |
| `package-hygiene.yml` | PR + push to main | publint, are-the-types-wrong, dry-pack artifact |
| `workflow-lint.yml` | PR (workflow changes) | actionlint + schema validation on workflow YAML |

### Release Automation

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `publish.yml` | Push to main + manual | **Primary release**: version PR, publish, pre-release, snapshot (consolidated) |
| `pre-mode.yml` | Manual only | Toggle Changesets pre-release mode (beta/rc/next) |
| `alpha-snapshot.yml` | Daily cron + manual | Publish alpha snapshots when in pre-mode |
| `tag-assets.yml` | Tag push (`v*.*.*`) | Create GitHub release with SBOM |
| `version-packages-auto-merge.yml` | PR (version packages) | Auto-merge Changesets version PRs |
| `autogenerate-changeset.yml` | PR | Auto-generate changeset file if missing |

### Security & Maintenance

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `codeql.yml` | PR + push + weekly | CodeQL static analysis (JS/TS) |
| `security.yml` | Weekly + manual | OSV-Scanner vulnerability scan |
| `dependency-review.yml` | PR | Advisory dependency vulnerability check |
| `dependabot-auto-merge.yml` | PR | Auto-merge minor/patch dev dependency updates |

## Key Workflow Details

### `pr-quality.yml` (Primary CI)

Jobs chain: `lint` + `typecheck` -> `test` -> `quality` -> `gate`

- **lint**: `biome check .`
- **typecheck**: `tsc -p tsconfig.eslint.json --noEmit`
- **test**: `bun test --coverage` with JUnit output, coverage comment on PR
- **quality**: Repository quality delta check since main
- **lint-scripts**: ShellCheck on `.github/scripts/*.sh`
- **gate**: Aggregates all results, writes summary table

**Bun 1.3.x linker workaround**: Cleans leaked package folders before test:
```yaml
- name: Clean Bun linker artifacts
  run: |
    for pkg in $(jq -r '.devDependencies | keys[]' package.json); do
      base=$(echo "$pkg" | sed 's|@.*/||')
      [ -d "$base" ] && rm -rf "$base"
    done
```

### `publish.yml` (Release Automation)

Four intents via `workflow_dispatch`:
- **auto** (default on push): Opens version PR or publishes stable release
- **version**: Creates pre-release version bump PR with auto-merge
- **publish**: Publishes pre-release to npm
- **snapshot**: Canary snapshot publish

Uses OIDC trusted publishing (npm 11.6+ on Node 24). Falls back to `NPM_TOKEN` secret.

**GitHub App token (anti-recursion bypass)**: `publish.yml` uses a GitHub App token (via `vars.APP_ID` + `secrets.APP_PRIVATE_KEY`) instead of `GITHUB_TOKEN` for all git operations. This is critical because `GITHUB_TOKEN` pushes don't trigger `pull_request_target` events (GitHub's anti-recursion policy), which would prevent `version-packages-auto-merge.yml` from firing on version packages PRs. The App token bypasses this, completing the automated release chain: publish -> version PR -> auto-merge -> publish.

**Registry conflict fix**: Removes `bunfig.toml` registry entry that conflicts with npm's auth:
```yaml
- name: Fix bunfig registry conflict
  run: sed -i '/registry/d' bunfig.toml 2>/dev/null || true
```

**Note**: Uses Linux `sed -i` syntax (no empty string arg) since this runs on `ubuntu-latest`. macOS BSD sed requires `sed -i ''` instead.

## Security Hardening

All workflows follow these patterns:
- **Harden Runner**: `step-security/harden-runner` with `egress-policy: audit`
- **Pinned actions**: All action refs use full SHA hashes (not tags)
- **Minimal permissions**: Each workflow declares only needed permissions
- **Concurrency groups**: Prevent parallel runs with `cancel-in-progress: true` (except publish)

## Secrets Required

| Secret | Used By | Purpose |
|--------|---------|---------|
| `GITHUB_TOKEN` | Most workflows | Default GitHub token |
| `NPM_TOKEN` | publish, alpha-snapshot | npm auth (fallback for OIDC) |
| `APP_PRIVATE_KEY` (secret) | publish, version-packages-auto-merge | GitHub App private key for anti-recursion token |
| `APP_ID` (variable) | publish, version-packages-auto-merge | GitHub App ID for anti-recursion token |

### Setting Up APP_ID and APP_PRIVATE_KEY

Source from 1Password (the `chatline-changesets-bot` item):

```bash
# App ID (stored as GitHub variable, not secret)
op item get "chatline-changesets-bot" --vault="API Credentials" --fields label="App ID" --reveal
gh variable set APP_ID --repo <owner>/<repo> --body "<app-id>"

# Private key -- MUST use --format json to avoid quote wrapping
op item get "chatline-changesets-bot" --vault="API Credentials" \
  --fields label=credential --reveal --format json \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['value'])" \
  | gh secret set APP_PRIVATE_KEY --repo <owner>/<repo>
```

**PEM key gotcha**: `op item get --reveal` (without `--format json`) wraps multi-line values in double quotes, corrupting the PEM format. The `create-github-app-token` action then fails with `ERR_OSSL_UNSUPPORTED: DECODER routines::unsupported`. Always extract via `--format json` and parse the `value` field.

### Removed Workflows

These were present in earlier template versions but have been consolidated or removed:

| Workflow | Disposition |
|----------|-------------|
| `release.yml` | Consolidated into `publish.yml` (handles all release intents) |
| `node-compat.yml` | Removed -- downstream repos may keep if they need Node.js compat |

## Composite Actions

| Action | Purpose |
|--------|---------|
| `standard-ci-env` | Sets `TZ=UTC` and `TF_BUILD=true` |
| `setup-bun` | Installs Bun with dependency caching |
| `coverage-comment` | Posts sticky coverage comment on PRs |
