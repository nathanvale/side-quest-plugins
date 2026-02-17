# Structured Data Extraction

Extract typed data from web pages using Firecrawl + Zod schemas. Use when you need specific fields (prices, features, specs, ratings) rather than raw markdown.

## Prerequisites

These patterns require a TypeScript execution environment with `@mendable/firecrawl-js` and `zod` installed. Beat Reporters using the CLI should use `bunx firecrawl-cli scrape --extract` instead (run `bunx firecrawl-cli scrape --help` for current flags).

## When to Use This

- Pulling pricing tables, product specs, or feature comparisons
- Extracting structured listings (accommodation, restaurants, events)
- Getting typed data you can compare across multiple pages

## Basic Pattern

Define a Zod schema, convert to JSON Schema, pass to Firecrawl's extract endpoint:

```typescript
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

const PricingSchema = z.object({
  plan: z.string(),
  price: z.number(),
  currency: z.string().default('USD'),
  features: z.array(z.string()),
  limits: z.string().optional(),
});

const result = await firecrawl.scrapeUrl('https://example.com/pricing', {
  formats: ['extract'],
  extract: { schema: zodToJsonSchema(PricingSchema) },
});

const pricing = PricingSchema.parse(result.extract);
```

## Multi-Page Extraction

For multiple URLs, use the dedicated `/extract` endpoint -- it handles multi-URL extraction natively and supports natural language prompts alongside schemas:

```typescript
const result = await firecrawl.extract({
  urls: [
    'https://vendor-a.com/pricing',
    'https://vendor-b.com/pricing',
    'https://vendor-c.com/pricing',
  ],
  prompt: 'Extract the plan name, price, and features',
  schema: zodToJsonSchema(PricingSchema),
});
```

Alternatively, use `scrapeUrl()` in parallel if you need per-page control:

```typescript
const results = await Promise.all(
  urls.map((url) =>
    firecrawl.scrapeUrl(url, {
      formats: ['extract'],
      extract: { schema: zodToJsonSchema(PricingSchema) },
    })
  )
);

const allPricing = results
  .map((r) => PricingSchema.safeParse(r.extract))
  .filter((r) => r.success)
  .map((r) => r.data);
```

## Nested Schemas

For complex pages with multiple data types:

```typescript
const AccommodationSchema = z.object({
  name: z.string(),
  location: z.string(),
  pricePerNight: z.number(),
  rating: z.number().optional(),
  amenities: z.array(z.string()),
  availability: z.object({
    checkIn: z.string(),
    checkOut: z.string(),
    minStay: z.number().optional(),
  }).optional(),
});
```

## Cost Awareness

- Structured extraction uses AI extraction tokens (separate from scraping credits)
- Minimum $89/month for extraction access
- Scraping credits and extraction tokens are billed separately -- budget for both
- Specific schemas cost less than vague prompts -- define exactly what you need

## Gotchas

- Some pages return partial extractions if the schema doesn't match the page structure
- Use `.safeParse()` over `.parse()` to handle extraction failures gracefully
- Anti-bot protected pages may fail extraction entirely -- same limits as basic scraping
