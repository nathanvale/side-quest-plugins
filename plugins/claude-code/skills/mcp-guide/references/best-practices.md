# Best Practices

When to use MCP vs skills, context cost management, the code execution pattern, CLI vs MCP trade-offs, and architectural recommendations.

Source: code.claude.com/docs/en/best-practices, code.claude.com/docs/en/costs, anthropic.com/engineering/code-execution-with-mcp, claude.com/blog/extending-claude-capabilities-with-skills-mcp-servers

---

## MCP vs Skills: When to Use Each

MCP = tool connectivity (the kitchen). Skills = workflow knowledge (the recipes).

| Use MCP When | Use Skills When |
|-------------|----------------|
| Need to access external APIs/databases | Need to teach Claude a workflow |
| Need real-time data from services | Need to embed domain knowledge |
| Tool execution requires specific protocols | Need multi-step orchestration |
| High-frequency operations (test runner, linter) | Need consistent output format |
| Need to control server-side output format | Need to guide tool selection |
| Output varies per query (structured data) | Instructions are the same every time |

### Best Together

The strongest pattern combines both:
- **MCP server** provides tool access (the "what")
- **Skill** provides workflow guidance (the "how")

Example:
- Sentry MCP gives Claude access to error data
- A triage skill teaches Claude your team's incident workflow

From Anthropic's blog: "MCP servers provide the tool connectivity, skills provide the workflow intelligence. Together, they enable AI-powered automation that's both capable and guided."

---

## The Code Execution Pattern

From Anthropic's engineering blog. Instead of exposing MCP tools directly, present them as code APIs that Claude calls through a code execution environment.

### Why It Works

| Approach | Tokens Used | Token Savings |
|----------|------------|---------------|
| Direct MCP tool calls | ~150K tokens | -- |
| Code execution pattern | ~2K tokens | 98.7% reduction |

### How It Works

1. MCP server provides a code execution environment
2. Instead of individual tool calls, Claude writes code that uses the APIs
3. Code runs in the execution environment, results come back
4. Claude processes the results

### Progressive Disclosure

```
Level 1: Simple operations  ->  Direct tool calls
Level 2: Complex workflows  ->  Code execution pattern
Level 3: Data analysis      ->  Code with library access
```

### Privacy-Preserving

The code execution pattern keeps sensitive data server-side. Claude writes code that processes data on the server -- raw data never enters the context window.

### State Persistence

Code execution environments persist state across calls. Variables, connections, and intermediate results carry forward within a session.

---

## Context Cost Management

### Check Current Costs

- `/mcp` -- per-server tool counts and token costs
- `/context` -- total context window breakdown

### Cost Hierarchy

From least to most context-expensive:

1. **CLI tools** (gh, aws, gcloud) -- zero tool definition overhead
2. **MCP with Tool Search** -- ~5-8.5K tokens for definitions
3. **MCP without Tool Search** -- ~50-80K+ tokens for definitions
4. **MCP with large output** -- depends on response size

### Token-Efficient Patterns

**Use `response_format: "json"` for MCP tools:**

```json
// Skill instructs Claude to use JSON format
"When calling bun_runTests, always use response_format: 'json' for compact output"
```

This controls output server-side before it enters the context. Especially valuable for high-frequency tools (test runners, linters) that get called repeatedly.

**Delegate MCP-heavy work to subagents:**

```yaml
---
name: my-analysis
context: fork
agent: general-purpose
---
Use the database MCP tools to analyze the schema and report findings.
```

MCP tool definitions load in the subagent's context, not the main conversation.

**Use CLI tools when MCP overhead isn't justified:**

| Task | CLI Tool | MCP Alternative | Recommendation |
|------|---------|----------------|---------------|
| Git operations | `gh` | GitHub MCP | CLI (zero overhead) |
| AWS operations | `aws` | AWS MCP | CLI for simple ops |
| File search | `grep`, `find` | -- | Built-in tools |
| HTTP requests | `curl` | -- | Built-in WebFetch |

---

## Architectural Recommendations

### Server Count

Community consensus: **2-3 MCP servers + ~12 skills** is the typical power-user sweet spot.

More servers = more context overhead, even with Tool Search. Each server adds:
- Connection management overhead
- Tool definition tokens (reduced by Tool Search but not zero)
- Potential timeout/failure points

### When to Add an MCP Server

Good reasons:
- Need persistent connection to a service (database, monitoring)
- Tool needs complex authentication (OAuth)
- Server provides real-time data
- High-frequency tool with structured output

Bad reasons:
- One-off API call (use curl/WebFetch instead)
- Simple file operations (use built-in tools)
- Static data (embed in a skill's references/ instead)

### When to Remove an MCP Server

- Haven't used it in the last week
- CLI alternative works just as well
- Context budget is tight (check `/context`)
- Server is unreliable or slow

---

## Security Considerations

### Trust Verification

- First use of a project's MCP servers requires explicit trust approval
- Review what tools the server exposes before approving
- Be cautious with servers that can fetch untrusted content (prompt injection risk)

### ToxicSkills Report (Feb 2026)

Security research found that 13.4% of 3,984 public skills had critical vulnerabilities. While focused on skills, the same risks apply to MCP servers:
- Verify source trustworthiness
- Review tool permissions
- Audit server code if possible
- Prefer well-known, maintained servers

### Principle of Least Privilege

Only connect MCP servers that your workflow actually needs. Each connected server is a potential attack surface.
