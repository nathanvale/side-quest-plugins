---
title: V1 Curated Claude Code Marketplace
type: feat
status: active
date: 2026-02-21
deepened: 2026-02-21
origin: docs/brainstorms/2026-02-21-successful-marketplace-brainstorm.md
---

# V1 Curated Claude Code Marketplace

## Enhancement Summary

**Deepened on:** 2026-02-21
**Agents used:** 11 (document-review, agent-native-architecture, architecture-strategist, code-simplicity-reviewer, pattern-recognition-specialist, spec-flow-analyzer, community-directory-researcher, marketplace-schema-researcher, multi-agent-patterns, write-concisely, repo-research-analyst)
**Community intel:** 2026-02-21 (beat-reporter via @side-quest/last-30-days -- Reddit + X + web)

### Key Improvements
1. **Added Phase 0: git-first clean slate** -- strip to git-only (using git for restore, no legacy clone), create marketplace shell, then incrementally add plugins
2. **Aggressively simplified scope** -- reduced from 5 docs to 2, deferred community listing to V2, scoped to 3-5 ready plugins instead of all 22
3. **Resolved all 4 critical questions** with concrete answers backed by research
4. **5-phase incremental rollout** (Phase 0-4) -- marketplace is always valid and installable at every checkpoint
5. **Added agent-native parity requirements** -- marketplace.json as a machine-readable interface, not just human docs
6. **Concrete marketplace.json schema** with real examples from Anthropic and community patterns
7. **Community directory targets identified** with submission requirements and prioritized listing strategy
8. **Fixed factual errors** -- `.claude/CLAUDE.md` exists, plugin manifest inconsistencies documented
9. **Category system stress-tested** -- primary category + secondary tags resolves multi-stage plugin ambiguity

### New Considerations Discovered
- The "Compounding" category is the weakest -- consider demoting to a tag
- 16 of 22 plugins have no README -- V1 should only include plugins that are already close to ready
- `observability` and `tools` use non-standard manifest locations (bare `plugin.json` at root)
- `enterprise` and `newsroom` have duplicate manifests with conflicting content
- Use standard Anthropic categories (`development`, `productivity`) in `category` field and express compound engineering taxonomy in `tags` for maximum discoverability

---

## Overview

Build and publish the V1 curated, verified Claude Code plugin marketplace. V1 ships exactly 3 plugins (`git`, `enterprise`, `newsroom`) -- the only plugins with complete manifests and READMEs. Deliverables: a valid `marketplace.json`, updated README with symlink migration guide, and a plugin standards doc with a single normative acceptance checklist. Community directory listings are V2. Additional plugins are backfilled post-V1 as they pass the checklist (V1.1, V1.2).

### Research Insights

**Best practices from 10+ community marketplaces:**
- 5-8 categories is the sweet spot for small-to-medium catalogs
- Problem-domain grouping beats technology-based grouping
- Flat plugin names with metadata tags is the universal convention
- Nobody uses "Miscellaneous" -- it's a dumping ground anti-pattern
- The official Anthropic marketplace uses 4 categories for 14 bundled plugins

**Community landscape (as of 2026-02-21):**
- 4,961 plugin repos on GitHub (per @chiefofautism, 2,274 likes)
- Official Anthropic marketplace: 14 bundled plugins, 4 categories (`development`, `productivity`, `learning`, `security`)
- Official plugin directory (`anthropics/claude-plugins-official`): 7.9k stars, 776 forks, form-based submission
- `claudemarketplaces.com`: auto-indexes public repos with 5+ GitHub stars
- Community sentiment: "This is the move that turns Claude Code from a dev tool into a platform" (@alex_william22)
- Multi-agent orchestration plugins are emerging (OpenClaw on r/ClaudeAI, 8 pts, 10 comments)
- **Speed matters** -- the ecosystem is growing fast. Ship V1 quickly to catch the wave.

