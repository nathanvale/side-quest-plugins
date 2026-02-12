---
description: Diagnose and fix Chrome DevTools MCP connection issues
argument-hint: "[--check]"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
  - ToolSearch
  - mcp__chrome-devtools__*
---

Diagnose and optionally fix Chrome DevTools MCP connection issues.

**Arguments received**: `$ARGUMENTS`

## Modes

- **`/chrome-devtools:fix`** -- Full interactive troubleshooter: diagnose, report, offer fixes, execute, re-verify.
- **`/chrome-devtools:fix --check`** -- Read-only diagnostics only. Reports status but takes no action.

## Diagnostic Flow

Run the layered diagnostics from the chrome-devtools skill:

**Layer 1: MCP probe** -- Call `list_pages` via Chrome DevTools MCP.
- Success -> Report "Connection healthy. {N} pages open." and stop.
- Tool not available (not in tool list) -> Report: "Chrome DevTools MCP tools are not registered in this session. Run `/mcp` and reconnect `chrome-devtools`, or run `/mcp-manager:enable chrome-devtools`." In `--check` mode, stop here. In interactive mode, offer to guide the user through reconnection.
- Tool available but returns error -> Continue to Layer 2.

**Layer 2: Port check**
```bash
lsof -i :9222 -sTCP:LISTEN 2>/dev/null
```
- Port in use -> Extract PID and process name. Report conflict.
- Port free -> Continue to Layer 3.

**Layer 3: Chrome debug endpoint**
```bash
curl -s --max-time 3 http://localhost:9222/json/version
```
- Response -> Chrome running but MCP transport issue. Parse the `Browser` field from the JSON (e.g., `"Chrome/144.0.6367.60"`) and report: "Chrome {version} detected." If major version >= 144, add: "Auto-connect is available (`--autoConnect`). See diagnostics.md for setup."
- No response -> Chrome not running with debug port.

**Layer 4: MCP process check**
```bash
ps aux | grep -c '[c]hrome-devtools-mcp'
```
- Process found -> MCP running but transport broken.
- Not found -> MCP not started or not configured.

## After Diagnosis

Load [diagnostics.md](../skills/chrome-devtools/references/diagnostics.md) for the scenario table and fix options.

**If `--check` mode**: Report the diagnosis and stop. Do not take any action.

**If interactive mode**:
1. Report the specific diagnosis
2. Present fix options to the user via `AskUserQuestion`
3. Execute the chosen fix
4. Re-run Layer 1 to verify the fix worked
5. If still broken, report and offer next option

## Recommended Fix Priority

When presenting fixes, prefer in this order:

1. **Restart MCP** -- simplest, works for transient issues
2. **`--browserUrl` with manual Chrome launch** -- most reliable for persistent connection issues. Launch Chrome with `--remote-debugging-port=9222 --user-data-dir="$HOME/.chrome-debug-profile"` and configure `--browserUrl=http://localhost:9222`. No permission dialogs, works with any Chrome version.
3. **`--isolated`** -- quick workaround for profile locks, loses session state
4. **`--autoConnect`** -- only suggest if Chrome >= 144 and user needs existing auth/cookies
