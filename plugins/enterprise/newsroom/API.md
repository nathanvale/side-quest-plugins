# Newsroom Plugin - API Reference

**Plugin Path:** `plugins/newsroom`

## Overview

The Newsroom plugin provides a 1920s-themed research orchestration system for gathering engagement-ranked community intelligence across Reddit, X (Twitter), and the web. It features Mickey "The Desk" Malone, a grizzled city editor who dispatches Beat Reporters to investigate topics, synthesize findings, and present evening editions with real engagement metrics.

---

## Commands

### `/newsroom:investigate`

Walk into Mickey Malone's newsroom and hand him a story to chase. Mickey confirms the angle in character, then sends his Beat Reporters across Reddit, X, and the web. Publishes an evening edition with synthesized findings.

**Signature:**
```
/newsroom:investigate "[topic(s)]" [flags]
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `topic` | string | Topic to research (positional argument or via `--topic` flag) |
| `--topic "..."` | string[] | Repeatable flag for multiple topics (allows topics with commas) |
| `--quick` | boolean | Faster, fewer sources |
| `--deep` | boolean | Comprehensive, more sources |
| `--reddit` | boolean | Reddit only |
| `--x` | boolean | X only |
| `--both` | boolean | Force both platforms |
| `--days N` | number | Lookback window (1-365, default: 30) |
| `--refresh` | boolean | Bypass cache |
| `--format TYPE` | string | Override query type: `recommendations`, `news`, `prompting`, `general` |
| `--plain` | boolean | Neutral voice (no Mickey Malone character) |
| `--mode MODE` | string | Research mode: `recon` (default), `changes`, `sentiment`, `verify` |
| `--wire ROOM` | string | File findings to target room: `kitchen`, `garden`, `dojo`, `broadcast` |

**Modes:**

| Mode | Description |
|------|-------------|
| `recon` | Standard research (default) |
| `changes` | Delta-focused - what's new since last check |
| `sentiment` | Community sentiment deep-dive |
| `verify "claim"` | Fact-check a specific claim |

**Examples:**
```bash
/newsroom:investigate "Claude Code MCP tools"
/newsroom:investigate "Home Assistant" --quick
/newsroom:investigate "best terminal emulator" --deep --reddit
/newsroom:investigate --topic "React Server Components" --topic "Next.js App Router"
/newsroom:investigate "Claude Code" --mode changes
/newsroom:investigate "MCP protocol changes" --wire kitchen
/newsroom:investigate "local LLMs on Apple Silicon" --mode sentiment --deep
/newsroom:investigate "Claude can edit images now" --mode verify
```

**Returns:** Evening edition report with synthesis, source links, telemetry, and interactive follow-up options.

---

### `/newsroom:stakeout`

Shorthand for `/newsroom:investigate` with `--mode changes`. Delta-focused research that looks for what's new or changed on a topic. Always refreshes sources.

**Signature:**
```
/newsroom:stakeout "[topic]" [flags]
```

**Parameters:** All flags from `/newsroom:investigate` except `--mode` (automatically set to `changes`).

**Defaults:**
- Always adds `--refresh` (bypass cache)
- Defaults to `--days 7` if not specified (shorter window for deltas)

**Examples:**
```bash
/newsroom:stakeout "Home Assistant"
/newsroom:stakeout "Claude Code" --deep
/newsroom:stakeout "MCP protocol" --days 7
```

---

## Agents

### `beat-reporter`

Research agent that gathers engagement-ranked Reddit and X results via the `@side-quest/last-30-days` CLI, then runs supplementary web research informed by CLI output.

**Model:** `sonnet`
**Skills:** `[web-scraping]`

**Assignment Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `topic` | string | Research topic |
| `query_type` | enum | `RECOMMENDATIONS`, `NEWS`, `PROMPTING`, `GENERAL` |
| `cli_flags` | string | Space-separated CLI flags |
| `web_queries` | string[] | WebSearch queries to run after CLI |
| `webfetch_budget` | number | Max WebFetch calls (1-3) |
| `focus_fields` | string[] | What to extract from web research |
| `depth_instruction` | string | Reporter instruction for depth level |

**Workflow:**

1. **Phase 1: Hit the CLI** - Generate unique outdir, call `bunx --bun @side-quest/last-30-days` with flags
2. **Phase 2: Web Research** - Run supplementary WebSearch queries (context-dependent)
3. **Phase 3: Extract Source Links** - Read `{outdir}/report.json` for structured Reddit/X data
4. **Phase 4: File Report** - Combined report with CLI data, web findings, source links, telemetry

**Report Structure:**
```markdown
## CLI Data (Reddit + X)
[Top 5 items with engagement numbers]

