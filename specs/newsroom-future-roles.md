# Future Roles

Newsroom spec roles as promotion candidates. These are currently handled by mode flags on the Beat Reporter. Each role could become a dedicated agent when the mode's usage justifies the specialization.

## Current Crew (v1)

| Role | Implementation | Mode |
|------|---------------|------|
| Street Reporter | beat-reporter agent | `--mode recon` (default) |
| Stakeout | beat-reporter + mode adjustments | `--mode changes` |
| Source Network | beat-reporter + mode adjustments | `--mode sentiment` |
| Tipster Handler | beat-reporter + mode adjustments | `--mode verify` |

## Promotion Candidates

### Foreign Bureau

**Metaphor:** Covers the broader landscape beyond your immediate concerns.
**Current mapping:** Deep mode + broad topic (`--deep`)
**Promotion criteria:** When landscape monitoring becomes a recurring assignment, not ad-hoc research. Needs persistent state (watch list, baseline, delta detection).

### Investigative Desk

**Metaphor:** Multi-source deep research that produces feature-length stories.
**Current mapping:** Deep mode + multi-topic (`--deep` with multiple topics)
**Promotion criteria:** When investigations need to span multiple sessions, maintain working notes, and produce structured reports beyond evening edition format.

### Travel Desk

**Metaphor:** Specialist in places, experiences, and logistics.
**Current mapping:** General mode with travel-focused topics
**Promotion criteria:** When travel research needs destination-specific data sources (booking APIs, weather, local events) beyond Reddit/X/web.

### Review Desk

**Metaphor:** Evaluates tools, products, and services with structured recommendations.
**Current mapping:** Recommendations query type (`--format recommendations`)
**Promotion criteria:** When reviews need structured comparison matrices, scoring rubrics, or integration with the Enterprise's dependency decisions.

### Morgue Librarian

**Metaphor:** Maintains institutional memory and prevents re-reporting.
**Current mapping:** the-morgue.md reference doc (conditional vault lookup)
**Promotion criteria:** When morgue lookups need proactive indexing, cross-referencing across sessions, or research lifecycle management (archive, expire, refresh).

## Promotion Process

A role gets promoted from "mode flag" to "dedicated agent" when:

1. **Usage frequency** justifies the static context cost (~2-4K tokens per agent)
2. **Specialized tools** are needed that other modes don't require
3. **Persistent state** is required between sessions
4. **Output format** diverges significantly from the evening edition

Until then, the mode flag approach keeps the newsroom lean. One reporter archetype, many assignments.
