# Chrome DevTools Examples

Copy-paste any prompt below to try it. All examples work out of the box with default settings.

## 1. Screenshot a URL

Take a screenshot of any URL.

```
/chrome-devtools:screenshot https://example.com
```

## 2. Full-Page Screenshot

Capture an entire scrollable page, not just the viewport.

```
/chrome-devtools:screenshot https://en.wikipedia.org/wiki/Melbourne --full-page
```

## 3. Mobile Screenshot

Screenshot a page as it appears on a mobile device.

```
/chrome-devtools:screenshot https://example.com --device "iPhone 14"
```

## 4. Accessibility Audit

Run a WCAG 2.1 AA accessibility audit with specific checks.

```
/chrome-devtools:automate Run a WCAG 2.1 AA accessibility audit on https://example.com -- check headings, landmarks, alt text, and keyboard navigation
```

## 5. Performance Trace

Capture a Chrome performance trace and analyze Core Web Vitals.

```
/chrome-devtools:automate Run a performance trace on https://example.com and report Core Web Vitals (LCP, CLS, INP, TBT)
```

## 6. Fill a Form

Navigate to a form, fill all fields with sample data, and submit.

```
/chrome-devtools:automate Go to https://httpbin.org/forms/post and fill in the form with sample data, then submit it
```

## 7. Click and Verify

Click an element and confirm the expected state change.

```
/chrome-devtools:automate Go to https://example.com and click the "More information..." link, then verify the navigation succeeded
```

## 8. Extract Data

Scrape structured data from a page using the accessibility tree.

```
/chrome-devtools:automate Go to https://news.ycombinator.com and extract the top 10 story titles and their URLs
```

## 9. Monitor Network Requests

Capture and filter network activity during page load.

```
/chrome-devtools:automate Navigate to https://jsonplaceholder.typicode.com/posts and list all XHR/fetch network requests made during page load
```

## 10. Fix Connection

Diagnose and fix Chrome DevTools MCP connection issues interactively.

```
/chrome-devtools:fix
```
