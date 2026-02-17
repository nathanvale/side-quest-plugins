# Gotchas and Known Issues

Known problems, limitations, and failure modes. Flag these proactively when relevant.

---

## Anti-Bot Limitations

Firecrawl **lacks** CAPTCHA solving, form filling, and authentication handling. Sites with sophisticated anti-bot measures may fail where custom Apify solutions succeed.

**What works**: Standard sites, documentation, blogs, most e-commerce
**What fails**: Sites behind login walls, heavy anti-bot (Cloudflare Turnstile, aggressive reCAPTCHA), form-gated content

## Self-Hosting Traps

The open-source version is **not production-ready**:

- Self-hosted endpoints behave differently from cloud versions
- Key features are **cloud-only**: proxy rotation, bot protection bypasses
- Missing `package.json` files in some dependency paths
- Community reports inconsistent behavior between local and cloud APIs

**Recommendation**: Use the cloud API unless you have a specific reason to self-host. If you must self-host, expect to invest significant effort in infrastructure.

## Rate Limits

- Lower-tier plans cap crawls at **50 pages max**
- This is problematic for large e-commerce catalogs or deep documentation sites
- Plan tier selection matters for crawl-heavy workloads

## Pricing Confusion

Firecrawl has a **dual pricing structure** that catches people off guard:

1. **Scraping credits** -- monthly allocation for scrape/crawl/search/map operations
2. **AI extraction tokens** -- separate subscription ($89/month minimum) for `/extract` and `/agent` endpoints

These are **not interchangeable**. Scraping credits do not cover AI extraction. Budget accordingly.

## Known GitHub Issues

| Issue | Status | Description |
|-------|--------|-------------|
| [#1679](https://github.com/mendableai/firecrawl/issues/1679) | Open | Crawls stuck with "scraping" status |
| [#884](https://github.com/mendableai/firecrawl/issues/884) | Open | "All scraping engines failed!" errors |
| [#2017](https://github.com/firecrawl/firecrawl/issues/2017) | Open | Breaking changes in API (ScrapeOptions class removed) |

## Missing Features

Features Firecrawl does **not** have:

- No form filling or authentication handling
- No CAPTCHA solving
- No native workflow automation (use external tools like n8n)
- No built-in dataset storage or scheduling
- No pre-built solutions marketplace (unlike Apify's 6,000+ scrapers)

## Scaling Issues

The Firecrawl team has been transparent about scaling challenges:

- Experienced "hug of death" as platform grew
- Fly.io doesn't support smooth autoscaling -- migrating to Kubernetes
- BullMQ has API quirks: don't call `Job.moveToCompleted` or `Job.moveToFailed` with 3rd argument not set to `false`

## Agent Result Expiry

**/agent results expire after 24 hours.** Always consume or persist results immediately. Do not rely on being able to retrieve agent results later.

## Breaking API Changes

The SDK has had breaking changes (ScrapeOptions class removal). Pin SDK versions in production and test before upgrading:

```json
{
  "dependencies": {
    "@mendable/firecrawl-js": "1.2.3"
  }
}
```

## CLI Beta Maturity

The Firecrawl CLI (released Jan 2026) is still early:

- Beta-stage quirks expected
- Community has flagged promotional content concerns (signal-to-noise ratio developing)
- Anti-bot defeats reported in agent workflows
- Breaking changes likely as the tool matures

**Recommendation**: Use for development and agent prototyping. For production scraping at scale, prefer the API with pinned SDK versions.
