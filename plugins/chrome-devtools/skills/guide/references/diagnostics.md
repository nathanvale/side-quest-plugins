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
- **Tool not available** (not in tool list): MCP tools aren't registered in this session. Report and STOP -- do not continue to Layer 2 (this is a session config issue, not a connection issue).
- **Tool returns error**: Continue to Layer 2.

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
- **Response**: Chrome is running with debug port. Parse the `Browser` field (e.g., `"Chrome/144.0.6367.60"`) and report the version. If Chrome >= 144, note auto-connect availability (`--autoConnect`). The issue is MCP transport.
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
| MCP tools not registered | Layer 1 | `list_pages` not in tool list (MCP may show "connected" with 0 tools) | "Chrome DevTools MCP tools are not registered in this session" | Run `/doctor` to diagnose MCP connectivity |
| MCP not configured | Layer 1 | ToolSearch returns no chrome-devtools tools | "Chrome DevTools MCP not configured or enabled" | Run `/doctor` to diagnose MCP connectivity |
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

### Manual Connection (`--browserUrl`) -- Recommended

The most reliable method for connecting to an existing Chrome instance. You launch Chrome yourself with `--remote-debugging-port` and point the MCP at it. No permission dialogs, works with any Chrome version.

**Step 1: Launch Chrome with remote debugging**

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-debug-profile"
```

**Security note**: Chrome requires a non-default `--user-data-dir` when using `--remote-debugging-port`. Chrome refuses to expose your default profile to the debug port -- this is intentional security hardening. Use a dedicated debug profile directory.

**Step 2: Configure the MCP server**

```json
{
  "command": "bunx",
  "args": [
    "chrome-devtools-mcp@latest",
    "--browserUrl=http://localhost:9222"
  ]
}
```

**Best for**: Daily development workflows, persistent sessions with login state, CI pipelines where Chrome is pre-launched.
**Trade-off**: Requires manually launching Chrome with the debug flags (or adding to a shell alias/startup script).

### Isolated Mode

Use `--isolated` for a temporary user data directory. This prevents profile locks but loses session state (cookies, logins):

```json
{
  "command": "bunx",
  "args": [
    "chrome-devtools-mcp@latest",
    "--isolated"
  ]
}
```

**When to use**: Profile lock errors, testing in clean state, avoiding conflicts with main Chrome.
**Trade-off**: Must re-authenticate on every session.

### Auto-Connect (Chrome 144+)

Connects to your already-running Chrome without needing `--remote-debugging-port`. Chrome 144+ exposes a native DevTools protocol endpoint that the MCP can discover automatically.

**Setup:**

1. Open `chrome://inspect/#remote-debugging` in Chrome and ensure remote debugging is enabled
2. Configure the MCP server with `--autoConnect`:

```json
{
  "command": "bunx",
  "args": [
    "chrome-devtools-mcp@latest",
    "--autoConnect"
  ]
}
```

Optionally target a specific Chrome channel: `--channel=beta`, `--channel=canary`, or `--channel=dev`.

**Best for**: Auth-gated sites (uses existing cookies/sessions), manual-to-AI debugging handoff, ad-hoc debugging sessions.

**Known friction:**
- Chrome shows a permission dialog on every MCP connection -- there is no "Always allow" option yet
- On macOS, auto-connect cannot use your main Chrome profile if Chrome is already running; you may need a separate profile
- Suspended tabs (from "Continue where you left off") can cause connection timeouts -- disable this Chrome setting or close stale tabs

**When `--browserUrl` is better**: For persistent, frictionless daily-driver sessions, launch Chrome yourself with `--remote-debugging-port=9222` and `--user-data-dir` and use `--browserUrl` instead. No permission dialogs, works with any Chrome version.

### WebSocket Connection (`--wsEndpoint`)

For remote browsers, sandboxed environments (e.g., Docker), or authenticated endpoints like Browserless.

**Step 1: Find the WebSocket URL**

```bash
curl -s http://localhost:9222/json/version | jq -r '.webSocketDebuggerUrl'
# Example output: ws://127.0.0.1:9222/devtools/browser/a1b2c3d4-e5f6-...
```

**Step 2: Configure the MCP server**

