# Skills for MCP Builders

How skills complement MCP servers: the knowledge layer on top of connectivity.

Source: Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026)

---

## The Kitchen Analogy

MCP provides the professional kitchen: access to tools, ingredients, and equipment.

Skills provide the recipes: step-by-step instructions on how to create something valuable.

Together, they enable users to accomplish complex tasks without needing to figure out every step themselves.

---

## How They Work Together

| MCP (Connectivity) | Skills (Knowledge) |
|----|-----|
| Connects Claude to your service (Notion, Asana, Linear, etc.) | Teaches Claude how to use your service effectively |
| Provides real-time data access and tool invocation | Captures workflows and best practices |
| What Claude **can** do | How Claude **should** do it |

---

## Why This Matters for Your MCP Users

**Without skills**:
- Users connect your MCP but don't know what to do next
- Support tickets asking "how do I do X with your integration"
- Each conversation starts from scratch
- Inconsistent results because users prompt differently each time
- Users blame your connector when the real issue is workflow guidance

**With skills**:
- Pre-built workflows activate automatically when needed
- Consistent, reliable tool usage
- Best practices embedded in every interaction
- Lower learning curve for your integration

---

## Building Skills on Top of MCP

If you already have a working MCP server, you've done the hard part. Skills are the knowledge layer on top -- capturing the workflows and best practices you already know, so Claude can apply them consistently.

### What to Put in the Skill

- **Workflow sequences**: The order to call your MCP tools for common tasks
- **Domain expertise**: Business logic, validation rules, best practices
- **Error handling**: Common MCP issues and how to recover
- **Context users would otherwise need to specify**: defaults, conventions, naming patterns

### Example: Sentry Code Review Skill

```yaml
---
name: sentry-code-review
description: Automatically analyzes and fixes detected bugs in GitHub
  Pull Requests using Sentry's error monitoring data via their MCP server.
---
```

This skill coordinates multiple MCP calls in sequence, embeds domain expertise about error triage, and provides context users would otherwise need to specify manually.

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

Key techniques:
- Coordinate multiple MCP calls in sequence
- Embed domain expertise the MCP server doesn't provide
- Provide context users would otherwise need to specify
- Error handling for common MCP issues (connection refused, rate limits, auth failures)
