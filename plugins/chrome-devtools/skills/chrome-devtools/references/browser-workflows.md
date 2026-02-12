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

Validate page accessibility against WCAG 2.1 AA using the Chrome accessibility tree and JavaScript evaluation.

### Basic Audit

1. `navigate_page` to the target URL
2. `take_snapshot` -- get the full accessibility tree
3. Validate ARIA roles, labels, and structure
4. Check for common issues:
   - Missing alt text on images (role: img without name)
   - Buttons/links without accessible names
   - Form inputs without labels
   - Heading hierarchy violations (h1 -> h3 skip)
   - Missing landmark regions (main, nav, footer)

### WCAG 2.1 AA Checklist

Run through these checks systematically using `take_snapshot` and `evaluate_script`:

**Perceivable**:
- [ ] All images have meaningful alt text (or `alt=""` for decorative)
- [ ] Video/audio has captions or transcripts
- [ ] Color is not the sole means of conveying information
- [ ] Text has sufficient contrast ratio (4.5:1 normal, 3:1 large text)
- [ ] Page is readable and functional at 200% zoom
- [ ] Content reflows at 320px width without horizontal scrolling

**Operable**:
- [ ] All interactive elements are keyboard accessible (Tab, Enter, Space, Escape)
- [ ] Focus order follows a logical reading sequence
- [ ] Focus indicators are visible on all interactive elements
- [ ] No keyboard traps (user can Tab away from every element)
- [ ] Skip-to-content link exists for bypassing navigation
- [ ] Page title is descriptive and unique

**Understandable**:
- [ ] `lang` attribute set on `<html>` element
- [ ] Form inputs have visible labels (not just placeholders)
- [ ] Error messages identify the field and describe the problem
- [ ] Consistent navigation across pages

**Robust**:
- [ ] Valid HTML (no duplicate IDs, proper nesting)
- [ ] ARIA roles match element behavior
- [ ] Custom widgets have appropriate ARIA states (expanded, selected, checked)

### Color Contrast Checking

Use `evaluate_script` to compute contrast ratios for text elements:

```javascript
// Check contrast ratio for a specific element
(function() {
  const el = document.querySelector('YOUR_SELECTOR');
  const style = window.getComputedStyle(el);
  const color = style.color;
  const bg = style.backgroundColor;

  function luminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function parseRGB(str) {
    const m = str.match(/\d+/g);
    return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
  }

  const [r1, g1, b1] = parseRGB(color);
  const [r2, g2, b2] = parseRGB(bg);
  const l1 = luminance(r1, g1, b1);
  const l2 = luminance(r2, g2, b2);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  return JSON.stringify({
    foreground: color,
    background: bg,
    ratio: ratio.toFixed(2),
    passesAA_normal: ratio >= 4.5,
    passesAA_large: ratio >= 3,
    passesAAA_normal: ratio >= 7
  });
})()
```

**Thresholds** (WCAG 2.1 AA):
- Normal text (< 18pt or < 14pt bold): contrast ratio >= 4.5:1
- Large text (>= 18pt or >= 14pt bold): contrast ratio >= 3:1
- UI components and graphical objects: contrast ratio >= 3:1

### Keyboard Navigation Testing

Test that the page is fully operable via keyboard:

1. `navigate_page` to the target URL
2. Use `press_key` with `Tab` to move through interactive elements
3. After each Tab press, `take_snapshot` to check which element has focus
4. Verify:
   - **Focus order** follows a logical reading sequence (left-to-right, top-to-bottom)
   - **Focus indicators** are visible (element has a visible outline or highlight)
   - **No keyboard traps** -- pressing Tab always moves to the next element
   - **Interactive elements reachable** -- every button, link, and input receives focus
5. Test activation: `press_key` with `Enter` or `Space` on focused buttons/links
6. Test dismissal: `press_key` with `Escape` on modals/dropdowns

**Common keyboard failures**:
- Custom `<div>` or `<span>` buttons without `tabindex="0"` and `role="button"`
- Modal dialogs that don't trap focus inside or restore focus on close
- Dropdown menus that can't be navigated with arrow keys
- Skip-to-content link missing or not functional

### Common ARIA Anti-patterns

Flag these patterns in the accessibility snapshot:

| Anti-pattern | What to look for | Correct approach |
|-------------|-----------------|------------------|
| Redundant roles | `<button role="button">` | Omit role -- native elements have implicit roles |
| Role misuse | `<div role="button">` without keyboard handling | Use native `<button>` instead |
| Missing live regions | Dynamic content updates without `aria-live` | Add `aria-live="polite"` to container |
| Placeholder-only labels | `<input placeholder="Email">` with no `<label>` | Add visible `<label>` or `aria-label` |
| Generic link text | `<a>Click here</a>`, `<a>Read more</a>` | Descriptive text: `<a>Read the accessibility report</a>` |
| Presentational with children | `role="presentation"` on parent with interactive children | Remove role or restructure |
| Invalid ARIA attributes | `aria-checked` on non-checkbox elements | Match ARIA states to element role |

### Landmark Region Validation

Check that the page has proper landmark structure via `take_snapshot`:

**Required landmarks**:
- `main` -- exactly one per page (primary content area)
- `navigation` -- at least one (site navigation)
- `banner` -- page header (implicit on `<header>` when direct child of `<body>`)
- `contentinfo` -- page footer (implicit on `<footer>` when direct child of `<body>`)

**Validation rules**:
- All page content should be contained within a landmark region
- Multiple `navigation` landmarks must have unique `aria-label` values
- `main` landmark must not be nested inside other landmarks
- `banner` and `contentinfo` should be top-level (not nested)

**Tips**:
- Use verbose snapshot mode for detailed ARIA properties
- Compare snapshot against the WCAG 2.1 AA checklist above
- Screenshot specific elements for visual verification of contrast and focus indicators
- Run checks on multiple pages -- consistent navigation and landmark structure matters

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

**Full-page capture**: Use `fullPage` param. Note: very tall pages (e.g., Wikipedia articles) may return empty screenshot data due to an upstream MCP bug ([#571](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/571)). If the screenshot is empty, retry without `fullPage` to capture just the viewport.

**Device-specific screenshots**: Use `emulate` first to set viewport dimensions, then screenshot.

**Tips**:
- Wait for fonts, images, and animations to settle before capturing
- For pages with lazy loading, scroll to trigger content load first
- Use `resize_page` for custom viewport sizes without full device emulation
- If `take_screenshot` returns empty data or triggers a 400 error, retry: (1) without `fullPage`, (2) with `filePath` to save to disk, (3) with a smaller viewport via `resize_page`

**CRITICAL: Never use the Read tool on screenshot files.** Screenshots saved to disk via `filePath` can be very large (10+ MB for full-page captures). Reading them back into the conversation will crash the context or hit API image size limits. Instead, report the file path to the user and let them open it directly.

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
