# Compatibility Matrix

Detailed tool-by-tool breakdown of SKILL.md support across AI coding assistants.

## Full Matrix

| Tool | SKILL.md Support | User Path | Shared Path | Project Path | Version Tested |
|------|-----------------|-----------|-------------|--------------|----------------|
| Claude Code | Full | `~/.claude/skills/` | Pending (#6235) | `.claude/skills/` | 2.1.29 |
| Codex CLI | Full | `~/.codex/skills/` | `~/.agents/skills/` | `.codex/skills/` | 0.94.0 |
| Cursor | Partial | `~/.cursor/skills/` | Unknown | `.cursor/skills/` | — |
| Gemini CLI | Partial | `~/.gemini/skills/` | Unknown | `.gemini/skills/` | — |
| Windsurf | Partial | `~/.windsurf/skills/` | Unknown | `.windsurf/skills/` | — |

### Support Level Definitions

- **Full** — Reads SKILL.md, processes frontmatter, supports progressive disclosure (reference files)
- **Partial** — Reads SKILL.md basic content but may not process all frontmatter fields or reference files
- **None** — No SKILL.md support

## Frontmatter Compatibility

### Universal Fields (Work Everywhere)

| Field | Claude Code | Codex CLI | Cursor | Gemini CLI |
|-------|-------------|-----------|--------|------------|
| `name` | Yes | Yes | Yes | Yes |
| `description` | Yes | Yes | Yes | Yes |

### Tool-Specific Fields

| Field | Claude Code | Codex CLI | Cursor | Gemini CLI | Notes |
|-------|-------------|-----------|--------|------------|-------|
| `disable-model-invocation` | Yes | Ignored | Ignored | Ignored | Claude commands only |
| `allowed-tools` | Yes | Ignored | Ignored | Ignored | Claude commands only |
| `license` | Displayed | Unknown | Unknown | Unknown | Informational |

**Key takeaway:** Unknown frontmatter fields are generally ignored (not errors). Safe to include Claude-specific fields — they just won't do anything in other tools.

## Directory Read Order

### Claude Code

1. Project-level: `.claude/skills/*/SKILL.md`
2. Plugin cache: `~/.claude/plugins/cache/<org>/<plugin>/<ver>/skills/*/SKILL.md`
3. Personal: `~/.claude/skills/*/SKILL.md`
4. (Future) Shared: `~/.agents/skills/*/SKILL.md` (pending #6235)

### Codex CLI

1. Project-level: `.codex/skills/*/SKILL.md`
2. Shared: `~/.agents/skills/*/SKILL.md`
3. Personal: `~/.codex/skills/*/SKILL.md`

### Cursor / Gemini CLI / Windsurf

Specific read order and precedence rules are not well-documented for these tools. Generally they read from their respective `~/.<tool>/skills/` directory.

## Known Incompatibilities

### Claude Code → Codex CLI

- Claude's `allowed-tools` field is ignored (Codex has its own tool permission model)
- Claude's plugin system (`~/.claude/plugins/`) has no equivalent in Codex
- Codex reads `~/.agents/skills/` natively; Claude does not (yet)

### Claude Code → Cursor

- Cursor's rule system (`.cursorrules`, `.cursor/rules/`) is separate from SKILL.md
- Some Cursor users combine `.cursorrules` with SKILL.md for dual compatibility
- Cursor's skill support is less mature than Claude Code or Codex

### General

- No tool reads another tool's directory (no cross-tool directory discovery)
- Symlinks or `openskills` are required to bridge the gap
- Project-level skills (`.claude/skills/` etc.) are per-tool and checked into git

## Version-Specific Notes

### Claude Code 2.1.x

- Full SKILL.md support with progressive disclosure
- Skills directory: `~/.claude/skills/` and `.claude/skills/`
- Plugin cache skills loaded automatically
- No `.agents/skills/` support yet

### Codex CLI 0.94.x

- Full SKILL.md support
- Reads from `~/.agents/skills/` (the shared convention)
- Also reads from `~/.codex/skills/` and `.codex/skills/`
- Active development on skill improvements (#5321)

---

*Last updated: 2025-07-01. Run `/agent-skills-bridge:update-knowledge` to refresh.*