```json
{
  "command": "bunx",
  "args": [
    "chrome-devtools-mcp@latest",
    "--wsEndpoint=ws://127.0.0.1:9222/devtools/browser/<id>"
  ]
}
```

For authenticated WebSocket endpoints (e.g., Browserless), add `--wsHeaders`:

```json
{
  "command": "bunx",
  "args": [
    "chrome-devtools-mcp@latest",
    "--wsEndpoint=wss://chrome.browserless.io",
    "--wsHeaders={\"Authorization\": \"Bearer <token>\"}"
  ]
}
```

**Best for**: Remote/cloud browsers, Docker containers, Browserless/BrowserBase, environments where HTTP connectivity to `localhost:9222` is not available.
**Trade-off**: Requires obtaining the WebSocket URL first, and the URL changes on each Chrome restart.

### Custom Profile (`--userDataDir`)

Override the default Chrome profile directory used by the MCP. By default, the MCP stores its profile at `~/.cache/chrome-devtools-mcp/chrome-profile-stable`.

```json
{
  "command": "bunx",
  "args": [
    "chrome-devtools-mcp@latest",
    "--userDataDir=/path/to/custom/profile"
  ]
}
```

**When to use**: Sharing state with a specific Chrome profile, team-standardized profiles, persisting extensions across sessions, separating profiles for different projects.
**Trade-off**: Profile directory must not be in use by another Chrome instance (or you'll get a profile lock error).

### Profile Lock Recovery

If Chrome crashes and leaves a stale lock:

```bash
# Find and remove the lock file
rm -f "$HOME/.chrome-debug-profile/SingletonLock"
```

Then restart the MCP or Chrome.

### MCP Server Restart

If the MCP server needs a full restart:

1. Run `/doctor` to diagnose and restart the MCP server
2. Run `/chrome-devtools:fix --check` to verify

### Headless Mode

For CI or environments without a display:

```json
{
  "command": "bunx",
  "args": [
    "chrome-devtools-mcp@latest",
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

---

## Server Flags Quick Reference

Complete inventory of `chrome-devtools-mcp` server flags for troubleshooting and configuration.

| Flag | Description | Example |
|------|-------------|---------|
| `--browserUrl` | Connect to Chrome at a specific debug URL | `--browserUrl=http://localhost:9222` |
| `--wsEndpoint` | Connect via WebSocket URL | `--wsEndpoint=ws://127.0.0.1:9222/devtools/browser/<id>` |
| `--wsHeaders` | Headers for authenticated WebSocket endpoints | `--wsHeaders={"Authorization": "Bearer <token>"}` |
| `--autoConnect` | Auto-discover running Chrome (144+) | `--autoConnect` |
| `--channel` | Target Chrome channel (with `--autoConnect`) | `--channel=canary` |
| `--isolated` | Use temporary profile directory | `--isolated` |
| `--userDataDir` | Custom Chrome profile directory | `--userDataDir=/path/to/profile` |
| `--headless` | Run Chrome without a visible window | `--headless` |
| `--proxyServer` | Route Chrome traffic through a proxy | `--proxyServer=http://proxy:8080` |
| `--acceptInsecureCerts` | Accept self-signed/invalid TLS certificates | `--acceptInsecureCerts` |
| `--chromeArg` | Pass arbitrary flags to Chrome (repeatable) | `--chromeArg=--disable-extensions` |

---

## Upstream Reference

When encountering unfamiliar errors or checking for new features:

- **Repository**: https://github.com/ChromeDevTools/chrome-devtools-mcp
- **README (flags, config)**: `gh api repos/ChromeDevTools/chrome-devtools-mcp/readme --jq '.content' | base64 -d`
- **Open issues**: `gh search issues --repo ChromeDevTools/chrome-devtools-mcp "<error message>" --limit 5`
- **Releases/changelog**: `gh release list --repo ChromeDevTools/chrome-devtools-mcp --limit 5`
- **Troubleshooting doc**: `gh api repos/ChromeDevTools/chrome-devtools-mcp/contents/docs/troubleshooting.md --jq '.content' | base64 -d`
- **Latest version**: check `npm view chrome-devtools-mcp version`

Current version at time of writing: v0.17.0 (2026-02-10)
