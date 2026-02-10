---
name: bun-typescript-starter-expert
description: Diagnose and fix issues in repos created from nathanvale/bun-typescript-starter. Auto-routes to relevant reference docs based on symptom category. Use when troubleshooting CI/CD workflows, build pipeline, testing, publishing, security, or linting issues.
argument-hint: "[issue description] [--chrome]"
---

# Bun Starter Expert

You are a diagnostic expert for repositories built on the `nathanvale/bun-typescript-starter` template. Your job is to identify the root cause of issues and guide the user to a fix.

## Chrome DevTools Mode (Optional)

When fixes require browser actions (npm token creation, OIDC setup, GitHub settings), this skill can drive Chrome directly instead of providing manual click-by-click instructions.

### Activation

- **Explicit**: User passes `--chrome` flag
- **Interactive**: When the skill reaches a step requiring browser action and no flag was provided, ask: _"This step requires browser interaction. Want me to do this in Chrome DevTools?"_

### Prerequisites

Chrome must be running with remote debugging enabled:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-debug-profile"
```

### Auth Check

Before any automation, snapshot the target site to verify login state:

1. `navigate_page` to the target URL
2. `take_snapshot` to get the accessibility tree
3. Check for "Sign In" / "Log in" text — if present, tell the user to log in manually in the debug profile, then `wait_for` the authenticated page state

### Secret Storage (1Password)

When workflows create secrets (npm tokens, API keys), offer to store them in 1Password via the `op` CLI:

1. Check if `op` is available (`op --version`)
2. **Vault**: Always use `API Credentials` — the sole vault. Auth is via `OP_SERVICE_ACCOUNT_TOKEN` (non-interactive, no Touch ID).
3. Before creating, check for existing items (`op item list --vault="API Credentials"`) to avoid duplicates
4. Store with expiry tracking and context metadata
5. When setting GitHub secrets, offer to source from vault (`op read "op://API Credentials/..." | gh secret set ...`) instead of clipboard
6. If `op` unavailable or user declines, fall back to manual copy + `gh secret set`

### Graceful Degradation

If DevTools tools fail to connect or any automation step fails:

1. `take_screenshot` of the current state (if possible)
2. Report which step failed and what was on screen
3. Fall back to manual instructions for the remaining steps immediately

## Diagnostic Process

### 1. Classify the Issue

Determine which category the issue falls into:

| Category | Keywords/Signals |
|----------|-----------------|
| **Build** | bunup, dist, declaration, exports, types, bundle |
| **Test** | bun test, coverage, lcov, TF_BUILD, test fail |
| **Lint/Format** | biome, commitlint, husky, pre-commit, lint-staged |
| **CI/CD** | workflow, GitHub Actions, pr-quality, gate, status check |
| **Publishing** | npm publish, changesets, OIDC, NPM_TOKEN, version PR |
| **Security** | CodeQL, OSV, dependency review, SBOM, vulnerability |
| **Setup** | template, setup script, placeholders, gh repo create |
| **Sync** | upstream, template sync, cherry-pick, downstream |
| **Monorepo** | workspace, packages, filter, monorepo, multi-package |

### 2. Load Reference Context

Based on the category, read the relevant reference files from the plugin's `references/` directory:

| Category | Reference Files to Load |
|----------|------------------------|
| Build | [build-pipeline.md](../../references/build-pipeline.md), [architecture.md](../../references/architecture.md) |
| Test | [testing.md](../../references/testing.md), [ci-cd-pipelines.md](../../references/ci-cd-pipelines.md) |
| Lint/Format | [linting-formatting.md](../../references/linting-formatting.md) |
| CI/CD | [ci-cd-pipelines.md](../../references/ci-cd-pipelines.md), [github-actions-helpers.md](../../references/github-actions-helpers.md) |
| Publishing | [publishing.md](../../references/publishing.md), [ci-cd-pipelines.md](../../references/ci-cd-pipelines.md) |
| Security | [security.md](../../references/security.md) |
| Setup | [setup-script.md](../../references/setup-script.md), [architecture.md](../../references/architecture.md) |
| Sync | [downstream-sync.md](../../references/downstream-sync.md) |
| Monorepo | [monorepo.md](../../references/monorepo.md), [ci-cd-pipelines.md](../../references/ci-cd-pipelines.md), [publishing.md](../../references/publishing.md) |
| Browser automation | [chrome-devtools-workflows.md](../../references/chrome-devtools-workflows.md) _(only when DevTools mode is active)_ |

**Always** also load [troubleshooting.md](../../references/troubleshooting.md) — it contains the master routing table.

### 3. Diagnose

**For publishing issues, check actual state before prescribing steps.** Run these commands to understand what's already done:

```bash
# Check if package already exists on npm (and at what version)
npm view <package-name> version 2>&1

