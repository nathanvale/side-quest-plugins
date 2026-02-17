# OBS-5 Server Lifecycle/DevOps -- Staff Engineer Review, Pass 3 (Operator)

**Reviewer persona:** Operator -- failure modes, recovery behavior, "what breaks at 3am?"
**Plan reviewed:** `/Users/nathanvale/.claude/plans/obs-5-server-devops.md`
**Cross-references:** OBS-1 pass-3 review (Operator), OBS-2 pass-3 review (Operator)
**Date:** 2026-02-17

---

## 1. Verdict

**REQUEST CHANGES**

The happy path is well-constructed. Launchd configuration choices are sound, the HITL architecture is inventive, and the static serving fallback is sensible. But there are five specific failure modes that will produce silent data loss or hung hook processes in production. Three of them (C1, C2, C5) will trigger at normal operating volume with no human intervention required. None of them require adversarial conditions.

---

## 2. Strengths

- **`KeepAlive.SuccessfulExit = false` is the right semantic.** `just stop` sends SIGTERM, server exits 0, launchd stays quiet. Crash exits non-zero, launchd restarts. This is exactly the correct distinction. The OBS-1 plan confirmed signal handlers will clean up PID files, so restart produces a consistent initial state.
- **Port-0 ephemeral allocation for HITL.** Using `port: 0` delegates port selection to the OS, which is the correct pattern. No hardcoded port = no collision with system services or other developer tools.
- **HITL response matched by event `id`, not by type.** The Disler reference implementation matched by `permission_type`, which can collide when two permission requests of the same type are in-flight. Matching on `id` is collision-resistant by construction.
- **Symlinked plist enables `git pull` -> `just restart` deploy cycle.** Keeping the plist in version control and symlinking into `~/Library/LaunchAgents/` is operationally elegant. The definition updates without a manual re-copy step.

---

## 3. Critical Issues (must fix)

### C1 -- No readiness check between launchd restart and hook emission

**The problem:** `ThrottleInterval = 5`. If the server crashes (non-zero exit), launchd waits 5 seconds and restarts. During that window, and during the server's startup time itself (Bun JIT cold-start, file handle setup, plist load), hooks continue to fire. The emitter in OBS-2 has a 500ms HTTP timeout. It will silently drop every event in the restart window. No error, no retry, no queue.

At `PreToolUse` + `PostToolUse` granularity, a Claude Code session making tool calls at 2 requests/second generates ~4 events/second. A 5-second restart cycle loses 20 events minimum, plus any emitted during the Bun startup window itself (estimate 1-3 seconds for a cold start with file handle setup). Real event loss: 25-35 events per crash.

**This is not theoretical.** Bun.serve can fail on startup if:
- The port file from the previous run still exists and the OS hasn't released the socket
- The JSONL directory doesn't exist yet (before `mkdir -p` runs in the plist's working directory)
- A previous unclean shutdown left a corrupted PID file that a concurrent startup reads and misinterprets

**What's missing:** A readiness signal or a readiness probe in the hook emitter. The hook emitter (OBS-2 `emitter.ts`) should verify the server is healthy via `/health` before sending. If the health check fails, it should return early (silent drop is acceptable) rather than timing out for 500ms per event. The launchd plist could also include a `StandardInput`-based startup notification, but that's complex. The pragmatic fix is in the emitter: probe `/health` first, cache the result for the process lifetime (one `bunx` invocation = one probe), emit only if healthy.

**Fix:** Add a health probe to the emitter. Cache result per-process. On probe failure, skip emit and return -- do not wait for timeout.

---

### C2 -- `just db-reset` races the running server

**The problem:**

```just
db-reset:
    @rm -f ~/.cache/side-quest-observability/*/events.jsonl
```

If the observability server is running when `just db-reset` executes, this creates a race against the server's `push()` method, which calls `appendToFileSync` synchronously in the event loop.

