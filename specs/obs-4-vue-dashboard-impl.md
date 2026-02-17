# Plan: OBS-4 Vue Dashboard -- Real-Time Event Visualization

## Task Description

Build a Vue 3 real-time dashboard at `packages/client/` in the `side-quest-observability` repo. The dashboard connects to the event server (OBS-1) via HTTP (history) + WebSocket (live), displays events in a scrollable feed with LCARS-inspired dark theme, and provides basic filtering by event type.

**IMPORTANT**: Before writing any UI code, the implementing agent MUST:
1. Load the `frontend-design` skill (aesthetic quality guard)
2. Read `specs/plans/obs-4-vue-dashboard.md` section 4 (globals.css design tokens -- source of truth)
3. Read the design thinking guidelines and commit to the LCARS-inspired aesthetic direction

## Objective

A working Vue 3 dashboard that:
1. Fetches event history on mount via `GET /events`
2. Streams live events via WebSocket with batching and auto-reconnect
3. Renders events in a scrollable feed with auto-scroll behavior
4. Uses a two-tier design token system (LCARS-inspired dark theme)
5. Provides event type filtering via inline select
6. Shows connection status, event count, and events/min

## Problem Statement

The event server (OBS-1) stores and broadcasts events, but there's no way to visualize them. The dashboard provides real-time visibility into Claude Code agent activity -- the primary consumer of the observability system.

## Solution Approach

Minimal v1 in 9 source files. No router, no Pinia, no chart library. `shallowRef` for events, batched WebSocket messages, rate-aware TransitionGroup. Two-tier design tokens modeled on Entain's `globals.css` pattern (same architecture, inverted palette for dark mode).

## Design Direction (frontend-design skill)

**Purpose**: Real-time monitoring dashboard for AI agent observability
**Tone**: Retro-futuristic LCARS (Star Trek) -- dark backgrounds, bold orange/amber primary, geometric precision
**Differentiation**: The LCARS orange-on-dark aesthetic sets this apart from generic blue/purple AI dashboards
**Typography**: System sans-serif for v1 (Antonio font for LCARS headings in v1.1)

