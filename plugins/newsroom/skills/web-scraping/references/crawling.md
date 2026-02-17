# Crawling and Search

Multi-page scraping and search-plus-scrape capabilities via Firecrawl CLI and API.

## Multi-Page Crawl

Ingest multiple pages from a single site. Use when you need to understand an entire doc site, changelog, or product catalog.

### CLI

```bash
bunx firecrawl-cli crawl "<url>" --limit 20
```

Output goes to stdout by default. Use `-o <path>` to save to a file. The CLI is beta (released Jan 2026) -- run `bunx firecrawl-cli crawl --help` for current flags.

### API

```typescript
const crawl = await firecrawl.crawlUrl('https://docs.example.com', {
  limit: 50,
  includePaths: ['/docs/*'],
  excludePaths: ['/blog/*'],
  maxDepth: 3,
});
```

Crawl is async -- returns a job ID. Poll for completion.

### When to Use

- Ingesting documentation sites for deep research
- Mapping product catalogs for comparison
- Collecting release notes or changelogs across versions

### Limits

- Lower-tier plans cap crawls at 50 pages
- Per-page delays configurable to avoid rate limiting targets
- Large crawls consume credits fast -- set limits explicitly

## URL Discovery (Map)

Discover all URLs on a site without scraping content. Use to plan targeted crawls.

```typescript
const map = await firecrawl.mapUrl('https://example.com', {
  limit: 1000,
});

// map.links is a string[] of discovered URLs
// Use this to select which pages to actually scrape
```

Cheaper than blind crawling -- discover first, then scrape only what matters.

## Search + Scrape

Search the web and get scraped results for top hits in one call.

```typescript
const results = await firecrawl.search('topic of interest', {
  limit: 5,
  lang: 'en',
  country: 'au',
});

for (const result of results.data) {
  console.log(result.url, result.title, result.markdown);
}
```

### When to Use Over WebSearch

- WebSearch gives you URLs -- you still need to fetch each one
- Firecrawl search gives you URLs AND scraped markdown in one call
- More efficient when you know you'll need the page content

### When to Stick with WebSearch

- Quick recon where you just need URLs and snippets
- Free (no Firecrawl credits consumed)
- Already available without API keys

## Cost Awareness

- Crawls consume one credit per page scraped
- Use `map` first to estimate crawl size before committing credits
- Set explicit `limit` and `maxDepth` to prevent runaway crawls
- Cache with `maxAge` (seconds) on repeat scrapes for ~5x speedup
