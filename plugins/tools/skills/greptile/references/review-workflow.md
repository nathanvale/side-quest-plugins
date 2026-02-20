# Greptile Review Workflow Reference

How Greptile reviews PRs and how to interact with the review lifecycle.

## Review Trigger

Greptile reviews are triggered by:

1. **PR opened** -- automatic if the GitHub/GitLab app is installed on the repo
2. **PR updated** -- if `triggerOnUpdates: true` in `greptile.json`
3. **Manual tag** -- comment `@greptileai` on an existing PR
4. **MCP trigger** -- use `trigger_code_review` tool programmatically

## Review Process

1. Greptile detects the PR and posts an eyes emoji reaction
2. Builds context from the **entire codebase** (full repo graph, not just the diff)
3. Analyzes changed files against the codebase graph
4. Posts findings as PR comments (~3 minutes for typical PRs)
5. Posts a summary comment with confidence score
6. Shows thumbs up emoji when complete

## Review Components

### PR Summary Comment

Posted as an issue comment (not inline). Contains:

- **Plain-language summary** -- what the PR does in non-technical terms
- **Confidence score** -- 0 to 5 rating of merge readiness
- **Files changed table** -- file-by-file breakdown with issue counts
- **Diagrams** -- auto-generated based on change type:
  - Sequence diagrams for API/flow changes
  - ER diagrams for data model changes
  - Class diagrams for OOP changes
  - Flow diagrams for logic changes

### Inline Comments

Posted as PR review comments on specific lines. Each contains:

- The concern (bug, style, logic issue)
- Explanation of why it matters
- Suggested fix (often with code block)

### Comment Types

| Type | Description | Examples |
|------|-------------|---------|
| Logic | Bugs, edge cases, race conditions | Missing null check, unbounded loop |
| Syntax | Compile errors, missing imports | Wrong return type, unused variable |
| Style | Naming, dead code, complexity | Inconsistent naming, magic numbers |

### Confidence Score

| Score | Meaning | Action |
|-------|---------|--------|
| 5 | Merge-ready, no issues | Safe to merge |
| 4 | Minor suggestions only | Merge after quick review |
| 3 | Some concerns | Address before merge |
| 2 | Significant issues | Needs work |
| 1 | Critical problems | Do not merge |
| 0 | Cannot review / failed | Check configuration |

## Stale Review Detection

A review is stale when new commits have been pushed after the review completed.

**Detection:** Compare the review's `completedAt` timestamp against the latest
commit timestamp on the PR branch:

```bash
# Get latest commit time
git log -1 --format=%cI origin/$(gh pr view --json headRefName -q .headRefName)
```

If the latest commit is newer than the review, the review is stale. Offer to
re-trigger with `trigger_code_review`.

## Re-Triggering Reviews

### Via MCP Tool

Use `trigger_code_review` with the repository and PR number. This starts a
fresh review against the current PR state.

### Via PR Comment

Post a comment containing `@greptileai` on the PR. Greptile will pick it up
and start a new review.

```bash
gh pr comment $PR_NUMBER --body "@greptileai please review"
```

### Via Skill (--trigger flag)

The `/tools:greptile --trigger` flag calls `trigger_code_review` and then
polls for completion.

## Review Timing

| Repo Size | Typical Time |
|-----------|-------------|
| Small (< 500 files) | 1-3 minutes |
| Medium (500-5000 files) | 3-5 minutes |
| Large (5000+ files) | 5-15 minutes |

First review after indexing may take longer as the codebase graph is built.

## Learning System

Greptile learns from team feedback:

- **Thumbs up** on a comment -- reinforces that type of finding
- **Thumbs down** on a comment -- suppresses similar findings
- **Reply comments** -- provide context for future reviews

Training takes effect over 2-3 weeks of consistent feedback. Custom context
rules (via MCP tools or `greptile.json`) provide immediate control.

## Review Filtering

Reviews can be filtered in `greptile.json`:

- Skip reviews for specific labels (`disabledLabels`)
- Skip reviews by author (`excludeAuthors`)
- Skip reviews for branches (`excludeBranches`)
- Skip when file count exceeds limit (`fileChangeLimit`)
- Skip entirely with `skipReview: "AUTOMATIC"`

## Polling for Review Completion

When triggering a review programmatically, poll for completion:

1. Call `trigger_code_review` -- returns review ID
2. Poll `get_code_review` every 15 seconds
3. Check `status` field for `COMPLETED` or `FAILED`
4. Once completed, fetch findings via `list_merge_request_comments`

**Max polling time:** 10 minutes. If not completed, warn the user and suggest
checking the Greptile dashboard.
