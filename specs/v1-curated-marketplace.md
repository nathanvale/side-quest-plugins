# Plan: V1 Curated Claude Code Marketplace

## Task Description
Build and publish the V1 curated, verified Claude Code plugin marketplace for the side-quest-plugins repository. This involves fixing pre-existing manifest issues (duplicate plugin.json files in enterprise and newsroom), stripping the repo down to 3 verified plugins (git, enterprise, newsroom), creating the marketplace.json shell, writing documentation (updated README + plugin-standards.md), creating a missing newsroom README, and validating the install mechanism both locally and remotely.

## Objective
When this plan is complete, the side-quest-plugins repository will be a valid, installable Claude Code marketplace with 3 verified plugins. Users can run `/plugin marketplace add nathanvale/side-quest-plugins` and install git, enterprise, or newsroom plugins. Documentation explains the marketplace, the acceptance checklist for future plugins, and the migration path from symlinks.

## Problem Statement
The current repository blends 22 plugins (including personal tooling) with no marketplace.json, no quality gate, and no install mechanism beyond manual symlinks. This hurts trust, discoverability, and adoption. Only 3 plugins (git, enterprise, newsroom) are close to ready -- the rest lack READMEs or have manifest issues.

## Solution Approach
Phase 0 from the plan: fix manifests, strip to V1 plugins, create marketplace shell, write docs, validate. This is a documentation-and-configuration task -- minimal code changes (only plugin.json merges and file deletions). The marketplace.json follows the official Anthropic flat-root schema pattern. Stripped plugins are recoverable from git history.

## Relevant Files
Use these files to complete the task:

- `plugins/enterprise/.claude-plugin/plugin.json` -- canonical manifest, needs skills + agents merged from bare root
- `plugins/enterprise/plugin.json` -- bare root duplicate, has 8 skills + 3 agents not in canonical version. Delete after merge.
- `plugins/newsroom/.claude-plugin/plugin.json` -- canonical manifest, needs agents array merged from bare root
- `plugins/newsroom/plugin.json` -- bare root duplicate, has `agents: ["./agents/beat-reporter.md"]`. Delete after merge.
- `plugins/git/.claude-plugin/plugin.json` -- already correct, no changes needed
- `plugins/git/README.md` -- exists, no changes needed
- `plugins/enterprise/README.md` -- exists, no changes needed
- `README.md` -- root README, needs full rewrite for marketplace positioning
- `docs/plans/2026-02-21-feat-v1-curated-marketplace-plan.md` -- source plan with all details, schema, categories, acceptance criteria

### New Files
- `.claude-plugin/marketplace.json` -- marketplace manifest (3 plugins)
- `docs/plugin-standards.md` -- acceptance checklist, category criteria, README template
- `plugins/newsroom/README.md` -- minimum viable README for newsroom
- `docs/plugin-roadmap.md` -- rollout plan for remaining 15 marketplace-candidate plugins

## Implementation Phases

### Phase 1: Foundation (Manifest Fixes)
Fix duplicate manifests in enterprise and newsroom. This unblocks everything else.

### Phase 2: Core Implementation (Marketplace Shell + Docs)
Strip to V1 plugins, create marketplace.json, write README, plugin-standards.md, newsroom README, plugin-roadmap.md.

### Phase 3: Integration & Polish (Validation)
Validate locally, push feature branch, test remote install, verify all 3 plugins install and work.

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
  - Name: builder-manifests
  - Role: Fix enterprise and newsroom duplicate manifests (merge + delete bare roots)
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-manifests
  - Role: Verify merged manifests are correct and bare roots deleted. Check all paths resolve.
  - Agent Type: general-purpose
  - Model: haiku
  - Resume: true

- Builder
  - Name: builder-marketplace
  - Role: Create marketplace.json, strip non-V1 plugins, create plugin-roadmap.md
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-docs
  - Role: Write README.md, docs/plugin-standards.md, plugins/newsroom/README.md
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-docs
  - Role: Verify all docs exist, word counts in range, all referenced files exist
  - Agent Type: general-purpose
  - Model: haiku
  - Resume: true

