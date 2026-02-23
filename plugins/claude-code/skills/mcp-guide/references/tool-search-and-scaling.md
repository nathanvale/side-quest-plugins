# Tool Search & Scaling

How Tool Search (lazy loading) reduces MCP context overhead, configuration options, accuracy data, output limits, and MCP server author guidance.

Source: code.claude.com/docs/en/mcp, code.claude.com/docs/en/costs, code.claude.com/docs/en/settings

---

## The Problem: Context Bloat

Every MCP tool definition is sent in Claude's system prompt. With multiple servers exposing many tools, this can consume 50-80K+ tokens before a conversation even starts.

Example overhead without Tool Search:
- 3 MCP servers with ~50 tools total: ~51K tokens
- 5 MCP servers with ~80 tools total: ~77K tokens

This leaves less room for conversation, code, and other context.

---

## Tool Search (Lazy Loading)

Shipped in Claude Code 2.1.7 (January 2026). Automatically defers MCP tool definitions when they would exceed a context threshold.

### How It Works

1. When Tool Search is active, Claude sees only tool **names and descriptions** (not full parameter schemas)
2. When Claude decides to use a tool, the full definition is loaded on demand
3. After use, the definition is cached for the session
4. Reduces token overhead by **85-95%** (from ~51-77K to ~5-8.5K tokens)

### Activation

Tool Search activates automatically when MCP servers exceed a threshold (default: 3 servers or 10% of context window).

### Configuration

```bash
# Auto mode with custom threshold (default)
export ENABLE_TOOL_SEARCH=auto:3    # activate when >3 MCP servers

# Always on
export ENABLE_TOOL_SEARCH=true

# Always off
export ENABLE_TOOL_SEARCH=false

# Custom auto threshold
export ENABLE_TOOL_SEARCH=auto:5    # activate when >5 MCP servers
```

Set in your shell profile (`~/.zshrc`) or in `.claude/settings.local.json`:

```json
{
  "env": {
    "ENABLE_TOOL_SEARCH": "auto:3"
  }
}
```

---

## Accuracy Impact

Tool Search improves accuracy by reducing prompt noise:

| Model | Without Tool Search | With Tool Search | Improvement |
|-------|-------------------|-----------------|-------------|
| Opus 4 | 49.0% | 74.0% | +25pp |
| Opus 4.5 | 79.5% | 88.1% | +8.6pp |

Fewer irrelevant tool definitions means Claude focuses better on the right tools.

---

## MCP Output Limits

### MAX_MCP_OUTPUT_TOKENS

Controls the maximum tokens returned by a single MCP tool call:

```bash
export MAX_MCP_OUTPUT_TOKENS=25000  # default
```

When output exceeds this limit:
- Content is saved to a temporary file
- Claude receives a pointer to the file instead
- Claude can read the file if needed

**Recommendation:** Keep the default unless you have a specific need for larger outputs. Large MCP responses consume context rapidly.

### Timeouts

```bash
export MCP_TIMEOUT=300000       # Server initialization timeout (5 min default)
export MCP_TOOL_TIMEOUT=300000  # Per-tool-call timeout (5 min default)
```

---

## For MCP Server Authors

When Tool Search is active, Claude decides which tools to load based on names and descriptions alone. To maximize discoverability:

1. **Use clear, descriptive tool names** -- `search_issues` not `s_iss`
2. **Write detailed descriptions** -- explain what the tool does and when to use it
3. **Group related tools** -- consistent naming prefix helps (`github_list_prs`, `github_create_pr`)
4. **Keep parameter schemas simple** -- fewer required params = easier discovery
5. **Return structured, compact results** -- don't dump raw data; format for consumption

### Output Token Efficiency

Design your server responses to be token-efficient:
- Return structured JSON, not raw dumps
- Include summary fields alongside detail
- Support pagination for large result sets
- Offer format options (e.g., `response_format: "json"` vs `"markdown"`)

---

## Monitoring Context Costs

### Check per-server costs

Run `/mcp` in Claude Code to see:
- Connected servers and their status
- Number of tools per server
- Token cost of tool definitions

### Check total context usage

Run `/context` to see:
- Total context window usage
- Breakdown by category (system prompt, tools, conversation, etc.)
- Warnings about excluded skills or tools

### Cost Reduction Strategies

1. **Enable Tool Search** -- automatic 85-95% reduction in tool definition overhead
2. **Remove unused servers** -- `claude mcp remove <name>`
3. **Use CLI tools instead** -- `gh`, `aws`, `gcloud` are more context-efficient than MCP equivalents for simple operations
4. **Control output format** -- servers supporting `response_format: "json"` return compact data
5. **Use subagents** -- delegate MCP-heavy work to subagents so tool definitions don't pollute the main context

---

## Scaling Recommendations

| Server Count | Recommendation |
|-------------|---------------|
| 1-3 servers | Tool Search optional, low overhead |
| 3-5 servers | Tool Search auto-activates (default threshold) |
| 5-10 servers | Tool Search essential, monitor with /context |
| 10+ servers | Consider removing rarely-used servers, use subagent delegation |

The community consensus is ~2-3 MCP servers + ~12 skills as a typical power-user setup. More MCP servers than this should trigger a review of whether all are needed.
