# OBS-9: Dashboard Polish (v1.1)

## Status: Planning

## Goal

Upgrade the Vue dashboard from a functional MVP to a polished, daily-driver tool. Add the UI components and interactions that were cut from v1 to keep scope tight.

## Context

v1 shipped App.vue, EventCard, EventFeed, SessionHeader, and useEventStream. It uses a two-tier Entain-style design token system with Tailwind v4. The deferred items are UX improvements that make the dashboard more useful for daily observability work.

## Depends on

- OBS-8 (Full Hook Coverage) - OfficerPanel needs SubagentStart data to show agent_type reliably

## Items

### UI Components

| Component | Description | Source spec |
|-----------|-------------|-------------|
| PulseChart | Canvas sparkline showing events/min over time. Replaces plain text counter. | OBS-4 |
| OfficerPanel | Sidebar showing agent status (idle/active), last event time. Collapses to icon strip on narrow screens. | OBS-4 |
| FilterBar | Multi-select filters for event type, source (`cli`/`hook`), agent type. Replaces single `<select>`. | OBS-4 |

### UX Improvements

| Item | Description | Source spec |
|------|-------------|-------------|
| Virtual scrolling | Performance optimization for 500+ event buffer. Needed sooner than expected. | OBS-4 |
| Stale filter fix | `seenValues` accumulator that persists filter options independently of the ring buffer. Prevents filter dropdown items from disappearing when old events rotate out. | OBS-4 |
| Keyboard shortcuts | `1-7` for section switching, `j/k` for event navigation, `e` to expand card, `Esc` to collapse. | OBS-4 |
| LCARS structural elements | Elbows, end-caps, left bar decorative shapes. Design tokens already ship in v1; shapes are the v1.1 addition. | OBS-4 |
| Sparklines in metric cards | Tiny inline charts showing 24hr history for events/min, error rate. | OBS-4 |
| Time-range presets | Quick-select buttons: 15m, 1h, 6h, 24h, 7d. Filters event buffer by timestamp. | OBS-4 |
| CORS headers on static responses | Ensure static file responses include CORS headers (already on API responses). | OBS-5 |

### Library Adoption

| Library | Purpose | Source spec |
|---------|---------|-------------|
| shadcn-vue | Collapsible sidebar, Combobox filter bar, Command palette, DatePicker. | OBS-4 |
| Unovis | shadcn-vue's native chart library. CSS variable theming for dark mode. | OBS-4 |
| Pinia | Filter state management + URL query param sync via `useRouteQuery` from VueUse. | OBS-4 |
| Antonio font | LCARS heading font. System sans-serif in v1, Antonio in v1.1. | OBS-4 |

### Deferred design decisions

| Item | Notes |
|------|-------|
| Zinc color scale shift | Gray scale works for v1. Evaluate Zinc (cooler undertone) after seeing it in context. |
| Personal LCARS dashboard skill | Point Claude at shipped components, have it extract reusable LCARS patterns into a skill. |

## Verification

1. All new components render correctly with existing event data
2. Virtual scrolling handles 500+ events without jank
3. Keyboard shortcuts work across all sections
4. Filter state persists across page reloads (Pinia + URL params)
5. LCARS shapes render correctly in dark mode
