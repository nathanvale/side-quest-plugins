# OBS-5 Server Lifecycle/DevOps -- Architect Review Pass 1

**Reviewer:** Architect (system boundaries, data flow, dependency ordering, contract alignment)
**Plan reviewed:** `/Users/nathanvale/.claude/plans/obs-5-server-devops.md`
**Cross-referenced:**
- `/Users/nathanvale/.claude/plans/obs-1-event-server.md` (the server OBS-5 wraps)
- `/Users/nathanvale/.claude/plans/obs-4-vue-dashboard.md` (the client OBS-5 serves statically)
- `/Users/nathanvale/.claude/plans/obs-2-hook-cli.md` (HITL integration point)

---

## Verdict

**REQUEST CHANGES**

The plan has a coherent operational core (5a/5b launchd + justfile are solid) and the HITL architecture is functionally sound. However, there are three issues that must be resolved before implementation: a schema contradiction with OBS-1 PR1, CORS duplication that creates divergent code paths, and missing explicit prerequisites that make the dependency chain misleading. The 5g git migration checklist also contains a schema mismatch that will corrupt events in flight. These are correctable without a structural rethink.

---

## Strengths

- **HITL architecture is well-reasoned.** The ephemeral WS server on a random port (hook side) with the observability server acting as relay is correct. Inverting the usual direction is intentional and sound -- the hook opens the port, registers it in the event payload, and the server calls back. This avoids the hook needing to know the server's WS URL for response routing.

- **Justfile design is clean.** Symlink strategy (plist lives in version control, `just restart` picks up `git pull` changes) is the right pattern. `set dotenv-load` + env var for port override gives flexible configuration without baking in the default.

- **Dependency ordering is mostly right.** Putting 5c (static serving) first so the single-process deployment works before wiring up launchd (5a) is correct sequencing. The plan correctly identifies 5g as the final step because it depends on everything else being stable.

- **Response matching by event `id` is strictly better than the Disler reference.** Using event ID to correlate hook responses (instead of `permission_type`) eliminates collision risk when multiple concurrent HITL requests are in flight.

---

## Critical Issues (must fix)

### C1: `test-event` in the justfile contradicts OBS-1 PR1's schema

**Location:** Stage 5b, `test-event` recipe

The justfile posts:
```json
{
  "sessionCid": "test-session-001",
  "cid": "test-cid-001"
}
```

OBS-1 PR1's `EventEnvelope` uses `correlationId` (single field). The three-tier fields (`sessionCid`, `cid`, `parentCid`) are explicitly deferred to OBS-1 PR2. OBS-4's `types.ts` also documents this: `// single field -- three-tier CIDs are PR2`.

This means `test-event` will either:
1. Pass OBS-1 PR1's ingress validator (`validateEventPayload` checks for `schemaVersion`, `type`, `data` -- the extra fields don't cause a 400, but they're noise), OR
2. Fail silently once the server's ingress validator is tightened to reject unknown fields.

More critically, the OBS-1 schema validator (section 2.4) and the ingress validation test spec both expect the canonical envelope. Shipping a test fixture that doesn't match the canonical envelope trains bad habits and will break once OBS-1 PR2 ships and the validator is updated.

**Fix:** Update `test-event` to use `correlationId`:
```json
{
  "schemaVersion": "1.0.0",
  "id": "test-$(date +%s)",
  "timestamp": "...",
  "type": "hook.notification",
  "app": "test",
  "appRoot": "/tmp",
  "source": "hook",
  "correlationId": "test-cid-001",
  "data": { "message": "Test event from justfile" }
}
```

Remove `sessionCid`, `cid` from the payload. Also fix the `source` field -- OBS-1 constrains it to `'cli' | 'hook'`; `"just-test-event"` (used in the `source` field in the current plan) would fail a strict validator. Correct value is `"hook"`.

### C2: CORS duplication -- OBS-5 and OBS-1 both add CORS headers with divergent configurations

**Location:** Stage 5c, "CORS Headers" section

OBS-1 PR1 (section 2.4, "Operational additions") already adds CORS to `server.ts`:
```typescript
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
```

