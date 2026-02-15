# Agent Integration Patterns

How to integrate Firecrawl into AI agent workflows -- blocking vs non-blocking, model selection, Zod schema-driven extraction, and framework integrations. All examples use TypeScript.

---

## /agent Endpoint

### Blocking vs Non-Blocking

**Blocking** (simple, synchronous):
```typescript
const result = await firecrawl.agent({
  prompt: 'Find pricing for product X',
  model: 'spark-1-mini',
  maxCredits: 50,
});
// Waits for completion, returns result directly
```

**Non-blocking** (production, async):
```typescript
const job = await firecrawl.startAgent({
  prompt: 'Find pricing for product X',
  model: 'spark-1-mini',
  maxCredits: 50,
});
// Returns job ID immediately

// Poll until complete (with timeout + failure handling)
let status = await firecrawl.getAgentStatus(job.id);
const deadline = Date.now() + 5 * 60_000; // 5 min timeout
while (status.status !== 'completed') {
  if (status.status === 'failed' || status.status === 'cancelled') {
    throw new Error(`Agent ${job.id} ${status.status}`);
  }
  if (Date.now() > deadline) {
    throw new Error(`Agent ${job.id} timed out`);
  }
  await Bun.sleep(2000);
  status = await firecrawl.getAgentStatus(job.id);
}
```

Use non-blocking for responsive services and parallel agent dispatch.

### Model Selection

| Model | Cost | Use When |
|-------|------|----------|
| `spark-1-mini` (default) | 60% cheaper | Simple extractions, single-page tasks, straightforward queries |
| `spark-1-pro` | Full price | Complex multi-domain reasoning, multi-step research, nuanced extraction |

Default to `spark-1-mini` unless the task clearly requires complex reasoning.

### Critical Limits

- **Results expire after 24 hours** -- always consume or store results promptly
- **5 free daily /agent runs** -- useful for testing
- **`maxCredits` parameter** -- set budget guardrails to prevent runaway costs

## Schema-Driven Extraction with Zod

The community best practice: define your data structure with Zod upfront rather than post-processing Markdown.

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

const ProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  inStock: z.boolean(),
  features: z.array(z.string()).optional(),
});

type Product = z.infer<typeof ProductSchema>;

const result = await firecrawl.extract({
  urls: ['https://example.com/product'],
  schema: zodToJsonSchema(ProductSchema),
});

// Type-safe parsing with runtime validation
const product: Product = ProductSchema.parse(result.data);
```

Zod gives you:
- Type-safe results with `z.infer`
- Runtime validation via `.parse()` or `.safeParse()`
- JSON Schema conversion via `zod-to-json-schema` for the Firecrawl API
- Composable schemas for complex extraction targets

### Nested Schema Example

```typescript
const CompanySchema = z.object({
  name: z.string(),
  pricing: z.object({
    plans: z.array(z.object({
      name: z.string(),
      price: z.number(),
      features: z.array(z.string()),
    })),
    currency: z.string().default('USD'),
  }),
  contact: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }).optional(),
});
```

## Three-Step Research Pattern

The recommended workflow for agent research tasks:

1. **Find sources** -- use `/search` or `/map` to discover relevant URLs
2. **Extract content** -- use `/scrape` or `/extract` on discovered URLs
3. **Combine findings** -- synthesize extracted data

```typescript
// Step 1: Find sources
const sources = await firecrawl.search('topic of interest', { limit: 5 });

// Step 2: Extract structured data from each
const extractions = await Promise.all(
  sources.data.map((source) =>
    firecrawl.scrapeUrl(source.url, {
      formats: ['extract'],
      extract: { schema: zodToJsonSchema(TargetSchema) },
    })
  )
);

// Step 3: Combine and validate
const results = extractions
  .map((e) => TargetSchema.safeParse(e.extract))
  .filter((r) => r.success)
  .map((r) => r.data);
```

This gives control at each stage vs fire-and-forget crawling. Each step can be validated before proceeding.

## Parallel Scraping Strategies

The MCP server runs tool calls sequentially within a single conversation -- one request, one response, then the next. You cannot fire off multiple `firecrawl:scrape` calls in parallel from the same context. Three strategies to work around this:

### Strategy 1: Foreground Parallel Sub-Agents

Dispatch multiple sub-agents in a single message, each with its own MCP connection:

```
// In a Claude Code orchestrator, send all in one message:
Task("Scrape docs.example.com/api")    -- calls firecrawl:scrape independently
Task("Scrape docs.example.com/guides") -- calls firecrawl:scrape independently
Task("Scrape docs.example.com/ref")    -- calls firecrawl:scrape independently
```

Each sub-agent runs in its own context with its own MCP access. True parallel Firecrawl.

**Critical constraint**: MCP tools are NOT available in background sub-agents (they auto-deny permission prompts). These must be **foreground parallel** -- multiple Task calls in a single message. Same pattern as the newsroom beat reporters.

**Best for**: Claude Code orchestration, when you need agents to reason about the scraped content.

### Strategy 2: Direct API via Bash

Skip MCP entirely and hit the Firecrawl API with a TypeScript script:

```typescript
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

