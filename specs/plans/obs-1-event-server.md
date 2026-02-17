# OBS-1: Event Server Domain -- Implementation Plan

## Overview

Extract the event system from `@side-quest/git/src/events/` (7 files, 4 test files) into a new `@side-quest/observability` repo scaffolded from `bun-typescript-starter`.

**Repo:** `~/code/side-quest-observability`
**Package:** `@side-quest/observability` (Bun workspace: `packages/server`, `packages/client`)
**Source:** `~/code/side-quest-git/src/events/` (7 source files, 4 test files)
**Minimum Bun:** `>=1.3.7` (required for `Bun.JSONL.parse`, declared in `engines` field)

## Review-Driven Changes

This plan incorporates findings from a 3-pass staff engineer review (Architect, Skeptic, Operator). All three passes returned REQUEST CHANGES. Reviews are at `specs/reviews/obs-1-event-server-review-pass-{1,2,3}.md`.

Additionally, OBS-2's round 2 review + brainstorm session produced two prerequisites that affect OBS-1:
1. **Global server model** -- one server for all projects, one port file at `~/.cache/side-quest-observability/events.port`
2. **5 v1 ClaudeHookEvent types in PR1** -- OBS-2's emitter needs them immediately, cannot wait for PR2

### Accepted -- Scope Discipline (Skeptic)

The original plan mixed extraction with redesign. This revision splits into two PRs:

- **PR1: Mechanical extraction** -- boring port, minimal diff, all existing tests green, plus global server model + 5 v1 hook event types
- **PR2: Generalization** -- remaining event types, correlation model, `@side-quest/core` upgrades

This plan covers **both PRs** but clearly marks what belongs to each.

### Accepted -- Global Server Model (OBS-2 Brainstorm)

The per-app cache key model (`getAppCacheKey(appRoot)`) was the original design from side-quest-git, where each git repo had its own event server. For the observability use case, a **global server** is clearly better:

- **One server handles events from all projects.** Events carry `appRoot` (cwd) so the dashboard can filter by project.
- **Eliminates `canonicalizeAppRoot` in OBS-2's hook CLI.** No git spawns on every hook invocation (412/session).
- **Simplifies port discovery.** One stat + one read of `~/.cache/side-quest-observability/events.port`.
- **Reduces process count.** One server process instead of N (one per active project).

**Impact on PR1:**
- `cache-key.ts`: Still needed for migration compatibility with side-quest-git, but the server uses a fixed global cache directory
- `server.ts`: Writes port/pid/nonce files to `~/.cache/side-quest-observability/` (global, not per-app)
- `emit.ts`: `discoverEventServer()` reads from global port file, no `appRoot` needed for discovery
- `ServerOptions.appRoot`: Still accepted (used as event context default) but not used for cache directory

### Accepted -- Dumb Hook, Smart Server (v3 Architecture)

OBS-2 v3 established that the hook is a dumb stdin-to-HTTP pipe with zero enrichment logic. All event processing -- type mapping, payload extraction, field truncation, envelope generation, stop_hook_active guard -- lives in the server's `POST /events/:eventName` handler. This means OBS-1 owns all event intelligence. See section 2.4 item 3 for the full enrichment pipeline.

### Accepted -- 5 v1 Hook Event Types in PR1 (OBS-2 C1 Fix)

OBS-2's hook forwards raw stdin to the server, which maps event names to these types. These must be in OBS-1's `EventType` union for type safety. Originally deferred to PR2, now moved to PR1 because the server enrichment pipeline needs them immediately.

### Accepted -- Cut for v1 (All reviewers)

| Cut item | Reason | Deferred to |
|----------|--------|-------------|
| `withFileLock` on push() | No demonstrated contention in single-process Bun server | PR3 if proven needed |
| `loadFromDisk()` | Anticipatory -- no restart-replay requirement for real-time use | PR3 if proven needed |
| `(string & {})` on EventType | Breaks discriminated union narrowing, allows silent typos | Never (use explicit union extension) |
| `source: string` widening | No current consumer needs it, removes useful constraint | PR2 only if justified |

### Accepted -- Operational Hardening (Operator)

| Addition | Reason | PR |
|----------|--------|-----|
| SIGTERM/SIGINT signal handlers | Stale PID files on crash, uncertain drain | PR1 |
| JSONL rotation + retention caps | Unbounded ~250MB/month growth | PR1 |
| PID identity verification (nonce) | `kill(pid, 0)` can't distinguish event server from PID-reused process | PR1 |
| Ingress validation on POST /events | Arbitrary JSON can poison buffer and break consumers | PR1 |
| Emitter failure logging (rate-limited) | Zero failure visibility -- outages look like success | PR1 |
| WS exponential backoff + jitter | Fixed 2s reconnect causes retry storms | PR1 |
| CORS headers | Dashboard on :5173 can't reach server on :7483 without CORS | PR1 |
| Cache directory GC | Old cacheKey dirs never cleaned up | PR2 |

### Accepted -- Migration Safety (Architect)

| Addition | Reason | PR |
|----------|--------|-----|
| Dual cache path reads | Emitter checks both `side-quest-observability` and `side-quest-git` paths during migration | PR1 |
| Re-export shim in `@side-quest/git` | Downstream consumers keep working during transition | PR1 (in side-quest-git) |
| `engines` field for Bun version | `Bun.JSONL.parse` requires >=1.3.7 | PR1 |

### Kept -- Author Decisions

| Decision | Rationale |
|----------|-----------|
| **Workspace monorepo** | Dashboard (Domain 4) is the next immediate consumer. Setting up workspace now avoids restructuring later. Config cost is ~5 files, one-time. |
| **`repo -> app` rename** | Non-git consumers arrive in Domain 2 (5 v1 hook handlers, expanding to 14 in v2). Renaming during extraction avoids a breaking API change later. |

