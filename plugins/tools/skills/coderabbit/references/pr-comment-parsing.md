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

## Replying To and Resolving Comments

After fixing an issue inline, reply to the CodeRabbit comment and resolve the thread. This keeps the PR clean and signals to reviewers that the finding was addressed.

### Step 1: Reply to the comment

Use the REST API to post a reply on the review comment:

```bash
gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies \
  -f body="Fixed -- [brief description of the fix]."
```

The `{comment_id}` is the `.id` field from the inline comment fetched in Step 3 above.

Keep replies short and factual. Examples:
- "Fixed -- added null check before accessing `.length`."
- "Fixed -- switched to parameterized query to prevent SQL injection."
- "Fixed -- renamed to `getUserById` for clarity."

### Step 2: Resolve the review thread

GitHub review threads are resolved via the GraphQL API. First, get the thread ID for the comment, then resolve it:

```bash
# Get the thread node ID for a review comment
THREAD_ID=$(gh api graphql -f query='
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            comments(first: 1) {
              nodes { databaseId }
            }
          }
        }
      }
    }
  }
' -f owner="{owner}" -f repo="{repo}" -F pr={pr} \
  --jq ".data.repository.pullRequest.reviewThreads.nodes[] | select(.comments.nodes[0].databaseId == {comment_id}) | .id")

# Resolve the thread
gh api graphql -f query='
  mutation($threadId: ID!) {
    resolveReviewThread(input: {threadId: $threadId}) {
      thread { isResolved }
    }
  }
' -f threadId="$THREAD_ID"
```

### When to resolve

- **Fix it now** (applied inline) -- reply + resolve
- **Defer** -- do NOT resolve. The thread stays open as a reminder.
- **Dismiss** -- do NOT resolve. Let the user decide if they want to dismiss it on GitHub.

### Batch resolution

If multiple findings were fixed, reply and resolve each one individually. Do not batch-resolve with `@coderabbitai resolve` -- that resolves ALL threads including ones that weren't addressed.

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
