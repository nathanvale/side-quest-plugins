---
name: guide
description: >
  Expert knowledge bank for Firecrawl web scraping API and CLI -- core endpoints (scrape,
  search, crawl, map, extract, /agent), the Firecrawl CLI for AI agents, TypeScript/Zod
  integration patterns, cost optimization (model selection, caching, credit budgets),
  known gotchas (pricing traps, anti-bot gaps, self-hosting limitations, rate limits),
  and alternatives comparison. All examples use Bun, TypeScript, and Zod.
  Triggers on: Firecrawl scrape, Firecrawl crawl, Firecrawl search, Firecrawl extract,
  Firecrawl agent, Firecrawl CLI, web scraping with Firecrawl, Firecrawl pricing,
  Firecrawl cost, Firecrawl error, Firecrawl not working, Firecrawl alternative,
  Firecrawl vs, spark-1-mini, spark-1-pro, Firecrawl maxAge, Firecrawl actions,
  Firecrawl schema, Firecrawl rate limit, Firecrawl anti-bot, Firecrawl self-host,
  npx skills add firecrawl, firecrawl zod, firecrawl typescript,
  parallel scraping, multiple scrapes at once, MCP sequential bottleneck,
  what can I use firecrawl for, evaluate library, compare tools, research use cases,
  holiday planning, accommodation reviews, kids activities, product comparison,
  ingest documentation, when to use firecrawl vs webfetch.
user-invocable: true
argument-hint: "<question about Firecrawl>"
allowed-tools: Read, Glob, Grep
---

# Firecrawl Guide -- Knowledge Bank

Expert guidance for using Firecrawl effectively in AI agent workflows. All code examples target Bun + TypeScript + Zod. Covers the full API surface, the CLI tool, known quirks, cost optimization, and alternatives.

## Source Authority

This skill synthesizes:
- Firecrawl official docs (docs.firecrawl.dev)
- Community experience from Reddit, X, and developer blogs (as of Feb 2026)
- Real-world integration patterns from Claude Code, n8n, and MCP servers

## Step 1: Classify the Question

| Intent | Trigger Signals | Reference File |
|--------|----------------|----------------|
| **Core API** | scrape, search, crawl, map, extract, endpoint, API, markdown output, structured data, formats, actions, waitFor, timeout | [core-api.md](references/core-api.md) |
| **CLI Tool** | CLI, npx skills add, firecrawl cli, agent CLI, filesystem output, zero-config, install firecrawl | [cli.md](references/cli.md) |
| **Agent Patterns** | /agent, agent integration, parallel scraping, parallel firecrawl, multiple scrapes, multi-agent, MCP sequential, MCP bottleneck, sub-agent scraping, bulk scrape, workflow, spark-1, blocking vs non-blocking, schema, Zod | [agent-patterns.md](references/agent-patterns.md) |
| **Gotchas** | not working, error, failed, stuck, anti-bot, CAPTCHA, self-host, rate limit, breaking change, form filling, authentication | [gotchas.md](references/gotchas.md) |
| **Cost Optimization** | pricing, cost, credits, budget, cheap, expensive, maxAge, caching, model selection, spark-1-mini vs pro, free tier, token reduction | [cost-optimization.md](references/cost-optimization.md) |
| **Research Playbook** | use case, what can I use firecrawl for, research, evaluate library, compare tools, holiday planning, accommodation, reviews, kids activities, product comparison, ingest docs, deep dive, when to use firecrawl, WebFetch vs Firecrawl | [research-playbook.md](references/research-playbook.md) |
| **Alternatives** | alternative, vs, compare, instead of, switch from, Crawl4AI, Apify, Spider, Browse AI, Bright Data, Jina | [alternatives.md](references/alternatives.md) |

## Step 2: Read Reference Files

Read the relevant reference file(s) based on classification. For multi-intent questions, read all relevant files.

## Step 3: Synthesize Answer

### Response Structure

1. **Direct answer** -- one-line answer, no preamble
2. **Supporting detail** -- from reference files, with TypeScript/Zod code examples
3. **Gotcha check** -- flag any known pitfalls related to the answer
4. **Cost note** -- if the approach has cost implications, mention them
5. **Source** -- reference file cited

### Guidelines

- All code examples use Bun + TypeScript + Zod (no Python)
- Prefer code examples over prose explanations
- Always mention relevant gotchas even if not directly asked
- For scraping tasks, default to Zod schema-driven extraction (community best practice)
- When recommending `/agent` endpoint, always mention the 24h result expiry
- For cost-sensitive contexts, recommend `spark-1-mini` unless the task clearly needs `spark-1-pro`
- For CLI questions, mention filesystem-based output and token efficiency benefits
