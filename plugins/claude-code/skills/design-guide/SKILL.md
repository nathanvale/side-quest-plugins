---
name: design-guide
description: >
  Dashboard and UI design knowledge bank with Tailwind CSS v4 patterns, dark-mode
  color systems, component anatomy, and 2026 design trends. Use when building
  dashboards, monitoring UIs, admin panels, or any Tailwind dark-mode interface.
  Triggers on: "dashboard", "dark mode", "design tokens", "metric cards",
  "status badges", "Tailwind patterns", "color palette", "design system",
  "observability UI", "monitoring dashboard", "event feed", "real-time UI",
  "virtual scrolling", "skeleton screen", "loading state", "shadcn-vue",
  "Vue dashboard", "WebSocket performance", "animation dashboard",
  "accessibility", "WCAG", "color blind", "screen reader", "aria-live",
  "focus management", "reduced motion", "DataTable", "Unovis charts",
  "shadcn theming", "Tailwind v4 migration", "chart library",
  "Unovis", "ApexCharts", "ECharts", "sparkline", "data visualization",
  "dashboard layout", "resizable panels", "Splitpanes", "Gridstack",
  "collapsible sidebar", "container queries", "CSS Grid dashboard",
  "drag to rearrange", "responsive dashboard", "@theme", "@theme inline",
  "@custom-variant dark", "oklch", "hsl", "Tailwind v4 setup", "design tokens setup",
  "globals.css", "VeeValidate", "Zod", "form validation", "date picker",
  "command palette", "cmdk", "filter bar", "Combobox", "Pinia filters",
  "keyboard shortcuts".
allowed-tools: Read, Glob, Grep
---

# Dashboard Design Guide

Design knowledge bank distilled from community research (Feb 2026) across TailAdmin, Cleopatra, OpenClaw Dashboard, SigNoz, Datadog, Linear, and Vercel. Covers Tailwind CSS v4 patterns, dark-mode color systems, component anatomy, and feature roadmaps for observability dashboards.

## Classify the Question

Parse the user's question and read the relevant reference file(s).

| Intent | Trigger Signals | Reference File |
|--------|----------------|----------------|
| Tailwind utility patterns | tabular-nums, ping indicator, sticky header, backdrop blur, opacity modifier, critical row highlight | [tailwind-patterns.md](references/tailwind-patterns.md) |
| Color system | status colors, dark background palette, depth layers, zinc vs gray, badge colors, severity colors | [color-palette.md](references/color-palette.md) |
| Component design | metric cards, status badges, data tables, chart containers, sidebar nav, activity feeds, progress bars | [dashboard-anatomy.md](references/dashboard-anatomy.md) |
| Design direction | trends, Linear style, glassmorphism, Vercel aesthetic, Datadog patterns, anti-trends, strategic dark mode | [design-trends-2026.md](references/design-trends-2026.md) |
| Feature planning | sparklines, heatmaps, keyboard shortcuts, virtual scrolling, flamegraphs, swim lanes, layout grid | [feature-roadmap.md](references/feature-roadmap.md) |
| Claude Code skills | frontend-design skill, Tailwind v4 skill, personal skill, skills stack, design book skills | [skills-stack.md](references/skills-stack.md) |
| Vue 3 specific | useDark, v-bind CSS, Vuetify v4, Vue transitions, Vue dashboard templates, Reka UI | [vue-patterns.md](references/vue-patterns.md) |
| shadcn-vue | shadcn-vue theming, CSS variable pairs, DataTable, TanStack Table, Unovis charts, Tailwind v4 migration, shadcn vs PrimeVue | [shadcn-vue.md](references/shadcn-vue.md) |
| Performance | virtual scrolling, WebSocket batching, skeleton screens, loading states, animation, Motion library, Canvas vs DOM | [performance.md](references/performance.md) |
| Data visualization | chart libraries, Unovis, ApexCharts, ECharts, Chart.js, sparklines, real-time charts, bundle size, tree-shaking | [data-visualization.md](references/data-visualization.md) |
| Layout systems | dashboard shell, resizable panels, Splitpanes, Gridstack, drag-to-rearrange, collapsible sidebar, CSS Grid, container queries, responsive breakpoints | [layout-systems.md](references/layout-systems.md) |
| Tailwind v4 tokens | @theme, @theme inline, @custom-variant dark, two-tier tokens, primitives, semantic tokens, oklch vs hsl, globals.css setup, v3 to v4 migration | [tailwind-v4-tokens.md](references/tailwind-v4-tokens.md) |
| Form patterns | filter bars, VeeValidate, Zod, date range picker, command palette, Combobox, multi-select, Pinia filter state, keyboard shortcuts, debounced search | [form-patterns.md](references/form-patterns.md) |
| Accessibility | WCAG contrast, color-blind safe, aria-live, screen reader, reduced motion, focus management, skip links, chart accessibility | [accessibility.md](references/accessibility.md) |

For multi-intent questions, read all relevant files.

## Core Principles

These apply to ALL dashboard design work. Do not read reference files for these -- they are always in context.

1. **Semantic tokens over raw Tailwind classes** -- use `bg-[var(--color-card-bg)]` not `bg-gray-850`. Two-tier architecture: primitives (what) and semantic (why/where). Components reference semantic tokens only.

2. **`font-mono tabular-nums` on all updating numbers** -- event counts, rates, timestamps, metrics. Prevents layout jitter when digits change width.

3. **Status colors use -400 on dark, not -500** -- one stop lighter for legibility. `emerald-400` not `green-500`. Apply via `/10` opacity modifier for badge backgrounds: `bg-[var(--color-status-success)]/10 text-[var(--color-status-success)]`.

4. **Dark mode is strategic, not aesthetic** -- reduces cognitive noise in data-dense UIs, makes status colors pop, reduces eye strain in monitoring contexts.

5. **Opinionated > generic** -- "Every AI dashboard: dark mode, minimal, forgettable" (@jkirby_eth). Commit to a specific visual identity. LCARS orange, not safe blue.

6. **One page = one decision** -- max 12 panels per page (Datadog guideline). Progressive disclosure: overview -> detail -> raw data.

7. **Never color alone** -- every status indicator needs color + shape/icon + text. All -400 status colors pass WCAG AA on zinc-950. Use `motion-safe:` prefix on all animations. Use `focus-visible:` not `focus:` for keyboard rings.

## Response Structure

1. **Direct answer** -- pattern or code snippet, no preamble
2. **Supporting detail** -- from reference files, with Tailwind class examples
3. **Token mapping** -- show how the pattern maps to semantic design tokens
4. **Common failure** -- what goes wrong (e.g., raw colors instead of tokens, -500 instead of -400)
5. **Source** -- reference file and community source cited
