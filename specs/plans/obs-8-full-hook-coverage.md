# OBS-8: Full Hook Coverage (14 Events)

## Status: Planning (revised per review)

## Goal

Expand from 5 v1 hook events to all 14 Claude Code hook events. This is the keystone that unblocks per-agent voice (OBS-11), EngagePipeline Gantt (OBS-10), and HITL (OBS-14).

## Context

v1 ships with 5 hooks: SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, Stop. The remaining 9 events need server-side enrichment handlers and hooks.json registrations.

## Review findings addressed

The Codex review (specs/reviews/obs-8-full-hook-coverage-review.md) flagged:

1. **Field names were wrong** -- Fixed below using actual Claude Code hook stdin schemas from `plugins/claude-code/skills/hooks/references/event-reference.md`
2. **Three-tier CID is scope creep** -- Removed from this plan. `correlationId` stays as-is. CID migration deferred to a future plan when a concrete consumer needs it.
3. **Item 4 already done** -- Dropped. `types.ts` already defines all 14 ClaudeHookEvent members.
4. **Async policy incomplete** -- Added explicit per-event sync/async matrix with rationale.

## Depends on

Nothing - this unblocks everything else.

## Items

### 1. Server enrichment handlers for 9 new events

**Repo:** side-quest-observability
**File:** `packages/server/src/server.ts`

Add `extractEventFields()` cases and `EVENT_NAME_MAP` entries for:

| Event | EventType | Key stdin fields | Extracted data fields |
|-------|-----------|-----------------|----------------------|
| SessionEnd | `hook.session_end` | `reason` | `sessionId`, `reason` |
| Notification | `hook.notification` | `message`, `title`, `notification_type` | `sessionId`, `message`, `title`, `notificationType` |
| UserPromptSubmit | `hook.user_prompt_submit` | `prompt` | `sessionId`, `prompt` (truncated) |
| SubagentStart | `hook.subagent_start` | `agent_id`, `agent_type` | `sessionId`, `agentId`, `agentType` |
| SubagentStop | `hook.subagent_stop` | `agent_id`, `agent_type`, `agent_transcript_path`, `stop_hook_active` | `sessionId`, `agentId`, `agentType`, `agentTranscriptPath` |
| PreCompact | `hook.pre_compact` | `trigger`, `custom_instructions` | `sessionId`, `trigger` |
| PermissionRequest | `hook.permission_request` | `tool_name`, `tool_input`, `permission_suggestions` | `sessionId`, `toolName`, `toolInputPreview` (truncated) |
| TeammateIdle | `hook.teammate_idle` | (common fields only) | `sessionId` |
| TaskCompleted | `hook.task_completed` | (common fields only) | `sessionId` |

**Notes:**
- Field names validated against `plugins/claude-code/skills/hooks/references/event-reference.md`
- `UserPromptSubmit.prompt` and `PermissionRequest.tool_input` are truncated via `truncateField()` (can be large)
- `SubagentStop.stop_hook_active` is used for the recursion guard, not stored in data
- `TeammateIdle` and `TaskCompleted` have no documented event-specific fields beyond the common set -- extract `sessionId` only, with forward-compatible `raw` passthrough in case fields are added later

### 2. Plugin hooks.json expansion

**Repo:** side-quest-plugins
**File:** `plugins/observability/hooks/hooks.json`

Add 9 new hook registrations.

#### Sync/async matrix

| Event | Sync/Async | Timeout | Rationale |
|-------|-----------|---------|-----------|
| SessionEnd | async | 5s | Non-blocking terminal event. No decision control. |
| Notification | async | 5s | Non-blocking. Cannot modify notifications. |
| UserPromptSubmit | async | 5s | CAN block (exit 2 erases prompt) but our hook exits 0 always -- safe to async. |
| SubagentStart | async | 5s | Non-blocking. Cannot block subagent creation. High frequency during agent dispatches. |
| SubagentStop | async | 5s | CAN block (prevents subagent stopping) but our hook exits 0 always -- safe to async. High frequency. |
| PreCompact | async | 5s | Non-blocking. Cannot block compaction. |
| PermissionRequest | async | 5s | CAN block (denies permission) but our hook exits 0 always -- safe to async. Sync would delay the permission dialog. |
| TeammateIdle | async | 5s | Non-blocking terminal event. |
| TaskCompleted | async | 5s | Non-blocking terminal event. |

**Key insight:** All 9 new hooks should be `async: true`. Our `emit-event.ts` always exits 0 (never uses exit code 2 or decision JSON). Sync is only needed when the hook's response timing matters (SessionStart captures context before first tool call; Stop ensures final event reaches server before process exits). None of the 9 new events have that constraint for a fire-and-forget observability pipe.

### 3. EVENT_NAME_MAP expansion

While `mapEventName()` has a fallback (`hook.${name.replace(/-/g, '_')}`), explicit entries add readability and typo resistance. Add all 9 to the map.

## What's NOT in this plan

- **Three-tier correlation IDs** -- Removed per review. `correlationId` stays as-is. No schema migration needed. Deferred until a concrete consumer (EngagePipeline Gantt, OTel export) requires `sessionCid`/`cid`/`parentCid`.
- **EventType union expansion** -- Already done in v1. `types.ts` already has all 14 members.
- **Rich SubagentStop transcript extraction** -- Deferred to OBS-11 (McCoy verdict routing).
- **Model extraction from transcripts** -- Deferred. v1 relies on `model` field in SessionStart.

## Phasing (recommended by reviewer)

This plan can be implemented in two sub-PRs if desired:

**PR-A: hooks.json expansion + raw passthrough**
- Add 9 hooks.json entries (all async, 5s timeout)
- No server changes needed -- existing `mapEventName()` fallback and `extractEventFields()` default case handle unknown events gracefully
- Events flow immediately but with raw payloads in `data`

**PR-B: Server enrichment handlers**
- Add 9 `EVENT_NAME_MAP` entries
- Add 9 `extractEventFields()` switch cases
- Add enrichment tests (table-driven, one fixture per event type)
- Events get normalized, camelCased, truncated payloads

PR-A can ship and soak independently. PR-B follows when enrichment handlers are validated.

## Verification

1. Start server, trigger each new event type via curl with realistic payloads
2. Verify enrichment produces correct EventEnvelope for each (field names match, truncation works)
3. `bun test --recursive` - all tests pass (add table-driven enrichment tests)
4. Enable expanded hooks in Claude Code, verify SubagentStart/Stop fire during agent dispatches
5. Verify PermissionRequest hook (async) doesn't delay the permission dialog
6. Verify no regressions on existing 5 event types
