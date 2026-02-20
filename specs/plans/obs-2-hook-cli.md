# OBS-2: Hook CLI Implementation Plan -- Revised v3 (Dumb Hook, Smart Server)

## Status: Completed (v1)

Parent plan: `specs/plans/observability-master-plan.md` (Stage 3)
Depends on: OBS-1 PR1 (event server extraction -- server handles all enrichment)

## Domain Status: Thin Wrapper

After v3's "dumb hook, smart server" restructuring, OBS-2 is the thinnest domain -- a single file (`cli/index.ts`, ~15 lines) that serves as the executable entry point. Most of the original OBS-2 work migrated to:
- **OBS-1** (server enrichment pipeline -- type mapping, payload extraction, envelope generation)
- **OBS-3** (self-contained hook script -- stdin read, port discovery, POST)

OBS-2 ships as part of OBS-1's repo and takes ~30 minutes to implement. It is preserved as a domain for traceability (the CLI entry point is a distinct responsibility from the library) but is not a standalone workstream.

## Architecture: Dumb Hook, Smart Server

**Key decision (v3):** The hook is a dumb stdin-to-HTTP pipe. All intelligence lives in the server.

```
Hook (dumb pipe):     stdin --> POST /events/{event-name} --> exit 0
Server (smart brain): validate, map event type, extract fields, truncate, generate envelope, store, broadcast
```

**What this means:**
- Hook has ZERO event-specific logic -- no payload extraction, no field mapping, no type casting
- Hook has ZERO external dependencies -- no `@side-quest/observability` import, no `@side-quest/core`
- Hook is fully self-contained -- can be inlined into OBS-3's `emit-event.ts` (~40 lines)
- Server owns: EventType mapping, field truncation, envelope generation, stop_hook_active guard, correlation IDs
- Adding a new event type requires ZERO hook changes -- just add a server-side handler

**Why this is better:**
- Eliminates the `@side-quest/observability/cli` dependency that broke marketplace compatibility
- Hook process does less work = faster exit = less resource pressure at 412 invocations/session
- All enrichment logic is testable in one place (server) instead of split across hook + server
- Server can evolve enrichment without redeploying hooks

## Review History

**Round 1:** 3-pass review (Architect, Skeptic, Operator). All returned REQUEST CHANGES.
**Round 2:** 3-pass review of revised plan. All returned APPROVE WITH CONDITIONS.
**v3 revision:** Brainstorm session concluded "dumb hook, smart server" is the correct split. Hook stripped to raw stdin forwarder. All enrichment moved to OBS-1's server (POST /events handler).

Reviews at `specs/reviews/obs-2-hook-cli-review-pass-{1,2,3}.md` and `specs/reviews/obs-2-hook-cli-review-v2-pass-{1,2,3}.md`.

---

## Prerequisites

- OBS-1 PR1 must implement server-side event enrichment (see OBS-1 section 2.4a: "Event Ingress + Enrichment Pipeline")
- OBS-1 must use a global port file at `~/.cache/side-quest-observability/events.port`
- No npm package dependency required -- hook is fully self-contained

---

## 1. v1 Event Scope

5 events that prove end-to-end data flow. The hook doesn't care about event semantics -- it just forwards stdin with the event name.

| # | Event | Hook sends | Server enriches |
|---|-------|-----------|----------------|
| 1 | **SessionStart** | Raw stdin JSON + event name | Maps to `hook.session_start`, extracts model/source/agent_type |
| 2 | **PreToolUse** | Raw stdin JSON + event name | Maps to `hook.pre_tool_use`, extracts tool_name, truncates tool_input |
| 3 | **PostToolUse** | Raw stdin JSON + event name | Maps to `hook.post_tool_use`, extracts tool_name, truncates tool_result |
| 4 | **PostToolUseFailure** | Raw stdin JSON + event name | Maps to `hook.post_tool_use_failure`, extracts tool_name/error |
| 5 | **Stop** | Raw stdin JSON + event name | Maps to `hook.stop`, checks stop_hook_active guard |

Deferred to v2: SessionEnd, Notification, UserPromptSubmit, SubagentStart, SubagentStop, PreCompact, PermissionRequest, TeammateIdle, TaskCompleted.

---

## 2. What OBS-2 No Longer Owns

The v3 "dumb hook" architecture moves these responsibilities to OBS-1's server:

