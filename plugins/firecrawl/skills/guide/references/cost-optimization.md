# Cost Optimization

Pricing structure, credit management, caching, model selection, and budget guardrails.

---

## Pricing Structure

Firecrawl uses **dual pricing** -- understand both before committing:

### Scraping Credits (Monthly)

Used by: `/scrape`, `/search`, `/crawl`, `/map`

| Plan | Price | Credits/Month | Max Crawl Pages |
|------|-------|--------------|----------------|
| Free | $0 | 500 | 50 |
| Hobby | $16/mo | 3,000 | 50 |
| Standard | $83/mo | 100,000 | 500 |
| Growth | $333/mo | 500,000 | 10,000 |

### AI Extraction Tokens (Separate)

Used by: `/extract`, `/agent`

- **Minimum**: $89/month for AI extraction access
- **Not covered** by scraping credits -- separate budget line
- 5 free `/agent` runs per day (good for testing)

### The Trap

Most users discover the dual pricing after signing up for scraping credits and trying `/extract` or `/agent`. Budget for both from the start if you need AI extraction.

## Token Efficiency via CLI

The CLI's filesystem-based output is a cost multiplier:

- Clean Markdown output cuts token requirements by ~2/3 vs raw HTML
- Community reports this enables **model downgrading** -- using cheaper models (e.g., Haiku instead of Sonnet) because Firecrawl's clean output is good enough
- Filesystem-first means agents read only what they need from disk, not the full page in context

This is the cost story most people miss: the savings aren't just in Firecrawl credits, they're in downstream LLM token costs.

## Caching with maxAge

Set `maxAge` on scrape requests to cache results:

```typescript
const result = await firecrawl.scrapeUrl('https://example.com', {
  formats: ['markdown'],
  maxAge: 3600, // Cache for 1 hour
});
```

Community reports ~5x speedup on repeat scrapes. Use for:
- Pages that don't change frequently
- Development/testing iterations
- Multi-agent workflows where agents may hit the same URLs

## Model Selection

| Model | Relative Cost | When |
|-------|--------------|------|
| `spark-1-mini` | 1x (default) | Simple extractions, single-page, straightforward |
| `spark-1-pro` | ~2.5x | Complex multi-domain, multi-step reasoning |

`spark-1-mini` handles 80%+ of use cases. Only upgrade when extraction quality visibly suffers.

## Budget Guardrails

### Per-Agent maxCredits

Always set `maxCredits` on `/agent` calls:

```typescript
const result = await firecrawl.agent({
  prompt: 'Research topic X',
  model: 'spark-1-mini',
  maxCredits: 50,
});
```

Without this, a runaway agent can burn through your entire credit allocation.

### Prompt Specificity

Vague prompts waste credits. Compare:

- **Bad**: "Find information about this company" (agent wanders, follows many links)
- **Good**: "Find the pricing page for company X and extract the enterprise plan price" (focused, fewer steps)

Specific prompts = fewer agent steps = lower cost.

## Cost Reduction Checklist

1. Default to `spark-1-mini` unless extraction quality requires `spark-1-pro`
2. Set `maxCredits` on every `/agent` call
3. Use `maxAge` caching for repeat scrapes
4. Write specific prompts -- vague = expensive
5. Use `/scrape` + Zod schema extraction instead of `/agent` when you know the target URL
6. Use `/map` to discover URLs before crawling (cheaper than blind crawling)
7. Use CLI filesystem output to reduce downstream LLM token costs
8. Consider model downgrading when Firecrawl provides clean enough output
9. Monitor credit usage in the Firecrawl dashboard
