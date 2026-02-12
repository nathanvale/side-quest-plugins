# Debugging Workflows

Structured debugging workflows using Chrome DevTools MCP tools for console errors, network failures, and closed-loop fix cycles.

---

## Console Error Debugging

Diagnose and resolve JavaScript errors and warnings surfaced in the browser console.

1. `navigate_page` to the target URL
2. Interact with the page to reproduce the issue (click, fill forms, navigate)
3. `list_console_messages` -- enumerate all console output
4. Filter for `error` and `warning` level messages -- these are the signals
5. `get_console_message` on each error -- retrieve the full stack trace and message detail
6. Analyze the stack trace to identify the source file, line number, and call chain
7. `evaluate_script` to inspect live application state:
   - Check variable values: `JSON.stringify(window.__APP_STATE__)`
   - Test DOM state: `document.querySelectorAll('.error').length`
   - Verify API responses: `JSON.stringify(performance.getEntriesByType('resource').filter(r => r.initiatorType === 'fetch').map(r => ({ name: r.name, duration: r.duration })))`
8. Suggest a fix based on the diagnosis

**Common console error patterns**:

| Error Pattern | Likely Cause | Investigation |
|---------------|-------------|---------------|
| `TypeError: Cannot read properties of undefined` | Accessing nested object before data loads | Check async data flow, look for missing null checks |
| `CORS policy` errors | Backend missing Access-Control headers | Inspect the failing request with `get_network_request` |
| `404` for script/asset | Wrong path or missing build artifact | Check `list_network_requests` with `resourceTypes: ["script"]` |
| `Uncaught (in promise)` | Unhandled promise rejection | Look for missing `.catch()` or try/catch blocks |
| `CSP violation` | Content Security Policy blocking inline scripts or external resources | Check CSP headers via `get_network_request` on the document |

**Tips**:
- Console messages accumulate over time -- reproduce the issue on a fresh navigation for cleaner output
- Use `pageIdx`/`pageSize` on `list_console_messages` if there are hundreds of entries
- Pair console errors with network request analysis for a complete picture

---

## Network Request Debugging

Diagnose failed API calls, CORS issues, authentication errors, and payload problems.

1. `navigate_page` to the target URL
2. Interact with the page to trigger the failing request
3. `list_network_requests` with `resourceTypes: ["xhr", "fetch"]` -- isolate API calls from static assets
4. Identify failed requests by status code (4xx, 5xx) or by missing expected requests
5. `get_network_request` on the failing request -- inspect:
   - **Request**: method, URL, headers (especially Authorization, Content-Type), body
   - **Response**: status code, headers (especially CORS headers), body
   - **Timing**: DNS, connection, TTFB, download duration

**Diagnosing by status code**:

| Status | Common Cause | What to Check |
|--------|-------------|---------------|
| 400 Bad Request | Malformed payload | Request body shape, Content-Type header |
| 401 Unauthorized | Missing or expired token | Authorization header, token expiry |
| 403 Forbidden | Insufficient permissions | User role, CORS preflight response |
| 404 Not Found | Wrong endpoint URL | API base URL, path params |
| 405 Method Not Allowed | Wrong HTTP method | POST vs PUT vs PATCH |
| 422 Unprocessable | Validation failure | Response body for field-level errors |
| 500 Internal Server | Backend crash | Response body for error details |

**CORS debugging**:
1. Look for a preflight `OPTIONS` request preceding the failed request
2. Check the response headers on the preflight:
   - `Access-Control-Allow-Origin` -- must match the page origin or be `*`
   - `Access-Control-Allow-Methods` -- must include the request method
   - `Access-Control-Allow-Headers` -- must include custom headers (e.g., Authorization)
3. If no preflight exists, the browser treated it as a simple request -- check `Access-Control-Allow-Origin` on the main response

**Tips**:
- Use `filePath` param on `get_network_request` for large response bodies (JSON APIs returning megabytes of data)
- Filter by `resourceTypes` to avoid wading through hundreds of image/font/stylesheet requests
- Check `list_network_requests` timing data to identify slow backend responses vs network latency

---

## Closed-Loop Debug-Fix Cycle

A full reproduce-analyze-fix-verify loop for interactive debugging.

### The Loop

```
Navigate -> Reproduce -> Analyze -> Hypothesize -> Test -> Verify
    ^                                                        |
    +--------------------------------------------------------+
    (repeat until fixed)
```

### Step-by-step

1. **Navigate**: `navigate_page` to the target URL
2. **Reproduce**: Perform the exact steps that trigger the bug (click, fill, submit)
3. **Analyze**: Gather evidence from multiple sources:
   - `list_console_messages` -- JavaScript errors and warnings
   - `list_network_requests` with `resourceTypes: ["xhr", "fetch"]` -- API failures
   - `take_snapshot` -- current DOM/accessibility state
4. **Hypothesize**: Based on the evidence, form a theory about the root cause
5. **Test**: Use `evaluate_script` to validate the hypothesis:
   - Inspect application state
   - Check DOM element properties
   - Test a potential fix in-browser (e.g., patching a function, setting a value)
6. **Verify**: `take_screenshot` to confirm the fix visually, plus re-check console and network for clean output

### Example: Form Submission Bug

```
1. navigate_page -> "https://app.example.com/settings"
2. take_snapshot -> find the form fields
3. fill -> populate fields, click submit
4. list_console_messages -> "TypeError: Cannot read properties of undefined (reading 'email')"
5. get_console_message -> stack trace points to validateForm() line 42
6. evaluate_script -> "JSON.stringify(document.querySelector('form').elements.email.value)"
   -> reveals the email field has name="user-email" not name="email"
7. Report: form field name mismatch, validateForm() expects 'email' but field is 'user-email'
```

**Tips**:
- Always start with a fresh navigation to avoid stale state from previous debugging
- Capture a screenshot at each stage for a visual record of the debugging journey
- Use `evaluate_script` conservatively -- avoid modifying production state accidentally
- If the bug is intermittent, reproduce multiple times and compare console/network output across attempts