- Validator
  - Name: validator-final
  - Role: Run full validation -- marketplace structure, all paths resolve, acceptance criteria met
  - Agent Type: general-purpose
  - Model: haiku
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. Merge Enterprise Manifests
- **Task ID**: merge-enterprise-manifest
- **Depends On**: none
- **Assigned To**: builder-manifests
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (with task 2)
- Read both `plugins/enterprise/.claude-plugin/plugin.json` and `plugins/enterprise/plugin.json`
- Merge into `.claude-plugin/plugin.json`: keep existing fields (name, description, version, author, keywords, license, commands), ADD `skills` array from bare root (all 8 skills: `./skills/the-bridge`, `./skills/stations/medical`, `./skills/stations/engineering`, `./skills/ops/computer`, `./skills/programs/readme`, `./skills/programs/api-reference`, `./skills/programs/code-review`, `./skills/programs/refactor-analysis`), ADD `agents` array from bare root (`./agents/ships-computer-cpu.md`, `./agents/builder-scotty.md`, `./agents/validator-mccoy.md`)
- Delete `plugins/enterprise/plugin.json` (bare root)
- Verify all paths in merged manifest resolve to real files using Glob

### 2. Merge Newsroom Manifests
- **Task ID**: merge-newsroom-manifest
- **Depends On**: none
- **Assigned To**: builder-manifests
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (with task 1)
- Read both `plugins/newsroom/.claude-plugin/plugin.json` and `plugins/newsroom/plugin.json`
- Merge into `.claude-plugin/plugin.json`: keep existing fields, ADD `agents: ["./agents/beat-reporter.md"]` from bare root
- Delete `plugins/newsroom/plugin.json` (bare root)
- Verify the agent path resolves

### 3. Validate Merged Manifests
- **Task ID**: validate-manifests
- **Depends On**: merge-enterprise-manifest, merge-newsroom-manifest
- **Assigned To**: validator-manifests
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: false
- Read `plugins/enterprise/.claude-plugin/plugin.json` -- verify it has: name, description, version, author, keywords, license, commands (9), skills (8), agents (3)
- Read `plugins/newsroom/.claude-plugin/plugin.json` -- verify it has: name, description, version, author, keywords, license, commands (2), skills (2), agents (1)
- Verify `plugins/enterprise/plugin.json` (bare root) does NOT exist
- Verify `plugins/newsroom/plugin.json` (bare root) does NOT exist
- For each path in both manifests, verify the file exists using Glob
- Report PASS/FAIL for each check

### 4. Create Marketplace Shell
- **Task ID**: create-marketplace-shell
- **Depends On**: validate-manifests
- **Assigned To**: builder-marketplace
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false
- Create `.claude-plugin/marketplace.json` at repo root with this exact content:
```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "side-quest",
  "version": "1.0.0",
  "description": "Curated, verified Claude Code plugins for compound engineering workflows",
  "owner": {
    "name": "Nathan Vale",
    "email": "hi@nathanvale.com"
  },
  "plugins": [
    {
      "name": "git",
      "source": "./plugins/git",
      "description": "Git workflows with 10 commands, safety hooks, and session logging",
      "category": "development",
      "tags": ["git", "safety", "commits", "hooks", "worktrees", "compound-engineering"]
    },
    {
      "name": "enterprise",
      "source": "./plugins/enterprise",
      "description": "Multi-agent engineering orchestrator with builder/validator pattern",
      "category": "development",
      "tags": ["orchestration", "builder-validator", "multi-agent", "compound-engineering"]
    },
    {
      "name": "newsroom",
      "source": "./plugins/newsroom",
      "description": "Multi-agent research across Reddit, X, and web with engagement metrics",
      "category": "productivity",
      "tags": ["research", "reddit", "x", "community", "multi-agent", "compound-engineering"]
    }
  ]
}
```
- Create `docs/plugin-roadmap.md` with the 15 remaining marketplace-candidate plugins from the plan (see "V1 Plugin Roster" table in the plan file). Include plugin name, target release (V1.1/V1.2), blocker, and target category.

