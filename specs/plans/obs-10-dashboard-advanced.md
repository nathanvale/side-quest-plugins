# OBS-10: Dashboard Advanced (v2)

## Status: Planning

## Goal

Add advanced visualization and interaction features to the dashboard - the features that require SubagentStart/SubagentStop data and more mature infrastructure.

## Context

These are the high-complexity dashboard features that were explicitly scoped out of v1 and v1.1. They require the full 14-event hook coverage (OBS-8) and most benefit from a polished base dashboard (OBS-9).

## Depends on

- OBS-8 (Full Hook Coverage) - SubagentStart/SubagentStop events are required
- OBS-9 (Dashboard Polish) - shadcn-vue, Pinia, virtual scrolling should be in place first

## Items

### Core Features

| Feature | Description | Source spec |
|---------|-------------|-------------|
| EngagePipeline Gantt trace | Visualize agent execution as horizontal bars on a timeline. Parent spans contain child spans. Click to drill into tool calls. Groups SubagentStart/Stop by officer to reconstruct the engage pipeline. | OBS-4, Master Plan |
| Agent swim lanes | Vertical lanes per agent, events plotted horizontally by time. Shows parallelism and handoffs between agents. | OBS-4 |
| Multi-session view | Side-by-side or tabbed view of multiple concurrent Claude sessions. Each with its own event stream. | OBS-4 |
| Cost tracking panel | Token usage by model, session, and time period. Running total with burn rate. Per-tool cost breakdown. | OBS-4 |

### Power User Features

| Feature | Description | Source spec |
|---------|-------------|-------------|
| Query builder | Filter events by arbitrary field paths (e.g. `data.tool_name = 'Bash'` AND `type = 'hook.post_tool_use_failure'`). | OBS-4 |
| Prompt replay | Click an event to see the exact prompt/response that triggered it. | OBS-4 |
| Dashboard persistence | Save panel layouts, filter presets, and time ranges to localStorage or server. Restore on reload. | OBS-4 |

## Verification

1. EngagePipeline renders correct Gantt bars from SubagentStart/Stop events
2. Agent swim lanes show parallelism correctly when multiple agents run concurrently
3. Multi-session view handles 2+ concurrent sessions without cross-contamination
4. Cost tracking aggregates correctly across model types
5. Query builder filters produce correct results
