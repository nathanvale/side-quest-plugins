# Observability System -- Session Log

This document tracks completed work across the observability build. After each phase, a review prompt is included so a fresh agent can validate everything without prior context.

---

## Phase 1: OBS-1 Event Server Extraction + OBS-2 CLI (COMPLETE)

**Date:** 2026-02-18
**Repos touched:**
- `~/code/side-quest-observability` (new, created from bun-typescript-starter)
- `~/code/side-quest-plugins` (spec updates only)

**GitHub:** https://github.com/nathanvale/side-quest-observability (public)
**Initial commit:** `e04ab2d` on main

### What was done

1. **Updated all validator models** from haiku to opus across 7 spec files:
   - `specs/obs-coordinator.md`
   - `specs/obs-1-event-server-impl.md`
   - `specs/obs-2-hook-cli-impl.md`
   - `specs/obs-3-plugin-registration-impl.md`
   - `specs/obs-4-vue-dashboard-impl.md`
   - `specs/obs-5-server-devops-impl.md`
   - `specs/obs-6-voice-tts-impl.md`

2. **Scaffolded workspace monorepo** at `~/code/side-quest-observability`:
   - Copied from `~/code/bun-typescript-starter`, reinitialized git
   - Root package.json: `@side-quest/observability`, `"private": true`, `"workspaces": ["packages/*"]`, `"engines": { "bun": ">=1.3.7" }`
   - Removed root `bunup.config.ts`, `src/`, `tests/` (belong in sub-packages)
   - Created `packages/server/` with package.json, bunup.config.ts, tsconfig.json
   - Created `packages/client/` as placeholder for OBS-4

3. **Extracted 7 source files** from `~/code/side-quest-git/src/events/` into `packages/server/src/`:

   | File | Lines | Key changes from original |
   |---|---|---|
   | `types.ts` | 124 | `repo`->`app`, `gitRoot`->`appRoot`, added 14 ClaudeHookEvent types, `(string & {})` escape hatch |
   | `cache-key.ts` | 62 | `getRepoCacheKey`->`getAppCacheKey`, manual SHA256 replaced with `contentId` from `@side-quest/core/hash` |
   | `schema.ts` | 55 | `createEvent` uses `app`/`appRoot`, correlationId from `@side-quest/core/instrumentation` |
   | `store.ts` | 209 | Added JSONL rotation (10MB, 5 files), graceful degradation on persist failure, `persistErrors` counter |
   | `server.ts` | 696 | Global cache model, two POST routes, enrichment pipeline, CORS, signal handlers, nonce, WebSocket pub/sub |
   | `client.ts` | 129 | Added exponential backoff with jitter (1s base, 30s max, 0-1000ms jitter) |
   | `emit.ts` | 207 | Rate-limited failure logging, global server discovery, legacy fallback path |

4. **Created CLI entry point** at `packages/server/src/cli/index.ts` (~37 lines):
   - `observability server [--port PORT]` command
   - Wired to `startServer()` from server.ts
   - bin entry in packages/server/package.json

5. **Created barrel export** at `packages/server/src/index.ts` re-exporting all 7 modules

6. **Ported 4 test files + wrote new operational tests** (67 total):
   - `cache-key.test.ts` -- deterministic hashing, cache dir path
   - `schema.test.ts` -- createEvent factory, unique IDs, ISO timestamps
   - `server.test.ts` -- HTTP routes, enrichment pipeline, CORS, validation, health, WebSocket
   - `emit.test.ts` -- fire-and-forget, rate-limited logging, server discovery

7. **Validated with McCoy (opus):** PASS
   - 67 tests passing
   - Typecheck clean
   - Build succeeds
   - Smoke test: server starts, /health responds, enrichment works, CORS works, stop guard works