On macOS (HFS+/APFS), `rm` unlinks the file from the directory entry but the file descriptor held by the server remains valid. The server continues appending to the unlinked inode. After `rm`, a new file is never created at the old path -- the server's path reference points to the deleted (unlinked) inode. Any new `appendToFileSync` call that creates the file from scratch will succeed, but the `rotateIfNeeded()` check uses `Bun.file(this.persistPath).size`, which, after an unlink, will see `size = 0` for the new file while the old inode is still being written to by a separate reference.

**Net result:** Events written after `rm` go to two places -- the unlinked inode (visible to no one) and eventually to a new file (if the server re-creates it). The server has no awareness the file was deleted. The old inode is not freed until the server releases its file descriptor (next restart). The new file created by the next `appendToFileSync` will appear correct but will be missing all events between the `rm` and the file descriptor release.

**Fix:** Either: (a) require `just stop` before `just db-reset` (enforce this by checking if the PID file exists and refusing to reset if so), or (b) add a `DELETE /events` HTTP endpoint that lets the server truncate its own JSONL in a controlled way. Option (a) is one line of shell. Option (b) is the correct long-term design.

```just
db-reset:
    @if [ -f ~/.cache/side-quest-observability/*/events.pid ]; then \
      echo "Error: server is running. Run 'just stop' first."; exit 1; fi
    @rm -f ~/.cache/side-quest-observability/*/events.jsonl
    @echo "Event persistence files cleared"
```

---

### C3 -- HITL ephemeral WS server has no timeout on the server side

**The problem:** `startHitlServer()` creates a `Bun.serve()` instance with no idle timeout, no connection timeout, and no server-level timeout. The promise that waits for a response from the hook has a timeout (300s default), but the `finally { server.stop(true) }` call in `requestHumanInput` only runs when `withTimeout` resolves or rejects.

If `withTimeout` never rejects -- because `withTimeout` itself has a bug, or because the timer callback silently throws, or because the promise stalls for reasons unrelated to the timeout -- the ephemeral WS server keeps running indefinitely. Each HITL request that stalls leaks a port and a server instance.

Bun does not have a built-in server-level connection timeout separate from WebSocket `idleTimeout`. A WebSocket connection that is established but never sends a message will not trigger `idleTimeout` (that fires on inactivity after a message, not on connection-level silence).

More concretely: if the dashboard user closes the browser tab without responding, the dashboard does not POST to `/events/:id/respond`. The hook waits 300s. The ephemeral WS server is bound for 300s. At 10 simultaneous Claude Code sessions, that's up to 10 ephemeral servers, each consuming a random port for 5 minutes.

**Fix:** Add an explicit server-level timeout in `startHitlServer()` -- close the WS server after `timeout + buffer` regardless. Also add `idleTimeout` on the WS server to catch connections that never speak:

```typescript
const server = Bun.serve({
  port: 0,
  hostname: '127.0.0.1',
  websocket: {
    idleTimeout: Math.min((hitlRequest.timeout ?? 300) + 10, 310), // seconds
    // ...
  }
})
// Server-level deadline: shut down if the promise doesn't resolve
const deadline = setTimeout(() => server.stop(true), ((hitlRequest.timeout ?? 300) + 15) * 1000)
try {
  return await withTimeout(responsePromise, timeout)
} finally {
  clearTimeout(deadline)
  server.stop(true)
}
```

---

### C4 -- `test-event` payload schema mismatch with OBS-1 PR1

**The problem:** The `just test-event` recipe sends:

```json
{
  "sessionCid": "test-session-001",
  "cid": "test-cid-001"
}
```

OBS-1 PR1's ingress validation checks for `schemaVersion`, `type`, and `data`. The `correlationId` field (singular) is what PR1's `EventEnvelope` carries, not `sessionCid`/`cid`. Those three-tier correlation fields are deferred to OBS-1 PR2.

The OBS-1 ingress validator:
```typescript
if (obj.schemaVersion !== '1.0.0') return { valid: false, error: 'Unknown schemaVersion' }
if (typeof obj.type !== 'string') return { valid: false, error: 'Missing or invalid type' }
if (!('data' in obj)) return { valid: false, error: 'Missing data field' }
```