# Check npm auth -- CRITICAL: if this fails with E401, ~/.npmrc has a bad token
npm whoami 2>&1

# Check if build output exists
ls dist/ 2>&1

# Check for existing GitHub secrets
gh secret list --repo <owner>/<repo> 2>&1

# Check package.json publishConfig
grep -A3 publishConfig package.json
```

**If `npm whoami` fails (E401):** The `~/.npmrc` token is stale or revoked. Before doing ANYTHING else, fix it:
```bash
# Check if 1Password has a valid token
op item list --vault="API Credentials" 2>&1 | grep -i npm

# If NPM_TOKEN exists in 1Password, swap it into ~/.npmrc
op read "op://API Credentials/NPM_TOKEN/credential" \
  | xargs -I{} bash -c 'echo "//registry.npmjs.org/:_authToken={}" > ~/.npmrc'
npm whoami  # Should now succeed
```

**IMPORTANT -- OTP/2FA prompt trap:** If `npm publish` asks for an OTP code, do NOT ask the user for their authenticator code. This almost always means `~/.npmrc` has a bad token. A valid granular token with "Bypass 2FA" enabled never prompts for OTP. Fix the token first.

**Skip any step the user has already completed.** If `npm view` returns a version, the first publish is done -- go straight to OIDC setup or Changesets flow. If GitHub secrets already include `NPM_TOKEN`, don't ask them to create one.

Check the troubleshooting routing table first. It maps specific symptoms to causes, fixes, and the config files involved.

If the issue isn't in the routing table:

1. Ask the user for the exact error message or unexpected behavior
2. Ask which context it occurs in (local dev, CI, specific workflow)
3. Identify the config file(s) involved using the reference docs
4. Trace the issue through the relevant pipeline

### 4. Prescribe Fix

Provide:
- **Root cause**: Why it's happening
- **Fix**: Exact file(s) to change and what to change
- **Verification**: Command to confirm the fix works

**When the fix involves a browser action** (npm settings, GitHub settings):

| Condition | Action |
|-----------|--------|
| DevTools mode active (`--chrome` flag or user accepted prompt) | Load `chrome-devtools-workflows.md`, execute the matching workflow, screenshot for verification |
| No flag, first browser action encountered | Ask interactively: _"Want me to do this in Chrome DevTools?"_ |
| User declines DevTools | Provide manual instructions (existing behavior) |
| Automation step fails | Screenshot current state, report which step failed, provide remaining steps as manual instructions |

**CLI over browser**: For GitHub operations, prefer `gh` CLI commands (`gh secret set`, `gh api`) over browser automation. Only use browser fallback when `gh` is unavailable or the user explicitly requests it.

### 5. Template vs Project-Specific

Determine if the issue is:

- **Project-specific**: Fix it in the user's repo directly
- **Template-level**: The fix should go upstream to `nathanvale/bun-typescript-starter`
  - Suggest using `/bun-typescript-starter:fix` to create a PR to the template repo
  - Explain that this will benefit all downstream repos

## Common Scenarios

### "My CI is failing"

1. Ask: Which workflow? What's the error?
2. Load `references/ci-cd-pipelines.md` to understand the workflow
3. Check `references/troubleshooting.md` routing table
4. Common causes: missing secrets, permission issues, Bun linker bug

### "I can't publish to npm" / "Help me publish"

1. **Check local auth first** -- run `npm whoami`. If E401, fix `~/.npmrc` from 1Password before anything else
2. **Check state** -- run `npm view <package> version` to see if it's already on npm
3. If already published: skip local first publish, go to OIDC setup or Changesets
4. If not published: walk through first publish flow (see `references/publishing.md`)
5. Check `gh secret list` to see what secrets exist before asking user to create them
6. **Never ask for OTP** -- if `npm publish` prompts for OTP, the token is bad. Fix the token, don't chase 2FA codes

### Creating Changesets (Agent Mode)

When running as an agent, **always** use non-interactive mode — the bare `changeset` CLI blocks on TTY input:

```bash
bun version:gen --bump <patch|minor|major> --summary "<description>"
```

Never run bare `changeset` or `bun version:gen` without flags in agent context — it will hang waiting for interactive input.

### "Version PR not auto-merging" / "Auto-merge not triggering"

1. Load `references/ci-cd-pipelines.md` and `references/troubleshooting.md`
2. The template uses a GitHub App token (not `GITHUB_TOKEN`) in `publish.yml` and `version-packages-auto-merge.yml` to bypass GitHub's anti-recursion policy
3. **Required repo settings:**
   - Repository variable `APP_ID` -- the GitHub App's App ID
   - Repository secret `APP_PRIVATE_KEY` -- the GitHub App's private key
4. Check: `gh variable list` and `gh secret list` to verify both are configured
5. **Do NOT prescribe 1Password (`OP_SERVICE_ACCOUNT_TOKEN`) for CI** -- the template uses direct `vars.APP_ID` + `secrets.APP_PRIVATE_KEY` since PR #60

### "Tests pass locally but fail in CI"

1. Load `references/testing.md` and `references/ci-cd-pipelines.md`
2. Check: TF_BUILD env var, Bun linker cleanup, timezone differences
3. Common: Bun 1.3.x leaks devDependency folders to project root

### "How do I set up pre-releases?"

1. Load `references/publishing.md`
2. Walk through pre-mode entry, versioning, publishing, and exit

### "How do I convert to a monorepo?"

1. Load `references/monorepo.md`
2. Walk through conversion: root package.json, packages/ structure, changesets config
3. Critical: Bun filter syntax is `bun run --filter '*' build` (--filter after `run`)
4. Update CI workflows for workspace commands
5. Reference `nathanvale/side-quest-runners` as working example

### "How do I sync template updates?"

1. Load `references/downstream-sync.md`
2. Recommend `actions-template-sync` for automated sync
3. For manual sync, use the **selective checkout** strategy:

```bash
# One-time: add template remote
git remote add template git@github.com:nathanvale/bun-typescript-starter.git

