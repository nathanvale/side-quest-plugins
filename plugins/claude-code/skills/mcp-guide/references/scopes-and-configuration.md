# Scopes & Configuration

MCP installation scopes, configuration files, precedence rules, environment variables, and managed policies.

Source: code.claude.com/docs/en/mcp, code.claude.com/docs/en/settings

---

## Three Installation Scopes

| Scope | Config File | Applies To |
|-------|------------|-----------|
| **Local** | `.claude/settings.local.json` | This machine + this project only |
| **Project** | `.mcp.json` in project root | Anyone who clones this project |
| **User** | `~/.claude.json` | All your projects on this machine |

### Local Scope

- Not committed to version control
- For personal API keys, local development servers
- Highest precedence -- overrides project and user

### Project Scope

- Committed to version control (`.mcp.json` in project root)
- Shared with team members
- Use environment variable expansion for secrets: `${API_KEY}`
- Team members set their own env vars locally

### User Scope

- Global across all projects
- For personal productivity servers (calendar, email, notes)
- Lowest precedence -- overridden by project and local

### Choosing the Right Scope

| Scenario | Scope | Why |
|----------|-------|-----|
| Team's shared database | Project | Everyone needs it, same config |
| Your personal API key | Local | Don't commit secrets |
| Your calendar server | User | Useful everywhere |
| CI/CD server | Local | Machine-specific |

---

## Scope Precedence

```
local > project > user
```

If the same server name appears in multiple scopes, the most specific scope wins. A local config overrides a project config, which overrides a user config.

---

## Configuration File Formats

### .mcp.json (Project Scope)

```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@example/mcp-server"],
      "env": {
        "API_KEY": "${API_KEY}",
        "DATABASE_URL": "${DATABASE_URL}"
      }
    },
    "remote-server": {
      "type": "http",
      "url": "https://api.example.com/mcp"
    }
  }
}
```

### ~/.claude.json (User Scope)

Same `mcpServers` format, but applies globally:

```json
{
  "mcpServers": {
    "my-calendar": {
      "command": "npx",
      "args": ["-y", "@example/calendar-mcp"],
      "env": {
        "CALENDAR_TOKEN": "${CALENDAR_TOKEN}"
      }
    }
  }
}
```

---

## Environment Variable Expansion

`.mcp.json` supports `${VAR}` syntax for environment variables:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["server.js"],
      "env": {
        "API_KEY": "${MY_API_KEY}",
        "DB_URL": "${DATABASE_URL}",
        "HOME": "${HOME}"
      }
    }
  }
}
```

Variables are resolved from the shell environment at Claude Code startup. If a variable is not set, the expansion results in an empty string.

**Tip:** Set variables in your shell profile (`~/.zshrc`, `~/.bashrc`) so they're available when Claude Code starts.

---

## Settings Fields for MCP

These settings control MCP behavior in `settings.json` or `settings.local.json`:

| Setting | Type | Description |
|---------|------|-------------|
| `enableAllProjectMcpServers` | boolean | Auto-approve all project MCP servers (skip trust prompt) |
| `enabledMcpjsonServers` | string[] | Specific .mcp.json servers to auto-approve |
| `disabledMcpjsonServers` | string[] | Specific .mcp.json servers to block |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_MCP_OUTPUT_TOKENS` | 25000 | Maximum tokens per MCP tool response |
| `MCP_TIMEOUT` | 300000 (5 min) | Server initialization timeout (ms) |
| `MCP_TOOL_TIMEOUT` | 300000 (5 min) | Individual tool call timeout (ms) |
| `ENABLE_TOOL_SEARCH` | `auto:3` | Tool Search activation threshold |

---

## Managed MCP Configuration

For organizations controlling which MCP servers are allowed.

### Option 1: Exclusive Control (managed-mcp.json)

Place `managed-mcp.json` alongside the Claude Code binary or in a managed settings directory. Servers defined here cannot be modified by users.

```json
{
  "mcpServers": {
    "company-server": {
      "command": "npx",
      "args": ["-y", "@company/mcp-server"],
      "env": {
        "API_KEY": "${COMPANY_API_KEY}"
      }
    }
  }
}
```

### Option 2: Policy-Based Control (Allowlists/Denylists)

Control which servers users can add:

```json
{
  "allowedMcpServers": [
    "npx -y @company/*",
    "https://api.company.com/*"
  ],
  "deniedMcpServers": [
    "npx -y @untrusted/*"
  ]
}
```

### Restriction Types

| Type | Match Against | Example |
|------|-------------|---------|
| Command-based | The full command string | `"npx -y @company/*"` |
| URL-based | The server URL | `"https://api.company.com/*"` |

**Allowlist behavior**: If `allowedMcpServers` is set, only matching servers can be added. Everything else is blocked.

**Denylist behavior**: If `deniedMcpServers` is set, matching servers are blocked. Everything else is allowed.

If both are set, a server must match the allowlist AND not match the denylist.

---

## First-Use Trust Verification

When a project `.mcp.json` contains MCP servers, Claude Code prompts for trust verification on first use:

- Each server requires explicit approval
- Approval is stored locally
- Use `enableAllProjectMcpServers: true` to skip the prompt
- Use `enabledMcpjsonServers` to pre-approve specific servers
