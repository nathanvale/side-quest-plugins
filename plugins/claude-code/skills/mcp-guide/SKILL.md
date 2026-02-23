---
name: mcp-guide
description: >
  Knowledge bank for Claude Code MCP servers -- setup, installation scopes,
  Tool Search, lazy loading, configuration, plugin MCP servers, managed policies,
  best practices, and troubleshooting.
  Triggers on: MCP server, MCP tools, add MCP, install MCP, .mcp.json,
  mcp configuration, mcp scope, local vs project vs user MCP, Tool Search,
  lazy loading, ENABLE_TOOL_SEARCH, MCP output limits, MAX_MCP_OUTPUT_TOKENS,
  MCP timeout, MCP not working, MCP server not connecting, mcp permission,
  managed-mcp.json, allowedMcpServers, deniedMcpServers, MCP in plugin,
  plugin MCP server, MCP resources, MCP prompts, remote MCP, SSE, stdio,
  HTTP MCP, MCP vs skills, when to use MCP, MCP cost, MCP context,
  mcp-server, connect tool, external tool.
allowed-tools: Read, Glob, Grep
---

# Claude Code MCP Guide -- Knowledge Bank

Expert guidance for connecting Claude Code to external tools via MCP (Model Context Protocol). Covers server setup, configuration scopes, Tool Search, plugin integration, best practices, and troubleshooting.

## Source Authority

This skill draws from:
- Official Claude Code documentation at code.claude.com/docs/en/mcp
- Anthropic engineering blog posts on MCP patterns
- Claude Code settings and configuration reference
- Plugin system reference documentation

## Community Perspective (Opt-In)

This skill does NOT maintain a community intel cache. For live community signal on MCP usage patterns, hand off to `/research:newsroom` when the user asks for community perspective.

**Auto-detect these signals** -- if the user's question contains any of these, offer to run community research:
- "what MCP servers are people using", "popular MCP servers"
- "has anyone", "examples", "real-world"
- "community", "Reddit", "what's trending"
- "MCP vs skills debate", "should I use MCP or skills"

**When detected**: Answer from reference files first, then offer to run `/research:newsroom` for community perspective.

## Step 1: Classify the Question

Parse the user's question into one or more intent categories. If a question spans multiple categories, identify the primary intent and address it first, then connect to secondary categories.

| Intent | Trigger Signals | Reference File |
|--------|----------------|----------------|
| **Setup & Installation** | add MCP, install MCP, connect, remote, HTTP, SSE, stdio, OAuth, Claude Desktop import, popular servers, MCP server list, JSON config, claude mcp add | [setup-and-installation.md](references/setup-and-installation.md) |
| **Scopes & Configuration** | .mcp.json, local scope, project scope, user scope, precedence, managed-mcp.json, enableAllProjectMcpServers, allowedMcpServers, deniedMcpServers, env var, environment variable, scope hierarchy | [scopes-and-configuration.md](references/scopes-and-configuration.md) |
| **Tool Search & Scaling** | Tool Search, lazy loading, ENABLE_TOOL_SEARCH, too many tools, context overhead, tool definitions, MCP output limits, MAX_MCP_OUTPUT_TOKENS, MCP_TIMEOUT, MCP_TOOL_TIMEOUT, token cost, accuracy | [tool-search-and-scaling.md](references/tool-search-and-scaling.md) |
| **MCP in Plugins** | plugin MCP, .mcp.json in plugin, plugin.json mcp, CLAUDE_PLUGIN_ROOT, plugin server, auto-start, plugin MCP troubleshoot | [mcp-in-plugins.md](references/mcp-in-plugins.md) |
| **Best Practices** | best practice, MCP vs skills, when to use MCP, when to use skills, context cost, response_format, code execution pattern, CLI vs MCP, subagent, architecture, design pattern | [best-practices.md](references/best-practices.md) |
| **Troubleshooting** | not working, not connecting, error, broken, debug, server not appearing, permission, timeout, output truncated, MCP failed, connection refused, config error | [troubleshooting.md](references/troubleshooting.md) |

## Step 2: Read Reference Files

Read the relevant reference file(s) based on the classification. For multi-intent questions, read all relevant files.

## Step 3: Synthesize Answer

### Response Structure

Every response should follow this structure:

1. **Direct answer** -- one-line answer, no preamble
2. **Configuration** -- .mcp.json snippets, settings.json configs, or CLI commands (copy-paste ready)
3. **Why it works** -- brief explanation of the design decision
4. **Verify step** -- how to confirm it works (`/mcp` menu, `claude mcp list`, etc.)
5. **Common failure** -- what goes wrong and how to fix
6. **Source** -- reference file cited

### For Setup Questions

1. Show the exact CLI command or .mcp.json config
2. Specify transport type (HTTP, SSE, stdio) and when to use each
3. Include authentication steps if applicable
4. Show how to verify with `/mcp` or `claude mcp list`

### For Scope/Config Questions

1. Show the config file path and format
2. Explain precedence (local > project > user)
3. Show environment variable expansion syntax
4. Note managed policy implications if relevant

### For Tool Search Questions

1. Explain how lazy loading works (deferred tool definitions)
2. Show the ENABLE_TOOL_SEARCH configuration options
3. Provide token cost numbers (before/after)
4. Note accuracy improvements with citations