**Key aesthetic decisions:**
- Dark-first (gray-950 background, never pure white text)
- Orange primary (#f97316) -- LCARS signature, instantly recognizable
- Amber headings (#fbbf24) -- warmth hierarchy
- Status colors at -400 shade (not -500) for dark background legibility
- Glassmorphism on sticky header (backdrop-blur + opacity)
- Double-layer pulsing connection indicator
- Event type coloring via left border accents
- Opacity modifier pattern for status badges (`/10` tint backgrounds)

## Relevant Files

Use these files to complete the task:

- `specs/plans/obs-4-vue-dashboard.md` -- full detailed plan (source of truth, 1100+ lines)
- `specs/plans/obs-1-event-server.md` section 2.4 -- server contract (WS protocol, HTTP endpoints, CORS)
- `~/code/entain-next-to-go/packages/app/src/styles/globals.css` -- design system reference (two-tier tokens)
- `~/code/entain-next-to-go/packages/app/src/components/RaceCard.vue` -- semantic token usage pattern
- `~/code/claude-code-hooks-multi-agent-observability/apps/client/src/composables/useWebSocket.ts` -- reference WS composable
- `~/code/claude-code-hooks-multi-agent-observability/apps/client/src/components/EventTimeline.vue` -- reference auto-scroll + TransitionGroup

### New Files

```
packages/client/
  package.json                    -- vue, vite, tailwindcss v4
  tsconfig.json                   -- extends root
  tsconfig.app.json               -- app-specific config
  tsconfig.node.json              -- node-specific config
  vite.config.ts                  -- vue + tailwindcss/vite plugin, no proxy
  index.html                      -- SPA entry
  src/
    main.ts                       -- createApp + mount
    App.vue                       -- layout shell (flex h-screen, sidebar-ready)
    types.ts                      -- EventEnvelope, EventType (mirrors OBS-1 PR1)
    config.ts                     -- serverUrl, maxEvents from env
    vite-env.d.ts                 -- Vite client types
    styles/
      globals.css                 -- Tailwind v4 @theme inline + two-tier design tokens
    composables/
      useEventStream.ts           -- HTTP history + WS live + batching + shallowRef
    components/
      EventFeed.vue               -- scrollable list, auto-scroll, rate-aware TransitionGroup
      EventCard.vue               -- event row: badge, tool name, timestamp, expandable JSON
      SessionHeader.vue           -- sticky header: connection status, counts, filter, events/min
```

## Implementation Phases

### Phase 1: Foundation -- Scaffold + Design System

**Read first:** `specs/plans/obs-4-vue-dashboard.md` sections 1-4

1. Create `packages/client/package.json` with dependencies:
   - `vue ^3.5.17`
   - `@vitejs/plugin-vue ^6.0.0`, `tailwindcss ^4.1.0`, `@tailwindcss/vite ^4.1.0`
   - `vite ^7.0.4`, `vue-tsc ^2.2.12`, `typescript ~5.8.3`
   - No PostCSS config, no tailwind.config.ts (Tailwind v4 uses @theme inline)

2. Create `vite.config.ts`:
   - Plugins: `vue()`, `tailwindcss()`
   - No proxy -- direct CORS connection to server (Architect fix)

3. Create `index.html` (SPA shell)

4. Create `src/main.ts` (createApp, import globals.css, mount)

5. Create `src/styles/globals.css`:
   - Copy two-tier token system from spec section 4 EXACTLY
   - Tier 1: Primitive tokens (gray scale, LCARS orange/amber/blue/cyan, status colors at -400)
   - Tier 2: Semantic tokens (brand, text, bg, status, border, component-specific)
   - `@import 'tailwindcss'` + `@theme inline { ... }`

6. Create `src/types.ts`:
   - Match OBS-1 PR1 exactly: single `correlationId`, `source: 'cli' | 'hook'`
   - Forward-declare all 14 ClaudeHookEvent members (only 5 active in v1)

7. Create `src/config.ts` (VITE_SERVER_URL, VITE_MAX_EVENTS)

8. Create minimal `src/App.vue` (flex h-screen shell)

9. **Verify:** `bun dev` runs, dark background renders

### Phase 2: Core Implementation -- Event Streaming + Feed

**Read first:** `specs/plans/obs-4-vue-dashboard.md` sections 5-5c

10. Create `src/composables/useEventStream.ts`:
    - `shallowRef` for events array (Operator perf fix)
    - HTTP history fetch on mount (GET /events), process in chunks of 50 with rAF
    - WebSocket live stream with non-reactive batch buffer
    - Batch flush on requestAnimationFrame or 100ms tick
    - Tab visibility API: defer rendering when hidden, flush on focus
    - Auto-reconnect with exponential backoff + jitter (max 30s)
    - Events/min sliding window (60s)
    - Max 500 events (trim from front in batches)
    - Reconnect re-fetches history and deduplicates by event.id

11. Create `src/components/EventCard.vue`:
    - Card container: `bg-[var(--color-card-bg)]` with hover state
    - Error events: red tint + left border bleed (community pattern #4)
    - Left border color via `getEventColor(event.type)` using `--color-event-*` tokens
    - Hook type badge: opacity modifier pattern `bg-[var(--color-brand-primary)]/10`
    - Tool name from `event.data.tool_name`
    - Inline agent_type badge when present
    - Timestamp right-aligned, `font-mono tabular-nums`
    - Expand/collapse JSON panel with copy button

12. Create `src/components/EventFeed.vue`:
    - Container: `role="log"`, `aria-live="polite"`, `aria-relevant="additions"`
    - Auto-scroll: stick to bottom when near bottom (< 50px)
    - "Jump to latest" button on manual scroll-up
    - TransitionGroup with opacity fade, disabled at > 5 events/sec
    - Empty state: "Waiting for events..."
    - `motion-safe:` prefix for animations, reduced-motion fallback

13. **Verify:** Start event server, open dashboard, events stream with correct colors

### Phase 3: Integration & Polish -- Header + Filtering

**Read first:** `specs/plans/obs-4-vue-dashboard.md` sections 5a-5c, 8-9

14. Create `src/components/SessionHeader.vue`:
    - Sticky header with backdrop blur (`backdrop-blur-xl bg-[var(--color-header-bg)]/80`)
    - Double-layer pulsing connection indicator (community pattern #2)
    - Event count badge with `font-mono tabular-nums`
    - Session ID truncated to 8 chars
    - Model formatted: `claude-sonnet-4-5-20250929` -> `sonnet-4-5`
    - Events/min counter (replaces PulseChart)
    - Inline event type `<select>` filter

15. Wire App.vue:
    - Hold `events` shallowRef from useEventStream
    - Compute `filteredEvents` (5 lines inline computed)
    - Pass props to SessionHeader and EventFeed
    - Handle `update:selectedEventType` emit from SessionHeader

16. Polish pass:
    - All components use semantic tokens (no raw colors)
    - Transitions feel good at normal and high event rates
    - Expand/collapse JSON works with copy button
    - Connection status shows correctly on connect/disconnect
    - Filter resets visible on type change

17. **Verify:** Full dashboard working with filtering, auto-scroll, expand/collapse

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. Use Task and Task* tools only.
- Take note of the session id (agentId) of each team member for resume operations.

### Model Selection Guide

| Role | Model | Rationale |
|------|-------|-----------|
| All builders | sonnet | Executes well-specified tasks reliably |
| All validators | haiku | Mechanical checks: read files, run commands, report PASS/FAIL |

### Team Members

- Builder
  - Name: builder-scaffold-client
  - Role: Create client package scaffold with design system
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-streaming
  - Role: Build event stream composable and feed components
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-polish
  - Role: Build SessionHeader, wire App.vue, polish pass
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-dashboard
  - Role: Verify dashboard builds, renders, streams events correctly
  - Agent Type: enterprise:validator-mccoy
  - Model: haiku
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. Scaffold Client Package + Design System
- **Task ID**: scaffold-client
- **Depends On**: none (assumes OBS-1 server is complete)
- **Assigned To**: builder-scaffold-client
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- MUST read `specs/plans/obs-4-vue-dashboard.md` sections 1-4 FIRST
- MUST read `~/code/entain-next-to-go/packages/app/src/styles/globals.css` for reference
- Load frontend-design skill guidance (LCARS retro-futuristic dark theme direction)
- Create package.json, vite.config.ts, index.html, main.ts, App.vue shell
- Create globals.css with FULL two-tier token system from spec section 4
- Create types.ts matching OBS-1 PR1 exactly
- Create config.ts
- Verify: `cd packages/client && bun install && bun dev` renders dark background

### 2. Build Event Stream + Feed
- **Task ID**: build-streaming
- **Depends On**: scaffold-client
- **Assigned To**: builder-streaming
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- MUST read `specs/plans/obs-4-vue-dashboard.md` section 5 for composable spec
- Create useEventStream.ts (shallowRef, HTTP fetch, WS batching, auto-reconnect, events/min)
- Create EventCard.vue (left border colors, badges, expand/collapse JSON, timestamps)
- Create EventFeed.vue (auto-scroll, TransitionGroup, empty state, accessibility)
- Follow frontend-design skill: bold orange accents, LCARS card aesthetic, intentional animation
- Use semantic tokens ONLY (never raw Tailwind colors)
- Verify: start event server, open dashboard, POST test events, see them stream

### 3. Build Header + Wire App + Polish
- **Task ID**: build-header-polish
- **Depends On**: build-streaming
- **Assigned To**: builder-polish
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- MUST read `specs/plans/obs-4-vue-dashboard.md` sections 5a-5c, community patterns
- Create SessionHeader.vue (sticky blur, pulsing indicator, counts, filter, events/min)
- Wire App.vue (filteredEvents computed, props to children, event handling)
- Polish: verify all semantic tokens, transitions, expand/collapse, copy button
- Follow frontend-design skill: double-layer ping indicator, glassmorphism header, tabular-nums
- Verify: full dashboard with filtering, auto-scroll, connection status

### 4. Validate Dashboard
- **Task ID**: validate-dashboard
- **Depends On**: build-header-polish
- **Assigned To**: validator-dashboard
- **Agent Type**: enterprise:validator-mccoy
- **Model**: haiku
- **Parallel**: false
- `cd packages/client && bun run build` -- production build succeeds
- `vue-tsc -b` -- no type errors
- Dashboard renders at http://localhost:5173 with dark background
- Connection indicator shows correct state (connected/disconnected)
- Events appear in real-time when server is running and events are posted
- Event type filter works (all types + individual type selection)
- Auto-scroll works (sticks to bottom, pauses on scroll-up)
- EventCard expand/collapse shows raw JSON
- No raw Tailwind colors used (only semantic `var(--color-*)` tokens)
- No `tailwind.config.ts` or `postcss.config.js` files (Tailwind v4 CSS-first)

## Acceptance Criteria

1. `packages/client/` contains 9 source files per file tree spec
2. Dashboard renders with LCARS-inspired dark theme using two-tier design tokens
3. Events stream in real-time via WebSocket with batch flushing
4. History loads on mount via HTTP GET /events
5. Auto-reconnect with exponential backoff + jitter
6. Event type filtering via inline select in SessionHeader
7. Auto-scroll with manual override and "jump to latest" button
8. EventCard shows hook type badge, tool name, timestamp, expandable JSON
9. Error events have red tint + left border (critical row highlighting)
10. Connection status indicator with double-layer pulsing dot
11. Events/min counter in SessionHeader
12. TransitionGroup disabled at high event rates (> 5/sec)
13. `shallowRef` for events array (not deep reactive)
14. Tab visibility API defers rendering when hidden
15. `vue-tsc -b` and `bun run build` pass cleanly
16. No raw Tailwind colors -- all components use semantic tokens

## Validation Commands

- `cd packages/client && bun run build` -- production build
- `vue-tsc -b` -- type check
- `bun dev` -- development server

## Notes

- The dashboard connects directly to the event server (no Vite proxy) -- CORS headers from OBS-1 handle cross-origin.
- No shadcn-vue in v1 -- deferred to v1.1 for sidebar, command palette, date picker.
- No PulseChart in v1 -- events/min counter in SessionHeader instead.
- No OfficerPanel in v1 -- inline agent_type badge in EventCard when present.
- No EngagePipeline in v1 -- needs SubagentStart/SubagentStop data (OBS-1 PR2).
- The `globals.css` token system is the design system. Feed it as context every session.
- The implementing agent should study `~/code/entain-next-to-go/packages/app/src/styles/globals.css` for the two-tier token architecture reference.
