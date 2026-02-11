# Browser Workflows

Generic browser automation workflows using Chrome DevTools MCP tools.

---

## Performance Analysis

Capture and analyze Chrome performance traces for Core Web Vitals.

1. `navigate_page` to the target URL
2. `performance_start_trace` with `reload: true, autoStop: true` -- reloads the page and automatically stops after load completes. Use `reload: false, autoStop: false` if you need to capture interactions after page load (then manually call `performance_stop_trace` when done).
3. If `autoStop: false`: interact with the page (scroll, click, navigate) to simulate user behavior, then call `performance_stop_trace`
4. Review the trace results -- they include CWV scores and a list of available insight sets with IDs
5. `performance_analyze_insight` with `insightSetId` (from the trace results) and `insightName` (e.g., "LCPBreakdown", "DocumentLatency") -- drill into specific insights

**CWV thresholds** (see [tools.md](tools.md) for full reference):
- INP <= 200ms good, <= 500ms needs improvement
- LCP <= 2.5s good, <= 4.0s needs improvement
- CLS <= 0.1 good, <= 0.25 needs improvement
- TBT < 200ms (lab proxy for INP)

**Tips**:
- Use `emulate` to throttle CPU/network before tracing for realistic mobile conditions
- Take a screenshot before and after to visually bookend the trace
- Use `filePath` param on trace tools if the output is large

---

## Network Monitoring

Capture and analyze network requests during page interactions.

1. `navigate_page` to the target URL
2. Interact with the page to trigger network activity
3. `list_network_requests` -- enumerate all captured requests
4. `get_network_request` -- inspect individual request/response details

**Filtering patterns**:
- Filter by `resourceTypes` array (e.g., `["xhr", "fetch"]` to isolate API calls)
- Available types: document, stylesheet, image, media, font, script, xhr, fetch, websocket, and others
- Use `pageIdx`/`pageSize` for pagination on busy pages

**HAR-style export**: Use `filePath` param to write request data to disk for offline analysis.

---

## Accessibility Testing

Validate page accessibility using the Chrome accessibility tree.

1. `navigate_page` to the target URL
2. `take_snapshot` -- get the full accessibility tree
3. Validate ARIA roles, labels, and structure
4. Check for common issues:
   - Missing alt text on images (role: img without name)
   - Buttons/links without accessible names
   - Form inputs without labels
   - Heading hierarchy violations (h1 -> h3 skip)
   - Missing landmark regions (main, nav, footer)

**Tips**:
- Use verbose snapshot mode for detailed ARIA properties
- Compare snapshot against WCAG 2.1 AA requirements
- Screenshot specific elements for visual verification

---

## Browser Automation

General-purpose browser interaction pattern.

### Navigation Pattern

Every automation follows this sequence:

1. `navigate_page` to the target URL
2. `wait_for` the page to load (check for expected text on the page)
3. `take_snapshot` to get the accessibility tree
4. Identify target elements by **text content and role** (never hardcoded coordinates)
5. Perform action (`click`, `fill`, `press_key`)
6. `take_screenshot` to verify the result

### Element Finding: Snapshot-First

**Always use `take_snapshot` to locate elements.** It is cheaper, faster, and more resilient to UI changes than screenshots.

- Match elements by their **accessible name** (visible text) and **role** (button, link, textbox)
- If the primary text isn't found, search for alternative labels (e.g., "Submit" vs "Save" vs "OK")
- Only use `take_screenshot` for visual verification after actions, not for element discovery
- Re-snapshot after any page state change (navigation, form submission, dialog)

### Form Filling

For multi-field forms:
1. `take_snapshot` to discover all form fields
2. `fill` each field by UID
3. For dropdowns: `click` to open, `take_snapshot` to find options, `click` the target option
4. For checkboxes/radios: `click` the element by UID
5. `take_snapshot` before submitting to verify all fields are filled
6. `click` the submit button
7. `wait_for` success state

---

## Multi-Tab Management

Work with multiple browser tabs simultaneously.

1. `list_pages` -- enumerate all open tabs (returns pageId, URL, title)
2. `new_page` -- open a new tab (optionally with a URL)
3. `select_page` -- switch active tab by pageId
4. `close_page` -- close a specific tab

**Tips**:
- Always `list_pages` before assuming which tab is active
- After `select_page`, `take_snapshot` to confirm you're on the right page
- Use multi-tab for workflows that need to compare two pages side-by-side

---

## Device Emulation

Test responsive designs and mobile experiences.

1. `emulate` -- set device viewport, user agent, network conditions, and CPU throttle
2. `navigate_page` to the target URL
3. `take_screenshot` for visual verification
4. `take_snapshot` to verify responsive layout changes in the accessibility tree

**Common device presets**:
- iPhone 14: 390x844, deviceScaleFactor 3, mobile user agent
- iPad: 810x1080, deviceScaleFactor 2, tablet user agent
- Desktop: 1920x1080, no mobile emulation

**Network throttling** (via `networkConditions` param):
- `"Slow 3G"`, `"Fast 3G"`, `"Slow 4G"`, `"Fast 4G"`
- `"Offline"` -- test offline behavior
- `"No emulation"` -- reset to default

---

## Screenshot Capture

Take screenshots for documentation or verification.

1. `navigate_page` to the target URL
2. `wait_for` expected text to appear on the page (confirming load is complete)
3. `take_screenshot` -- captures the visible viewport

**Full-page capture**: Use the screenshot tool's full-page option if available.

**Device-specific screenshots**: Use `emulate` first to set viewport dimensions, then screenshot.

**Tips**:
- Wait for fonts, images, and animations to settle before capturing
- For pages with lazy loading, scroll to trigger content load first
- Use `resize_page` for custom viewport sizes without full device emulation

---

## Test Webapp Elements

Navigate to a webapp and verify elements exist and behave correctly.

1. `navigate_page` to the target URL
2. `take_snapshot` to get the accessibility tree
3. Verify elements by text content and role:
   - Buttons: role "button" with expected text
   - Links: role "link" with expected href
   - Inputs: role "textbox" with expected label
   - Headings: appropriate heading level with expected text
4. Test interactions: `click` buttons, `fill` inputs, verify state changes
5. `take_screenshot` for visual verification of the final state