The `test-event` payload does have `schemaVersion`, `type`, and `data`. So it will pass ingress validation. But it also has `sessionCid`/`cid` which the server will store in the envelope and broadcast to the dashboard. If the dashboard's TypeScript types are built against OBS-1 PR1's `EventEnvelope` (which has `correlationId`, not `sessionCid`/`cid`), the dashboard will receive events with fields it doesn't declare on its type, producing runtime type drift.

This is a lesser severity than the original question framed -- the server won't reject the payload -- but it creates subtle consumer drift: the `test-event` recipe is testing a schema that doesn't exist yet (PR2 schema) against a server running PR1 types. Any developer using `just test-event` to validate the pipeline is testing against the wrong schema.

**Fix:** Align `test-event` with OBS-1 PR1's exact envelope:

```just
test-event:
    @curl -s -X POST http://127.0.0.1:{{server_port}}/events \
      -H "Content-Type: application/json" \
      -d '{ \
        "schemaVersion": "1.0.0", \
        "id": "test-'$(date +%s)'", \
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'", \
        "type": "hook.notification", \
        "app": "test", \
        "appRoot": "/tmp", \
        "source": "hook", \
        "correlationId": "test-correlation-001", \
        "data": {"message": "Test event from justfile"} \
      }' | head -c 200
    @echo ""
```

---

### C5 -- Log files grow unbounded under launchd

**The problem:** launchd's `StandardOutPath`/`StandardErrorPath` directives append indefinitely. Unlike syslog or `os_log`, these are plain file redirects. macOS does not rotate them. `newsyslog` does not rotate them by default (it only manages entries in `/etc/newsyslog.conf.d/` or added explicitly).

The server emits at least one log line per event received. At `PreToolUse`/`PostToolUse` granularity with a busy Claude Code session (10 tool calls/minute), stdout.log grows at roughly 50-100 lines/minute = ~5KB/minute = ~7MB/day = ~210MB/month. stderr.log grows more slowly but is unbounded too.

This is the same unbounded growth problem the Operator review identified in OBS-1 for JSONL persistence, and the plan solved it there with rotation. No equivalent solution is present here for the launchd logs.

**Fix options (pick one):**
1. Add a `newsyslog` config file at `/etc/newsyslog.conf.d/com.sidequest.observability.conf` (requires sudo, not ideal)
2. Add a `just rotate-logs` recipe using `mv` + touch, then send SIGHUP to launchd
3. Remove `StandardOutPath`/`StandardErrorPath` from the plist entirely and redirect inside the startup script to a log file managed by your own rotation logic
4. Switch to `os_log` via a thin wrapper (then Console.app rotation applies automatically)

Option 3 is the pragmatic near-term fix. The plist's stdout/stderr redirect is convenient for development but not production-safe for a server that runs continuously.

---

## 4. Important Observations (should fix)

### I1 -- `launchctl load` fails silently; `just start` masks it

The `just start` recipe:

```just
@launchctl load {{plist_dst}} 2>/dev/null || true
@echo "Server starting on port {{server_port}}"
@sleep 1
@just health
```

`2>/dev/null || true` suppresses all `launchctl` errors. If the plist has an XML syntax error, if the log directory doesn't exist (despite `mkdir -p` running one line earlier -- race with permissions), or if another agent with the same label is already loaded, `launchctl load` returns non-zero. The recipe reports "Server starting on port 7483" and then `just health` reports "Server: DOWN". The developer sees a confusing DOWN with no error.

**Fix:** Remove `|| true` from the `launchctl load` call and capture the exit code:

```just
start:
    @mkdir -p {{log_dir}}
    @ln -sf {{plist_src}} {{plist_dst}}
    @if ! launchctl load {{plist_dst}} 2>&1; then \
      echo "launchctl load failed -- check plist syntax and label conflicts"; exit 1; fi
    @echo "Server starting on port {{server_port}}"
    @sleep 1
    @just health
```

### I2 -- `just stop` when server isn't running produces misleading output

```just
stop:
    @launchctl unload {{plist_dst}} 2>/dev/null || true
    @echo "Server stopped"
```