---

## PR1: Mechanical Extraction + Operational Baseline

PR1 is a boring port with minimal API changes. The only intentional changes are:
1. Rename `repo/gitRoot` to `app/appRoot` (justified above)
2. Rename functions for generalized naming (`getRepoCacheKey` -> `getAppCacheKey`)
3. Change cache directory from `side-quest-git` to `side-quest-observability`
4. Add operational hardening (signal handlers, rotation, validation, CORS)
5. Switch `node:fs`/`node:crypto` to `@side-quest/core` equivalents where the source already uses them

Everything else is a straight copy.

### Part 1: Scaffold the New Repo

#### 1.1 Create repo from template

```bash
# Fork bun-typescript-starter via GitHub UI as side-quest-observability
git clone git@github.com:nathanvale/side-quest-observability.git ~/code/side-quest-observability
cd ~/code/side-quest-observability
```

#### 1.2 Convert to workspace monorepo

**Root `package.json` changes:**
- Set `"name": "@side-quest/observability"`
- Add `"workspaces": ["packages/*"]`
- Add `"engines": { "bun": ">=1.3.7" }`
- Remove `"main"`, `"types"`, `"exports"`, `"files"` (those move to sub-packages)
- Keep all devDependencies at root (biome, husky, commitlint, typescript, etc.)
- Remove `bunup.config.ts` from root (each package gets its own)

**Create `packages/server/package.json`:**
```json
{
  "name": "@side-quest/observability-server",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "engines": {
    "bun": ">=1.3.7"
  },
  "dependencies": {
    "@side-quest/core": "^0.4.0"
  }
}
```

**Create `packages/client/package.json`:**
```json
{
  "name": "@side-quest/observability-client",
  "version": "0.0.0",
  "private": true
}
```

(Client is a placeholder for Domain 4 -- Vue dashboard.)

#### 1.3 TypeScript config

**Root `tsconfig.json`:** Convert to project references:
```json
{
  "extends": "./tsconfig.base.json",
  "references": [
    { "path": "packages/server" }
  ]
}
```

**`packages/server/tsconfig.json`:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "./src",
    "sourceMap": true,
    "noEmit": false,
    "allowImportingTsExtensions": false,
    "module": "ESNext",
    "composite": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

#### 1.4 Build config

**`packages/server/bunup.config.ts`:**
```ts
import { defineConfig } from 'bunup'

export default defineConfig({
  entry: './src/index.ts',
  outDir: './dist',
  format: 'esm',
  dts: true,
  clean: true,
  splitting: false,
})
```

#### 1.5 Directory structure after scaffold

```
side-quest-observability/
  package.json              (workspace root)
  tsconfig.base.json        (from template, untouched)
  tsconfig.json             (project references)
  biome.json                (from template, root-level only)
  packages/
    server/
      package.json
      tsconfig.json
      bunup.config.ts
      src/                  (empty, ready for extraction)
    client/
      package.json          (placeholder)
```

#### 1.6 Verification

```bash
bun install          # workspaces resolve, @side-quest/core installed
bun run typecheck    # passes (no source yet)
```

---

### Part 2: File-by-File Extraction Checklist

#### 2.1 `types.ts` -- RENAME ONLY

**Source:** `~/code/side-quest-git/src/events/types.ts`
**Target:** `packages/server/src/types.ts`

**Changes from source (minimal):**

| What | Before (side-quest-git) | After (observability) |
|------|------------------------|----------------------|
| `EventEnvelope.repo` | `repo: string` | Renamed to `app: string` |
| `EventEnvelope.gitRoot` | `gitRoot: string` | Renamed to `appRoot: string` |
| `EventContext.repo` | `repo: string` | Renamed to `app: string` |
| `EventContext.gitRoot` | `gitRoot: string` | Renamed to `appRoot: string` |