const urls = [
  'https://docs.example.com/api',
  'https://docs.example.com/guides',
  'https://docs.example.com/reference',
];

const results = await Promise.all(
  urls.map((url) =>
    firecrawl.scrapeUrl(url, {
      formats: ['markdown'],
      onlyMainContent: true,
    })
  )
);

// All results available simultaneously
for (const result of results) {
  await Bun.write(`output/${encodeURIComponent(result.url)}.md`, result.markdown);
}
```

An agent can run this via Bash -- true parallel HTTP requests, no MCP bottleneck.

**Best for**: Bulk scraping known URLs, when you don't need per-page agent reasoning.

### Strategy 3: CLI Filesystem Approach

Multiple agents each run CLI scrape commands simultaneously, writing to separate files:

```
// Agent A runs: firecrawl scrape https://docs.example.com/api --output /tmp/api.md
// Agent B runs: firecrawl scrape https://docs.example.com/guides --output /tmp/guides.md
// Agent C runs: firecrawl scrape https://docs.example.com/ref --output /tmp/ref.md
```

No contention -- each writes to its own file. A coordinator agent reads the files after all complete.

**Best for**: Agent workflows that need filesystem-based output for token efficiency.

### Choosing a Strategy

| Strategy | Parallel? | Agent Reasoning? | Token Efficiency | Setup |
|----------|-----------|-----------------|-----------------|-------|
| **Sub-agents (foreground)** | Yes | Yes (per agent) | Medium (MCP results in context) | Orchestrator pattern |
| **Direct API via Bash** | Yes | No (bulk fetch) | Low (write to disk) | API key + script |
| **CLI filesystem** | Yes | Optional (read from disk) | Best (filesystem-first) | CLI installed |

**Rule of thumb**: If agents need to reason about each page independently, use sub-agents. If you just need the data, use the API. If you want maximum token efficiency, use the CLI.

## Framework Integrations

### Claude Code (MCP + CLI)

Firecrawl integrates with Claude Code three ways:
- **MCP server** -- provides Firecrawl tools directly in conversation (interactive, sequential)
- **CLI skill** -- agents get filesystem-based web context (batch, token-efficient)
- **API via Bash** -- direct HTTP calls for parallel bulk operations

The skill you're reading now adds the expertise layer on top of all three.

### n8n Automation

AI Agent node implements ReAct pattern with Firecrawl search/scrape/agent calls. Drag-and-drop agent pipelines with multi-provider support.

### Composio MCP Router

Dynamic tool loading from Firecrawl and other apps through a single MCP endpoint.

### Open Agent Builder

Visual workflow builder for Firecrawl agent pipelines. Multi-provider support with drag-and-drop interface.

## Parallel /agent Dispatch

Firecrawl v2.8.0+ supports parallel agents for thousands of queries via the `/agent` endpoint. This is separate from parallel scraping -- each `/agent` call is an autonomous research task:

```typescript
// Launch multiple research agents in parallel
const jobs = await Promise.all([
  firecrawl.startAgent({ prompt: 'Research topic A', model: 'spark-1-mini', maxCredits: 30 }),
  firecrawl.startAgent({ prompt: 'Research topic B', model: 'spark-1-mini', maxCredits: 30 }),
  firecrawl.startAgent({ prompt: 'Research topic C', model: 'spark-1-mini', maxCredits: 30 }),
]);

// Collect results
const results = await Promise.all(
  jobs.map(async (job) => {
    let status = await firecrawl.getAgentStatus(job.id);
    const deadline = Date.now() + 5 * 60_000;
    while (status.status !== 'completed') {
      if (status.status === 'failed' || status.status === 'cancelled') {
        throw new Error(`Agent ${job.id} ${status.status}`);
      }
      if (Date.now() > deadline) {
        throw new Error(`Agent ${job.id} timed out`);
      }
      await Bun.sleep(2000);
      status = await firecrawl.getAgentStatus(job.id);
    }
    return status;
  })
);
```

- Set `maxCredits` per agent to prevent budget blowout
- Results expire at 24h -- process promptly
- Use `Bun.sleep()` for polling intervals

## Cost-Aware Patterns

- Use `maxCredits` on every agent call as a guardrail
- Default to `spark-1-mini` and only upgrade to `spark-1-pro` when needed
- Cache with `maxAge` on repeat scrapes (~5x speedup)
- Specific prompts reduce credit consumption -- vague prompts waste credits
- CLI filesystem output reduces token usage by ~2/3 vs in-context HTML
