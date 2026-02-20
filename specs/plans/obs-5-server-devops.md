# Domain 5: Server Lifecycle and DevOps -- Implementation Plan

## Status: Completed (v1)

**Parent plan:** `specs/plans/observability-master-plan.md` (Stage 5)
**Prerequisites:** Domains 1 (Event Server) and 4 (Vue Dashboard) must be substantially complete.

## Review-Driven Changes

This plan incorporates findings from a 3-pass staff engineer review (Architect, Skeptic, Operator). All three passes returned REQUEST CHANGES. Reviews are at `specs/reviews/obs-5-server-devops-review-pass-{1,2,3}.md`.

### Accepted -- Scope Cuts (Skeptic)

The original plan had 7 sub-stages. The ratio of infrastructure to v1 need was the same pattern found in OBS-4 (16 files for 5 event types). This revision ships a minimal v1 with 2 pieces: static file serving + a justfile.

| Cut item | Days saved | Reason | Deferred to |
|----------|-----------|--------|-------------|
| HITL (5d) | 3+ | Full bidirectional WS architecture with ephemeral servers, futures maps, 300s timeouts. Depends on `hook.permission_request` (OBS-2 v2). Nothing to trigger it in v1. Same logic that killed EngagePipeline in OBS-4. | v2 |
| LCARS CSS (5e) | 1 | Superseded by OBS-4's two-tier Entain-style design token system. Two competing CSS systems, two different oranges (`#ff9933` vs `#f97316`). Dead code. | Deleted (replaced by OBS-4 globals.css) |
| Git migration (5g) | 1 | Belongs in OBS-1 PR3, not OBS-5. Creates circular dependency (OBS-5 can't complete until migration done, migration can't happen until OBS-5 publishes). OBS-1's dual-path emitter already covers the migration window. | OBS-1 PR3 |
| Launchd auto-start (5a) | 0.5 | `just dev` (foreground server) is sufficient until the system proves its value over at least a week of real use. Launchd adds operational complexity (log rotation, readiness checks, crash-restart gaps) that isn't justified on day 1. | v1.1 |

### Accepted -- Contract Fixes (Architect)

| Fix | Reason |
|-----|--------|
| Remove CORS section from 5c | OBS-1 already owns CORS headers (section 2.4, `GET, POST, OPTIONS`). OBS-5 duplicated with divergent `Allow-Methods` including `PUT, DELETE` (no such endpoints exist). |
| Fix `test-event` schema | Used `sessionCid`/`cid` (PR2 schema) and `source: "just-test-event"` (invalid). OBS-1 PR1 uses `correlationId` and constrains source to `'cli' \| 'hook'`. |
| Remove misleading migration note | "Server should accept both old `correlationId` and new `sessionCid/cid/parentCid`" was backwards -- `correlationId` IS the current PR1 schema. |

### Accepted -- Operational Fixes (Operator)

| Fix | Reason |
|-----|--------|
| `db-reset` checks server status | `rm -f events.jsonl` while server holds fd open causes silent data loss on APFS. Guard with PID file check. |
| Remove launchd log concerns | Deferred with 5a. When 5a ships (v1.1), include `newsyslog` config for log rotation. |

### Deferred to v1.1 / v2

| Feature | Deferred to | Blocker/Reason |
|---------|-------------|----------------|
| Launchd auto-start (5a) | v1.1 | Prove value with `just dev` first. Add readiness checks, log rotation when shipping. |
| HITL support (5d) | v2 | Needs `hook.permission_request` (OBS-2 v2) |
| Git migration (5g) | OBS-1 PR3 | Belongs with the event server, not DevOps |

---

## v1 Scope: Static Serving + Justfile