| Responsibility | Was (v2) | Now (v3) |
|---------------|----------|----------|
| Event type mapping (`session-start` -> `hook.session_start`) | Hook dispatch.ts | Server POST handler |
| Payload extraction (tool_name, model, etc.) | Hook dispatch.ts extractPayload() | Server enrichment pipeline |
| Field truncation (tool_input > 2000 chars) | Hook dispatch.ts | Server enrichment pipeline |
| Envelope generation (id, timestamp, correlationId) | Hook emit.ts | Server POST handler |
| stop_hook_active recursion guard | Hook dispatch.ts handleStop() | Server POST handler |
| CommonHookInput validation | Hook dispatch.ts assertCommonFields() | Server ingress validation |
| 1MB stdin size cap | Hook dispatch.ts | **Stays in hook** (OOM protection before JSON.parse) |

**What stays in the hook:**
- Read stdin
- 1MB size cap (pre-parse safety)
- JSON.parse (to verify it's valid JSON before sending)
- Discover port file
- POST to server with 500ms timeout
- Exit 0 always

---

## 3. File Tree

```
packages/server/src/cli/
  index.ts              -- CLI entry point (server command only)
```

**That's 1 source file.** The hook logic is now fully inlined in OBS-3's `emit-event.ts` (~40 lines). OBS-2's role is reduced to the server CLI entry point.

The `dispatch.ts` and `emit.ts` files from v2 are **eliminated**. Their logic either:
- Moved to the server (enrichment, validation, envelope generation) -- see OBS-1
- Moved to the plugin hook script (stdin read, port discovery, POST) -- see OBS-3

---

## 4. CLI Entry Point (`index.ts`)

With the dumb hook model, the CLI package only needs to serve the server command. Hooks are self-contained scripts in the plugin.

```typescript
import { startServer } from '../server.js'

async function main(): Promise<void> {
  const command = process.argv[2]

  if (command === 'server') {
    await startServer()
  } else {
    process.stderr.write('Usage: observability server\n')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

**Key change from v2:** No `hook` subcommand. Hooks are self-contained scripts in the plugin directory (OBS-3), not CLI subcommands in the package.

### package.json bin (simplified)

```json
{
  "bin": {
    "observability": "./src/cli/index.ts"
  },
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  }
}
```

**Removed:** The `./cli` export that OBS-3's wrapper used to import `dispatchHook`. No longer needed -- the hook is self-contained.

---

## 5. Server-Side Enrichment (owned by OBS-1)

The server's `POST /events/:eventName` handler now does all the work that dispatch.ts + emit.ts used to do. See OBS-1 section 2.4a for the full enrichment pipeline. Summary:

**What the server receives from the hook:**
```
POST /events/session-start
Content-Type: application/json
Body: <raw Claude Code stdin JSON>
```

**What the server does:**
1. Validates the JSON body (must be an object)
2. Maps URL path event name to EventType (`session-start` -> `hook.session_start`)
3. Extracts event-specific fields from the raw payload (model, tool_name, etc.)
4. Truncates large fields (tool_input, tool_result > 2000 chars)
5. Checks stop_hook_active guard (for Stop events)
6. Generates EventEnvelope (id, timestamp, correlationId, schemaVersion)
7. Stores in EventStore + broadcasts via WebSocket

**Why this is better than hook-side enrichment:**
- Server has full access to `@side-quest/core` (nanoId, generateCorrelationId, etc.)
- Enrichment logic is testable in one place with proper test infrastructure
- Adding a new event type = add a server handler, no hook changes needed
- Server can enrich retroactively (e.g., add model info to events that arrived before SessionStart)

---

## 6. captains-log Coexistence Strategy

Both `captains-log.ts` (enterprise) and the observability Stop hook fire on Stop events. This is intentional and not a conflict. They run in parallel.

| Concern | captains-log.ts | Observability Stop hook |
|---------|----------------|----------------------|
| **Purpose** | Retrospective session summary for `/enterprise:log` skill | Real-time event stream for dashboard |
| **Output** | JSONL file in project directory | POST to event server |
| **Consumer** | Enterprise log skill (reads JSONL) | Vue dashboard (reads via WS) |
| **Data** | Rich transcript parsing (tokens, tool summaries, officer actions) | Raw stdin (server enriches) |
| **Firing** | Enterprise plugin Stop hook | Observability plugin Stop hook |

**Rules:**
- Both coexist. Claude Code runs hooks in parallel across plugins.
- Observability Stop sends raw stdin -- server enriches it. No transcript parsing in the hook.
- No shared state between the two hooks. They are independent processes.

---

## 7. Async Hook Behavior (Research Findings)

OBS-3 sets `async: true` on PreToolUse, PostToolUse, and PostToolUseFailure. This section documents what we know about async hook behavior from research.

### What the docs say

- Timeout is enforced: "The `timeout` field sets the maximum time in seconds for the background process."
- No concurrency limit: "Each execution creates a separate background process. There is no deduplication."
- Output delivered on next turn: `systemMessage` and `additionalContext` are delivered on the next conversation turn.
- Cannot block: `decision`, `permissionDecision`, `continue` fields are ignored on async hooks.

### What production evidence suggests (issue #25700)

- 525 async hooks spawned in an 11-hour session
- **Zero process termination events** (SIGKILL/SIGTERM/reap) in debug logs
- "Completed" means output delivery was handled, NOT that the process was killed
- **Timeout enforcement may not work as documented**

### Our mitigation: self-destruct timer

The self-destruct timer in `emit-event.ts` (`setTimeout(() => process.exit(0), 4500)`) guarantees the process dies within 4.5s regardless of whether Claude Code enforces the timeout. This means:
- Stale port files cause at most 500ms of TCP timeout per hook (AbortController), then process exits at 4.5s
- No zombie processes accumulate
- Works whether Claude Code sends SIGTERM, SIGKILL, or nothing

### Per-session resource budget (worst case)

For a 200-tool-call session with `*` matchers:

| Hooks | Count | Async | Max lifetime |
|-------|-------|-------|-------------|
| SessionStart | 1 | no | 4.5s |
| PreToolUse | 200 | yes | 4.5s each |
| PostToolUse | 200 | yes | 4.5s each |
| PostToolUseFailure | ~10 | yes | 4.5s each |
| Stop | 1 | no | 4.5s |
| **Total** | **~412** | | |

With the dumb hook model, each hook does ~40ms of work (stdin read + port discovery + POST). The 4.5s self-destruct is a safety net, not normal operation.

---

## 8. Error Handling Strategy

**Two layers. That's it.** Same as v2 but even simpler since the hook does less.

```
Layer 0: Self-destruct timer
  setTimeout(() => process.exit(0), 4500)
  -- guarantees death regardless of hangs