### 5. Write Newsroom README
- **Task ID**: write-newsroom-readme
- **Depends On**: validate-manifests
- **Assigned To**: builder-docs
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (with tasks 4, 6, 7)
- Create `plugins/newsroom/README.md` -- minimum viable per plan:
  - Purpose (1 paragraph): Multi-agent research orchestrator with 1920s journalism metaphor. Dispatches beat reporters in parallel across Reddit, X, and web.
  - Install command: `/plugin install newsroom@side-quest`
  - One usage example: `/newsroom:investigate "React 19 adoption" --quick --reddit`
  - Research modes: recon, changes, sentiment, verify
  - Known limitations: requires @side-quest/last-30-days CLI, Firecrawl MCP for fallback
  - Multi-agent info: 1 agent (beat-reporter), supervisor pattern, 2-5x compute
- Read `plugins/enterprise/README.md` and `plugins/git/README.md` for style reference
- Keep it under 200 words (minimum viable)

### 6. Write Plugin Standards Doc
- **Task ID**: write-plugin-standards
- **Depends On**: validate-manifests
- **Assigned To**: builder-docs
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (with tasks 4, 5, 7)
- Create `docs/plugin-standards.md` (target: 800-1000 words) with these sections:
  - **Acceptance Checklist** -- single normative checklist, split into agent-verifiable (5 items) and human-verifiable (4 items) exactly as defined in the plan's "Per-Plugin Acceptance Checklist" section
  - **Category System** -- 4 categories (development, productivity, security, learning) with decision criteria from the plan
  - **Multi-Agent Plugin Requirements** -- coordination pattern, agent roles, compute cost must be documented in README
  - **Minimum Viable README Template** -- purpose, install command, usage example, limitations
  - **Contribution Steps** (4 max): fork, add plugin, run checklist, submit PR
  - **Manifest Schema** -- required fields (name, description, version, author) with example
- Use the exact checklist items from the plan's "Per-Plugin Acceptance Checklist" section

### 7. Rewrite Root README
- **Task ID**: rewrite-readme
- **Depends On**: validate-manifests
- **Assigned To**: builder-docs
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (with tasks 4, 5, 6)
- Rewrite `README.md` (target: 300-400 words) with:
  - **Opening**: What this is (curated, verified Claude Code plugin marketplace for compound engineering)
  - **Quick Start**: 3 steps -- add marketplace, install plugin, use it
    ```
    /plugin marketplace add nathanvale/side-quest-plugins
    /plugin install git@side-quest
    /git:commit
    ```
  - **V1 Plugins** table: name, category, description, components for git, enterprise, newsroom
  - **Symlink Migration**: For existing users -- remove old symlinks, add marketplace, install plugins. Note: non-marketplace plugins can continue using symlinks.
  - **Plugin Standards**: Link to `docs/plugin-standards.md`
  - **Development**: Brief setup (clone, bun install, quality commands)
  - **Roadmap**: One line -- "V1.1 adds core dev tools (bun-runner, tsc-runner, biome-runner, kit). See docs/plugin-roadmap.md."
  - **License + Credits**
- Read the current `README.md` first to preserve useful content (architecture section, design patterns)
- Do NOT include the full architecture/patterns/highlighted plugins sections -- those move to a future docs site or stay in git history. The README is now a marketplace landing page.
- Keep badges but update the tagline

### 8. Validate Documentation
- **Task ID**: validate-docs
- **Depends On**: write-newsroom-readme, write-plugin-standards, rewrite-readme, create-marketplace-shell
- **Assigned To**: validator-docs
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: false
- Verify these files exist and are non-empty:
  - `.claude-plugin/marketplace.json`
  - `README.md`
  - `docs/plugin-standards.md`
  - `docs/plugin-roadmap.md`
  - `plugins/newsroom/README.md`
  - `plugins/git/README.md` (pre-existing)
  - `plugins/enterprise/README.md` (pre-existing)
- Check `README.md` word count is 300-400 words
- Check `docs/plugin-standards.md` word count is 800-1000 words
- Verify marketplace.json is valid JSON with 3 plugins, each having name, source, description, category, tags
- Verify all `source` paths in marketplace.json point to existing directories
- Report PASS/FAIL for each check

