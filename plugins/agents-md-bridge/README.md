# agents-md-bridge

Auto-discovers and injects `AGENTS.md` files into Claude Code session context at startup. Bridges the gap for the [emerging AGENTS.md convention](https://github.com/anthropics/claude-code/issues/6235) that Claude Code does not yet natively support, giving you hierarchical agent-specific rules, boundaries, and tool catalogs alongside your existing `CLAUDE.md` files.

## Install

```
/plugin install agents-md-bridge@side-quest
```

## Usage

No commands or configuration required. The plugin runs automatically on every session start (startup, resume, compact, clear).

1. Create an `AGENTS.md` file anywhere in your project:

```
my-project/
  AGENTS.md              # Project-wide agent rules
  src/
    components/
      AGENTS.md          # Component-specific agent rules
```

2. Start a Claude Code session. The plugin discovers all `AGENTS.md` files and injects their content into context.

### What goes in AGENTS.md?

Anything you want agents (but not necessarily humans) to know:

- Tool usage rules and restrictions
- Agent-specific behavioral boundaries
- Approved API patterns and forbidden anti-patterns
- Multi-agent coordination conventions
- Context that applies to automated workflows but not manual development

## How It Works

On `SessionStart`, a hook script:

1. Scans the project directory for `AGENTS.md` files (max 5 levels deep)
2. Skips `node_modules`, `.git`, `dist`, `build`, `.next`, `vendor`
3. Sorts files by depth (root first, deeper files after)
4. Outputs formatted content to stdout for context injection

### Safety Limits

| Limit | Value |
|-------|-------|
| Max files | 10 |
| Max file size | 10KB (truncated with marker) |
| Max total size | 50KB |
| Max directory depth | 5 levels |
| Hook timeout | 5 seconds |
| Self-destruct timer | 4.5 seconds |

## Requirements

- Bun runtime (ships with Claude Code)

## Limitations

- No deduplication against `CLAUDE.md` content -- if you have overlapping content in both files, it will appear twice in context
- No configuration file in v1 -- exclusion patterns and limits are hardcoded
- Files deeper than 5 levels are not discovered
- The plugin does not watch for file changes mid-session -- it reads files at session start only
