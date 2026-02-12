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
- Failure -> Continue to Layer 2.

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
- Response -> Chrome running but MCP transport issue.
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
