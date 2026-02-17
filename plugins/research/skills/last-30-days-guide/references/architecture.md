# CLI Architecture

The `@side-quest/last-30-days` CLI is built like a 1920s news wire service. Multiple reporters (search APIs) are dispatched to different beats (Reddit, X). An editor (scoring pipeline) ranks stories by newsworthiness. A copy desk (deduplication) kills duplicates. The wire (render) sends the final dispatch.

## Pipeline

```
topic -> parseArgs -> getConfig -> selectModels
  |
  +-- searchReddit (OpenAI Responses API + web_search tool)  \
  |                                                            } Promise.allSettled
  +-- searchX (xAI Responses API + x_search tool)            /
  |
  +-- enrichReddit (sequential -- rate limiting)
  |     Fetches reddit.com/.json for each thread
  |     Extracts: real score, num_comments, upvote_ratio, created_utc
  |     Extracts: top 10 comments as single-sentence insights
  |
  +-- normalize (filter by date range, typed schema)
  +-- score (weighted: relevance + recency + engagement)
  +-- dedupe (Jaccard similarity on character trigrams, 70% threshold)
  +-- render (compact|json|md|context|path)
  |
  +-- stdout + disk files (~/.local/share/last-30-days/out/)
```

## Scoring Formula

### Three Components (0-100 each)

- **Relevance** (45% Reddit/X, 55% WebSearch): How on-topic. From the LLM.
- **Recency** (25% Reddit/X, 45% WebSearch): Linear decay over lookback window.
- **Engagement** (30% Reddit/X, 0% WebSearch): Community signals.

### Engagement Formulas

Reddit:
```
raw = 0.55 * log1p(score) + 0.40 * log1p(num_comments) + 0.05 * (upvote_ratio * 10)
```

X:
```
raw = 0.55 * log1p(likes) + 0.25 * log1p(reposts) + 0.15 * log1p(replies) + 0.05 * log1p(quotes)
```

`log1p()` compresses viral posts: `log1p(50000)` is ~10.8, `log1p(500)` is ~6.2. Scores normalized to 0-100 within each batch.

### Penalty System

| Penalty | Points | Condition |
|---------|--------|-----------|
| Unknown engagement | -10 | Enrichment failed |
| Low date confidence | -10 | Date unverifiable |
| Medium date confidence | -5 | Partially verified |
| WebSearch source | -15 | No engagement data |
| WebSearch no date | -20 | No date found |
| WebSearch verified date | +10 | Date in URL |

## Deduplication

Character trigrams with Jaccard similarity:
1. Normalize text (lowercase, strip punctuation)
2. Generate character 3-grams
3. Compare all pairs (O(n^2), fine for <100 items)
4. 70% overlap threshold = duplicate
5. Lower-scored item in each pair removed

## Model Auto-Selection

- **OpenAI**: Queries `/v1/models`, picks highest GPT-5.x mainline (filters mini/nano/preview/turbo)
- **xAI**: Alias-based, `latest` maps to `grok-4-1-fast`
- Both cached 7 days

## Key Design Principles

1. **Parallel where you can, sequential where you must** -- Reddit + X in parallel, enrichment sequential (rate limiting)
2. **Fail gracefully, report honestly** -- `Promise.allSettled`, not `Promise.all`. One source failure doesn't kill others.
3. **Separate discovery from verification** -- LLM discovers threads, real APIs verify engagement. `reddit.com/.json` doesn't hallucinate.
4. **Design for zero-config** -- No keys? Web-only mode. One key? Use what you've got.

## File Outputs

Every run writes to `~/.local/share/last-30-days/out/`:

| File | Purpose |
|------|---------|
| `report.json` | Full report (programmatic) |
| `report.md` | Full markdown (human-readable) |
| `last-30-days.context.md` | Compact context snippet |
| `raw_openai.json` | Raw API response (debug) |
| `raw_xai.json` | Raw API response (debug) |
| `raw_reddit_threads_enriched.json` | Enriched Reddit data (debug) |