Layer 1: main logic
  try { read stdin, parse JSON, POST to server }
  catch { exit 0 silently }
```

- No `process.exit(1)` anywhere in the hook
- Debug logging to stderr, gated on `SIDE_QUEST_HOOK_DEBUG=1`
- Silent by default -- hooks should be invisible to users
- If fetch fails, catch swallows it (fire-and-forget)
- Stdin > 1MB is rejected before JSON.parse (OOM protection)

---

## 9. Dependencies

**Hook (`emit-event.ts` in OBS-3):** Zero dependencies. Uses only Bun globals (`Bun.stdin`, `fetch`) and Node.js built-ins (`node:fs`, `node:path`, `node:os`). Fully self-contained, marketplace-compatible.

**Server CLI (`index.ts`):** Imports from the server package (`../server.js`). Uses `@side-quest/core` for enrichment utilities (nanoId, generateCorrelationId, etc.).

---

## 10. Test Strategy

### Hook testing (owned by OBS-3)

The hook is ~40 lines of stdin-read + port-discover + POST. Tests live alongside `emit-event.ts` in the plugin:

```typescript
describe('emit-event hook', () => {
  it('POSTs raw stdin to server with event name in URL path', () => { /* ... */ })
  it('exits 0 when port file missing', () => { /* ... */ })
  it('exits 0 when fetch times out', () => { /* ... */ })
  it('exits 0 when SIDE_QUEST_EVENTS=0', () => { /* ... */ })
  it('exits 0 when stdin > 1MB', () => { /* ... */ })
  it('exits 0 when stdin is not valid JSON', () => { /* ... */ })
})
```

### Server enrichment testing (owned by OBS-1)

The server's event enrichment pipeline has comprehensive tests:

```typescript
describe('POST /events/:eventName', () => {
  it('maps session-start to hook.session_start EventType', () => { /* ... */ })
  it('extracts model and source from session-start payload', () => { /* ... */ })
  it('truncates tool_input to 2000 chars for pre-tool-use', () => { /* ... */ })
  it('truncates tool_result to 2000 chars for post-tool-use', () => { /* ... */ })
  it('skips stop event when stop_hook_active is true', () => { /* ... */ })
  it('generates valid EventEnvelope with id, timestamp, correlationId', () => { /* ... */ })
  it('returns 400 for non-object body', () => { /* ... */ })
  it('accepts unknown event names (forward-compatible)', () => { /* ... */ })
})
```

---

## 11. Plugin Scaffold

**Note:** The plugin scaffold is **owned by OBS-3**. OBS-2 no longer provides a `dispatchHook` function for OBS-3 to import. Instead, OBS-3's `emit-event.ts` is fully self-contained.

See OBS-3 for:
- `plugins/observability/plugin.json`
- `plugins/observability/hooks/hooks.json` (5 hook registrations)
- `plugins/observability/hooks/emit-event.ts` (~40 lines, zero dependencies)

---

## 12. Implementation Sequence

1. **OBS-1 server enrichment** -- POST /events/:eventName handler with event-specific extraction (prerequisite)
2. **`cli/index.ts`** -- Server-only CLI entry point
3. **OBS-3 `emit-event.ts`** -- Self-contained hook script (no OBS-2 imports needed)

OBS-2 is now the thinnest domain. Most of the original OBS-2 work moved to OBS-1 (server enrichment) and OBS-3 (self-contained hook).

---

## 13. Verification

### Server enrichment (OBS-1 scope)

```bash
# Start the observability server
cd ~/code/side-quest-observability && bun run packages/server/src/server.ts

