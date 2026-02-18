# Plan: Observability System -- Coordinator

## Task Description

Coordinate the implementation of the Enterprise Agent Observability system across 6 domains. This is the master execution plan that defines ordering, dependencies, and team composition for building `@side-quest/observability` (new repo) and `plugins/observability/` (new plugin in side-quest-plugins).

## Objective

Deliver a working end-to-end observability pipeline: Claude Code hook events stream through a self-contained plugin hook, into an event server with enrichment, out through WebSocket to a Vue 3 real-time dashboard, with optional voice feedback via pre-generated TTS clips.

## Problem Statement

The enterprise plugin has only a retrospective Stop hook (`captains-log.ts`). No real-time visibility into agent activity during sessions. The observability system adds real-time streaming of all 5 v1 hook events (SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, Stop) with a dashboard and voice notifications.

## Solution Approach

6 domain specs executed in dependency order, with parallelism where possible. Each domain has its own implementation spec with team assignments. This coordinator defines the execution graph and cross-domain contracts.

## Relevant Files

- `specs/plans/observability-master-plan.md` -- architecture, data flow, extraction plan
- `specs/plans/obs-1-event-server.md` -- server extraction + enrichment pipeline
- `specs/plans/obs-2-hook-cli.md` -- CLI entry point (thin wrapper)
- `specs/plans/obs-3-plugin-registration.md` -- plugin scaffold + self-contained hook
- `specs/plans/obs-4-vue-dashboard.md` -- Vue 3 real-time dashboard
- `specs/plans/obs-5-server-devops.md` -- static serving + justfile
- `specs/plans/obs-6-voice-tts.md` -- pre-generated TTS clips + playback queue
- `~/code/side-quest-git/src/events/` -- 7 source files + 4 test files to extract
- `plugins/enterprise/hooks/captains-log.ts` -- coexisting Stop hook (unchanged)
- `~/code/bun-typescript-starter/` -- template for new repo scaffold

### New Files

- `specs/obs-1-event-server-impl.md` -- OBS-1 implementation spec
- `specs/obs-2-hook-cli-impl.md` -- OBS-2 implementation spec
- `specs/obs-3-plugin-registration-impl.md` -- OBS-3 implementation spec
- `specs/obs-4-vue-dashboard-impl.md` -- OBS-4 implementation spec
- `specs/obs-5-server-devops-impl.md` -- OBS-5 implementation spec
- `specs/obs-6-voice-tts-impl.md` -- OBS-6 implementation spec

## Implementation Phases

### Phase 1: Foundation (OBS-1 + OBS-2)

OBS-1 is the critical path. Everything depends on the event server.

```
OBS-1: Scaffold repo + extract event system + enrichment pipeline
  |
  +-- OBS-2: CLI entry point (ships as part of OBS-1 repo, ~15 lines)
```

OBS-2 is so thin it can be a task within OBS-1's implementation, but has its own spec for traceability.

### Phase 2: Hook + Dashboard (OBS-3 + OBS-4 in parallel)

Once OBS-1's server is running, these two domains are independent:

```
OBS-1 complete
  |
  +-- OBS-3: Plugin scaffold + emit-event.ts (in side-quest-plugins repo)
  |
  +-- OBS-4: Vue 3 dashboard (in side-quest-observability/packages/client/)
```

OBS-3 only needs the server's `POST /events/:eventName` route.
OBS-4 only needs the server's `GET /events` + `ws://` endpoints.

### Phase 3: Integration & Polish (OBS-5 + OBS-6 in parallel)

Once the dashboard is built and the server is stable:

```
OBS-1 + OBS-4 complete
  |
  +-- OBS-5: Static file serving + justfile (touches server.ts + adds justfile)
  |
  +-- OBS-6: Voice TTS (adds voice/ directory to server package)
```

## Execution Dependency Graph

```
OBS-1 (Event Server) ----+
  |                       |
  +-- OBS-2 (CLI) --------+-- OBS-3 (Plugin)
                          |
                          +-- OBS-4 (Dashboard)
                               |
                               +-- OBS-5 (DevOps)
                               |
                          +-- OBS-6 (Voice TTS)
```

**Parallelism opportunities:**
- OBS-3 and OBS-4 can run in parallel after OBS-1
- OBS-5 and OBS-6 can run in parallel after OBS-4

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. Use Task and Task* tools only.
- Take note of the session id (agentId) of each team member for resume operations.

### Model Selection Guide