**Changed in PR1 (moved from PR2 -- OBS-2 C1 fix):**
- `EventType` includes 5 v1 `ClaudeHookEvent` members (OBS-2's emitter needs them immediately)

**NOT changed in PR1 (deferred to PR2):**
- Remaining 9 `ClaudeHookEvent` members (SessionEnd, Notification, UserPromptSubmit, SubagentStart, SubagentStop, PreCompact, PermissionRequest, TeammateIdle, TaskCompleted)
- `source` stays as `'cli' | 'hook'` (no widening)
- `correlationId` stays as single field (no three-tier CIDs)

```typescript
/** Git worktree CLI events. */
export type CliEventType =
  | 'worktree.created' | 'worktree.deleted' | 'worktree.synced'
  | 'worktree.cleaned' | 'worktree.attached' | 'worktree.installed'

/** Hook lifecycle events (from side-quest-git). */
export type HookEventType =
  | 'session.started' | 'session.ended' | 'session.compacted'
  | 'safety.blocked' | 'command.executed'

/** Claude Code hook events -- v1 (5 events). Remaining 9 added in PR2. */
export type ClaudeHookEvent =
  | 'hook.session_start'
  | 'hook.pre_tool_use'
  | 'hook.post_tool_use'
  | 'hook.post_tool_use_failure'
  | 'hook.stop'

/** All event types. Extended in PR2 with remaining 9 ClaudeHookEvent members. */
export type EventType = CliEventType | HookEventType | ClaudeHookEvent

/** Event envelope wrapping all events. */
export interface EventEnvelope<T = unknown> {
  readonly schemaVersion: '1.0.0'
  readonly id: string
  readonly timestamp: string
  readonly type: EventType
  readonly app: string             // was "repo"
  readonly appRoot: string         // was "gitRoot"
  readonly source: 'cli' | 'hook'
  readonly correlationId: string
  readonly data: T
}

/** Context provided when creating events. */
export interface EventContext {
  readonly app: string             // was "repo"
  readonly appRoot: string         // was "gitRoot"
  readonly source: 'cli' | 'hook'
  readonly correlationId?: string
}
```

**@side-quest/core imports:** None (pure types file).

---

#### 2.2 `schema.ts` -- RENAME ONLY

**Source:** `~/code/side-quest-git/src/events/schema.ts`
**Target:** `packages/server/src/schema.ts`

**Changes:**
- Update `createEvent` to populate `app`/`appRoot` instead of `repo`/`gitRoot`
- `correlationId` logic unchanged (single field, same as source)

**@side-quest/core imports (unchanged from source):**
- `generateCorrelationId` from `@side-quest/core/instrumentation`
- `nanoId` from `@side-quest/core/utils`

---

#### 2.3 `store.ts` -- STRAIGHT COPY + ROTATION

**Source:** `~/code/side-quest-git/src/events/store.ts`
**Target:** `packages/server/src/store.ts`

**Changes from source:**

1. **`push()` stays synchronous** -- no `withFileLock`, no async. Single Bun process, sync append is already serialized by the event loop.

2. **Add JSONL rotation** (Operator finding -- unbounded growth):

```typescript
/** Maximum JSONL file size before rotation (10MB). */
const MAX_JSONL_BYTES = 10 * 1024 * 1024

/** Maximum number of rotated files to keep. */
const MAX_ROTATED_FILES = 5

push(event: EventEnvelope): void {
  this.buffer[this.writeIndex] = event
  this.writeIndex = (this.writeIndex + 1) % this.capacity
  if (this.count < this.capacity) this.count++
  if (this.persistPath) {
    this.rotateIfNeeded()
    appendToFileSync(this.persistPath, `${JSON.stringify(event)}\n`)
  }
}

/** Rotate JSONL file if it exceeds size limit. */
private rotateIfNeeded(): void {
  if (!this.persistPath) return
  try {
    const stat = Bun.file(this.persistPath)
    if (stat.size < MAX_JSONL_BYTES) return
    // Rotate: events.jsonl -> events.1.jsonl, events.1.jsonl -> events.2.jsonl, etc.
    for (let i = MAX_ROTATED_FILES - 1; i >= 1; i--) {
      const from = `${this.persistPath}.${i}`
      const to = `${this.persistPath}.${i + 1}`
      if (pathExistsSync(from)) renameSync(from, to)
    }
    renameSync(this.persistPath, `${this.persistPath}.1`)
  } catch {
    // Best-effort rotation -- persist failure should not crash the server
  }
}
```

3. **Degrade gracefully on persist failure** (Operator finding):

```typescript
if (this.persistPath) {
  try {
    this.rotateIfNeeded()
    appendToFileSync(this.persistPath, `${JSON.stringify(event)}\n`)
  } catch (err) {
    this.persistErrors++
    if (this.persistErrors === 1 || this.persistErrors % 100 === 0) {
      console.error(`[event-store] persist failure #${this.persistErrors}: ${err}`)
    }
    // Continue operating in memory-only mode
  }
}
```

**NOT added in PR1:**
- No `withFileLock` (cut -- no demonstrated contention)
- No `loadFromDisk()` (cut -- no restart-replay requirement)

**@side-quest/core imports (same as source):**
- `appendToFileSync`, `ensureDirSync`, `pathExistsSync` from `@side-quest/core/fs`

---

#### 2.4 `server.ts` -- RENAME + OPERATIONAL HARDENING

**Source:** `~/code/side-quest-git/src/events/server.ts`
**Target:** `packages/server/src/server.ts`

**Changes from source:**

| What | Before | After |
|------|--------|-------|
| `ServerOptions.repoName` | Required | Renamed to `appName` (required) |
| `ServerOptions.gitRoot` | Required | Renamed to `appRoot` (optional, defaults to `cwd()`) |
| POST handler fields | Sets `repo`, `gitRoot` | Sets `app`, `appRoot` |
| Cache directory | Per-app (`~/.cache/side-quest-git/{cacheKey}/`) | **Global** (`~/.cache/side-quest-observability/`) |
| Port/PID files | Per-app (`{cacheDir}/events.port`) | **Global** (`~/.cache/side-quest-observability/events.port`) |

**Architecture change: Global server model**

The server writes its port/pid/nonce files to a single global directory:

```typescript
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Global cache directory -- one server for all projects. */
const GLOBAL_CACHE_DIR = join(homedir(), '.cache', 'side-quest-observability')
```

Events carry `appRoot` (from the POST body) so the dashboard can filter/group by project. The server itself is project-agnostic. `ServerOptions.appRoot` is used as a default for event context but does NOT determine the cache directory.

**Operational additions (from Operator review):**

**1. Signal handlers for clean shutdown:**

```typescript
function registerSignalHandlers(server: Server): void {
  const cleanup = () => {
    removePidFiles(GLOBAL_CACHE_DIR)
    server.stop()
    process.exit(0)
  }
  process.on('SIGTERM', cleanup)
  process.on('SIGINT', cleanup)
}
```

**2. PID identity verification via startup nonce:**

```typescript
function writePidFiles(port: number, pid: number): string {
  ensureDirSync(GLOBAL_CACHE_DIR)
  const nonce = nanoId()
  writeTextFileSync(join(GLOBAL_CACHE_DIR, 'events.port'), String(port))
  writeTextFileSync(join(GLOBAL_CACHE_DIR, 'events.pid'), String(pid))
  writeTextFileSync(join(GLOBAL_CACHE_DIR, 'events.nonce'), nonce)
  return nonce
}
```

Emitter (and stale PID check) can verify identity by calling `GET /health` and comparing the nonce. This prevents PID-reuse misrouting.

**3. Ingress: Two POST routes (raw hooks + pre-built envelopes)**

The server accepts events via two routes:

```
POST /events/:eventName   -- Raw hook stdin (dumb hook model). Server enriches.
POST /events              -- Pre-built EventEnvelope (programmatic clients). Server validates + stores.
```

**Route 1: `POST /events/:eventName` (hook ingress -- "dumb hook, smart server")**

This is the primary ingress for Claude Code hooks. The hook POSTs raw stdin JSON with the event name in the URL path. The server does all enrichment:

```typescript
/** Maps URL path event names to EventType values. */
const EVENT_NAME_MAP: Record<string, EventType> = {
  'session-start': 'hook.session_start',
  'pre-tool-use': 'hook.pre_tool_use',
  'post-tool-use': 'hook.post_tool_use',
  'post-tool-use-failure': 'hook.post_tool_use_failure',
  'stop': 'hook.stop',
  // v2: session-end, notification, user-prompt-submit, subagent-start, etc.
}

