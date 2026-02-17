# Query Strategies

WebSearch query templates organized by query type. The Editor-in-Chief selects queries based on the topic's QUERY_TYPE and includes them in the Beat Reporter's assignment.

## Universal Rules

- **Use the user's exact terminology** -- don't substitute tool names or add terms from your own knowledge
- **Exclude reddit.com, x.com, twitter.com** -- the Beat Reporter CLI covers those (exception: `--deep` mode may use `site:reddit.com` to catch Google-indexed comparison threads)
- **Include recency context** -- if DAYS <= 30, add "2026" to queries.
  If DAYS <= 7, add "this week" or "past week" instead.
  If DAYS <= 1, add "today" or "yesterday".
  The Editor-in-Chief resolves this before dispatching -- Beat Reporters receive final queries.
- **Vary query angles** -- don't just repeat the topic with different suffixes

## RECOMMENDATIONS

Goal: Find SPECIFIC NAMES of things people recommend.

### WebSearch Queries

```
1. "best {TOPIC} recommendations 2026"
2. "{TOPIC} list examples comparison"
3. "most popular {TOPIC} reviews"
4. "{TOPIC} alternatives ranked"          (--deep only)
5. "{TOPIC} vs" site:reddit.com           (--deep only, catches comparison threads Google indexed)
```

### WebFetch Targets

Prioritize:
- Listicle/comparison articles (these name specific things)
- Review aggregation pages
- GitHub awesome-lists
- "Best of" roundups

### What to Extract

- Specific product/tool/restaurant/item names
- How many sources mention each
- Star ratings, review scores, ranking positions
- Price points if mentioned

## NEWS

Goal: Find current events and recent developments.

### WebSearch Queries

```
1. "{TOPIC} news 2026"
2. "{TOPIC} announcement update February 2026"
3. "{TOPIC} launch release"
4. "{TOPIC} controversy reaction"           (--deep only)
5. "{TOPIC} industry analysis"              (--deep only)
```

### WebFetch Targets

Prioritize:
- Tech news sites (TechCrunch, The Verge, Ars Technica)
- Official announcements/blogs
- Industry analysis pieces

### What to Extract

- Event dates and timelines
- Key quotes from announcements
- Community reaction signals
- Impact assessments

## PROMPTING

Goal: Find techniques and copy-paste prompts for a target tool.

### WebSearch Queries

```
1. "{TOPIC} prompts examples 2026"
2. "{TOPIC} techniques tips best practices"
3. "{TOPIC} prompt engineering guide"
4. "{TOPIC} workflow tutorial"              (--deep only)
5. "{TOPIC} advanced prompting"             (--deep only)
```

### WebFetch Targets

Prioritize:
- Tutorial/guide articles
- GitHub repos with prompt collections
- Tool documentation pages
- Community prompt libraries

### What to Extract

- Specific prompt formats (JSON, structured, natural language)
- Named techniques with descriptions
- Before/after examples
- Tool-specific syntax or parameters

## GENERAL

Goal: Understand what the community is saying about a topic.

### WebSearch Queries

```
1. "{TOPIC} 2026"
2. "{TOPIC} discussion community"
3. "{TOPIC} opinions review experience"
4. "{TOPIC} trends analysis"               (--deep only)
5. "{TOPIC} pros cons"                     (--deep only)
```

### WebFetch Targets

Prioritize:
- Blog posts with personal experience
- Community forums (Stack Overflow, HN, niche forums)
- Industry reports
- Comparison/analysis articles

### What to Extract

- Consensus opinions (what most people agree on)
- Points of debate (where opinions split)
- Surprising insights (unexpected findings)
- Engagement signals (comment counts, shares mentioned in text)

## Constructing the Web Research Assignment

Template -- fill in from the above based on QUERY_TYPE and include in the Beat Reporter's prompt:

The Editor-in-Chief MUST resolve {N} and {M} from the Depth Scaling table
in orchestration.md BEFORE dispatching. The Beat Reporter cannot read orchestration.md.

```
After the CLI returns, run these WebSearch queries:
{N queries selected from the templates above}

Use WebFetch on the top {M} most promising results.

Focus on: {what to extract from above}
```
