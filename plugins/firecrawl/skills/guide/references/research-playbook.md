# Firecrawl Research Playbook

Practical use cases organized by research mode. Each use case includes the scenario, recommended Firecrawl approach, Zod schema, and gotchas.

---

## When to Use What

| Tool | Best For | Limitations |
|------|----------|------------|
| **Firecrawl `/scrape`** | Single page -> clean structured data | Can't handle login walls or heavy anti-bot |
| **Firecrawl `/search`** | Discover + scrape in one call | Limited to web search results |
| **Firecrawl `/crawl` + `/map`** | Ingest entire doc sites or multi-page resources | Lower-tier caps at 50 pages |
| **Firecrawl `/extract`** | Structured data from known URLs with Zod schemas | Separate $89/mo pricing for AI extraction |
| **Firecrawl `/agent`** | Multi-step autonomous research ("find X, then extract Y") | 24h result expiry, 5 free daily runs |
| **WebFetch** | Quick one-off page reads, no structure needed | No JS rendering, no structured extraction, bloated output |
| **WebSearch** | Finding URLs to feed into other tools | No content extraction, just links |
| **Chrome DevTools** | Form filling, auth flows, multi-step browser automation | Heavy setup, overkill for simple scraping |
| **`gh` CLI** | GitHub-specific data (issues, PRs, repos, actions) | Only works with GitHub |
| **`@side-quest/last-30-days`** | Reddit + X engagement-ranked community data | Only Reddit and X, 30-day window |

**Rule of thumb**: If you know what data you want and can define a Zod schema for it, use Firecrawl. If you just need raw page content, WebFetch is fine. If you need to click through things, use Chrome DevTools.

---

## Mode 1: Engineering Research

### Evaluate a Library Before Adopting

**Scenario**: Found a new library on X or HN. Should you use it?

**Firecrawl approach**: Scrape the GitHub README, npmjs page, and bundlephobia in parallel. Extract structured health signals.

```typescript
const PackageHealthSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string(),
  weeklyDownloads: z.number().optional(),
  lastPublished: z.string().optional(),
  license: z.string().optional(),
  typescriptSupport: z.enum(['built-in', 'DefinitelyTyped', 'none']).optional(),
  dependencies: z.number().optional(),
  bundleSize: z.string().optional(),
});
```

Scrape npmjs.com/package/X, bundlephobia.com/package/X, and the GitHub README in parallel (see agent-patterns.md for parallel strategies). One structured result per source.

**Gotcha**: GitHub rate-limits scrapers. Use `gh api` for repo metadata (stars, issues, last commit) and Firecrawl for the README content.

### Scan GitHub Issues for Red Flags

**Scenario**: Library looks good on paper but is it maintained? Are there scary open bugs?

```typescript
const IssueSignalSchema = z.object({
  title: z.string(),
  state: z.enum(['open', 'closed']),
  labels: z.array(z.string()),
  createdAt: z.string(),
  commentCount: z.number(),
  isBreakingChange: z.boolean(),
});
```

Use `/search "site:github.com/[owner]/[repo]/issues [keyword]"` to find relevant issues, then `/extract` with the schema. Filter for "breaking", "bug", "regression".

**Better alternative**: For GitHub specifically, `gh api` is more reliable. Use Firecrawl for the content of linked blog posts, discussions, or external references found in issues.

### Crawl Official Documentation

**Scenario**: Building a skill or integration. Need to ingest an entire doc site.

```typescript
// Step 1: Discover the site structure
const map = await firecrawl.mapUrl('https://docs.example.com', { limit: 500 });

// Step 2: Filter to relevant sections
const apiDocs = map.links.filter((url) =>
  url.includes('/api/') || url.includes('/reference/')
);

// Step 3: Crawl just those pages
const crawl = await firecrawl.crawlUrl('https://docs.example.com', {
  limit: 100,
  includePaths: ['/api/*', '/reference/*'],
  excludePaths: ['/blog/*', '/changelog/*'],
});
```

**This is how the Firecrawl guide itself was researched.** Map first, crawl selectively. Don't blind-crawl -- you'll burn credits on blog posts and changelogs you don't need.

**Gotcha**: Lower-tier plans cap at 50 pages. For large doc sites, prioritize the API reference and getting-started sections.

### Extract API Surfaces from Docs

**Scenario**: Need to understand what a library exports, what parameters it takes, what it returns.

```typescript
const APIEndpointSchema = z.object({
  name: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional(),
  path: z.string().optional(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    description: z.string().optional(),
  })),
  returnType: z.string().optional(),
  codeExample: z.string().optional(),
});
```

