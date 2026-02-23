# Claude Code

Knowledge bank for Claude Code extensibility -- hooks, skills, sub-agents, MCP servers, and UI design patterns. Eight skills covering the full authoring and testing lifecycle, from learning the fundamentals to building, reviewing, and smoke-testing your own skills.

## Install

```bash
/plugin install claude-code@side-quest
```

## Skills

| Skill | What it does |
|-------|-------------|
| `hooks` | Event lifecycle, hook types (command/prompt/agent), configuration, community patterns, troubleshooting |
| `skills-guide` | Skill anatomy, SKILL.md authoring, frontmatter fields, progressive disclosure, distribution |
| `skill-builder` | Interactive scaffolder -- collaborates on your idea, picks a pattern, creates all files |
| `skill-reviewer` | Staff-engineer-level review with 8-dimension grading and remediation prompts |
| `skill-smoketest` | Functional testing via sub-agents that exercise your skill as a real user would |
| `mcp-guide` | MCP server setup, scopes, Tool Search, lazy loading, plugin integration |
| `subagents-guide` | Built-in and custom agents, agent teams, context isolation, costs, model selection |
| `design-guide` | Dashboard/UI design with Tailwind v4, dark-mode color systems, component anatomy |

## Community Intel

The plugin includes a SessionStart hook that refreshes community intelligence for the hooks skill. This runs async in the background using `@side-quest/community-intel-cache` and never blocks your session. If the cache service is not available, the skill degrades gracefully to static references.

## Requirements

- **Claude Code** with plugin support
- **Bun runtime** (optional) -- for the community intel cache refresh hook
- **@side-quest/community-intel-cache** (optional) -- for live community intel updates

## Limitations

- Community intel refresh requires `@side-quest/community-intel-cache` to be available via bunx
- Design guide is opinionated toward Tailwind v4 + Vue/shadcn-vue patterns
- Skills are read-only knowledge banks (except skill-builder which writes files)
