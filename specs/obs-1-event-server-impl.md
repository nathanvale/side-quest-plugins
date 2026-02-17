# Plan: OBS-1 Event Server Extraction + Enrichment Pipeline

## Task Description

Extract the event system from `@side-quest/git/src/events/` (7 source files, 4 test files) into a new `@side-quest/observability` repo scaffolded from `bun-typescript-starter`. Convert to workspace monorepo, generalize naming from git-specific to app-generic, add server-side hook event enrichment pipeline, and apply operational hardening (signal handlers, JSONL rotation, ingress validation, CORS, nonce identity, WS backoff).

This is the foundation -- every other domain depends on OBS-1.

## Objective

A running event server at `~/code/side-quest-observability/packages/server/` that:
1. Accepts raw hook stdin via `POST /events/:eventName` and enriches it into EventEnvelopes
2. Accepts pre-built envelopes via `POST /events` for programmatic clients
3. Stores events in a ring buffer + JSONL persistence with rotation
4. Broadcasts events via WebSocket (native Bun pub/sub)
5. Serves health diagnostics at `GET /health` with nonce identity
6. All ported tests pass + new operational tests pass

## Problem Statement

The event system in `@side-quest/git/src/events/` is production-quality but git-specific. It needs to be extracted, generalized, and extended with a hook event enrichment pipeline to serve as the observability backbone for all Claude Code plugins.

## Solution Approach

Two-phase extraction (PR1 focus in this spec):
- **PR1**: Mechanical extraction with minimal API changes (rename repo->app, add 5 v1 hook types, add enrichment pipeline, add operational hardening)
- **PR2** (future): Three-tier CIDs, remaining 9 event types, cache GC

The "dumb hook, smart server" architecture means all event intelligence lives here -- hooks just forward raw stdin.

## Relevant Files

Use these files to complete the task:

- `~/code/side-quest-git/src/events/types.ts` -- source types, rename repo->app, add 5 v1 ClaudeHookEvent
- `~/code/side-quest-git/src/events/schema.ts` -- event factory, rename repo->app
- `~/code/side-quest-git/src/events/store.ts` -- ring buffer + JSONL persist, add rotation
- `~/code/side-quest-git/src/events/server.ts` -- HTTP+WS server, add enrichment pipeline + CORS + nonce
- `~/code/side-quest-git/src/events/client.ts` -- WS client, add exponential backoff
- `~/code/side-quest-git/src/events/emit.ts` -- fire-and-forget emitter, add failure logging + global discovery
- `~/code/side-quest-git/src/events/cache-key.ts` -- cache key generation, simplify with contentId
- `~/code/side-quest-git/src/events/cache-key.test.ts` -- port + update paths
- `~/code/side-quest-git/src/events/schema.test.ts` -- port + update field names
- `~/code/side-quest-git/src/events/server.test.ts` -- port + add enrichment/CORS/validation tests
- `~/code/side-quest-git/src/events/emit.test.ts` -- port + add failure logging tests
- `~/code/bun-typescript-starter/` -- template for repo scaffold
- `specs/plans/obs-1-event-server.md` -- full detailed plan (source of truth)

### New Files

```
~/code/side-quest-observability/
  package.json                    -- workspace root
  tsconfig.json                   -- project references
  tsconfig.base.json              -- from template
  biome.json                      -- from template, root-level only
  packages/
    server/
      package.json                -- @side-quest/observability-server, private
      tsconfig.json               -- extends root base
      bunup.config.ts             -- ESM build config
      src/
        types.ts                  -- generalized EventType, EventEnvelope, EventContext
        schema.ts                 -- createEvent factory
        store.ts                  -- EventStore with rotation + graceful degradation
        server.ts                 -- Bun.serve with enrichment pipeline + CORS + nonce + global cache
        client.ts                 -- WS client with exponential backoff + jitter
        emit.ts                   -- fire-and-forget emitter with failure logging + global discovery
        cache-key.ts              -- getAppCacheKey using contentId
        index.ts                  -- barrel export
        cli/
          index.ts                -- CLI: `observability server`
      src/*.test.ts               -- ported + new operational tests
    client/
      package.json                -- placeholder for OBS-4
```

## Implementation Phases

### Phase 1: Foundation -- Scaffold Repo

**Read first:** `specs/plans/obs-1-event-server.md` Part 1 (sections 1.1-1.6)

1. Create `~/code/side-quest-observability` from bun-typescript-starter
2. Convert to workspace monorepo:
   - Root `package.json`: add `"workspaces": ["packages/*"]`, `"engines": { "bun": ">=1.3.7" }`
   - Remove root `"main"`, `"types"`, `"exports"`, `"files"` (move to sub-packages)
   - Remove root `bunup.config.ts`
3. Create `packages/server/package.json` with `@side-quest/core` dependency
4. Create `packages/client/package.json` (placeholder)
5. Configure TypeScript project references
6. Create `packages/server/bunup.config.ts`
7. Verify: `bun install && bun run typecheck`

