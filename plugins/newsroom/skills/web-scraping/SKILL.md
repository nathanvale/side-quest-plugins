---
name: web-scraping
description: >
  Web scraping guide for sub-agents. Covers Firecrawl CLI fallback scraping
  when WebFetch fails (JS-heavy sites, anti-bot walls, 403 errors, empty
  content) and advanced capabilities like structured data extraction with Zod
  schemas, multi-page crawls, and search-plus-scrape. Use when WebFetch
  returns garbage or empty pages, when you need typed data from a page
  (prices, features, specs), or when you need to ingest multiple pages from
  a site.
user-invocable: false
---

# Web Scraping Field Card

**Required tools for consuming agents**: WebFetch, Bash(bunx firecrawl-cli *), Read

**Integration**: Any newsroom sub-agent should consult this skill when WebFetch fails or when structured/multi-page scraping is needed.

## What Do You Need?

| Need | Tool | Details |
|------|------|---------|
| Page content as markdown | WebFetch first, then Firecrawl CLI | See below |
| Structured data from a page (prices, features, specs) | Firecrawl extract | Read [references/structured-extraction.md](references/structured-extraction.md) |
| Multiple pages from one site | Firecrawl crawl | Read [references/crawling.md](references/crawling.md) |
| Search the web + scrape results | Firecrawl search | Read [references/crawling.md](references/crawling.md) |

## Getting Page Content

### Step 1: Try WebFetch First

WebFetch is free, fast, and already available. Use it by default.

Works for: blogs, news articles, documentation, static pages, most forum threads.

### Step 2: Recognize Failure

Switch to Firecrawl CLI when WebFetch returns:
- Empty or near-empty content (page requires JavaScript rendering)
- 403/429 errors (anti-bot protection)
- Mangled HTML with no useful text (client-side rendered SPA)
- Login walls or cookie consent overlays blocking content

Do NOT retry WebFetch on the same URL -- it will fail again.

### Step 3: Firecrawl CLI Scrape

Requires: `firecrawl-cli` (install: `npm install -g firecrawl-cli` or use via `bunx firecrawl-cli`). Authenticates via `FIRECRAWL_API_KEY` env var or `firecrawl auth --api-key <key>`.

**If firecrawl-cli is not installed or FIRECRAWL_API_KEY is unset**, skip to Step 4 (Report Gaps). Do not retry or attempt workarounds.

**Output to stdout** (default -- pipe or capture as needed):

```bash
bunx firecrawl-cli scrape "<url>"
```

**Output to file** (more token-efficient -- read from disk instead of context):

```bash
bunx firecrawl-cli scrape "<url>" -o /tmp/scrape-output.md
```

Then use the Read tool on `/tmp/scrape-output.md` to pull only what you need into context.

Handles: JS rendering, dynamic content, basic anti-bot bypass, clean Markdown output (strips nav, headers, footers with `--only-main-content`).

Does NOT handle: login-gated content, CAPTCHAs, form filling, aggressive Cloudflare Turnstile.

For multiple URLs, scrape each separately to different files:

```bash
bunx firecrawl-cli scrape "<url1>" -o /tmp/scrape-1.md
bunx firecrawl-cli scrape "<url2>" -o /tmp/scrape-2.md
```

The CLI is beta (released Jan 2026) -- expect quirks and flag changes. Run `bunx firecrawl-cli scrape --help` for current options.

### Step 4: Report Gaps Honestly

If both WebFetch and Firecrawl fail:
- Note which URL was inaccessible and why
- Do not fabricate content or silently skip the source
- Move on to other sources
