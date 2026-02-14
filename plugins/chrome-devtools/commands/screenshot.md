---
description: Take a screenshot of a URL via Chrome DevTools
argument-hint: "<url> [--full-page] [--device <name>]"
---

Take a screenshot using Chrome DevTools MCP.

**Arguments received**: `$ARGUMENTS`

## Steps

1. Run the connection check from the chrome-devtools-guide skill (Layer 1: `list_pages`). On failure, point to `/chrome-devtools:fix`.
2. Parse arguments:
   - **URL** (required) -- the page to screenshot
   - **--full-page** (optional) -- capture the full scrollable page
   - **--device <name>** (optional) -- emulate a device before capture (e.g., "iPhone 14", "iPad")
3. If `--device` is specified, call `emulate` with appropriate viewport and user agent first.
4. `navigate_page` to the URL.
5. `wait_for` the page to fully load (check for expected text on the page).
6. `take_screenshot` with `fullPage` if `--full-page` was specified.
7. If the screenshot returns empty data (0 bytes, empty base64, or API 400 error), retry without `fullPage`. If still empty, retry with `filePath` to save to disk instead of inline. Report the issue if all retries fail.
8. If the screenshot was returned inline, display it. If it was saved to a file path (via `filePath` or fallback), report the file path to the user -- do NOT use the Read tool to load the image back into the conversation (full-page screenshots can be too large for the API).

If no URL is provided, ask the user which URL to screenshot.