/** Extract event-specific data from raw Claude Code stdin payload. */
function enrichHookPayload(eventName: string, raw: Record<string, unknown>): Record<string, unknown> {
  switch (eventName) {
    case 'session-start':
      return {
        hookEvent: 'session_start',
        sessionId: raw.session_id,
        source: raw.source ?? 'unknown',
        model: raw.model ?? '',
        agentType: raw.agent_type,
        permissionMode: raw.permission_mode,
      }
    case 'pre-tool-use': {
      const inputStr = JSON.stringify(raw.tool_input ?? {})
      return {
        hookEvent: 'pre_tool_use',
        sessionId: raw.session_id,
        toolName: raw.tool_name ?? '',
        toolInputPreview: inputStr.length > 2000 ? inputStr.slice(0, 2000) + '...' : inputStr,
        permissionMode: raw.permission_mode,
      }
    }
    case 'post-tool-use': {
      const resultStr = JSON.stringify(raw.tool_result ?? '')
      return {
        hookEvent: 'post_tool_use',
        sessionId: raw.session_id,
        toolName: raw.tool_name ?? '',
        toolUseId: raw.tool_use_id ?? '',
        toolResultPreview: resultStr.length > 2000 ? resultStr.slice(0, 2000) + '...' : resultStr,
        permissionMode: raw.permission_mode,
      }
    }
    case 'post-tool-use-failure':
      return {
        hookEvent: 'post_tool_use_failure',
        sessionId: raw.session_id,
        toolName: raw.tool_name ?? '',
        toolUseId: raw.tool_use_id ?? '',
        toolError: String(raw.tool_error ?? ''),
        permissionMode: raw.permission_mode,
      }
    case 'stop':
      return {
        hookEvent: 'stop',
        sessionId: raw.session_id,
        permissionMode: raw.permission_mode,
      }
    default:
      // Unknown event: pass through raw payload (forward-compatible)
      return { hookEvent: eventName, sessionId: raw.session_id, raw }
  }
}

// In the route handler:
async function handleHookEvent(req: Request, eventName: string): Promise<Response> {
  const body = await req.json()
  if (!body || typeof body !== 'object') {
    return new Response(JSON.stringify({ error: 'Body must be an object' }), { status: 400, headers: CORS_HEADERS })
  }

  const raw = body as Record<string, unknown>

  // Stop recursion guard: if stop_hook_active is true, skip
  if (eventName === 'stop' && raw.stop_hook_active === true) {
    return new Response(JSON.stringify({ skipped: 'stop_hook_active' }), { status: 200, headers: CORS_HEADERS })
  }

  // Map event name to EventType
  const eventType = EVENT_NAME_MAP[eventName] ?? `hook.${eventName.replace(/-/g, '_')}`

  // Generate envelope (server-side -- hook sends nothing but raw stdin)
  const envelope: EventEnvelope = {
    schemaVersion: '1.0.0',
    id: nanoId(),
    timestamp: new Date().toISOString(),
    type: eventType as EventType,
    app: 'observability',
    appRoot: String(raw.cwd ?? ''),
    source: 'hook',
    correlationId: generateCorrelationId(),
    data: enrichHookPayload(eventName, raw),
  }

  store.push(envelope)
  server.publish('events.all', JSON.stringify(envelope))
  server.publish(`events.${eventType}`, JSON.stringify(envelope))

  return new Response(JSON.stringify({ id: envelope.id }), { status: 201, headers: CORS_HEADERS })
}
```

**Route 2: `POST /events` (envelope ingress -- programmatic clients)**

For clients that build their own EventEnvelope (e.g., git plugin's `event-bus-client.ts`, future CLI tools):

```typescript
function validateEventPayload(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Body must be an object' }
  const obj = body as Record<string, unknown>
  // Full envelope: must have schemaVersion, type, data
  if (obj.schemaVersion) {
    if (obj.schemaVersion !== '1.0.0') return { valid: false, error: 'Unknown schemaVersion' }
    if (typeof obj.type !== 'string') return { valid: false, error: 'Missing or invalid type' }
    if (!('data' in obj)) return { valid: false, error: 'Missing data field' }
    return { valid: true }
  }
  // Partial payload: must have type and data
  if (typeof obj.type !== 'string') return { valid: false, error: 'Missing or invalid type' }
  if (!('data' in obj)) return { valid: false, error: 'Missing data field' }
  return { valid: true }
}
```

Returns 400 with structured error on invalid payloads. Maximum body size: 1MB (reject larger).

**Note on `type` validation:** The server validates that `type` is a string but does NOT validate it against the `EventType` union. This is intentional -- the `EventType` union is a TypeScript-only constraint for compile-time safety. At runtime, the server accepts any string for `type`, which allows new event types without requiring a server update.

**4. CORS headers for dashboard:**

```typescript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Add to all responses
// Handle OPTIONS preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
```

**5. Health endpoint includes identity + diagnostics:**

```typescript
// GET /health
{
  status: 'ok',
  nonce: serverNonce,
  uptime: process.uptime(),
  events: store.size,
  persistErrors: store.persistErrors,
  wsClients: clients.size,
}
```

**6. WebSocket protocol (contract for all consumers):**

The server's WebSocket endpoint at `/ws` is the canonical real-time event stream. Any service -- dashboard, CLI tail, voice TTS, external integrations -- connects here to receive events. The server doesn't know or care what's consuming.

**Design: "HTTP for history, WebSocket for live"**

This follows community consensus (confirmed across 7 sources in WebSocket research). History retrieval and live streaming are separate concerns:
- `GET /events?type=&since=&limit=` -- HTTP, for backfill/history
- `ws://localhost:{port}/ws` -- WebSocket, for real-time stream

