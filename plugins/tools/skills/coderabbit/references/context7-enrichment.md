# Context7 Enrichment Reference

How to cross-reference CodeRabbit findings with official library documentation
using the Context7 MCP server.

## When to Enrich

During `--fix` or `--preflight` mode, if a CodeRabbit finding mentions:

- A specific library API (e.g., "use `fetch` with AbortController")
- A deprecation concern (e.g., "this API was deprecated in v3")
- A version-specific behavior (e.g., "changed in Node 22")
- A framework pattern (e.g., "React useEffect cleanup")

Then pull official docs via Context7 to validate the suggestion before applying.

## How It Works

### Step 1: Extract library name from finding

Parse the CodeRabbit finding description for library/package references:
- Import statements in the affected code (`import { X } from 'library'`)
- Package names mentioned in the finding text
- Framework-specific patterns (React hooks, Bun APIs, etc.)

### Step 2: Resolve library ID

```
mcp__context7__resolve-library-id({
  libraryName: "bun",
  query: "Bun.spawnSync subprocess testing"
})
```

Returns a Context7-compatible library ID like `/oven-sh/bun`.

### Step 3: Query docs

```
mcp__context7__query-docs({
  libraryId: "/oven-sh/bun",
  query: "spawnSync options timeout signal handling"
})
```

Returns official documentation snippets with code examples.

### Step 4: Validate finding

Compare CodeRabbit's suggestion against the official docs:

- **Confirmed**: docs agree with the suggestion. Apply the fix with confidence.
- **Contradicted**: docs show a different pattern. Skip the fix and note the discrepancy.
- **Inconclusive**: docs don't cover this specific case. Apply with caution or skip.

## Integration Points

### In --fix mode

When presenting each finding to the user via AskUserQuestion, include the
Context7 validation result:

```
## Finding: Use AbortController for fetch timeout (file.ts:42)

CodeRabbit suggests adding AbortController to the fetch call.

Context7 validation (Bun docs):
  Bun's native fetch supports AbortSignal natively since v1.0.
  Official pattern: `fetch(url, { signal: AbortSignal.timeout(5000) })`

Recommendation: Fix it now (confirmed by official docs)
```

### In --preflight mode

Context7 validation runs silently. Only flag if the docs contradict the
suggestion (which would cause the preflight to skip the fix).

## Rate Limiting

Context7 calls are fast (milliseconds) and don't have aggressive rate limits.
However, limit to 3 Context7 lookups per review session to avoid bloating
context. Prioritize Critical and Important findings for enrichment.

## Prerequisites

Context7 MCP server must be enabled in Claude Code settings. Check:
- Not in `disabledMcpjsonServers` in `~/.claude/settings.json`
- Permissions whitelisted in `settings.local.json`

If Context7 is unavailable, skip enrichment silently -- it's an enhancement,
not a requirement.
