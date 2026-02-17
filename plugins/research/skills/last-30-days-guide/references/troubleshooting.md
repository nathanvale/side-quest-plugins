# Troubleshooting

Common issues with the `@side-quest/last-30-days` CLI and how to fix them.

## API Key Issues

### "No API keys found"

The CLI checks (in order):
1. Environment variables: `OPENAI_API_KEY`, `XAI_API_KEY`
2. Config file: `~/.config/last-30-days/.env`

```bash
# Verify keys exist
cat ~/.config/last-30-days/.env

# Verify env vars
echo $OPENAI_API_KEY
echo $XAI_API_KEY
```

If neither location has keys, the CLI falls back to web-only mode (prints WebSearch instructions).

### "Mode: web-only" when keys are set

Check the config file format -- must be `KEY=value` with no quotes around the value:
```
OPENAI_API_KEY=sk-proj-abc123
XAI_API_KEY=xai-abc123
```

NOT:
```
OPENAI_API_KEY="sk-proj-abc123"  # quotes break parsing
```

## Rate Limiting

### OpenAI rate limit (429)

The CLI has built-in retry (3 attempts with exponential backoff: 1s, 2s, 3s). On transient rate limits, it falls back to stale cache if available.

Non-retryable 429 (quota/billing limit): Check your OpenAI billing at https://platform.openai.com/account/billing

### Reddit rate limiting

Reddit's JSON API rate limits sequential enrichment. The CLI already handles this by processing threads one at a time. If enrichment fails for a thread, the item gets a lower engagement score but is still included.

## Result Quality Issues

### Few results (<5 items)

The CLI auto-retries with a simplified query (strips modifiers like "best", "top", "latest"). This is normal for niche topics. The output includes a data freshness warning if <5 items are confirmed in the target date range.

### Stale results

Default cache TTL is 24 hours. Use `--refresh` to bypass cache reads, or `--no-cache` to disable caching entirely.

### "LIMITED RECENT DATA" warning

The CLI found <5 items confirmed from the target date range. Results may include older or evergreen content. Try:
- Broadening the topic
- Increasing `--days=90`
- Using `--deep` for more sources

## Connection Issues

### Timeout

Default timeout: 30s for most calls, 90-180s for search calls depending on depth.

Debug: `LAST_30_DAYS_DEBUG=1 bunx --bun @side-quest/last-30-days "topic"` to see every HTTP request.

### bunx cache corruption

If the CLI fails to start with module resolution errors:
```bash
rm -rf /private/var/folders/_b/*/T/bunx-501-@side-quest/
```
Then retry. This clears Bun's package cache.

## Debug Mode

Enable verbose logging:
```bash
bunx --bun @side-quest/last-30-days "topic" --debug
# or
LAST_30_DAYS_DEBUG=1 bunx --bun @side-quest/last-30-days "topic"
```

Logs to stderr: every HTTP request URL, payload keys, response status, and error bodies.
