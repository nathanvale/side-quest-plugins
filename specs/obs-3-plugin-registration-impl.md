# Plan: OBS-3 Observability Plugin Registration

## Task Description

Create the `plugins/observability/` plugin in the `side-quest-plugins` repo with a fully self-contained hook script. 3 files, zero external dependencies. The hook reads stdin, POSTs raw JSON to the observability server, and exits. All event enrichment lives server-side (OBS-1).

## Objective

A working observability plugin that captures 5 v1 Claude Code hook events (SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, Stop) and streams them to the `@side-quest/observability` server. Zero npm dependencies, marketplace-compatible.

## Problem Statement

Claude Code needs hooks registered to emit lifecycle events. The observability server (OBS-1) is ready to receive events at `POST /events/:eventName`, but nothing is sending them. The plugin bridges this gap with a self-contained hook script.

## Solution Approach

Three files in `plugins/observability/`:
1. `plugin.json` -- plugin registration (2 fields)
2. `hooks/hooks.json` -- 5 v1 hook registrations using `bun run`
3. `hooks/emit-event.ts` -- self-contained dumb pipe (~50 lines, zero deps)

The hook does three things: read stdin, POST raw JSON to server, exit 0. The server does everything else.

## Relevant Files

Use these files to complete the task:

- `specs/plans/obs-3-plugin-registration.md` -- full detailed plan (source of truth)
- `plugins/enterprise/hooks/captains-log.ts` -- proven stdin pattern (`readFileSync('/dev/stdin')`)
- `plugins/enterprise/hooks/hooks.json` -- hook registration format reference
- `plugins/enterprise/plugin.json` -- plugin.json format reference
- `plugins/git/hooks/event-bus-client.ts` -- production emitter pattern (fire-and-forget, AbortController)

### New Files

```
plugins/observability/
  plugin.json                    -- { name, description }
  hooks/
    hooks.json                   -- 5 v1 hook registrations
    emit-event.ts                -- self-contained dumb pipe (~50 lines)
```

## Implementation Phases

### Phase 1: Foundation

Create the plugin directory structure.

### Phase 2: Core Implementation

1. **`plugin.json`**:
```json
{
  "name": "observability",
  "description": "Real-time agent observability -- streams Claude Code lifecycle events to @side-quest/observability server"
}
```

2. **`hooks/hooks.json`**: 5 registrations per spec:
   - SessionStart (sync, timeout 5s)
   - PreToolUse (async, timeout 5s)
   - PostToolUse (async, timeout 5s)
   - PostToolUseFailure (async, timeout 5s)
   - Stop (sync, timeout 5s)
   - All use `*` matchers (generic plugin, captures all events)
   - All use `bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts <event-name>`

