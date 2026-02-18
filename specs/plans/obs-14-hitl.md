# OBS-14: Human-in-the-Loop (HITL)

## Status: Planning

## Goal

Enable the dashboard to respond to agent permission requests - approve/deny tool use directly from the observability UI instead of the terminal.

## Context

This is the most complex feature in the observability roadmap. It requires bidirectional communication: the hook creates an ephemeral WebSocket server, the dashboard sends responses back through the event server. The architecture is documented in disler's [how_human_in_the_loop_v1_works.md](https://github.com/disler/claude-code-hooks-multi-agent-observability/blob/main/app_docs/how_human_in_the_loop_v1_works.md).

## Depends on

- OBS-8 (Full Hook Coverage) - `hook.permission_request` events must be flowing
- OBS-10 (Dashboard Advanced) - dashboard should be stable in daily use before adding bidirectional interaction

## Items

### Hook-Side Ephemeral WS Server

**Repo:** side-quest-plugins
**File:** `plugins/observability/hooks/emit-event.ts` (or new `hitl-hook.ts`)

1. Hook creates an ephemeral `Bun.serve()` WebSocket server on port 0 (OS-assigned)
2. Hook POSTs event to observability server with `hitl: { question, responseWsUrl, type, choices?, timeout? }`
3. Hook awaits response on its ephemeral WS (futures map keyed by `permission_type`)
4. Default timeout: 300s via `withTimeout()` from `@side-quest/core/concurrency`

### Server-Side HITL Relay

**Repo:** side-quest-observability
**File:** `packages/server/src/server.ts`

- Store `hitl` metadata alongside the event
- Expose `POST /hitl/respond` endpoint that opens WebSocket to the hook's `responseWsUrl` and sends the response
- Track pending HITL requests with expiration

### Dashboard Permission UI

**Repo:** side-quest-observability
**File:** `packages/client/src/components/HitlPrompt.vue`

- Render approve/deny buttons when a `hook.permission_request` event arrives with `hitl` metadata
- Show the question, tool name, and any choices
- Send response via `POST /hitl/respond`
- Visual timeout countdown

### Source Field Widening

May need to widen the `source` field from `'cli' | 'hook'` to include `'dashboard'` for HITL response events.

## Verification

1. Permission request event arrives at dashboard with approve/deny UI
2. Clicking "Approve" sends response back to the hook within 1s
3. Hook receives response and returns approval to Claude Code
4. Timeout after 300s returns a timeout response to the hook
5. Multiple concurrent permission requests are handled independently (futures map)
6. Ephemeral WS server cleans up after response or timeout
