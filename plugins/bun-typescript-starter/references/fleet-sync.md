# Fleet Sync

Operational reference for the `/bun-typescript-starter:fleet-sync` command. Contains audit checklists, path lists, and known divergences.

**Canonical settings are NOT stored here** -- they are parsed at runtime from `setup-protect.ts` and `create.md` to avoid drift.

## Audit Checklist

12 checks per repo. Each check compares downstream state against the template's source of truth.

| # | Check | Source of Truth | Red Flag |
|---|-------|----------------|----------|
| 1 | Workflow files | Template `.github/workflows/` | Missing files, content drift |
| 2 | Action version drift | Template SHA-pinned versions | Older SHAs than template |
| 3 | 1Password remnants | Should not exist | `load-secrets-action` or `OP_SERVICE_ACCOUNT_TOKEN` in YAML |
| 4 | Legacy release.yml | Should not exist | File present (consolidated into `publish.yml`) |
| 5 | APP_ID variable | Should be set | Missing `vars.APP_ID` |
| 6 | APP_PRIVATE_KEY secret | Should be set | Missing `secrets.APP_PRIVATE_KEY` |
| 7 | Branch protection | `setup-protect.ts` payload | 404 (not configured) or settings drift |
| 8 | Merge settings | `create.md` Step 5 PATCH call | Rebase/merge commit enabled, auto-delete off |
| 9 | Workflow permissions | `create.md` Step 5 PUT call | Read-only default, PR approval disabled |
| 10 | Pre-push hook | Template `.husky/pre-push` | Missing or outdated (e.g., no 403/404 handling) |
| 11 | Dependabot config | Template `.github/dependabot.yml` | Missing or drift |
| 12 | Template improvements | Template git log (infra files) | Commits not reflected in downstream |

## Canonical Settings Sources

Settings are parsed dynamically at runtime. These are the source files:

| Setting | Source File | Location |
|---------|------------|----------|
| Branch protection | `~/code/bun-typescript-starter/scripts/setup-protect.ts` | `JSON.stringify({...})` call (lines 68-84) |
| Merge settings | `commands/create.md` | Step 5, `gh api repos/.../` PATCH call |
| Workflow permissions | `commands/create.md` | Step 5, `gh api repos/.../actions/permissions/workflow` PUT call |

## Sync-Eligible Paths

Infrastructure files that should be kept in sync across all downstream repos:

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

## Excluded Paths

Project-specific files -- never synced, never compared:

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

## Known Intentional Divergences

These files may legitimately differ between repos. The audit should flag them as warnings, not errors:

| File | Reason | Action |
|------|--------|--------|
| `.changeset/config.json` | Contains real repo name vs template `{{PLACEHOLDER}}` | Skip in workflow sync |
| `scripts/setup.ts` | Template scaffolding, not present in real projects | Ignore if missing |
| `.github/workflows/node-compat.yml` | Project-specific -- only repos needing Node.js compat keep this | Warn if present (may be intentional) |
| Extra workflows | Some repos add project-specific workflows | Ignore unknown workflow files (only compare shared ones) |
| `biome.json` overrides | Repos may add project-specific lint rules | Compare structure, warn on missing base rules |

## Dependabot PR Cleanup Strategy

After syncing workflow files, Dependabot PRs that bump actions to versions already included in the sync become redundant.

### Identification

Match PRs where:
- Author is `app/dependabot`
- Title matches `bump .*(github-actions|gha)` pattern or contains `chore(gha)`
- The action being bumped is already at or beyond the target version in the synced workflow files

### Close Pattern

```bash
gh pr close {NUMBER} --repo {OWNER}/{REPO} \
  --comment "Superseded by template sync PR -- the action version bump is included in the infrastructure sync."
```

### Do NOT close

- Dependabot PRs for npm/bun dependency updates (these are project-specific)
- PRs for actions not managed by the template (project-specific workflows)

## Template Changelog Strategy

Before auditing, the command gathers the template's recent infrastructure changes:

```bash
git -C ~/code/bun-typescript-starter log --oneline --no-merges -- \
  .github/ .husky/ biome.json commitlint.config.mjs scripts/setup-protect.ts
```

Each audit agent then checks which improvements from this changelog are reflected in the downstream repo. The report shows per-repo: "missing N template improvements" with specific commit descriptions rather than just "files differ."

This gives the user actionable context -- they can see exactly which fixes/improvements they're behind on.

## Working Directory

All clone operations use `/tmp/template-sync/` for clean isolation:
- Audit clones: `/tmp/template-sync-audit/{REPO}`
- Fix clones: `/tmp/template-sync/{REPO}`
- Cleaned up after each operation

Uses `GIT_DIR="" GIT_WORK_TREE=""` env vars when cloning to prevent hook interference from the parent repo's git context.