### Phase 2: Core Implementation -- File-by-File Extraction

**Read first:** `specs/plans/obs-1-event-server.md` Part 2 (sections 2.1-2.8)

Extract in dependency order:

1. **`types.ts`** (all files depend on this)
   - Rename `EventEnvelope.repo` -> `app`, `.gitRoot` -> `appRoot`
   - Rename `EventContext.repo` -> `app`, `.gitRoot` -> `appRoot`
   - Add `ClaudeHookEvent` type with 5 v1 members
   - Keep `source: 'cli' | 'hook'` (no widening)
   - Keep single `correlationId` (no three-tier CIDs yet)

2. **`cache-key.ts`** (used by server.ts and emit.ts)
   - Rename `getRepoCacheKey` -> `getAppCacheKey`
   - Replace manual SHA256 with `contentId` from `@side-quest/core/hash`
   - Update cache dir from `side-quest-git` to `side-quest-observability`

3. **`schema.ts`** (used by server.ts and emit.ts)
   - Update `createEvent` to populate `app`/`appRoot`

4. **`store.ts`** (used by server.ts)
   - Add JSONL rotation (10MB max, 5 rotated files)
   - Add graceful degradation on persist failure (rate-limited logging)
   - Keep `push()` synchronous (no withFileLock)

5. **`server.ts`** (the big one -- depends on all above)
   - Rename `ServerOptions.repoName` -> `appName`, `.gitRoot` -> `appRoot` (optional)
   - **Global server model**: port/pid/nonce files at `~/.cache/side-quest-observability/`
   - **Two POST routes**:
     - `POST /events/:eventName` -- raw hook stdin, server enriches (dumb hook model)
     - `POST /events` -- pre-built EventEnvelope (programmatic clients)
   - **Enrichment pipeline** (`enrichHookPayload` + `handleHookEvent`):
     - Map event names to EventType (`session-start` -> `hook.session_start`)
     - Extract event-specific fields (model, tool_name, etc.)
     - Truncate large fields (tool_input, tool_result > 2000 chars)
     - Check `stop_hook_active` recursion guard
     - Generate EventEnvelope (id, timestamp, correlationId)
   - **Signal handlers**: SIGTERM/SIGINT cleanup (remove PID files, stop server)
   - **Nonce identity**: write nonce file, return in /health
   - **Ingress validation**: 400 for invalid payloads, 1MB body limit
   - **CORS headers**: `Access-Control-Allow-Origin: *` on all responses
   - **Health endpoint**: status, nonce, uptime, events, persistErrors, wsClients
   - **WebSocket**: Bun native pub/sub, `events.all` + `events.<type>` topics, ping/pong, backpressure
   - **GET /events**: query history with optional type/since/limit params

6. **`client.ts`** (standalone)
   - Add exponential backoff with jitter for reconnection
   - Max 30s backoff, reset on successful connect

7. **`emit.ts`** (depends on cache-key, schema, types)
   - Rename `repo`/`gitRoot` -> `app`/`appRoot`
   - Replace `node:fs` with `@side-quest/core/fs`
   - Add rate-limited failure logging
   - Add nonce identity verification via /health
   - Add dual cache path reads (global + legacy side-quest-git)
   - `discoverEventServer()` reads from global port file

8. **`index.ts`** -- barrel export all modules

9. **`cli/index.ts`** -- CLI entry point (OBS-2, ~15 lines)
   - `observability server` command
   - Wire to `startServer()`
   - Add bin entry to packages/server/package.json

### Phase 3: Integration & Polish -- Tests

**Read first:** `specs/plans/obs-1-event-server.md` Parts 4-5

Port tests in order:
1. `cache-key.test.ts` (simplest -- rename functions, update paths)
2. `schema.test.ts` (update EventContext to app/appRoot)
3. `server.test.ts` (rename repoName->appName, add enrichment + CORS + validation tests)
4. `emit.test.ts` (rename cache key fn, update path assertions)

New operational tests:
- Signal handler: PID files removed on SIGTERM
- JSONL rotation: events past 10MB, verify .1 file created
- Ingress validation: invalid payloads return 400
- CORS: OPTIONS preflight returns correct headers
- Nonce identity: /health returns nonce
- Emitter failure logging: rate-limited stderr
- WS backoff: reconnect delay increases with jitter
- Hook event enrichment: all 5 event types map correctly
- Stop recursion guard: stop_hook_active=true returns skipped
- PreToolUse truncation: tool_input > 2000 chars truncated
- Unknown event name: forward-compatible mapping

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
  - Name: builder-scaffold
  - Role: Create repo from template, convert to workspace monorepo
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-extract
  - Role: Extract all event system files with generalizations and hardening
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-tests
  - Role: Port tests and write new operational tests
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-obs1
  - Role: Verify typecheck, tests, lint, build, smoke test
  - Agent Type: enterprise:validator-mccoy
  - Model: haiku
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. Scaffold Workspace Monorepo
- **Task ID**: scaffold-repo
- **Depends On**: none
- **Assigned To**: builder-scaffold
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read `specs/plans/obs-1-event-server.md` Part 1 (sections 1.1-1.6) as source of truth
- Create `~/code/side-quest-observability` from bun-typescript-starter
- Convert to workspace monorepo per spec
- Verify: `bun install && bun run typecheck`

