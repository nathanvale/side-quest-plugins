# Tracked GitHub Issues

Issues and repositories that affect cross-tool skill sharing. Check these periodically or run `/agent-skills-bridge:update-knowledge` to refresh.

## High Impact

### anthropics/claude-code#6235

**Title:** AGENTS.md / .agents/skills/ support
**Status:** Open
**Impact:** HIGH
**URL:** https://github.com/anthropics/claude-code/issues/6235
**Last checked:** 2025-07-01

Requests that Claude Code read skills from the `.agents/skills/` shared directory convention. This is the single most important issue for cross-tool compatibility — once Claude Code supports this, the symlink/openskills workarounds become less necessary.

**What it would enable:**
- Skills in `~/.agents/skills/` automatically available to Claude Code
- Project-level `.agents/skills/` recognized alongside `.claude/skills/`
- One skill location works for both Claude Code and Codex CLI

### openai/codex#5321

**Title:** Skill support improvements
**Status:** Open
**Impact:** MEDIUM
**URL:** https://github.com/openai/codex/issues/5321
**Last checked:** 2025-07-01

Tracks improvements to how Codex CLI handles skills, including better frontmatter processing, skill discovery, and potential marketplace integration.

## Repositories to Watch

### numman-ali/openskills

**URL:** https://github.com/numman-ali/openskills
**Type:** Universal SKILL.md installer
**Why it matters:** The currently recommended tool for cross-tool skill sharing. Breaking changes or deprecation would affect the setup workflow.
**Last checked:** 2025-07-01

### VoltAgent/awesome-agent-skills

**URL:** https://github.com/VoltAgent/awesome-agent-skills
**Type:** Community skill collection (200+ skills)
**Why it matters:** Largest curated collection of cross-tool skills. Good barometer of ecosystem health and adoption.
**Last checked:** 2025-07-01

### anthropics/claude-code

**URL:** https://github.com/anthropics/claude-code
**Type:** Claude Code source / issues
**Why it matters:** Any changes to skill loading, plugin system, or directory conventions directly affect compatibility.

### openai/codex

**URL:** https://github.com/openai/codex
**Type:** Codex CLI source / issues
**Why it matters:** Second most important tool for SKILL.md support. Changes here affect the shared convention.

## How to Check Issue Status

Use the GitHub CLI to check issue status without opening a browser:

```bash
# Check a specific issue
gh issue view 6235 --repo anthropics/claude-code --json state,title,labels

# Check Codex issue
gh issue view 5321 --repo openai/codex --json state,title,labels

# Search for new skill-related issues
gh search issues "SKILL.md" --repo anthropics/claude-code --state open
gh search issues "skills" --repo openai/codex --state open
```

## Issue Status Legend

- **Open** — Not yet resolved. Feature/fix not available.
- **In Progress** — Being actively worked on (check for linked PRs).
- **Closed (Merged)** — Feature/fix shipped. Update compatibility matrix.
- **Closed (Won't Fix)** — Not going to happen. May need to adjust strategy.

---

*Last updated: 2025-07-01. Run `/agent-skills-bridge:update-knowledge` to refresh.*
