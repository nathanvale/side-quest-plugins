---
name: last-30-days-guide
description: >
  Expert knowledge for the @side-quest/last-30-days CLI tool. Covers flags,
  output formats, API key setup, scoring algorithm, caching, and
  troubleshooting. Use when calling the CLI, diagnosing research failures,
  understanding engagement scoring, or configuring API keys.
user-invocable: false
---

# last-30-days CLI Guide

Expert reference for `@side-quest/last-30-days` -- a CLI that researches any topic across Reddit and X with engagement-ranked, deduplicated results.

## Quick Reference

```bash
bunx --bun @side-quest/last-30-days "<topic>" [options]
```

### Flags

| Flag | Description |
|------|-------------|
| `--emit=MODE` | Output format: `compact` (default), `json`, `md`, `context`, `path` |
| `--sources=MODE` | Source selection: `auto` (default), `reddit`, `x`, `both` |
| `--days=N` | Lookback window in days (default: 30, range: 1-365) |
| `--quick` | Faster, fewer results |
| `--deep` | Comprehensive, more results |
| `--include-web` | Add web search instructions to output |
| `--outdir=PATH` | Write output files to custom directory (default: `~/.local/share/last-30-days/out/`). Creates dir if needed. Use for parallel-safe invocations. |
| `--refresh` | Bypass cache, force fresh search |
| `--no-cache` | Disable cache reads and writes |
| `--debug` | Verbose logging to stderr |

### Output Formats

| Mode | Use Case |
|------|----------|
| `compact` | Markdown summary for Claude to synthesize (default) |
| `json` | Full structured report for programmatic use |
| `md` | Full human-readable markdown report |
| `context` | Reusable context snippet for embedding |
| `path` | Prints path to context file on disk |

For sub-agent research tasks, use `--emit=compact`. For programmatic consumption, use `--emit=json`.

## How It Works

For detailed architecture, scoring, and design decisions, read [references/architecture.md](references/architecture.md).

**Pipeline summary:**
1. Parse topic and flags
2. Load API keys from env or `~/.config/last-30-days/.env`
3. Auto-select best available models (OpenAI GPT-5.x, xAI grok-4)
4. Search Reddit + X in parallel (`Promise.allSettled`)
5. Enrich Reddit threads sequentially (real engagement from reddit.com JSON API)
6. Normalize, score, deduplicate
7. Render output in requested format

### Modes

| Keys Available | Mode | What Happens |
|---------------|------|-------------|
| Both (OPENAI + XAI) | `both` | Full pipeline -- Reddit + X with engagement |
| OPENAI only | `reddit` | Reddit threads with enrichment, no X |
| XAI only | `x` | X posts, no Reddit |
| Neither | `web` | Prints WebSearch instructions for Claude to execute |

With `--include-web`, adds web search instructions to any mode.

## API Key Setup

Keys loaded from environment variables or `~/.config/last-30-days/.env`:

```bash
mkdir -p ~/.config/last-30-days
cat > ~/.config/last-30-days/.env << 'EOF'
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
EOF
chmod 600 ~/.config/last-30-days/.env
```

The tool works without any keys (web-only mode). Each key unlocks a source.

## Troubleshooting

For detailed error patterns, read [references/troubleshooting.md](references/troubleshooting.md).

### Quick Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| "No API keys found" | Missing config | Create `~/.config/last-30-days/.env` |
| Rate limit errors | API quota exceeded | Wait and retry, or use `--refresh` with stale cache fallback |
| Few results (<5 items) | CLI auto-retries with simplified query | Normal behavior -- check if topic is too niche |
| "Mode: web-only" | No API keys configured | Add OPENAI_API_KEY and/or XAI_API_KEY |
| Stale results | Serving from 24h cache | Use `--refresh` flag |
| Timeout | API slow or unresponsive | Use `--debug` to trace, check network |

## Caching

File-based at `~/.cache/last-30-days/`:

| Type | TTL | Key |
|------|-----|-----|
| Search results | 24 hours | SHA256(topic + dates + sources + model + prompt version) |
| Reddit enrichment | 24 hours | SHA256(thread URL) |
| Model selection | 7 days | Provider name |

Cache is silent on failure -- if unwritable, fetches fresh data. Use `--refresh` to bypass reads, `--no-cache` to disable entirely.

## Output Structure (JSON)

When using `--emit=json`, the report contains:

```
{
  topic, range: { from, to }, mode, days,
  reddit: [{ title, url, subreddit, date, score, num_comments,
             upvote_ratio, comment_insights[], why_relevant }],
  x: [{ text, url, author_handle, date, likes, reposts,
         replies, quotes, why_relevant }],
  reddit_error, x_error, from_cache, cache_age_hours,
  openai_model_used, xai_model_used,
  context_snippet_md
}
```

## Scoring Algorithm

Every item gets three sub-scores (0-100), weighted:

| Component | Reddit/X Weight | WebSearch Weight |
|-----------|----------------|-----------------|
| Relevance | 45% | 55% |
| Recency | 25% | 45% |
| Engagement | 30% | 0% (no engagement data) |

WebSearch items get -15 source penalty. Engagement uses `log1p()` compression so viral posts don't dominate. See [references/architecture.md](references/architecture.md) for the full formula.