# Post raw SessionStart stdin to the event-name URL
curl -X POST http://127.0.0.1:7483/events/session-start \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"test-123","transcript_path":"/tmp/t.jsonl","cwd":"/home/user/project","permission_mode":"default","hook_event_name":"SessionStart","source":"vscode","model":"claude-opus-4-6"}'

# Verify server enriched it into a proper EventEnvelope
curl http://127.0.0.1:7483/events | jq '.[0]'
# Should have: schemaVersion, id, timestamp, type: "hook.session_start", correlationId, etc.

# Post Stop with recursion guard
curl -X POST http://127.0.0.1:7483/events/stop \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"test-123","transcript_path":"/tmp/t.jsonl","cwd":"/home/user/project","permission_mode":"default","hook_event_name":"Stop","stop_hook_active":true}'
# Server should reject (stop_hook_active=true)
```

### End-to-end with hook script (OBS-3 scope)

```bash
# Pipe mock stdin to emit-event.ts
echo '{"session_id":"test-123","transcript_path":"/tmp/t.jsonl","cwd":"/home/user/project","permission_mode":"default","hook_event_name":"SessionStart","source":"vscode","model":"claude-opus-4-6"}' | \
  bun run plugins/observability/hooks/emit-event.ts session-start

# Verify event arrived at server
curl http://127.0.0.1:7483/events
```

### End-to-end with Claude Code

1. Enable observability plugin
2. Start observability server
3. Open Claude Code, make a tool call
4. Verify SessionStart + PreToolUse + PostToolUse events in server (properly enriched)
5. Exit Claude Code, verify Stop event
6. Verify enterprise captains-log JSONL also written (coexistence)

---

## 14. Critical Files

| File | Role |
|------|------|
| `plugins/git/hooks/event-bus-client.ts` | Production emitter pattern (fire-and-forget, AbortController) |
| `plugins/enterprise/hooks/captains-log.ts` | Proven stdin pattern (`readFileSync('/dev/stdin')`) |
| `side-quest-observability/packages/server/src/server.ts` | Enrichment pipeline (OBS-1 -- all event processing lives here) |

---

## 15. Known Limitations (v1)

| Limitation | Impact | Mitigation |
|------------|--------|-----------|
| No cross-invocation negative cache | Server-down sessions waste ~16-33s on 412 failed port file checks | Accept for v1. v2: sentinel file with 60s TTL. |
| Stale port file after server crash | Hook POSTs to dead port, gets ECONNREFUSED (immediate, not a hang) | Benign in practice. v2: server writes nonce to port file, hook validates. |
| No per-hook timing telemetry | No visibility into hook execution time | v2: `SIDE_QUEST_HOOK_DEBUG=1` emits `stdin_ms`, `port_ms`, `fetch_ms`, `total_ms` |
| `appRoot` is raw `cwd`, not canonicalized | Dashboard sees different paths for same project if invoked from subdirectory | Dashboard normalizes by detecting common prefixes or using session_id grouping |
| Raw stdin forwarded to server | Server must handle arbitrary Claude Code stdin payloads | Server validates + extracts only known fields, ignores unknown |
