# PR Comment Parsing Reference

How to fetch and parse CodeRabbit's review comments from a GitHub pull request.

## Prerequisites

- `gh` CLI authenticated (`gh auth status`)
- An open PR on the current branch

## Step 1: Detect PR

```bash
gh pr view --json number,state --jq '{number, state}'
```

Returns `{"number": 42, "state": "OPEN"}` or exits non-zero if no PR exists.

Only proceed if `state` is `"OPEN"`.

## Step 2: Get Repository Owner/Name

```bash
gh repo view --json nameWithOwner --jq .nameWithOwner
```

Returns `owner/repo` (e.g. `nathanvale/side-quest-last-30-days`).

## Step 3: Fetch Inline Findings

Inline comments are attached to specific lines in the diff:

```bash
gh api repos/{owner}/{repo}/pulls/{n}/comments --paginate
```

Filter by CodeRabbit's bot user:

```bash
gh api repos/{owner}/{repo}/pulls/{n}/comments --paginate \
  --jq '[.[] | select(.user.login == "coderabbitai[bot]")]'
```

### Inline Comment Fields

Each comment object contains:

| API Field | Maps To | Notes |
|-----------|---------|-------|
| `.path` | File | Relative file path |
| `.line` | Line | Line number in the new version of the file |
| `.original_line` | - | Line number in the old version (fallback if `.line` is null) |
| `.body` | Description | Markdown text with the finding details |
| `.created_at` | Timestamp | ISO 8601, used for staleness check |
| `.diff_hunk` | Context | The surrounding diff context |

## Step 4: Fetch Summary Comment

The walkthrough/summary is posted as a regular issue comment (not an inline review comment):

```bash
gh api repos/{owner}/{repo}/issues/{n}/comments --paginate \
  --jq '[.[] | select(.user.login == "coderabbitai[bot]")]'
```

The summary comment typically contains:
- A "Walkthrough" section with change descriptions
- An "Actionable comments" count
- Links to inline findings

This is informational -- the actual findings come from inline comments (Step 3).

## Type Inference

CodeRabbit's PR comments don't have a structured `type` field like the CLI output. Infer severity from keywords in the comment body:

| Body Keywords | Display Severity |
|--------------|-----------------|
| `security`, `vulnerability`, `injection`, `XSS`, `CSRF` | Critical |
| `bug`, `error`, `crash`, `null`, `undefined`, `race condition` | Critical |
| `potential issue`, `potential_issue`, `might`, `could cause` | Important |
| `improvement`, `consider`, `suggestion`, `style`, `naming` | Suggestion |
| `nitpick`, `nit`, `minor`, `optional` | Nitpick |
| None matched | Important (default) |

Search is case-insensitive. If multiple categories match, use the highest severity.

## Suggestion Code Blocks

CodeRabbit often includes suggested fixes as fenced code blocks with the `suggestion` language tag:

````markdown
```suggestion
const result = items.filter(Boolean)
```
````

When processing findings:
1. Detect `suggestion` code blocks in the `.body`
2. Extract the suggested replacement code
3. During `--fix` remediation, use this as the proposed fix content
4. The suggestion replaces the line(s) indicated by the comment's `.line` and `.diff_hunk` context

## Edge Cases

### No CodeRabbit Comments

The API returns an empty array (or no items match the filter). This means either:
- CodeRabbit hasn't reviewed the PR yet
- CodeRabbit found no issues

Check the summary comment endpoint too. If neither has CodeRabbit comments, suggest:
"No CodeRabbit review found on PR #N. Add a comment `@coderabbitai review` on the PR to trigger a review."

### Rate-Limited Comments

CodeRabbit's rate-limit response appears as a regular comment with body containing:
```
Rate limit exceeded
```

If detected, warn: "CodeRabbit is rate-limited on this PR. Wait a few minutes and re-trigger with `@coderabbitai review`."

### Stale Review

Compare the latest CodeRabbit inline comment's `.created_at` against the latest commit timestamp:

```bash
git log -1 --format=%cI
```

If the commit is newer than the latest CodeRabbit comment, the review may be outdated. Warn the user but still present the findings.

### Multiple Review Rounds

CodeRabbit may post multiple rounds of comments (after re-reviews). The API returns all comments chronologically. Use the most recent comment per file+line combination to avoid showing resolved findings.

### Outdated Comments

GitHub marks inline comments as "outdated" when the diff changes underneath them. The API field `.position` becomes `null` for outdated comments, but `.path` and `.original_line` remain. Include outdated comments with a note that they may no longer apply.

### Comments on Deleted Files

If `.path` references a file that no longer exists in the working tree, skip the finding during `--fix` remediation but still display it in the summary with a note.
