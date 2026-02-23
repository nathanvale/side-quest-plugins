# Real-Time UI Performance Patterns

Performance patterns for WebSocket-driven dashboards handling high-frequency updates. Covers virtual scrolling, batching strategies, skeleton screens, motion libraries, and rendering thresholds.

---

## Virtual Scrolling Libraries

For event feeds exceeding 500 items, virtual scrolling is mandatory. Only visible rows are rendered; off-screen rows are recycled.

| Library | Best for | Framework | Key feature |
|---------|----------|-----------|-------------|
| **TanStack Virtual** | Full style control, dark-mode dashboards | React, Vue, Svelte, Solid | Headless -- zero opinions on markup/styles |
| **React Virtuoso** | Dynamic row heights, chat-style feeds | React only | Auto-measures row heights, infinite scroll built-in |
| **vue-virtual-scroller** | Vue-specific, simpler API | Vue 3 | Drop-in `<RecycleScroller>` component |
| **Virtua** | Emerging alternative, performance-focused | React, Vue | Newer entrant gaining traction on Best of JS |

**Decision tree:**
- Fixed-height rows + full style control -> **TanStack Virtual**
- Variable-height rows (event logs with different message lengths) -> **Virtuoso** (React) or **vue-virtual-scroller** (Vue)
- Need framework-agnostic -> **TanStack Virtual**

