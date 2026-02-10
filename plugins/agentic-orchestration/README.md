# agentic-orchestration

Knowledge-bank plugin for agentic orchestration patterns in Claude Code.

## What It Covers

- **Builder/Validator** -- 2x compute pattern where one agent builds and another validates read-only
- **Hook Validation** -- self-validating hooks (PostToolUse, Stop) for deterministic code quality enforcement
- **Task Orchestration** -- TaskCreate/Update/List/Get, dependency chains, hydration for persistence, wave-based execution
- **Meta-Prompts** -- plan_w_team anatomy, plan format template, team orchestration rules
- **Sub-Agents** -- agent architecture, frontmatter, foreground/background, resume, meta-agent pattern
- **Agent Teams** -- native Agent Teams (experimental), TeamCreate, SendMessage, delegate mode, shared task list
- **Patterns Taxonomy** -- 6 orchestration patterns, decision matrix, anti-patterns, cost analysis

## Usage

The skill triggers automatically when you ask about orchestration patterns. You can also invoke it directly:

```
/agentic-orchestration How do I set up Builder/Validator?
/agentic-orchestration Which pattern should I use for my project?
/agentic-orchestration --refresh    # Force community intel refresh
/agentic-orchestration --upgrade    # Review and accept new community findings
```

### Plan Command

Generate a Builder/Validator team plan for any feature:

```
/agentic-orchestration:plan-with-team Build a REST API with authentication
```

## Community Intel

Volatile areas (Agent Teams, Task system gotchas, emerging patterns) are refreshed every 7 days via a SessionStart hook. Stable pattern references (Builder/Validator, hooks, sub-agents) remain hand-authored.

## Attribution

This plugin is inspired by:

- **IndyDevDan's claude-code-hooks-mastery** (github.com/indydevdan/claude-code-hooks-mastery) -- Builder/Validator pattern, team validation system, plan_w_team meta-prompt, hook-based self-validation. The agent definitions and patterns in this plugin are original implementations that follow the same approach, not verbatim copies.
- **Anthropic's Agent Teams** (code.claude.com/agent-teams) -- native multi-agent coordination primitives shipped as an experimental feature in Claude Code.
- **Anthropic's 2026 Agentic Coding Trends Report** -- identifies orchestration as the key skill gap widening in 2026.
- **Community contributions** from Reddit (r/ClaudeAI, r/ClaudeCode), DEV Community, Medium, and various blog posts documenting real-world multi-agent patterns.

## License

MIT