## Web Findings
[Top 3-5 findings with attribution]

## Source Links
- [thread title](url) (342 pts, 28 comments) - r/subreddit
- [tweet text](url) (910 likes, 45 reposts) - @handle
- [article title](url) - domain.com (web)

## Telemetry
cli_status: ok|failed|cached|rate-limited
web_pages: N
outdir: /tmp/l30d-<topic>-<rand>/
duration: ~Xs
```

---

## Skills

### `the-desk`

Grizzled 1920s city editor who runs every newsroom assignment in character. Greets the user as "Chief", confirms the angle in punchy newspaper slang, then orchestrates Beat Reporters.

**User-invocable:** Yes (via commands)
**Allowed Tools:** `Read`, `Task`, `TaskOutput`, `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet`, `AskUserQuestion`

**Character Voice:**

| Element | Pattern |
|---------|---------|
| Address user | "Chief" (they're the publisher) |
| Speech style | Short, punchy sentences. No fluff. |
| Terminology | "beat" (topic), "edition" (report), "column inches" (content), "the street" (community), "filed" (reported back) |

**Workflow:**

1. Route the assignment (determine type, read reference file)
2. Parse flags (topics, depth, sources, days, refresh, format, plain, mode, wire)
3. Interactive assignment (use `AskUserQuestion` for missing parameters)
4. Dispatch Beat Reporters in parallel (one per topic)
5. Collect results via `TaskOutput(block: true, timeout: 120000)`
6. Synthesize (deduplicate, cross-reference, rank)
7. Publish (synthesis, source links, stats footer, follow-up invitation)

---

### `web-scraping`

Web scraping guide for sub-agents. Covers Firecrawl CLI fallback when WebFetch fails.

**User-invocable:** No
**Required Tools:** `WebFetch`, `Bash`, `Read`

**Usage Pattern:**

1. Try WebFetch first (free, fast)
2. Recognize failure (empty content, 403/429)
3. Firecrawl CLI scrape: `bunx firecrawl-cli scrape "<url>"` or `bunx firecrawl-cli scrape "<url>" -o /tmp/scrape-output.md`
4. Report gaps if both fail

---

## Types & Enums

### Query Type
```typescript
type QueryType =
  | "RECOMMENDATIONS"  // "best X", "top X"
  | "NEWS"             // "what's happening", "latest"
  | "PROMPTING"        // "X prompts"
  | "GENERAL"          // everything else
```

### Mode
```typescript
type Mode =
  | "recon"       // Standard research (default)
  | "changes"     // Delta-focused
  | "sentiment"   // Community sentiment deep-dive
  | "verify"      // Fact-check a claim
```

### Source Selection
```typescript
type Sources =
  | "auto"     // Let CLI decide
  | "reddit"   // Reddit only
  | "x"        // X only
  | "both"     // Force both platforms
```

### Depth Level
```typescript
type Depth =
  | "quick"    // Faster, fewer sources
  | "default"  // Balanced (no flag)
  | "deep"     // Comprehensive
```

### Wire Type
```typescript
type WireType =
  | "green"  // Informational, flows freely
  | "red"    // Scope/priority changes, requires approval
```

### Wire Message Type (Newsroom Outgoing)
```typescript
type NewsroomMessageType =
  | "vulnerability_alert"
  | "deprecation_notice"
  | "community_bug_report"
  | "context_delivery"
  | "research_findings"
  | "intel_summary"
  | "status_update"
```

### CLI Status
```typescript
type CLIStatus =
  | "ok"           // Fresh results
  | "failed"       // CLI error
  | "cached"       // Served from cache
  | "rate-limited" // API limit hit
```

### Signal Strength
```typescript
type SignalStrength =
  | "high"    // Strong engagement data
  | "medium"  // Moderate engagement
  | "low"     // Weak or mixed data
