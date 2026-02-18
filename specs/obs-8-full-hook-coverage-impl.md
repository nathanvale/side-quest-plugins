# Plan: OBS-8 Full Hook Coverage (14 Events)

## Task Description
Expand the observability plugin from 5 v1 hook events to all 14 Claude Code hook events. This requires changes across two repos: `side-quest-plugins` (hooks.json registration) and `side-quest-observability` (server enrichment handlers). The plan is split into two phases per reviewer recommendation: PR-A ships hooks.json expansion (raw passthrough works immediately via existing fallback), PR-B adds server-side enrichment handlers with tests.

## Objective
All 14 Claude Code hook events flow through the observability pipeline with normalised, camelCased, truncated payloads in EventEnvelope format. This unblocks per-agent voice (OBS-11), EngagePipeline Gantt (OBS-10), and HITL (OBS-14).

## Scope Guard (Non-Breaking)
- OBS-8 covers hook capture, server enrichment, and tests only.
- OBS-8 does **not** change `EventEnvelope` shape or required fields.
- Keep existing `correlationId` contract unchanged across server/client/types/tests.
- Any future correlation hierarchy migration (`sessionCid` / `cid` / `parentCid`) is explicitly out of scope for OBS-8.

## Problem Statement
v1 ships with 5 hooks (SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, Stop). The remaining 9 events (SessionEnd, Notification, UserPromptSubmit, SubagentStart, SubagentStop, PreCompact, PermissionRequest, TeammateIdle, TaskCompleted) are not captured. This leaves gaps in session lifecycle visibility, agent dispatch tracking, and permission flow auditing.

## Solution Approach
1. **PR-A (plugins repo):** Add 9 new hook registrations to `hooks.json`, all async with 5s timeout. The existing `emit-event.ts` dumb pipe handles any event name -- no changes needed. The server's `extractEventFields()` default case passes raw payload through, so events flow immediately.
2. **PR-B (server repo):** Add 9 entries to `EVENT_NAME_MAP` and 9 cases to `extractEventFields()`. Add table-driven enrichment tests. Events get normalised payloads.

## Relevant Files
Use these files to complete the task:

**side-quest-plugins repo** (`/Users/nathanvale/code/side-quest-plugins/`):
- `plugins/observability/hooks/hooks.json` -- Add 9 new hook registrations (PR-A)
- `plugins/observability/hooks/emit-event.ts` -- No changes needed, read for context only
- `plugins/claude-code/skills/hooks/references/event-reference.md` -- Source of truth for stdin field names

**side-quest-observability repo** (`/Users/nathanvale/code/side-quest-observability/`):
- `packages/server/src/server.ts` -- Add EVENT_NAME_MAP entries (lines 80-86) and extractEventFields cases (lines 273-326) (PR-B)
- `packages/server/src/server.test.ts` -- Add table-driven enrichment tests (PR-B)
- `packages/server/src/types.ts` -- Already has all 14 ClaudeHookEvent members, read for context only

### New Files
- None. All changes are additions to existing files.

## Implementation Phases

### Phase 1: hooks.json Expansion (PR-A -- plugins repo)

Add 9 new hook registrations to `plugins/observability/hooks/hooks.json`. All new hooks are async with 5s timeout. The existing `emit-event.ts` dumb pipe and server fallback handle them immediately.

**Matcher values per event** (from event-reference.md):

| Event | Matcher | Notes |
|-------|---------|-------|
| SessionEnd | `*` | Matches any exit reason |
| Notification | `*` | Matches any notification type |
| UserPromptSubmit | (no matcher array) | No matcher support -- use flat hooks array |
| SubagentStart | `*` | Matches any agent type |
| SubagentStop | `*` | Matches any agent type |
| PreCompact | `*` | Matches any trigger |
| PermissionRequest | `*` | Matches any tool name |
| TeammateIdle | (no matcher array) | No documented matcher support |
| TaskCompleted | (no matcher array) | No documented matcher support |

**Important:** UserPromptSubmit, TeammateIdle, and TaskCompleted have no matcher support. Check the existing Stop hook pattern -- it uses `"matcher": "*"` even though Stop has "no matcher support" per docs. Use the same pattern for consistency.

### Phase 2: Server Enrichment Handlers (PR-B -- observability repo)

Add to `packages/server/src/server.ts`:

**EVENT_NAME_MAP additions** (9 entries after line 86):
```text
'session-end':       'hook.session_end'
'notification':      'hook.notification'
'user-prompt-submit': 'hook.user_prompt_submit'
'subagent-start':    'hook.subagent_start'
'subagent-stop':     'hook.subagent_stop'
'pre-compact':       'hook.pre_compact'
'permission-request': 'hook.permission_request'
'teammate-idle':     'hook.teammate_idle'
'task-completed':    'hook.task_completed'
```

