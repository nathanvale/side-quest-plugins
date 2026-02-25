# Dispatch Rules

Constraints and scaling rules for Beat Reporter dispatch. Read during the Dispatch phase.

**Key rule:** All reporters launch simultaneously in a single message with multiple Task calls. NEVER dispatch separate reporters for Reddit vs X on the same topic -- one reporter per topic covers all platforms.

## Depth Scaling

The Editor-in-Chief MUST resolve depth level BEFORE dispatching. The Beat Reporter cannot read this file. Use the table below to set `web_queries` count and `webfetch_budget` in the assignment JSON.

| Depth | WebSearch Queries per Reporter | WebFetch Calls | Reporter Instruction |
|-------|-------------------------------|----------------|---------------------|
| `--quick` | 2 | 1 | "Quick scan -- focus on top results only" |
| default | 3 | 2 | "Balanced coverage" |
| `--deep` | 5 | 3 | "Comprehensive -- dig into review sites, forums, niche blogs" |

Note: Quick mode optimization -- Beat Reporters may skip web research if CLI returns >= 3 results with strong engagement (upvotes/likes > 10).

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
| Timeout per reporter | 120s | Enforced via TaskOutput |