OBS-5 Stage 5c proposes adding CORS again:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
```

The two definitions differ on `Allow-Methods`: OBS-1 allows `GET, POST, OPTIONS`; OBS-5 adds `PUT, DELETE`. There is no `PUT` or `DELETE` endpoint in either OBS-1 or OBS-5 (the HITL respond endpoint is `POST /events/:id/respond`). Adding `PUT, DELETE` to CORS headers for routes that don't exist is misleading and widens the attack surface for SSRF-style misuse.

**More importantly:** if OBS-5 tries to add a second `corsHeaders` constant to `server.ts` after OBS-1 PR1 has already shipped the CORS implementation, this is a merge conflict or a duplicate definition bug waiting to happen.

**Fix:** Remove the CORS headers section from Stage 5c entirely. OBS-1 PR1 owns CORS. Stage 5c should note that CORS is already handled by OBS-1 and describe only the static serving and SPA fallback changes.

### C3: Stage 5g migration checklist contains the same schema mismatch as C1

**Location:** Stage 5g, "Risk Mitigation" section

The risk mitigation note says:
> Server should accept both old `correlationId` and new `sessionCid/cid/parentCid` during migration

This is backwards. OBS-1 PR1 uses `correlationId`. The three-tier CIDs (`sessionCid/cid/parentCid`) are the **future** state (OBS-1 PR2), not the old state. There is no migration path where the old schema uses `correlationId` and the new schema uses three-tier CIDs -- both schemas live in the OBS-1 plan with PR2 being the explicit cutover. The server doesn't need to accept both simultaneously at the time of 5g execution, because 5g ships after OBS-1 PR1 but before OBS-1 PR2.

The dual cache path migration (from `side-quest-git` to `side-quest-observability`) is the real migration risk -- and that is already handled correctly in OBS-1 PR1 via `discoverEventServer()`. The note confuses two separate migrations.

**Fix:** Delete the sentence about dual `correlationId`/`sessionCid` acceptance. Replace with: "Server accepts OBS-1 PR1 schema (`correlationId`). Three-tier CIDs are a PR2 concern, not a 5g concern. The real migration risk is the cache path change -- verify with the integration test described in OBS-1."

---

## Important Observations (should fix)

### I1: The dependency chain omits OBS-1 completion as an explicit prerequisite

**Location:** Dependency Graph section (top of plan)

The stated chain is:
```
5c (static serving) --> 5a (launchd) --> 5b (justfile) --> 5e (LCARS) --> 5d (HITL) --> 5g (git migration)
```

The plan header says "Prerequisites: Domains 1-4 must be substantially complete." But the 5c description says "one-line change to `Bun.serve()`" -- implying it's a fast first step. The problem: **5c modifies `packages/server/src/server.ts`, which only exists after OBS-1 PR1 ships.** The static serving code (`path.join(clientDistDir, ...)`, `Bun.file()`, SPA fallback) is being inserted into a server module that lives in the OBS-1 repo.

This isn't wrong -- OBS-1 must complete first -- but the dependency graph doesn't show it. A reader looking at the 5c->5a->5b chain could conclude that Stage 5c is independently startable, which it isn't.

**Fix:** Add OBS-1 as an explicit first node:
```
OBS-1 complete --> 5c --> 5a --> 5b --> 5e --> 5d --> 5g
```

Or at minimum, add a note under 5c: "Blocked on OBS-1 PR1. Modifies `packages/server/src/server.ts` which must exist first."

### I2: Stage 5e (LCARS CSS) directly conflicts with OBS-4's design system decision

**Location:** Stage 5e header and "Theme Integration" section

OBS-4 explicitly records that LCARS CSS was cut as a scope reduction:
> "LCARS CSS | 1 | Replaced by two-tier design token system (modeled on Entain's `globals.css` pattern) | n/a -- design system ships in v1"

OBS-4's `globals.css` already includes LCARS-inspired variables (`--color-orange-500`, `--color-text-primary: var(--color-orange-400)` as orange-on-dark) expressed as Tailwind v4 `@theme` tokens -- not as `--lcars-*` prefixed CSS variables.

Stage 5e proposes a parallel `lcars.css` with its own `--lcars-*` namespace (`--lcars-orange: #ff9933`, `--lcars-text-primary`, etc.) and a `.theme-lcars` class. This creates two competing design systems in the same app:
- OBS-4: `bg-[var(--color-card-bg)]` (Tailwind arbitrary values referencing two-tier tokens)
- OBS-5: `.theme-lcars .lcars-header` (class-based structural LCARS elements)