**extractEventFields() switch cases** (9 cases before the default):

| Case | hookEvent | Extracted fields | Notes |
|------|-----------|-----------------|-------|
| `session-end` | `session_end` | `sessionId`, `reason` | |
| `notification` | `notification` | `sessionId`, `message`, `title`, `notificationType` | |
| `user-prompt-submit` | `user_prompt_submit` | `sessionId`, `prompt` (truncated) | Prompt can be large |
| `subagent-start` | `subagent_start` | `sessionId`, `agentId`, `agentType` | |
| `subagent-stop` | `subagent_stop` | `sessionId`, `agentId`, `agentType`, `agentTranscriptPath` | `stop_hook_active` not stored (recursion guard only) |
| `pre-compact` | `pre_compact` | `sessionId`, `trigger` | `custom_instructions` dropped (large, low value) |
| `permission-request` | `permission_request` | `sessionId`, `toolName`, `toolInputPreview` (truncated) | `permission_suggestions` dropped (internal) |
| `teammate-idle` | `teammate_idle` | `sessionId` | No event-specific fields documented |
| `task-completed` | `task_completed` | `sessionId` | No event-specific fields documented |

**SubagentStop recursion guard:** Add guard before extractEventFields, matching the existing Stop pattern:
```typescript
if (eventName === 'subagent-stop' && raw.stop_hook_active === true) {
  return Response.json({ status: 'skipped', reason: 'stop_hook_active' }, { status: 200, headers: CORS_HEADERS })
}
```

### Phase 3: Enrichment Tests (PR-B -- observability repo)

Add table-driven enrichment tests to `packages/server/src/server.test.ts`:
- One fixture per event type (14 total -- 5 existing + 9 new)
- Each fixture provides realistic raw stdin and expected extracted fields
- Verify truncation on `user-prompt-submit` (prompt) and `permission-request` (tool_input)
- Verify `teammate-idle` and `task-completed` produce minimal `{ hookEvent, sessionId }` shape

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
  - Name: builder-hooks
  - Role: Add 9 hook registrations to hooks.json (PR-A, plugins repo)
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-hooks
  - Role: Verify hooks.json has all 14 events with correct structure
  - Agent Type: enterprise:validator-mccoy
  - Model: haiku
  - Resume: true