If the server is not running or the plist is not loaded, `launchctl unload` exits non-zero. The `|| true` swallows it and "Server stopped" is printed. This is a lie. Running `just stop` on an already-stopped server looks identical to actually stopping it, which makes it impossible to write a reliable `just restart` that knows whether the stop actually happened.

**Fix:** Check the label state before unloading:

```just
stop:
    @launchctl list {{plist_name}} > /dev/null 2>&1 \
      && launchctl unload {{plist_dst}} 2>/dev/null \
      && echo "Server stopped" \
      || echo "Server was not running"
```

### I3 -- Ephemeral HITL WS port blocked by macOS network filter has no fallback

The plan notes that `port: 0` lets the OS assign the port. On macOS, the OS may assign a port in a range that is filtered by Little Snitch, macOS ALF, or a corporate network policy applied via MDM. When the observability server tries to open a WebSocket connection to `ws://127.0.0.1:{OS_assigned_port}`, the connection is refused by the filter. The error surfaces in `sendResponseToHook` as a connect failure, which the plan does not handle explicitly.

The HITL response never arrives. The hook process waits 300 seconds. Claude Code blocks for 300 seconds on a permission request that will never be answered.

**Fix:** Wrap `sendResponseToHook` in a try/catch with a timeout. On failure, update the event's `hitlStatus` to `{ status: 'error', reason: 'response_delivery_failed' }` and broadcast the update to the dashboard so the developer knows the response was not delivered. Do not silently time out.

### I4 -- Two simultaneous HITL requests use the same `pendingFutures` map but different servers

The `pendingFutures` map is module-level. If two hook processes call `requestHumanInput` concurrently -- which cannot happen in the current `bunx` model (each `bunx` invocation is a separate process with its own module state) -- there is no collision. But if `hitl-server.ts` is ever imported into a long-lived server process (e.g., the observability server itself handles HITL natively), two simultaneous HITL requests would share the same `pendingFutures` map and the same ephemeral server instance. The second request's response would need to route to the correct future via `eventId`.

The current code does handle this correctly -- `pendingFutures.get(eventId)` uses the event ID as key. But there is one subtle issue: each call to `startHitlServer()` creates a new `Bun.serve()` instance. If the observability server restarts between the HITL POST and the dashboard response, the response goes to a `responseWebSocketUrl` pointing to a now-dead ephemeral server. The hook times out. The dashboard shows "responded" but the hook never got the message.

**Fix:** The server-side `handleHitlRespond` should verify whether the `responseWebSocketUrl` is still reachable before updating the event status to `responded`. On failure, set status to `error` with a reason.

### I5 -- Git migration (5g) cache path change breaks active sessions

When `just restart` is run mid-migration (OBS-1 exports active, `@side-quest/git` not yet updated), the port file path changes from `~/.cache/side-quest-git/{key}/events.port` to `~/.cache/side-quest-observability/{key}/events.port`. Any Claude Code session that loaded its port from the old path will continue emitting to `side-quest-git/` path -- which the new server does not write. The session goes dark from the server's perspective.

OBS-1 includes dual-path discovery on the emitter side (`discoverEventServer` checks both paths). But OBS-5's 5g migration plan tells developers to `just restart` and immediately delete `src/events/`. There is no instruction to run both servers in parallel during the transition, or to verify all active sessions have migrated before cutting over.

**Fix:** Add an explicit migration step to the 5g checklist: before deleting `src/events/`, verify that no active port files exist in the old path. A `just check-migration` recipe could do this:

```just
check-migration:
    @echo "Legacy port files (should be empty before cutting over):"
    @ls ~/.cache/side-quest-git/*/events.port 2>/dev/null || echo "  (none -- safe to proceed)"
```

---

## 5. Nice-to-Haves

### N1 -- `just health` should distinguish "server not started yet" from "server started but unhealthy"

Currently `just health` returns "Server: DOWN" for both. Adding a check for whether the launchd label is loaded would clarify:

```just
health:
    @launchctl list {{plist_name}} > /dev/null 2>&1 \
      || echo "Agent: NOT LOADED (run 'just start')"
    @curl -sf http://127.0.0.1:{{server_port}}/health 2>/dev/null \
      && echo "Server: UP (port {{server_port}})" \
      || echo "Server: LOADED but not responding (port {{server_port}})"
```

