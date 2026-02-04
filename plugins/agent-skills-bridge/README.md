# agent-skills-bridge

Knowledge-first plugin for cross-tool AI coding skill compatibility.

## What It Does

Tracks the fast-moving ecosystem of shareable AI coding assistant skills (SKILL.md format) across Claude Code, Codex CLI, Cursor, Gemini CLI, Windsurf, and others. Provides expert knowledge about what works where, recommends the current best approach for sharing skills, and keeps its knowledge base up to date.

This plugin does NOT reinvent the installer. Today it wraps/recommends `openskills`. Tomorrow it might recommend something else. The plugin is the stable abstraction; the tooling underneath is an implementation detail.

## Why This Exists

- The cross-tool skill ecosystem is moving fast (SKILL.md standard, `.agents/skills/` convention, AGENTS.md, multiple marketplaces)
- There's no single source of truth for "what works where"
- Eventually there will be an industry standard, but we're not there yet
- This plugin tracks the convergence and gives Claude (and users) expert knowledge about the current state

## Commands

### `/agent-skills-bridge:setup`

Interactive setup for cross-tool skill sharing. Detects installed tools, checks for `openskills`, scans for skills, and recommends the best approach.

### `/agent-skills-bridge:status`

Audit skill sharing state across all installed AI coding tools. Reports which skills are available to which tools and flags compatibility issues.

### `/agent-skills-bridge:update-knowledge`

Fetch the latest cross-tool skill compatibility info from GitHub issues, npm, and community sources. Presents findings as a diff before updating reference files.

## Skill (Passive Knowledge)

The `agent-skills-bridge` skill triggers automatically when discussing cross-tool skills, SKILL.md compatibility, skill sharing, marketplace distribution, or making skills work across multiple AI coding tools. It provides quick-reference facts and links to deep-dive reference files.

## Structure

```
plugins/agent-skills-bridge/
├── .claude-plugin/
│   └── plugin.json
├── README.md
├── commands/
│   ├── setup.md
│   ├── status.md
│   └── update-knowledge.md
└── skills/
    └── agent-skills-bridge/
        ├── SKILL.md
        └── references/
            ├── compatibility-matrix.md
            ├── ecosystem-tools.md
            ├── github-issues.md
            ├── community-voices.md
            └── standards.md
```