The orange values also differ: OBS-4 uses `#f97316` (Tailwind orange-500); OBS-5 uses `#ff9933`. Two different oranges in the same UI.

**Fix:** Stage 5e needs to be scoped as an **extension** of OBS-4's existing design system, not a parallel system. Options:
1. Extend `globals.css` with LCARS structural utilities using `@layer` and the existing `--color-brand-primary` token (not new `--lcars-*` tokens).
2. If the `.theme-lcars` class approach is kept, it must override the `@theme` tokens, not introduce competing names. E.g., `.theme-lcars { --color-text-primary: #ff9933; }` rather than `--lcars-text-primary: #ff9933`.
3. Reconcile the orange values: pick one (`#f97316` or `#ff9933`) and use it everywhere.

OBS-4 also explicitly defers LCARS structural elements (elbows, end-caps, left bar) to v1.1. Stage 5e should align with that deferred timeline or explicitly justify why it's being pulled forward.

### I3: The HITL architecture has an unguarded race between server's WS connect and hook timeout

**Location:** Stage 5d, Architecture diagram (steps 9-10)

The flow is:
1. Hook creates ephemeral WS server on random port (step 1)
2. Hook POSTs event with `responseWebSocketUrl` (step 2)
3. Server stores event, broadcasts to dashboard (steps 3-4)
4. Human responds via dashboard (steps 5-7)
5. Server POSTs to `/events/:id/respond` (step 7)
6. Server opens WS to hook's `responseWebSocketUrl` (step 9)
7. Hook receives response (step 11)

The gap: what happens if the human responds (step 7) but the hook has already timed out (300 seconds default, but could be any value the hook sets) and called `server.stop(true)` in the `finally` block? The server attempts to open a WS connection to a port that no longer exists. The server's `sendResponseToHook()` function will fail with `ECONNREFUSED`, but the plan shows no error handling for that case. The dashboard will receive `{ ok: true }` from the `/events/:id/respond` endpoint, but the hook never gets the response.

The current `handleHitlRespond` snippet doesn't check the return value of `sendResponseToHook()` or catch the connection error.

**Fix:** `sendResponseToHook()` must catch connection errors. On failure, the event status should be set to `'error'` (not `'responded'`), and the broadcast to the dashboard should reflect the failure: `{ type: 'event_updated', data: { ...event, hitlStatus: 'error' } }`. This gives the human visibility that their response didn't land.

### I4: Stage 5g deletes `src/events/` before verifying re-exports cover all public surface

**Location:** Stage 5g, step 5 ("Delete `src/events/` directory")

The migration checklist lists the re-exports for `@side-quest/git`'s `src/index.ts` as:
```typescript
export { createEvent, EventStore, startEventServer, /* ... */ } from '@side-quest/observability'
```

The `/* ... */` is doing a lot of work. `@side-quest/git/src/events/` has 7 source files and OBS-1's plan lists its barrel as exporting from all of them (`client.js`, `emit.js`, `schema.js`, `server.js`, `store.js`, `types.js`). If any currently-exported symbol from `@side-quest/git` is not re-exported through `@side-quest/observability`, deleting the directory is a breaking change that won't be caught until a downstream consumer breaks in CI.

The changeset is labeled "Major version bump -- removing public exports" -- but it's supposed to be a safe migration via re-exports, not an intentional removal. The label contradicts the intent.

**Fix:** Before step 5, generate a full diff of the current `@side-quest/git` public API (using `tsc --declaration --emitDeclarationOnly` or `bunx @microsoft/api-extractor run`) and verify every exported symbol appears in the re-export shim. The changeset should be labeled "minor" if re-exports are complete (no breaking change), or the removed symbols should be explicitly documented as intentionally dropped.

---

## Nice-to-Haves

### N1: `just db-reset` glob is fragile

**Location:** Stage 5b, `db-reset` recipe

```just
db-reset:
    @rm -f ~/.cache/side-quest-observability/*/events.jsonl
```

This only removes `events.jsonl` in top-level dirs under the cache root. After OBS-1's rotation, there will also be `events.jsonl.1`, `events.jsonl.2`, etc. Rotated files are left orphaned. A pattern of `events.jsonl*` or `rm -rf ~/.cache/side-quest-observability/` (with a safety prompt) would be more complete.

### N2: Launchd plist hardcodes paths -- should document the setup script pattern

**Location:** Stage 5a, "Design Decisions" section

