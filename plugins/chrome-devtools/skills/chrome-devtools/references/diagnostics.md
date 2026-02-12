# Diagnostics

Error recovery matrix and connection troubleshooting for Chrome DevTools MCP.

---

## Error Recovery Matrix

| Failure | Detector | Action | Fallback |
|---------|----------|--------|----------|
| Element not found | `take_snapshot` no UID match | Re-snapshot, try alternative labels | Screenshot + manual instructions |
| Navigation timeout | `wait_for` exceeds timeout | Screenshot current page | Manual navigation steps |
| Empty screenshot | `take_screenshot` returns empty/0-byte data or API 400 "image cannot be empty" | Retry without `fullPage`. If still empty, retry with `filePath` to save to disk. If still empty, reduce viewport with `resize_page` | Known upstream bug ([#571](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/571)). Report failure, suggest manual screenshot |
| 2FA prompt | Snapshot shows auth dialog | Tell user to dismiss, `wait_for` | Wait for user, resume |
| Chrome crash | Tool returns connection error | Report, provide startup cmd | STOP workflow |
| MCP disconnected | Tool call fails | Run layered diagnostics | Point to `/chrome-devtools:fix` |

---

## Layered Diagnostic Flow

Each layer narrows the root cause. Stop at the first conclusive result.

### Layer 1: MCP Probe

Call `list_pages` via Chrome DevTools MCP.
- **Success**: Connection healthy. Report page count and proceed.
- **Failure**: Continue to Layer 2.

### Layer 2: Port Check

```bash
lsof -i :9222 -sTCP:LISTEN 2>/dev/null
```
- **Port in use**: Something is listening. Extract PID and process name. If it's not Chrome or the MCP, it's a port conflict.
- **Port free**: Nothing listening on 9222. Continue to Layer 3.

### Layer 3: Chrome Debug Endpoint

```bash
curl -s --max-time 3 http://localhost:9222/json/version
```
- **Response**: Chrome is running with debug port. The issue is MCP transport.
- **No response**: Chrome is not running with remote debugging enabled.

### Layer 4: MCP Process Check

```bash
ps aux | grep -c '[c]hrome-devtools-mcp'
```
- **Process found**: MCP is running but can't connect to Chrome. Transport issue.
- **Not found**: MCP server is not running or not configured.

---

## Fix Command Scenario Table

Used by `/chrome-devtools:fix` to map diagnostic results to actions.

| Problem | Layer Detected | Detection Method | Diagnosis Message | Fix Options |
|---------|---------------|------------------|-------------------|-------------|
| Stale process on port | Layer 2 | `lsof` shows PID not matching MCP | "Port 9222 held by PID {pid} ({process})" | Kill PID / use `--isolated` / manual |
| Profile locked | Layer 1 | `list_pages` returns "browser already running" | "Chrome profile locked by another instance" | Clear SingletonLock / `--isolated` / restart MCP |
| Chrome not running | Layer 2+3 | Port free, curl fails | "Chrome not running with debug port" | Launch Chrome / `--isolated` / `--autoConnect` |
| MCP transport broken | Layer 3+4 | curl succeeds, MCP process exists but list_pages fails | "MCP can't connect to Chrome" | Restart MCP / `--isolated` |
| MCP not running | Layer 4 | No MCP process found | "MCP server not running" | Restart MCP / re-add server |
| MCP not configured | Layer 1 | Tool not found error | "Chrome DevTools MCP not configured or enabled" | `claude mcp add` / `/mcp-manager:enable` |
| Everything healthy | Layer 1 | `list_pages` succeeds | "Connection healthy. {N} pages open." | No action needed |

---

## Connection Troubleshooting

### Port Conflicts

```bash
# Find what's using port 9222
lsof -i :9222 -sTCP:LISTEN

# Kill a specific PID
kill <PID>

# If Chrome is running without debug port, restart with:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-debug-profile"
```

### Isolated Mode

Use `--isolated` for a temporary user data directory. This prevents profile locks but loses session state (cookies, logins):

```json
{
  "command": "bunx",
  "args": [
    "@anthropic-ai/chrome-devtools-mcp@latest",
    "--isolated"
  ]
}
```

**When to use**: Profile lock errors, testing in clean state, avoiding conflicts with main Chrome.
**Trade-off**: Must re-authenticate on every session.

### Auto-Connect (Chrome 144+)

Use `--autoConnect` to connect to an already-running Chrome instance instead of launching a new one:

```json
{
  "command": "bunx",
  "args": [
    "@anthropic-ai/chrome-devtools-mcp@latest",
    "--autoConnect"
  ]
}
```

**When to use**: Chrome is already running with `--remote-debugging-port=9222`. Avoids launching a second instance.

### Profile Lock Recovery

If Chrome crashes and leaves a stale lock:

```bash
# Find and remove the lock file
rm -f "$HOME/.chrome-debug-profile/SingletonLock"
```

Then restart the MCP or Chrome.

### MCP Server Restart

If the MCP server needs a full restart:

1. `/mcp-manager:disable chrome-devtools` -- disable the MCP server
2. Wait a moment for processes to clean up
3. `/mcp-manager:enable chrome-devtools` -- re-enable the MCP server
4. Run `/chrome-devtools:fix --check` to verify

### Headless Mode

For CI or environments without a display:

```json
{
  "command": "bunx",
  "args": [
    "@anthropic-ai/chrome-devtools-mcp@latest",
    "--headless"
  ]
}
```

**Trade-off**: No visual Chrome window. Screenshots still work but user can't interact manually.

### When MCP Is Insufficient

Some tasks require the full Chrome DevTools UI:
- Memory profiling with heap snapshots
- Advanced network throttling profiles
- Service worker debugging
- WebSocket frame inspection

Guide the user to open Chrome DevTools manually (`Cmd+Option+I`) for these cases.