### For Plugin MCP Questions

1. Show .mcp.json format in plugin context
2. Explain auto-start behavior
3. Show ${CLAUDE_PLUGIN_ROOT} path variable usage
4. Note the distinction from user/project MCP config

### For Best Practice Questions

1. Use the MCP vs Skills comparison table
2. Show concrete examples of when each is appropriate
3. Include the code execution pattern for token efficiency
4. Reference context cost data

### For Troubleshooting Questions

1. Match symptoms to the troubleshooting table
2. Provide debug steps in order of likelihood
3. Include exact commands (`/mcp`, `claude mcp list`, `claude --debug`)
4. Check config file locations

## Response Guidelines

- **Always cite the reference file** you draw from
- **Provide copy-paste configs** -- users should be able to use .mcp.json and settings.json snippets immediately
- **Show CLI commands** -- `claude mcp add` commands for quick setup
- **Be direct** -- answer first, then context
- **Tables for comparisons** -- transports, scopes, MCP vs skills
- **Warn about common mistakes** -- wrong scope, missing env vars, output limits
- **Link to sibling skills** when the question crosses boundaries (hooks for MCP hooks, skills-guide for skill authoring)

## Examples

### Example 1: Adding an MCP Server

```text
User: How do I add an MCP server to Claude Code?

Skill: [Reads setup-and-installation.md]

Three transport options:

1. **Remote HTTP** (recommended for hosted servers):
   claude mcp add my-server --transport http https://api.example.com/mcp

2. **Remote SSE** (legacy streaming):
   claude mcp add my-server --transport sse https://api.example.com/sse

3. **Local stdio** (local process):
   claude mcp add my-server -- npx -y @example/mcp-server

Verify: run `/mcp` to see connected servers and their tools.

**Common mistake:** Forgetting `--transport http` for remote servers.
Default is stdio, which tries to spawn a local process.

Source: setup-and-installation.md
```

### Example 2: MCP vs Skills

```text
User: When should I use MCP tools vs skills?

Skill: [Reads best-practices.md]

MCP = tool connectivity (the kitchen). Skills = workflow knowledge (the recipes).

| Use MCP When | Use Skills When |
|-------------|----------------|
| Need database access | Need workflow orchestration |
| Need API integration | Need domain knowledge |
| High-frequency ops (test runner, linter) | Multi-step processes |
| Need to control output format/tokens | Need to teach Claude patterns |

**Best together:** MCP server for tool access + skill for workflow guidance.
Example: Sentry MCP for error data + skill for triage workflow.

The code execution pattern (Anthropic engineering blog) shows
presenting MCP tools as code APIs rather than direct calls can reduce
token usage by 98.7%.

Source: best-practices.md
```

### Example 3: Tool Search / Context Bloat

```text
User: My MCP servers are using too many tokens

Skill: [Reads tool-search-and-scaling.md]

Tool Search (shipped Claude Code 2.1.7, Jan 2026) auto-defers MCP tool
definitions when they exceed 10% of context. This reduces overhead
by 85-95% (from ~51-77K to ~5-8.5K tokens).

Check if it's active:
- Run `/mcp` to see per-server token costs
- Run `/context` to see total context usage

Configure:
  export ENABLE_TOOL_SEARCH=auto:3  # defer when >3 servers (default)
  export ENABLE_TOOL_SEARCH=true    # always on
  export ENABLE_TOOL_SEARCH=false   # always off

For MCP server authors: write clear, descriptive tool names and
descriptions -- Tool Search uses these to find tools at runtime.

Source: tool-search-and-scaling.md
```

### Example 4: Troubleshooting

```text
User: My MCP server isn't connecting

Skill: [Reads troubleshooting.md]

Debug steps in order of likelihood:

1. **Check config location** -- run `claude mcp list` to see registered servers.
   Config lives in:
   - .mcp.json (project scope)
   - ~/.claude.json (user scope)

2. **Verify transport** -- HTTP servers need `--transport http`.
   Without it, Claude tries to spawn a local process.

3. **Check server is running** -- for local stdio servers, ensure the
   command works standalone: `npx -y @example/mcp-server`

4. **Permission denied** -- first use requires trust verification.
   Check `/mcp` for pending approvals.

5. **Environment variables** -- .mcp.json supports ${VAR} expansion.
   Ensure vars are set in your shell profile.

Debug: `claude --debug` shows MCP connection attempts.

Source: troubleshooting.md
```

### Example 5: Cross-Skill Boundary

```text
User: How do I add hooks to my MCP server?

Skill: [Detects cross-skill boundary -> hooks domain]

MCP-related hooks are configured in settings.json, not .mcp.json.
Use PreToolUse/PostToolUse events with matchers targeting MCP tool names.

Quick example -- log all MCP tool calls:
  {
    "hooks": {
      "PostToolUse": [{
        "matcher": "mcp__.*",
        "hooks": [{ "type": "command", "command": "echo $TOOL_NAME >> mcp.log" }]
      }]
    }
  }

For full hook configuration, event types, and decision control,
ask /hooks about hook types and configuration.

Sources: best-practices.md (MCP patterns), hooks skill (hook mechanics)
```