The plan acknowledges hardcoded paths (`/Users/nathanvale/`) are necessary because launchd doesn't expand `~`. This is a personal-use tool, so hardcoding is acceptable. However, the justfile's `install` recipe does the symlink + `launchctl load` but doesn't template the plist. Anyone cloning this repo to a different machine must manually edit 5 path strings before the plist works.

Consider generating the plist from a template during `just install` using `envsubst` or a small Bun script that substitutes `$HOME` at install time. The plist in version control would become a `.template` with `${HOME}` placeholders.

### N3: The HITL `updateHitlStatus` uses `(event as any).hitlStatus`

**Location:** Stage 5d, "EventStore Changes" section

```typescript
updateHitlStatus(id: string, status: HumanInTheLoopStatus): EventEnvelope | undefined {
  const event = this.toArray().find(e => e.id === id)
  if (event) (event as any).hitlStatus = status
  return event
}
```

`EventEnvelope` is defined as fully `readonly` in OBS-1. Mutating it via `as any` bypasses TypeScript's guarantees and will mutate the object in the ring buffer, not a copy. This is the intended behavior (update the stored event in place) but the pattern is fragile: if `toArray()` returns copies rather than references, the mutation is silently lost.

Consider either: (a) making `hitlStatus` an optional field on `EventEnvelope` in OBS-1 PR2 so the mutation is typed, or (b) maintaining a separate `Map<string, HumanInTheLoopStatus>` keyed by event ID and merging them at read time (`GET /events/:id`, WebSocket broadcast). The separate map approach avoids mutating the ring buffer and keeps `EventEnvelope` clean.

### N4: `start` recipe reports "Server starting" before confirming the server is actually up

**Location:** Stage 5b, `start` recipe

```just
start:
    @launchctl load {{plist_dst}} 2>/dev/null || true
    @echo "Server starting on port {{server_port}}"
    @sleep 1
    @just health
```

`sleep 1` is a guess. If the server takes longer to start (cold Bun cache, slow disk), `just health` reports DOWN and the user thinks the install failed. Consider polling health with a retry loop (e.g., 10 retries at 500ms intervals) instead of a fixed sleep:

```just
start:
    @launchctl load {{plist_dst}} 2>/dev/null || true
    @for i in $(seq 1 10); do \
        curl -sf http://127.0.0.1:{{server_port}}/health >/dev/null 2>&1 && \
        echo "Server: UP (port {{server_port}})" && exit 0; \
        sleep 0.5; \
    done; \
    echo "Server: failed to start (check just logs-err)"
```

---

## Questions for the Author

1. **Stage 5c ownership:** Is `packages/server/src/server.ts` the OBS-1 server file? If so, is Stage 5c modifying the OBS-1 repo's server, or creating a thin wrapper in a new file? The plan says "Modify `packages/server/src/server.ts`" -- but OBS-1 owns that file. Is OBS-5 adding static serving as a PR to OBS-1's server.ts, or is there a separate entry point planned?

2. **HITL and hook process location:** The `hitl-server.ts` is filed under `packages/server/src/cli/hitl-server.ts`. But the hook side (ephemeral WS server, pending futures map) runs inside the Claude Code hook process, which is launched via `bunx @side-quest/observability hook session-start`. Is `hitl-server.ts` intended to be called by the hook CLI? If so, it needs to be in the OBS-2 file tree (currently not referenced there), not just in the OBS-5 plan.

3. **`source: "just-test-event"` in test-event:** Is this intentional (a test-only sentinel value) or accidental? OBS-1 constrains `source: 'cli' | 'hook'` and the ingress validator checks this field. Sending an invalid source will generate a 400 once OBS-1's strict validator is in place.

4. **Stage 5e timeline vs OBS-4's deferred LCARS:** OBS-4 explicitly deferred LCARS structural elements to v1.1. Is Stage 5e meant to ship alongside OBS-4 v1, or is it part of the v1.1 cohort? The dependency chain shows `5b --> 5e --> 5d` which implies 5e is pre-5d (HITL). Is the LCARS theme needed before HITL, or can it be decoupled and deferred until after HITL?

5. **5g changeset label:** The plan says "Major version bump -- removing public exports." If re-exports provide full backward compatibility (the stated intent), there are no removed public exports from the consumer's perspective. Should this be a minor bump (new dependency, same API surface) or is the major bump intentional because the underlying implementation location changes?
