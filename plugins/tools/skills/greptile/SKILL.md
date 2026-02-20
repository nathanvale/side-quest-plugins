---
name: greptile
description: >
  Run Greptile AI code review on the current repo. Fetches codebase-aware
  review findings from open PRs, queries code quality pre-PR via REST API,
  or iterates fixes until Greptile gives 5/5 confidence. Use when user asks
  to "review with greptile", "greptile check", "pre-flight check",
  "query the codebase", or "loop until clean".
argument-hint: '[--source auto|pr|query] [--fix] [--loop] [--strictness 1|2|3] [--query "question"] [--trigger]'
allowed-tools: Bash(gh:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(curl:*), Read, Edit, Write, Glob, Grep, AskUserQuestion
---

# Greptile Review Skill

You orchestrate Greptile code reviews. Your job: resolve the review source
(PR comments via MCP or pre-PR query via REST API), parse findings, present
them clearly, and optionally fix them.

Greptile builds a graph of the entire repository -- every function, class, and
dependency -- so its reviews understand how changes affect distant parts of the
system. This is fundamentally different from diff-only reviewers.

**Key difference from CodeRabbit:** Greptile has no local CLI. It is PR-based
natively. The query mode (pre-PR) is our addition using the REST API v2
`/query` endpoint -- it sends the current diff to Greptile's indexed codebase
for analysis without requiring a PR.

See [references/mcp-tools.md](references/mcp-tools.md) for MCP tool details.
See [references/api-reference.md](references/api-reference.md) for REST API details.
See [references/review-workflow.md](references/review-workflow.md) for review lifecycle.
See [references/config-reference.md](references/config-reference.md) for configuration.

## Usage

```
/tools:greptile                                    # Auto-detect: PR mode if open PR, query mode otherwise
/tools:greptile --source pr                        # Force PR mode (require open PR)
/tools:greptile --source query                     # Force query mode (REST API)
/tools:greptile --query "any security concerns?"   # Query mode with specific question
/tools:greptile --fix                              # Fetch findings + offer remediation
/tools:greptile --loop                             # Greploop: iterate until 5/5 confidence
/tools:greptile --trigger                          # Force trigger a new review on PR
/tools:greptile --strictness 3                     # Override review strictness
```

## Workflow

### 1. Parse Arguments

Extract flags from `$ARGUMENTS`:

| Flag | Default | Type | Notes |
|------|---------|------|-------|
| `--source` | `auto` | `auto`, `pr`, `query` | How to get findings |
| `--fix` | `false` | boolean | Enable staff engineer remediation |
| `--loop` | `false` | boolean | Greploop: iterate until 5/5 (max 5 rounds) |
| `--strictness` | - | `1`, `2`, `3` | Override review strictness level |
| `--query` | - | string | Natural language question (implies query mode) |
| `--trigger` | `false` | boolean | Force trigger a new PR review |

If `--query` is provided, set `--source` to `query` regardless of any explicit
`--source` value.

If `--loop` is provided, set `--source` to `pr` -- greploop requires an open PR.

### 2. Validate Environment

Check for required credentials:

```bash
# Check GREPTILE_API_KEY
echo "${GREPTILE_API_KEY:?Set GREPTILE_API_KEY env var. Get key at app.greptile.com/settings/api}"

# Check GITHUB_TOKEN (try gh auth token as fallback)
GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token 2>/dev/null)}"
echo "${GITHUB_TOKEN:?Set GITHUB_TOKEN or run 'gh auth login'}"
```

If either is missing, stop and guide the user:
- `GREPTILE_API_KEY`: "Set GREPTILE_API_KEY env var. Get your key at app.greptile.com/settings/api"
- `GITHUB_TOKEN`: "Set GITHUB_TOKEN or use `gh auth login` to authenticate"

### 3. Source Resolution

Determine the review source:

**auto mode:**
1. Run `gh pr view --json number,state --jq '{number, state}'`
2. If an open PR exists -> PR mode
3. If no PR or PR is closed/merged -> query mode

**pr mode:**
1. Run `gh pr view --json number,state --jq '{number, state}'`
2. If no open PR, error: "No open PR found for current branch. Open a PR first, or use `--source query` for pre-PR analysis."

**query mode:**
1. Skip PR detection entirely
2. Proceed to query workflow

### 4A. PR Mode -- Fetch Review Findings

This is the primary mode when working with an open PR.

#### Step 1: Gather PR context

```bash
# Get PR number and state
gh pr view --json number,state,headRefName --jq '{number, state, headRefName}'

# Get repo owner/name
gh repo view --json nameWithOwner --jq .nameWithOwner
```

#### Step 2: Find latest review

Use MCP `list_code_reviews` with the repository and PR number. Filter for
`status: "COMPLETED"`. Take the most recent review.

If no completed reviews exist:
- If `--trigger` was passed, proceed to trigger a new review (step 2a)
- Otherwise, inform the user: "No Greptile reviews found for PR #N. Use `--trigger` to start one, or check that Greptile is installed on this repo."

#### Step 2a: Trigger new review (if --trigger)

Use MCP `trigger_code_review` with repository and PR number. Then poll for
completion:

1. Call `trigger_code_review` -- note the review ID
2. Poll `get_code_review` every 15 seconds
3. Wait for `status` to reach `COMPLETED` or `FAILED`
4. Max polling time: 10 minutes
5. If `FAILED`, report the error and stop
6. If timeout, warn user and suggest checking Greptile dashboard

#### Step 3: Get review details

Use MCP `get_code_review` for the latest completed review. Extract:
- `confidenceScore` (0-5)
- `filesReviewed` / `totalFiles`
- `strictness` level used

#### Step 4: Fetch findings

Use MCP `list_merge_request_comments` with `greptileOnly: true`. This returns
all Greptile-generated comments on the PR.

Each comment has: `id`, `body`, `path`, `line`, `addressed` status.

#### Step 5: Check for stale review

Compare the review's completion timestamp against the latest commit on the PR
branch:

```bash
git log -1 --format=%cI origin/$(gh pr view --json headRefName -q .headRefName)
```

If the latest commit is newer than the review, warn:
"Review may be stale -- new commits pushed after review completed. Use `--trigger` to get a fresh review."

### 4B. Query Mode -- Pre-PR Code Quality Check

This mode uses the REST API v2 `/query` endpoint to analyse current changes
against the indexed codebase without requiring a PR.

#### Step 1: Get repo info

```bash
# Get owner/repo
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

# Get default branch
DEFAULT_BRANCH=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)
```

#### Step 2: Check repo is indexed

```bash
REPO_ID="github:${DEFAULT_BRANCH}:${REPO}"
ENCODED_ID=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${REPO_ID}', safe=''))")

curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer ${GREPTILE_API_KEY}" \
  -H "X-GitHub-Token: ${GITHUB_TOKEN}" \
  "https://api.greptile.com/v2/repositories/${ENCODED_ID}"
```

**If 404 (not indexed):** Offer to index the repo:

```
This repo isn't indexed by Greptile yet. Indexing is required before
querying. Would you like me to submit it for indexing?

Note: Indexing takes 3-5 minutes for small repos, up to 1 hour for large ones.
```

If user agrees, submit via:

```bash
curl -s -X POST \
  -H "Authorization: Bearer ${GREPTILE_API_KEY}" \
  -H "X-GitHub-Token: ${GITHUB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"remote":"github","repository":"'"${REPO}"'","branch":"'"${DEFAULT_BRANCH}"'","reload":false,"notify":true}' \
  "https://api.greptile.com/v2/repositories"
```

Then stop: "Indexing submitted. You'll get an email when it's ready. Run this
command again after indexing completes."

**If status is not `COMPLETED`:** Report current status and suggest waiting.

#### Step 3: Gather current changes

Get the diff to send for review:

```bash
# Uncommitted changes
git diff

# Committed changes vs default branch (if no uncommitted changes)
git diff ${DEFAULT_BRANCH}...HEAD
```

Also get the list of changed files:

```bash
git diff --name-only ${DEFAULT_BRANCH}...HEAD
```

If no changes found, report: "No changes detected. Nothing to review."

#### Step 4: Build and send query

If `--query` was provided, use that as the question. Otherwise, build a
standard code review query:

```
Review these code changes for bugs, logic errors, security issues, and
code quality concerns. For each issue found, specify the file path, line
number (if possible), severity (critical/important/suggestion), and a
clear description of the concern with a suggested fix.

Changed files:
[file list]

Diff:
[diff content]
```

**Important:** Truncate the diff to 50,000 characters max to stay within API
limits. If truncated, note which files were included and which were cut.

Send the query:

```bash
curl -s -X POST \
  -H "Authorization: Bearer ${GREPTILE_API_KEY}" \
  -H "X-GitHub-Token: ${GITHUB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "'"${QUERY}"'"}],
    "repositories": [{"remote": "github", "repository": "'"${REPO}"'", "branch": "'"${DEFAULT_BRANCH}"'"}],
    "stream": false
  }' \
  "https://api.greptile.com/v2/query"
```

#### Step 5: Parse response

The response contains:
- `message` -- natural language analysis
- `sources` -- array of referenced code locations with `filepath`, `linestart`,
  `lineend`, `summary`

Map sources to findings. Parse the `message` text to extract structured
concerns where possible.

### 5. Present Findings

Format findings consistently regardless of source. Match the CodeRabbit skill's
presentation style for familiarity:

```
## Greptile Review (PR #42): N findings | Confidence: 4/5

### Critical (N)
- **file.ts:42** -- Description of the critical issue
- **file.ts:87** -- Another critical finding

### Important (N)
- **file.ts:15** -- Description of the important concern

### Suggestions (N)
- **file.ts:8** -- Minor improvement suggestion

---
Source: PR #42 review (completed 2 hours ago) | Strictness: 2/3
```

For query mode (no confidence score available):

```
## Greptile Pre-PR Analysis: N findings

### Critical (N)
- **file.ts:42** -- Description

### Important (N)
- **file.ts:15** -- Description

### Suggestions (N)
- **file.ts:8** -- Description

---
Source: REST API query against indexed codebase (main branch)
```

#### Severity classification for PR mode

Greptile comments don't have explicit severity fields. Infer from content:

| Body Keywords | Severity |
|--------------|---------|
| `security`, `vulnerability`, `injection`, `XSS`, `CSRF`, `auth bypass` | Critical |
| `bug`, `error`, `crash`, `null`, `undefined`, `race condition`, `data loss` | Critical |
| `potential issue`, `might`, `could cause`, `edge case`, `missing check` | Important |
| `improvement`, `consider`, `suggestion`, `readability`, `naming` | Suggestion |
| `style`, `formatting`, `convention`, `nit`, `minor`, `optional` | Suggestion |
| None matched | Important (default) |

#### Empty results

If no findings:
- PR mode: "Greptile found no issues. Confidence: N/5. Looking good!"
- Query mode: "No concerns identified in the current changes."

If the review seems incomplete or confidence is low, suggest re-triggering.

### 6. Remediation (--fix mode)

When `--fix` is passed, adopt the **staff engineer peer review** persona --
same as the CodeRabbit skill for consistency.

For each finding:

1. **Read the affected code** -- use Read tool to get full context around the
   flagged line(s). Read at least 20 lines of surrounding context.

2. **Assess honestly** -- determine if the finding is:
   - **Fix now** -- genuine issue, clear fix, low risk
   - **Defer** -- valid concern but out of scope or risky to change now
   - **Dismiss** -- false positive, already handled, or not applicable

3. **Present via AskUserQuestion** -- for each finding, show:
   - The finding description
   - The current code
   - Your assessment and recommendation
   - If "Fix now": the proposed code change
   - Options: "Fix it now", "Defer (create issue)", "Dismiss"

4. **Apply fixes** -- for accepted fixes:
   - Use Edit tool to make the change
   - Keep changes minimal and focused

5. **PR mode post-fix actions:**
   - Reply to the Greptile comment explaining what changed. Use MCP tools or
     `gh api` to post a reply:
     ```bash
     gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies \
       -f body="Fixed -- [brief description of what changed]"
     ```
   - Note: Thread resolution happens automatically when Greptile re-reviews

6. **Query mode post-fix actions:**
   - No PR interaction needed -- fixes are local only
   - Summarize what was changed at the end

7. **Summary** -- after all findings are processed:
   ```
   ## Remediation Summary
   - Fixed: N findings
   - Deferred: N findings
   - Dismissed: N findings
   ```
   If any were deferred, offer to create GitHub issues for tracking.

### 7. Greploop Mode (--loop)

Iterative improvement loop -- subsumed from Greptile's official `/greploop`
skill. Requires an open PR.

#### Loop procedure:

1. **Trigger review** -- use MCP `trigger_code_review`
2. **Wait for completion** -- poll `get_code_review` every 15 seconds, max 10 min
3. **Check results:**
   - Get confidence score via `get_code_review`
   - Fetch findings via `list_merge_request_comments` with `greptileOnly: true`
   and `addressed: false` (unresolved only)
4. **Exit conditions** (any of these stops the loop):
   - Confidence = 5/5 AND zero unresolved comments -> SUCCESS
   - Max 5 iterations reached -> STOP with current status
   - Review failed -> STOP with error
   - No actionable findings remaining -> SUCCESS
5. **Fix all actionable findings** -- apply the remediation workflow (step 6)
   but without AskUserQuestion prompts. In greploop mode, fix everything that's
   clearly actionable. Skip only obvious false positives.
6. **Commit and push:**
   ```bash
   git add [specific changed files]
   git commit -m "fix: address greptile review findings (iteration N)"
   git push
   ```
7. **Re-trigger** -- go back to step 1

#### Greploop output:

After each iteration:
```
## Greploop Iteration N/5
- Confidence: 3/5 -> 4/5
- Findings fixed: 4
- Findings remaining: 2
- Status: continuing...
```

Final summary:
```
## Greploop Complete
- Iterations: 3/5
- Final confidence: 5/5
- Total findings fixed: 8
- Status: PASSED -- merge ready
```

Or if max iterations reached:
```
## Greploop Complete
- Iterations: 5/5 (max reached)
- Final confidence: 4/5
- Unresolved findings: 1
- Status: STOPPED -- review remaining finding manually
```

### 8. Check-PR Mode (--fix in PR mode)

This subsumes Greptile's official `/check-pr` skill. When `--fix` is used in
PR mode, the full check-pr workflow runs:

1. Fetch all Greptile comments (inline + summary) via MCP
2. Categorize each comment:
   - **Actionable** -- clear code change needed
   - **Informational** -- context or explanation, no action needed
   - **Already addressed** -- the code already handles this concern
3. Fix all actionable items using the remediation workflow
4. Stage, commit, and push fixes:
   ```bash
   git add [specific changed files]
   git commit -m "fix: address greptile PR review comments"
   git push
   ```
5. Reply to each fixed comment explaining what changed
6. Report summary with counts per category

## Error Handling

| Error | Detection | Action |
|-------|-----------|--------|
| No `GREPTILE_API_KEY` | Env var empty/unset | Guide: "Set GREPTILE_API_KEY env var. Get key at app.greptile.com/settings/api" |
| No `GITHUB_TOKEN` | Env var empty + `gh auth token` fails | Guide: "Set GITHUB_TOKEN or run `gh auth login`" |
| Repo not indexed | 404 from `/repositories/{id}` | Offer to index via REST API. Warn about timing. |
| No open PR (pr mode) | `gh pr view` fails or state != open | Suggest: "Open a PR first, or use `--source query` for pre-PR analysis" |
| No Greptile reviews | `list_code_reviews` returns empty | Suggest: "Use `--trigger` to start a review, or check Greptile is installed" |
| Stale review | Review timestamp < latest commit | Warn + offer `--trigger` to refresh |
| Rate limit (429) | HTTP 429 from API | Warn, single retry after `Retry-After` seconds. If still 429, stop. |
| Review in progress | `get_code_review` status is not COMPLETED | Show current status, offer to wait |
| Review failed | `get_code_review` status is FAILED | Report failure, suggest checking Greptile dashboard |
| Confidence < 3 | Score from `get_code_review` | Flag: "Confidence is low (N/5) -- needs attention before merge" |
| API timeout | No response after 60 seconds | Retry once, then stop with guidance |
| Diff too large | > 50,000 characters | Truncate with warning about which files were excluded |
| MCP not configured | MCP tool calls fail | Guide: "Add Greptile MCP server. See references/mcp-tools.md" |

## Important Notes

- **No local CLI** -- Greptile has no usable CLI for local review. The legacy
  CLI (`npm install -g greptile`) is abandoned and only supports Q&A, not code
  review. Do not attempt to use it.

- **MCP server** -- at `api.greptile.com/mcp`, requires Bearer auth. If MCP
  tools aren't available, the skill falls back to REST API where possible but
  PR mode features (review triggering, comment fetching) require MCP.

- **Indexing required** -- repos must be indexed before querying. First-time
  indexing takes 3-5 minutes for small repos. The skill checks and offers to
  index if needed.

- **Query mode is our addition** -- this is not a native Greptile feature. We
  use the REST API v2 `/query` endpoint to simulate local review by sending
  diffs to the indexed codebase. Results may differ from PR reviews because
  the PR review pipeline has additional context (PR description, commit
  messages, file change graph).

- **Confidence score** -- 0 to 5, where 5 means merge-ready. Only available
  in PR mode. Query mode does not produce a confidence score.

- **Learning system** -- Greptile learns from thumbs up/down reactions on PR
  comments over 2-3 weeks. Encourage the user to provide feedback on findings.

- **`greptile.json`** -- configuration file at repo root controls review
  behaviour. See [references/config-reference.md](references/config-reference.md).

- **Findings are suggestions** -- always present them as recommendations, not
  mandates. The user decides what to fix.

- **Diff-only in query mode** -- the REST API query works against the full
  indexed codebase, but our query includes only the current diff. This means
  Greptile can cross-reference the diff against the wider codebase for context,
  but it only reviews what we send.
