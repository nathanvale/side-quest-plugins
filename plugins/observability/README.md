# Observability

Real-time observability for Claude Code sessions. Streams lifecycle events (session start, tool use, tool failure, session stop) to the `@side-quest/observability` server via fire-and-forget HTTP POSTs. The hook is a dumb pipe -- all event enrichment happens server-side.

## Install

```bash
/plugin install observability@side-quest
```

## How It Works

A single TypeScript hook (`emit-event.ts`) handles all 5 lifecycle events. On each event, it:

1. Reads the JSON payload from stdin
2. Discovers the observability server port from `~/.cache/side-quest-observability/events.port`
3. POSTs the raw JSON to `http://127.0.0.1:<port>/events/<event-name>`
4. Exits (500ms network timeout, 4.5s self-destruct timer)

If the server is not running, the hook fails silently. It never blocks Claude Code.

### Lifecycle Events

| Event | Sync/Async | When |
|-------|-----------|------|
| `session-start` | sync | Session begins |
| `pre-tool-use` | async | Before any tool executes |
| `post-tool-use` | async | After any tool executes |
| `post-tool-use-failure` | async | After a tool fails |
| `stop` | sync | Session ends |

### Environment Variables

| Variable | Effect |
|----------|--------|
| `SIDE_QUEST_EVENTS=0` | Kill switch -- disables all event emission |
| `SIDE_QUEST_HOOK_DEBUG=1` | Logs network errors to stderr |

## Requirements

- **Bun runtime** -- hooks run via `bun run`
- **@side-quest/observability server** -- must be running and writing its port to `~/.cache/side-quest-observability/events.port`

## Limitations

- Fire-and-forget only -- no delivery guarantees, no retry, no buffering
- Server discovery via port file -- if the file is stale or missing, events are silently dropped
- 1MB payload cap -- events larger than 1MB are dropped (OOM protection)
