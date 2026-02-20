# Greptile REST API v2 Reference

Base URL: `https://api.greptile.com/v2/`

## Authentication

Every request requires two headers:

```
Authorization: Bearer $GREPTILE_API_KEY
X-GitHub-Token: $GITHUB_TOKEN
```

- `GREPTILE_API_KEY` -- from greptile.com/settings
- `GITHUB_TOKEN` -- personal access token or `$(gh auth token)` with repo scope

## Endpoints

### POST /repositories -- Index a Repository

Submit a repo for indexing. Required before querying.

**Request:**
```json
{
  "remote": "github",
  "repository": "owner/repo",
  "branch": "main",
  "reload": false,
  "notify": true
}
```

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `remote` | yes | - | `github`, `gitlab`, `azure`, `bitbucket` |
| `repository` | yes | - | `owner/repo` format |
| `branch` | yes | - | branch to index |
| `reload` | no | `false` | force re-index if already indexed |
| `notify` | no | `true` | email when indexing completes |

**Response (202 Accepted):**
```json
{
  "repository": "owner/repo",
  "remote": "github",
  "branch": "main",
  "status": "SUBMITTED"
}
```

**Timing:** 3-5 minutes for small repos, up to 1 hour+ for large repos.

### GET /repositories/{repositoryId} -- Check Index Status

**Repository ID format:** `github:main:owner/repo`

URL-encode the ID: `github%3Amain%3Aowner%2Frepo`

**Response:**
```json
{
  "repository": "owner/repo",
  "remote": "github",
  "branch": "main",
  "status": "COMPLETED",
  "filesProcessed": 142,
  "numFiles": 142
}
```

**Status values:**
- `SUBMITTED` -- queued for indexing
- `CLONING` -- downloading repository
- `PROCESSING` -- building code graph
- `COMPLETED` -- ready for queries
- `FAILED` -- indexing failed (check repo access)

### POST /query -- Natural Language Query

Query indexed repos with natural language. This is the core endpoint for
pre-PR code quality checks.

**Request:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Review these changes for bugs and security issues: ..."
    }
  ],
  "repositories": [
    {
      "remote": "github",
      "repository": "owner/repo",
      "branch": "main"
    }
  ],
  "sessionId": "optional-session-id",
  "stream": false
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `messages` | yes | OpenAI chat format (`role` + `content`) |
| `repositories` | yes | Array of repos to query against |
| `sessionId` | no | Reuse for follow-up questions in same context |
| `stream` | no | `true` for SSE streaming response |

**Response:**
```json
{
  "message": "Based on the code changes, I found the following concerns...",
  "sources": [
    {
      "repository": "owner/repo",
      "remote": "github",
      "branch": "main",
      "filepath": "src/api/handler.ts",
      "linestart": 42,
      "lineend": 58,
      "summary": "Missing input validation on user-supplied parameter"
    }
  ]
}
```

**Response fields:**
- `message` -- natural language answer with analysis
- `sources` -- array of referenced code locations with file paths and line ranges

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 401 | Invalid or missing API key | Check `GREPTILE_API_KEY` |
| 403 | Insufficient GitHub token scope | Ensure `repo` scope on `GITHUB_TOKEN` |
| 404 | Repo not indexed | Index via `POST /repositories` first |
| 422 | Invalid request body | Check parameter format |
| 429 | Rate limit exceeded | Back off, retry after `Retry-After` header |
| 500 | Internal server error | Retry once, then report |

## Rate Limits

API rate limits are per-account. The `Retry-After` header indicates seconds to
wait. For the `/query` endpoint, complex queries against large repos may take
10-30 seconds to respond -- this is normal processing time, not a rate limit.