### N2 -- Hardcoded Bun path in plist will break on Bun upgrades

`/Users/nathanvale/.bun/bin/bun` is the current Bun binary path. When `bun upgrade` runs, it replaces this binary in-place. If a major version upgrade changes the binary location or installation layout, the plist path breaks. The PATH entry in `EnvironmentVariables` (`/Users/nathanvale/.bun/bin:...`) is the right fix -- use `bun` by name and rely on PATH resolution, not absolute path. But `launchd`'s `ProgramArguments[0]` must be an absolute path per the launchd plist spec. Consider resolving the actual path at `just install` time:

```just
install:
    @BUN_PATH=$(which bun) && sed -i '' "s|/Users/nathanvale/.bun/bin/bun|$BUN_PATH|g" {{plist_src}}
    @just start
```

### N3 -- HITL dashboard countdown timer has no server-sync

The plan mentions a "countdown timer on pending HITL events." If the timer is purely client-side (started when the event arrives over WS), it will drift from the server's actual timeout, especially if the dashboard is opened mid-session or after a WS reconnect. The server should include the HITL event's `timestamp` and `hitl.timeout` in the event envelope, so the dashboard can compute the accurate time-remaining from `Date.now() - event.timestamp`.

### N4 -- `just dev` does not set up the log directory

`just dev` runs `bun run dev` directly (not via launchd). stdout/stderr go to the terminal. But `just logs` and `just logs-err` tail `~/Library/Logs/side-quest-observability/stdout.log` -- which is only populated when running under launchd. A developer running `just dev` then trying `just logs` gets nothing. This is confusing. Document this distinction explicitly in the justfile comments or route dev output to the same log files.

---

## 6. Questions for the Author

1. **Event loss budget for crash-restart cycle:** Is losing ~25-35 events during a 5-7 second launchd restart cycle acceptable? If so, document it explicitly (best-effort delivery contract). If not, the hook emitter needs a health probe. This answer determines the severity of C1.

2. **`db-reset` intended usage:** Is `just db-reset` meant to be used while the server is running (hot wipe) or only while stopped? If hot wipe is intentional, the server needs a `DELETE /events` endpoint that the justfile calls instead of `rm -f`.

3. **HITL timeout policy for unanswered requests:** If the dashboard user closes the browser, does the hook process block for the full 300 seconds and then time out (graceful degradation), or should there be a shorter server-side cancel that signals the hook immediately?

4. **5g migration window:** Is there an expectation of zero-downtime during the `side-quest-git` -> `side-quest-observability` cache path migration, or is a momentary event loss during cutover acceptable?

5. **Log retention SLA:** How long do you need `stdout.log`/`stderr.log` to retain data? This determines whether simple `logrotate`/`newsyslog` config suffices or whether the server needs to manage its own log lifecycle.

---

## 7. Synthesis

The OBS-5 plan inherits a strong operational foundation from OBS-1 (signal handlers, nonce identity, ingress validation, JSONL rotation) and OBS-2 (fire-and-forget emitter, 500ms timeout, recursion guard). The launchd configuration is correct for the stated intent. The HITL architecture is the most sophisticated part of the system and, unusually for an HITL design, it actually handles the common failure modes (response matched by ID, timeout with cleanup, ephemeral port delegation to OS). The gap is not in the design intent -- it is in the operational seams: the window between crash and restart where events are lost without notice (C1), the race between `db-reset` and live file handles (C2), HITL WS server resource leaks on timeout (C3), the test-event payload that validates a not-yet-implemented schema (C4), and unbounded log growth under launchd (C5). Three of these (C1, C2, C5) will materialize at normal operating volume without adversarial conditions. Combined with the prior Architect and Skeptic passes on OBS-1 and OBS-2 -- which resolved scope discipline and schema alignment -- the remaining work to de-risk this plan is concentrated and addressable in a single implementation pass. C1 and C5 require the most forethought (readiness probe strategy and log lifecycle strategy respectively); C2, C3, and C4 are mechanical fixes. Resolve those five before implementation and this plan is ready.