```

---

## Wire Protocol

Wire message schema for inter-room communication using Claude Code's Task system.

**Required Fields:**

| Field | Type | Validation |
|-------|------|-----------|
| `wire_version` | string | Must be `"1"` |
| `wire_type` | string | `"green"` or `"red"` |
| `from_room` | string | Must be `"newsroom"` |
| `to_room` | string | `"kitchen"`, `"garden"`, `"dojo"`, `"broadcast"` |
| `message_type` | string | From defined list |
| `wire_id` | string | Auto-generated: `"wire-newsroom-{timestamp}"` |

**TaskCreate Format:**
```typescript
TaskCreate({
  subject: "[WIRE] {message_type}: {brief summary}",
  description: "{full wire message body}",
  metadata: {
    wire_version: "1",
    wire_type: "green",
    from_room: "newsroom",
    to_room: "{target}",
    message_type: "{type}",
    wire_id: "wire-newsroom-{timestamp}",
    priority: "normal",
    topics: "{comma-separated topics}",
    signal_strength: "{high|medium|low}"
  }
})
```

---

## CLI Integration

### `@side-quest/last-30-days`

The Beat Reporters call this CLI for engagement-ranked Reddit + X results.

**Invocation:**
```bash
bunx --bun @side-quest/last-30-days "<topic>" [options]
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--emit=MODE` | Output format: `compact` (default), `json`, `md`, `context`, `path` |
| `--sources=MODE` | Source selection: `auto` (default), `reddit`, `x`, `both` |
| `--days=N` | Lookback window in days (default: 30, range: 1-365) |
| `--quick` | Faster, fewer results |
| `--deep` | Comprehensive, more results |
| `--outdir=PATH` | Write output files to custom directory |
| `--refresh` | Bypass cache, force fresh search |

---

## Depth Scaling

| Depth | WebSearch Queries | WebFetch Calls | Instruction |
|-------|-------------------|----------------|-------------|
| `--quick` | 2 | 1 | "Quick scan - focus on top results only" |
| default | 3 | 2 | "Balanced coverage" |
| `--deep` | 5 | 3 | "Comprehensive - dig into review sites, forums, niche blogs" |

---

## Budget Caps

| Resource | Limit | Notes |
|----------|-------|-------|
| Max topics | 5 | Combine related topics beyond this |
| Max reporters per run | 5 | 1 per topic (never split by platform) |
| Timeout per reporter | 120s | Via `TaskOutput` |

---

## Cost & Performance

### Token Budget Estimates

| Topics | Reporters | Estimated Cost | Duration |
|--------|-----------|----------------|----------|
| 1 | 1 | ~50K tokens (Sonnet) | ~90s |
| 2-3 | 2-3 | ~100-150K tokens (Sonnet) | ~120s |
| 4-5 | 4-5 | ~200-250K tokens (Sonnet) | ~120s |

---

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| CLI not installed | `@side-quest/last-30-days` missing | `bun add -g @side-quest/last-30-days` |
| No API keys | Missing `.env` config | Create `~/.config/last-30-days/.env` with keys |
| No results | Niche topic or quiet period | Narrower topic, different time window, `--refresh` |
| Reporter timeout | Exceeded 120s | Note gap, continue with other results |
| Module resolution | Bunx cache corruption | `rm -rf /private/var/folders/_b/*/T/bunx-501-@side-quest/` |

---

## Dependencies

### Required
- `@side-quest/last-30-days` CLI (via `bunx`)
- Claude Code with Task system support
- WebSearch, WebFetch, Bash, Read tools

### Optional
- `para-obsidian` MCP tools (morgue/vault integration)
- `firecrawl-cli` + `FIRECRAWL_API_KEY` (advanced web scraping)

---

## Plugin Configuration

**File:** `plugins/newsroom/plugin.json`

```json
{
  "name": "newsroom",
  "description": "Mickey Malone's newsroom - community research across Reddit, X, and the web with engagement-ranked intelligence",
  "skills": ["./skills/the-desk", "./skills/web-scraping"],
  "agents": ["./agents/beat-reporter.md"],
  "commands": ["./commands/investigate.md", "./commands/stakeout.md"]
}
```
