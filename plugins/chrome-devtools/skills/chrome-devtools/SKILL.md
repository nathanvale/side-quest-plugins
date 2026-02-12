---
name: chrome-devtools
description: >
  Uses Chrome DevTools via MCP for browser automation, debugging, and testing.
  Use when: automating browser interactions, taking screenshots, testing webapps,
  analyzing Chrome performance traces, inspecting network requests, validating
  accessibility, creating npm tokens via browser, setting up GitHub OIDC,
  or any task requiring Chrome DevTools.
argument-hint: "[workflow or URL]"
allowed-tools:
  - Bash
  - Read
  - Glob
  - Grep
  - AskUserQuestion
  - ToolSearch
  - mcp__chrome-devtools__*
---

# Chrome DevTools Expert

You are a browser automation expert using the Chrome DevTools MCP. Before any workflow, always verify the connection is healthy.

## 1. Connection Check (Always First)

Run layered diagnostics -- each layer narrows the root cause:

**Layer 1: MCP probe**
Call `list_pages` via the Chrome DevTools MCP.
- Success -> connection healthy, proceed with workflow
- Failure -> continue to Layer 2

**Layer 2: Port check**
```bash
lsof -i :9222 -sTCP:LISTEN 2>/dev/null
```
- Port in use -> stale process holding the port (report PID and process name)
- Port free -> continue to Layer 3

**Layer 3: Chrome debug endpoint**
```bash
curl -s --max-time 3 http://localhost:9222/json/version
```
- Response -> Chrome running but MCP can't connect (transport issue)
- No response -> Chrome not running with debug port

**Layer 4: MCP process check** (if layers 2-3 suggest MCP issue)
```bash
ps aux | grep -c '[c]hrome-devtools-mcp'
```
- Process found -> MCP running but transport broken
- Not found -> MCP not started or not configured

**On failure**: Report the specific diagnosis and tell the user to run `/chrome-devtools:fix`. Never silently proceed without a connection.

## 2. Core Concepts

- **Browser auto-starts** on first MCP tool call with a persistent user profile
- **Page selection**: `list_pages` -> `select_page` by URL or title
- **Element interaction**: `take_snapshot` for accessibility UIDs, then `click`/`fill` by UID
- **Large outputs**: Use `filePath` param to write results to disk instead of stdout
- **Screenshot files**: NEVER use the `Read` tool to display screenshot images saved to disk. Report the file path to the user instead. Full-page captures can exceed API size limits and crash the conversation.
- **Pagination**: Use `pageIdx`/`pageSize` for list tools with many entries

## 3. Workflow Routing

Match the user's intent and load the appropriate reference:

| Intent | Reference | Key Pattern |
|--------|-----------|-------------|
| Performance audit | [browser-workflows.md](references/browser-workflows.md) | trace -> analyze insights |
| Network monitoring | [browser-workflows.md](references/browser-workflows.md) | list_network_requests -> filter |
| Accessibility testing | [browser-workflows.md](references/browser-workflows.md) | snapshot verbose -> validate |
| Browser automation | [browser-workflows.md](references/browser-workflows.md) | snapshot -> UIDs -> interact |
| Multi-tab management | [browser-workflows.md](references/browser-workflows.md) | list -> new -> select |
| Device emulation | [browser-workflows.md](references/browser-workflows.md) | emulate viewport + network |
| npm token creation | [publishing-workflows.md](references/publishing-workflows.md) | Auth, form fill, 1Password |
| OIDC setup | [publishing-workflows.md](references/publishing-workflows.md) | Auth, form fill |
| GitHub secret/protection | [publishing-workflows.md](references/publishing-workflows.md) | Prefer `gh` CLI |
| Screenshot | Direct (no ref needed) | navigate -> wait -> take_screenshot |
| Custom automation | Direct | navigate -> snapshot -> interact |
| Connection issues | [diagnostics.md](references/diagnostics.md) | Layered diagnostic flow |
| Tool parameters | [tools.md](references/tools.md) | High-signal tool reference |

## 4. Core Patterns

### Snapshot-First Element Finding

Always `take_snapshot` before interacting with elements:
- Match by **accessible name** (visible text) and **role** (button, textbox, link)
- If not found, re-snapshot and try alternative labels (e.g., "Generate token" vs "Create token")
- Only use `take_screenshot` for visual verification, never for element discovery

### Auth Detection

Before any site workflow:
1. `navigate_page` to the site root
2. `take_snapshot` and check for "Sign In" / "Log in" text
3. If not logged in, tell the user to log in manually, then `wait_for` authenticated state

### 1Password Secret Storage

When workflows create secrets (npm tokens, API keys):
1. Check `op --version` for availability
2. **Vault**: Always `API Credentials` -- the sole vault
3. **Auth**: `OP_SERVICE_ACCOUNT_TOKEN` in shell env (non-interactive, no Touch ID)
4. Check for existing items before creating duplicates
5. Store with expiry tracking and context metadata
6. Fall back to `gh secret set` or manual copy if `op` unavailable

### Secret Safety

**CRITICAL**: NEVER call `take_screenshot` after a secret or token is revealed on screen. The token would be persisted as an image file.
- Screenshot BEFORE the generate/reveal step for verification
- After reveal, use `take_snapshot` (text only) to extract the value
- Display only first 8 characters to the user: `npm_1234abcd...`
- Immediately offer storage (1Password -> gh secret set -> manual copy)

## 5. Graceful Degradation

On any failure mid-workflow:
1. Screenshot current state (if connection alive AND no secrets visible on screen)
2. Report which step failed and what is visible
3. Provide remaining steps as manual click-by-click instructions
4. Never retry destructive actions automatically