Scrape each doc page with this schema. The structured output feeds directly into skill authoring -- you're extracting the exact information a knowledge-bank skill needs.

### Compare Alternatives with Structured Data

**Scenario**: Evaluating 3-4 tools/libraries against each other. Need a comparison table.

```typescript
const ToolComparisonSchema = z.object({
  name: z.string(),
  pricing: z.string().optional(),
  license: z.string().optional(),
  githubStars: z.number().optional(),
  typescriptSupport: z.boolean().optional(),
  keyFeatures: z.array(z.string()),
  limitations: z.array(z.string()),
  lastRelease: z.string().optional(),
});
```

Run `/search "[tool] review 2026"` for each alternative, then `/extract` with the shared schema. Same Zod schema across all tools means the results are directly comparable -- no manual normalization.

### Read Changelogs for Breaking Changes

**Scenario**: Upgrading a dependency. What broke between versions?

```typescript
const ChangelogEntrySchema = z.object({
  version: z.string(),
  date: z.string().optional(),
  breakingChanges: z.array(z.string()),
  newFeatures: z.array(z.string()),
  bugFixes: z.array(z.string()),
  deprecated: z.array(z.string()),
});
```

Scrape the CHANGELOG.md or releases page. The schema forces extraction of exactly what matters for upgrade decisions.

### Newsroom Beat Reporter Upgrade

**Scenario**: Your beat reporters currently use WebFetch for web research after the CLI returns Reddit/X data.

**Current flow**: `WebSearch` -> `WebFetch` (raw HTML) -> agent tries to make sense of it
**Firecrawl flow**: `WebSearch` -> Firecrawl `/scrape` with Zod schema -> structured data back

```typescript
const ResearchArticleSchema = z.object({
  title: z.string(),
  author: z.string().optional(),
  publishDate: z.string().optional(),
  keyTakeaways: z.array(z.string()),
  toolsMentioned: z.array(z.string()),
  sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']).optional(),
  quotableLines: z.array(z.string()).optional(),
});
```

Beat reporters get structured articles instead of raw HTML. The Copy Desk (synthesis phase) works with clean data, not soup.

---

## Mode 2: Life Research with a Partner

### Holiday Planning

**Scenario**: Easter break. You and your partner pick a town. Now you need accommodation, activities, restaurants, and logistics.

**Accommodation search**:
```typescript
const AccommodationSchema = z.object({
  name: z.string(),
  pricePerNight: z.number().optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  amenities: z.array(z.string()),
  kidFriendly: z.boolean().optional(),
  distanceToCenter: z.string().optional(),
  bookingUrl: z.string().optional(),
});
```

Run `/search "accommodation [town] Easter 2026"` -> batch `/extract` on the top results. Structured comparison table without opening 15 browser tabs.

**Local attractions**:
```typescript
const AttractionSchema = z.object({
  name: z.string(),
  type: z.enum(['nature', 'museum', 'food', 'adventure', 'historic', 'family', 'other']),
  cost: z.string().optional(),
  duration: z.string().optional(),
  kidFriendly: z.boolean().optional(),
  ageRange: z.string().optional(),
  description: z.string(),
  bookingRequired: z.boolean().optional(),
});
```

Crawl the local tourism site -> extract attractions with age filtering for your kid.

**Walking trails**:
```typescript
const TrailSchema = z.object({
  name: z.string(),
  distance: z.string(),
  difficulty: z.enum(['easy', 'moderate', 'hard']).optional(),
  duration: z.string().optional(),
  highlights: z.array(z.string()),
  kidFriendly: z.boolean().optional(),
  pramAccessible: z.boolean().optional(),
});
```

**Restaurants**:
```typescript
const RestaurantSchema = z.object({
  name: z.string(),
  cuisine: z.string(),
  priceRange: z.enum(['$', '$$', '$$$', '$$$$']).optional(),
  rating: z.number().optional(),
  kidMenu: z.boolean().optional(),
  vegetarianOptions: z.boolean().optional(),
  bookingUrl: z.string().optional(),
});
```

**Gotcha**: Flight comparison sites (Jetstar, Qantas, Google Flights) have aggressive anti-bot protection. Firecrawl will likely fail on these. Use Google Flights directly or a flight API.

### Product Research and Major Purchases

**Scenario**: New appliance, tech gadget, or furniture. Need to compare options across retailers.

```typescript
const ProductComparisonSchema = z.object({
  name: z.string(),
  price: z.number(),
  retailer: z.string(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  inStock: z.boolean().optional(),
  keySpecs: z.array(z.string()),
  prosFromReviews: z.array(z.string()),
  consFromReviews: z.array(z.string()),
});
```

