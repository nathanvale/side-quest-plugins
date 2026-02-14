# Skills for MCP Builders

How skills complement MCP servers: adding workflow guidance and domain expertise on top of tool access.

Source: Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026), code.claude.com/docs/en/skills

---

## MCP + Skills: Two Layers

MCP servers give Claude **access** -- connectivity to your service, real-time data, tool invocation.

Skills give Claude **knowledge** -- workflow guidance, domain expertise, best practices, error handling.

Claude can reason about MCP tools and use them without skills. But skills make that usage consistent, reliable, and aligned with your service's best practices.

| Layer | What It Provides | Example |
|-------|-----------------|---------|
| **MCP server** | Tool access: create, read, update, delete | `create_project`, `list_issues`, `update_status` |
| **Skill** | Workflow knowledge: when, why, in what order | "Before creating a project, check for duplicates. After creating, assign default team members and set up the board." |

---

## What Skills Add to MCP

| Aspect | MCP Only | MCP + Skill |
|--------|----------|-------------|
| Tool access | Claude discovers and uses tools | Same -- skills don't change tool access |
| Workflow guidance | Claude reasons about tool usage ad hoc | Skill encodes proven patterns and sequences |
| Error handling | Generic retry/report | Domain-specific recovery ("if rate limited, batch into groups of 10") |
| Best practices | User must know and communicate them | Encoded in skill instructions |
| Multi-tool coordination | Claude orchestrates based on general reasoning | Skill specifies optimal sequences for common tasks |
| Consistency | Results vary by how users prompt | Same workflow every time |

---

## When to Build a Skill for Your MCP

Build a skill when your MCP users:
- Ask the same workflow questions repeatedly ("how do I set up a new project?")
- Get inconsistent results because they prompt differently each time
- Don't know the optimal order to call your tools
- Miss important steps (validation, cleanup, notifications)
- Blame your connector when the real issue is workflow guidance

Don't build a skill when:
- Your MCP tools are self-explanatory and rarely used together
- A single tool call handles the use case
- Good MCP server descriptions already guide Claude's usage

---

## MCP Tool Search and Skills

When an MCP server exposes many tools (10%+ of context budget), Claude Code activates Tool Search -- it reads tool descriptions to decide which tools are relevant.

Skills and MCP server descriptions serve complementary roles:
- **MCP server descriptions** help Claude find the right tools
- **Skill descriptions** help Claude find the right workflow
- **Skill instructions** tell Claude how to use the tools together

Write both well. A skill that references MCP tools by name helps Claude connect the dots.

---

## Building Skills on Top of MCP

If you have a working MCP server, skills are the knowledge layer on top -- capturing workflows you already know so Claude applies them consistently.

### What to Put in the Skill

- **Workflow sequences**: The order to call your MCP tools for common tasks
- **Domain expertise**: Business logic, validation rules, best practices
- **Error handling**: Common MCP issues and how to recover
- **Context users would otherwise need to specify**: defaults, conventions, naming patterns

### Example: Sentry Code Review Skill

```yaml
---
name: sentry-code-review
description: >
  Code review workflow using Sentry error data via MCP. Use when
  reviewing code changes, analyzing error impact, or checking if
  a PR addresses known Sentry issues.
---

# Sentry-Enhanced Code Review

## Workflow

1. Use Sentry MCP to fetch recent issues for the affected files
2. Cross-reference PR changes with known error patterns
3. Flag if changes might introduce regressions
4. Summarize error impact in review comments

## Error Patterns

When Sentry shows recurring errors:
- Check if the PR addresses the root cause
- Verify error handling covers the failure mode
- Flag if similar patterns exist in changed files

## References

For Sentry API details, see [sentry-api.md](references/sentry-api.md)
```

### Skill Structure for MCP Enhancement

```
your-mcp-skill/
├── SKILL.md              # Workflow orchestration + when to use
├── references/
│   ├── api-patterns.md   # Rate limiting, pagination, error codes
│   └── workflows.md      # Multi-step recipes for common tasks
└── scripts/
    └── validate.py       # Pre-flight checks before MCP calls
```

### Key Principles

1. **Don't duplicate MCP docs** -- focus on workflow, not tool reference
2. **Coordinate multiple tools** -- the skill's value is orchestration
3. **Embed domain expertise** -- encode the "how" and "why", not just the "what"
4. **Handle common errors** -- anticipate MCP-specific failure modes (connection refused, rate limits, auth failures)
5. **Link to MCP docs** -- for tool-level details, point users to the MCP server documentation