3. **`hooks/emit-event.ts`**: Self-contained ~50 lines:
   - Self-destruct timer (4.5s) -- MUST be first executable line
   - Kill switch: `SIDE_QUEST_EVENTS=0`
   - Read stdin via `readFileSync('/dev/stdin', 'utf-8')`
   - OOM protection: reject > 1MB before JSON.parse
   - Validate JSON (don't send garbage to server)
   - Discover server port from `~/.cache/side-quest-observability/events.port`
   - POST raw stdin to `http://127.0.0.1:{port}/events/{eventName}`
   - 500ms AbortController timeout on fetch
   - Debug logging gated on `SIDE_QUEST_HOOK_DEBUG=1`
   - Always exit 0 (never blocks Claude Code)

### Phase 3: Integration & Polish -- Testing

Follow the testing strategy from `specs/plans/obs-3-plugin-registration.md`:

**Phase 1: Static Validation**
- Verify hooks.json is valid JSON
- Verify emit-event.ts runs without dependency errors

**Phase 2: Plugin Hook Execution Verification**
- Verify plugin discovery in Claude Code debug mode
- Verify SessionStart fires (synchronous)
- Verify PreToolUse/PostToolUse fire (async)
- Verify Stop fires (synchronous)

**Phase 3: Integration Tests**
- Coexistence with captains-log.ts
- Graceful degradation (server down)
- Self-destruct timer works
- Async hooks don't block tool calls

**Phase 4: Performance Baseline**
- Warm path (server running): < 100ms
- Cold path (server down): < 50ms

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. Use Task and Task* tools only.
- Take note of the session id (agentId) of each team member for resume operations.

### Model Selection Guide

| Role | Model | Rationale |
|------|-------|-----------|
| All builders | sonnet | Executes well-specified tasks reliably |
| All validators | opus | Semantic code review requires strongest reasoning for edge cases, convention violations, and logic errors |

### Team Members

- Builder
  - Name: builder-plugin
  - Role: Create 3-file observability plugin with self-contained hook
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-plugin
  - Role: Verify plugin files, hook execution, coexistence
  - Agent Type: enterprise:validator-mccoy
  - Model: opus
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. Create Plugin Files
- **Task ID**: create-plugin
- **Depends On**: none (assumes OBS-1 server is complete)
- **Assigned To**: builder-plugin
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read `specs/plans/obs-3-plugin-registration.md` as source of truth
- Read `plugins/enterprise/hooks/captains-log.ts` for stdin pattern reference
- Read `plugins/git/hooks/event-bus-client.ts` for emitter pattern reference
- Create `plugins/observability/plugin.json`
- Create `plugins/observability/hooks/hooks.json` with 5 v1 registrations
- Create `plugins/observability/hooks/emit-event.ts` (~50 lines, zero deps)
- Static validation: `python3 -m json.tool < hooks.json > /dev/null`
- Verify: `echo '{}' | bun run emit-event.ts 2>/dev/null; echo $?` exits 0

### 2. Validate Plugin
- **Task ID**: validate-plugin
- **Depends On**: create-plugin
- **Assigned To**: validator-plugin
- **Agent Type**: enterprise:validator-mccoy
- **Model**: opus
- **Parallel**: false
- hooks.json is valid JSON
- emit-event.ts has zero `import` statements from external packages (only node:fs, node:path, node:os)
- emit-event.ts exits 0 when run with empty stdin
- emit-event.ts exits 0 when port file is missing (graceful degradation)
- Self-destruct timer is first executable line after shebang
- All 5 hook registrations use `bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts`
- SessionStart and Stop have `"async": false` (or no async field)
- PreToolUse, PostToolUse, PostToolUseFailure have `"async": true`
- All matchers are `"*"`
- No `node_modules` directory in plugins/observability/
- Enterprise captains-log.ts is completely unchanged

## Acceptance Criteria

1. `plugins/observability/plugin.json` exists with name + description
2. `plugins/observability/hooks/hooks.json` has 5 v1 hook registrations
3. `plugins/observability/hooks/emit-event.ts` is ~50 lines with zero external dependencies
4. emit-event.ts reads stdin, POSTs to `/events/:eventName`, exits 0
5. emit-event.ts has self-destruct timer at 4.5s
6. emit-event.ts has 1MB stdin size cap
7. emit-event.ts has `SIDE_QUEST_EVENTS=0` kill switch
8. PreToolUse/PostToolUse/PostToolUseFailure are async; SessionStart/Stop are sync
9. All matchers are `*` (generic plugin)
10. Enterprise captains-log.ts is completely unchanged
11. No node_modules in the plugin directory

## Validation Commands

- `python3 -m json.tool < plugins/observability/hooks/hooks.json > /dev/null` -- valid JSON
- `echo '{}' | bun run plugins/observability/hooks/emit-event.ts 2>/dev/null; echo $?` -- exits 0

## Notes

- This plugin lives in `side-quest-plugins` repo (not `side-quest-observability`).
- The hook is marketplace-compatible -- zero dependency resolution needed.
- Adding a new event type requires only: (1) add a hooks.json entry, (2) add a server enrichment case. Zero changes to emit-event.ts.
- Known framework issues documented in spec: hooks may not fire in VS Code (#18547), hooks may stop after 2.5 hours (#16047). These are Claude Code framework issues, not plugin bugs.
- Fallback: if plugin hooks don't fire, a setup command can inject into `~/.claude/settings.json` (v1.1).
