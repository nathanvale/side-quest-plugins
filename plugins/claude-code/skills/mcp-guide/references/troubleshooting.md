# Troubleshooting

Common MCP problems, debug steps, error messages, and solutions.

Source: code.claude.com/docs/en/troubleshooting, code.claude.com/docs/en/mcp

---

## Quick Reference

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Server not connecting | Wrong transport type | Add `--transport http` for remote URLs |
| Server not appearing in /mcp | Config file error | Validate JSON syntax in .mcp.json |
| Tools not found | Tool Search hiding them | Check `/mcp` for tool list, verify descriptions |
| Output truncated | MAX_MCP_OUTPUT_TOKENS limit | Increase limit or design responses to be compact |
| Timeout errors | Slow server or network | Increase MCP_TIMEOUT / MCP_TOOL_TIMEOUT |
| Permission denied | First-use trust check | Approve server in the trust prompt |
| "Cannot find module" | Bunx cache corruption | Clear bunx cache, restart Claude Code |
| Server crashes on start | Bad command or missing deps | Run command manually to debug |
| Env vars not expanding | Not set in shell profile | Add to ~/.zshrc and restart terminal |
| Wrong scope applying | Precedence order | Check local > project > user priority |

---

## Debug Steps

### Step 1: Check Server Status

```
/mcp
```

Shows all connected servers, their status, tool count, and token cost. If your server isn't listed, the config isn't being read.

### Step 2: List Registered Servers

```bash
claude mcp list
```

Shows all configured servers across all scopes (local, project, user). If the server is listed but not connected, it's a startup issue.

### Step 3: Enable Debug Mode

```bash
claude --debug
```

Shows detailed logs including:
- MCP connection attempts
- Server startup output
- Tool discovery
- Error messages

### Step 4: Check Config Files

Configs are read from (in precedence order):

1. `.claude/settings.local.json` (local scope)
2. `.mcp.json` in project root (project scope)
3. `~/.claude.json` (user scope)

Validate JSON syntax:
```bash
python3 -m json.tool .mcp.json
python3 -m json.tool ~/.claude.json
```

---

## Common Errors

### "Connection refused" or Server Not Starting

**For remote servers:**
1. Verify the URL is correct and accessible
2. Ensure you specified the transport: `--transport http` or `--transport sse`
3. Check if authentication is required (OAuth flow might be needed)
4. Test the URL directly: `curl https://api.example.com/mcp`

**For local stdio servers:**
1. Run the command manually to verify it works:
   ```bash
   npx -y @example/mcp-server
   ```
2. Check dependencies are installed
3. Check file permissions: `chmod +x ./my-server.sh`
4. Verify Node.js/Bun is available

### "Cannot find module" Errors

Usually bunx cache corruption. Clear and retry:

```bash
# Find and remove corrupted cache
rm -rf /private/var/folders/_b/*/T/bunx-501-@side-quest/

# For other packages
rm -rf /private/var/folders/_b/*/T/bunx-501-@example/
```

Then restart Claude Code.

### Environment Variables Not Expanding

`.mcp.json` uses `${VAR}` syntax. If values are empty:

1. Check the variable is set: `echo $MY_API_KEY`
2. Ensure it's in your shell profile (`~/.zshrc`), not just the current session
3. Restart Claude Code after adding to shell profile
4. Note: `.env` files are NOT automatically read by Claude Code

### Output Truncated or "Output saved to file"

MCP tool output exceeds `MAX_MCP_OUTPUT_TOKENS` (default: 25000).

Options:
1. Increase the limit: `export MAX_MCP_OUTPUT_TOKENS=50000`
2. Design your server to return compact responses
3. Support `response_format: "json"` for token-efficient output
4. Add pagination to large result sets

### Timeout Errors

Default timeouts are 5 minutes each. If your server needs more time:

```bash
export MCP_TIMEOUT=600000        # 10 min server init
export MCP_TOOL_TIMEOUT=600000   # 10 min per tool call
```

### Server Conflicts

If two servers have the same name, the higher-precedence scope wins (local > project > user). To resolve:

1. Check all config files for duplicate names
2. Rename one server
3. Or remove the lower-priority duplicate

### MCP Server Not Auto-Invoking

If Claude doesn't use your MCP tools when expected:

1. **Tool Search might be hiding tools** -- check `/mcp` to verify tools are listed
2. **Tool descriptions might be unclear** -- Tool Search uses descriptions to find tools
3. **Wrong tool name in prompt** -- verify exact tool names in `/mcp`
4. **Too many tools** -- Claude might be overwhelmed. Consider reducing server count.

---

## Plugin MCP Issues

### Plugin Server Not Starting

1. Verify the plugin is enabled
2. Check `${CLAUDE_PLUGIN_ROOT}` resolves: the path should point to the plugin directory
3. Run the server command manually with the resolved path
4. Check plugin logs for errors

### Plugin Tool Names

Plugin MCP tools are namespaced:
```
mcp__plugin_{plugin-name}_{server-name}__{tool-name}
```

When referencing in skills, use the full namespaced name.

---

## Performance Issues

### High Token Usage from MCP

1. Run `/context` to check total usage
2. Run `/mcp` to see per-server costs
3. Enable Tool Search: `export ENABLE_TOOL_SEARCH=true`
4. Remove servers you're not actively using
5. Use CLI alternatives for simple operations

### Slow MCP Responses

1. Check server-side performance
2. Increase timeouts if needed
3. Consider caching strategies in your server
4. Use `async: true` for hooks on MCP tool calls to avoid blocking

---

## Getting Help

- `claude --debug` for verbose logging
- `/mcp` for server status and tool inventory
- `/context` for context window breakdown
- `claude mcp list` for all registered servers
- `/hooks` for MCP-related hook configuration
