# Ecosystem Tools

Tools and services for cross-tool skill distribution and management.

## Current Recommended: openskills

**Repository:** [github.com/numman-ali/openskills](https://github.com/numman-ali/openskills)

```bash
npm i -g openskills
```

Universal SKILL.md loader that handles the complexity of different tool directories:

- Detects installed AI coding tools automatically
- Installs skills to all detected tool directories
- Handles symlinks and directory creation
- Single command workflow: `openskills install <skill>`
- Actively maintained, tracking ecosystem changes

**Why it's recommended:** It's the most mature and widely-adopted universal installer. It abstracts away the per-tool directory differences and handles edge cases.

## Alternatives

### skilz

**Repository:** [github.com/thestereo/skilz](https://github.com/thestereo/skilz)

Universal agentic skills installer supporting 14+ platforms. Broader platform coverage than openskills but less focused on the SKILL.md standard specifically.

```bash
npx skilz install <skill>
```

### claude-plugins.dev CLI

**Website:** [claude-plugins.dev](https://claude-plugins.dev)

`npx`-based installer that handles both marketplace plugins and individual skills. More focused on the Claude Code ecosystem but can install skills that work cross-tool.

```bash
npx @anthropic/claude-plugins install <plugin>
```

### SkillsMP (Marketplace)

**Website:** [skillsmp.com](https://skillsmp.com)

Web-based marketplace with 145k+ skills. Browse, search, and install skills. Large catalog but quality varies.

### SkillHub

**Website:** [skillhub.dev](https://www.skillhub.dev)

Curated marketplace with 7k+ skills and an online playground for testing before installation. Higher curation bar than SkillsMP.

### awesome-agent-skills

**Repository:** [github.com/VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)

Community-curated list of 200+ cross-tool skills. Good starting point for discovering high-quality skills. Organized by category.

### Manual Methods

#### rsync (one-liner)

Simple but manual. Copies skills from one directory to another:

```bash
rsync -av ~/.claude/skills/ ~/.codex/skills/
```

Credit: @doodlestein's approach. Simple and transparent but doesn't handle ongoing sync.

#### Symlinks

Single source of truth approach:

```bash
# Store in shared location
mkdir -p ~/.agents/skills/my-skill

# Symlink to each tool
ln -s ~/.agents/skills/my-skill ~/.claude/skills/my-skill
ln -s ~/.agents/skills/my-skill ~/.codex/skills/my-skill
ln -s ~/.agents/skills/my-skill ~/.cursor/skills/my-skill
```

Pros: single source of truth, instant sync, no build step.
Cons: manual setup, doesn't scale well, platform differences (Windows).

#### Native .agents/skills/

The convergence direction. When all tools read `~/.agents/skills/`, you just put skills there:

```bash
mkdir -p ~/.agents/skills/my-skill
# Write SKILL.md — all tools read it
```

**Status:** Codex CLI supports this today. Claude Code support pending (#6235). Other tools unknown.

## Comparison

| Tool | Type | Platforms | Ease | Maintenance |
|------|------|-----------|------|-------------|
| openskills | CLI (npm) | All SKILL.md tools | High | Active |
| skilz | CLI (npx) | 14+ platforms | High | Active |
| claude-plugins.dev | CLI (npx) | Claude-focused | Medium | Active |
| SkillsMP | Web marketplace | Browse only | High | Active |
| SkillHub | Web marketplace | Browse + playground | High | Active |
| rsync | Manual | Any | Low | None |
| Symlinks | Manual | Unix-like | Low | None |
| .agents/skills/ | Convention | Codex (others pending) | High | N/A |

## Choosing a Tool

- **Just want it to work:** `openskills`
- **Need broadest platform coverage:** `skilz`
- **Want to browse before installing:** SkillsMP or SkillHub
- **Want maximum control:** Symlinks
- **Building for the future:** `.agents/skills/` convention + symlinks for tools that don't support it yet

---

*Last updated: 2025-07-01. Run `/agent-skills-bridge:update-knowledge` to refresh.*