- Builder
  - Name: builder-server
  - Role: Add EVENT_NAME_MAP entries, extractEventFields cases, and SubagentStop guard (PR-B, observability repo)
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-tests
  - Role: Add table-driven enrichment tests for all 14 event types (PR-B, observability repo)
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-server
  - Role: Verify server changes compile, pass tests, and match the plan's field mapping
  - Agent Type: enterprise:validator-mccoy
  - Model: haiku
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. Add 9 Hook Registrations to hooks.json
- **Task ID**: add-hook-registrations
- **Depends On**: none
- **Assigned To**: builder-hooks
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read `plugins/observability/hooks/hooks.json` for the existing 5-hook pattern
- Add 9 new event blocks following the exact same structure as existing hooks
- All 9 new hooks must be `"async": true` with `"timeout": 5`
- Event names in command arg (kebab-case): `session-end`, `notification`, `user-prompt-submit`, `subagent-start`, `subagent-stop`, `pre-compact`, `permission-request`, `teammate-idle`, `task-completed`
- Hook event keys (PascalCase): `SessionEnd`, `Notification`, `UserPromptSubmit`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PermissionRequest`, `TeammateIdle`, `TaskCompleted`
- All use `"matcher": "*"` for consistency with existing Stop hook pattern
- Command template: `bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts <kebab-name>`

### 2. Validate hooks.json
- **Task ID**: validate-hook-registrations
- **Depends On**: add-hook-registrations
- **Assigned To**: validator-hooks
- **Agent Type**: enterprise:validator-mccoy
- **Model**: haiku
- **Parallel**: false
- Read `plugins/observability/hooks/hooks.json`
- Verify all 14 events are present (5 original + 9 new)
- Verify all 9 new hooks have `"async": true` and `"timeout": 5`
- Verify SessionStart and Stop remain sync (no `"async"` key or `"async": false`)
- Verify kebab-case event names in commands match PascalCase hook keys
- Verify JSON is valid (no trailing commas, correct nesting)

### 3. Add EVENT_NAME_MAP Entries and extractEventFields Cases
- **Task ID**: add-server-enrichment
- **Depends On**: none
- **Assigned To**: builder-server
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: true (with task 1)
- **Working directory**: `/Users/nathanvale/code/side-quest-observability/`
- Read `packages/server/src/server.ts` lines 80-86 (EVENT_NAME_MAP) and 273-326 (extractEventFields)
- Add 9 entries to EVENT_NAME_MAP after the existing 5
- Add 9 cases to extractEventFields switch before the default case
- Add SubagentStop recursion guard near line 590 (next to existing Stop guard)
- Field mappings MUST match the table in Phase 2 above exactly
- Use `truncateField()` for `user-prompt-submit` prompt and `permission-request` tool_input
- Include `permissionMode: raw.permission_mode` on all new cases (consistent with existing pattern)
- `teammate-idle` and `task-completed` return minimal `{ hookEvent, sessionId, permissionMode }`

### 4. Add Table-Driven Enrichment Tests
- **Task ID**: add-enrichment-tests
- **Depends On**: add-server-enrichment
- **Assigned To**: builder-tests
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- **Working directory**: `/Users/nathanvale/code/side-quest-observability/`
- Read `packages/server/src/server.test.ts` to understand existing test patterns
- Add a `describe('extractEventFields - all events')` block with table-driven tests
- Create one fixture per new event type (9 fixtures) with realistic raw stdin payloads
- Each fixture asserts the exact expected extracted fields
- Add specific tests for: truncation of large `prompt` and `tool_input`, SubagentStop `stop_hook_active` guard (skipped response), minimal shape for `teammate-idle` and `task-completed`
- Run `bun test` to verify all tests pass

### 5. Validate Server Changes
- **Task ID**: validate-server
- **Depends On**: add-enrichment-tests
- **Assigned To**: validator-server
- **Agent Type**: enterprise:validator-mccoy
- **Model**: haiku
- **Parallel**: false
- **Working directory**: `/Users/nathanvale/code/side-quest-observability/`
- Run `bunx tsc --noEmit` -- verify no type errors
- Run `bun test` -- verify all tests pass
- Read `packages/server/src/server.ts` and verify:
  - EVENT_NAME_MAP has exactly 14 entries (5 original + 9 new)
  - extractEventFields has exactly 14 cases + default (5 original + 9 new)
  - SubagentStop recursion guard exists
  - Field names match the plan's Phase 2 table
- Run `bunx biome ci .` -- verify lint passes

### 6. Final Validation
- **Task ID**: validate-all
- **Depends On**: validate-hook-registrations, validate-server
- **Assigned To**: validator-hooks
- **Agent Type**: enterprise:validator-mccoy
- **Model**: haiku
- **Parallel**: false
- Cross-repo consistency check:
  - Each kebab-case name in hooks.json commands has a matching EVENT_NAME_MAP entry
  - Each EVENT_NAME_MAP entry has a matching extractEventFields case
  - 14 hooks in hooks.json = 14 EVENT_NAME_MAP entries = 14 extractEventFields cases + default
- Report PASS/FAIL with details

## Acceptance Criteria
- `plugins/observability/hooks/hooks.json` registers all 14 Claude Code hook events
- All 9 new hooks are async with 5s timeout
- SessionStart and Stop remain sync (unchanged)
- `EVENT_NAME_MAP` has 14 entries mapping kebab-case to EventType
- `extractEventFields()` has 14 cases + default fallback
- SubagentStop recursion guard prevents infinite loops when `stop_hook_active` is true
- `user-prompt-submit` prompt and `permission-request` tool_input are truncated via `truncateField()`
- Table-driven enrichment tests cover all 9 new event types
- `bun test` passes in the observability repo
- `bunx tsc --noEmit` passes in the observability repo
- `bunx biome ci .` passes in the observability repo
- No `EventEnvelope` schema migration in OBS-8 (`correlationId` remains unchanged)

## Validation Commands
- `bun test` -- run all tests (observability repo)
- `bunx tsc --noEmit` -- verify no type errors (observability repo)
- `bunx biome ci .` -- lint and format check (observability repo)

## Notes
- **Pre-existing v1 bug:** The current `extractEventFields` reads `raw.tool_result` for PostToolUse, but `event-reference.md` documents the field as `tool_response`. Similarly, PostToolUseFailure reads `raw.tool_error` but docs say `error`. This is out of scope for OBS-8 but should be tracked.
- **TeammateIdle and TaskCompleted** are not in the official 12-event reference doc. They appear in the `ClaudeHookEvent` type union. Treat them as forward-declared -- extract sessionId only with raw passthrough.
- **Phasing:** PR-A (hooks.json) can ship independently. The server's default fallback handles unknown events gracefully. PR-B (server enrichment) follows when handlers are validated.
- **Schema stability:** Keep envelope compatibility in this phase. Do not introduce `sessionCid`/`cid`/`parentCid` in OBS-8.
- **No emit-event.ts changes needed.** The dumb pipe accepts any event name from argv[2] and POSTs it as-is.
