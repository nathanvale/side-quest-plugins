# Plan: OBS-5 Server Lifecycle and DevOps

## Task Description

Add static file serving to the event server (so it serves the built Vue dashboard) and create a justfile with 9 developer-friendly recipes for foreground operation. This is the thinnest domain after OBS-2 -- half a day, one commit.

## Objective

1. The observability server serves the built Vue dashboard at `GET /` (single process for API + UI)
2. A justfile provides 9 recipes for development workflow (dev, build, test, health, etc.)

## Problem Statement

After OBS-1 (server) and OBS-4 (dashboard) are built, the developer needs to:
- Start the server and see the dashboard in one command
- Build the client and server together
- Run health checks, send test events, clear persistence
- Have a consistent developer workflow without memorizing Bun commands

## Solution Approach

Two additions to the existing codebase:
1. Static file serving fallback in `server.ts` (after all API routes) -- Bun's `new Response(Bun.file())` auto-detects Content-Type
2. Root `justfile` with 9 recipes using `just` command runner

No launchd, no HITL, no git migration (all deferred per review).

## Relevant Files

Use these files to complete the task:

- `specs/plans/obs-5-server-devops.md` -- full detailed plan (source of truth)
- `specs/plans/obs-1-event-server.md` -- server.ts contract (CORS, health, signal handlers)
- `packages/server/src/server.ts` (OBS-1) -- add static file serving fallback
- `packages/client/dist/` -- built dashboard output (from OBS-4)

### New Files

```
~/code/side-quest-observability/
  justfile                        -- 9 developer recipes
```

### Modified Files

```
packages/server/src/server.ts     -- add static file serving after API routes
```

## Implementation Phases

### Phase 1: Foundation

No separate foundation -- this builds on OBS-1 and OBS-4.

### Phase 2: Core Implementation

1. **Static file serving in server.ts**:
   - Add AFTER all API routes (/health, /events, /ws, /voice/notify)
   - Resolve `clientDistDir` relative to server source: `join(dirname(import.meta.dir), 'client/dist')`
   - Serve files from `clientDistDir` with auto Content-Type
   - SPA fallback: serve `index.html` for unmatched routes
   - If `dist/` doesn't exist, fall through to 404 (API routes still work)
   - No additional CORS (already handled by OBS-1)

2. **Justfile** with 9 recipes:
   - `dev` -- start server in foreground with `bun run --watch`
   - `build-client` -- build Vue dashboard
   - `build` -- build server + client
   - `test` -- run all tests
   - `typecheck` -- TypeScript check
   - `validate` -- full quality check
   - `health` -- curl health endpoint
   - `test-event` -- POST a test event (uses OBS-1 PR1 schema: `correlationId`, `source: "hook"`)
   - `db-reset` -- clear JSONL files (with PID file guard)

### Phase 3: Integration & Polish

- Verify `just build-client && just dev` serves dashboard at root
- Verify API routes still work alongside static serving
- Verify `just test-event` appears in dashboard
- Verify `just db-reset` fails when server is running

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. Use Task and Task* tools only.
- Take note of the session id (agentId) of each team member for resume operations.

### Model Selection Guide

| Role | Model | Rationale |
|------|-------|-----------|
| All builders | sonnet | Executes well-specified tasks reliably |
| All validators | haiku | Mechanical checks: read files, run commands, report PASS/FAIL |

### Team Members

- Builder
  - Name: builder-devops
  - Role: Add static serving + create justfile
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-devops
  - Role: Verify static serving, justfile recipes, integration
  - Agent Type: enterprise:validator-mccoy
  - Model: haiku
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. Add Static File Serving
- **Task ID**: static-serving
- **Depends On**: none (assumes OBS-1 server.ts and OBS-4 client exist)
- **Assigned To**: builder-devops
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read `specs/plans/obs-5-server-devops.md` Stage 5c section
- Read current server.ts to understand route structure
- Add static file serving AFTER all API routes in the fetch handler
- Resolve clientDistDir relative to server using import.meta.dir
- Add SPA fallback (index.html for unmatched routes)
- Graceful degradation: if dist/ missing, 404 only for non-API routes

### 2. Create Justfile
- **Task ID**: create-justfile
- **Depends On**: static-serving
- **Assigned To**: builder-devops
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read `specs/plans/obs-5-server-devops.md` Justfile section
- Create `~/code/side-quest-observability/justfile` with 9 recipes
- Use `set dotenv-load` and `set quiet`
- `test-event` must use correct OBS-1 PR1 schema (correlationId, source: "hook")
- `db-reset` must check PID file before deleting
- `dev` uses `bun run --watch` for auto-restart

### 3. Validate DevOps
- **Task ID**: validate-devops
- **Depends On**: create-justfile
- **Assigned To**: validator-devops
- **Agent Type**: enterprise:validator-mccoy
- **Model**: haiku
- **Parallel**: false
- `just build-client` -- builds Vue dashboard to dist/
- `just dev` -- starts server, dashboard loads at http://127.0.0.1:7483
- `curl http://127.0.0.1:7483/health` -- returns JSON with status: ok
- `curl http://127.0.0.1:7483/` -- returns HTML (dashboard)
- `curl http://127.0.0.1:7483/nonexistent` -- returns HTML (SPA fallback)
- `just test-event` -- event accepted by server
- `just health` -- reports server UP
- `just db-reset` fails when server is running (PID guard)
- API routes (/health, /events, /ws) still work with static serving enabled

## Acceptance Criteria

1. Server serves built Vue dashboard at `GET /`
2. SPA fallback: unmatched routes serve index.html
3. API routes take priority over static file serving
4. Missing dist/ directory doesn't break API routes
5. Justfile has 9 working recipes
6. `test-event` uses correct OBS-1 PR1 schema
7. `db-reset` guards against running server
8. `dev` uses `--watch` for auto-restart
9. No new CORS headers added (OBS-1 handles CORS)

## Validation Commands

- `just dev` -- start server + dashboard
- `just build` -- build server + client
- `just health` -- check server status
- `just test-event` -- send test event
- `just test` -- run all tests
- `just typecheck` -- TypeScript check
- `just validate` -- full quality check

## Notes

- No launchd auto-start in v1 (deferred to v1.1 after system proves value with `just dev`).
- No HITL support in v1 (deferred to v2, needs hook.permission_request from OBS-1 PR2).
- No git migration in v1 (belongs in OBS-1 PR3, not DevOps).
- No LCARS CSS (replaced by OBS-4's two-tier design token system).
- The `test-event` recipe sends a pre-built envelope to `POST /events` (not raw hook stdin to `POST /events/:eventName`).
- Bun's `Bun.file()` auto-detects Content-Type from file extension -- no manual MIME map needed.
