# Greptile MCP Tools Reference

Greptile exposes 11 tools via its hosted MCP server at `https://api.greptile.com/mcp`.

## Authentication

The MCP server requires a Bearer token in the Authorization header. When using
Claude Code's MCP integration, the token is configured at setup time. The tools
below assume authentication is already configured.

## Pull Request Tools

### list_pull_requests / list_merge_requests

List pull requests with optional filters.

**Parameters:**
- `repository` (required) -- `owner/repo` format
- `remote` -- `github` (default), `gitlab`, `azure`, `bitbucket`
- `state` -- `open`, `closed`, `merged`, `all`
- `author` -- filter by PR author
- `branch` -- filter by head branch
- `page` / `perPage` -- pagination

**Returns:** Array of PR objects with number, title, state, author, branch, dates.

### get_merge_request

Full PR details including Greptile's review analysis.

**Parameters:**
- `repository` (required) -- `owner/repo`
- `pullNumber` (required) -- PR number
- `remote` -- defaults to `github`

**Returns:** PR details plus `reviewAnalysis` object:
- `completeness` -- review coverage percentage
- `addressedComments` / `unaddressedComments` -- counts
- `needsReReview` -- boolean flag

### list_merge_request_comments

All comments on a PR, filterable to Greptile-generated ones.

**Parameters:**
- `repository` (required) -- `owner/repo`
- `pullNumber` (required) -- PR number
- `remote` -- defaults to `github`
- `greptileOnly` -- `true` to filter to Greptile comments only
- `addressed` -- `true`/`false` to filter by resolution status
- `since` / `until` -- date range filters (ISO 8601)

**Returns:** Array of comment objects with id, body, path, line, author, addressed
status, created/updated dates.

## Code Review Tools

### list_code_reviews

List reviews for a PR with status filters.

**Parameters:**
- `repository` (required) -- `owner/repo`
- `pullNumber` (required) -- PR number
- `remote` -- defaults to `github`
- `status` -- filter by review status

**Status values:**
- `PENDING` -- queued, not started
- `REVIEWING_FILES` -- analyzing changed files
- `GENERATING_SUMMARY` -- building PR summary
- `COMPLETED` -- review finished, findings posted
- `FAILED` -- review errored out
- `SKIPPED` -- skipped by filter rules

**Returns:** Array of review objects with id, status, createdAt, completedAt.

### get_code_review

Detailed information about a specific review.

**Parameters:**
- `repository` (required) -- `owner/repo`
- `pullNumber` (required) -- PR number
- `reviewId` (required) -- from `list_code_reviews`
- `remote` -- defaults to `github`

**Returns:** Review details:
- `status` -- current review status
- `confidenceScore` -- 0-5 merge readiness rating
- `strictness` -- 1/2/3 review strictness level
- `filesReviewed` / `totalFiles` -- coverage counts
- `correlationId` -- for debugging with Greptile support

### trigger_code_review

Programmatically start a new review on a PR.

**Parameters:**
- `repository` (required) -- `owner/repo`
- `pullNumber` (required) -- PR number
- `remote` -- defaults to `github`

**Returns:** Confirmation with review ID and initial status (`PENDING`).

**Note:** Reviews take ~3 minutes for typical PRs. Poll `get_code_review` to
check completion status.

## Comment Search

### search_greptile_comments

Cross-repo search of all Greptile-generated comments.

**Parameters:**
- `query` (required) -- search text
- `repository` -- scope to specific repo
- `remote` -- defaults to `github`

**Returns:** Matching comments with summary stats:
- `addressed` -- count of resolved comments
- `unaddressed` -- count of open comments
- `withSuggestions` -- count of comments with code fix suggestions

## Custom Context Tools

### list_custom_context

List organization coding patterns and rules.

**Parameters:**
- `repository` -- scope to specific repo (optional)

**Returns:** Array of context rules with id, title, content, scope.

### get_custom_context

Get details of a specific coding pattern.

**Parameters:**
- `contextId` (required) -- pattern ID

**Returns:** Full pattern details including title, content, repo scope, filepath
glob patterns.

### search_custom_context

Search patterns by content.

**Parameters:**
- `query` (required) -- search text

**Returns:** Matching context rules ranked by relevance.

### create_custom_context

Create a new coding pattern or rule.

**Parameters:**
- `title` (required) -- pattern name
- `content` (required) -- natural language rule description
- `repository` -- scope to specific repo
- `filepathGlob` -- limit to matching file paths (e.g. `src/api/**/*.ts`)

**Returns:** Created context object with assigned ID.

**Example:** Create a rule enforcing rate limiting on API endpoints:
```json
{
  "title": "API rate limiting required",
  "content": "All API endpoints must implement rate limiting middleware",
  "repository": "owner/repo",
  "filepathGlob": "src/api/**/*.ts"
}
```
