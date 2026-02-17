# OBS-4 Vue Dashboard Review -- Pass 2 (Skeptic)

**Reviewer lens:** Scope creep, over-engineering, YAGNI violations, "what can we cut?"

---

## 1. Verdict

**REQUEST CHANGES**

This plan designs a feature-complete dashboard for a system that ships 5 events. The ratio of infrastructure to actual v1 need is roughly 3:1. At least 10 of the 16 source files can be deferred without losing diagnostic value. The plan should be split into a "v1 minimal" that ships in 1 day and a "v1.1 polish" backlog.

---

## 2. Strengths

- **No unnecessary dependencies.** Zero chart libraries, no Pinia, no router. The dependency list is genuinely minimal and the rationale for each omission is documented.
- **Unidirectional data flow is clean.** WebSocket composable owns the buffer, App.vue distributes, components receive. No over-abstraction with a store layer.
- **WebSocket composable is well-specified.** Exponential backoff, buffer trimming in batches of 50, clear lifecycle hooks. This is the one piece that must be right, and it is.
- **Unknown agent_type fallback.** The `getAgentDisplay` hash-based coloring for unknown agents is forward-thinking without being over-engineered.

---

## 3. Critical Issues (must fix before implementation)

### C1: EngagePipeline must be cut from v1 entirely

OBS-2 v1 explicitly defers SubagentStart and SubagentStop to v2. There are zero events to feed the pipeline component. The reconstruction algorithm references `SubagentStart`, `SubagentStop`, and `agent_id` correlation -- none of which exist in the v1 event set.

This is 3 files (`useEngagePipeline.ts`, `EngagePipeline.vue`, plus the algorithm design) and one full implementation phase (Phase 4, "Day 3") that literally cannot work.

**Action:** Remove `EngagePipeline.vue`, `useEngagePipeline.ts`, section 7, and Phase 4. Add to a "v2 backlog" section.

### C2: PulseChart is a disproportionate investment for v1

Custom Canvas 2D rendering with `requestAnimationFrame` at 30 FPS, DPI scaling, `ResizeObserver`, hover tooltips, glow effects, 4 time ranges, debounced aggregation, time-bucketed data points. That is a charting library. For a sparkline. On a dashboard receiving 5 event types.

**Action:** Replace PulseChart with a simple "Events/min" counter in the SessionHeader. Defer the canvas sparkline to v1.1. Cut `useChartData.ts`, `chart-renderer.ts`, `PulseChart.vue` (3 files).

### C3: OfficerPanel has no useful data in v1

With 5 events and no SubagentStart/SubagentStop, the `agent_type` field only appears reliably on SessionStart (and only when a subagent is the session initiator). For the main Claude Code session, `agent_type` is undefined. The officer panel will show "Main" in idle state and maybe one officer entry.

**Action:** Cut `OfficerPanel.vue` and `useAgentDisplay.ts` from v1. Keep the agent display map as a design doc for v1.1. Show agent info inline on EventCard when present.

---

## 4. Important Observations (should fix)

### I1: LCARS theming should be Phase Last, not Phase 5

23 CSS custom properties, structural elements, Google Fonts, decorative sidebar. For v1, `bg-gray-950 text-orange-400` in Tailwind gets 80% of the LCARS aesthetic with zero custom CSS files.

Ship with Tailwind dark classes. Create a backlog item for the full LCARS treatment.

### I2: Filter system is over-specified for v1

Four filter dimensions with reactive derived options. With 5 event types, likely 1 active session, and no reliable officer data, the only useful filter is hookEvent.

Simplify to a single `<select>` for event type in the SessionHeader. No composable needed -- 5 lines of computed in App.vue.

### I3: File count should be 6-8, not 16

| Keep | Cut |
|------|-----|
| `useWebSocket.ts` | `useEngagePipeline.ts` |
| `App.vue` | `useAgentDisplay.ts` |
| `EventCard.vue` | `useChartData.ts` |
| `EventFeed.vue` | `useEventColors.ts` |
| `types.ts` | `useFilters.ts` (inline) |
| `config.ts` | `chart-renderer.ts` |
| `SessionHeader.vue` | `PulseChart.vue` |
| `main.css` | `lcars.css` |
| | `EngagePipeline.vue` |
| | `OfficerPanel.vue` |
| | `FilterBar.vue` |

8 source files vs 16. Half the files, half the timeline, same diagnostic value.

### I4: Timeline is optimistic

"Day 1-4" assumes one complex component per half-day. PulseChart alone is easily a day. LCARS theming is another day. Realistic estimate for the full plan: 6-8 days. The cut-down v1 is 1-2 days.

---

## 5. Nice-to-Haves

- Virtual scrolling as a v1.1 item (will be needed sooner than expected with 500 events + expand/collapse)
- JSON expand/collapse on EventCard -- a simple `<pre>` with `JSON.stringify` ships faster than syntax highlighting + copy buttons
- Proxy config covers `/stream`, `/events`, `/metrics` -- confirm OBS-1 actually exposes all 3 endpoints

---

## 6. Questions for the Author

1. **Have you run the reference dashboard against the v1 event set?** Seeing what 5 events actually look like streaming would calibrate how much UI is needed.

2. **Who is the v1 user?** If it is Nathan debugging enterprise engage runs, the EngagePipeline is the killer feature -- but it needs SubagentStart/SubagentStop first.

3. **Why derive filter options from the buffer instead of hardcoding the 5 v1 event types?**

4. **What is the actual dependency between OBS-4 and OBS-2?** Without OBS-2 shipping, the dashboard has nothing to display. Is there a mock/replay mechanism for development?

5. **The `useEventColors.ts` composable -- is it distinct from `useAgentDisplay.ts`?** Both deal with coloring.

---

## Summary of Recommended Cuts

| Item | Files saved | Days saved | Defer to |
|------|-------------|------------|----------|
| EngagePipeline | 2 | 1 | v2 (needs SubagentStart/Stop) |
| PulseChart | 3 | 1-1.5 | v1.1 |
| OfficerPanel | 2 | 0.5 | v1.1 (needs agent_type data) |
| LCARS CSS | 1 | 0.5-1 | v1.1 |
| FilterBar + useFilters | 2 | 0.5 | v1.1 (inline event type filter) |
| **Total** | **10 files** | **~4 days** | |

Ship v1 in 1-2 days with 6-8 files.
