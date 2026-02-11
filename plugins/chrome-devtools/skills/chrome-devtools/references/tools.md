# Tools Reference

High-signal Chrome DevTools MCP tools. These 10 cover 90%+ of use cases.

---

## Top 10 Tools

### 1. navigate_page

Navigate to a URL in the active tab.

**Key params**: `url` (required), `waitUntil` (optional: "load", "domcontentloaded", "networkidle")
**When to use**: Starting any workflow, navigating between pages.
**Common mistake**: Not waiting for load to complete before taking snapshots.

### 2. take_snapshot

Get the accessibility tree for the active page. Returns element UIDs for interaction.

**Key params**: `random` (optional: return a random subset for large pages)
**When to use**: Before ANY element interaction. This is your primary element discovery tool.
**Common mistake**: Using `take_screenshot` for element finding instead of snapshot.

### 3. take_screenshot

Capture a visual screenshot of the active page.

**Key params**: `filePath` (optional: save to file instead of inline), `fullPage` (optional)
**When to use**: Visual verification after actions. NEVER after a secret is revealed.
**Common mistake**: Using screenshots for element discovery (use snapshot instead).

### 4. click

Click an element identified by UID from a snapshot.

**Key params**: `uid` (required: from take_snapshot), `button` (optional: "left", "right", "middle")
**When to use**: After take_snapshot identifies the target element.
**Common mistake**: Using stale UIDs from a previous snapshot after page state changed.

### 5. fill

Type text into an input element identified by UID.

**Key params**: `uid` (required), `value` (required)
**When to use**: Filling text inputs, search fields, form fields.
**Common mistake**: Not clearing existing text first (fill replaces content).

### 6. wait_for

Wait for a condition to be met before proceeding.

**Key params**: `text` (wait for text), `url` (wait for URL), `timeout` (ms)
**When to use**: After navigation, form submission, or any async operation.
**Common mistake**: Setting timeout too low for slow pages.

### 7. list_pages

Enumerate all open browser tabs.

**Key params**: None required. Returns pageId, URL, title for each tab.
**When to use**: Finding a specific tab, checking connection health, multi-tab workflows.
**Common mistake**: Assuming which tab is active without checking.

### 8. select_page

Switch the active tab by pageId.

**Key params**: `pageId` (required: from list_pages)
**When to use**: Multi-tab workflows, switching between pages.
**Common mistake**: Not re-snapshotting after switching tabs.

### 9. evaluate_script

Execute JavaScript in the page context. Returns the result.

**Key params**: `script` (required: JS code string)
**When to use**: Reading page state, extracting data, triggering JS-only interactions.
**Common mistake**: Running destructive scripts without user confirmation.

### 10. list_network_requests

List captured network requests with filtering.

**Key params**: `urlPattern` (optional: filter by URL), `resourceType` (optional), `startIndex`/`maxResults` (pagination)
**When to use**: Network monitoring, API debugging, performance analysis.
**Common mistake**: Not paginating on busy pages (can return hundreds of entries).

---

## Remaining Tools (by category)

### Input

- **fill_form** -- fill multiple form fields at once (batch version of fill)
- **hover** -- hover over an element by UID (triggers tooltips, dropdowns)
- **press_key** -- send keyboard input (Enter, Tab, Escape, shortcuts)
- **drag** -- drag from one element to another by UIDs
- **upload_file** -- upload a file to a file input element
- **handle_dialog** -- accept or dismiss browser dialogs (alert, confirm, prompt)

### Navigation

- **new_page** -- open a new browser tab (optionally with URL)
- **close_page** -- close a tab by pageId

### Emulation

- **emulate** -- set device viewport, user agent, network conditions, CPU throttle
- **resize_page** -- resize the browser viewport to specific dimensions

### Performance

- **performance_start_trace** -- begin recording a performance trace
- **performance_stop_trace** -- stop recording and get trace data
- **performance_analyze_insight** -- analyze trace data for CWV and bottlenecks

### Network

- **get_network_request** -- get detailed info for a specific network request

### Debugging

- **get_console_message** -- get a specific console message by index
- **list_console_messages** -- list all console messages (errors, warnings, logs)

---

## Core Web Vitals Thresholds

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| INP (Interaction to Next Paint) | <= 200ms | <= 500ms | > 500ms |
| LCP (Largest Contentful Paint) | <= 2.5s | <= 4.0s | > 4.0s |
| CLS (Cumulative Layout Shift) | <= 0.1 | <= 0.25 | > 0.25 |
| TBT (Total Blocking Time, lab) | < 200ms | < 600ms | >= 600ms |