Source: [tanstack.com/virtual](https://tanstack.com/virtual/latest), [virtuoso.dev](https://virtuoso.dev/)

---

## WebSocket Batching Strategies

### requestAnimationFrame Batching (Recommended)

Accumulate WebSocket messages in a non-reactive buffer, flush once per animation frame. This collapses N messages into a single DOM update.

```typescript
let pendingEvents: EventEnvelope[] = []
let flushScheduled = false

function onMessage(data: string) {
  const event = JSON.parse(data) as EventEnvelope
  pendingEvents.push(event)
  if (!flushScheduled) {
    flushScheduled = true
    requestAnimationFrame(flushBatch)
  }
}

function flushBatch() {
  flushScheduled = false
  if (pendingEvents.length === 0) return
  const batch = pendingEvents
  pendingEvents = []
  // Single reactive update
  events.value = [...events.value, ...batch].slice(-maxEvents)
}
```

### JSON Diff Protocol (RFC 6902)

For large objects that change partially, send only the diff. Cited as 85% bandwidth reduction vs full object replacement. Most relevant for dashboard widgets showing aggregated metrics that update frequently.

### State Management for Hot WebSocket Paths

Benchmarks from Moldstud (2025):

| Library | Avg dispatch latency | Notes |
|---------|---------------------|-------|
| Zustand | 10-13ms | Signal-based, minimal re-renders |
| Valtio | 11-15ms | Proxy-based, auto-tracks usage |
| Redux Toolkit | 28-33ms | Action dispatch overhead |
| Vue `shallowRef` | ~5ms | Native, no library needed |

**For Vue:** Use `shallowRef` + non-reactive batch buffer. No state management library needed. The composable pattern (`useEventStream`) keeps all WebSocket state local to the component tree.

**For React:** Zustand or Valtio for WebSocket data. Avoid Redux for hot paths -- 35% fewer renders under heavy subscriptions (LogRocket data).

Source: [moldstud.com](https://moldstud.com/articles/p-real-time-state-management-in-react-using-websockets-boost-your-apps-performance)

---

## Skeleton Screens for Dark Mode

### Basic Pulse Skeleton

The canonical Tailwind pattern. No custom keyframes needed.

```html
<!-- Dark-mode aware pulse skeleton -->
<div class="animate-pulse space-y-3">
  <!-- Metric card skeleton -->
  <div class="rounded-2xl border border-[var(--color-card-border)]
              bg-[var(--color-card-bg)] p-5">
    <div class="w-12 h-12 bg-[var(--color-bg-hover)] rounded-xl"></div>
    <div class="mt-5 space-y-2">
      <div class="w-20 h-4 bg-[var(--color-bg-hover)] rounded"></div>
      <div class="w-32 h-8 bg-[var(--color-bg-hover)] rounded"></div>
    </div>
  </div>

  <!-- Event card skeleton -->
  <div class="rounded-md border border-[var(--color-card-border)]
              bg-[var(--color-card-bg)] p-4">
    <div class="flex justify-between">
      <div class="w-24 h-5 bg-[var(--color-bg-hover)] rounded-full"></div>
      <div class="w-16 h-4 bg-[var(--color-bg-hover)] rounded"></div>
    </div>
    <div class="mt-2 w-3/4 h-4 bg-[var(--color-bg-hover)] rounded"></div>
  </div>
</div>
```

### Critical UX Rule: Stagger Animation Timing

Per @benktz: "If your loading state is just a bunch of shimmering gray rectangles that all finish loading at the SAME TIME, then what you have is just a fancy loading spinner."

**Fix:** Use `animation-delay` to stagger skeleton sections so they resolve at different times:

```html
<div class="animate-pulse" style="animation-delay: 0ms"><!-- Header --></div>
<div class="animate-pulse" style="animation-delay: 150ms"><!-- Metric cards --></div>
<div class="animate-pulse" style="animation-delay: 300ms"><!-- Event feed --></div>
```

### Skeleton vs Spinner Decision Tree

Per @Capta1nCodes:
- **Skeleton** when content structure is known and load time is noticeable (>300ms)
- **Spinner** for short or unknown-duration waits
- **Neither** for operations under 200ms -- just show the content

---

## Motion Library for Dashboards

### Motion (Merged Framer Motion + Motion One)

The community-recommended animation library. ~4KB base + 2KB framework bindings (~85% smaller than old Framer Motion alone).

**Why it's safe for high-frequency dashboards:**
- Animations run on the compositor thread via Web Animations API (WAAPI)
- `transform` and `opacity` animate off the main thread
- No JavaScript animation loop blocking the main thread during updates

**Vue usage:**

```vue
<script setup>
import { Motion, AnimatePresence } from 'motion/vue'
</script>

<template>
  <AnimatePresence>
    <Motion
      v-for="event in events"
      :key="event.id"
      :initial="{ opacity: 0, y: 20 }"
      :animate="{ opacity: 1, y: 0 }"
      :exit="{ opacity: 0 }"
      :transition="{ duration: 0.2 }"
    >
      <EventCard :event="event" />
    </Motion>
  </AnimatePresence>
</template>
```

**When to disable animation:**
- Event rate >5/sec -- disable enter/exit animations entirely
- Virtual scrolling active -- animations interfere with scroll recycling
- Background tab -- defer all visual updates until tab focus

Source: [motion.dev](https://motion.dev/blog/should-i-use-framer-motion-or-motion-one)

### Built-in Vue Transitions (For Simple Cases)

For basic enter/leave without a library dependency:

```vue
<TransitionGroup
  v-if="eventRate < 5"
  name="event"
  tag="div"
>
  <EventCard v-for="event in events" :key="event.id" :event="event" />
</TransitionGroup>

<!-- Disable animations at high rates -->
<div v-else>
  <EventCard v-for="event in events" :key="event.id" :event="event" />
</div>
```

```css
.event-enter-active { transition: all 0.3s ease; }
.event-enter-from { opacity: 0; transform: translateY(10px); }
```

---

## DOM vs Canvas vs WebGL Thresholds

When to switch rendering strategies based on concurrent element count:

| Element count | Recommended renderer | Notes |
|--------------|---------------------|-------|
| 0-500 | **DOM + CSS** | Standard Tailwind components. No special handling. |
| 500-1000 | **DOM + virtual scrolling** | Add TanStack Virtual or vue-virtual-scroller. |
| 1000-3000 | **DOM + aggressive virtualization** | Only render visible rows. Batch all updates. |
| 3000-5000 | **Canvas** | Switch to `<canvas>` for the high-density visualization. Keep controls in DOM. |
| 5000-10000 | **Canvas with offscreen worker** | Move rendering to OffscreenCanvas in a Web Worker. |
| 10000+ | **WebGL** | ECharts "boost" mode, deck.gl, or custom WebGL. |

**Benchmarks (2025):**
- Canvas initial paint: ~15ms, frame time under interaction: ~1.2ms
- WebGL initial paint: ~40ms, frame time under interaction: ~0.01ms
- SVG drops below 30fps at ~10k elements

**For our event stream dashboard:** DOM + virtual scrolling covers the 500-event buffer. Canvas only becomes relevant if we add timeline heatmaps (v1.1) or flamegraphs (v2) with thousands of data points.

Source: [dev3lop.com benchmarks](https://dev3lop.com/real-time-dashboard-performance-webgl-vs-canvas-rendering-benchmarks/), [svggenie.com comparison](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025)

---

## Tab Visibility Optimization

Defer rendering work when the browser tab is hidden. Keep the WebSocket open but don't flush batches to the DOM.

```typescript
let tabVisible = true

document.addEventListener('visibilitychange', () => {
  tabVisible = document.visibilityState === 'visible'
  if (tabVisible) {
    // Tab regained focus -- flush accumulated events
    flushBatch()
  }
})

function flushBatch() {
  if (!tabVisible) return  // Accumulate but don't render
  // ... normal flush logic
}
```

This prevents the browser from doing layout/paint work on a hidden tab while still capturing all events for display when the user returns.

---

## Additional Resources

- **tailwind-animations plugin** (@midudev, 1,275 likes) -- 70+ CSS transitions, `npm install tailwind-animations`. Useful for scroll-triggered and entrance animations.
- **AgentCommand** (@MattPRD, 1,124 likes) -- Production example of 1000+ AI agents monitored in real-time via WebSocket dashboard.
- **ECharts boost mode** -- Runtime switch to WebGL when data density exceeds threshold. Useful pattern for adaptive rendering.