8. **Pushed to GitHub** and created 3 issues:
   - [#1](https://github.com/nathanvale/side-quest-observability/issues/1) -- Harden envelope validation on POST /events
   - [#2](https://github.com/nathanvale/side-quest-observability/issues/2) -- Body size guard bypassed by chunked encoding
   - [#3](https://github.com/nathanvale/side-quest-observability/issues/3) -- Clean up template artifacts from scaffold

### Architecture: "Dumb Hook, Smart Server"

```
Claude Code Session
  |-- [any hook event] --> bun run emit-event.ts <event-name>
                                |
                                +--> reads stdin (raw JSON)
                                |
                                +--> POST http://127.0.0.1:7483/events/{event-name}
                                          |
                                  Server enrichment pipeline:
                                    1. Map event name -> EventType
                                    2. Extract event-specific fields
                                    3. Truncate large fields (>2000 chars)
                                    4. Check stop_hook_active guard
                                    5. Generate EventEnvelope (id, timestamp, correlationId)
                                          |
                                  EventStore (ring buffer + JSONL)
                                          |
                                  WebSocket broadcast --> Vue dashboard (OBS-4, not yet built)
```

### Known issues from validation (non-blocking, tracked in GitHub)

1. `POST /events` full envelope path trusts all fields via cast -- no validation of id/timestamp (issue #1)
2. Content-Length body size guard can be bypassed with chunked encoding (issue #2)
3. Template artifacts still present: tsconfig.eslint.json, scripts/setup.ts, README.md (issue #3)
4. `serverNonce` declared after `Bun.serve()` but referenced in closure -- works but fragile
5. `await` on non-Promise in CLI -- harmless

---

### Phase 1 Review Prompt

Use this prompt to have a fresh agent fully review Phase 1:

```
## Review Mission: OBS-1 Event Server + OBS-2 CLI

You are reviewing the Phase 1 output of the observability system build.
Your job is to perform a thorough code review and integration check.

### Context

The event system was extracted from `~/code/side-quest-git/src/events/` (7 source files,
4 test files) into a new `~/code/side-quest-observability` repo scaffolded from
`bun-typescript-starter`. The repo is a workspace monorepo with `packages/server/`
(event server) and `packages/client/` (placeholder for Vue dashboard).

Key architecture decision: "dumb hook, smart server" -- hooks are ~50-line scripts
with zero external dependencies that POST raw stdin to the server. The server handles
all enrichment (type mapping, field extraction, truncation, envelope generation).

### What to review

**1. Spec compliance** -- Read these specs and verify the implementation matches:
- `/Users/nathanvale/code/side-quest-plugins/specs/plans/obs-1-event-server.md` (full plan)
- `/Users/nathanvale/code/side-quest-plugins/specs/obs-1-event-server-impl.md` (impl spec)
- `/Users/nathanvale/code/side-quest-plugins/specs/plans/obs-2-hook-cli.md` (CLI spec)
- `/Users/nathanvale/code/side-quest-plugins/specs/plans/observability-master-plan.md` (architecture)

**2. Source files to review** (all in `~/code/side-quest-observability/packages/server/src/`):
- `types.ts` -- Verify EventType union includes all 14 ClaudeHookEvent + WorktreeEvent + SessionEvent + (string & {})
- `cache-key.ts` -- Verify contentId usage, cache dir path is side-quest-observability
- `schema.ts` -- Verify createEvent produces valid envelopes with app/appRoot
- `store.ts` -- Verify JSONL rotation (10MB, 5 files), graceful degradation, persistErrors counter
- `server.ts` -- THE BIG ONE:
  - Two POST routes: /events/:eventName (raw hook stdin) and /events (pre-built envelopes)
  - Enrichment pipeline: mapEventName, extractEventFields, truncateField
  - stop_hook_active recursion guard
  - CORS headers on ALL responses including OPTIONS preflight
  - Signal handlers (SIGTERM/SIGINT) clean up PID files
  - Nonce identity in /health
  - Ingress validation (400 for bad payloads)
  - WebSocket with Bun native pub/sub, type-specific topics
  - GET /events with ?type, ?since, ?limit query params
  - GET /health with nonce, uptime, events stats, persistErrors, wsClients
- `client.ts` -- Verify exponential backoff with jitter (1s base, 30s max)
- `emit.ts` -- Verify rate-limited failure logging, global server discovery, legacy fallback
- `index.ts` -- Barrel exports all 7 modules
- `cli/index.ts` -- CLI: `observability server [--port PORT]`

**3. Test files** (co-located with source):
- `cache-key.test.ts`, `schema.test.ts`, `server.test.ts`, `emit.test.ts`
- Run: `cd ~/code/side-quest-observability && bun test`

**4. Monorepo structure**:
- Root package.json: workspaces, engines, private
- packages/server/package.json: dependencies, bin entry, scripts
- packages/client/package.json: placeholder
- tsconfig.json: project references
- biome.json: root-level only

**5. Rename completeness**: Grep for any remaining `repo`, `gitRoot`, `repoName` in source
files (not JSDoc/comments). All should be `app`, `appRoot`, `appName`.

**6. Known issues** (already tracked, verify they exist):
- GitHub issue #1: POST /events trusts envelope fields via cast
- GitHub issue #2: Content-Length body size guard bypassable
- GitHub issue #3: Template artifacts to clean up

### Validation commands

Run these and report results:
- `cd ~/code/side-quest-observability && bun test`
- `cd ~/code/side-quest-observability && bun run typecheck`
- `cd ~/code/side-quest-observability && bunx biome ci .`
- `cd ~/code/side-quest-observability/packages/server && bunx bunup`

### Smoke test

Start the server and hit endpoints:
- `bun run packages/server/src/cli/index.ts server &`
- `curl http://127.0.0.1:7483/health`
- `curl -X POST http://127.0.0.1:7483/events/session-start -H "Content-Type: application/json" -d '{"session_id":"review-test","model":"claude-sonnet-4-6"}'`
- `curl -X POST http://127.0.0.1:7483/events/stop -H "Content-Type: application/json" -d '{"session_id":"review-test","stop_hook_active":true}'`
- `curl http://127.0.0.1:7483/events`
- `curl -X OPTIONS http://127.0.0.1:7483/events -I`
- Kill the server and verify PID files are cleaned up

### Output format

Report PASS or FAIL for each category:
1. Spec compliance
2. Code quality (conventions, JSDoc, error handling)
3. Test coverage and correctness
4. Monorepo structure
5. Rename completeness
6. Build pipeline (typecheck, lint, build)
7. Smoke test
8. Security review (input validation, injection risks)

For any FAIL, provide: file, line, issue description, suggested fix.
```

---

## Phase 2: OBS-3 Plugin + OBS-4 Dashboard (COMPLETE)

**Date:** 2026-02-18
**Repos touched:**
- `~/code/side-quest-plugins` (new `plugins/observability/` directory)
- `~/code/side-quest-observability` (new `packages/client/` content)

**Commits:**
- side-quest-plugins: `cfc321c` -- OBS-3 observability plugin
- side-quest-observability: `b07e3f9` -- OBS-4 Vue dashboard (pushed to GitHub)

### What was done

**OBS-3 and OBS-4 were built in parallel** (two sonnet builders running concurrently).

#### OBS-3: Observability Plugin (3 files, zero deps)

Created `plugins/observability/` in side-quest-plugins:

| File | Lines | Purpose |
|---|---|---|
| `plugin.json` | 5 | Plugin registration (name, description, version) |
| `hooks/hooks.json` | 68 | 5 v1 hook registrations with `bun run` commands |
| `hooks/emit-event.ts` | 85 | Self-contained dumb pipe -- reads stdin, POSTs to server, exits 0 |

Key design:
- `async: true` on high-frequency hooks (PreToolUse, PostToolUse, PostToolUseFailure)
- Synchronous for SessionStart and Stop (ordering matters)
- All matchers `*` (captures all agents from all plugins)
- Self-destruct timer at 4500ms (first executable line)
- `SIDE_QUEST_EVENTS=0` kill switch, `SIDE_QUEST_HOOK_DEBUG=1` debug logging
- 1MB stdin cap for OOM protection
- 500ms fetch abort (localhost = sub-100ms expected)
- Graceful degradation: exits 0 if server down, port file missing, stdin empty

#### OBS-4: Vue 3 Dashboard

Created full dashboard in `packages/client/`:

| File | Purpose |
|---|---|
| `package.json` | Vue 3.5, Vite 7, Tailwind v4, vue-tsc |
| `vite.config.ts` | Vue + Tailwind plugins, CORS direct (no proxy) |
| `index.html` | SPA entry point |
| `tsconfig.json` | Split references (tsconfig.app.json + tsconfig.node.json) |
| `src/types.ts` | Client types matching server EventEnvelope exactly |
| `src/config.ts` | Server URL + max events from VITE_* env vars |
| `src/styles/globals.css` | Two-tier design token system (primitives + semantic), LCARS dark theme |
| `src/main.ts` | createApp mount |
| `src/composables/useEventStream.ts` | WebSocket streaming with rAF batch flush, exponential backoff, tab visibility, history dedup |
| `src/components/EventCard.vue` | Left border colors, badges, expandable JSON, copy button |
| `src/components/EventFeed.vue` | Auto-scroll, TransitionGroup (disabled >300 events/min), empty state |
| `src/components/SessionHeader.vue` | Sticky glassmorphism header, double-layer pulsing connection dot, events/min, filter |
| `src/App.vue` | Wires all components, filteredEvents computed |

Key features:
- `shallowRef` for events (not deep reactive) -- performance
- rAF batch flush for WS messages
- Tab visibility API defers rendering when hidden
- History deduplication on reconnect
- TransitionGroup disabled at high event rates
- Accessibility: `role="log"`, `aria-live="polite"`, `role="status"` on connection dot
- Build: vue-tsc clean, vite build 84kB JS

### Validation (McCoy, opus): PASS

**OBS-3:**
- All JSON files valid
- Zero external npm imports confirmed
- Self-destruct timer correctly positioned
- Hook exits 0 with no server running
- Enterprise captains-log.ts unchanged (286 lines)

**OBS-4:**
- `vue-tsc -b` passes cleanly
- `bun run build` succeeds (21 modules, 84kB JS)
- Client types match server EventEnvelope exactly
- WebSocket reconnection: exponential backoff + jitter, capped at 30s
- shallowRef confirmed for events array
- Auto-scroll with manual override and "Jump to latest" button
- All colors via CSS custom properties (no hardcoded values)
- Double-layer pulsing connection indicator

### Known notes (non-blocking)

1. Biome flags `@source` and `@theme` in globals.css as Tailwind-specific syntax -- needs a one-line root biome.json update
2. `tsconfig.node.json` doesn't extend `@tsconfig/node22` (not installed) -- uses inline equivalent

---

### Phase 2 Review Prompt

Use this prompt to have a fresh agent fully review Phase 2:

```
## Review Mission: OBS-3 Plugin + OBS-4 Dashboard

You are reviewing Phase 2 of the observability system build.
Two domains were built in parallel and validated.

### Context

OBS-3 creates a plugin in side-quest-plugins that registers 5 Claude Code hooks.
Each hook runs a self-contained script (emit-event.ts) with zero external dependencies
that reads stdin and POSTs raw JSON to the observability server (built in Phase 1).

OBS-4 creates a Vue 3 real-time dashboard that connects to the server via HTTP (history)
and WebSocket (live streaming) to display events with an LCARS-inspired dark theme.

### What to review

**OBS-3 Plugin** (in `/Users/nathanvale/code/side-quest-plugins/plugins/observability/`):

Read all 3 files:
- `plugin.json` -- valid JSON, has name/description/version
- `hooks/hooks.json` -- 5 registrations, async flags correct, matchers all `*`
- `hooks/emit-event.ts` -- THE KEY FILE:
  - MUST have zero external npm imports (only node: builtins + Bun globals)
  - Self-destruct timer MUST be first executable line
  - Exits 0 in ALL error paths (never blocks Claude Code)
  - Reads stdin, POSTs to http://127.0.0.1:{port}/events/{event-name}
  - Graceful degradation when server is down
  - Kill switch: SIDE_QUEST_EVENTS=0
  - OOM protection: 1MB stdin cap
  - Fetch timeout: 500ms abort

Verify coexistence:
- `/Users/nathanvale/code/side-quest-plugins/plugins/enterprise/hooks/captains-log.ts` MUST be unchanged
- `/Users/nathanvale/code/side-quest-plugins/plugins/enterprise/hooks/hooks.json` MUST be unchanged

Run:
- `python3 -m json.tool < plugins/observability/plugin.json`
- `python3 -m json.tool < plugins/observability/hooks/hooks.json`
- `echo '{}' | timeout 10 bun run plugins/observability/hooks/emit-event.ts session-start 2>/dev/null; echo $?`
- `grep "from '" plugins/observability/hooks/emit-event.ts | grep -v "node:"` (should be empty)

**OBS-4 Dashboard** (in `~/code/side-quest-observability/packages/client/`):

Read specs first:
- `/Users/nathanvale/code/side-quest-plugins/specs/plans/obs-4-vue-dashboard.md`

Read all source files:
- `package.json`, `vite.config.ts`, `index.html`, `tsconfig.json`, `tsconfig.app.json`
- `src/main.ts`, `src/types.ts`, `src/config.ts`, `src/styles/globals.css`
- `src/App.vue`
- `src/composables/useEventStream.ts` -- THE KEY FILE:
  - shallowRef for events (not ref)
  - WebSocket with exponential backoff + jitter
  - rAF batch flush for incoming messages
  - History fetch + deduplication on reconnect
  - Tab visibility API
  - Max events cap (drop oldest)
- `src/components/EventCard.vue` -- left border colors, expandable JSON, badges
- `src/components/EventFeed.vue` -- auto-scroll, TransitionGroup, empty state
- `src/components/SessionHeader.vue` -- connection indicator, events/min, filter

Verify types match server:
- Compare `packages/client/src/types.ts` with `packages/server/src/types.ts`
- EventEnvelope fields MUST be identical

Run:
- `cd ~/code/side-quest-observability && bun install`
- `cd packages/client && bun run build`
- `cd packages/client && bunx vue-tsc -b`

### Output format

Report PASS or FAIL for each:
1. OBS-3 plugin.json + hooks.json validity
2. OBS-3 emit-event.ts zero-dependency compliance
3. OBS-3 graceful degradation (exits 0 in all paths)
4. OBS-3 coexistence (enterprise hooks unchanged)
5. OBS-4 build pipeline (vue-tsc + vite build)
6. OBS-4 type compatibility with server
7. OBS-4 WebSocket streaming (backoff, batching, dedup)
8. OBS-4 design system (CSS custom properties, no hardcoded colors)
9. OBS-4 accessibility (ARIA roles, labels)
10. OBS-4 performance (shallowRef, rAF, TransitionGroup rate limiting)

For any FAIL, provide: file, line, issue description, suggested fix.
```

---

## Phase 3: OBS-5 DevOps + OBS-6 Voice TTS (COMPLETE)

**Date:** 2026-02-18
**Repos touched:**
- `~/code/side-quest-observability` (static serving, justfile, voice system, fixes)

**Commits:**
- side-quest-observability: `cef045d` -- Phase 3 complete (pushed to GitHub)

### What was done

**OBS-5 and OBS-6 were built in parallel**, then validation caught 3 issues that were fixed and re-validated.

#### OBS-5: Static File Serving + Justfile

- Added `serveStaticFile()` to server.ts as the LAST handler in the fetch chain
- Resolves `clientDistDir` via `import.meta.dir` (module-relative)
- SPA fallback: unmatched non-API routes serve `index.html`
- Cache headers: `immutable` for hashed assets, `no-cache` for index.html
- Graceful degradation: missing `dist/` returns 404 without crashing API routes

Created `justfile` with 13 recipes:
- `dev` -- `bun run --watch` for auto-restart
- `build-client` -- Vue dashboard production build
- `build` -- client + server
- `test`, `typecheck`, `validate` -- quality checks
- `health`, `test-event` -- smoke testing
- `db-reset` -- event database reset (guards against running server)
- `voice-generate`, `voice-dry-run`, `voice-clear` -- voice clip management

#### OBS-6: Voice TTS System

Created `packages/server/src/voice/` with 9 files:

| File | Lines | Purpose |
|---|---|---|
| `types.ts` | 52 | VoiceNotification, QueueItem, VoiceSystemConfig |
| `voices.ts` | 105 | 5 characters with phrases, selectPhrase() |
| `config.ts` | 42 | loadVoiceConfig() from SIDE_QUEST_VOICE env |
| `cache.ts` | 88 | Disk cache with contentId hash, null-on-failure |
| `queue.ts` | 148 | PlaybackQueue -- FIFO, maxDepth, maxAge, timeout, stop() |
| `router.ts` | 83 | handleVoiceNotify routing logic |
| `index.ts` | 17 | Barrel export |
| `queue.test.ts` | 9 tests | Queue behavior tests |
| `router.test.ts` | 12 tests | Router logic tests |

Server integration:
- `POST /voice/notify` route for external consumers
- `triggerVoice()` in-process function for Stop events (Computer voice)
- afplay probed at startup with warning if missing
- Voice status in `/health` endpoint
- `queue.stop()` on SIGTERM

Created `scripts/generate-clips.ts` with `--dry-run` and `--play` flags.

Characters (voice IDs are TBD placeholders):
- Scotty (enterprise:builder-scotty)
- McCoy (enterprise:validator-mccoy)
- Spock (enterprise:API)
- Computer (enterprise:ships-computer-cpu)
- Beat Reporter (newsroom:beat-reporter)

#### Validation: FAIL then PASS

**First validation (McCoy, opus): FAIL** -- 3 issues:

1. **POST /voice/notify returned HTML when voice disabled** -- route condition `&& playbackQueue` caused fallthrough to SPA catch-all. Fixed: removed guard, return JSON directly.
2. **Biome lint errors** -- 7 files with auto-fixable issues. Fixed: `biome check --write`.
3. **Voice router responses missing CORS headers** -- Fixed: wrapped in server.ts with CORS_HEADERS (keeping CORS as server concern).

**Second validation (McCoy, opus): PASS** -- all 3 fixes verified. 88 tests pass.

### Known notes (non-blocking)

1. Vue client typecheck (`tsc --build`) fails on `App.vue` import -- needs `vue-tsc` not `tsc`. Root typecheck script needs updating.
2. Voice IDs in VOICE_MAP are `TBD_*` placeholders -- real ElevenLabs IDs needed for actual audio
3. `globals.css` has Tailwind `@theme`/`@source` syntax that biome flags -- expected, unfixable by biome

---

### Phase 3 Review Prompt

Use this prompt to have a fresh agent fully review Phase 3:

```
## Review Mission: OBS-5 DevOps + OBS-6 Voice TTS

You are reviewing Phase 3 of the observability system build.
Two domains were built in parallel, validated, had 3 fixes applied, then re-validated.

### Context

OBS-5 adds static file serving (built Vue dashboard from GET /) and a justfile with
13 developer recipes. OBS-6 adds a voice TTS system with pre-generated clip infrastructure,
a serial playback queue, and server integration.

The voice system is completely optional -- SIDE_QUEST_VOICE=off disables it with zero overhead.

### What to review

**OBS-5 Static Serving** (in `~/code/side-quest-observability/packages/server/src/server.ts`):

- Find the `serveStaticFile` function -- verify it's LAST in the fetch handler (after all API routes)
- SPA fallback: non-API unmatched routes serve index.html
- Cache headers: immutable for hashed assets, no-cache for index.html
- Graceful degradation: missing dist/ doesn't crash API routes
- Content-Type detection for common file extensions

**OBS-5 Justfile** (in `~/code/side-quest-observability/justfile`):

- 13 recipes present and correctly structured
- `dev` uses `bun run --watch`
- `db-reset` guards against running server (checks PID file)
- `test-event` uses correct schema
- `voice-*` recipes for clip management

**OBS-6 Voice System** (in `~/code/side-quest-observability/packages/server/src/voice/`):

Read all files:
- `types.ts` -- VoiceNotification, QueueItem, VoiceSystemConfig
- `voices.ts` -- 5 characters, selectPhrase() with flat random
- `config.ts` -- loadVoiceConfig() reads SIDE_QUEST_VOICE env
- `cache.ts` -- contentId hash, null-on-failure contract (NEVER throws)
- `queue.ts` -- THE KEY FILE:
  - FIFO serial processing via afplay
  - maxDepth (reject if full), maxAge (skip stale), playbackTimeout (kill hung afplay)
  - stop() kills current process and clears queue
  - try/finally in drain loop (always processes next)
  - Drain runs automatically on enqueue
- `router.ts` -- handleVoiceNotify routing
- `index.ts` -- barrel export
- `queue.test.ts` -- 9 tests
- `router.test.ts` -- 12 tests

**Server integration** (in `server.ts`):
- POST /voice/notify route -- returns JSON even when voice disabled
- triggerVoice() called on Stop events
- PlaybackQueue created at startup (null when voice off)
- afplay probed at startup
- Voice status in /health
- queue.stop() on SIGTERM
- CORS headers on voice responses (applied in server.ts wrapper)

**Scripts:**
- `scripts/generate-clips.ts` -- iterates VOICE_MAP, --dry-run and --play flags

### Validation commands

Run:
- `cd ~/code/side-quest-observability && bun test` (88 tests expected)
- `cd ~/code/side-quest-observability && bunx biome ci packages/server/`
- `cd ~/code/side-quest-observability && just --list`

Smoke test with voice disabled:
- `SIDE_QUEST_VOICE=off bun run packages/server/src/cli/index.ts server &`
- `curl -s -X POST http://127.0.0.1:7483/voice/notify -H "Content-Type: application/json" -d '{"agentType":"enterprise:builder-scotty","phase":"start"}'`
  (MUST return JSON with `queued: false, reason: voice_disabled`)
- `curl -s http://127.0.0.1:7483/health` (MUST include voice status)
- `curl -s http://127.0.0.1:7483/` (MUST return dashboard HTML or 404 if not built)
- Kill server

### Output format

Report PASS or FAIL for each:
1. OBS-5 static serving (SPA fallback, cache headers, graceful degradation)
2. OBS-5 justfile (all recipes parse, db-reset safety guard)
3. OBS-6 voice types + characters (5 characters, phrase selection)
4. OBS-6 cache (contentId hash, null-on-failure contract)
5. OBS-6 queue (FIFO, maxDepth, maxAge, timeout, stop, try/finally)
6. OBS-6 router (all response paths return correct status)
7. OBS-6 server integration (route, triggerVoice, health, SIGTERM)
8. OBS-6 tests (21 tests pass)
9. CORS on voice responses
10. POST /voice/notify returns JSON when voice disabled

For any FAIL, provide: file, line, issue description, suggested fix.
```

---

## Final Status

All 3 phases complete. 88 tests passing. Server builds. Dashboard builds. Plugin ready.

| Phase | Domain | Status | Validation |
|---|---|---|---|
| 1 | OBS-1 Event Server | Complete | PASS (McCoy, opus) |
| 1 | OBS-2 CLI | Complete | PASS (with OBS-1) |
| 2 | OBS-3 Plugin | Complete | PASS (McCoy, opus) |
| 2 | OBS-4 Dashboard | Complete | PASS (McCoy, opus) |
| 3 | OBS-5 DevOps | Complete | PASS (McCoy, opus, retry) |
| 3 | OBS-6 Voice TTS | Complete | PASS (McCoy, opus, retry) |

### GitHub Issues

- [#1](https://github.com/nathanvale/side-quest-observability/issues/1) -- Harden envelope validation on POST /events
- [#2](https://github.com/nathanvale/side-quest-observability/issues/2) -- Body size guard bypassed by chunked encoding
- [#3](https://github.com/nathanvale/side-quest-observability/issues/3) -- Clean up template artifacts from scaffold

### Commits

| Repo | Commit | Description |
|---|---|---|
| side-quest-observability | `e04ab2d` | Phase 1: event server extraction |
| side-quest-observability | `b07e3f9` | Phase 2: Vue dashboard |
| side-quest-observability | `cef045d` | Phase 3: static serving, voice TTS, fixes |
| side-quest-plugins | `cfc321c` | OBS-3 observability plugin |
| side-quest-plugins | Various WIP | Spec updates, session log |

---

## Full System Review Prompt

Use this prompt to have a fresh agent review the entire observability system end-to-end. This agent has zero prior context -- everything it needs is in the prompt.

```
## Review Mission: Full Observability System Review

You are reviewing the complete Enterprise Agent Observability system built across
two repos and 6 domains. You have no prior context -- this prompt contains everything
you need.

### System Overview

Real-time observability for Claude Code sessions. Hook events stream through a
self-contained plugin hook, into an event server with enrichment, out through
WebSocket to a Vue 3 real-time dashboard, with optional voice feedback via
pre-generated TTS clips.

Architecture: "Dumb Hook, Smart Server"
- Hooks are ~85-line scripts with ZERO external dependencies
- They read stdin and POST raw JSON to the server
- The server handles ALL intelligence: type mapping, field extraction, truncation, envelope generation

Data flow:
  Claude Code [any hook event]
    --> bun run emit-event.ts <event-name>
      --> reads stdin (raw JSON)
      --> POST http://127.0.0.1:7483/events/{event-name}
        --> Server enrichment pipeline
          --> EventStore (ring buffer + JSONL)
          --> WebSocket broadcast
            --> Vue dashboard (real-time)
          --> Voice playback (on Stop events)

### Repos

1. **side-quest-observability** (https://github.com/nathanvale/side-quest-observability)
   - Location: ~/code/side-quest-observability
   - Structure: workspace monorepo (packages/server, packages/client)
   - 88 tests passing

2. **side-quest-plugins** (plugin only)
   - Location: /Users/nathanvale/code/side-quest-plugins/plugins/observability/
   - 3 files, zero external dependencies

### Specs (source of truth)

Read these first to understand intent:
- `/Users/nathanvale/code/side-quest-plugins/specs/plans/observability-master-plan.md` -- architecture
- `/Users/nathanvale/code/side-quest-plugins/specs/obs-coordinator.md` -- execution plan
- `/Users/nathanvale/code/side-quest-plugins/specs/plans/obs-1-event-server.md` -- server detail
- `/Users/nathanvale/code/side-quest-plugins/specs/plans/obs-3-plugin-registration.md` -- plugin detail
- `/Users/nathanvale/code/side-quest-plugins/specs/plans/obs-4-vue-dashboard.md` -- dashboard detail
- `/Users/nathanvale/code/side-quest-plugins/specs/plans/obs-5-server-devops.md` -- devops detail
- `/Users/nathanvale/code/side-quest-plugins/specs/plans/obs-6-voice-tts.md` -- voice detail

### Domain 1: Event Server (packages/server/src/)

Files to review:
- `types.ts` -- EventType (14 ClaudeHookEvent + WorktreeEvent + SessionEvent + string escape hatch)
- `cache-key.ts` -- getAppCacheKey using contentId from @side-quest/core/hash
- `schema.ts` -- createEvent factory producing EventEnvelopes
- `store.ts` -- Ring buffer + JSONL persistence with 10MB rotation (5 files max)
- `server.ts` -- THE BIG FILE (~750 lines):
  - Two POST routes: /events/:eventName (raw hook stdin) and /events (pre-built envelopes)
  - Enrichment pipeline: mapEventName, extractEventFields, truncateField
  - stop_hook_active recursion guard
  - CORS headers on ALL responses
  - Signal handlers (SIGTERM/SIGINT) clean up PID/nonce files
  - Nonce identity in /health
  - Ingress validation (400 for bad payloads)
  - WebSocket with Bun native pub/sub
  - GET /events with ?type, ?since, ?limit
  - GET /health with nonce, uptime, events, persistErrors, wsClients, voice status
  - Static file serving (SPA fallback, last in handler chain)
  - POST /voice/notify (returns JSON even when voice disabled)
  - triggerVoice() on Stop events
- `client.ts` -- WS client with exponential backoff + jitter
- `emit.ts` -- Fire-and-forget emitter with global server discovery
- `index.ts` -- Barrel export
- `cli/index.ts` -- CLI: observability server [--port PORT]

Tests:
- `cache-key.test.ts`, `schema.test.ts`, `server.test.ts`, `emit.test.ts`
- `voice/queue.test.ts`, `voice/router.test.ts`

### Domain 2: Plugin (plugins/observability/)

- `plugin.json` -- name, description, version
- `hooks/hooks.json` -- 5 v1 hook registrations
  - async: true on PreToolUse, PostToolUse, PostToolUseFailure
  - Synchronous on SessionStart, Stop
- `hooks/emit-event.ts` -- self-contained dumb pipe
  - ZERO external npm imports (only node: builtins + Bun globals)
  - Self-destruct at 4500ms (first executable line)
  - 1MB stdin cap, 500ms fetch abort
  - SIDE_QUEST_EVENTS=0 kill switch
  - Exits 0 in ALL error paths

Coexistence check:
- plugins/enterprise/hooks/captains-log.ts MUST be unchanged

### Domain 3: Dashboard (packages/client/)

- Two-tier CSS design token system (primitives + semantic), LCARS dark theme
- Vue 3 Composition API with <script setup lang="ts">
- useEventStream composable: shallowRef, rAF batch flush, exponential backoff, tab visibility, dedup
- EventCard: left border colors, badges, expandable JSON, copy button
- EventFeed: auto-scroll with manual override, TransitionGroup (disabled >300/min)
- SessionHeader: glassmorphism, double-layer pulsing connection dot, events/min, filter

### Domain 4: Voice TTS (packages/server/src/voice/)

- 5 characters (Scotty, McCoy, Spock, Computer, Beat Reporter) with phrases
- PlaybackQueue: FIFO, maxDepth, maxAge, timeout, stop(), try/finally in drain
- Cache: contentId hash, null-on-failure contract (never throws)
- Router: handleVoiceNotify with disabled/unknown/not_cached/queued responses
- Config: SIDE_QUEST_VOICE env (full/pregenerated/disabled)
- afplay probe at startup, SIGTERM cleanup

### Domain 5: DevOps

- justfile with 13 recipes
- Static file serving in server.ts (SPA fallback)
- scripts/generate-clips.ts for voice pre-generation

### Known Issues (tracked in GitHub)

- Issue #1: POST /events trusts envelope fields via cast (no validation of id/timestamp)
- Issue #2: Content-Length body size guard bypassable with chunked encoding
- Issue #3: Template artifacts to clean up (tsconfig.eslint.json, scripts/setup.ts, README)
- Vue client tsc --build fails (needs vue-tsc, not tsc) -- root typecheck script needs updating
- Voice IDs are TBD_* placeholders
- globals.css Tailwind syntax flagged by biome (expected)

### Validation Commands

Run ALL of these:
```
cd ~/code/side-quest-observability && bun test
cd ~/code/side-quest-observability && bun run typecheck
cd ~/code/side-quest-observability && bunx biome ci packages/server/
cd ~/code/side-quest-observability/packages/server && bunx bunup
cd ~/code/side-quest-observability/packages/client && bun run build
cd ~/code/side-quest-observability && just --list

cd /Users/nathanvale/code/side-quest-plugins
python3 -m json.tool < plugins/observability/plugin.json
python3 -m json.tool < plugins/observability/hooks/hooks.json
echo '{}' | timeout 10 bun run plugins/observability/hooks/emit-event.ts session-start 2>/dev/null; echo $?
grep "from '" plugins/observability/hooks/emit-event.ts | grep -v "node:"
```

### Full Smoke Test

```
cd ~/code/side-quest-observability
bun run packages/server/src/cli/index.ts server &
sleep 2

curl -s http://127.0.0.1:7483/health
curl -s -X POST http://127.0.0.1:7483/events/session-start -H "Content-Type: application/json" -d '{"session_id":"review","model":"claude-sonnet-4-6"}'
curl -s -X POST http://127.0.0.1:7483/events/pre-tool-use -H "Content-Type: application/json" -d '{"session_id":"review","tool_name":"Read","tool_input":"{\"path\":\"/foo\"}"}'
curl -s -X POST http://127.0.0.1:7483/events/stop -H "Content-Type: application/json" -d '{"session_id":"review","stop_hook_active":true}'
curl -s -X POST http://127.0.0.1:7483/events/stop -H "Content-Type: application/json" -d '{"session_id":"review"}'
curl -s http://127.0.0.1:7483/events
curl -s -X OPTIONS http://127.0.0.1:7483/events -I
curl -s -X POST http://127.0.0.1:7483/voice/notify -H "Content-Type: application/json" -d '{"agentType":"enterprise:builder-scotty","phase":"start"}'
curl -s http://127.0.0.1:7483/

kill %1 2>/dev/null; wait 2>/dev/null
# Verify PID files cleaned up
ls ~/.cache/side-quest-observability/events.pid 2>/dev/null && echo "PID FILE STILL EXISTS (BAD)" || echo "PID file cleaned up (good)"
```

### Rename Completeness Check

```
cd ~/code/side-quest-observability
grep -rn 'repoName\|\.repo\b\|gitRoot\|getRepoCacheKey\|getEventCacheDir' packages/server/src/ --include='*.ts' | grep -v test | grep -v '.d.ts'
```
Should return empty (all renamed to app/appRoot/getAppCacheKey/getAppCacheDir).

### Output Format

Report PASS or FAIL for each domain:

1. **Event Server** (types, enrichment, CORS, signal handlers, WebSocket, rotation)
2. **Plugin** (zero deps, self-destruct, graceful degradation, coexistence)
3. **Dashboard** (build, types match server, WebSocket streaming, design system, accessibility)
4. **Voice TTS** (queue correctness, cache contract, router logic, server integration)
5. **DevOps** (justfile recipes, static serving, SPA fallback)
6. **Cross-cutting** (rename completeness, CORS consistency, test coverage, spec compliance)

Then a final overall PASS/FAIL.

For any FAIL: file, line number, issue description, suggested fix.
```
