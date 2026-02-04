# Standards

Open standards and conventions relevant to cross-tool skill sharing.

## SKILL.md — Agent Skills Open Standard

**Website:** [agentskills.io](https://agentskills.io)
**Status:** Active, widely adopted
**Governance:** Community-driven

The primary standard for portable AI coding assistant skills. Defines the format, frontmatter fields, and conventions for writing skills that work across multiple tools.

### Core Specification

- Skills are markdown files named `SKILL.md`
- YAML frontmatter with `name` and `description` fields (required)
- Body is markdown content (the skill's knowledge/instructions)
- Supporting files can live alongside SKILL.md in the same directory
- Progressive disclosure: SKILL.md is the entry point, reference files provide depth

### Directory Convention

```
my-skill/
├── SKILL.md              # Entry point (required)
├── references/           # Deep-dive content (optional)
│   ├── guide.md
│   └── examples.md
└── scripts/              # Executable helpers (optional)
    └── setup.sh
```

### Frontmatter Fields

Per the standard, only `name` and `description` are required. Tools may define additional fields (e.g., Claude Code's `allowed-tools`), but these should be treated as tool-specific extensions.

## AGENTS.md — Agent Instructions Standard

**Website:** [agents.md](https://agents.md)
**Status:** Active, Linux Foundation project
**Governance:** Linux Foundation

An open standard for providing instructions to AI coding agents. While SKILL.md focuses on reusable skill modules, AGENTS.md focuses on project-level agent configuration.

### Relationship to SKILL.md

- **AGENTS.md** = "How should agents behave in this project?" (project config)
- **SKILL.md** = "Here's reusable knowledge/capability" (portable module)

They're complementary, not competing. A project might have:
- `AGENTS.md` at the root (project instructions)
- `.agents/skills/` directory (shared skills)
- `.claude/skills/` directory (Claude-specific skills)

### The .agents/ Convention

AGENTS.md proposes `.agents/` as a shared directory for agent-related files:

```
project/
├── AGENTS.md              # Project-level instructions
├── .agents/
│   ├── skills/            # Shared skills (all tools read this)
│   └── config/            # Agent configuration
```

This is the convergence direction for cross-tool skill sharing. When a tool reads `.agents/skills/`, skills placed there work for all supporting tools without symlinks or installers.

**Current adoption:**
- Codex CLI: Reads `~/.agents/skills/` and `.agents/skills/` ✓
- Claude Code: Pending (#6235)
- Cursor: Unknown
- Gemini CLI: Unknown

## Convergence Direction

The ecosystem is converging toward:

1. **SKILL.md** as the file format (widely adopted)
2. **`.agents/skills/`** as the shared directory (partially adopted)
3. **AGENTS.md** as the project configuration (growing adoption)

### Timeline Expectation

- **Now:** Tools have separate directories, manual sync needed
- **Near-term:** Major tools adopt `.agents/skills/` reading
- **Medium-term:** `.agents/skills/` becomes the default; per-tool directories become overrides
- **Long-term:** Single shared directory, no installer needed

### What This Means for Skill Authors

1. **Write SKILL.md with universal fields** — avoid tool-specific frontmatter in the body
2. **Store skills in `.agents/skills/`** — even if you still need symlinks for now
3. **Use openskills for distribution** — handles the current fragmentation
4. **Watch #6235** — Claude Code .agents/skills/ support is the key missing piece

## Other Relevant Standards

### .cursorrules / .cursor/rules/

Cursor's native rule system. Not SKILL.md compatible but serves a similar purpose (project-level AI instructions). Some users maintain both `.cursorrules` and SKILL.md for dual compatibility.

### CLAUDE.md

Claude Code's project instruction file (similar to AGENTS.md but Claude-specific). Lives at project root or `~/.claude/CLAUDE.md` for global instructions. Not a skill format — it's configuration, not reusable knowledge.

---

*Last updated: 2025-07-01. Run `/agent-skills-bridge:update-knowledge` to refresh.*
