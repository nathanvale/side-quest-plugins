---
name: agent-skills-bridge
description: >
  Knowledge about sharing AI coding assistant skills across tools (Claude Code,
  Codex CLI, Cursor, Gemini CLI, Windsurf). Use when discussing: SKILL.md format,
  cross-tool skill compatibility, .agents/skills/ convention, skill symlinks,
  skill directories, openskills, or how to make skills work across multiple AI
  coding tools.
---

# Cross-Tool Skill Sharing Knowledge

Expert knowledge for making AI coding assistant skills work across multiple tools. This skill provides quick-reference facts; see `references/` for deep dives.

## The Current State (2025)

The SKILL.md format is the emerging open standard for portable AI coding skills. Multiple tools now support it, but the ecosystem is fragmented — each tool reads skills from different directories and supports slightly different frontmatter fields.

**The convergence direction** is `.agents/skills/` as a shared folder that all tools read from. We're not there yet, but it's coming.

## Recommended Approach: openskills

**Today's recommended tool for cross-tool skill sharing is [openskills](https://github.com/numman-ali/openskills).**

```bash
npm i -g openskills
```

Why openskills:
- Universal SKILL.md loader that works across Claude Code, Codex CLI, Cursor, Gemini CLI, and more
- Handles the complexity of different tool directories and symlinks
- Single command to install skills to all detected tools
- Actively maintained and tracking the ecosystem

This recommendation may change as the ecosystem evolves. See [ecosystem-tools.md](references/ecosystem-tools.md) for alternatives.

## SKILL.md Format Quick Reference

A SKILL.md file is a markdown file with YAML frontmatter:

```yaml
---
name: my-skill
description: >
  When to activate this skill. Include trigger phrases
  and use cases so the AI knows when to load it.
---

# Skill Title

Skill content here (markdown).
```

### Universal Frontmatter Fields

These fields work across all tools that support SKILL.md:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique skill identifier (kebab-case) |
| `description` | Yes | When to activate — trigger phrases, use cases |

### Claude Code-Specific Fields

These fields only work in Claude Code (other tools ignore them):

| Field | Description |
|-------|-------------|
| `disable-model-invocation` | Prevent auto-triggering (commands only) |
| `allowed-tools` | Tools the skill/command can use |

### Best Practices

- Keep SKILL.md under 500 lines (use reference files for deep content)
- Put supporting files in the skill directory (not at plugin root)
- Link to reference files with relative paths: `[ref.md](references/ref.md)`
- Write the `description` field for AI consumption — include trigger words
- Use `kebab-case` for skill names
- Test portability: avoid tool-specific features in the main SKILL.md body

## Tool Directory Paths

Each tool reads skills from specific directories:

| Tool | User Skills | Shared Skills | Project Skills |
|------|-------------|---------------|----------------|
| Claude Code | `~/.claude/skills/` | Pending (#6235) | `.claude/skills/` |
| Codex CLI | `~/.codex/skills/` | `~/.agents/skills/` | `.codex/skills/` |
| Cursor | `~/.cursor/skills/` | Unknown | `.cursor/skills/` |
| Gemini CLI | `~/.gemini/skills/` | Unknown | `.gemini/skills/` |
| Windsurf | `~/.windsurf/skills/` | Unknown | `.windsurf/skills/` |

**Key insight:** The `.agents/skills/` convention (both `~/.agents/skills/` globally and `.agents/skills/` per-project) is the emerging universal path. Codex CLI already reads from it. Claude Code support is tracked in [anthropics/claude-code#6235](https://github.com/anthropics/claude-code/issues/6235).

See [compatibility-matrix.md](references/compatibility-matrix.md) for full details including version-specific behavior.

## Sharing Strategies

### 1. openskills (Recommended)

```bash
# Install openskills globally
npm i -g openskills

# Install a skill to all detected tools
openskills install <skill-name>

# List available skills
openskills list
```

### 2. Symlinks (Manual but reliable)

Create skills in one location, symlink to each tool's directory:

```bash
# Source of truth
mkdir -p ~/.agents/skills/my-skill

# Symlink to each tool
ln -s ~/.agents/skills/my-skill ~/.claude/skills/my-skill
ln -s ~/.agents/skills/my-skill ~/.codex/skills/my-skill
```

### 3. .agents/skills/ Convention (Future)

When all tools support `.agents/skills/`, you'll just need:

```bash
mkdir -p ~/.agents/skills/my-skill
# Write SKILL.md there — all tools read it
```

We're not there yet. Track progress in [github-issues.md](references/github-issues.md).

## Plugin Skills vs Personal Skills

Skills can live in multiple places:

- **Plugin cache:** `~/.claude/plugins/cache/<org>/<plugin>/<ver>/skills/`
- **Personal:** `~/.claude/skills/` (or equivalent per-tool)
- **Project-level:** `.claude/skills/` in a git repo
- **Shared:** `~/.agents/skills/` (emerging convention)

When sharing skills cross-tool, the personal and shared locations are what matter. Plugin cache skills are Claude Code-specific and need to be copied or symlinked for other tools.

## Known Incompatibilities

1. **Claude-specific frontmatter** — `allowed-tools`, `disable-model-invocation` are ignored by other tools (harmless, but worth knowing)
2. **Directory structure** — Claude Code uses `.claude/`, Codex uses `.codex/`, etc. No tool reads another tool's directory natively (yet)
3. **Plugin system** — Only Claude Code has a full plugin marketplace. Other tools rely on manual skill installation
4. **Frontmatter validation** — Some tools may warn on unknown frontmatter fields. Keep universal fields minimal

## Key GitHub Issues

| Issue | Status | Impact |
|-------|--------|--------|
| [claude-code#6235](https://github.com/anthropics/claude-code/issues/6235) | Open | AGENTS.md / .agents/skills/ support for Claude Code |
| [codex#5321](https://github.com/openai/codex/issues/5321) | Open | Skill improvements for Codex CLI |

See [github-issues.md](references/github-issues.md) for full tracking with last-checked dates.

## Key Community Resources

- [agentskills.io](https://agentskills.io) — SKILL.md open standard specification
- [agents.md](https://agents.md) — AGENTS.md open standard (Linux Foundation)
- [SkillsMP](https://skillsmp.com) — Web marketplace (145k+ skills)
- [SkillHub](https://www.skillhub.dev) — Curated skills with playground (7k+)
- [awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) — 200+ cross-tool skills repo

See [community-voices.md](references/community-voices.md) and [standards.md](references/standards.md) for more.

## Quick Decision Guide

**"I want to share my Claude skills with Codex"**
→ Use `openskills install` or symlink from `~/.agents/skills/`

**"I want skills that work everywhere"**
→ Write SKILL.md with only universal frontmatter fields, install via openskills

**"I want to check what's compatible"**
→ Run `/agent-skills-bridge:status` to audit all tools and skills

**"I want to set up cross-tool sharing from scratch"**
→ Run `/agent-skills-bridge:setup` for guided setup

**"I want the latest compatibility info"**
→ Run `/agent-skills-bridge:update-knowledge` to fetch current state from GitHub/npm/community
