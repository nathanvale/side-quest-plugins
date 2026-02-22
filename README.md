# Side Quest Plugins

> Curated, verified Claude Code plugins for compound engineering workflows.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A marketplace of Claude Code plugins that encode expertise into reusable, composable units. Each plugin is self-contained with its own manifest, skills, commands, agents, and hooks. No hard dependencies between plugins.

Every plugin in this marketplace is verified -- it passes the [acceptance checklist](docs/plugin-standards.md), installs cleanly, and has at least one working end-to-end flow. The "compound engineering" philosophy means plugins work well alone but compound when combined: git safety hooks protect your commits while enterprise orchestrates multi-agent builds and newsroom researches community sentiment.

## Quick Start

Add the marketplace and install plugins:

```bash
# Add the marketplace
/plugin marketplace add nathanvale/side-quest-plugins

# Install a plugin
/plugin install git@side-quest

# Use it
/git:commit
```

## V1 Plugins

| Plugin | Category | Description |
|--------|----------|-------------|
| **git** | development | Git workflows with 10 commands, safety hooks, and session logging. Blocks force push, enforces conventional commits, preserves session memory across context compressions. |
| **enterprise** | development | Multi-agent engineering orchestrator with Star Trek metaphor. Spock coordinates Scotty (builder) and McCoy (validator) for documentation, code review, and refactoring. 9 commands, 8 skills, 3 agents. |
| **newsroom** | productivity | Multi-agent research across Reddit, X, and the web. Mickey "The Desk" Malone dispatches beat reporters in parallel with engagement metrics and source links. 2 commands, 2 skills, 1 agent. |

## Starter Packs (V1.1)

Starter packs group related plugins for common workflows. Each plugin installs independently -- packs are a discovery shortcut, not a bundle.

| Pack | Plugins | Description |
|------|---------|-------------|
| **quality-gates** | bun-runner, tsc-runner, biome-runner | Lint, type-check, and test your code |
| **compound-engineering** | git, enterprise, newsroom | Full CE stack -- safety, orchestration, research |
| **code-intelligence** | kit, claude-code | Semantic search, navigation, Claude Code knowledge |

Install a pack by installing each plugin:

```bash
# Quality Gates
/plugin install bun-runner@side-quest
/plugin install tsc-runner@side-quest
/plugin install biome-runner@side-quest
```

## Migrating from Symlinks

If you previously installed plugins via `ln -s`:

1. Remove old symlinks: `rm ~/.claude/plugins/{git,enterprise,newsroom}`
2. Add the marketplace: `/plugin marketplace add nathanvale/side-quest-plugins`
3. Install plugins: `/plugin install git@side-quest` (repeat for each plugin)

Plugins not yet in the marketplace can continue using symlinks.

## Plugin Standards

See [docs/plugin-standards.md](docs/plugin-standards.md) for the acceptance checklist, category system, versioning policy, and contribution guide.

## Roadmap

V1.1 adds core development tools (bun-runner, tsc-runner, biome-runner, kit). See [docs/plugin-roadmap.md](docs/plugin-roadmap.md).

## Development

```bash
git clone https://github.com/nathanvale/side-quest-plugins.git
cd side-quest-plugins
bun install
bun run validate               # Full gate: lint + typecheck + marketplace validation
bun run validate:marketplace   # Marketplace structure checks only
```

Individual checks:

```bash
bun run check      # Biome lint + format
bun run typecheck  # TypeScript type check
```

Branch naming: `type/description` (e.g., `feat/add-plugin`, `fix/manifest-merge`). Commits use [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint. CI runs `bun run validate:marketplace --check-bump` on PRs to enforce marketplace.json structure and [version bumps](docs/plugin-standards.md#versioning-policy). Run `bun run validate` before pushing.

## License

MIT License - Copyright (c) 2025-2026 Nathan Vale

See [LICENSE](LICENSE) for full text.
