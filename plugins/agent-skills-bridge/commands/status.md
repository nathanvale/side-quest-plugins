---
description: Audit skill sharing state across all installed AI coding tools
disable-model-invocation: true
allowed-tools: Bash, Read, Glob, Grep
---

# agent-skills-bridge:status

Audit the current state of skill sharing across all installed AI coding tools.

## Instructions

Perform the following steps to audit cross-tool skill compatibility:

### Step 1: Detect Installed Tools

Check which AI coding tools are installed by running these commands:

```bash
# Claude Code
which claude 2>/dev/null && claude --version 2>/dev/null

# Codex CLI
which codex 2>/dev/null && codex --version 2>/dev/null

# Cursor (check if installed as app)
ls /Applications/Cursor.app 2>/dev/null

# Gemini CLI
which gemini 2>/dev/null && gemini --version 2>/dev/null

# Windsurf
ls /Applications/Windsurf.app 2>/dev/null
```

Report which tools are installed and their versions.

### Step 2: Scan All Skill Locations

Scan every known skill directory for SKILL.md files:

**Personal (user-level):**
- `~/.claude/skills/*/SKILL.md`
- `~/.codex/skills/*/SKILL.md`
- `~/.cursor/skills/*/SKILL.md`
- `~/.gemini/skills/*/SKILL.md`
- `~/.windsurf/skills/*/SKILL.md`
- `~/.agents/skills/*/SKILL.md` (shared convention)

**Plugin cache (Claude Code only):**
- `~/.claude/plugins/cache/*/skills/*/SKILL.md` (search recursively)

**Project-level (current directory):**
- `.claude/skills/*/SKILL.md`
- `.codex/skills/*/SKILL.md`
- `.agents/skills/*/SKILL.md`

For each SKILL.md found, extract the `name` and `description` from frontmatter.

### Step 3: Build Availability Matrix

Create a table showing which skills are available to which tools:

| Skill | Claude Code | Codex CLI | Cursor | Gemini CLI | Location |
|-------|-------------|-----------|--------|------------|----------|
| ... | ... | ... | ... | ... | ... |

A skill is "available" to a tool if it exists in that tool's skill directory (or a shared directory the tool reads).

### Step 4: Flag Compatibility Issues

Check each SKILL.md for:
- Claude-specific frontmatter (`allowed-tools`, `disable-model-invocation`) — note that these are ignored by other tools
- Skills that exist in only one tool's directory (not shared)
- Symlinks that point to missing targets
- Empty or malformed SKILL.md files

### Step 5: Check openskills

```bash
# Check if openskills is installed
which openskills 2>/dev/null || npm list -g openskills 2>/dev/null

# Check version if installed
openskills --version 2>/dev/null
```

### Step 6: Report

Present a summary with:
1. **Installed tools** — name and version
2. **Skill inventory** — total skills found, per-location breakdown
3. **Availability matrix** — which skills work in which tools
4. **Issues found** — compatibility warnings, missing symlinks, orphaned skills
5. **openskills status** — installed/not installed, version
6. **Recommendations** — specific actions to improve cross-tool sharing