| Role | Model | Rationale |
|------|-------|-----------|
| All builders | sonnet | Executes well-specified tasks reliably |
| All validators | opus | Semantic code review requires strongest reasoning for edge cases, convention violations, and logic errors |

### Team Members

- Builder
  - Name: builder-obs1-scaffold
  - Role: Scaffold side-quest-observability repo from bun-typescript-starter template
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-obs1-extract
  - Role: Extract event system files from side-quest-git, generalize, add operational hardening
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-obs1
  - Role: Verify OBS-1 typecheck, tests, lint, build pass
  - Agent Type: enterprise:validator-mccoy
  - Model: opus
  - Resume: true

- Builder
  - Name: builder-obs3
  - Role: Create observability plugin with self-contained hook in side-quest-plugins
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-obs4
  - Role: Build Vue 3 real-time dashboard with LCARS-inspired dark theme
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-obs4
  - Role: Verify OBS-4 builds, renders, connects to server
  - Agent Type: enterprise:validator-mccoy
  - Model: opus
  - Resume: true

- Builder
  - Name: builder-obs5
  - Role: Add static file serving + justfile to observability server
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-obs6
  - Role: Build voice TTS system with playback queue and pre-generated clips
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-final
  - Role: Full system integration validation across all domains
  - Agent Type: enterprise:validator-mccoy
  - Model: opus
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. Scaffold Observability Repo
- **Task ID**: obs1-scaffold
- **Depends On**: none
- **Assigned To**: builder-obs1-scaffold
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Fork bun-typescript-starter as side-quest-observability
- Convert to workspace monorepo (packages/server, packages/client)
- Configure tsconfig, bunup, package.json per OBS-1 spec Part 1
- Verify: `bun install`, `bun run typecheck`

### 2. Extract Event System
- **Task ID**: obs1-extract
- **Depends On**: obs1-scaffold
- **Assigned To**: builder-obs1-extract
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Extract 7 files from side-quest-git/src/events/ per OBS-1 spec Part 2
- Rename repo/gitRoot to app/appRoot throughout
- Add 5 v1 ClaudeHookEvent types
- Add enrichment pipeline (POST /events/:eventName handler)
- Add operational hardening (signal handlers, JSONL rotation, validation, CORS, nonce)
- Add WS backoff with jitter to client.ts
- Add failure logging to emit.ts
- Create barrel export index.ts

### 3. Port and Write Tests for Event System
- **Task ID**: obs1-tests
- **Depends On**: obs1-extract
- **Assigned To**: builder-obs1-extract
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Port 4 test files from side-quest-git (cache-key, schema, server, emit)
- Add new tests: rotation, validation, CORS, signal handlers, backoff, enrichment
- Verify: all tests pass

### 4. Add CLI Entry Point (OBS-2)
- **Task ID**: obs2-cli
- **Depends On**: obs1-extract
- **Assigned To**: builder-obs1-extract
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: true (with obs1-tests)
- Create packages/server/src/cli/index.ts (~15 lines)
- Wire `observability server` command to startServer()
- Add bin entry to package.json

### 5. Validate OBS-1 + OBS-2
- **Task ID**: validate-obs1
- **Depends On**: obs1-tests, obs2-cli
- **Assigned To**: validator-obs1
- **Agent Type**: enterprise:validator-mccoy
- **Model**: opus
- **Parallel**: false
- `bun test` in packages/server -- all tests pass
- `bun run typecheck` -- clean
- `bunx biome ci .` -- no lint errors
- `bun run build` in packages/server -- builds successfully
- Smoke test: start server, curl /health, POST test events, verify WS broadcast

### 6. Create Observability Plugin (OBS-3)
- **Task ID**: obs3-plugin
- **Depends On**: validate-obs1
- **Assigned To**: builder-obs3
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: true (with obs4-dashboard)
- Create plugins/observability/plugin.json
- Create plugins/observability/hooks/hooks.json (5 v1 registrations)
- Create plugins/observability/hooks/emit-event.ts (self-contained, ~50 lines, zero deps)
- Verify: `echo '{}' | bun run emit-event.ts 2>/dev/null; echo $?` exits 0

