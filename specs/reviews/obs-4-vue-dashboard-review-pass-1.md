# OBS-4 Vue Dashboard Review -- Pass 1 (Architect)

**Reviewer lens:** System boundaries, data flow correctness, API surface, type safety, long-term maintainability

---

## 1. Verdict

**REQUEST CHANGES**

Three critical issues must be resolved before implementation. The plan has a solid component architecture but builds on assumptions about upstream contracts that don't yet exist, and includes a major component (EngagePipeline) with no data source.

---

## 2. Strengths

- **Lean dependency choices.** Zero chart library, no router, no Pinia -- composables with `ref`/`computed` is the right call for a single-page dashboard. The Canvas 2D approach for PulseChart avoids a 200KB bundle tax and gives full rendering control for LCARS theming.

- **Clear unidirectional data flow.** The `WebSocket -> App.vue -> composables -> components` chain is well-defined. Filtering as a display-only concern (never touching the event buffer) is architecturally clean.

- **Extensible agent display with graceful fallback.** The `getAgentDisplay()` function with hash-based coloring for unknown agent types means new agents appear automatically without code changes. Good forward-thinking.

- **Phased implementation sequence.** The 5-phase breakdown (scaffold, filtering, chart, pipeline, theming) allows incremental verification. Each phase has a clear "verify" checkpoint.

---

## 3. Critical Issues (must fix before implementation)

### C1: Client `EventEnvelope` uses deferred three-tier CIDs, not the current schema

**Location:** Section 12 (`types.ts`), Section 9 (`useFilters.ts`)

The plan's `EventEnvelope` in `src/types.ts` uses `sessionCid`, `cid`, and `parentCid`. However:

- OBS-1 PR1 uses a **single `correlationId`** field. Three-tier CIDs are explicitly deferred to PR2.
- OBS-2's emitter also uses **single `correlationId`** -- confirmed in its section 9 (`emitter.ts`).

The filter composable references `e.sessionCid` which would be `undefined` at runtime, silently breaking session filtering.

**Fix:** The client `EventEnvelope` must match OBS-1 PR1 exactly:

```typescript
interface EventEnvelope<T = unknown> {
  readonly schemaVersion: '1.0.0'
  readonly id: string
  readonly timestamp: string
  readonly type: EventType
  readonly app: string
  readonly appRoot: string
  readonly source: 'cli' | 'hook'
  readonly correlationId: string  // single field
  readonly data: T
}
```

Session filtering must use `data.sessionId` (from the payload) instead of a top-level `sessionCid` field. Update `useFilters.ts` accordingly.

### C2: EngagePipeline has no data source in v1

**Location:** Section 7 (Engage Pipeline Trace Algorithm), Section 13 Phase 4

The pipeline reconstruction algorithm depends on:
- `SubagentStart` / `SubagentStop` events -- **deferred to OBS-2 v2**
- `PostToolUse` with `data.tool_name === 'Task'` -- potentially available, but `TaskCompleted` is also **deferred to v2**
- `parentCid` for cross-agent correlation -- **deferred to OBS-1 PR2**

OBS-2 v1 ships only 5 events: SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, Stop. None of the events required for pipeline reconstruction are available.

**Fix:** Move EngagePipeline to a separate follow-up PR, gated on OBS-2 v2 shipping. Remove `useEngagePipeline.ts`, `EngagePipeline.vue`, section 7, and Phase 4 from v1 scope.

### C3: WebSocket message protocol is undefined in OBS-1

**Location:** Section 4 (WebSocket Composable Design), Section 12 (`WebSocketMessage` type)

The plan assumes the server sends `{ type: 'initial', data: [...] }` on connect and `{ type: 'event', data: {...} }` for streaming. This protocol exists in the **reference implementation**, but OBS-1's plan makes no mention of this message framing.

**Fix:** Either:
1. Add the WebSocket message protocol to OBS-1's server plan explicitly, or
2. Define the protocol in OBS-4 and add it as a requirement for OBS-1 PR1

The client and server must agree on this contract before either side is implemented.

---

## 4. Important Observations (should fix, not blocking)

### I1: Vite proxy contradicts OBS-1 CORS headers

The plan configures Vite proxy for `/stream`, `/events`, and `/metrics`, then comments "Proxy avoids CORS." But OBS-1 PR1 already adds `Access-Control-Allow-Origin: *` CORS headers. Having both means the dev path (proxy) and prod path (CORS) use different connection mechanisms, hiding integration bugs.

**Recommendation:** Drop the Vite proxy and connect directly to the server (same as reference implementation). Also note: the proxy references `/stream` but OBS-1's WebSocket endpoint is `/ws`, and `/metrics` doesn't exist in PR1.

### I2: Filter options derived from a sliding window are unstable

Filter dropdowns derive options from the 500-event buffer. As old events drop, session IDs and officer options disappear from dropdowns. A selected filter value could become invalid.

**Recommendation:** Add a `seenValues` accumulator that persists filter options independently of the event buffer. Clear only on explicit user action or page refresh.

### I3: `type` field widened to `string` loses discriminated union safety

The plan defines `type: string` on `EventEnvelope`, but OBS-1 PR1 uses `type: EventType` (a discriminated union). Using `string` means typos in filter comparisons won't be caught.

**Recommendation:** Re-declare the `EventType` union from OBS-1 for autocomplete and type narrowing.

### I4: `source` field also widened to `string`

Same issue as I3 -- OBS-1 defines `source: 'cli' | 'hook'`, the plan uses `source: string`.

---

## 5. Nice-to-Haves

- **N1: Share types via a package** -- Import from `@side-quest/observability-server` instead of duplicating `EventEnvelope`. They're in the same monorepo workspace.
- **N2: Virtual scrolling from the start** -- With 500 events and TransitionGroup, jank may hit sooner than expected.
- **N3: Time range persistence** -- `localStorage` for user preferences (time range, filter state, collapsed panels).
- **N4: Reconnection countdown** -- Show backoff countdown in SessionHeader ("Reconnecting in 12s...").

---

## 6. Questions for the Author

1. **Type contract ownership.** Who owns the `EventEnvelope` type -- the server package or a shared package? What's the sync mechanism when the server adds fields in PR2?

2. **WebSocket reconnect vs HTTP fallback.** If WebSocket fails repeatedly (corporate proxy), should the client fall back to polling `GET /events`?

3. **Event type normalization.** Section 14 mentions `normalizeEventType()`. Where does normalization happen -- composable, server, or both?

4. **OBS-1 PR1 implementation status.** Has OBS-1 actually been implemented, or is it still a plan? The dashboard's Phase 1 verification ("Events stream from server") is blocked without it.

5. **LCARS font loading.** Antonio from Google Fonts -- is a CDN dependency acceptable for a local dev tool? Consider self-hosting the font.

6. **PulseChart at 30 FPS.** Continuous `requestAnimationFrame` even when idle. Have you considered pausing the loop when no events arrive for N seconds?