No initial batch over WebSocket on connect. The client fetches history via HTTP, then opens WS for live events. This avoids gap-loss complexity and lets HTTP handle filtering/pagination naturally.

**Wire format -- one JSON-stringified `EventEnvelope` per WebSocket frame:**

```
Server -> Client (per new event):
  JSON.stringify(envelope)

  Example frame:
  {"schemaVersion":"1.0.0","id":"abc123","timestamp":"2026-02-17T10:30:45.123Z",
   "type":"hook.session_start","app":"observability","appRoot":"/home/user/project",
   "source":"hook","correlationId":"a1b2c3d4","data":{...}}
```

No message type wrapper (`{ type: 'event', data: ... }`) in v1. Raw envelope per frame -- same as the existing side-quest-git implementation. This is the simplest possible protocol: one event = one frame.

**Client -> Server: nothing (read-only subscription for v1).**

v2 (Stage 5d HITL) may add client-to-server messages for permission responses.

**Bun.serve WebSocket configuration:**

```typescript
Bun.serve({
  websocket: {
    open(ws) {
      ws.subscribe('events.all')
      // Optional type filter from query param
      const url = new URL(ws.data.url)
      const typeFilter = url.searchParams.get('type')
      if (typeFilter) {
        ws.data.typeFilter = typeFilter
        ws.subscribe(`events.${typeFilter}`)
      }
    },
    close(ws) {
      // Bun auto-unsubscribes on close
    },
    message(ws, data) {
      // v1: ignore all client messages (read-only)
    },
    drain(ws) {
      // Backpressure relief -- Bun resumes queued sends automatically
    },
    sendPings: true,                    // automatic ping/pong (built-in)
    idleTimeout: 120,                   // 2 minutes, auto-close dead connections
    backpressureLimit: 1024 * 1024,     // 1MB per connection
    closeOnBackpressureLimit: false,     // drop messages, don't kill connection
  }
})
```

**Broadcasting uses Bun's native pub/sub (not manual Set iteration):**

```typescript
// On new event (after store.push):
const message = JSON.stringify(event)
server.publish('events.all', message)

// Also publish to type-specific topic for filtered subscribers
server.publish(`events.${event.type}`, message)
```

This replaces the manual `for (const ws of clients) { ws.send(message) }` pattern from side-quest-git. Bun's native pub/sub handles fan-out internally with less GC pressure.

**Server-side type filtering via query param (matches existing side-quest-git pattern):**

```
ws://localhost:7483/ws                        -- all events
ws://localhost:7483/ws?type=hook.stop          -- only stop events
ws://localhost:7483/ws?type=hook.pre_tool_use  -- only pre-tool-use events
```

Filtering is server-side via topic subscription. The dashboard subscribes to all; future services (voice TTS) can subscribe to only the events they need.

**Backpressure handling:**

For localhost consumers, backpressure is rare (usually a closed browser tab). Strategy:
- `backpressureLimit: 1MB` per connection
- `closeOnBackpressureLimit: false` -- drop oldest queued messages rather than killing the connection
- `drain` handler resumes normal sending
- Server logs rate-limited warning if backpressure occurs

**What this means for consumers:**

| Consumer | Connection | Filter | Notes |
|----------|-----------|--------|-------|
| Vue dashboard | `ws://localhost:{port}/ws` | None (all events) | Fetches `GET /events` for history on mount |
| CLI tail command | `ws://localhost:{port}/ws?type=hook.stop` | By type | Future: `observability tail --type=hook.stop` |
| Voice TTS (Stage 5f) | `ws://localhost:{port}/ws?type=hook.subagent_start` | By type | Only needs agent start/stop events |
| External service | `ws://localhost:{port}/ws` | None or by type | Generic consumer, same protocol |

**@side-quest/core imports (same as source + nanoId for nonce + enrichment):**
- `ensureDirSync`, `pathExistsSync`, `readTextFileSync`, `writeTextFileSync` from `@side-quest/core/fs`
- `nanoId` from `@side-quest/core/utils`
- `generateCorrelationId` from `@side-quest/core/instrumentation` (for hook event envelope generation)

---

#### 2.5 `client.ts` -- COPY + BACKOFF FIX

**Source:** `~/code/side-quest-git/src/events/client.ts`
**Target:** `packages/server/src/client.ts`

**Changes:** Add exponential backoff with jitter for WebSocket reconnection (Operator finding).

