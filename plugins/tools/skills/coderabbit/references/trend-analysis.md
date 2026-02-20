# Trend Analysis Reference

How to analyze local CodeRabbit review history for patterns and insights.

## Data Location

CodeRabbit stores all local review data at:

```
~/.coderabbit/reviews/{projectHash}/{commitHash}/reviews/{timestamp}/
```

Each review directory contains:

| File | Contents |
|------|----------|
| `diff.json` | File-by-file changes (path, status, linesAdded, linesRemoved, unified diff) |
| `git.json` | Git metadata (head, baseBranch, baseCommitId, working directory, timestamp) |
| `internalState.json` | AI summary, PR objectives, reviewed commits, review status |

## Workflow (--trends)

### Step 1: Discover review history

```bash
find ~/.coderabbit/reviews -name "internalState.json" -type f 2>/dev/null
```

Group by project (first directory level under `reviews/`).

### Step 2: Parse review metadata

For each `internalState.json`, extract:
- `crReviewed` (boolean) -- was the review completed?
- `rawSummaryMap` (object) -- keys are filenames, values are AI summaries
- `reviewedCommitIds` (array) -- which commits were reviewed

For each `git.json`, extract:
- `timestamp` -- when the review ran
- `baseBranch` -- what branch was compared against
- Working directory -- which project

For each `diff.json`, extract:
- File paths and change counts
- Total lines added/removed

### Step 3: Analyze patterns

Generate the following insights:

#### Most-reviewed files

```
## Most Reviewed Files (last 30 days)

| File | Reviews | Total Lines Changed |
|------|---------|-------------------|
| src/lib/cache.ts | 8 | 342 |
| src/cli.ts | 6 | 218 |
| src/lib/score.ts | 4 | 95 |
```

#### Review frequency

```
## Review Activity

- Total reviews: 15
- Reviews this week: 4
- Average files per review: 3.2
- Average lines changed per review: 127
```

#### Finding categories (from summaries)

Parse `rawSummaryMap` values for common keywords:
- Security mentions
- Type safety mentions
- Error handling mentions
- Performance mentions
- Style/formatting mentions

```
## Finding Categories

| Category | Occurrences | % of Reviews |
|----------|------------|-------------|
| Type safety | 8 | 53% |
| Error handling | 6 | 40% |
| Performance | 3 | 20% |
| Security | 2 | 13% |
```

#### Churn hotspots

Files that appear in many reviews AND have high line counts are churn hotspots:

```
## Churn Hotspots

These files keep getting reviewed with significant changes:

1. src/lib/cache.ts -- 8 reviews, 342 lines changed (consider refactoring)
2. src/cli.ts -- 6 reviews, 218 lines changed
```

### Step 4: Present report

```
## CodeRabbit Review Trends

Period: [earliest review date] to [latest review date]
Projects: [list of project directories]

[Review Activity table]
[Most Reviewed Files table]
[Finding Categories table]
[Churn Hotspots]

### Recommendations

Based on review patterns:
- [Specific recommendations based on data]
```

## Edge Cases

- **No review history**: If `~/.coderabbit/reviews/` doesn't exist or is empty,
  tell the user: "No local review history found. Run some reviews first with
  `/tools:coderabbit` to build up data."
- **Corrupted JSON**: Skip files that fail to parse. Note them in output.
- **Multiple projects**: If reviews span multiple project directories, break
  the report down by project.
