# Core API Reference

Firecrawl's 6 endpoints with TypeScript/Zod examples.

---

## Setup

```typescript
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
```

## Endpoints Overview

| Endpoint | Purpose | Key Parameters |
|----------|---------|---------------|
| `/v1/scrape` | Single page to clean Markdown/JSON | `url`, `formats`, `actions`, `waitFor`, `timeout` |
| `/v1/search` | Search + scrape top results | `query`, `limit`, `lang`, `country` |
| `/v1/crawl` | Multi-page site crawl | `url`, `limit`, `includePaths`, `excludePaths` |
| `/v1/map` | Discover all URLs on a site | `url`, `limit` |
| `/v1/extract` | Structured data extraction via LLM | `urls`, `prompt`, `schema` |
| `/v1/agent` | AI-powered multi-step research | `prompt`, `model`, `maxCredits` |

## Scrape Endpoint

The workhorse. Converts a single URL to clean Markdown or structured JSON.

### Key Parameters

- `formats`: Array of output formats. Options: `markdown`, `html`, `rawHtml`, `links`, `screenshot`, `extract`
- `onlyMainContent`: Default `true`. Set `false` for full page markup
- `includeTags` / `excludeTags`: Arrays for surgical element targeting
- `waitFor`: Milliseconds to wait beyond built-in detection (for dynamic content)
- `timeout`: Default 30s. Increase for slow-loading pages
- `maxAge`: Cache duration in seconds. Enables ~5x speedup on repeat scrapes

### Basic Scrape

```typescript
const result = await firecrawl.scrapeUrl('https://example.com', {
  formats: ['markdown'],
  onlyMainContent: true,
});

console.log(result.markdown);
```

### Browser Automation via `actions`

The `actions` parameter enables browser interaction before scraping:

```typescript
const result = await firecrawl.scrapeUrl('https://example.com', {
  formats: ['markdown'],
  actions: [
    { type: 'wait', milliseconds: 2000 },
    { type: 'click', selector: '#load-more' },
    { type: 'scroll', direction: 'down', amount: 3 },
    { type: 'type', selector: '#search', text: 'query' },
    { type: 'execute_javascript', code: 'window.scrollTo(0, 0)' },
    { type: 'screenshot' },
  ],
});
```

Available action types: `wait`, `click`, `scroll`, `type`, `execute_javascript`, `screenshot`.

### Structured Extraction with Zod

Define a Zod schema for one-pass structured extraction:

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const ProductSchema = z.object({
  title: z.string(),
  price: z.number(),
  description: z.string(),
});

const result = await firecrawl.scrapeUrl('https://example.com/product', {
  formats: ['extract'],
  extract: {
    schema: zodToJsonSchema(ProductSchema),
  },
});

const product = ProductSchema.parse(result.extract);
```

This is more efficient than scraping Markdown and post-processing. Community best practice: always define Zod schemas upfront.

## Search Endpoint

Searches the web and returns scraped results for top hits.

```typescript
const results = await firecrawl.search('firecrawl web scraping', {
  limit: 5,
  lang: 'en',
  country: 'us',
});

for (const result of results.data) {
  console.log(result.url, result.title, result.markdown);
}
```

## Crawl Endpoint

Multi-page crawl with path filtering.

```typescript
const crawl = await firecrawl.crawlUrl('https://docs.example.com', {
  limit: 100,
  includePaths: ['/docs/*'],
  excludePaths: ['/blog/*'],
  maxDepth: 3,
});
```

**Async by default**: Returns a job ID. Poll for completion or use webhooks.

- Lower-tier plans cap at 50 pages max
- Supports regex path filtering for domain exploration
- Per-page delays configurable to avoid rate limiting targets

## Map Endpoint

Discovers all URLs on a site without scraping content. Fast way to understand site structure before crawling.

```typescript
const map = await firecrawl.mapUrl('https://example.com', {
  limit: 1000,
});

console.log(map.links); // string[]
```

Returns an array of discovered URLs. Use this to plan targeted crawls.

## Extract Endpoint

LLM-powered structured extraction from one or more URLs.

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const ListingSchema = z.object({
  product: z.string(),
  price: z.number(),
  available: z.boolean(),
});

const result = await firecrawl.extract({
  urls: ['https://example.com/page1', 'https://example.com/page2'],
  prompt: 'Extract the product name, price, and availability',
  schema: zodToJsonSchema(ListingSchema),
});
```

Uses natural language prompts -- eliminates custom parser coding. Runs on separate AI extraction token budget (not scraping credits).

## Agent Endpoint

AI-powered multi-step research. The agent reads pages, reasons about what to do next, and follows links.

```typescript
const result = await firecrawl.agent({
  prompt: 'Find the pricing for Firecrawl enterprise plan',
  model: 'spark-1-mini',
  maxCredits: 50,
});
```

See [agent-patterns.md](agent-patterns.md) for detailed integration guidance.

## Output Quality

Firecrawl's key DX advantage: auto-strips boilerplate, returns clean Markdown/JSON. Community reports ~2/3 token consumption reduction compared to raw HTML.

## Whitelisting Requirements

If scraping your own sites, whitelist:
- **User agent**: `FirecrawlAgent`
- **IP**: `35.245.250.27`