After cuts, OBS-5 v1 is two things:
1. **5c:** Add static file serving to `Bun.serve()` (one code change to OBS-1's server.ts)
2. **Justfile:** 9 developer-friendly recipes for foreground operation

**Estimated effort:** Half a day, one commit.

---

## Stage 5c: Server Serves Built Client

### Implementation

Add static file serving as a fallback in the existing `Bun.serve()` fetch handler (OBS-1's `packages/server/src/server.ts`). This goes AFTER all API routes:

```typescript
import { join, dirname } from 'node:path'

// Resolve client dist relative to server source
const clientDistDir = join(dirname(import.meta.dir), 'client/dist')

// In the fetch handler, after all API routes (/health, /events, /ws):

// Static file serving for dashboard
const filePath = url.pathname === '/'
  ? join(clientDistDir, 'index.html')
  : join(clientDistDir, url.pathname)

const file = Bun.file(filePath)
if (await file.exists()) {
  return new Response(file)
}

// SPA fallback -- serve index.html for client-side routes
const indexFile = Bun.file(join(clientDistDir, 'index.html'))
if (await indexFile.exists()) {
  return new Response(indexFile)
}

return new Response('Not Found', { status: 404 })
```

### What's NOT here

- **No CORS section.** OBS-1 already owns CORS headers (`Access-Control-Allow-Origin: *`, `GET, POST, OPTIONS`). Adding them here was duplication with a divergent `Allow-Methods` (Architect C2).
- **No Content-Type inference.** Bun's `new Response(Bun.file(...))` automatically sets Content-Type based on file extension. No manual MIME map needed.

### Guard: Missing dist/ directory

If `packages/client/dist/` doesn't exist (client not built), the static file serving silently falls through to the 404 handler. The API routes (`/health`, `/events`, `/ws`) continue working. The dashboard just returns "Not Found" until `just build-client` is run.

### Verification

```bash
cd ~/code/side-quest-observability
just build-client      # Build Vue dashboard
just dev               # Start server in foreground
open http://127.0.0.1:7483       # Dashboard loads
curl http://127.0.0.1:7483/health  # API still works
```

---

## Justfile

**Location:** `~/code/side-quest-observability/justfile`

v1 justfile has 9 recipes for foreground operation. No launchd integration (deferred to v1.1).

```just
# Side Quest Observability System
set dotenv-load
set quiet

server_port := env("OBSERVABILITY_PORT", "7483")
project_root := justfile_directory()

default:
    @just --list

# -- Development -----------------------------------------------

# Start server in foreground (Ctrl+C to stop)
dev:
    @echo "Starting server on port {{server_port}}..."
    @cd {{project_root}} && OBSERVABILITY_PORT={{server_port}} bun run --watch packages/server/src/cli/index.ts server --port {{server_port}}

# Build Vue dashboard to dist/
build-client:
    @cd {{project_root}}/packages/client && bun run build
    @echo "Client built to packages/client/dist/"

# Build server + client
build: build-client
    @cd {{project_root}}/packages/server && bun run build
    @echo "Full build complete"

# -- Quality ---------------------------------------------------

test:
    @cd {{project_root}} && bun test

typecheck:
    @cd {{project_root}} && bun run typecheck

validate:
    @cd {{project_root}} && bun run validate

# -- Diagnostics -----------------------------------------------

# Check if server is running
health:
    @curl -sf http://127.0.0.1:{{server_port}}/health 2>/dev/null \
      && echo "Server: UP (port {{server_port}})" \
      || echo "Server: DOWN (port {{server_port}})"

# Send a test event through the full pipeline
test-event:
    @curl -s -X POST http://127.0.0.1:{{server_port}}/events \
      -H "Content-Type: application/json" \
      -d '{ \
        "schemaVersion": "1.0.0", \
        "id": "test-'$(date +%s)'", \
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", \
        "type": "hook.session_start", \
        "app": "test", \
        "appRoot": "/tmp", \
        "source": "hook", \
        "correlationId": "test-session-001", \
        "data": {"hookEvent": "session_start", "sessionId": "test-001", "model": "claude-opus-4-6", "source": "cli"} \
      }' | head -c 200
    @echo ""

# Clear persisted events (server must be stopped first)
db-reset:
    @if [ -f ~/.cache/side-quest-observability/events.pid ]; then \
      echo "Error: Server appears to be running. Stop it first (Ctrl+C on just dev)." && exit 1; \
    fi
    @rm -f ~/.cache/side-quest-observability/events.jsonl
    @rm -f ~/.cache/side-quest-observability/events.jsonl.*
    @echo "Event persistence files cleared (including rotated files)"
```

### Design Decisions

- **`set dotenv-load`**: `.env` can override `OBSERVABILITY_PORT`
- **`bun run --watch`**: Auto-restarts server on file changes during development
- **`test-event` uses `hook.session_start`**: A v1 event type that exercises the actual enrichment pipeline. Uses `correlationId` (OBS-1 PR1 schema) and `source: "hook"` (valid per `'cli' | 'hook'` constraint). Data fields match the server's `enrichHookPayload('session-start', ...)` output shape (Architect C1 fix).
- **`db-reset` guards against running server**: Checks for PID file at global cache path before deleting JSONL files (Operator C2 fix). Uses flat paths (no glob) -- global server model writes directly to `~/.cache/side-quest-observability/`, not subdirectories. Also cleans rotated files (`.jsonl.1`, `.jsonl.2`).
- **No `start`/`stop`/`restart`/`install`/`uninstall`**: These are launchd operations, deferred to v1.1.
- **No `logs`/`logs-err`**: No log files in foreground mode -- output goes to terminal.

### Recipes removed from original plan

| Recipe | Reason |
|--------|--------|
| `start` / `stop` / `restart` | Launchd operations (deferred to v1.1) |
| `install` / `uninstall` | Launchd operations (deferred to v1.1) |
| `logs` / `logs-err` | No log files in foreground mode |

---

## v1.1: Launchd Auto-start (deferred)

When the system proves its value over at least a week of `just dev` usage, add:

1. **Launchd plist** with:
   - `KeepAlive.SuccessfulExit = false` (restart on crash only)
   - `ThrottleInterval = 10` (not 5 -- give readiness check time)
   - **Readiness probe in emitter** (Operator C1): health check cached per-process before posting events, skip emit on probe failure
   - **`newsyslog` config** for log rotation (Operator C5): prevent unbounded growth of stdout.log/stderr.log

2. **Justfile launchd recipes**: `start`, `stop`, `restart`, `install`, `uninstall`, `logs`

3. **`start` with polling health check** (not `sleep 1`): 10 retries at 500ms intervals, fail with clear error if server doesn't come up

---

## v2: HITL Support (deferred)

The full Human-in-the-Loop architecture is preserved in the original plan for reference but deferred until:
- OBS-2 v2 ships `hook.permission_request` events
- The dashboard is stable and proven in daily use
- The ephemeral WS server failure modes are addressed (Operator C3: idle timeout, port leaks, connection loss handling)

Key design from original plan (for future reference):
- Hook creates ephemeral `Bun.serve()` WS on port 0
- POST to `/events` with `hitl: { question, responseWsUrl, type }`
- Dashboard renders approve/deny UI
- Server forwards response to hook's ephemeral WS
- Hook resolves pending Promise, returns to Claude Code
- 300s timeout with `withTimeout()` from `@side-quest/core/concurrency`

---

## Testing Strategy

| What | Test | Verification |
|------|------|-------------|
| Static serving | Manual + curl | `curl /` returns HTML, `curl /health` returns JSON, `curl /nonexistent` returns 404 |
| Missing dist/ | Manual | API routes work, dashboard returns 404 |
| Justfile recipes | Manual | `just dev`, `just health`, `just test-event`, `just build-client`, `just db-reset` all work |
| `test-event` schema | Automated | Event appears in dashboard, server doesn't reject it |
| `db-reset` guard | Manual | Fails with error when server is running |

---

## Critical Files

| File | Role |
|------|------|
| `packages/server/src/server.ts` (OBS-1) | Add static file serving fallback after API routes |
| `packages/client/dist/` | Built Vue dashboard (output of `just build-client`) |
| `specs/plans/obs-1-event-server.md` | CORS headers, health endpoint, signal handlers already defined here |
| `specs/plans/obs-4-vue-dashboard.md` | Design token system (globals.css) -- no LCARS CSS needed |
