# Enterprise Agent Observability -- Implementation Plan

## Context

The enterprise plugin has a single Stop hook (`captains-log.ts`) that retrospectively parses transcripts. No real-time visibility into agent activity during sessions.

The reference implementation ([disler's project](https://github.com/disler/claude-code-hooks-multi-agent-observability), running locally at `~/code/claude-code-hooks-multi-agent-observability/`) demonstrates the target: all 14 Claude Code hook events streaming to a server with a real-time Vue dashboard.

**Key insight:** `@side-quest/git` already contains a production-quality event bus (`src/events/`) that is barely used (only by `worktree/cli.ts`). We extract it into a new `@side-quest/observability` package as the canonical event infrastructure, then build the dashboard on top.

## Architecture

**Key decisions:**
1. **Standalone plugin** -- observability is its own plugin, not embedded in enterprise. Installing one plugin gives observability across ALL sessions.
2. **Dumb hook, smart server** -- hooks are ~50-line self-contained scripts with zero external dependencies. They read stdin and POST raw JSON to the server. The server handles all enrichment: event type mapping, payload extraction, field truncation, envelope generation, stop guard. This makes hooks marketplace-compatible and eliminates dependency resolution issues.

```
@side-quest/observability (new repo, from bun-typescript-starter)
  packages/
    server/          <-- EventStore, HTTP+WS server, event enrichment pipeline (extracted from @side-quest/git/events)
    client/          <-- Vue 3 dashboard (enterprise views are filters/components, not baked in)

plugins/observability/ (new plugin, in side-quest-plugins)
  plugin.json        <-- registers the plugin
  hooks/hooks.json   <-- 5 v1 hook registrations (bun run, not bunx)
  hooks/emit-event.ts <-- self-contained dumb pipe (~50 lines, zero dependencies)

plugins/enterprise/  <-- unchanged, keeps only captains-log.ts Stop hook
plugins/newsroom/    <-- unchanged, no hooks needed (beat-reporter appears automatically via agent_type)
plugins/git/         <-- unchanged (keeps its own event-bus-client for now, migrates later in Stage 5g)

@side-quest/git (existing)
  worktree/cli.ts   <-- imports from @side-quest/observability instead of local events/ (Stage 5g)
```

**Data flow (dumb hook, smart server):**
```
Claude Code Session (any plugin active)
  |-- [any hook event] --> bun run emit-event.ts <event-name>
                                  |
                                  +--> reads stdin (raw JSON from Claude Code)
                                  |
                                  +--> POST http://127.0.0.1:{port}/events/{event-name}
                                              |  (raw stdin body, event name in URL)
                                              |
                                    @side-quest/observability server
                                              |
                                    Enrichment pipeline:
                                      1. Map event name -> EventType
                                      2. Extract event-specific fields
                                      3. Truncate large fields (>2000 chars)
                                      4. Generate EventEnvelope (id, timestamp, correlationId)
                                      5. Check stop_hook_active guard
                                              |
                                    EventStore (ring buffer + JSONL)
                                              |
                                    WebSocket broadcast --> Vue dashboard
                                              |
                                    Dashboard shows:
                                      - enterprise:builder-scotty as "Scotty"
                                      - newsroom:beat-reporter as "Beat Reporter"
                                      - any future agent_type automatically
```

**What the hook does (3 things):**
1. Read stdin
2. POST raw JSON to `http://127.0.0.1:{port}/events/{event-name}`
3. Exit 0

**What the server does (everything else):**
- Maps `session-start` -> `hook.session_start` EventType
- Extracts model, tool_name, agent_type from raw payload
- Truncates tool_input/tool_result to 2000 chars
- Generates EventEnvelope with nanoId, timestamp, correlationId
- Handles stop_hook_active recursion guard
- Stores in ring buffer + JSONL persistence
- Broadcasts via WebSocket

**What this means for each plugin:**
- **Enterprise**: `captains-log.ts` stays. No observability hooks needed. Officers appear in dashboard via `agent_type` field.
- **Newsroom**: Zero changes. Mickey's beat-reporter dispatches show up automatically when SubagentStart fires with `agent_type: "newsroom:beat-reporter"`.
- **Git**: Keeps its current `event-bus-client.ts` hooks. Migrates to `@side-quest/observability` in Stage 5f.
- **Any future plugin**: Agents appear in the dashboard with zero observability code.

## What We're Extracting from @side-quest/git

These 7 files move from `side-quest-git/src/events/` to `@side-quest/observability/packages/server/src/`:

| File | Dependencies on @side-quest/core | Git-specific? |
|---|---|---|
| `types.ts` | None | EventType union has git types -- **generalize** |
| `schema.ts` | `core/instrumentation`, `core/utils` | No |
| `store.ts` | `core/fs` | No |
| `server.ts` | `core/fs` | `repoName`/`gitRoot` in ServerOptions -- **generalize** |
| `client.ts` | None | No |
| `emit.ts` | None (uses node:fs directly) | `getRepoCacheKey` -- **generalize** |
| `cache-key.ts` | None (uses node:crypto) | Hardcodes `side-quest-git` path -- **change** |

**Changes needed:**
- `types.ts`: Replace `CliEventType`/`HookEventType` git unions with a generic extensible type. Add Claude Code hook event types.
- `cache-key.ts`: Simplify using `contentId(absolutePath)` from `@side-quest/core/hash` instead of manual SHA256. Change `side-quest-git` to `side-quest-observability` in cache dir path.
- `schema.ts`: Already uses `generateCorrelationId` and `nanoId` from `@side-quest/core` -- no changes needed.
- `store.ts`: Already uses `appendToFileSync`, `ensureDirSync` from `@side-quest/core/fs`. Add `withFileLock` from `@side-quest/core/concurrency` for concurrent append safety. Use `Bun.JSONL.parse()` (native, Bun v1.3.7+) for reading JSONL persistence files instead of manual `split('\n').map(JSON.parse)`.
- `server.ts`: Rename `repoName`/`gitRoot` to generic `appName`/`appRoot` (or make optional). Already uses `ensureDirSync`, `pathExistsSync`, `readTextFileSync`, `writeTextFileSync` from `@side-quest/core/fs`.
- `emit.ts`: For programmatic clients (like `event-bus-client.ts`) that build their own envelopes and POST to `/events`. Plugin hooks no longer use this -- they POST raw stdin to `/events/:eventName` via the self-contained `emit-event.ts`. Replace manual port file check with `pathExistsSync` + `readTextFileSync` from `@side-quest/core/fs`.
- `client.ts`: No external dependencies -- direct copy.

**@side-quest/core stays as a dependency** -- and we should leverage it heavily. The catalog (v0.3.1, 25 modules, 398 declarations) has production-ready utilities for almost every infrastructure need:

| Need | @side-quest/core import | Module |
|---|---|---|
| Event IDs | `nanoId()`, `shortId()` | `utils` |
| Correlation IDs | `generateCorrelationId()` | `instrumentation` |
| Cache key from path | `contentId(absolutePath)` (12-char SHA256 prefix) | `hash` |
| Fast non-crypto hash | `fastHashHex()` | `hash` |
| Dir management | `ensureDirSync`, `ensureCacheDir`, `ensureParentDirSync` | `fs` |
| Port/PID files | `writeTextFileSync`, `readTextFileSync`, `pathExistsSync` | `fs` |
| JSONL append | `appendToFileSync`, `appendToFile` | `fs` |
| Model cache (TTL) | `isFileStale(path, maxAgeHours)`, `readJsonFileOrDefault`, `writeJsonFileSync` | `fs` |
| Atomic JSON state | `updateJsonFileAtomic` (with Zod + file locking) | `fs` |
| CLI arg parsing | `parseArgs`, `normalizeFlags`, `outputError` | `cli` |
| Emitter timeout | `withTimeout(promise, ms)` | `concurrency` |
| File locking (JSONL) | `withFileLock(resourceId, fn)` | `concurrency` |
| Structured logging | `createPluginLogger` | `logging` |
| Trace context | `createTraceContext`, `runWithContextAsync`, `observe` | `instrumentation` |
| Metrics | `incrementCounter`, `observeHistogram`, `captureResourceMetrics` | `instrumentation` |
| Error analysis | `getErrorCategory`, `categorizeError` | `instrumentation` |
| SLO tracking | `createSLOTracker` | `slo` |
| Terminal output | `table`, `box`, `color`, `success`, `error` | `terminal` |
| String utils | `truncate`, `kebabCase`, `safeJsonParse` | `utils` |
| Test helpers | `setupTestDir`, `cleanupTestDir`, `writeTestFile` | `testing` |

This eliminates significant hand-rolled infrastructure in the server package. Note: hooks no longer use `@side-quest/core` -- with the dumb hook model, hooks have zero external dependencies. All `@side-quest/core` usage is server-side.

### Observability patterns from dev-toolkit skill to adopt

Reference: `~/code/side-quest-marketplace/plugins/dev-toolkit/skills/observability/SKILL.md`

**1. Three-tier correlation ID hierarchy (sessionCid / cid / parentCid):**
The event server's `EventEnvelope` should include all three tiers. Mapping:
- `sessionCid` = Claude Code's `session_id` (extracted by server from raw stdin payload)
- `cid` = per-event ID via `nanoId()` (generated by server during enrichment)
- `parentCid` = for SubagentStart/Stop, the parent session's correlation ID

With the dumb hook model, all correlation ID generation happens server-side during the enrichment pipeline. The hook sends raw stdin; the server extracts `session_id` and generates `cid`/`parentCid`.

This enables tracing the full engage pipeline: `session -> task -> build -> validate -> retry`.

**2. `createPluginLogger` for server internals:**
```typescript
const { initLogger, getSubsystemLogger } = createPluginLogger({
  name: 'observability',
  subsystems: ['server', 'hooks', 'emitter', 'store', 'cli'],
})
```
Log location: `~/.claude/logs/observability.jsonl`

**3. Structured logging with properties objects:**
Server enrichment pipeline uses `{ event, sessionCid, cid, parentCid, durationMs, officer, ... }` properties pattern (not template literals) for jq queryability. Hooks have no logging (dumb pipe -- zero overhead).

**4. `observe()` wrapper for server enrichment:**
```typescript
import { observe } from '@side-quest/core/instrumentation'
// Server enrichment pipeline wrapped for automatic timing + error logging
await observe(serverLogger, 'enrichment.session_start', async () => { ... })
```

**5. `MetricsCollector` for server health:**
The server can aggregate metrics from its own JSONL logs and expose via `GET /metrics` endpoint. The dashboard consumes this for the PulseChart sparkline.

**6. Updated EventEnvelope with correlation hierarchy:**
```typescript
interface EventEnvelope<T = unknown> {
  readonly schemaVersion: '1.0.0'
  readonly id: string              // nanoId()
  readonly timestamp: string
  readonly type: EventType
  readonly app: string
  readonly appRoot: string
  readonly source: string
  readonly sessionCid: string      // Claude Code session_id
  readonly cid: string             // This event's correlation ID
  readonly parentCid?: string      // Parent event (for subagent traces)
  readonly data: T
}
```

This replaces the single `correlationId` field with the three-tier hierarchy, matching the production patterns in para-obsidian.

### Community-validated patterns to adopt

Research across Reddit, X, and the web (Feb 2026) confirmed 6/8 patterns in the observability skill as community consensus. Two additions for the plan:

**1. Use `Bun.JSONL.parse` / `Bun.JSONL.parseChunk` (native APIs, shipped Bun v1.3.7 Jan 2026):**
- EventStore JSONL persistence reading should use `Bun.JSONL.parse(text)` instead of manual `split('\n').map(JSON.parse)`
- Hook transcript parsing (model extraction) should use `Bun.JSONL.parseChunk` for streaming large transcript files in reverse
- This is a runtime-level endorsement of JSONL as a first-class format

**2. Forward-compatible with OTel GenAI Semantic Conventions:**
- The three-tier sessionCid/cid/parentCid maps directly to OTel's trace_id/span_id/parent_span_id
- OTel GenAI SIG has published Agent Application standards (finalized) and Agent Framework standards (in progress)
- If we ever need OTel export, the data model is already compatible -- no schema changes needed
- Key reference: [OTel AI Agent Observability 2025](https://opentelemetry.io/blog/2025/ai-agent-observability/)

---

## Stage 1: Scaffold the New Repo

**Goal:** Create `~/code/side-quest-observability` from bun-typescript-starter with workspace support.

### Steps

1. Fork bun-typescript-starter via GitHub as `side-quest-observability`
2. Clone to `~/code/side-quest-observability`
3. Run `bun run setup` with name `@side-quest/observability`
4. Add workspace support:
   - Root `package.json`: add `"workspaces": ["packages/*"]`
   - Create `packages/server/package.json` (`@side-quest/observability-server`, private)
   - Create `packages/client/package.json` (`@side-quest/observability-client`, private)
   - Update `.changeset/config.json`: `"packages": ["packages/*"]`
   - Per-package `tsconfig.json` extending root `tsconfig.base.json`
5. Move root `src/` and `tests/` into `packages/server/`

### Verification

```bash
bun install  # workspaces resolve
bun test     # passes (empty test suite)
bun run typecheck  # passes
```

---

## Stage 2: Extract Event System into Server Package

**Goal:** Move the event bus from `@side-quest/git/src/events/` into `packages/server/src/`.

**Note on OBS-2 (Hook CLI):** After v3's "dumb hook, smart server" restructuring, OBS-2 is a thin wrapper -- a single `cli/index.ts` (~15 lines) that starts the server. It ships as part of this extraction and takes ~30 minutes to implement. The original OBS-2 scope (dispatch, emit, handler files) migrated to OBS-1's server enrichment pipeline and OBS-3's self-contained hook script. OBS-2 is preserved as a domain for traceability but is not a standalone workstream.

### Files to create/port

```
packages/server/src/
  types.ts           <-- from git/events/types.ts, generalized event types
  schema.ts          <-- from git/events/schema.ts, unchanged
  store.ts           <-- from git/events/store.ts, unchanged
  server.ts          <-- from git/events/server.ts, generalized options + hook event enrichment pipeline (inlined)
  client.ts          <-- from git/events/client.ts, unchanged
  emit.ts            <-- from git/events/emit.ts, generalized cache path (for programmatic clients)
  cache-key.ts       <-- from git/events/cache-key.ts, 'side-quest-observability'
  index.ts           <-- barrel export
  cli/
    index.ts         <-- CLI entry point: `observability server` only (no hook subcommand)
```

**Note:** No separate `enrichment.ts` file. Hook event enrichment (event name mapping, payload extraction, field truncation, envelope generation) is inlined in `server.ts` as `enrichHookPayload()` and `handleHookEvent()`. OBS-1's 3-pass review chose to keep enrichment co-located with the route handler. Extracting to a separate file is a taste call during implementation if `server.ts` grows too large.

No `cli/hook.ts`, `cli/handlers/`, `cli/model-cache.ts`, or `cli/emitter.ts`. With the dumb hook model, all hook logic is either:
- In the plugin's self-contained `emit-event.ts` (~50 lines, zero dependencies) -- see Stage 3
- In the server's `server.ts` enrichment functions (event type mapping, payload extraction, envelope generation)

### Generalized EventType

```typescript
// All 14 Claude Code hook event types (per official docs: code.claude.com/docs/en/hooks)
type ClaudeHookEvent =
  | 'hook.session_start' | 'hook.session_end'
  | 'hook.pre_tool_use' | 'hook.post_tool_use' | 'hook.post_tool_use_failure'
  | 'hook.notification' | 'hook.user_prompt_submit'
  | 'hook.stop' | 'hook.subagent_start' | 'hook.subagent_stop'
  | 'hook.pre_compact' | 'hook.permission_request'
  | 'hook.teammate_idle' | 'hook.task_completed'

// Git worktree events (consumers like @side-quest/git add these)
type WorktreeEvent =
  | 'worktree.created' | 'worktree.deleted' | 'worktree.synced'
  | 'worktree.cleaned' | 'worktree.attached' | 'worktree.installed'

// Session lifecycle (from git hooks, now generic)
type SessionEvent =
  | 'session.started' | 'session.ended' | 'session.compacted'
  | 'safety.blocked' | 'command.executed'

type EventType = ClaudeHookEvent | WorktreeEvent | SessionEvent | (string & {})
```

The `(string & {})` allows arbitrary extension without losing autocomplete on known types.

### Generalized ServerOptions

```typescript
interface ServerOptions {
  port?: number
  appName: string           // was repoName
  appRoot?: string          // was gitRoot (now optional)
  cacheKey?: string
  hostname?: string
  capacity?: number
  persistPath?: string
}
```

### Generalized EventEnvelope

```typescript
interface EventEnvelope<T = unknown> {
  readonly schemaVersion: '1.0.0'
  readonly id: string              // nanoId() from @side-quest/core/utils
  readonly timestamp: string
  readonly type: EventType
  readonly app: string             // was repo
  readonly appRoot: string         // was gitRoot
  readonly source: string          // was 'cli' | 'hook', now open string
  readonly sessionCid: string      // Claude Code session_id (three-tier tracing)
  readonly cid: string             // This event's correlation ID
  readonly parentCid?: string      // Parent event (for subagent traces)
  readonly data: T
}
```

The three-tier `sessionCid`/`cid`/`parentCid` hierarchy replaces the old single `correlationId` field, matching the OpenTelemetry-compatible tracing pattern documented in the observability skill.

### Tests to port

Port all test files from `side-quest-git/src/events/*.test.ts`:
- `server.test.ts` -- integration tests for HTTP routes and WebSocket
- `emit.test.ts` -- fire-and-forget emitter tests
- `schema.test.ts` -- createEvent factory tests
- `cache-key.test.ts` -- cache key generation tests (update expected paths)

### Verification

```bash
cd packages/server && bun test  # all ported tests pass
bun run typecheck               # clean
```

---

## Stage 3: Observability Plugin + Self-Contained Hook

**Goal:** Create `plugins/observability/` as a standalone plugin with 5 v1 hook registrations using a self-contained script. Works across all sessions regardless of which other plugins are active. Zero external dependencies -- marketplace-compatible.

### Architecture: Dumb Hook, Smart Server

The hook is a ~50-line self-contained script (`emit-event.ts`) with zero external dependencies. It reads stdin and POSTs raw JSON to the server. The server handles all enrichment (type mapping, payload extraction, envelope generation). See OBS-1 for the server-side enrichment pipeline, OBS-2 for the architecture rationale, OBS-3 for the full implementation.

```
Hook (emit-event.ts):   stdin --> POST /events/{event-name} --> exit 0
Server (enrichment.ts): validate, map type, extract fields, truncate, generate envelope, store, broadcast
```

### What lives where

| Location | Responsibility |
|---|---|
| `@side-quest/observability` server (`enrichment.ts`) | Event type mapping, payload extraction, field truncation, envelope generation, stop guard |
| `plugins/observability/hooks/emit-event.ts` | Self-contained dumb pipe (~50 lines, zero dependencies) |
| `plugins/observability/plugin.json` | Plugin registration |
| `plugins/observability/hooks/hooks.json` | 5 v1 `bun run` command registrations |
| `plugins/enterprise/hooks/captains-log.ts` | Unchanged -- coexists (enterprise-specific retrospective logging) |

**No plugin-specific logic in the hooks or the server enrichment pipeline.** Officer mapping (`enterprise:builder-scotty` -> "Scotty", `newsroom:beat-reporter` -> "Beat Reporter") lives in the dashboard client as a display concern. The hooks pass through raw stdin; the server extracts `agent_type` as raw data.

### Plugin scaffold

```
plugins/observability/
  plugin.json              <-- { name, description }
  hooks/hooks.json         <-- 5 v1 bun run registrations
  hooks/emit-event.ts      <-- self-contained dumb pipe (~50 lines)
```

Three files. No skills, no agents, no commands. No node_modules. Pure hook infrastructure.

### hooks.json registration (`plugins/observability/hooks/hooks.json`)

v1: 5 events. `async: true` on high-frequency hooks. Uses `bun run` with self-contained script (not `bunx`).

```json
{
  "description": "Real-time observability -- streams Claude Code lifecycle events to @side-quest/observability server",
  "hooks": {
    "SessionStart": [{ "matcher": "*", "hooks": [
      { "type": "command", "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts session-start", "timeout": 5 }
    ]}],
    "PreToolUse": [{ "matcher": "*", "hooks": [
      { "type": "command", "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts pre-tool-use", "timeout": 5, "async": true }
    ]}],
    "PostToolUse": [{ "matcher": "*", "hooks": [
      { "type": "command", "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts post-tool-use", "timeout": 5, "async": true }
    ]}],
    "PostToolUseFailure": [{ "matcher": "*", "hooks": [
      { "type": "command", "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts post-tool-use-failure", "timeout": 5, "async": true }
    ]}],
    "Stop": [{ "matcher": "*", "hooks": [
      { "type": "command", "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts stop", "timeout": 5 }
    ]}]
  }
}
```

Remaining 9 events (SessionEnd, Notification, UserPromptSubmit, SubagentStart, SubagentStop, PreCompact, PermissionRequest, TeammateIdle, TaskCompleted) are added in v2 when server-side enrichment handlers are implemented. Adding a new event requires only: (1) add a hooks.json entry, (2) add a server enrichment case. Zero changes to emit-event.ts.

Note: Enterprise's `captains-log.ts` remains in `plugins/enterprise/hooks/hooks.json` separately -- Claude Code merges hooks from all active plugins.

### All matchers are `*` (generic plugin)

Since observability is a standalone plugin (not enterprise-specific), all hooks use `*` matchers. This captures events from every plugin's agents:
- `enterprise:builder-scotty`, `enterprise:validator-mccoy` (enterprise)
- `newsroom:beat-reporter` (newsroom)
- Built-in agents (`Explore`, `Plan`, `Bash`, etc.)
- Any future custom agents

Filtering by agent type / plugin happens in the **dashboard**, not in hook matchers.

### Model extraction from transcripts (server-side, deferred to v2)

Reference: [send_event_with_model_how_to.md](https://github.com/disler/claude-code-hooks-multi-agent-observability/blob/main/app_docs/send_event_with_model_how_to.md)

With the dumb hook model, model extraction moves to the server. The server receives `transcript_path` in the raw stdin payload and can read the transcript for model info. This is deferred to v2 -- v1 relies on the `model` field in SessionStart stdin (available since Claude Code v2.x).

### Agent display mapping (dashboard concern, not hook concern)

Lives in `packages/client/src/composables/useAgentDisplay.ts` -- NOT in the hooks or server enrichment:

```typescript
// Dashboard-side display mapping -- hooks pass raw agent_type
const AGENT_DISPLAY: Record<string, { label: string; icon: string; color: string }> = {
  'enterprise:builder-scotty': { label: 'Scotty', icon: 'wrench', color: 'orange' },
  'enterprise:validator-mccoy': { label: 'McCoy', icon: 'stethoscope', color: 'blue' },
  'enterprise:ships-computer-cpu': { label: 'Computer', icon: 'cpu', color: 'cyan' },
  'enterprise:API': { label: 'Spock', icon: 'vulcan', color: 'green' },
  'newsroom:beat-reporter': { label: 'Beat Reporter', icon: 'newspaper', color: 'amber' },
  // Built-in agents get generic display
  'Explore': { label: 'Explorer', icon: 'search', color: 'gray' },
  'Plan': { label: 'Planner', icon: 'map', color: 'gray' },
}
// Unknown agent_type: display raw value with neutral styling
```

This means adding a new agent to any plugin automatically appears in the dashboard -- worst case with a raw label, best case with a configured display name.

### Rich data from SubagentStop transcripts (v2, server-side)

When SubagentStop fires, `agent_transcript_path` is included in the raw stdin. The server's enrichment pipeline (v2) can read the transcript to extract:
- Token counts (input/output) from the last assistant message
- Number of tool calls (count `tool_use` blocks)
- Duration (first timestamp to last timestamp)
- Final verdict for validators (scan for "VERDICT: PASS/FAIL")

This is a server-side concern -- the dumb hook just forwards the path.

### Verification

1. Start the observability server: `just start` (or `bun run packages/server/src/cli/index.ts server`)
2. Enable observability plugin in Claude Code
3. Open Claude Code, make a tool call
4. Verify SessionStart + PreToolUse + PostToolUse events in server (properly enriched with extracted fields)
5. Exit Claude Code, verify Stop event
6. Verify enterprise captains-log JSONL also written (coexistence)
7. Verify no `Cannot find module` errors -- emit-event.ts has zero external imports

---

## Stage 4: Vue Dashboard (Client Package)

**Goal:** Real-time event visualization at localhost.

### Files to create in `packages/client/`

```
packages/client/
  package.json         -- vue, vite, tailwindcss
  index.html
  vite.config.ts       -- proxy WS to server
  src/
    main.ts
    App.vue            -- layout: header + filters + event feed + officer panel
    types.ts           -- mirrors server types
    composables/
      useEventStream.ts     -- WebSocket connect, auto-reconnect, event queue
      useEngagePipeline.ts  -- derives build/validate/retry trace from events
    components/
      EventFeed.vue         -- scrollable real-time list, auto-scroll
      EventCard.vue         -- officer badge, hook type, tool name, expandable JSON
      OfficerPanel.vue      -- officer status (idle/active), last event time
      EngagePipeline.vue    -- Gantt trace: task -> build -> validate -> retry
      FilterBar.vue         -- filter by officer, hook event, session, app
      SessionHeader.vue     -- session info, event counts
      PulseChart.vue        -- Canvas sparkline of events over time
```

### Key features from reference to adapt

- WebSocket composable with auto-reconnect and max event limit
- Deterministic hash-based coloring per session/app
- Auto-scroll with manual override on scroll-up
- TransitionGroup animations on event rows
- CORS headers already on the server (add to Stage 2)

### Enterprise-specific: EngagePipeline trace

Groups SubagentStart/SubagentStop events by officer to reconstruct the engage pipeline:

```
Task 1: Add JWT Middleware
  [Build] Scotty ---- 47s ----> done
  [Review] McCoy ---- 23s ----> PASS

Task 2: Register Route
  [Build] Scotty ---- running...
```

### Verification

```bash
cd packages/client && bun install && bun dev
# Open http://localhost:5173
# Start Claude Code session, watch events stream
```

---

## Stage 5: Server Lifecycle + Polish

### 5a: Launchd auto-start

`launchd/com.sidequest.observability.plist` -- KeepAlive, logs to `~/Library/Logs/side-quest-observability/`

### 5b: Just commands

Root `justfile`:
- `just start` / `just stop` / `just restart`
- `just health` / `just test-event` / `just db-reset`
- `just dev` (server + client in watch mode)

### 5c: Server serves built client

The Bun server serves `packages/client/dist/` as static files from `GET /`. Single process for API + UI.

### 5d: Human-in-the-Loop (HITL) support

Reference: [how_human_in_the_loop_v1_works.md](https://github.com/disler/claude-code-hooks-multi-agent-observability/blob/main/app_docs/how_human_in_the_loop_v1_works.md)

The HITL pattern enables the dashboard to respond to agent requests (e.g. permission prompts):

1. Hook creates an ephemeral WebSocket server on a random port
2. Hook POSTs event to observability server with `hitl: { question, responseWsUrl, type, choices?, timeout? }`
3. Dashboard renders approve/deny UI for the event
4. Human responds -- server opens WebSocket to hook's `responseWsUrl`, sends response
5. Hook receives response, returns result to Claude Code

The hook-side WebSocket server uses a futures map keyed by `permission_type` for concurrent request matching. Default timeout: 300s.

This is the most complex feature -- implement only after Stages 1-4 are solid. The `obs-permission-request.ts` hook would be the primary consumer.

### 5e: LCARS Star Trek theming (enterprise dashboard views)

Dark background with orange/amber/blue LCARS panels. Officer indicators. Optional -- can be a separate PR.

### 5f: Voice Feedback -- Star Trek Character TTS

**Goal:** Agents announce themselves with character voices when starting/stopping. Scotty, McCoy, Spock, and Computer speak aloud during the engage pipeline.

#### Community Research Findings

The Claude Code hooks + audio/TTS ecosystem is active and growing (Feb 2026):

**Existing packages and projects:**
- **`@claude-code-hooks/sound`** (1,147 weekly downloads) -- cross-platform sound playback from hooks. Uses `afplay` on macOS, `aplay` on Linux, `powershell` on Windows. Proves the pattern works and has adoption.
- **bennycheung's multi-agent voice casting** -- assigns distinct ElevenLabs voices per agent role (exactly the Scotty/McCoy pattern). Voice IDs mapped to agent roles, clips cached to disk.
- **@delba_oliveira viral post** (5,638 likes on X) -- demonstrated Claude Code hooks playing sound effects, sparked massive community interest.
- **Multiple ElevenLabs integrations** -- `claude-code-templates` (400k+ monthly npm installs) includes TTS hook examples. Several indie projects use ElevenLabs `eleven_flash_v2_5` for ~75ms latency.
- **Voicebox** ("Ollama for voice cloning") -- free local alternative for voice generation without API costs.

**Key insight:** The community is already doing this. Our differentiation is the hybrid caching approach and per-officer voice identity.

#### Architecture: Hybrid Pre-generated + Live TTS with Disk Cache

```
SubagentStart/SubagentStop hook fires
  |
  +--> Extract agent_type + context from stdin
  |
  +--> Generate text line (e.g., "Scotty here, Captain. Beginning repairs.")
  |
  +--> contentId(text) --> cache key hash
  |
  +--> Check disk cache: ~/.cache/side-quest-observability/voices/{hash}.mp3
       |
       |-- HIT: afplay cached clip (~5ms, free)
       |
       |-- MISS: ElevenLabs API call (~75ms, costs credits)
                  |
                  +--> Save to disk cache
                  +--> afplay the clip
```

**After a few sessions, most lines are cached = free + instant.**

#### Voice Identity Mapping

Each officer gets a distinct ElevenLabs voice. Stored in `packages/server/src/cli/voice/voices.ts`:

```typescript
interface VoiceConfig {
  voiceId: string           // ElevenLabs voice ID
  model: string             // 'eleven_flash_v2_5' (fastest) or 'eleven_multilingual_v2'
  stability: number         // 0.0-1.0 (higher = more consistent)
  similarityBoost: number   // 0.0-1.0
}

const VOICE_MAP: Record<string, VoiceConfig> = {
  'enterprise:builder-scotty': {
    voiceId: '...',  // Scottish-accented male voice
    model: 'eleven_flash_v2_5',
    stability: 0.7,
    similarityBoost: 0.8,
  },
  'enterprise:validator-mccoy': {
    voiceId: '...',  // Southern US male voice (DeForest Kelley-inspired)
    model: 'eleven_flash_v2_5',
    stability: 0.6,
    similarityBoost: 0.75,
  },
  'enterprise:ships-computer-cpu': {
    voiceId: '...',  // Neutral, precise female voice
    model: 'eleven_flash_v2_5',
    stability: 0.9,
    similarityBoost: 0.9,
  },
  'enterprise:API': {
    voiceId: '...',  // Calm, measured male voice (Spock)
    model: 'eleven_flash_v2_5',
    stability: 0.85,
    similarityBoost: 0.85,
  },
  'newsroom:beat-reporter': {
    voiceId: '...',  // 1920s newsman voice (Mickey Malone)
    model: 'eleven_flash_v2_5',
    stability: 0.5,
    similarityBoost: 0.7,
  },
}
```

#### Pre-generated Clip Library

Common phrases that fire every session, pre-generated and shipped/cached on first use:

**Scotty (SubagentStart):**
- "Scotty here, Captain. Beginning repairs."
- "Aye, I'll get right on it."
- "She'll hold together, Captain."

**Scotty (SubagentStop):**
- "Repairs complete, Captain."
- "The work is done, sir."

**McCoy (SubagentStart):**
- "I'm a doctor, not a rubber stamp. Let me take a look."
- "McCoy here. Beginning my review."

**McCoy (SubagentStop - PASS):**
- "Clean bill of health, Captain."
- "No issues found. She's fit for duty."

**McCoy (SubagentStop - FAIL):**
- "Dammit Jim, I found problems."
- "This code needs surgery, Captain."

**Spock (various):**
- "Fascinating."
- "The mission is complete, Captain."
- "Engaging, Captain."

**Computer:**
- "Working." (with TOS computer chirp)
- "Analysis complete."

Pre-generated clips stored at: `~/.cache/side-quest-observability/voices/pregenerated/`
Generated once via a setup script (`bunx @side-quest/observability voice generate-clips`).

#### Disk Cache Implementation

Lives in `packages/server/src/cli/voice/cache.ts`:

```typescript
import { contentId } from '@side-quest/core/hash'
import { pathExistsSync, ensureDirSync } from '@side-quest/core/fs'

const VOICE_CACHE_DIR = join(homedir(), '.cache/side-quest-observability/voices')

function getCachePath(text: string, voiceId: string): string {
  const hash = contentId(`${voiceId}:${text}`)
  return join(VOICE_CACHE_DIR, `${hash}.mp3`)
}

async function getOrGenerate(text: string, config: VoiceConfig): Promise<string> {
  ensureDirSync(VOICE_CACHE_DIR)
  const cachePath = getCachePath(text, config.voiceId)

  if (pathExistsSync(cachePath)) {
    return cachePath  // Cache hit -- free + instant
  }

  // Cache miss -- call ElevenLabs
  const audio = await generateSpeech(text, config)
  await Bun.write(cachePath, audio)
  return cachePath
}
```

#### Playback

Uses `afplay` on macOS (non-blocking, ~5ms overhead):

```typescript
import { spawn } from 'bun'

async function play(filePath: string): Promise<void> {
  // Fire and forget -- don't block the hook
  spawn(['afplay', filePath], { stdio: ['ignore', 'ignore', 'ignore'] })
}
```

Cross-platform support via `@claude-code-hooks/sound` pattern:
- macOS: `afplay` (built-in)
- Linux: `aplay` or `paplay`
- Windows: `powershell -c (New-Object Media.SoundPlayer).PlaySync()`

#### Configuration

Environment variables:
- `ELEVENLABS_API_KEY` -- required for live TTS generation (not needed if only using pre-generated clips)
- `SIDE_QUEST_VOICE=0` -- disable voice feedback entirely
- `SIDE_QUEST_VOICE=pregenerated` -- only play pre-generated clips, never call ElevenLabs

#### ElevenLabs Pricing Context

- **Free tier**: 10,000 credits/month (~10 minutes of audio). Sufficient for initial clip generation.
- **Starter ($5/mo)**: 30,000 credits + instant voice cloning. Can clone Star Trek character voices from audio samples.
- **After caching**: Most sessions cost 0 credits because repeated phrases hit disk cache.

#### Integration Points

**v1: In-process trigger from server enrichment pipeline.**

Voice lives in the same server process. When `handleHookEvent('stop', ...)` fires in `server.ts`, it calls `triggerVoice()` directly -- no HTTP round-trip, no separate process. The `POST /voice/notify` route exists for external consumers but the server never calls itself over HTTP.

1. Stop event arrives via `POST /events/stop` (from dumb hook)
2. Server enrichment pipeline processes the event (type mapping, envelope, store, broadcast)
3. Server calls `triggerVoice('enterprise:ships-computer-cpu', 'stop', queue, config)` in-process
4. PlaybackQueue drains asynchronously via `afplay`

**v2: Expand to per-agent triggering via SubagentStart/SubagentStop.**

When OBS-1 PR2 adds SubagentStart/SubagentStop enrichment handlers, voice triggers expand to per-agent:

1. SubagentStart event: server extracts `agent_type`, calls `triggerVoice(agentType, 'start', ...)`
2. SubagentStop event: server extracts `agent_type`, calls `triggerVoice(agentType, 'stop', ...)`
3. McCoy verdict routing (stop_pass/stop_fail) extracts from transcript server-side

**v3 (optional): External WS consumer for advanced use cases.**

If voice needs to be decoupled from the server (independent start/stop, separate process for live TTS with ElevenLabs connection pooling), a standalone voice service can subscribe to `ws://localhost:{port}/ws?type=hook.subagent_start`. This is an evolution, not a v1 requirement.

#### Voicebox as Free Alternative

[Voicebox](https://github.com/jamiepine/voicebox) is a local voice cloning tool ("Ollama for voice") that can generate character voices without API costs. If ElevenLabs costs become a concern, the cache layer makes swapping backends trivial -- same disk cache, different generator.

### 5g: Update @side-quest/git

After `@side-quest/observability` is published:
- Remove `src/events/` from `side-quest-git`
- Add `@side-quest/observability` as a dependency
- Update `worktree/cli.ts` to import from `@side-quest/observability`
- Update `plugins/git/hooks/event-bus-client.ts` to use new cache path

---

## Critical Files Reference

| Existing file | Role in plan |
|---|---|
| `~/code/side-quest-git/src/events/*.ts` (7 files) | Source for extraction into packages/server |
| `~/code/side-quest-git/src/events/*.test.ts` (4 files) | Tests to port |
| `~/code/side-quest-plugins/plugins/git/hooks/event-bus-client.ts` | Pattern for emitter logic (dumb-pipe variant in emit-event.ts) |
| `~/code/side-quest-plugins/plugins/enterprise/hooks/captains-log.ts` | Coexisting Stop hook (unchanged) |
| `~/code/side-quest-plugins/plugins/observability/` (new) | Standalone plugin: 3 files, zero dependencies |
| `~/code/side-quest-plugins/plugins/enterprise/hooks/hooks.json` | Keeps `captains-log.ts` only (no observability hooks) |
| `~/code/side-quest-plugins/plugins/enterprise/skills/the-bridge/references/engage.md` | Engage pipeline flow for trace viz |
| `~/code/bun-typescript-starter/` | Template for new repo scaffold |
| `~/code/claude-code-hooks-multi-agent-observability/` | Reference dashboard implementation |
| `disler/.../app_docs/send_event_with_model_how_to.md` | Model extraction pattern (server-side in v2) |
| `disler/.../app_docs/how_human_in_the_loop_v1_works.md` | HITL architecture (Stage 5d) |
| `@claude-code-hooks/sound` (npm) | Cross-platform audio playback pattern (afplay/aplay/powershell) |
| bennycheung's multi-agent voice casting (GitHub) | Voice-per-agent-role pattern with ElevenLabs + disk caching |

## Two Systems Coexist

| | Captain's Log (existing) | Observability (new) |
|---|---|---|
| Trigger | Stop only (retrospective) | 5 v1 events, 14 in v2 (real-time) |
| Hook complexity | Rich transcript parsing (~150 lines) | Dumb pipe (~50 lines, zero deps) |
| Intelligence | In the hook | In the server |
| Storage | JSONL files in cwd | Ring buffer + JSONL in ~/.cache |
| Consumer | `/enterprise:log` skill | Vue dashboard + WebSocket subscribers |
| Correlation | session_id | session_id (same) |

`captains-log.ts` is never modified. Both fire on Stop -- captains-log writes JSONL, obs-stop posts raw stdin to server.