### 9. Strip Non-V1 Plugins
- **Task ID**: strip-non-v1-plugins
- **Depends On**: validate-docs
- **Assigned To**: builder-marketplace
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false
- IMPORTANT: This step removes plugin directories. All content is recoverable via `git checkout main -- plugins/<name>`.
- Remove these plugin directories (19 directories):
  - `plugins/agent-skills-bridge`
  - `plugins/agentic-orchestration`
  - `plugins/biome-runner`
  - `plugins/bun-runner`
  - `plugins/bun-typescript-starter`
  - `plugins/chrome-devtools`
  - `plugins/claude-code`
  - `plugins/dell-u4025qw`
  - `plugins/dojo`
  - `plugins/firecrawl`
  - `plugins/kit`
  - `plugins/macos-settings`
  - `plugins/node-cert`
  - `plugins/observability`
  - `plugins/research`
  - `plugins/tools`
  - `plugins/tsc-runner`
  - `plugins/utm-testing`
  - `plugins/x-api`
- Keep: `plugins/git`, `plugins/enterprise`, `plugins/newsroom`
- Keep all repo infrastructure: `.claude/`, `.github/`, `biome.json`, `tsconfig*`, `package.json`, `bun.lock`, `scripts/`, `docs/`, `specs/`, `launchd/`
- Use `rm -rf` via Bash for each directory
- Run `ls plugins/` after to verify only git, enterprise, newsroom remain

### 10. Final Validation
- **Task ID**: validate-all
- **Depends On**: strip-non-v1-plugins
- **Assigned To**: validator-final
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: false
- Verify `plugins/` contains exactly 3 directories: git, enterprise, newsroom
- Verify `.claude-plugin/marketplace.json` exists and has valid JSON with 3 plugins
- For each of the 3 V1 plugins:
  - Verify `.claude-plugin/plugin.json` exists inside the plugin directory
  - Verify NO bare `plugin.json` exists at plugin root (enterprise and newsroom were merged)
  - Verify README.md exists
  - Verify all paths listed in plugin.json resolve to real files
- Verify `docs/plugin-standards.md` exists
- Verify `docs/plugin-roadmap.md` exists
- Verify `README.md` mentions marketplace install command
- Run `bunx tsc --noEmit` to check TypeScript (hooks in git plugin)
- Run `bunx biome ci .` to check lint/format
- Report full PASS/FAIL checklist for all acceptance criteria from the plan

## Acceptance Criteria

### Marketplace-Level
- [ ] `.claude-plugin/marketplace.json` exists with `$schema`, 3 plugins, valid JSON
- [ ] All 3 V1 plugins (git, enterprise, newsroom) have `.claude-plugin/plugin.json` with no bare root duplicates
- [ ] All paths in all plugin manifests resolve to real files
- [ ] README.md is a marketplace landing page (300-400 words) with install instructions and migration guide
- [ ] `docs/plugin-standards.md` defines the acceptance checklist and category criteria
- [ ] `docs/plugin-roadmap.md` lists remaining 15 marketplace-candidate plugins
- [ ] All 3 V1 plugins have README.md files
- [ ] `plugins/` contains exactly 3 directories (git, enterprise, newsroom)
- [ ] No TypeScript errors (`bunx tsc --noEmit`)
- [ ] No lint/format errors (`bunx biome ci .`)

### Per-Plugin
- [ ] Enterprise manifest has: name, description, version, author, keywords, license, commands (9), skills (8), agents (3)
- [ ] Newsroom manifest has: name, description, version, author, keywords, license, commands (2), skills (2), agents (1)
- [ ] Git manifest unchanged (already correct)

## Validation Commands
- `bunx tsc --noEmit` -- verify no type errors
- `bunx biome ci .` -- lint and format check
- `ls plugins/` -- verify only 3 V1 plugin directories remain

## Notes
- **Remote install validation** (Phase 0, Step 6 from the plan) is NOT included in this spec. It requires pushing a feature branch and manually testing `/plugin marketplace add`. This should be done by the human after all tasks complete.
- **Plugin stripping is recoverable**: `git checkout main -- plugins/<name>` restores any removed plugin from the commit before the strip.
- **The `plugin-template` plugin** is listed as personal in the plan but is also referenced in the `.claude/` skills listing. It gets stripped with the rest -- not a marketplace candidate.
- **No code changes**: This plan only modifies JSON manifests, creates markdown docs, and deletes directories. No TypeScript code is written or modified.
- **Newsroom README**: The plan notes newsroom has no README. The enterprise and git READMEs exist. The newsroom README is the only new plugin-level doc to create.
