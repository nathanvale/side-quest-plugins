# Domain 4: Vue Dashboard -- Implementation Plan

## Status: Completed (v1)

**Domain:** Vue 3 Real-Time Dashboard (`packages/client/`)
**Parent plan:** `specs/plans/observability-master-plan.md` (Stage 4)
**Dependencies:** Domain 1 (Event Server) must be complete -- the dashboard consumes HTTP + WebSocket events from it.

## Review-Driven Changes

This plan incorporates findings from a 3-pass staff engineer review (Architect, Skeptic, Operator). Reviews are at `specs/reviews/obs-4-vue-dashboard-review-pass-{1,2,3}.md`.

### Accepted -- Scope Cuts (Skeptic)

The original plan had 16 source files for a dashboard receiving 5 event types. Ratio of infrastructure to v1 need was roughly 3:1. This revision ships a minimal v1 in 6-8 files.

| Cut item | Files saved | Reason | Deferred to |
|----------|-------------|--------|-------------|
| EngagePipeline + useEngagePipeline | 2 | No SubagentStart/SubagentStop data in v1 (deferred to OBS-2 v2) | v2 |
| PulseChart + useChartData + chart-renderer | 3 | Custom Canvas charting library for a sparkline. Replace with events/min counter. | v1.1 |
| OfficerPanel + useAgentDisplay | 2 | `agent_type` only appears reliably on SubagentStart (deferred). Show agent info inline on EventCard when present. | v1.1 |
| LCARS CSS | 1 | Replaced by two-tier design token system (modeled on Entain's `globals.css` pattern) | n/a -- design system ships in v1 |
| FilterBar + useFilters composable | 2 | With 5 event types and 1 session, only useful filter is hookEvent. Inline a single `<select>` in SessionHeader. | v1.1 |

### Accepted -- Type Alignment (Architect)

| Fix | Reason |
|-----|--------|
| Use `correlationId` (single field), not `sessionCid/cid/parentCid` | OBS-1 PR1 uses single correlationId. Three-tier CIDs are PR2. |
| Use `EventType` discriminated union, not `type: string`. Forward-declare all 14 ClaudeHookEvent members for PR2 readiness (only 5 active in v1). | Typos in filter comparisons won't be caught with `string`. Forward-declaring avoids a client-side type change when PR2 ships. |
| Use `source: 'cli' \| 'hook'`, not `source: string` | Matches OBS-1 constraint exactly |
| Remove Vite proxy, connect directly | OBS-1 already adds `Access-Control-Allow-Origin: *` CORS headers. Proxy hides integration bugs. |
| Fetch history via `GET /events`, live via `ws://` | OBS-1 WS protocol sends raw EventEnvelope per frame (no initial batch). History is an HTTP concern. |

### Accepted -- Performance Fixes (Operator)

| Fix | Reason |
|-----|--------|
| `shallowRef` for events array | Events are immutable once received. Deep reactive Proxy on 500 objects with nested data is pure waste. |
| Batch incoming WS events | 6 computed re-evaluations per event at 10 events/sec = 60/sec. Batch into single reactivity trigger. |
| Chunk initial HTTP batch | Reconnect could fetch hundreds of events. Process in chunks of 50 with `requestAnimationFrame` between. |
| Disable TransitionGroup at high rates | At 10 events/sec, 10 overlapping enter animations cause layout thrashing on 500 DOM nodes. |

### Deferred to v1.1 / v2

| Feature | Deferred to | Blocker |
|---------|-------------|---------|
| EngagePipeline Gantt trace | v2 | Needs SubagentStart/SubagentStop (OBS-2 v2) |
| PulseChart canvas sparkline | v1.1 | |
| OfficerPanel sidebar | v1.1 | Needs agent_type data |
| LCARS structural elements (elbows, end-caps, left bar) | v1.1 | Design tokens ship in v1; decorative LCARS shapes are v1.1 |
| Virtual scrolling | v1.1 | Needed sooner than expected with 500 events |
| HITL permission UI | v2 | OBS-5 Stage 5d |
| Agent swim lanes | v2 | |

---

## 1. Complete File Tree (v1 -- 9 source files)

```
packages/client/
  package.json
  tsconfig.json
  tsconfig.app.json
  tsconfig.node.json
  vite.config.ts
  index.html
  src/
    main.ts
    App.vue
    types.ts
    config.ts
    vite-env.d.ts
    styles/
      globals.css                 -- Tailwind v4 @theme inline + two-tier design tokens (modeled on Entain)
    composables/
      useEventStream.ts           -- HTTP history fetch + WebSocket live stream + batching
    components/
      EventFeed.vue               -- Scrollable real-time event list with auto-scroll
      EventCard.vue               -- Single event row: hook type, tool name, expandable JSON
      SessionHeader.vue           -- Session info, connection status, event count, event type filter
```

**What's NOT here (deferred):**
- No `useAgentDisplay.ts` -- inline getAgentDisplay() in EventCard when agent_type present
- No `useEngagePipeline.ts` / `EngagePipeline.vue` -- no data source
- No `useChartData.ts` / `chart-renderer.ts` / `PulseChart.vue` -- events/min counter in SessionHeader
- No `useFilters.ts` / `FilterBar.vue` -- inline event type `<select>` in SessionHeader
- No `OfficerPanel.vue` -- no reliable agent_type data
- No `postcss.config.js` / `tailwind.config.ts` -- Tailwind v4 uses `@import 'tailwindcss'` + `@theme inline` in CSS (no config files needed)

---

## 2. Package.json Dependencies

```json
{
  "name": "@side-quest/observability-client",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.5.17"
  },
  "devDependencies": {
    "@types/node": "^22.11.2",
    "@vitejs/plugin-vue": "^6.0.0",
    "@vue/tsconfig": "^0.7.0",
    "tailwindcss": "^4.1.0",
    "typescript": "~5.8.3",
    "vite": "^7.0.4",
    "@tailwindcss/vite": "^4.1.0",
    "vue-tsc": "^2.2.12"
  }
}
```

**Why these and nothing else:**
- **Tailwind v4** -- same version as Entain repo. Uses `@theme` directive in CSS (no `tailwind.config.ts`, no `postcss.config.js`). Vite plugin via `@tailwindcss/vite` instead of PostCSS.
- No chart library -- events/min counter is plain text
- No router -- single-page dashboard
- No Pinia -- composables with `shallowRef`/`computed` are sufficient
- No PostCSS / autoprefixer -- Tailwind v4 handles this internally

---

## 3. Component Hierarchy and Data Flow

```
App.vue (flex h-screen shell -- sidebar-ready for v1.1)
  |-- <div class="flex h-screen bg-[var(--color-bg-app)]">
  |     |-- <!-- Sidebar slot: empty in v1, shadcn-vue Sidebar in v1.1 -->
  |     |-- <div class="flex flex-1 flex-col overflow-hidden">
  |           |-- SessionHeader.vue  (sticky, connection status, event count, filter, events/min)
  |           |-- EventFeed.vue      (flex-1 overflow-y-auto, scrollable event list)
  |                 |-- EventCard.vue (individual event row)
```

**Why `flex h-screen` in v1:** The outer flex container costs nothing visually but means v1.1 sidebar insertion is a slot addition, not a layout refactor. Without it, adding a sidebar requires restructuring App.vue's root layout and retesting all scroll/positioning behavior.

### Data flow (unidirectional):

```
Mount: GET /events -> initial history batch
  |
  v
App.vue -- holds `events` shallowRef (array of EventEnvelope)
  |
  v
WebSocket ws://host:port/ws -> raw EventEnvelope per frame
  |
  v
Batch buffer (non-reactive, local array)
  |  flushes on requestAnimationFrame or 100ms tick
  v
Replace events.value = [...events.value, ...batch]  (triggers single reactivity cascade)
  |
  |-- SessionHeader receives: eventCount, isConnected, sessionId, model, eventsPerMinute
  |-- SessionHeader emits: eventTypeFilter (single <select>)
  |
App.vue computes `filteredEvents` (5 lines of inline computed, no composable)
  |
EventFeed receives filteredEvents, renders EventCard per event
```

**Key principles:**
- All filtering is a display concern. The event buffer holds ALL events.
- `shallowRef` for the events array -- events are immutable once received. Trigger updates by replacing the array reference.
- Non-reactive batch buffer collapses N WebSocket events into a single reactivity trigger.

---

## 4. Design System -- Two-Tier Token Architecture

**File:** `src/styles/globals.css`
**Pattern source:** `~/code/entain-next-to-go/packages/app/src/styles/globals.css` (ADR-050)

The dashboard uses the same two-tier design token system as the Entain repo:
- **Tier 1 (Primitive):** Raw values. Never used directly in components.
- **Tier 2 (Semantic):** Purpose-driven aliases. These are what components reference.

The key difference: Entain is light-mode (neds.com.au); the observability dashboard is dark-mode (LCARS-inspired). Same architecture, inverted palette.

### globals.css

```css
/**
 * Observability Dashboard -- Design Tokens
 *
 * Two-Tier Design Token System (modeled on Entain ADR-050)
 * - Tier 1: Primitive tokens (raw values, DO NOT use in components)
 * - Tier 2: Semantic tokens (purpose-driven, USE these in components)
 *
 * Dark theme inspired by LCARS (Star Trek) with orange primary.
 * @see ~/code/entain-next-to-go/packages/app/src/styles/globals.css
 */

@import 'tailwindcss';

@source '../components';
@source '../composables';

/* Dark-only theme. If theme toggle is added in v1.1, add:
   @custom-variant dark (&:is(.dark *));
   and move semantic tokens into :root / .dark blocks.
   See design-guide skill: tailwind-v4-tokens.md */

@theme inline {
  /* ========================================
     TIER 1: PRIMITIVE TOKENS (What)
     Raw design values - DO NOT use directly in components
     ======================================== */

  /* --- Color Primitives: Dark Scale --- */
  --color-gray-950: #030712;
  --color-gray-900: #111827;
  --color-gray-850: #1a2332;
  --color-gray-800: #1f2937;
  --color-gray-700: #374151;
  --color-gray-600: #4b5563;
  --color-gray-500: #6b7280;
  --color-gray-400: #9ca3af;
  --color-gray-300: #d1d5db;
  --color-gray-200: #e5e7eb;
  --color-gray-100: #f3f4f6;

  /* --- Color Primitives: LCARS Orange (brand) --- */
  --color-orange-400: #fb923c;
  --color-orange-500: #f97316;    /* primary -- LCARS signature orange */
  --color-orange-600: #ea580c;    /* hover */
  --color-orange-700: #c2410c;    /* active/pressed */

  /* --- Color Primitives: LCARS Amber --- */
  --color-amber-400: #fbbf24;
  --color-amber-500: #f59e0b;
  --color-amber-600: #d97706;

  /* --- Color Primitives: LCARS Blue --- */
  --color-blue-400: #60a5fa;
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;

  /* --- Color Primitives: LCARS Cyan --- */
  --color-cyan-400: #22d3ee;
  --color-cyan-500: #06b6d4;

  /* --- Color Primitives: Status (-400 for dark bg legibility, WCAG AA compliant) --- */
  --color-green-400: #4ade80;      /* 9.2:1 on gray-950 */
  --color-red-400: #f87171;        /* 5.8:1 on gray-950 */
  /* amber-400 (#fbbf24) already defined above in LCARS Amber -- 11.3:1 on gray-950 */
  --color-yellow-400: #facc15;     /* alt warning shade */

  /* --- Color Primitives: Utility --- */
  --color-white: #ffffff;
  --color-black: #000000;

  /* --- Spacing Primitives --- */
  --space-0: 0;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */

  /* --- Border Radius Primitives --- */
  --radius-none: 0;
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.375rem;  /* 6px */
  --radius-lg: 0.5rem;    /* 8px */
  --radius-full: 9999px;

  /* --- Typography Primitives --- */
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-2xl: 1.5rem;    /* 24px */

  /* ========================================
     TIER 2: SEMANTIC TOKENS (Why/Where)
     Purpose-driven tokens - USE these in components
     ======================================== */

  /* --- Brand Colors --- */
  --color-brand-primary: var(--color-orange-500);
  --color-brand-primary-hover: var(--color-orange-600);
  --color-brand-accent: var(--color-amber-500);
  --color-brand-accent-hover: var(--color-amber-600);

  /* --- Text Colors (dark theme) --- */
  --color-text-primary: var(--color-orange-400);       /* orange on dark -- LCARS signature */
  --color-text-secondary: var(--color-gray-400);       /* muted gray */
  --color-text-tertiary: var(--color-gray-500);        /* dimmed */
  --color-text-inverse: var(--color-gray-950);         /* dark text on light backgrounds */
  --color-text-brand: var(--color-brand-primary);
  --color-text-heading: var(--color-amber-400);        /* amber for headings */

  /* --- Background Colors (dark theme) --- */
  --color-bg-app: var(--color-gray-950);               /* deepest black -- page bg */
  --color-bg-surface: var(--color-gray-900);           /* slightly lighter -- panels */
  --color-bg-card: var(--color-gray-850);              /* card/event row bg */
  --color-bg-hover: var(--color-gray-800);             /* hover state */
  --color-bg-active: var(--color-gray-700);            /* active/pressed */
  --color-bg-overlay: rgba(0, 0, 0, 0.6);

  /* --- Status Colors (-400 not -500 on dark backgrounds) --- */
  --color-status-success: var(--color-green-400);
  --color-status-error: var(--color-red-400);
  --color-status-warning: var(--color-amber-400);
  --color-status-info: var(--color-blue-400);

  /* --- Border Colors (dark theme) --- */
  --color-border-default: var(--color-gray-800);       /* subtle on dark */
  --color-border-subtle: var(--color-gray-850);        /* barely visible */
  --color-border-strong: var(--color-gray-700);        /* emphasized */
  --color-border-brand: var(--color-brand-primary);    /* orange accent borders */

  /* --- Component: Event Cards --- */
  --color-card-bg: var(--color-bg-card);
  --color-card-border: var(--color-border-default);
  --color-card-hover: var(--color-bg-hover);
  --space-card-padding: var(--space-4);
  --space-card-gap: var(--space-2);
  --radius-card: var(--radius-md);

  /* --- Component: Session Header --- */
  --color-header-bg: var(--color-bg-surface);
  --color-header-border: var(--color-border-brand);

  /* --- Component: Filter Select --- */
  --color-filter-bg: var(--color-gray-800);
  --color-filter-border: var(--color-gray-700);
  --color-filter-text: var(--color-text-primary);

  /* --- Component: Badges (event type pills) --- */
  --color-badge-bg: rgba(249, 115, 22, 0.15);         /* orange-500 at 15% */
  --color-badge-text: var(--color-orange-400);
  --color-badge-border: rgba(249, 115, 22, 0.3);      /* orange-500 at 30% */
  --radius-badge: var(--radius-full);

  /* --- Component: Connection Indicator --- */
  --color-connected: var(--color-green-400);
  --color-disconnected: var(--color-red-400);

  /* --- Focus Ring (keyboard navigation) --- */
  --color-focus-ring: var(--color-blue-400);

  /* --- Component: JSON Expand Panel --- */
  --color-json-bg: var(--color-gray-900);
  --color-json-border: var(--color-gray-800);
  --color-json-text: var(--color-gray-300);

  /* --- Event Type Colors (left border accents) --- */
  --color-event-session: var(--color-blue-400);
  --color-event-tool: var(--color-orange-500);
  --color-event-error: var(--color-red-400);
  --color-event-notification: var(--color-amber-400);
  --color-event-user: var(--color-cyan-400);
  --color-event-system: var(--color-gray-500);
}
```

### How tokens are consumed in components

Same pattern as Entain -- Tailwind arbitrary value syntax referencing semantic tokens:

```html
<!-- Entain pattern (light theme) -->
<div class="bg-[var(--color-bg-card)] text-[var(--color-text-primary)] border-[var(--color-border-default)]">

<!-- Observability pattern (dark theme) -- identical syntax -->
<div class="bg-[var(--color-card-bg)] text-[var(--color-text-primary)] border-[var(--color-card-border)]">
```

### Community-sourced Tailwind patterns (TailAdmin + Cleopatra research)

**Source:** Research from TailAdmin (7 dashboard variants, React/Next.js) and Cleopatra (Vite/vanilla, 10 accent themes). Both use Tailwind v4. Patterns below are extracted from real production dashboard templates and adapted to our semantic token system.

**1. Tabular numbers for real-time values**

All numeric values that update in real-time (event counts, events/min, timestamps) must use `font-mono tabular-nums` to prevent layout jitter when digits change width. This is the single most common pattern in both TailAdmin's metric cards and Cleopatra's CEO Pulse Bar.

```html
<!-- Every updating number gets this treatment -->
<span class="font-mono tabular-nums">{{ eventsPerMinute }}</span>
```

**2. Double-layer pulsing live indicator**

Two nested spans -- outer `animate-ping` for the pulse ring, inner solid dot. Cleaner than a single pulsing element because the solid dot remains visible even during the ping animation.

```html
<span class="relative flex h-2 w-2" role="status" :aria-label="isConnected ? 'Connected' : 'Disconnected'">
  <span class="motion-safe:animate-ping motion-reduce:hidden absolute inline-flex h-full w-full rounded-full opacity-75"
        :class="isConnected ? 'bg-[var(--color-connected)]' : 'bg-[var(--color-disconnected)]'"></span>
  <span class="relative inline-flex rounded-full h-2 w-2"
        :class="isConnected ? 'bg-[var(--color-connected)]' : 'bg-[var(--color-disconnected)]'"></span>
</span>
<!-- Text label visible alongside dot for color-blind safety -->
<span class="text-xs" :class="isConnected ? 'text-[var(--color-connected)]' : 'text-[var(--color-disconnected)]'">
  {{ isConnected ? 'Connected' : 'Disconnected' }}
</span>
```

**3. Status badge severity via opacity modifier**

Instead of defining separate badge tokens for every status variant, use Tailwind's `/10` opacity modifier on the status color itself. This creates a subtle tinted background from a single color primitive. Reduces token count and stays visually consistent.

```html
<!-- Success: green tint bg, green text -->
<span class="bg-[var(--color-status-success)]/10 text-[var(--color-status-success)]">CONNECTED</span>

<!-- Error: red tint bg, red text -->
<span class="bg-[var(--color-status-error)]/10 text-[var(--color-status-error)]">FAILED</span>

<!-- Warning: yellow tint bg, yellow text -->
<span class="bg-[var(--color-status-warning)]/10 text-[var(--color-status-warning)]">DEGRADED</span>

<!-- Info/default: brand tint bg, brand text (for event type pills) -->
<span class="bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">PreToolUse</span>
```

**4. Critical row highlighting with negative margin bleed**

For error events, the card's left border + tinted background should bleed to the card edges while keeping text aligned. The `-mx` + `px` trick from Cleopatra's crisis monitor achieves this.

```html
<!-- Normal event row -->
<div class="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] px-4 py-3">

<!-- Error event row -- red left border + subtle red tint bleeds to edges -->
<div class="bg-[var(--color-status-error)]/5 border-l-2 border-[var(--color-status-error)]
            -mx-[var(--space-card-padding)] px-[var(--space-card-padding)] py-3">
```

**5. Sticky header with backdrop blur**

SessionHeader should use `sticky` positioning with backdrop blur so the EventFeed scrolls underneath with a frosted glass effect. This is the dominant pattern in both Cleopatra's CEO Pulse Bar and TailAdmin's chart headers.

```html
<header class="sticky top-0 z-40 backdrop-blur-xl
               bg-[var(--color-header-bg)]/80 border-b border-[var(--color-header-border)]">
```

Note the `/80` opacity on the background -- this is what makes the blur visible. A fully opaque background hides the blur effect entirely.

### Event type to color mapping (replaces useEventColors composable)

Instead of a composable, a 10-line inline function maps event types to semantic tokens:

```typescript
function getEventColor(type: EventType): string {
  if (type.startsWith('hook.session') || type.startsWith('session.')) return 'var(--color-event-session)'
  if (type.includes('failure') || type === 'safety.blocked') return 'var(--color-event-error)'
  if (type.startsWith('hook.pre_tool') || type.startsWith('hook.post_tool')) return 'var(--color-event-tool)'
  if (type === 'hook.notification') return 'var(--color-event-notification)'
  if (type === 'hook.user_prompt_submit') return 'var(--color-event-user)'
  return 'var(--color-event-system)'
}
```

Used as: `style="border-left-color: ${getEventColor(event.type)}"`

### Vite plugin setup (Tailwind v4)

No `tailwind.config.ts` or `postcss.config.js` needed. Tailwind v4 uses Vite plugin:

```typescript
// vite.config.ts
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // ...
})
```

### Design system comparison: Entain vs Observability

| Aspect | Entain (Next to Go) | Observability Dashboard |
|--------|---------------------|------------------------|
| Architecture | Two-tier tokens via `@theme` | Same |
| Tailwind version | v4 | v4 |
| Theme | Light (neds.com.au) | Dark (LCARS-inspired) |
| Primary brand | `#FF7800` (NEDS orange) | `#f97316` (LCARS orange) |
| Text on bg | Dark on light | Orange on dark |
| Card bg | `#ffffff` | `#1a2332` |
| App bg | `#eeeeee` | `#030712` |
| Token file | `globals.css` | `globals.css` |
| Config files | `tailwind.config.js` (minimal) | None (Tailwind v4 `@theme` only) |
| Component pattern | `bg-[var(--color-bg-card)]` | Same |
| Font | System sans-serif | System sans-serif (v1), Antonio (v1.1 LCARS) |

---

## 5. Event Stream Composable Design (unchanged from previous revision)

**File:** `src/composables/useEventStream.ts`

### Interface

```typescript
interface UseEventStreamReturn {
  events: ShallowRef<EventEnvelope[]>
  isConnected: Ref<boolean>
  error: Ref<string | null>
  connectionAttempts: Ref<number>
  eventsPerMinute: Ref<number>
  clearEvents: () => void
}

function useEventStream(serverUrl: string): UseEventStreamReturn
```

### Behavior

**Initialization (HTTP history fetch):**
1. On `onMounted`, fetch `GET ${serverUrl}/events` for history
2. Parse JSON array of EventEnvelope
3. Process in chunks of 50 with `requestAnimationFrame` between chunks to avoid UI freeze
4. Set `events.value = chunks` (single shallowRef replacement)
5. Then open WebSocket for live events

**WebSocket lifecycle:**
1. Open `WebSocket(${serverUrl.replace('http', 'ws')}/ws)`
2. On `open`: set `isConnected = true`, reset `connectionAttempts = 0`
3. On `message`: parse JSON as `EventEnvelope`, push to non-reactive batch buffer
4. On `close`: set `isConnected = false`, schedule reconnect
5. On `error`: set `error` string

**Event batching (Operator C1 fix):**
```typescript
// Non-reactive batch buffer -- accumulates between flushes
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

// Tab visibility -- defer rendering when tab is hidden
let tabVisible = true
document.addEventListener('visibilitychange', () => {
  tabVisible = document.visibilityState === 'visible'
  if (tabVisible) flushBatch()  // Flush accumulated events on tab focus
})

function flushBatch() {
  flushScheduled = false
  if (!tabVisible) return       // Accumulate but don't render while hidden
  if (pendingEvents.length === 0) return
  const batch = pendingEvents
  pendingEvents = []

  const current = events.value
  const combined = [...current, ...batch]
  // Trim from front if exceeding maxEvents (batch trim of 50)
  events.value = combined.length > maxEvents
    ? combined.slice(combined.length - maxEvents)
    : combined
}
```

**Auto-reconnect:**
- Exponential backoff with jitter: `min(3000 * 2^attempts + random(0, 1000), 30000)`
- Reset to 0 on successful connect
- Clear timeout on `onUnmounted`

**Event buffer:**
- `maxEvents` defaults to 500 (configurable via `VITE_MAX_EVENTS`)
- Trim from front when exceeded (oldest events drop)
- Trim in batches (slice, not splice-per-event)

**Events per minute counter:**
- Maintain a sliding window of event timestamps (last 60 seconds)
- Update on each batch flush
- Clean up timestamps older than 60s

**Reconnect history fetch:**
- On reconnect, re-fetch `GET /events` to fill any gap during disconnection
- Process as chunked initial batch (same as mount)
- Deduplicate by `event.id` before merging

---

## 5. Component Props, Events, and Key Behavior

### 5a. SessionHeader.vue

```typescript
interface SessionHeaderProps {
  isConnected: boolean
  eventCount: number
  sessionId: string | null
  appName: string | null
  model: string | null
  eventsPerMinute: number
  availableEventTypes: string[]
  selectedEventType: string        // '' = all
}

interface SessionHeaderEmits {
  'update:selectedEventType': [type: string]
}
```

- **Header bar:** `sticky top-0 z-40 backdrop-blur-xl bg-[var(--color-header-bg)]/80 border-b border-[var(--color-header-border)]` -- sticky with frosted glass blur so EventFeed scrolls underneath (community pattern #5)
- **Connection indicator:** Double-layer pulsing dot (community pattern #2) -- outer `motion-safe:animate-ping` ring + inner solid dot using `bg-[var(--color-connected)]` / `bg-[var(--color-disconnected)]`. Includes `role="status"` + dynamic `aria-label` for screen readers, and a visible text label ("Connected"/"Disconnected") for color-blind safety. Ping hidden via `motion-reduce:hidden` for reduced-motion users.
- **Event count badge:** `bg-[var(--color-badge-bg)] text-[var(--color-badge-text)] border-[var(--color-badge-border)]` with `font-mono tabular-nums` for stable layout
- Session ID truncated to 8 chars
- Model formatted: `claude-sonnet-4-5-20250929` -> `sonnet-4-5`
- **Events/min counter** (replaces PulseChart): `text-[var(--color-text-heading)] font-mono tabular-nums` -- monospace prevents jitter on digit changes (community pattern #1)
- Event type filter: single `<select>` with "All" + unique event types. Styled with `bg-[var(--color-filter-bg)] border-[var(--color-filter-border)] text-[var(--color-filter-text)]`

### 5b. EventFeed.vue

```typescript
interface EventFeedProps {
  events: EventEnvelope[]   // Already filtered
}
```

- **Live region:** Container uses `role="log"` with `aria-label="Event feed"`, `aria-live="polite"`, and `aria-relevant="additions"` so screen readers announce new events without interrupting the user.
- **Auto-scroll:** Sticks to bottom when user is near bottom. Manual scroll-up pauses auto-scroll. "Jump to latest" button appears.
- **Scroll detection:** `scrollHeight - scrollTop - clientHeight < 50` = at bottom
- **TransitionGroup:** Events slide in with `motion-safe:` opacity fade (300ms). **Disabled when events arrive >5/sec** (Operator I1 fix). Rate detected via batch size in last flush. Reduced-motion users see instant append (no animation).
- **Empty state:** "Waiting for events..." with muted styling

### 5c. EventCard.vue

```typescript
interface EventCardProps {
  event: EventEnvelope
}
```

- **Card container (normal):** `bg-[var(--color-card-bg)] border border-[var(--color-card-border)] hover:bg-[var(--color-card-hover)]` -- follows Entain's RaceCard pattern (semantic tokens, `transition-colors duration-150 ease-in-out`)
- **Card container (error events):** `bg-[var(--color-status-error)]/5 border-l-2 border-[var(--color-status-error)]` with negative margin bleed `-mx-[var(--space-card-padding)] px-[var(--space-card-padding)]` so the red tint extends to card edges (community pattern #4). Applied when event type includes `failure` or is `safety.blocked`.
- **Left border (non-error):** 4px colored bar via `getEventColor(event.type)` (uses `--color-event-*` semantic tokens, not raw colors)
- **Hook type badge:** e.g. "PreToolUse" in pill using opacity modifier pattern: `bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] rounded-[var(--radius-badge)]` (community pattern #3). Cleaner than separate badge tokens.
- **Tool name:** For PreToolUse/PostToolUse events, from `event.data.tool_name`. `text-[var(--color-text-secondary)]`
- **Agent type (inline):** When `event.data.agent_type` is present, show as small status badge using opacity modifier: `bg-[var(--color-status-info)]/10 text-[var(--color-status-info)]`. No full OfficerPanel.
- **Timestamp:** Right-aligned, `HH:MM:SS`, `text-[var(--color-text-tertiary)] font-mono tabular-nums` -- tabular-nums prevents column misalignment across rows (community pattern #1)
- **Tool detail line:** Bash shows truncated command, Write/Edit shows filename. `text-[var(--color-text-secondary)] text-[var(--font-size-sm)]`
- **Expand/collapse:** Click to toggle JSON panel: `bg-[var(--color-json-bg)] border-[var(--color-json-border)] text-[var(--color-json-text)]` with `<pre>` and `JSON.stringify(data, null, 2)`. No syntax highlighting in v1.
- **Copy button:** Copy raw JSON to clipboard on expanded view

---

## 6. Types

**File:** `src/types.ts`

EventEnvelope matches OBS-1 PR1 exactly (single `correlationId`, `source: 'cli' | 'hook'`). ClaudeHookEvent is forward-declared with all 14 members so the client is ready for PR2 without a type change -- only 5 are active in v1 (Architect C1 fix):

```typescript
// OBS-1 PR1 ships 5 v1 members. Remaining 9 forward-declared for PR2 readiness.
// The client's getEventColor() maps unknown types to --color-event-system (gray),
// so events arriving before the client is updated render safely.
type ClaudeHookEvent =
  // v1 (OBS-1 PR1 -- active)
  | 'hook.session_start'
  | 'hook.pre_tool_use' | 'hook.post_tool_use' | 'hook.post_tool_use_failure'
  | 'hook.stop'
  // v2 (OBS-1 PR2 -- forward-declared, not yet emitted by server)
  | 'hook.session_end'
  | 'hook.notification' | 'hook.user_prompt_submit'
  | 'hook.subagent_start' | 'hook.subagent_stop'
  | 'hook.pre_compact' | 'hook.permission_request'
  | 'hook.teammate_idle' | 'hook.task_completed'

type WorktreeEvent =
  | 'worktree.created' | 'worktree.deleted' | 'worktree.synced'
  | 'worktree.cleaned' | 'worktree.attached' | 'worktree.installed'

type SessionEvent =
  | 'session.started' | 'session.ended' | 'session.compacted'
  | 'safety.blocked' | 'command.executed'

type EventType = ClaudeHookEvent | WorktreeEvent | SessionEvent

interface EventEnvelope<T = unknown> {
  readonly schemaVersion: '1.0.0'
  readonly id: string
  readonly timestamp: string
  readonly type: EventType
  readonly app: string
  readonly appRoot: string
  readonly source: 'cli' | 'hook'
  readonly correlationId: string     // single field -- three-tier CIDs are PR2
  readonly data: T
}
```

**No `WebSocketMessage` wrapper type.** OBS-1 WS protocol sends raw `EventEnvelope` per frame. The client parses each frame as `EventEnvelope` directly.

---

## 7. Vite Configuration

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: parseInt(process.env.VITE_PORT || '5173'),
    // No proxy -- connect directly to event server.
    // OBS-1 serves CORS headers (Access-Control-Allow-Origin: *)
    // so the dashboard on :5173 can reach the server on :7483.
    // Using CORS directly (same as production) avoids hiding
    // integration bugs behind a dev-only proxy.
  },
})
```

**Why no proxy (Architect I1 fix):**
- OBS-1 PR1 already adds CORS headers
- Proxy means dev path (proxy) and prod path (CORS) use different connection mechanisms
- Bugs hidden behind proxy won't surface until production
- Reference project also connects directly

---

## 8. Config

**File:** `src/config.ts`

```typescript
export const config = {
  serverUrl: import.meta.env.VITE_SERVER_URL || 'http://127.0.0.1:7483',
  maxEvents: parseInt(import.meta.env.VITE_MAX_EVENTS || '500'),
} as const
```

**`.env.sample`:**
```
VITE_SERVER_URL=http://127.0.0.1:7483
VITE_MAX_EVENTS=500
VITE_PORT=5173
```

---

## 9. Implementation Sequence

**REQUIRED: Load these skills before implementing any UI work:**
1. **`design-guide`** (at `plugins/claude-code/skills/design-guide/`) -- 14 reference files of community-researched patterns for Tailwind v4 tokens, dark-mode color systems, component anatomy, accessibility, chart libraries, layout systems, and form patterns. Source of truth for all design decisions in this dashboard.
2. **`frontend-design`** (Anthropic's official skill) -- baseline aesthetic guard that forces a design direction before coding, bans generic choices. Prevents "AI slop" output. See Layer 1 in the Skills Strategy section below.

The implementing agent must have both skills loaded so design-guide can classify questions to reference files, and frontend-design enforces aesthetic quality on generated UI code.

### Phase 1: Scaffold + Design System (Day 1 morning)

1. Create `packages/client/` with package.json, vite config
2. `index.html`, `main.ts`, `App.vue` (minimal shell)
3. `globals.css` -- full two-tier token system (copy from section 4, adapt as needed during implementation)
4. `types.ts` (matching OBS-1 PR1 exactly)
5. `config.ts`
6. **Verify:** `bun dev` runs, dark background renders, tokens resolve

### Phase 2: Event Streaming + Feed (Day 1)

7. `useEventStream.ts` composable (HTTP fetch + WebSocket + batching + shallowRef)
8. `EventCard.vue` (basic -- hook type badge, timestamp, tool name, left border color via tokens)
9. `EventFeed.vue` with auto-scroll and rate-aware TransitionGroup
10. **Verify:** Start event server, open dashboard, events stream with correct colors

### Phase 3: Polish + Filtering (Day 2)

11. `SessionHeader.vue` (connection status, event count, events/min, session info)
12. Inline event type `<select>` filter in SessionHeader
13. `filteredEvents` computed in App.vue (5 lines, no composable)
14. Enhance `EventCard.vue` (expand/collapse JSON panel, copy button, inline agent_type badge, tool detail line)
15. Polish pass: verify all components use semantic tokens (no raw colors), transitions feel good
16. **Verify:** Filtering works, design tokens consistent, expand/collapse works

### Day count: 1-2 days (down from 4-8)

---

## 10. Potential Challenges

1. **Event type format mismatch:** Server uses `hook.pre_tool_use`. Display should format nicely: `PreToolUse`. Add `formatEventType` utility (5 lines -- split on `.`, capitalize, join).

2. **Stale filter selections after buffer rotation (Architect I2):** When the buffer rotates and drops old events, event types in the filter dropdown may disappear. For v1 this is acceptable -- with only 5 event types they're always present. For v1.1, add a `seenValues` accumulator that persists options independently of the buffer.

3. **Performance at 500 events:** `shallowRef` + batching keeps reactivity cost low. EventCard JSON formatting is lazy (on expand only). TransitionGroup disabled at high rates. If jank appears, add `vue-virtual-scroller` in v1.1.

4. **WebSocket reconnect gap:** On reconnect, re-fetch `GET /events` to fill the gap. Deduplicate by `event.id`. This covers the case where events arrived while disconnected.

5. **Browser tab visibility (Operator I4):** ~~Deferred~~ Now included in the `flushBatch` spec above. `visibilitychange` listener defers flushes when tab is hidden, flushes accumulated events on tab focus. Clean up listener in `onUnmounted`.

6. **Empty state (no events):** Show "Disconnected" status when WebSocket is down, "Waiting for events..." when connected but no events yet.

---

## Critical Files

| File | Role |
|------|------|
| `~/code/entain-next-to-go/packages/app/src/styles/globals.css` | **Design system reference** -- two-tier token architecture (ADR-050) |
| `~/code/entain-next-to-go/packages/app/src/components/RaceCard.vue` | Reference for semantic token usage in components (`bg-[var(--color-bg-card)]` pattern) |
| `~/code/entain-next-to-go/packages/app/src/components/FilterBar.vue` | Reference for active/inactive toggle pattern with tokens |
| `~/code/claude-code-hooks-multi-agent-observability/apps/client/src/composables/useWebSocket.ts` | Reference WebSocket composable |
| `~/code/claude-code-hooks-multi-agent-observability/apps/client/src/components/EventTimeline.vue` | Reference auto-scroll + TransitionGroup |
| `~/code/side-quest-git/src/events/client.ts` | Reference WS client (raw frames, auto-reconnect) |
| `specs/plans/obs-1-event-server.md` | Server contract: EventEnvelope schema, WS protocol, HTTP endpoints |

---

## Community Research References

Patterns in sections 4 and 5 marked "community pattern #N" were extracted from a Feb 2026 research sweep of Tailwind dashboard templates and Claude Code skills. Sources:

| Source | What we took | Link |
|--------|-------------|------|
| **TailAdmin** | Metric card anatomy, `font-mono tabular-nums`, chart container pattern, data table `divide-y` | [tailadmin.com](https://tailadmin.com) |
| **Cleopatra** (`moesaid/cleopatra`) | Semantic token system validation, CEO Pulse Bar (sticky blur header), crisis monitor (critical row highlighting, progress bars), double-layer ping indicator | [github.com/moesaid/cleopatra](https://github.com/moesaid/cleopatra) |
| **@PaulRBerg** | Tailwind v4 skill -- `@theme` CSS-first config, avoid v3 regression | [x.com/PaulRBerg](https://x.com/PaulRBerg/status/2022649880272048467) |
| **Anthropic `frontend-design` skill** | Design thinking framework -- forces aesthetic direction before coding. Load when building UI. | [github.com/anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) |

### Patterns we chose NOT to adopt (and why)

| Pattern | Source | Why skipped |
|---------|--------|------------|
| TailAdmin's direct `gray-*` + `dark:` prefix duplication | TailAdmin | Our two-tier semantic tokens are already better -- one token definition, no `dark:` prefixes |
| Cleopatra's 10 accent color themes | Cleopatra | Over-engineered for a single-purpose monitoring dashboard |
| ApexCharts integration | Both templates | Deferred to v1.1 PulseChart -- v1 uses plain text events/min counter |
| Sidebar navigation shell | Both templates | v1 is single-page, no sidebar. Sidebar deferred to v1.1 OfficerPanel |

---

## Dashboard Inspiration and Roadmap Context

*Added Feb 2026 from deep community research. This section captures design direction, color palette consensus, feature patterns, and reference repos for the v1.1/v2 roadmap. When we come back to extend the dashboard, start here.*

### Reference Repos -- Study These

| Repo | Stars | Why it matters | Link |
|------|-------|---------------|------|
| **OpenClaw Dashboard** | New | **Closest to what we're building.** Agent monitoring, React 19 + Tailwind, dark glassmorphic. Sparklines, activity heatmaps, live SSE feed, cost tracking by model/session, memory viewer, log tailing. 5-second auto-refresh, keyboard shortcuts (1-7 for sections). Zero-dependency Node backend. | [github.com/tugcantopaloglu/openclaw-dashboard](https://github.com/tugcantopaloglu/openclaw-dashboard) |
| **SigNoz** | 25.8k | Gold standard for open-source observability. OpenTelemetry-native. Flamegraphs, Gantt charts, p99 latency cards, unified logs/metrics/traces, powerful query builder with variable filters. The benchmark for what "production full-stack observability" looks like. | [github.com/SigNoz/signoz](https://github.com/SigNoz/signoz) |
| **OpenLLM Monitor** | 16 | LLM-specific observability: token tracking, latency, cost, retries, prompt replay. React + Vite + Tailwind + Socket.io. Animated gradient loading screens. Early-stage but directly relevant to agent monitoring. | [github.com/prajeesh-chavan/OpenLLM-Monitor](https://github.com/prajeesh-chavan/OpenLLM-Monitor) |
| **satnaing/shadcn-admin** | 11.1k | Community benchmark for shadcn/ui dashboards. Vite + TanStack Router. Sidebar nav, global search, RTL support, 10+ pages. Study for layout patterns when we add sidebar in v1.1. | [github.com/satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) |
| **GitHub Pulse** (`0xAxiom/daily-builds`) | New | Real-time repo monitoring -- SSE updates, commit velocity charts, PR age tracking, dark mode, no database. Similar architecture to our WebSocket event stream. | [github.com/0xAxiom/daily-builds](https://github.com/0xAxiom/daily-builds) |
| **Sazabi** | New | AI-native observability platform with dashboards and monitors. Commercial but the design approach (361 likes on launch tweet) signals what the market expects. | [x.com/shcallaway](https://x.com/shcallaway/status/2019096110556442998) |

### Design Direction -- What the Industry Is Converging On

Three commercial products are driving the design language that every Tailwind dashboard is copying:

**Linear** (the biggest influence in 2025-2026):
- Brand-tinted dark background at 1-10% lightness -- not pure black, but subtly warm/cool
- Bold, prominent typefaces as the primary visual anchor
- Selective bold accent colors on a near-monochrome base
- Complex gradients used sparingly for depth, not decoration
- Glassmorphism for layered panels without density
- Our LCARS theme aligns well here -- orange-tinted dark base, bold amber headings

**Vercel:**
- Collapsible sidebar that reduces to tab mode
- Zero-decoration metric cards -- the data IS the design
- Ultra-clean aesthetic, generous whitespace
- Relevant for our v1.1 when we add more panels

**Datadog** (the observability-specific reference):
- Sidebar with extreme contrast (dark sidebar on dark theme still stands out)
- Color-coded widget headers for grouping related metrics
- High-density mode vs comfort mode toggle
- Log streams minimum 6 columns wide
- "One page = one decision" -- max 12 panels per page

**Source:** [LogRocket Linear Design analysis](https://blog.logrocket.com/ux-design/linear-design/), [Datadog dark mode blog](https://www.datadoghq.com/blog/introducing-datadog-darkmode/)

### 2026 Dashboard Design Trends

From Muzli's 2026 dashboard roundup and X community sentiment:

**Trend 1: Dark + neon accents**
- Dark backgrounds with selective neon purple/green/blue accent colors
- Not flat dark -- layered with subtle gradient transitions between depth levels
- "Soft lavender accents" on dark base cited as the emblematic 2026 look
- Our LCARS orange is distinctive here -- most dashboards are going blue/purple, so orange stands out

**Trend 2: Glassmorphism for data panels**
- Transparent layers with soft backlighting (`backdrop-blur-xl bg-surface/80`)
- Creates visual hierarchy without hard borders
- We already use this on SessionHeader (community pattern #5) -- extend to card overlays in v1.1
- Works especially well for floating panels, tooltips, and modal overlays on dark backgrounds

**Trend 3: Strategic dark mode** (per @uiuxsahiil, @GidiGambino):
- "Dark mode here isn't aesthetic -- it's strategic"
- Dark backgrounds reduce cognitive noise in data-dense UIs
- Status colors (green/amber/red) pop dramatically on dark
- Higher contrast makes charts and key metrics stand out
- Our dashboard is monitoring-first, so dark is correct, not just fashionable

**Anti-trend to avoid** (per @jkirby_eth): *"Every AI dashboard: dark mode, minimal, forgettable."* The LCARS theme is our defense against generic AI dashboard aesthetics. Don't sand down the personality.

### Color Palette Consensus for Status on Dark Backgrounds

Community consensus from dashboard builders (Feb 2026). These are the Tailwind shades that work best on dark backgrounds -- one stop lighter than you'd use on white.

```
Status colors for dark backgrounds (use -400, not -500):
  Success/healthy:    emerald-400 (#34d399) or green-400 (#4ade80)
  Warning/degraded:   amber-400   (#fbbf24) or yellow-400 (#facc15)
  Error/critical:     red-400     (#f87171) or rose-400   (#fb7185)
  Info/neutral:       blue-400    (#60a5fa) or sky-400    (#38bdf8)

Background depth layers (Zinc or Neutral scale):
  App background:     zinc-950 (#09090b) or neutral-950 (#0a0a0a)
  Surface/panels:     zinc-900 (#18181b) or neutral-900 (#171717)
  Cards:              zinc-850 (custom)  or neutral-850 (custom)
  Hover:              zinc-800 (#27272a) or neutral-800 (#262626)
  Active/borders:     zinc-700 (#3f3f46) or neutral-700 (#404040)
```

**How this maps to our existing tokens:**
- ~~Our `--color-green-500: #22c55e` is green-500, one stop too saturated for dark backgrounds~~ **Fixed:** Status primitives shifted to -400 variants in globals.css (green-400 #4ade80, red-400 #f87171, amber-400 #fbbf24). All pass WCAG AA on gray-950.
- Our gray scale (gray-950 through gray-100) works but Zinc has a cooler, more modern undertone
- Decision: keep gray scale for v1, evaluate Zinc shift for v1.1 after seeing it in context

**Opacity modifier pattern for status badges** (already in community pattern #3):
```
bg-[var(--color-status-success)]/10 text-[var(--color-status-success)]  -- healthy
bg-[var(--color-status-error)]/10   text-[var(--color-status-error)]    -- error
bg-[var(--color-status-warning)]/10 text-[var(--color-status-warning)]  -- warning
```

### Feature Patterns for v1.1 / v2 Roadmap

From Datadog's [effective-dashboards guidelines](https://github.com/DataDog/effective-dashboards/blob/main/guidelines.md), [OpenObserve's observability dashboard guide](https://openobserve.ai/blog/observability-dashboards/), and OpenClaw Dashboard.

#### v1.1 Features (next iteration)

| Feature | What it is | Reference | Priority |
|---------|-----------|-----------|----------|
| **Sparklines in metric cards** | Tiny inline charts showing 24hr history for key metrics (events/min, error rate). Replaces plain text counters. | OpenClaw, TailAdmin | High -- biggest visual upgrade |
| **Time-range presets** | Quick-select buttons: "15m", "1h", "6h", "24h", "7d". Default to 15-60 min. Filters the event buffer by timestamp. | Datadog, SigNoz | High -- essential for any monitoring UI |
| **Keyboard shortcuts** | Number keys 1-7 for section switching, `j`/`k` for event navigation, `e` to expand card, `Esc` to collapse. | OpenClaw (1-7 pattern) | Medium -- DX/power-user feature |
| **Variable filter bar** | Multi-select filters for event type, source (`cli`/`hook`), agent type. Replaces single `<select>`. | Datadog, SigNoz | Medium -- needed when event types grow |
| **Collapsible sidebar** | OfficerPanel as a sidebar showing agent status, session info, model. Collapses to icon strip on narrow screens. | Vercel, shadcn-admin | Medium -- deferred from v1 |
| **Activity heatmap (mini)** | 7-day x 24-hour grid showing event density. One glance tells you when the system is busiest. | OpenClaw (30-day version) | Low -- nice-to-have visual |
| **Virtual scrolling** | `vue-virtual-scroller` for the EventFeed. Needed when buffer hits 500+ events. | Performance requirement | High -- already in deferred list |
| **Progress bars for rate limits** | Track + fill bar with color progression: `bg-primary` -> `bg-amber-500` -> `bg-red-500` as threshold is crossed. `transition-all duration-500` for smooth animation. | Cleopatra crisis monitor | Low -- needs rate limit data |

#### v2 Features (major iteration)

| Feature | What it is | Reference | Priority |
|---------|-----------|-----------|----------|
| **Flamegraph / Gantt trace view** | Visualize agent execution as horizontal bars on a timeline. Parent spans contain child spans. Click to drill into tool calls. | SigNoz, Datadog | High -- the killer feature for multi-agent |
| **Agent swim lanes** | Vertical lanes per agent, events plotted horizontally by time. Shows parallelism and handoffs between agents. | Custom (no good OSS reference) | High -- unique to multi-agent observability |
| **Cost tracking panel** | Token usage by model, session, and time period. Running total with burn rate. Per-tool cost breakdown. | OpenClaw, OpenLLM Monitor | Medium -- LLM-specific |
| **Prompt replay** | Click an event to see the exact prompt/response that triggered it. Expandable inline or in a side panel. | OpenLLM Monitor | Medium -- debugging feature |
| **Query builder** | Filter events by arbitrary field paths (e.g. `data.tool_name = "Bash"` AND `type = "hook.post_tool_use_failure"`). | SigNoz query builder | Low -- power-user feature |
| **HITL permission UI** | Intercept `hook.permission_request` events and present approve/deny buttons. Requires bidirectional WebSocket. | OBS-5 Stage 5d | High -- but blocked on server-side |
| **Dashboard persistence** | Save panel layouts, filter presets, and time ranges to localStorage or server. Restore on reload. | Grafana, Datadog | Low -- quality-of-life |
| **Multi-session view** | Side-by-side or tabbed view of multiple concurrent Claude sessions. Each with its own event stream. | No OSS reference | Medium -- unique to our use case |

#### Visualization Types to Consider (by priority)

From Datadog and OpenObserve's guidance on what observability dashboards should show:

| Visualization | Use case | v1.1 or v2 |
|--------------|----------|------------|
| **Time-series line chart** | Events/min, error rate, latency over time | v1.1 (PulseChart) |
| **Stacked area chart** | Errors by type, events by source | v1.1 |
| **Gauge / counter cards** | Total events, active sessions, connection uptime | v1 (already have as text) |
| **Sparklines** | Inline 24hr history in metric cards | v1.1 |
| **Activity heatmap** | 7-day or 30-day event density grid | v1.1 |
| **Gantt chart** | Agent execution traces with span nesting | v2 |
| **Flamegraph** | Call stack visualization for deep agent chains | v2 |
| **Log stream panel** | Raw event log with syntax highlighting (min 6 cols wide per Datadog) | v1.1 (enhance EventFeed) |

### Layout Guidelines

From Datadog's effective-dashboards guidelines:

- **Max 12 panels per page** -- "one page = one decision." Resist the urge to show everything.
- **12-column grid** for responsive widget placement. Widgets snap to column boundaries.
- **Progressive disclosure:** Overview -> per-service -> per-endpoint -> per-event. Don't dump all detail on the first screen.
- **Log streams need width** -- minimum 6 columns (50% of a 12-col grid). Our EventFeed is full-width, which is correct.
- **Time-range picker is top-level** -- always visible, affects all panels simultaneously.
- **Group related metrics** -- use color-coded section headers or card borders to visually cluster related data.

### v1.1 Architecture Decisions (Decided Now, Implemented Later)

*Added Feb 2026 after design-guide skill review. These decisions are documented here to prevent re-research and ensure v1's foundation doesn't diverge from where we're heading.*

**Decision: Adopt shadcn-vue for v1.1**

The copy-into-project model means we own the code -- the dependency is on patterns, not on a library runtime. This cascades to all v1.1 component choices:

| v1.1 Feature | Implementation | Why |
|--------------|----------------|-----|
| **Collapsible sidebar** | shadcn-vue Sidebar | 30+ pre-built blocks, `cmd+b` toggle, icon rail collapse, `useSidebar()` hook, `--sidebar-width` CSS var. Saves a week of custom work. |
| **Chart library** | Unovis (~25kb) | shadcn-vue's native chart library. CSS variable theming means dark mode switches without re-rendering charts. No imperative color config like ApexCharts. For sparklines-only before full charts, `sparkline-vue` (5kb) is even lighter. |
| **Filter bar** | shadcn-vue Combobox + VeeValidate + Zod | Multi-select with badge display. `@vee-validate/zod` auto-types form values. `validate-on-input` mode for live filtering. |
| **Filter state** | Pinia store (filters only) | `shallowRef` stays for event data (~5ms). Pinia for filter state + URL query param sync via `useRouteQuery` from VueUse. |
| **Command palette** | shadcn-vue Command + `useMagicKeys` | `Cmd+K` trigger. Fuzzy search across events, navigation, quick actions. Trivial to add alongside keyboard shortcuts if shadcn-vue is adopted. |
| **Date range picker** | shadcn-vue DatePicker + RangeCalendar | Compose with `@internationalized/date`. Preset select ("Last 15min", "Last 1h", "Last 24h") + custom range popover. |
| **Widget responsiveness** | Container queries | `@tailwindcss/container-queries` plugin. Metric cards adapt layout based on container width (sidebar open vs closed = ~250px difference). Gotcha: grid items should NOT be direct containers -- wrap content. |
| **Resizable panels** | Splitpanes | Zero deps, nested layouts, touch support. EventFeed / EventDetail side-by-side when detail view exceeds inline JSON (prompt replay, flamegraph). |

**Token naming note:** v1 uses `--color-text-*` / `--color-bg-*` naming. When shadcn-vue is adopted in v1.1, add foreground pairs (`--color-card-foreground`, `--color-header-foreground`) or remap to shadcn's `--card` / `--card-foreground` convention. Don't rename v1 tokens -- extend them.

**Virtual scrolling note:** When adopting for v1.1, consider TanStack Virtual (headless, full style control) as an alternative to `vue-virtual-scroller`. TanStack Virtual suits custom dark-mode dashboards better because it has zero opinions on markup/styles.

**Reference:** All decisions are grounded in the `design-guide` skill's reference files: `shadcn-vue.md`, `data-visualization.md`, `layout-systems.md`, `form-patterns.md`, `tailwind-v4-tokens.md`.

### Claude Code Skills Strategy for Dashboard Development

*Added Feb 2026 from deep research into the frontend-design skill ecosystem. 74.5K weekly installs across tools, Vercel-endorsed, but the community consensus is clear: it's table stakes, not the finish line.*

#### The Layered Approach (install in order)

**Layer 1: `frontend-design` (Anthropic official) -- install for v1**

The baseline aesthetic guard. ~400 tokens. Auto-activates when Claude detects frontend work. Forces a design direction before coding, bans generic choices (Inter, Roboto, purple gradients). Before/after evidence is consistently striking (4,620 likes on @asidorenko_'s demo, Vercel's official endorsement).

What it solves: prevents "AI slop" -- the generic, forgettable dashboard aesthetic.
What it doesn't solve: design consistency across sessions. Every generation is independent.

Install: already bundled as an example skill in Claude Code. Activate via `/install frontend-design`.

Source: [SKILL.md](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) | [Anthropic cookbook: Prompting for frontend aesthetics](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)

**Layer 2: Tailwind v4 + shadcn skill -- install for v1**

Prevents v3 syntax regression (the #1 pain point per @PaulRBerg). Ensures Claude uses `@theme inline` pattern, CSS-first config, dark mode via ThemeProvider, CSS variables, semantic colors. Production-tested Jan 2026.

Install: `npx skills add jezweb/claude-skills/tailwind-v4-shadcn` or via [skills.sh](https://skills.sh/jezweb/claude-skills/tailwind-v4-shadcn)

Why we need this even with our own tokens: the skill prevents Claude from generating `tailwind.config.ts` files, PostCSS configs, or v3 `darkMode: 'class'` patterns that don't exist in Tailwind v4.

**Layer 3: Feed `globals.css` as context -- do this every session**

This is our consistency layer -- and it's stronger than what most builders have. The two-tier semantic token system in `globals.css` IS the design system. When Claude has this in context, it grounds all Tailwind output in our actual tokens rather than generic choices.

Pattern from the community (@jaymartt_, X): "Feed it the tailwind config, then prompt: 'Build a high-trust [X] view for a [context].'" We do this by ensuring `globals.css` is read at the start of every dashboard implementation session.

**Why this matters:** paddo.dev documented the core failure mode in "Agents Can't Do Design Systems" -- without explicit token grounding, LLMs produce "inline Tailwind copy-pasted across files, no shared tokens, eight shades of blue, spacing chosen by dice roll." Our globals.css solves this.

**Layer 4: Personal LCARS dashboard skill -- build for v1.1**

After v1 ships, point Claude at the shipped components and have it extract the LCARS dashboard patterns into a reusable skill. This is the mager.co approach: Claude analyzes your existing work, you interview it about preferences, and it generates a project-specific SKILL.md.

What it would encode:
- Our specific token names and how to use them (`--color-card-bg`, not `bg-gray-850`)
- The EventCard anatomy (left border color, badge pattern, expand/collapse)
- The double-layer ping indicator pattern
- The opacity modifier badge pattern (`/10` tint backgrounds)
- The critical row highlighting pattern (negative margin bleed)
- Component naming conventions and prop patterns

Result: "A design system that lives inside your AI tools instead of a Figma file nobody reads." -- mager.co

Reference: [mager.co: I Turned My Design Taste Into a Claude Code Skill](https://www.mager.co/blog/2026-02-08-mager-frontend-design/)

**Layer 5 (optional): Design book skills -- for polish passes**

@jaskol_ski encoded 21 design books as Claude Code skills: `refactoring-ui`, `ux-heuristics`, `hooked-ux`, `ios-hig-design`, `design-everyday-things`. These are not dashboard-specific but useful for polish passes where you want Claude to critique spacing, hierarchy, or interaction patterns.

@yesthatjon's `web-typography-skill` (based on Bringhurst's "Elements of Typographic Style") enforces 45-75 char line length, modular type scales, vertical rhythm, hanging punctuation. Useful for v1.1 when we add the Antonio font for LCARS headings.

#### What We're NOT Using (and why)

| Tool/Approach | Why skipped |
|--------------|------------|
| **Steve Jobs/Jony Ive prompt** (@kloss_xyz, 4,363 likes) | Role-play approach, not constraints. Interesting but less reliable than token grounding for a dashboard with a defined design system. |
| **Pencil.dev** (design canvas + MCP) | Human designs on canvas, Claude reads via MCP. Overkill for v1 -- we don't have a designer. Revisit for v2 if the dashboard grows beyond single-page. |
| **secondsky/claude-skills** (167 skills) | Includes `design-review` and `design-system-creation`. Too broad -- we already have a specific design system. May cherry-pick individual skills later. |
| **/wireframe skill** (@Magdoub) | Generates 4+ UX approaches as HTML. Interesting for exploration but we already have our component hierarchy defined. |
| **HEXED / Specimen skills** (@heathenft) | Image-to-color-system and typography-scale generation. Useful if we were starting from scratch, but our LCARS palette is already defined. |

#### Community Sentiment Summary

Three camps on the frontend-design skill:

1. **"Install it immediately"** (overwhelming majority) -- 74.5K weekly installs, Vercel endorsement, striking before/after comparisons across English, Spanish, Portuguese, Chinese communities.

2. **"It's fine, not great. The real problem is aesthetics."** (@SaidAitmbarek) -- Prevents worst outputs but doesn't produce distinctive design without strong prompting. Tailwind specifically can be a liability (@pJacquelDesign found Svelte + Panda CSS gives pixel-perfect results where React + Tailwind fails).

3. **"Good codebase negates the need"** (@melvynxdev, 180 likes) -- If you have a proper design system in your tokens and CLAUDE.md, the skill is redundant. **This is our situation** -- but the skill still helps as a safety net for sessions where globals.css isn't loaded.

**Our position:** We're in camp 3 (strong existing design system) but should install the skill anyway (camp 1) as a baseline guard. The layered approach gives us both: the skill catches generic drift, the tokens enforce consistency.

#### Skill Source Links

- [frontend-design SKILL.md (official)](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md)
- [Anthropic cookbook: Prompting for frontend aesthetics](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)
- [Anthropic blog: Improving frontend design through Skills](https://claude.com/blog/improving-frontend-design-through-skills)
- [tailwind-v4-shadcn skill (skills.sh)](https://skills.sh/jezweb/claude-skills/tailwind-v4-shadcn)
- [mager.co: Personal frontend-design skill](https://www.mager.co/blog/2026-02-08-mager-frontend-design/)
- [paddo.dev: Agents Can't Do Design Systems](https://paddo.dev/blog/agents-cant-do-design-systems/)
- [paddo.dev: Breaking the AI Slop Aesthetic](https://paddo.dev/blog/claude-code-plugins-frontend-design/)
- [@asidorenko_: frontend-design demo (4,620 likes)](https://x.com/asidorenko_/status/2014444151194947642)
- [@vercel_dev: Official endorsement (2,577 likes)](https://x.com/vercel_dev/status/2014453681433858213)
- [@melvynxdev: Good codebase negates the skill (180 likes)](https://x.com/melvynxdev/status/2013512610054869268)
- [@jaskol_ski: 21 design books as skills](https://x.com/jaskol_ski/status/2021947086061629519)
- [@yesthatjon: web-typography-skill](https://x.com/yesthatjon/status/2022938065098899796)

---

### Source Links for This Section

**Repos:**
- [OpenClaw Dashboard](https://github.com/tugcantopaloglu/openclaw-dashboard) -- agent monitoring, React 19 + Tailwind
- [SigNoz](https://github.com/SigNoz/signoz) -- 25.8k stars, open-source Datadog alternative
- [OpenLLM Monitor](https://github.com/prajeesh-chavan/OpenLLM-Monitor) -- LLM observability
- [GitHub Pulse](https://github.com/0xAxiom/daily-builds) -- real-time repo monitoring, SSE
- [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) -- 11.1k stars, shadcn dashboard benchmark

**Design articles:**
- [Datadog effective-dashboards guidelines](https://github.com/DataDog/effective-dashboards/blob/main/guidelines.md)
- [OpenObserve: How to Build Observability Dashboards](https://openobserve.ai/blog/observability-dashboards/)
- [LogRocket: Linear Design -- The SaaS Design Trend](https://blog.logrocket.com/ux-design/linear-design/)
- [Muzli: Best Dashboard Design Examples 2026](https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/)
- [Datadog: Introducing Dark Mode](https://www.datadoghq.com/blog/introducing-datadog-darkmode/)
- [Dashboard Design Patterns](https://dashboarddesignpatterns.github.io/patterns.html)

**X posts:**
- [@_heyrico: Dashboard design cheatsheet -- Tailwind Neutral palette](https://x.com/_heyrico/status/2022333212035575898) (472 likes)
- [@shcallaway: Sazabi AI-native observability platform](https://x.com/shcallaway/status/2019096110556442998) (361 likes)
- [@basit_designs: Premium dark-mode dashboard design](https://x.com/basit_designs/status/2016633810054762825) (327 likes)
- [@adriankuleszo: Dark mode + data is hard to get right](https://x.com/adriankuleszo/status/2019690045901533526) (223 likes)
- [@uiuxsahiil: Dark mode isn't aesthetic -- it's strategic](https://x.com/uiuxsahiil/status/2022294631577489830)
- [@jkirby_eth: Every AI dashboard -- dark mode, minimal, forgettable](https://x.com/jkirby_eth/status/2023429554199769145)