Scrape the same product across JB Hi-Fi, Harvey Norman, Amazon AU. Structured comparison with real review data.

---

## Mode 3: Family Research

### School Holiday Activities

**Scenario**: School holidays approaching. What's on for a primary schooler in your city?

```typescript
const KidsActivitySchema = z.object({
  name: z.string(),
  venue: z.string(),
  dates: z.string(),
  ageRange: z.string().optional(),
  cost: z.string().optional(),
  bookingRequired: z.boolean().optional(),
  description: z.string(),
  indoorOutdoor: z.enum(['indoor', 'outdoor', 'both']).optional(),
});
```

Crawl local council event pages, museum sites, and activity aggregators. Extract with age-range filtering.

**Gotcha**: Council and museum sites are often old-school HTML -- Firecrawl handles these well. Event aggregator sites (Eventbrite, Humanitix) may need JS rendering.

### Birthday Party Venues

**Scenario**: Your kid's birthday is coming up. Need venue options.

```typescript
const PartyVenueSchema = z.object({
  name: z.string(),
  location: z.string(),
  partyPackages: z.array(z.object({
    name: z.string(),
    price: z.string(),
    includes: z.array(z.string()),
    duration: z.string().optional(),
    maxKids: z.number().optional(),
  })),
  ageRange: z.string().optional(),
  rating: z.number().optional(),
  bookingUrl: z.string().optional(),
});
```

### Game and Media Suitability

**Scenario**: Levi wants a new game or movie. Is it age-appropriate?

```typescript
const MediaRatingSchema = z.object({
  title: z.string(),
  platform: z.string().optional(),
  ageRating: z.string(),
  parentRecommendedAge: z.number().optional(),
  violenceLevel: z.enum(['none', 'mild', 'moderate', 'intense']).optional(),
  onlineInteraction: z.boolean().optional(),
  inAppPurchases: z.boolean().optional(),
  parentReviewSummary: z.string().optional(),
  keyParentConcerns: z.array(z.string()),
});
```

Scrape Common Sense Media, PEGI, or ESRB rating pages. Structured parent-relevant data in one call.

### Sports and Activities Enrollment

**Scenario**: Swimming lessons, soccer registration, coding camps, music lessons.

```typescript
const ActivityEnrollmentSchema = z.object({
  provider: z.string(),
  activity: z.string(),
  location: z.string(),
  schedule: z.string(),
  termDates: z.string().optional(),
  costPerTerm: z.string().optional(),
  ageGroup: z.string().optional(),
  spotsAvailable: z.boolean().optional(),
  enrollUrl: z.string().optional(),
});
```

Every provider has a different janky website. Firecrawl + Zod normalizes them into comparable structured data.

### Educational Resources

**Scenario**: Need worksheets, reading lists, or tutoring options for a specific subject.

```typescript
const EducationResourceSchema = z.object({
  title: z.string(),
  subject: z.string(),
  gradeLevel: z.string(),
  type: z.enum(['worksheet', 'video', 'interactive', 'book', 'tutor', 'course']),
  cost: z.enum(['free', 'paid', 'freemium']),
  url: z.string(),
  description: z.string(),
});
```

---

## Anti-Patterns -- When NOT to Use Firecrawl

| Scenario | Why Not | Use Instead |
|----------|---------|------------|
| Checking flight prices | Anti-bot blocks scrapers | Google Flights directly, or Skyscanner API |
| Logging into authenticated sites | No auth/session handling | Chrome DevTools or direct API |
| Reddit/X community sentiment | CLI already has engagement-ranked data | `@side-quest/last-30-days` |
| GitHub repo metadata (stars, issues count) | API is more reliable | `gh api repos/owner/name` |
| Quick one-off page read, no structure needed | Firecrawl is overkill | `WebFetch` |
| Complex multi-step form submission | Needs real browser automation | Chrome DevTools MCP |
| Real-time data (stock prices, live scores) | Sites block and data changes constantly | Direct APIs |

---

## The Pattern

Every use case above follows the same flow:

1. **Define what you want** -- write a Zod schema
2. **Find the sources** -- `/search` or `/map`
3. **Extract structured data** -- `/scrape` or `/extract` with the schema
4. **Compare and decide** -- structured data enables direct comparison

The schema is the key insight. Once you define what "accommodation data" or "library health data" looks like as a Zod type, Firecrawl does the extraction. No more reading raw HTML. No more hoping an agent parses a page correctly.
