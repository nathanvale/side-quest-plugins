# MCP in Plugins

How to configure MCP servers within Claude Code plugins, auto-start behavior, path variables, and troubleshooting plugin MCP.

Source: code.claude.com/docs/en/plugins-reference, code.claude.com/docs/en/mcp

---

## Overview

Plugins can bundle MCP servers that start automatically when the plugin is enabled. This gives plugins tool access without requiring manual MCP setup.

Two configuration methods:
1. `.mcp.json` file in the plugin root (recommended)
2. Inline in `plugin.json` (alternative)

---

## Method 1: .mcp.json in Plugin Root

Create `.mcp.json` alongside `plugin.json`:

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json              # MCP server config
├── skills/
│   └── my-skill/
│       └── SKILL.md
└── src/
    └── mcp-server.ts      # Your MCP server code
```

### .mcp.json Format

```json
{
  "mcpServers": {
    "my-plugin-server": {
      "command": "bunx",
      "args": ["--bun", "${CLAUDE_PLUGIN_ROOT}/dist/index.js"],
      "env": {
        "SOME_CONFIG": "${SOME_ENV_VAR}"
      }
    }
  }
}
```

### Path Variable: ${CLAUDE_PLUGIN_ROOT}

Use `${CLAUDE_PLUGIN_ROOT}` to reference files relative to the plugin's installation directory. This resolves to the plugin's root directory at runtime, regardless of where the plugin is installed.

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/dist/server.js"]
    }
  }
}
```

**Critical:** Always use `${CLAUDE_PLUGIN_ROOT}` for paths. Hardcoded paths break when users install the plugin in different locations.

---

## Method 2: Inline in plugin.json

Add MCP server config directly in `plugin.json`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My plugin with MCP server",
  "skills": ["./skills/my-skill"],
  "mcpServers": {
    "my-server": {
      "command": "bunx",
      "args": ["--bun", "${CLAUDE_PLUGIN_ROOT}/dist/index.js"]
    }
  }
}
```

Both methods work identically. Use `.mcp.json` for consistency with project-level MCP config.

---

## Auto-Start Behavior

Plugin MCP servers start automatically when:
1. The plugin is enabled in Claude Code
2. A new Claude Code session starts

Servers stop when:
1. The plugin is disabled
2. The Claude Code session ends

### Namespace

Plugin MCP tools are namespaced as `mcp__plugin_{plugin-name}_{server-name}__{tool-name}`:

```
mcp__plugin_my-plugin_my-server__search_items
```

This prevents name collisions with user-configured MCP servers.

---

## Plugin MCP vs User MCP

| Aspect | Plugin MCP | User MCP |
|--------|-----------|----------|
| Config file | Plugin's `.mcp.json` or `plugin.json` | `~/.claude.json` or project `.mcp.json` |
| Lifecycle | Auto-start/stop with plugin | Persistent across sessions |
| Namespace | `mcp__plugin_{name}_{server}__` | `mcp__{server}__` |
| Trust | Trusted when plugin is approved | Requires individual trust verification |
| Scope | Where plugin is enabled | User or project scope |

---

## Building MCP Servers for Plugins

### Recommended Stack

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json
├── src/
│   ├── index.ts           # MCP server entrypoint
│   └── tools/
│       ├── search.ts
│       └── create.ts
├── dist/                  # Built output
│   └── index.js
└── skills/
    └── my-skill/
        └── SKILL.md       # Skill that uses the MCP tools
```

### Token-Efficient Responses

Control the output format of your MCP server responses:

```typescript
// Support response_format parameter
const format = args.response_format ?? 'json';
if (format === 'json') {
  return JSON.stringify(result);  // Compact, token-efficient
} else {
  return formatAsMarkdown(result);  // Human-readable
}
```

This allows skills to request `response_format: "json"` for compact responses that save context tokens.

---

## Troubleshooting Plugin MCP

### Server Not Starting

1. Check the command is valid -- run it manually:
   ```bash
   bunx --bun /path/to/plugin/dist/index.js
   ```
2. Verify `${CLAUDE_PLUGIN_ROOT}` resolves correctly
3. Check the plugin is enabled: run `/mcp` to see connected servers
4. Check for dependency issues: `bun install` in the plugin directory

### Server Not Appearing in /mcp

1. Plugin might not be enabled -- check plugin settings
2. `.mcp.json` might have syntax errors -- validate JSON
3. Server name might conflict with an existing server

### Tools Not Being Invoked

1. Check tool names match what the skill references
2. Verify tools are listed in `/mcp` under the server
3. If Tool Search is active, ensure tool descriptions are clear enough for discovery
4. Check `allowed-tools` in the skill's SKILL.md includes the MCP tool names

### Bunx Cache Corruption

If an MCP server fails with module resolution errors:

```
Cannot find module '@modelcontextprotocol/sdk/server/mcp.js'
```

Clear the bunx cache:

```bash
rm -rf /private/var/folders/_b/*/T/bunx-501-@side-quest/
```

Then restart Claude Code to re-download packages.