**Community marketplace.json conventions (updated with official schema analysis):**
- Include `$schema` for validation (only official Anthropic + Netresearch use this -- signals quality)
- **Do NOT use `metadata` wrapper** -- the official Anthropic marketplace uses flat root-level fields (`description`, `version` at root). The `metadata` wrapper was from the life-sciences pattern but the official bundled marketplace is simpler.
- Use `tags` at plugin level for compound engineering taxonomy (the official marketplace doesn't use `tags` yet, but the schema supports them -- this is our differentiator)
- Use standard Anthropic categories in `category` field for cross-directory discoverability
- `version` and `author` are optional at plugin entry level -- plugin.json takes priority

**Competitive positioning:**
- "Compound engineering" is unique -- no other marketplace curates around a methodology
- Multi-agent plugins (`enterprise`, `newsroom`) are cutting edge -- the community is building toward this pattern but few have shipped it
- Our `tags` system (standard categories + custom CE tags) provides discoverability on aggregators while expressing our unique taxonomy

---

## Problem Statement / Motivation

The current repository blends public-quality plugins with personal tooling, hurting trust, discoverability, and adoption. The marketplace must communicate a clear compound-engineering philosophy and provide a credible, verified-only catalog that external users can adopt confidently while remaining useful for internal dogfooding.

---

## Proposed Solution

Create a V1 marketplace release that:
- Ships exactly 3 verified plugins (`git`, `enterprise`, `newsroom`) -- the only plugins currently ready.
- Enforces a single normative acceptance checklist in `docs/plugin-standards.md`.
- Assigns categories using standard Anthropic conventions with compound-engineering tags.
- Publishes the marketplace via official Claude Code marketplace mechanics (git-based, relative paths).
- Is installable and discoverable by both humans and agents.
- Includes symlink migration guide for existing users.

---

## Resolved Critical Questions

### Q1: Which community marketplaces must be listed in V1?

**Answer: None. Community listing is deferred to V2.**

V1 deliverable is "marketplace exists and is installable." V2 is "marketplace is discoverable through external channels." Research identified these targets for V2:

**Tier 1 (V2 launch day):**
- `anthropics/claude-plugins-official` -- submit via form at clau.de/plugin-directory-submission (gated review process)
- `claudemarketplaces.com` -- automatic if marketplace.json validates and repo has 5+ GitHub stars
- `davepoon/buildwithclaude` -- PR-based submission (largest community hub, 2,500 stars)

**Tier 2 (V2 first week):**
- `ComposioHQ/awesome-claude-plugins` (1,300 stars) -- PR with plugin folder
- `ccplugins/awesome-claude-code-plugins` (485 stars) -- PR
- `rohitg00/awesome-claude-code-toolkit` (510 stars) -- PR per CONTRIBUTING.md

**Tier 3 (nice-to-have):**
- `claude-plugins.dev` -- automatic (indexes all public repos)
- `hesreallyhim/awesome-claude-code` -- automated recommendation system
- `Chat2AnyLLM/awesome-claude-plugins` -- tracking list

**Prerequisites for all:** Valid `.claude-plugin/marketplace.json`, public GitHub repo, README.md. Official Anthropic directory requires passing quality and security review.

### Q2: What is the minimal acceptance checklist per plugin?

**Answer: Split into agent-automatable and human-judgment tiers.**

**Agent-verifiable (automated):**
- [ ] `claude plugin validate .` exits with code 0
- [ ] `marketplace.json` entry has non-empty `description`, `category`, `tags`
- [ ] Plugin installs without error via `/plugin install <name>@<marketplace>`
- [ ] All paths in `plugin.json` (skills, commands, agents) resolve to real files
- [ ] No biome/tsc errors in TypeScript hooks

**Human-verifiable (judgment):**
- [ ] Category assignment aligns with the category decision criteria
- [ ] Plugin description accurately represents what it does
- [ ] At least one working demo flow exists (can run a command/skill end-to-end)

### Q3: How will "verified" status be documented and enforced over time?

**Answer: V1 is manual maintainer verification. V2 adds CI automation.**

In V1, "verified" means the plugin passed the acceptance checklist above, reviewed by Nathan. The `.claude-plugin/marketplace.json` is the single source of truth -- if a plugin is listed, it is verified. Re-verification triggers: Claude Code major version updates, plugin code changes via PR.

V2 adds a marketplace validation CI workflow to `pr-quality.yml` that runs the agent-automatable checks on every PR.

### Q4: What is the minimum viable number of curated plugins for launch?

**Answer: 3 plugins -- `git`, `enterprise`, `newsroom`.**

V1 scope is frozen to these 3. They are the only plugins with complete manifests (after merge fix) and READMEs. The official Anthropic bundled marketplace launched with 14 plugins across 4 categories, but they had a team. For a solo maintainer, 3 high-quality verified plugins is a credible launch. Community intel confirms: comprehensive, curated collections win over quantity (@NirDiamantAI's "complete OS" post got 2,922 likes).

### Research Insights

**Repo audit findings:**
- Only 6 of 22 plugins have READMEs: `agent-skills-bridge`, `agentic-orchestration`, `chrome-devtools`, `enterprise`, `git`, `node-cert`
- Only 4 have complete manifests (version, author, keywords, license, component listings): `git`, `enterprise`, `claude-code`, `newsroom`
- 2 plugins have non-standard manifest locations: `observability`, `tools`
- 2 plugins have duplicate manifests with conflicting content: `enterprise`, `newsroom`

**V1 roster (frozen to 3 plugins):**

| Plugin | Category | Ready? | Why |
|--------|----------|--------|-----|
| `git` | development | Yes -- full manifest, README, 10 commands, 11 hooks | Most production-ready plugin |
| `enterprise` | development | Needs manifest merge (duplicate) | Showcases builder/validator pattern, multi-agent -- cutting edge per community intel |
| `newsroom` | productivity | Needs manifest merge (duplicate) | Showcases multi-agent research -- exactly what community is building toward |

**Backfill plan:** Add 2-3 plugins per week after V1 launch as they pass the checklist.

---

## V1 Plugin Roster

**V1 scope is frozen to 3 plugins** (git, enterprise, newsroom). These are the only plugins with complete manifests and READMEs (or near-complete). All other plugins are post-V1 backfill, added as they pass the acceptance checklist.

These 18 plugins are marketplace candidates (excluding 4 personal plugins: `research`, `dell-u4025qw`, `node-cert`, `plugin-template`):

| Plugin | Release | Phase | Blocker |
|--------|---------|-------|---------|
| `git` | **V1** | 0 | None |
| `enterprise` | **V1** | 0 | Fix duplicate manifest (merge bare root into `.claude-plugin/plugin.json`) |
| `newsroom` | **V1** | 0 | Fix duplicate manifest (merge bare root into `.claude-plugin/plugin.json`) |
| `bun-runner` | V1.1 | 1 | Needs README |
| `tsc-runner` | V1.1 | 1 | Needs README |
| `biome-runner` | V1.1 | 1 | Needs README |
| `kit` | V1.1 | 1 | Needs README |
| `claude-code` | V1.1 | 2 | Needs README |
| `x-api` | V1.1 | 2 | Needs README |
| `agentic-orchestration` | V1.1 | 2 | Already has README |
| `dojo` | V1.2 | 3 | Needs README |
| `agent-skills-bridge` | V1.2 | 3 | Already has README |
| `chrome-devtools` | V1.2 | 3 | Already has README |
| `firecrawl` | V1.2 | 3 | Needs README |
| `bun-typescript-starter` | V1.2 | 3 | Needs README |
| `tools` | V1.2 | 3 | Fix manifest location |
| `macos-settings` | V1.2 | 3 | Needs README |
| `observability` | V1.2 | 3 | Fix manifest location, WIP |

---

## Technical Considerations

### marketplace.json Schema (Confirmed)

The schema matches the official Anthropic bundled marketplace pattern. Updated after inspecting `anthropics/claude-code/.claude-plugin/marketplace.json` (14 plugins, 4 categories) and official docs.

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

### Research Insights

**Schema design decisions (updated after inspecting official Anthropic marketplace):**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| `$schema` field | Include | Only official Anthropic + Netresearch use this -- signals quality |
| Root metadata | **Flat root fields** (`description`, `version` at root) | Matches official `anthropics/claude-code` marketplace exactly. Previous plan used `metadata` wrapper from life-sciences pattern, but the bundled marketplace is simpler. |
| `owner.email` | Include | Official uses `support@anthropic.com`. We use `hi@nathanvale.com`. |
| `category` values | Standard Anthropic (`development`, `productivity`, `security`, `learning`) | Maximizes discoverability on claudemarketplaces.com which aggregates across marketplaces |
| `tags` | Include at plugin level | **Our differentiator.** Official marketplace does NOT use `tags`, but the schema supports them. We use them to express compound engineering taxonomy (`"compound-engineering"`, `"multi-agent"`, `"builder-validator"`) while keeping standard categories for cross-directory discoverability. |
| `keywords` | Reserve for individual plugin.json only | Avoid confusion between marketplace `tags` and plugin `keywords` |
| `strict` field | Omit (defaults to `true`) | All plugins have their own plugin.json |
| Plugin versions | Omit from marketplace.json | plugin.json versions take priority per docs ("plugin manifest always wins silently") |

**Source types for relative-path monorepo:**
```json
{ "source": "./plugins/git" }
```
This is the simplest pattern, used by all monorepo marketplaces including the official one. Works when marketplace is added via git (GitHub, GitLab). Does NOT work via URL-only distribution (confirmed in docs: "URL-based marketplaces only download the marketplace.json file itself").

**Agent-native parity additions:**
- Define a canonical stable URL for the manifest: `https://raw.githubusercontent.com/nathanvale/side-quest-plugins/main/.claude-plugin/marketplace.json`
- Every plugin entry must have non-empty `description`, `category`, and `tags` for machine consumption
- Post-install verification is machine-checkable: `claude plugin list | grep <plugin-name>`

### Pre-Implementation Fixes Required

**Manifest merge strategy for duplicates:** Claude Code reads `.claude-plugin/plugin.json` as the canonical manifest. When both exist, start with the `.claude-plugin/` version (has version, author, keywords, license metadata) and merge in any `skills`, `agents`, or other component arrays from the bare root version. Delete the bare root `plugin.json` after merge. Run `claude plugin validate plugins/<name>` before and after to verify.

| Issue | Fix | Priority | Phase |
|-------|-----|----------|-------|
| `enterprise` has duplicate manifests (`.claude-plugin/plugin.json` + bare `plugin.json`) | Merge: add 8 skills + 3 agents from bare root into `.claude-plugin/plugin.json`, delete bare | High | 0 |
| `newsroom` has duplicate manifests | Merge: add 1 agent from bare root into `.claude-plugin/plugin.json`, delete bare | High | 0 |
| `observability` uses bare `plugin.json` at root | Move to `.claude-plugin/plugin.json` | Medium | V1.2 |
| `tools` uses bare `plugin.json` at root | Move to `.claude-plugin/plugin.json` | Medium | V1.2 |
| Plugin.json schema inconsistency (some have keywords/license, some don't) | Normalize minimum fields: name, description, version, author | Low | V1.2 |

---

## Category System

### Research Insights

**The original 5-category compound engineering taxonomy (Discovery, Execution, Verification, Compounding, Tooling) has structural issues:**
- "Compounding" is the weakest -- it describes a meta-outcome, not a concrete action. No plugin cleanly fits.
- Multi-stage plugins (git, enterprise, kit) resist single-category assignment.
- Custom categories reduce discoverability on cross-marketplace aggregators.

**Recommended approach: Standard Anthropic categories + compound engineering tags.**

Use the official Anthropic category values as `category` (for discoverability), and express compound engineering positioning through `tags`:

| Plugin | `category` | `tags` (includes CE stage) |
|--------|-----------|---------------------------|
| `git` | `development` | git, safety, commits, hooks, compound-engineering |
| `enterprise` | `development` | orchestration, builder-validator, multi-agent, compound-engineering |
| `newsroom` | `productivity` | research, reddit, x, community, multi-agent, compound-engineering |
| `bun-runner` | `development` | testing, bun, mcp, compound-engineering |
| `kit` | `development` | search, code-intelligence, mcp, compound-engineering |
| `claude-code` | `development` | claude-code, knowledge, skills, mcp, compound-engineering |

**Category decision criteria (for future plugin additions):**
- `development` -- tools that help write, test, lint, search, or orchestrate code
- `productivity` -- tools for research, information gathering, workflow automation
- `security` -- tools focused on safety, auditing, or compliance
- `learning` -- tools for education, practice, or skill development

### Old-to-New Category Mapping

| Old README Category | New `category` | Notes |
|---------------------|---------------|-------|
| Research & Intelligence | `productivity` | Information gathering focus |
| Git & Version Control | `development` | Core dev tooling |
| Software Engineering | `development` | Orchestration is dev tooling |
| Code Quality & Testing | `development` | Test/lint/typecheck |
| Meta & Knowledge Banks | `development` | Claude Code knowledge for devs |
| Web & Browser | `development` | Browser automation for dev |
| Infrastructure & Debugging | `development` | Dev environment setup |

---

## Starter Packs

### Concept

Starter packs are recommended groupings of related plugins for common workflows. Each plugin installs independently -- packs are a discovery shortcut, not a bundle. They solve the "which plugins should I install together?" problem as the catalog grows past 10-15 plugins.

### Why Not in marketplace.json?

The marketplace.json schema does NOT support custom fields like `collections`. Root-level fields are limited to `name`, `version`, `description`, `owner`, `metadata`, and `plugins`. Adding unknown fields may break `claude plugin validate .`. Therefore, starter packs are a **documentation-layer concept** -- README sections, plan docs, and optional project settings files -- not a schema extension.

### Initial Starter Packs (V1.1+)

| Pack | Description | Plugins |
|------|-------------|---------|
| **quality-gates** | Lint, type-check, and test your code | bun-runner, tsc-runner, biome-runner |
| **compound-engineering** | The full CE stack -- safety, orchestration, research | git, enterprise, newsroom |
| **code-intelligence** | Semantic search, navigation, and Claude Code knowledge | kit, claude-code |

These packs will be defined once enough plugins exist to form meaningful groups (V1.1+, when quality-gates and code-intelligence plugins pass the acceptance checklist).

### Delivery Mechanisms

1. **README section** with grouped install commands (human discovery). Users see which plugins go together and can copy-paste install commands for an entire pack.

2. **Example project settings files** in `starter-packs/` directory -- `.claude/settings.json` snippets with `enabledPlugins` pre-configured that teams can copy into their projects (agent + team discovery). Each file is a ready-to-use settings fragment.

### Timing

V1.1+ -- when enough plugins exist to form meaningful groups. The compound-engineering pack can be documented immediately (all 3 plugins are V1), but quality-gates and code-intelligence packs require their constituent plugins to pass the acceptance checklist first.

---

## Acceptance Criteria

### Marketplace-Level (V1 release gate)

- [ ] `.claude-plugin/marketplace.json` exists, includes `$schema`, and validates via `claude plugin validate .`
- [ ] All 3 V1 plugins (`git`, `enterprise`, `newsroom`) install correctly via `/plugin install <name>@side-quest`
- [ ] Remote install proven: `/plugin marketplace add nathanvale/side-quest-plugins` works from a clean machine
- [ ] README explains how to add the marketplace, lists V1 plugins with categories, includes symlink migration guide
- [ ] `docs/plugin-standards.md` defines the single normative acceptance checklist and category criteria
- [ ] V2/V3 scope noted in README (one line)

### Per-Plugin Acceptance Checklist (single normative checklist)

This is the checklist that goes into `docs/plugin-standards.md`. Every plugin must pass ALL items before being added to `marketplace.json`. The Q2 granular checklist and the simplified acceptance criteria are merged into this single source of truth.

**Agent-verifiable (automated):**
- [ ] `claude plugin validate .` exits with code 0
- [ ] `marketplace.json` entry has non-empty `description`, `category`, `tags`
- [ ] Plugin installs without error via `/plugin install <name>@side-quest`
- [ ] All paths in `plugin.json` (skills, commands, agents) resolve to real files
- [ ] No biome/tsc errors in TypeScript hooks (if plugin has hooks)

**Human-verifiable (judgment):**
- [ ] Category assignment aligns with the category decision criteria
- [ ] Plugin description accurately represents what it does
- [ ] At least one working demo flow exists (can run a command/skill end-to-end)
- [ ] README exists with minimum viable content: purpose, install command, one usage example

### Research Insights

**Reduced from 8 to 6 marketplace-level criteria + 9 per-plugin criteria.** The per-plugin checklist is the single normative source -- no more ambiguity between the Q2 checklist and the simplified acceptance criteria. Removed:
- "Documentation bundle is complete" -- collapsed to 2 docs instead of 5
- "Listed in all agreed community directories" -- deferred to V2

---

## Success Metrics

- Marketplace is installable via `/plugin marketplace add nathanvale/side-quest-plugins`
- At least 3 curated plugins are discoverable in the `/plugin` Discover tab and installable
- A new user can install and use at least one plugin by reading only the README
- An agent can fetch `marketplace.json` from the canonical URL and enumerate available plugins

---

## Dependencies & Risks

- **Schema drift:** Marketplace schema could change; rely on current official docs. Mitigated by including `$schema` for validation.
- **Trust & reputation:** Any low-quality plugin undermines "verified" positioning. Mitigated by launching with only 3 already-ready plugins.
- **Plugin manifest inconsistencies:** enterprise and newsroom have duplicate manifests with conflicting content. Must merge before V1 (see Phase 0 Step 1).
- **Install mechanism assumption:** Relative `source` paths in marketplace.json depend on git-based marketplace add cloning the full repo. Docs confirm this works, but Phase 0 Step 6 is a go/no-go gate to prove it.
- **Symlink migration:** Existing users install via `ln -s`. Deleting plugin directories breaks those symlinks. Mitigated by README migration guide and keeping non-marketplace plugins accessible via symlinks.
- **Star threshold:** claudemarketplaces.com requires 5+ GitHub stars for auto-discovery. May not have this at V1 launch.

---

## Implementation Outline (V1)

### Phase 0: Marketplace Shell with V1 Plugins (git, enterprise, newsroom)

This phase creates the marketplace shell with all 3 V1 plugins, fixes manifest issues, creates documentation, and validates the install mechanism. No legacy clone needed -- git history preserves all plugin state and `git checkout <ref> -- plugins/<name>` can restore any plugin at any time.

**Step 1: Fix pre-existing manifest issues**
- **enterprise**: Merge bare root `plugin.json` INTO `.claude-plugin/plugin.json`. The bare root version has richer content (8 skills, 3 agents) that the `.claude-plugin/` version is missing. Merge strategy: start with the `.claude-plugin/` version (has version, author, keywords, license), add `skills`, `agents` arrays from bare root. Delete bare root `plugin.json` after merge. **Verify which manifest Claude Code reads by running `claude plugin validate plugins/enterprise` before and after.**
- **newsroom**: Same merge strategy. Bare root adds `agents: ["./agents/beat-reporter.md"]` that `.claude-plugin/` version is missing. Delete bare root after merge.

**Step 2: Strip down to V1 plugins only**
- Remove all plugin directories from `plugins/` except `git`, `enterprise`, `newsroom`
- Remove personal plugins entirely (`research`, `dell-u4025qw`, `node-cert`, `plugin-template`) -- these move to `nathan-plugins` repo later
- Keep repo infrastructure intact (CI, biome, tsconfig, CLAUDE.md, etc.)
- Keep `docs/plans/` and `docs/brainstorms/` (these document the marketplace vision)
- Keep `specs/` directory (observability and other spec work)

**Step 3: Create marketplace shell**
- Create `.claude-plugin/marketplace.json` with all 3 V1 plugins (`git`, `enterprise`, `newsroom`)
- Include `$schema`, `version`, `description`, `owner` fields at root level (matching official Anthropic pattern -- no `metadata` wrapper)
- Add `docs/plugin-roadmap.md` for all 15 remaining marketplace-candidate plugins with target categories and rollout phase

**Step 4: Create initial documentation**
- Update `README.md` -- marketplace positioning, install instructions, V1 plugin list with categories, symlink migration note (see Step 6)
- Create `docs/plugin-standards.md` -- single normative acceptance checklist (see Acceptance Checklist section), category decision criteria, contribution workflow (defines the bar for all future plugin additions)

**Step 5: Validate the shell (local)**
- Run `claude plugin validate .` on the marketplace
- Test local install: `/plugin marketplace add ./`
- Verify all 3 V1 plugins install and one command each works
- Commit as the new baseline

**Step 6: Prove remote install mechanism**
- Push the feature branch to origin
- Test remote add: `/plugin marketplace add nathanvale/side-quest-plugins` (use branch ref if not on main)
- **This is a go/no-go gate.** If relative `source` paths don't resolve via git-based marketplace add, the entire approach needs rethinking before proceeding. The docs confirm: "Git-based marketplaces clone the entire repository, making relative paths work correctly." But we must prove it.
- Document the result in this plan

**Step 7: Add symlink migration note to README**
- Current users install via `ln -s $(pwd)/plugins/* ~/.claude/plugins/`
- New marketplace install replaces this. README must include a migration section:
  1. Remove old symlinks: `rm ~/.claude/plugins/{git,enterprise,newsroom}`
  2. Add marketplace: `/plugin marketplace add nathanvale/side-quest-plugins`
  3. Install plugins: `/plugin install git@side-quest`, etc.
- Note: plugins not yet in the marketplace can continue using symlinks

### Phase 1: Core Development Tools -- V1.1 (bun-runner, tsc-runner, biome-runner, kit)

**This phase is post-V1.** Bring back the core quality-gate and code-intelligence plugins after V1 ships.

**Fix pre-existing issues:**
- Move `tools` bare `plugin.json` to `.claude-plugin/plugin.json` (if `tools` is included)

**For each plugin:**
- Restore from git history: `git checkout main~N -- plugins/<name>` (where N is the commit before Phase 0 strip)
- Add README using the minimum viable template (see plugin-standards.md): purpose (1 paragraph), install command, one usage example, known limitations
- Run acceptance checklist (the single normative checklist from plugin-standards.md)
- Add to `marketplace.json` once passing

**Rollout order (by dependency and utility):**
1. `bun-runner` -- test runner, foundational quality gate
2. `tsc-runner` -- type checker, pairs with bun-runner
3. `biome-runner` -- linter/formatter, completes the quality triad
4. `kit` -- code intelligence, widely useful for all development

**Validate after each addition:**
- `claude plugin validate .`
- Test install of newly added plugin
- Verify existing plugins still work

### Phase 2: Knowledge & Productivity Plugins -- V1.1 (claude-code, x-api, agentic-orchestration)

**This phase is post-V1.** Bring in the Claude Code knowledge bank, X API, and agentic orchestration pattern library.

**For each plugin:**
- Restore from git history
- Add README if missing (`claude-code` and `x-api` need READMEs)
- Run acceptance checklist
- Add to `marketplace.json` once passing

**Rollout order:**
1. `claude-code` -- knowledge bank for Claude Code itself, meta-useful
2. `agentic-orchestration` -- already has README, teaches multi-agent patterns
3. `x-api` -- X/Twitter API, needs README

### Phase 3: Remaining Plugins & Polish -- V1.2

**This phase is post-V1.** Bring in remaining marketplace-candidate plugins that are close to ready.

**Candidate plugins (prioritized by readiness):**
- `agent-skills-bridge` -- already has README
- `chrome-devtools` -- already has README
- `dojo` -- needs README
- `firecrawl` -- needs README
- `bun-typescript-starter` -- needs README
- `tools` -- fix manifest location
- `macos-settings` -- needs README
- `observability` -- fix manifest location, WIP
- Remaining plugins backfilled as they pass the checklist

**Polish:**
- Normalize `plugin.json` schema across all listed plugins (minimum fields: name, description, version, author)
- Move `observability` bare `plugin.json` to `.claude-plugin/plugin.json` (if included)
- Move `tools` bare `plugin.json` to `.claude-plugin/plugin.json`
- Final `marketplace.json` review -- all descriptions, categories, and tags populated
- Full end-to-end test: remote add, install all plugins, run one command each

### Research Insights

**Phase restructuring rationale (post-review):**
- V1 is now frozen to 3 plugins (git, enterprise, newsroom) shipped in Phase 0. Phases 1-3 are post-V1 backfill.
- Legacy clone eliminated -- git history preserves all plugin state. Use `git checkout <ref> -- plugins/<name>` to restore.
- Remote install verification added as a go/no-go gate in Phase 0. The official docs confirm relative paths work via git-based marketplace add ("Git-based marketplaces clone the entire repository, making relative paths work correctly") but we prove it before shipping.
- Manifest merge strategy made explicit: `.claude-plugin/plugin.json` is canonical, merge in component arrays from bare root, validate before and after.
- Single normative acceptance checklist replaces the previous two-tier ambiguity (5 high-level criteria vs 12 granular items).
- Symlink migration path added for existing users.

**Documentation reduction rationale (from write-concisely and simplicity reviews):**
- `CONTRIBUTING.md` deferred -- no external contributors in V1, one-person curation
- `docs/verification-checklist.md` merged into `plugin-standards.md` as a checklist section
- `docs/install-guide.md` merged into README as "Quick Start" section (5-10 lines)
- Category router spec is a section in `plugin-standards.md`, not a separate document

**README target:** 300-400 words. Lead with what it does, how to install, what's included. Include symlink migration section. No marketing prose.

**plugin-standards.md target:** 800-1000 words. Categories (decision criteria), single normative acceptance checklist (agent-automatable + human-judgment tiers), minimum viable README template, contribution steps (4 max), manifest schema (required fields + example).

---

## Multi-Agent Plugin Considerations

### Research Insights

**Three plugins implement multi-agent patterns.** The marketplace should surface this clearly:

| Plugin | Coordination Pattern | Agents | Compute Multiple |
|--------|---------------------|--------|-----------------|
| `enterprise` | Hierarchical (Spock -> Scotty + McCoy + Computer) | 3 | 2-3x |
| `newsroom` | Supervisor (Editor-in-Chief -> Beat Reporters) | 1 (spawns N) | 2-5x |
| `agentic-orchestration` | Knowledge bank (teaches patterns, doesn't orchestrate) | 0 | 1x |

**Standards for multi-agent plugins (add to plugin-standards.md):**
- Must document coordination pattern, agent roles, and approximate compute cost in README
- Every agent with write access should be paired with a read-only validator OR PostToolUse hooks enforcing quality gates
- File boundaries must be stated per-agent

**What NOT to build for V1:**
- Do not build a multi-agent verification pipeline -- manual checklist is fine for 3-5 plugins
- Do not build a "category routing agent" -- assign categories by looking at plugins
- Do not require community contributions to be multi-agent reviewed

---

## Community Intel (2026-02-21)

**Source:** @side-quest/last-30-days CLI (Reddit + X) + web research. 12 Reddit threads, 11 X posts analyzed.

### Ecosystem Snapshot

| Metric | Value | Source |
|--------|-------|--------|
| Plugin repos on GitHub | 4,961 | @chiefofautism (2,274 likes, Feb 15) |
| Official bundled plugins | 14 | `anthropics/claude-code/marketplace.json` |
| Official directory stars | 7.9k | `anthropics/claude-plugins-official` |
| Official directory forks | 776 | GitHub |
| Auto-index threshold | 5+ GitHub stars | claudemarketplaces.com |
| Community sentiment | "Turns Claude Code from a dev tool into a platform" | @alex_william22 (Feb 19) |

### What the Community is Building

- **Multi-agent orchestration** is the hot pattern. OpenClaw plugin (r/ClaudeAI, Feb 14) orchestrates Claude Code sessions from Telegram with multi-agent, multi-turn flows. Our `enterprise` and `newsroom` plugins are ahead of this curve.
- **One-click installs** are driving adoption. @firecrawl announced official marketplace inclusion (1,011 likes) with a 3-step install flow. This is exactly our V1 UX target.
- **"App Store" framing** is how the community describes it. @oliviscusAI's "Claude Code just got an App Store for agents" (803 likes) shows the mental model users have.
- **Comprehensive plugin ecosystems** get the most traction. @NirDiamantAI's "complete operating system for Claude Code" post (2,922 likes, 261 RT) was the highest-engagement item -- bundled, curated collections win.

### What This Validates

| Plan Decision | Community Evidence |
|---------------|-------------------|
| Curated, verified-only model | Anthropic does the same (quality + security review for official directory) |
| 4 standard categories | Official marketplace uses exactly `development`, `productivity`, `learning`, `security` |
| Relative source paths in monorepo | Universal pattern, including official marketplace |
| `$schema` inclusion | Only official + 1 community marketplace use it -- signals quality |
| Multi-agent plugins as flagship | Community is building toward this but few have shipped -- we're ahead |
| "Compound engineering" positioning | **Unique.** No other marketplace curates around a methodology. |
| `tags` for custom taxonomy | Official doesn't use `tags` yet but schema supports them -- our differentiator |

### What This Challenges

| Original Assumption | Community Reality | Action |
|--------------------|------------------|--------|
| Use `metadata` wrapper for root fields | Official marketplace uses flat root fields (`description`, `version` at root level) | **Fixed:** Schema updated to match official pattern |
| 53 plugins in official marketplace | Actually 14 bundled plugins (the "53" number from X includes all official directory listings) | **Noted:** Corrected in plan |
| Community moves slowly | 4,961 repos, multiple aggregators, active X discourse | **Action:** Ship V1 fast. We're not early, we're right on time. |

### Key Community Sources

- [@chiefofautism](https://x.com/chiefofautism/status/2023151858634649703) (2,274 likes) -- "4,961 repos on GitHub, official marketplace has 53 plugins"
- [@NirDiamantAI](https://x.com/NirDiamantAI/status/2015125394114920936) (2,922 likes, 261 RT) -- Complete "operating system" for Claude Code plugins
- [@firecrawl](https://x.com/firecrawl/status/2021266983086588238) (1,011 likes) -- Firecrawl on official marketplace, 3-step install
- [@oliviscusAI](https://x.com/oliviscusAI/status/2019341411632456116) (803 likes) -- "App Store for agents"
- [@adocomplete](https://x.com/adocomplete/status/2015188255608905832) (580 likes) -- Plugin system as workflow multiplier
- [@elithrar](https://x.com/elithrar/status/2016526251536592921) (231 likes) -- Cloudflare skills via marketplace add
- [@alex_william22](https://x.com/alex_william22/status/2024500953861554418) -- "Turns Claude Code from dev tool into a platform"
- [OpenClaw plugin](https://www.reddit.com/r/ClaudeAI/comments/1r4jqyc/openclaw_plugin_to_orchestrate_claude_code/) (r/ClaudeAI, 8 pts, 10 comments) -- Multi-agent orchestration plugin
- [claude-tools marketplace blog](https://paddo.dev/blog/claude-tools-plugin-marketplace/) -- Community marketplace patterns
- [claudemarketplaces.com](https://claudemarketplaces.com/) -- Auto-discovery aggregator

---

## V2/V3 Scope (Document Only)

### V2: Distribution & Growth
- List in community directories (see Tier 1/2/3 targets above)
- Add marketplace validation CI workflow to `pr-quality.yml`
- Backfill remaining plugins (READMEs, manifest normalization)
- `CONTRIBUTING.md` for external contributors
- Plugin versioning strategy
- Auto-update configuration
- `starter-packs/` directory with example `.claude/settings.json` files for each pack
- File a Claude Code feature request for native `collections` in marketplace.json schema and batch install command

### V3: Advanced
- `/marketplace:verify <plugin-path>` command (agent-automated acceptance checks)
- Community intel freshness tracking for marketplace docs
- CLAUDE.md context fragment for agent-native marketplace awareness
- Plugin dependency declaration and pre-install validation
- Structured category router as JSON (alongside prose spec)
- Release channels (stable/latest) via ref-pinned marketplace entries

---

## User Flow Gap Analysis

### Research Insights

**Spec flow analysis identified 27 gaps across 4 user flows.** Critical ones addressed in V1:

| Gap | Severity | V1 Mitigation |
|-----|----------|---------------|
| Browse experience after `/plugin marketplace add` unspecified | Critical | Documented: plugins appear in `/plugin` Discover tab (Claude Code built-in) |
| Plugin dependencies not validated pre-install | Critical | V1: Document dependencies in plugin descriptions. V2: structured dependency declaration |
| Acceptance checklist doesn't exist | Critical | Created in Phase 1 (plugin-standards.md) |
| No uninstall flow documented | High | Document: `/plugin uninstall <name>@side-quest` (Claude Code built-in) |
| No update/upgrade flow | High | Document: `/plugin marketplace update side-quest` (built-in) |
| No first-run experience | High | V1: Plugin descriptions in marketplace.json. V2: onboarding commands |
| Dev-vs-marketplace plugin path conflict | High | V1: Use `claude --plugin-dir` for local dev, marketplace install for production |

---

## Sources & References

- **Origin brainstorm:** `docs/brainstorms/2026-02-21-successful-marketplace-brainstorm.md`
- **Related brainstorm:** `docs/brainstorms/2026-02-21-marketplace-taxonomy-brainstorm.md`
- **Root conventions:** `README.md`
- **Project instructions:** `.claude/CLAUDE.md`
- **External docs:**
  - https://code.claude.com/docs/en/plugin-marketplaces
  - https://code.claude.com/docs/en/plugins-reference
  - https://code.claude.com/docs/en/discover-plugins
- **Official Anthropic marketplace (inspected 2026-02-21):**
  - `anthropics/claude-code/.claude-plugin/marketplace.json` (14 bundled plugins, 4 categories, flat root schema)
  - `anthropics/claude-plugins-official` (official directory, 7.9k stars, 776 forks, form submission at clau.de/plugin-directory-submission)
- **Community marketplace examples:**
  - `netresearch/claude-code-marketplace` (high-quality community)
  - `Dev-GOM/claude-code-marketplace` (mature community, v2.31.0)
  - `claudeforge/marketplace` (large community)
  - `mhattingpete/claude-skills-marketplace` (shared on X by @tom_doerr)
- **Community directories:**
  - `claudemarketplaces.com` (auto-discovery, 5+ stars)
  - `davepoon/buildwithclaude` (PR-based, 2,500 stars)
  - `ComposioHQ/awesome-claude-plugins` (curated, 1,300 stars)
  - `Chat2AnyLLM/awesome-claude-plugins` (curated list)
  - Full directory list in Resolved Critical Questions section
- **Community intel (2026-02-21):**
  - @side-quest/last-30-days CLI: 12 Reddit threads, 11 X posts
  - See Community Intel section for full source list with engagement metrics
- **Compound engineering:** https://every.to/source-code/my-ai-had-already-fixed-the-code-before-i-saw-it
