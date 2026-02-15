# Firecrawl CLI

The Firecrawl CLI gives AI agents direct web scraping capabilities with zero-config installation. Released Jan 27, 2026 -- purpose-built for agent workflows.

---

## Installation

```bash
npx skills add firecrawl/cli
```

Auto-installs and authenticates. No manual endpoint or API key configuration required for agent environments.

Compatible with: Claude Code, OpenAI Codex, Gemini CLI, OpenCode.

## Core Commands

| Command | Purpose |
|---------|---------|
| `scrape` | Clean Markdown from a single URL (handles JS-heavy sites) |
| `crawl` | Recursive link following across a site |
| `map` | URL discovery without content scraping |
| `search` | Web search + scrape top results |

## Why the CLI Matters

### Filesystem-Based Output

The CLI writes output to the filesystem instead of dumping full pages into the agent's context window. This is the key architectural difference from the API-in-context approach:

- Agents read only what they need from disk
- Reduces token consumption by ~2/3 vs raw HTML in context
- Enables cheaper model usage (e.g., Haiku instead of Sonnet for parsing tasks)

### Zero-Config Agent Integration

Traditional Firecrawl API integration requires:
1. API key management
2. Endpoint configuration
3. SDK installation
4. Authentication setup

The CLI collapses this to `npx skills add firecrawl/cli`. Agents get web context immediately.

### Performance

Community benchmarks report:
- 50x faster than Apify in agent workflows (AgentOps benchmark)
- >80% coverage across 1,000 URLs
- ~5x speedup on repeat scrapes with caching

## CLI vs API vs MCP

| Approach | Best For | Token Impact | Setup |
|----------|----------|-------------|-------|
| **CLI** | Agent workflows, filesystem output | Low (reads from disk) | `npx skills add firecrawl/cli` |
| **API (SDK)** | Application code, programmatic access | Medium (response in memory) | npm install + API key |
| **MCP Server** | Claude Code, interactive scraping | Medium (tool results in context) | MCP config + API key |

Use the CLI when agents need web context. Use the API when building application code. Use MCP for interactive Claude Code sessions.

## Community Adoption Signals

- Official launch: 910 likes on X (@firecrawl, Jan 27)
- Tutorial "Make Claude Code 10x more powerful": 352 likes (@Sumanth_077)
- Multilingual tutorials emerging (Spanish, Chinese) within 3 weeks of launch
- Multiple unprompted "install this immediately" recommendations from agent developers
- r/codex discussion comparing CLI skills vs MCP server approach

## Community Workflow Pattern

The emerging pattern from agent developers:

1. **Scrape** -- CLI fetches page to filesystem as clean Markdown
2. **Filter** -- Agent reads only relevant sections from disk
3. **Feed to AI** -- Filtered content goes into the prompt (minimal tokens)

This 3-step pattern maximizes token efficiency and gives control at each stage.

## Skepticism to Watch

- Reddit users flagged promotional content concerns ("looks like a Firecrawl AI post")
- Signal-to-noise ratio on community posts still developing
- Beta-stage maturity -- expect quirks and breaking changes
