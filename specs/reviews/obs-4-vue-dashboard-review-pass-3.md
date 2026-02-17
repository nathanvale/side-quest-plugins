# OBS-4 Vue Dashboard Review -- Pass 3 (Operator)

**Reviewer lens:** Failure modes, recovery behavior, memory management, performance under load, "what breaks at 3am?"

---

## 1. Verdict

**APPROVE WITH CONDITIONS**

---

## 2. Strengths

- **Ring buffer with configurable cap** is the right primitive. A fixed 500-event ceiling prevents unbounded growth, and front-trimming in batches of 50 avoids pathological splice-per-event.
- **Unidirectional data flow** (WebSocket -> App.vue -> children via props) is simple to reason about when debugging. No Pinia store, no event buses, no side-channel mutations.
- **Canvas rendering for PulseChart** avoids DOM node explosion that a chart library would introduce at high event rates.
- **WebSocket reconnect with exponential backoff** is specified on both server client (OBS-1) and dashboard client, preventing reconnect storms.

---

## 3. Critical Issues (must fix before implementation)

### C1: Reactive array triggers full computed cascade on every event -- no batching strategy

The plan stores events in a `Ref<EventEnvelope[]>`. Every `push()` triggers Vue's reactivity system. Six computed properties (`filteredEvents`, `availableOfficers`, `availableHookEvents`, `availableSessions`, `availableApps`, `chartData`) all depend on that array. During active tool use with events arriving every ~100ms, that is 60 computed re-evaluations per second (6 computeds x 10 events/second). Each `filteredEvents` recomputation iterates 500 events.

**Fix:** Batch incoming events. Accumulate WebSocket messages into a local (non-reactive) array and flush into the reactive `events` ref on a `requestAnimationFrame` or 100ms tick. This collapses N events into a single reactivity trigger.

### C2: `shallowRef` not used -- Vue will deep-track 500 EventEnvelope objects

`Ref<EventEnvelope[]>` with `ref()` means Vue wraps every event object and its nested `data` property in a reactive Proxy. With 500 events, each containing `data` with `tool_input` (up to 2000 chars) and `tool_result` (up to 2000 chars), Vue creates thousands of Proxy wrappers that serve no purpose -- events are immutable once received.

**Fix:** Use `shallowRef` for the events array. Events are write-once/read-many. Trigger updates by replacing the array reference (`events.value = [...events.value, newEvent]`) rather than mutating in place.

### C3: No WebSocket `initial` batch size limit on server or client

When the dashboard reconnects, the server sends `type: 'initial'` with all events in the ring buffer. If the server buffer holds 1000 events at ~2KB average, the initial message is ~2MB of JSON parsed in a single `JSON.parse` call, then pushed into the reactive system in one shot.

**Fix:** Process the initial batch in chunks (e.g., 50 at a time with `requestAnimationFrame` between chunks) to avoid a multi-second UI freeze on reconnect. Or have the server paginate the initial batch.

---

## 4. Important Observations (should fix, not blocking)

### I1: TransitionGroup will cause layout thrashing at high event rates

`TransitionGroup` with 300ms CSS transitions on event rows. At 10 events/second, 10 transition-enter animations overlap. Each insertion triggers a reflow to calculate the transition starting position. With 500 visible DOM nodes (no virtualization), this compounds.

**Recommendation:** Disable TransitionGroup when events arrive faster than 5/second (detect via rate counter). Or ship with virtual scrolling from day 1.

### I2: No cleanup of stale filter selections after buffer rotation

When the buffer rotates and drops old events, filter dropdown options derived from `events.value` shift. If the user had an officer selected whose events rotated out, `filteredEvents` returns zero results with no indication why.

**Recommendation:** Auto-clear stale filter selections with a notification, or pin previously-seen values in the dropdown.

### I3: PulseChart 30 FPS render loop runs continuously

`requestAnimationFrame` at 30 FPS even when no events arrive. During idle periods, this wastes CPU/battery.

**Recommendation:** Only schedule renders when new data arrives. Use a dirty flag. Stop the loop after 2 seconds of no events, restart on next event.

### I4: No browser tab visibility handling

When the user switches tabs, the dashboard continues processing WebSocket messages and running the canvas loop.

**Recommendation:** Use `document.visibilitychange` to pause canvas rendering. Keep WebSocket open but defer processing to tab focus.

---

## 5. Nice-to-Haves

- **N1: Event memory estimation** -- Show approximate memory usage in SessionHeader (`eventCount * avgSize / 1024 / 1024` as "~2.1 MB buffered").
- **N2: Server disconnect reason** -- Surface WebSocket close `code` and `reason` in the UI ("Disconnected (1006: abnormal)" vs "Disconnected (1001: going away)").
- **N3: Performance budget assertion** -- Development-only check: if `filteredEvents` computation takes >16ms, log a warning suggesting virtual scrolling.

---

## 6. Questions for the Author

1. **What happens to `useEngagePipeline` state when the buffer rotates?** Does the pipeline map accumulate indefinitely because it builds state incrementally, never re-deriving from the current buffer?

2. **Is the 500-event buffer sized for the client's comfort or the server's?** If the server holds 1000 and the client holds 500, the initial batch is truncated. Is that intentional?

3. **Have you profiled Vue's reactivity cost for a 500-element array of objects?** A quick benchmark comparing `ref` vs `shallowRef` would validate the approach.

4. **What is the expected behavior when two Claude Code sessions are active simultaneously?** Both fire events to the same server. Is interleaved display the intended UX, or should there be a session picker?

---

## 7. Synthesis

Across three review passes, the accumulated findings have identified the major structural risks: the Architect flagged type drift between server and client (EventEnvelope duplication, correlation ID mismatch) and the proxy/CORS contradiction; the Skeptic correctly identified that EngagePipeline has no data source in v1 and that the file count should be halved; this Operator pass surfaced the runtime risks -- unbatched reactivity cascades, deep proxy overhead on immutable data, unthrottled canvas loops, and reconnect-batch UI freezes. The critical issues from this pass (C1-C3) are straightforward to fix with `shallowRef`, event batching, and initial-batch chunking -- none require architectural changes. With all three passes applied, the plan is well de-risked for implementation. The remaining residual risk is EngagePipeline's heuristic grouping algorithm, but that is a v2 concern. I would be comfortable starting implementation once the critical issues from all three passes are addressed.
