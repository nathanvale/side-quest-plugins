# Dashboard Feature Roadmap

Feature patterns for observability and monitoring dashboards, prioritized by community adoption and practical value. Sourced from Datadog effective-dashboards guidelines, OpenObserve, OpenClaw Dashboard, and SigNoz.

---

## v1.1 Features (Next Iteration)

| Feature | What it is | Reference | Priority |
|---------|-----------|-----------|----------|
| **Sparklines in metric cards** | Tiny inline charts showing 24hr history for key metrics. Replaces plain text counters. | OpenClaw, TailAdmin | High |
| **Time-range presets** | Quick-select buttons: "15m", "1h", "6h", "24h", "7d". Filters the event buffer by timestamp. | Datadog, SigNoz | High |
| **Virtual scrolling** | Virtual list for event feeds when buffer exceeds 500 items. `vue-virtual-scroller` or equivalent. | Performance need | High |
| **Keyboard shortcuts** | `1`-`7` for sections, `j`/`k` for event nav, `e` to expand, `Esc` to collapse. | OpenClaw | Medium |
| **Variable filter bar** | Multi-select filters for event type, source, agent type. Replaces single `<select>`. | Datadog, SigNoz | Medium |
| **Collapsible sidebar** | Agent status, session info, model details. Collapses to icon strip on narrow screens. | Vercel, shadcn-admin | Medium |
| **Activity heatmap** | 7-day x 24-hour grid showing event density at a glance. | OpenClaw (30-day) | Low |
| **Progress bars** | Rate limit / queue capacity bars with color threshold progression. | Cleopatra | Low |

---

## v2 Features (Major Iteration)

| Feature | What it is | Reference | Priority |
|---------|-----------|-----------|----------|
| **Flamegraph / Gantt trace** | Agent execution as horizontal bars on a timeline. Parent spans contain child spans. | SigNoz, Datadog | High |
| **Agent swim lanes** | Vertical lanes per agent, events plotted by time. Shows parallelism and handoffs. | Custom design | High |
| **HITL permission UI** | Intercept permission requests, present approve/deny buttons. Needs bidirectional WebSocket. | Custom design | High |
| **Cost tracking** | Token usage by model, session, time. Running total with burn rate. | OpenClaw, OpenLLM Monitor | Medium |
| **Prompt replay** | Click event to see exact prompt/response. Expandable inline or side panel. | OpenLLM Monitor | Medium |
| **Multi-session view** | Side-by-side or tabbed view of concurrent sessions with independent event streams. | Custom design | Medium |
| **Query builder** | Filter by arbitrary field paths: `data.tool_name = "Bash"` AND `type = "failure"`. | SigNoz | Low |
| **Dashboard persistence** | Save layouts, filter presets, time ranges to localStorage. Restore on reload. | Grafana, Datadog | Low |

---

## Visualization Types by Priority

| Visualization | Use case | When to add |
|--------------|----------|------------|
| **Gauge / counter cards** | Total events, active sessions, uptime | v1 (text counters) |
| **Time-series line chart** | Events/min, error rate over time | v1.1 |
| **Sparklines** | Inline 24hr history in metric cards | v1.1 |
| **Stacked area chart** | Errors by type, events by source | v1.1 |
| **Activity heatmap** | 7-day or 30-day event density grid | v1.1 |
| **Log stream panel** | Event log with syntax highlighting (min 6 cols wide) | v1.1 |
| **Gantt chart** | Agent execution traces with span nesting | v2 |
| **Flamegraph** | Call stack for deep agent chains | v2 |

---

## Layout Guidelines

From Datadog's effective-dashboards guidelines:

1. **Max 12 panels per page** -- "one page = one decision." Cognitive load increases exponentially with panel count.
2. **12-column grid** for responsive widget placement. Widgets snap to column boundaries.
3. **Progressive disclosure** -- Overview -> per-service -> per-endpoint -> per-event. Don't dump all detail on the first screen.
4. **Log streams need width** -- minimum 6 columns (50% of 12-col grid). Full-width is better.
5. **Time-range picker is top-level** -- always visible, affects all panels simultaneously.
6. **Group related metrics** -- color-coded section headers or card borders to cluster related data visually.

---

## Reference Repos

| Repo | Stars | Relevance | Link |
|------|-------|-----------|------|
| **OpenClaw Dashboard** | New | Agent monitoring, React 19 + Tailwind, glassmorphic dark, SSE live feed, cost tracking | [github.com/tugcantopaloglu/openclaw-dashboard](https://github.com/tugcantopaloglu/openclaw-dashboard) |
| **SigNoz** | 25.8k | Gold standard observability. Flamegraphs, Gantt charts, p99 latency, query builder | [github.com/SigNoz/signoz](https://github.com/SigNoz/signoz) |
| **OpenLLM Monitor** | 16 | LLM-specific: token tracking, latency, cost, prompt replay | [github.com/prajeesh-chavan/OpenLLM-Monitor](https://github.com/prajeesh-chavan/OpenLLM-Monitor) |
| **satnaing/shadcn-admin** | 11.1k | shadcn/ui dashboard benchmark. Sidebar, search, 10+ pages | [github.com/satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) |
| **GitHub Pulse** | New | Real-time repo monitoring, SSE, dark mode, no database | [github.com/0xAxiom/daily-builds](https://github.com/0xAxiom/daily-builds) |