```typescript
// Before: fixed 2000ms delay
ws.onclose = () => {
  ws = null
  if (!closed && autoReconnect) {
    reconnectTimer = setTimeout(connect, reconnectDelay)
  }
}

// After: exponential backoff with jitter, max 30s
let attempt = 0
const MAX_BACKOFF_MS = 30_000

ws.onclose = () => {
  ws = null
  if (!closed && autoReconnect) {
    const base = Math.min(reconnectDelay * 2 ** attempt, MAX_BACKOFF_MS)
    const jitter = Math.random() * base * 0.3
    reconnectTimer = setTimeout(connect, base + jitter)
    attempt++
  }
}

ws.onopen = () => {
  attempt = 0  // reset on successful connection
}
```

**@side-quest/core imports:** None.

---

#### 2.6 `emit.ts` -- RENAME + FAILURE LOGGING

**Source:** `~/code/side-quest-git/src/events/emit.ts`
**Target:** `packages/server/src/emit.ts`

**Changes from source:**

1. **Rename:** `repo`/`gitRoot` -> `app`/`appRoot`, `getRepoCacheKey` -> `getAppCacheKey`

2. **Replace `node:fs` with `@side-quest/core/fs`:**
   - `fs.readFileSync` becomes `readTextFileSync`

3. **Add rate-limited failure logging** (Operator finding -- zero visibility):

```typescript
let emitFailures = 0

export async function emitEvent(event: EventEnvelope, port: number): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 500)
  try {
    await fetch(`http://127.0.0.1:${port}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: controller.signal,
    })
    emitFailures = 0  // reset on success
  } catch (err) {
    emitFailures++
    // Log first failure and every 50th after -- not every single one
    if (emitFailures === 1 || emitFailures % 50 === 0) {
      console.error(`[emitter] emit failure #${emitFailures}: ${err}`)
    }
  } finally {
    clearTimeout(timeout)
  }
}
```

4. **Add identity verification before emitting** (Operator finding -- PID reuse):

```typescript
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Global cache directory -- matches server's location. */
const GLOBAL_CACHE_DIR = join(homedir(), '.cache', 'side-quest-observability')

export async function isEventServerRunning(): Promise<{ running: boolean; port?: number }> {
  const pidFile = join(GLOBAL_CACHE_DIR, 'events.pid')
  const portFile = join(GLOBAL_CACHE_DIR, 'events.port')
  const nonceFile = join(GLOBAL_CACHE_DIR, 'events.nonce')

  if (!pathExistsSync(pidFile) || !pathExistsSync(portFile)) {
    return { running: false }
  }

  const pid = Number.parseInt(readTextFileSync(pidFile), 10)
  // Quick check: is the PID alive?
  try {
    process.kill(pid, 0)
  } catch {
    // PID dead -- clean up stale files
    removeStalePidFiles(GLOBAL_CACHE_DIR)
    return { running: false }
  }

  // PID alive -- verify identity via /health nonce
  const port = Number.parseInt(readTextFileSync(portFile), 10)
  if (pathExistsSync(nonceFile)) {
    const expectedNonce = readTextFileSync(nonceFile).trim()
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(500) })
      const health = await res.json()
      if (health.nonce !== expectedNonce) {
        // PID reuse -- different process on this PID
        removeStalePidFiles(GLOBAL_CACHE_DIR)
        return { running: false }
      }
    } catch {
      // Can't reach server -- treat as not running
      removeStalePidFiles(GLOBAL_CACHE_DIR)
      return { running: false }
    }
  }

  return { running: true, port }
}
```

5. **Dual cache path reads for migration** (Architect finding):

```typescript
/**
 * Discover the event server. Global model: one port file for all projects.
 * Falls back to legacy side-quest-git per-app cache paths during migration.
 */