### 7. Build Vue Dashboard (OBS-4)
- **Task ID**: obs4-dashboard
- **Depends On**: validate-obs1
- **Assigned To**: builder-obs4
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: true (with obs3-plugin)
- MUST load frontend-design skill and design-guide skill references
- MUST read globals.css token system from OBS-4 spec section 4
- Phase 1: Scaffold + design system (package.json, vite, globals.css, types, config)
- Phase 2: Event streaming (useEventStream composable, EventCard, EventFeed)
- Phase 3: Polish (SessionHeader, inline filter, expand/collapse JSON, agent badges)
- Use shallowRef for events, batch WS messages, rate-aware TransitionGroup
- Verify: `bun dev` runs, dark background renders, events stream with correct colors

### 8. Validate OBS-3 + OBS-4
- **Task ID**: validate-obs3-obs4
- **Depends On**: obs3-plugin, obs4-dashboard
- **Assigned To**: validator-obs4
- **Agent Type**: enterprise:validator-mccoy
- **Model**: opus
- **Parallel**: false
- OBS-3: hooks.json valid JSON, emit-event.ts has zero external imports, exits 0
- OBS-4: `bun run build` succeeds, `vue-tsc` passes, dashboard connects to server

### 9. Add Static Serving + Justfile (OBS-5)
- **Task ID**: obs5-devops
- **Depends On**: validate-obs3-obs4
- **Assigned To**: builder-obs5
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: true (with obs6-voice)
- Add static file serving fallback in server.ts (after API routes)
- Create justfile with 9 recipes (dev, build-client, build, test, typecheck, validate, health, test-event, db-reset)
- Verify: `just build-client && just dev` serves dashboard at http://127.0.0.1:7483

### 10. Build Voice TTS System (OBS-6)
- **Task ID**: obs6-voice
- **Depends On**: validate-obs1
- **Assigned To**: builder-obs6
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: true (with obs5-devops)
- Create packages/server/src/voice/ (types, voices, cache, queue, router, config, index)
- Write queue.test.ts and router.test.ts
- Wire voice route + SIGTERM cleanup + in-process triggerVoice into server.ts
- Create scripts/generate-clips.ts
- Verify: queue tests pass, POST /voice/notify returns correct responses

### 11. Final Validation
- **Task ID**: validate-all
- **Depends On**: obs5-devops, obs6-voice
- **Assigned To**: validator-final
- **Agent Type**: enterprise:validator-mccoy
- **Model**: opus
- **Parallel**: false
- `bun test` -- all tests pass across packages/server
- `bun run typecheck` -- clean
- `bunx biome ci .` -- no lint errors
- `just build` -- server + client build successfully
- `just dev` -- server starts, dashboard loads at root
- `just health` -- returns UP with voice status
- `just test-event` -- event appears in dashboard
- End-to-end: start server, pipe mock stdin to emit-event.ts, verify event in dashboard
- Verify captains-log.ts coexistence (enterprise hooks unchanged)

## Acceptance Criteria

1. `~/code/side-quest-observability` repo exists with workspace monorepo structure
2. `packages/server/` contains extracted + generalized event system with all tests passing
3. Server handles `POST /events/:eventName` (raw hook stdin) and `POST /events` (pre-built envelopes)
4. Server broadcasts events via WebSocket to connected clients
5. `plugins/observability/` in side-quest-plugins has 3 files, zero external dependencies
6. emit-event.ts reads stdin, POSTs raw JSON to server, exits 0
7. Vue 3 dashboard renders real-time event stream with LCARS-inspired dark theme
8. Dashboard connects via HTTP (history) + WebSocket (live) with auto-reconnect
9. Server serves built dashboard as static files from `GET /`
10. Justfile provides 9 developer recipes for foreground operation
11. Voice system plays pre-generated clips on Stop events via serial playback queue
12. Enterprise captains-log.ts is completely unchanged and coexists
13. `bun test`, `bun run typecheck`, `bunx biome ci .` all pass

## Validation Commands

- `bun test` -- run all tests
- `bunx tsc --noEmit` -- verify no type errors
- `bunx biome ci .` -- lint and format check
- `just build` -- build server + client
- `just health` -- verify server running
- `just test-event` -- end-to-end event pipeline

## Notes

- OBS-1 is split into PR1 (mechanical extraction) and PR2 (generalization). This plan covers PR1 only.
- The observability repo is private (`"private": true`) -- not published to npm.
- The hook has zero external dependencies -- marketplace-compatible.
- Voice v1 only triggers on Stop (generic "session complete"). Per-agent voice requires SubagentStart/SubagentStop (OBS-1 PR2).
- Two repos are touched: `side-quest-observability` (new) and `side-quest-plugins` (OBS-3 plugin).
