---
description: Take a screenshot of a URL via Chrome DevTools
argument-hint: "<url> [--full-page] [--device <name>]"
---

Take a screenshot using Chrome DevTools MCP.

**Arguments received**: `$ARGUMENTS`

## Steps

1. Run the connection check from the chrome-devtools skill (Layer 1: `list_pages`). On failure, point to `/chrome-devtools:fix`.
2. Parse arguments:
   - **URL** (required) -- the page to screenshot
   - **--full-page** (optional) -- capture the full scrollable page
   - **--device <name>** (optional) -- emulate a device before capture (e.g., "iPhone 14", "iPad")
3. If `--device` is specified, call `emulate` with appropriate viewport and user agent first.
4. `navigate_page` to the URL with `waitUntil: "networkidle"`.
5. `wait_for` the page to fully load (check for body text or key element).
6. `take_screenshot` with `fullPage` if `--full-page` was specified.
7. Report the screenshot to the user.

If no URL is provided, ask the user which URL to screenshot.