### 2. Extract types.ts + cache-key.ts + schema.ts
- **Task ID**: extract-types
- **Depends On**: scaffold-repo
- **Assigned To**: builder-extract
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read source files from `~/code/side-quest-git/src/events/`
- Read `specs/plans/obs-1-event-server.md` sections 2.1, 2.7, 2.2 for change specs
- Create types.ts with repo->app renames + 5 v1 ClaudeHookEvent members
- Create cache-key.ts with contentId replacement
- Create schema.ts with app/appRoot in createEvent

### 3. Extract store.ts + server.ts
- **Task ID**: extract-server
- **Depends On**: extract-types
- **Assigned To**: builder-extract
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read source files from `~/code/side-quest-git/src/events/`
- Read `specs/plans/obs-1-event-server.md` sections 2.3, 2.4 for change specs
- Create store.ts with rotation + graceful degradation
- Create server.ts with:
  - Global cache model
  - Two POST routes (/:eventName and /events)
  - Enrichment pipeline (enrichHookPayload + handleHookEvent)
  - Signal handlers, nonce, validation, CORS
  - WebSocket with Bun pub/sub
  - GET /events history endpoint
  - GET /health with diagnostics

### 4. Extract client.ts + emit.ts + index.ts + CLI
- **Task ID**: extract-remaining
- **Depends On**: extract-server
- **Assigned To**: builder-extract
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read `specs/plans/obs-1-event-server.md` sections 2.5, 2.6, 2.8
- Read `specs/plans/obs-2-hook-cli.md` section 4
- Create client.ts with exponential backoff + jitter
- Create emit.ts with failure logging + global discovery + nonce verification
- Create index.ts barrel export
- Create cli/index.ts (~15 lines, `observability server` command)
- Add bin entry to packages/server/package.json

### 5. Port + Write Tests
- **Task ID**: write-tests
- **Depends On**: extract-remaining
- **Assigned To**: builder-tests
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read source test files from `~/code/side-quest-git/src/events/*.test.ts`
- Read `specs/plans/obs-1-event-server.md` Parts 4-5 for test specs
- Port: cache-key.test.ts, schema.test.ts, server.test.ts, emit.test.ts
- New: rotation, validation, CORS, signal handler, backoff, enrichment tests
- Verify: `cd packages/server && bun test`

### 6. Validate OBS-1
- **Task ID**: validate-obs1
- **Depends On**: write-tests
- **Assigned To**: validator-obs1
- **Agent Type**: enterprise:validator-mccoy
- **Model**: haiku
- **Parallel**: false
- `cd ~/code/side-quest-observability && bun test`
- `bun run typecheck`
- `bunx biome ci .`
- `cd packages/server && bunx bunup` (build)
- Smoke test: start server, curl /health, POST test events per spec Part 5
- Verify enrichment: POST to /events/session-start returns 201 with enriched envelope
- Verify CORS: OPTIONS preflight returns correct headers
- Verify stop guard: POST stop with stop_hook_active=true returns skipped

## Acceptance Criteria

1. Repo exists at `~/code/side-quest-observability` with workspace monorepo structure
2. `packages/server/src/` contains 8 source files + cli/index.ts
3. All 7 source fields renamed: repo->app, gitRoot->appRoot
4. `EventType` includes 5 v1 `ClaudeHookEvent` members
5. `POST /events/:eventName` enriches raw stdin into EventEnvelopes
6. `POST /events` validates and stores pre-built envelopes
7. Signal handlers clean up PID files on SIGTERM/SIGINT
8. JSONL rotation triggers at 10MB with 5 rotated files max
9. WebSocket uses Bun native pub/sub with type-specific topics
10. CORS headers on all responses
11. Health endpoint includes nonce for identity verification
12. All ported tests pass + all new operational tests pass
13. `bun run typecheck` clean, `bunx biome ci .` clean, build succeeds

## Validation Commands

- `bun test` -- run all tests
- `bunx tsc --noEmit` -- verify no type errors
- `bunx biome ci .` -- lint and format check
- `cd packages/server && bunx bunup` -- build

## Notes

- This spec covers PR1 only. PR2 (three-tier CIDs, remaining 9 events, cache GC) is future work.
- The server uses a global model -- one server for all projects, port file at `~/.cache/side-quest-observability/events.port`.
- `@side-quest/core` version `^0.4.0` is required.
- Minimum Bun version `>=1.3.7` for `Bun.JSONL.parse` (declared in engines field).
- The enrichment pipeline is inlined in server.ts (no separate enrichment.ts) per OBS-1 review.