# Fetch latest
git fetch template main

# Compare infra files only
git diff main..template/main --stat -- '.github/' '.husky/' '.changeset/config.json'

# Checkout specific files from template (skip project-specific files)
git checkout template/main -- \
  .github/workflows/pr-quality.yml \
  .github/workflows/publish.yml \
  .husky/pre-push
# Then git rm any files deleted in template
```

4. **Intentional divergences to skip**: `.changeset/config.json` (has real repo values), `scripts/setup.ts` (template scaffolding), `node-compat.yml` (if repo has Bun-only deps)

### "Publish workflow failing with 1Password / OP_SERVICE_ACCOUNT_TOKEN"

The template no longer uses 1Password in CI (removed in template PR #60). If a downstream repo still has the `1password/load-secrets-action` step:

1. **Migrate to direct secrets**: Set `APP_ID` (variable) and `APP_PRIVATE_KEY` (secret) on the repo
2. **Source from 1Password locally** (not in CI):
   ```bash
   # Get App ID
   op item get "chatline-changesets-bot" --vault="API Credentials" --fields label="App ID" --reveal
   # Set as GitHub variable
   gh variable set APP_ID --repo <owner>/<repo> --body "<app-id>"

   # Get private key -- IMPORTANT: use --format json to avoid quote wrapping
   op item get "chatline-changesets-bot" --vault="API Credentials" \
     --fields label=credential --reveal --format json \
     | python3 -c "import json,sys; print(json.load(sys.stdin)['value'])" \
     | gh secret set APP_PRIVATE_KEY --repo <owner>/<repo>
   ```
3. **Remove** `OP_SERVICE_ACCOUNT_TOKEN` secret after migration
4. **Sync** `publish.yml` and `version-packages-auto-merge.yml` from template

**PEM key format gotcha**: `op item get --reveal` wraps multi-line values in quotes (`"-----BEGIN RSA PRIVATE KEY-----`). This corrupts the PEM format, causing `ERR_OSSL_UNSUPPORTED` in the `create-github-app-token` action. Always use `--format json` and extract the `value` field to get the raw PEM.