export function discoverEventServer(appRoot?: string): { port: number } | null {
  // Try global path first (new model)
  const globalPortFile = join(GLOBAL_CACHE_DIR, 'events.port')
  if (pathExistsSync(globalPortFile)) {
    const port = Number.parseInt(readTextFileSync(globalPortFile), 10)
    if (!Number.isNaN(port)) return { port }
  }

  // Fall back to legacy side-quest-git per-app path (migration period only)
  if (appRoot) {
    const legacyCacheKey = getAppCacheKey(appRoot)
    const legacyPortFile = join(homedir(), '.cache', 'side-quest-git', legacyCacheKey, 'events.port')
    if (pathExistsSync(legacyPortFile)) {
      const port = Number.parseInt(readTextFileSync(legacyPortFile), 10)
      if (!Number.isNaN(port)) return { port }
    }
  }

  return null
}
```

**@side-quest/core imports:**
- `readTextFileSync`, `pathExistsSync` from `@side-quest/core/fs`

---

#### 2.7 `cache-key.ts` -- SIMPLIFY + RENAME (Migration utility)

**Source:** `~/code/side-quest-git/src/events/cache-key.ts`
**Target:** `packages/server/src/cache-key.ts`

**Role in global model:** With the global server, `getAppCacheKey` is no longer used for port/pid file discovery (those use `GLOBAL_CACHE_DIR` directly). However, it is still needed for:
1. **Migration compatibility** -- `discoverEventServer` falls back to legacy per-app cache paths in side-quest-git
2. **JSONL persistence** -- per-app JSONL files may use app-specific subdirectories for organization
3. **Re-export from `@side-quest/git`** -- existing consumers depend on this function

**Changes from source:**

1. **Rename `getRepoCacheKey` to `getAppCacheKey`**
2. **Replace manual SHA256 with `contentId`:**
   ```typescript
   // Before
   import { createHash } from 'node:crypto'
   const digest = createHash('sha256').update(normalizedRoot).digest('hex').slice(0, 12)

   // After
   import { contentId } from '@side-quest/core/hash'
   const digest = contentId(normalizedRoot)  // already returns 12-char hex
   ```
3. **Update cache directory path:** `side-quest-git` -> `side-quest-observability`
4. **Rename `getEventCacheDir` to `getAppCacheDir`**

**@side-quest/core imports:**
- `contentId` from `@side-quest/core/hash`

---

#### 2.8 `index.ts` -- BARREL EXPORT

```typescript
export * from './client.js'
export * from './emit.js'
export * from './schema.js'
export * from './server.js'
export * from './store.js'
export * from './types.js'
```

---

### Part 3: @side-quest/core Imports Summary (Per File)

| File | Module | Imports |
|------|--------|---------|
| `types.ts` | (none) | Pure types, no runtime imports |
| `schema.ts` | `instrumentation` | `generateCorrelationId` |
| `schema.ts` | `utils` | `nanoId` |
| `store.ts` | `fs` | `appendToFileSync`, `ensureDirSync`, `pathExistsSync` |
| `server.ts` | `fs` | `ensureDirSync`, `pathExistsSync`, `readTextFileSync`, `writeTextFileSync` |
| `server.ts` | `utils` | `nanoId` |
| `server.ts` | `instrumentation` | `generateCorrelationId` (for hook event enrichment) |
| `client.ts` | (none) | No external dependencies |
| `emit.ts` | `fs` | `readTextFileSync`, `pathExistsSync` |
| `cache-key.ts` | `hash` | `contentId` |

---

### Part 4: Test Porting Plan

#### 4.1 Test file mapping

| Source | Target | Changes needed |
|--------|--------|---------------|
| `cache-key.test.ts` | `packages/server/src/cache-key.test.ts` | Rename functions, update cache path to `side-quest-observability` |
| `schema.test.ts` | `packages/server/src/schema.test.ts` | Update `EventContext` to `app`/`appRoot` (correlationId unchanged) |
| `server.test.ts` | `packages/server/src/server.test.ts` | Rename `repoName` to `appName`, `gitRoot` to `appRoot` |
| `emit.test.ts` | `packages/server/src/emit.test.ts` | Rename cache key fn, update path assertions |

#### 4.2 New tests for operational additions

- **Signal handler test:** Verify PID files are removed on SIGTERM
- **JSONL rotation test:** Push events past 10MB threshold, verify rotation creates `.1` file
- **Ingress validation test:** POST invalid payloads, verify 400 responses with error messages
- **CORS test:** Verify OPTIONS preflight returns correct headers
- **Nonce identity test:** Verify `/health` returns nonce, verify stale PID detection with wrong nonce
- **Emitter failure logging test:** Verify rate-limited stderr output on emit failure
- **WS backoff test:** Verify reconnect delay increases exponentially with jitter

#### 4.3 Hook event enrichment tests (dumb hook, smart server)

These test the `POST /events/:eventName` route that processes raw hook stdin:

- **Event name mapping:** `session-start` -> `hook.session_start`, `pre-tool-use` -> `hook.pre_tool_use`, etc.
- **SessionStart enrichment:** Extracts `model`, `source`, `agent_type` from raw stdin
- **PreToolUse truncation:** `tool_input` JSON > 2000 chars is truncated with `...` suffix
- **PostToolUse truncation:** `tool_result` JSON > 2000 chars is truncated with `...` suffix
- **PostToolUseFailure:** `tool_error` extracted as string
- **Stop recursion guard:** `stop_hook_active: true` returns 200 with `{ skipped: 'stop_hook_active' }`, no event stored
- **Envelope generation:** Response contains `id`, stored event has `schemaVersion`, `timestamp`, `correlationId`
- **Unknown event name:** Forward-compatible -- maps to `hook.<name>` with raw payload passthrough
- **Invalid body:** Returns 400 for non-object, non-JSON, or oversized (>1MB) bodies
- **WebSocket broadcast:** Stored event is published to `events.all` and `events.<type>` topics

---

### Part 5: Verification Commands

#### After scaffold (Part 1)

```bash
cd ~/code/side-quest-observability
bun install
bun run typecheck
```

#### After extraction (Part 2)

```bash
cd ~/code/side-quest-observability
bun run typecheck
cd packages/server && bun test
bun run check
cd packages/server && bunx bunup
bun run validate
```

#### Smoke test the server

```bash
# Start server
cd packages/server
bun run src/server.ts

# Health check (should include nonce)
curl http://127.0.0.1:7483/health

# Post a raw hook event (dumb hook model -- server enriches)
curl -X POST http://127.0.0.1:7483/events/session-start \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"test-123","transcript_path":"/tmp/t.jsonl","cwd":"/home/user/project","permission_mode":"default","hook_event_name":"SessionStart","source":"vscode","model":"claude-opus-4-6"}'
# Should return 201 with { id: "..." }

# Post a pre-built envelope (programmatic clients)
curl -X POST http://127.0.0.1:7483/events \
  -H 'Content-Type: application/json' \
  -d '{"schemaVersion":"1.0.0","type":"session.started","data":{"model":"claude-opus-4-6"},"app":"test","appRoot":"/tmp","source":"cli","correlationId":"test-123","id":"test-id","timestamp":"2026-02-17T00:00:00Z"}'

# Post an invalid event (should return 400)
curl -X POST http://127.0.0.1:7483/events \
  -H 'Content-Type: application/json' \
  -d '{"bad":"payload"}'

# Post stop with recursion guard (should return 200 with skipped)
curl -X POST http://127.0.0.1:7483/events/stop \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"test-123","transcript_path":"/tmp/t.jsonl","cwd":"/tmp","permission_mode":"default","stop_hook_active":true}'

