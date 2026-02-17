---
name: stakeout
description: >
  Shorthand for /newsroom:dispatch with --mode changes. Delta-focused research
  that looks for what's new or changed on a topic. Always refreshes sources.
skill: the-desk
argument-hint: '"[topic] [--quick|--deep] [--reddit|--x|--both] [--days N] [--format TYPE] [--plain]"'
---

Run a delta-focused research dispatch. This is a preset for `/newsroom:dispatch --mode changes`.

Equivalent to: `/newsroom:dispatch "{topic}" --mode changes`

The stakeout always refreshes sources and focuses on what's new. The preflight will print: "Mode: changes (delta-focused, refreshing sources)" so you can see the active preset.

## Usage

```
/newsroom:stakeout "Home Assistant"
/newsroom:stakeout "Claude Code" --deep
/newsroom:stakeout "MCP protocol" --days 7
```

## How It Works

This command prepends `--mode changes` to your arguments before invoking the Editor-in-Chief. All other dispatch flags work normally.

Changes mode adjustments:
- Always adds `--refresh` (bypass cache)
- Defaults to `--days 7` if not specified (shorter window for deltas)
- Reporters focus on what's new or changed, not established facts
