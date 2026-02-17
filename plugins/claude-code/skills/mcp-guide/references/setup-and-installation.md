# Setup & Installation

How to add MCP servers to Claude Code, transport types, authentication, and importing from other tools.

Source: code.claude.com/docs/en/mcp

---

## What MCP Does

MCP (Model Context Protocol) is an open standard for AI-tool integrations. MCP servers give Claude Code access to external tools, databases, and APIs.

With MCP servers connected, Claude can:
- Implement features from issue trackers (Jira, Linear)
- Analyze monitoring data (Sentry, Statsig)
- Query databases (PostgreSQL, MySQL)
- Integrate designs (Figma, Slack)
- Automate workflows (Gmail, calendar)

---

## Transport Types

Three ways to connect an MCP server:

### Remote HTTP (Recommended for hosted servers)

```bash
claude mcp add my-server --transport http https://api.example.com/mcp
```

- Modern, recommended transport for remote servers
- Supports OAuth authentication
- Most hosted MCP servers use this

### Remote SSE (Legacy streaming)

```bash
claude mcp add my-server --transport sse https://api.example.com/sse
```

- Server-Sent Events transport
- Legacy option, use HTTP when possible
- Some older servers still require SSE

### Local stdio (Local process)

```bash
claude mcp add my-server -- npx -y @example/mcp-server
```

- Spawns a local process
- Communication via stdin/stdout
- Default transport if not specified
- Use for locally-installed servers

**Important:** If connecting to a remote URL, you MUST specify `--transport http` or `--transport sse`. Without it, Claude tries to spawn a local process and fails.

---

## Adding Servers

### CLI Method (Recommended)

```bash
# Remote HTTP
claude mcp add circleback --transport http https://app.circleback.ai/api/mcp

# Remote SSE
claude mcp add my-server --transport sse https://api.example.com/sse

# Local stdio
claude mcp add my-server -- npx -y @example/mcp-server

# With environment variables
claude mcp add my-server -e API_KEY=sk-xxx -- npx -y @example/mcp-server

# Specify scope
claude mcp add my-server --scope user -- npx -y @example/mcp-server
claude mcp add my-server --scope project -- npx -y @example/mcp-server
```

### JSON Configuration Method

Create or edit `.mcp.json` in project root:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

For remote servers:

```json
{
  "mcpServers": {
    "my-server": {
      "type": "http",
      "url": "https://api.example.com/mcp"
    }
  }
}
```

### Import from Claude Desktop

```bash
claude mcp add-from-claude-desktop
```

Imports all MCP servers configured in Claude Desktop. Servers are added to user scope.

---

## Authentication

### OAuth (Remote HTTP/SSE)

Remote MCP servers supporting OAuth will trigger an authentication flow:
1. Claude Code opens your browser
2. You authenticate with the service
3. Token is stored locally

### Pre-configured OAuth

Some servers accept pre-configured credentials:

```bash
claude mcp add my-server \
  --transport http \
  --header "Authorization: Bearer ${MY_TOKEN}" \
  https://api.example.com/mcp
```

### API Keys (Local stdio)

Pass API keys as environment variables:

```bash
claude mcp add my-server -e API_KEY=sk-xxx -- npx -y @example/mcp-server
```

Or use environment variable expansion in `.mcp.json`:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

The `${API_KEY}` syntax reads from your shell environment at startup.

---

## Managing Servers

| Command | Description |
|---------|-------------|
| `claude mcp list` | List all configured servers |
| `claude mcp remove <name>` | Remove a server |
| `/mcp` | In-session menu showing connected servers, tools, and token costs |
| `claude mcp reset` | Remove all MCP servers |

### Dynamic Tool Updates

MCP servers can update their available tools at runtime without restarting Claude Code. When a server's tool list changes, Claude automatically picks up the new tools.

---

## MCP Resources

MCP servers can expose resources (files, data) in addition to tools:

```
@mcp:server-name/resource-uri
```

Reference MCP resources in your prompts to provide additional context. Resources are read-only data the server makes available.

---

## MCP Prompts as Commands

MCP servers can provide prompt templates. Execute them with:

```
/mcp:server-name:prompt-name
```

These appear in the slash command menu alongside skills and commands.

---

## Using Claude Code as an MCP Server

Claude Code can itself act as an MCP server for other applications:

```bash
claude mcp serve
```

This allows other MCP clients to connect to Claude Code and use its capabilities.

---

## Popular MCP Servers

Commonly used servers (install at your own risk -- verify security):

| Server | Purpose | Command |
|--------|---------|---------|
| Circleback | Meeting context | `claude mcp add circleback --transport http https://app.circleback.ai/api/mcp` |
| Sentry | Error monitoring | `claude mcp add sentry --transport http https://mcp.sentry.dev/sse` |
| GitHub | Code reviews, PRs | Various implementations available |
| PostgreSQL | Database queries | `claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres` |

For a full list, see the MCP server directory at modelcontextprotocol.io or the Claude Code documentation.