# CORS preflight
curl -X OPTIONS http://127.0.0.1:7483/events -v

# Query events
curl http://127.0.0.1:7483/events

# WebSocket
wscat -c ws://127.0.0.1:7483/ws

# Kill server, verify PID files cleaned up (global directory, no per-app subdirs)
kill $(cat ~/.cache/side-quest-observability/events.pid)
ls ~/.cache/side-quest-observability/events.pid  # should not exist
```

---

### Part 6: Implementation Sequence (PR1)

1. **Scaffold repo** (Part 1) -- create workspace structure, install deps
2. **Extract `types.ts`** -- all other files depend on this (rename only)
3. **Extract `cache-key.ts`** -- used by server.ts and emit.ts
4. **Extract `schema.ts`** -- used by server.ts and emit.ts
5. **Extract `store.ts`** -- used by server.ts (add rotation + graceful degradation)
6. **Extract `server.ts`** -- depends on cache-key, schema, store, types (add signal handlers, validation, CORS, nonce)
7. **Extract `client.ts`** -- standalone (add exponential backoff)
8. **Extract `emit.ts`** -- depends on cache-key, schema, types (add failure logging, nonce verification, dual paths)
9. **Create `index.ts`** -- barrel export
10. **Port tests** -- cache-key.test.ts first (simplest), then schema, server, emit
11. **Add operational tests** -- rotation, validation, CORS, signal handlers, backoff
12. **Run full validation** -- typecheck + test + lint + build

---

## PR2: Generalization (Deferred -- v2 events + correlation model)

PR2 adds features deferred from PR1. Ships when OBS-2 v2 expands beyond 5 hook events.

### 2a. EventType expansion -- remaining 9 ClaudeHookEvent members

PR1 already includes the 5 v1 members. PR2 adds the remaining 9:

```typescript
// Added in PR2 (extends the ClaudeHookEvent union from PR1)
type ClaudeHookEventV2 =
  | 'hook.session_end'
  | 'hook.notification' | 'hook.user_prompt_submit'
  | 'hook.subagent_start' | 'hook.subagent_stop'
  | 'hook.pre_compact' | 'hook.permission_request'
  | 'hook.teammate_idle' | 'hook.task_completed'

type ClaudeHookEvent =
  | 'hook.session_start' | 'hook.pre_tool_use' | 'hook.post_tool_use'
  | 'hook.post_tool_use_failure' | 'hook.stop'  // v1 (PR1)
  | ClaudeHookEventV2                             // v2 (PR2)

type EventType = CliEventType | HookEventType | ClaudeHookEvent
```

Consumers add new event types by extending the union in a declaration file or by submitting a PR to add them to the core type.

### 2b. Three-tier correlation IDs

Replace single `correlationId` with:

```typescript
interface EventEnvelope<T = unknown> {
  // ... existing fields ...
  readonly sessionCid: string      // Claude Code session_id (tier 1)
  readonly cid: string             // This event's correlation ID (tier 2)
  readonly parentCid?: string      // Parent event for subagent traces (tier 3)
}
```

**Migration strategy:** Add new fields alongside `correlationId` first (both present), then deprecate `correlationId` in a subsequent release.

Maps to OTel's trace model:
- `sessionCid` = trace_id (Claude Code session)
- `cid` = span_id (this specific event)
- `parentCid` = parent_span_id (for SubagentStart/Stop tracing)

### 2c. Source field -- evaluate widening

Only widen `source` from `'cli' | 'hook'` if a concrete consumer needs it. Candidate: `'dashboard'` for HITL events (Domain 5d). Otherwise keep constrained.

### 2d. Cache directory GC

Opportunistic cleanup of stale `cacheKey` directories on server startup:
- Scan `~/.cache/side-quest-observability/`
- Remove dirs with no activity (no file modifications) in 30+ days
- Log what was cleaned

---

## PR3: Advanced Persistence (Deferred -- only if proven needed)

### 3a. `withFileLock` on push()

Only add if a real concurrency bug is demonstrated. Would make `push()` async and require all callers to `await`.

### 3b. `loadFromDisk()` via `Bun.JSONL.parse`

Only add if a restart-replay use case materializes (e.g., dashboard needs historical events after server restart).

---

## Critical Files

| File | Role |
|------|------|
| `~/code/side-quest-git/src/events/types.ts` | Source types to rename |
| `~/code/side-quest-git/src/events/server.ts` | Most complex extraction target |
| `~/code/side-quest-git/src/events/store.ts` | Ring buffer (add rotation + graceful degradation) |
| `~/code/side-quest-git/src/events/server.test.ts` | Largest test file (16 tests) |
| `~/code/bun-typescript-starter/package.json` | Template to scaffold from |

---

## Deferred Items Tracker

| Item | Deferred to | Trigger |
|------|-------------|---------|
| Three-tier CIDs (`sessionCid/cid/parentCid`) | PR2 | SubagentStart/Stop events need parent tracing |
| Remaining 9 `ClaudeHookEvent` type members | PR2 | OBS-2 v2 handler expansion |
| `source` widening beyond `'cli' \| 'hook'` | PR2 | Concrete consumer identified |
| Cache directory GC | PR2 | Non-blocking improvement |
| `withFileLock` on push() | PR3 | Demonstrated concurrency bug |
| `loadFromDisk()` | PR3 | Restart-replay use case proven |
| `withTimeout` wrapper on emitter | PR2 | Nice-to-have, AbortController works fine |
| `/metrics` endpoint | PR2 | Dashboard health monitoring |
| `doctor` diagnostics command | PR2 | Operational tooling |
| Per-app JSONL subdirectories | PR2 | Dashboard needs per-project event history |
