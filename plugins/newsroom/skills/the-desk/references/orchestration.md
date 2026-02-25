# Orchestration Guide

Detailed instructions for the Editor-in-Chief on dispatching and collecting from Beat Reporters.

## Architecture

**Key: All reporters launch simultaneously in a single message with multiple Task calls.**

```
[Editor-in-Chief] (you, inline skill)
     |
     +-- Phase 2 (ALL PARALLEL -- one message, multiple foreground Task calls):
     |     |
     |     +-- Beat Reporters (one per topic, foreground parallel)
     |           newsroom:beat-reporter: "topic1"  (CLI first, then WebSearch + WebFetch)
     |           newsroom:beat-reporter: "topic2"  (CLI first, then WebSearch + WebFetch)
     |           (each: CLI parallelizes Reddit + X, then runs web research sequentially)
     |           (each reporter files with street-reporter voice -- Mickey relays with editorial judgment)
     |
     +-- Collect Phase 2: TaskOutput for all reporters (block: true, timeout: 120000)
     |
     +-- Phase 3: Copy Desk (synthesize + present -- data stays clean, voice is in the framing)
```

### Why This Works

For 3 topics, the Editor-in-Chief sends a single message with 3 parallel foreground Task calls. Multiple foreground Task calls in one message run concurrently. Each Beat Reporter:
1. Calls the CLI (which parallelizes Reddit + X internally)
2. Assesses CLI output
3. Runs supplementary WebSearch + WebFetch informed by what came back

**Anti-pattern: NEVER dispatch separate reporters for Reddit vs X on the same topic.** The CLI's `--sources` flag handles platform selection internally. One reporter = one topic = all platforms. Splitting by platform doubles token cost for zero benefit.

Total wall-clock time: ~90-120s (bounded by slowest reporter finishing both CLI + web phases).

## Dispatching Beat Reporters

Launch one Beat Reporter per topic. They know the CLI inside-out via inline reference in their agent body.

Read [query-strategies.md](query-strategies.md) first to construct web queries for the topic's QUERY_TYPE, then build a structured JSON assignment:

```
Task({
  description: "Beat Reporter: [topic]",
  prompt: `Execute this assignment per your workflow. File your report with CLI data, web findings, and telemetry.

{
  "topic": "[topic]",
  "query_type": "RECOMMENDATIONS|NEWS|PROMPTING|GENERAL",
  "cli_flags": "[all applicable flags]",
  "web_queries": ["{N queries from query-strategies.md}"],
  "webfetch_budget": {M},
  "focus_fields": ["{what to extract from query-strategies.md}"],
  "depth_instruction": "Quick scan|Balanced coverage|Comprehensive..."
}`,
  subagent_type: "newsroom:beat-reporter"
})
```

The Beat Reporter will:
1. Call `bunx --bun @side-quest/word-on-the-street "[topic]" --emit=compact [flags]`
2. Handle errors using its inline CLI troubleshooting knowledge
3. Assess CLI output and decide web research approach
4. Run WebSearch + WebFetch per the assignment
5. File a combined report with CLI data, web findings, and telemetry

### CLI Flags

| Flag | CLI Equivalent | When to Pass |
|------|---------------|-------------|
| `--quick` | `--quick` | User wants fast results |
| `--deep` | `--deep` | User wants comprehensive results |
| `--reddit` | `--sources=reddit` | User wants Reddit only |
| `--x` | `--sources=x` | User wants X only |
| `--both` | `--sources=both` | User explicitly wants both platforms |
| `--days N` | `--days=N` | User specifies a time window |
| `--refresh` | `--refresh` | User wants fresh (uncached) results |

Note: `--sources`, `--days`, `--refresh` only affect the CLI phase. The web research phase always runs WebSearch regardless.

### Depth Scaling

The Editor-in-Chief MUST resolve {N} and {M} BEFORE dispatching. The Beat Reporter cannot read orchestration.md.
Resolved values: --quick (2 queries, 1 fetch), default (3 queries, 2 fetches), --deep (5 queries, 3 fetches).

| Depth | WebSearch Queries per Reporter | WebFetch Calls | Reporter Instruction |
|-------|-------------------------------|----------------|---------------------|
| `--quick` | 2 | 1 | "Quick scan -- focus on top results only" |
| default | 3 | 2 | "Balanced coverage" |
| `--deep` | 5 | 3 | "Comprehensive -- dig into review sites, forums, niche blogs" |

Note: Quick mode optimization -- Beat Reporters may skip web research if CLI returns >= 3 results with strong engagement (upvotes/likes > 10). See beat-reporter.md Phase 2A.

## Collecting Results

After dispatching all reporters, collect results using TaskOutput:

```
TaskOutput({ task_id: "[agentId]", block: true, timeout: 120000 })
```

Use 120s timeout per reporter. If a reporter times out, note the gap and continue with results from others.

Collect all reporter results before moving to Phase 3 (Copy Desk).

## Error Handling Matrix

| Scenario | Action |
|----------|--------|
| All reporters succeed | Full synthesis (best case) |
| Some reporters succeed | Synthesize available, note gaps |
| CLI failed within a reporter but web succeeded | Report web findings, note "engagement data unavailable" |
| Reporter times out | Note gap, continue with others |
| Everything fails | Report failure honestly, suggest retry or check API keys |

## Constraints

- **Beat Reporters** run on Sonnet with inline CLI knowledge
- Beat Reporters have access to Bash (for CLI), Read, WebSearch, and WebFetch
- They run as foreground parallel tasks -- multiple Task calls in one message run concurrently
- Foreground execution is required because Bash needs user permission approval (background agents auto-deny permission prompts)
- Beat Reporters cannot spawn sub-agents (one level of delegation only)
- MCP tools (x_get_timeline, etc.) are NOT available in sub-agents -- the CLI handles X/Reddit via its own API calls

## Budget Caps

Hard limits to control token burn and wall-clock time.

| Resource | Cap | Notes |
|----------|-----|-------|
| Max topics | 5 | Combine related topics beyond this |
| Max reporters per run | 5 | 1 per topic (NEVER split by platform) |
| Max WebFetch per reporter (quick) | 1 | Minimal web scraping |
| Max WebFetch per reporter (default) | 2 | Balanced |
| Max WebFetch per reporter (deep) | 3 | Comprehensive but bounded |
| Max CLI output rows | 50 | Truncate compact output to top 50 results |
| Timeout per reporter | 120s | Already enforced via TaskOutput |

## Swarm Size Guidelines

| Topics | Total Reporters | Estimated Cost |
|--------|----------------|---------------|
| 1 | 1 | ~50K tokens (Sonnet) |
| 2-3 | 2-3 | ~100-150K tokens (Sonnet) |
| 4-5 | 4-5 | ~200-250K tokens (Sonnet) |
| 6+ | Cap at 5 topics, combine related | Avoid excessive parallelism |
