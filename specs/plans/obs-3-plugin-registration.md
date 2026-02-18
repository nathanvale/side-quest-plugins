# Observability Plugin Registration (Domain 3 of 6) -- Revised v3 (Self-Contained Hook)

## Status: Completed (v1)

## Overview

This domain creates the `plugins/observability/` plugin directory with a fully self-contained hook script. **Zero external dependencies** -- the hook reads stdin, POSTs raw JSON to the server, and exits. All event enrichment lives server-side (OBS-1).

**Revision v3 summary (dumb hook, smart server):**
- **`emit-event.ts` is fully self-contained (~40 lines)** -- no `@side-quest/observability` import, no `@side-quest/core`, no npm dependency
- **Marketplace-compatible** -- zero dependency resolution needed, works in any plugin installation context
- **POSTs raw stdin to `POST /events/:eventName`** -- server handles type mapping, payload extraction, envelope generation
- Carries forward all v2 additions: verification checklist, known framework issues, `bun run` pattern

Previous revisions:
- v2: Switched from `bunx` to `bun run` with local wrapper (still imported from `@side-quest/observability/cli`)
- v1: Cut from 14 to 5 hooks, added `async: true`, aligned with OBS-2

## Prerequisites

- Domain 1 (Event Server) must implement `POST /events/:eventName` route (server-side enrichment)
- Domain 2 (Hook CLI) is **no longer a prerequisite** -- hook is self-contained, doesn't import from OBS-2
- No npm publishing or workspace linking required

---

## File Tree

```
plugins/observability/
  plugin.json                    -- Plugin registration (2 fields)
  hooks/
    hooks.json                   -- 5 v1 hook registrations
    emit-event.ts                -- Self-contained: reads stdin, POSTs to server, exits (~40 lines)
```

**3 files total. Zero external dependencies.** The hook is a dumb pipe -- all intelligence lives in the server.

---

## File 1: `plugins/observability/plugin.json`

```json
{
  "name": "observability",
  "description": "Real-time agent observability -- streams Claude Code lifecycle events to @side-quest/observability server"
}
```

**Conventions followed:**
- `name`: lowercase, matches directory name (same as `enterprise`, `newsroom`)
- `description`: aligned with OBS-2's finalized scaffold wording
- No `skills`, `agents`, or `commands` fields -- this is a hooks-only plugin
- No `hooks` field needed -- Claude Code discovers `hooks/hooks.json` by convention (verified empirically: git plugin has no `hooks` field in plugin.json, yet `command-logger` has 13,519 log entries)

---

## File 2: `plugins/observability/hooks/hooks.json`

```json
{
  "description": "Real-time observability -- streams Claude Code lifecycle events to @side-quest/observability server",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts session-start",
            "timeout": 5
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts pre-tool-use",
            "timeout": 5,
            "async": true
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts post-tool-use",
            "timeout": 5,
            "async": true
          }
        ]
      }
    ],
    "PostToolUseFailure": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts post-tool-use-failure",
            "timeout": 5,
            "async": true
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts stop",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

---

## File 3: `plugins/observability/hooks/emit-event.ts`

Fully self-contained. Reads stdin, discovers the server port, POSTs raw JSON, exits. Zero external dependencies -- uses only Bun globals and Node.js built-ins.

```typescript
#!/usr/bin/env bun

/**
 * Observability hook -- dumb pipe.
 *
 * Reads Claude Code's stdin JSON, POSTs it raw to the observability server,
 * and exits. All event enrichment (type mapping, payload extraction, envelope
 * generation) happens server-side.
 *
 * Zero external dependencies. Marketplace-compatible.
 */

// Self-destruct timer: MUST be first executable line.
// Claude Code may not enforce timeouts on async hooks (issue #25700).
const selfDestruct = setTimeout(() => process.exit(0), 4500)

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const PORT_FILE = join(homedir(), '.cache', 'side-quest-observability', 'events.port')
const TIMEOUT_MS = 500
const DEBUG = process.env.SIDE_QUEST_HOOK_DEBUG === '1'

async function main(): Promise<void> {
  // Kill switch
  if (process.env.SIDE_QUEST_EVENTS === '0') return

  const eventName = process.argv[2]
  if (!eventName) return

  // Read stdin
  let stdin: string
  try {
    stdin = readFileSync('/dev/stdin', 'utf-8')
  } catch {
    return
  }

  // OOM protection: reject > 1MB before JSON.parse
  if (stdin.length > 1_000_000) return

  // Validate JSON (don't send garbage to the server)
  try {
    JSON.parse(stdin)
  } catch {
    return
  }

  // Discover server
  if (!existsSync(PORT_FILE)) return
  const port = parseInt(readFileSync(PORT_FILE, 'utf-8').trim(), 10)
  if (Number.isNaN(port)) return

  // POST raw stdin to server -- server does all enrichment
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    await fetch(`http://127.0.0.1:${port}/events/${eventName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: stdin,
      signal: controller.signal,
    })
  } catch (err) {
    if (DEBUG) console.error(`[obs-hook] ${err}`)
  } finally {
    clearTimeout(timeout)
  }
}

main()
  .catch(() => {})
  .finally(() => {
    clearTimeout(selfDestruct)
    process.exit(0)
  })
```

**Key properties:**
- **~50 lines, zero dependencies** -- only `node:fs`, `node:path`, `node:os`, and Bun's `fetch`
- **POSTs to `/events/:eventName`** not `/events` -- the event name is in the URL path, not the payload
- **Sends raw stdin** -- no field extraction, no type mapping, no truncation
- **Server does everything** -- type mapping, payload enrichment, envelope generation, stop guard
- **Marketplace-compatible** -- no `node_modules` needed, no `@side-quest/observability` import

**Comparison with previous approaches:**

| Concern | v1 (`bunx`) | v2 (`bun run` + import) | v3 (self-contained) |
|---------|------------|------------------------|-------------------|
| External deps | `@side-quest/observability` via npm | `@side-quest/observability` via workspace | **None** |
| npm publishing | Required | Not required (workspace link) | **Not required** |
| Marketplace-compatible | No (no dep resolution) | No (needs workspace) | **Yes** |
| Hook complexity | ~3 files, 200+ lines | ~1 file, 15 lines + imported dispatch | **~1 file, 50 lines** |
| Where enrichment lives | Hook (dispatch.ts) | Hook (dispatch.ts) | **Server** |

---

## Hook Event Coverage Table (v1)

| # | Event | Matcher | Arg to emit-event.ts | Timeout | Async | Notes |
|---|-------|---------|---------------------|---------|-------|-------|
| 1 | SessionStart | `*` | `session-start` | 5s | no | Model, agent_type, source. Synchronous to ensure session context captured before tool calls. |
| 2 | PreToolUse | `*` | `pre-tool-use` | 5s | yes | Tool name, input size. Fire-and-forget -- no ordering requirement. |
| 3 | PostToolUse | `*` | `post-tool-use` | 5s | yes | Tool result, duration. Fire-and-forget -- no ordering requirement. |
| 4 | PostToolUseFailure | `*` | `post-tool-use-failure` | 5s | yes | Error tracking. Fire-and-forget -- no ordering requirement. |
| 5 | Stop | `*` | `stop` | 5s | no | Session end summary. Synchronous to ensure final event reaches server before process exits. |

### v2 Events (deferred -- added when OBS-2 v2 ships handlers)

| Event | Blocked by |
|-------|-----------|
| SessionEnd | OBS-1 PR2 server enrichment handler |
| Notification | OBS-1 PR2 server enrichment handler |
| UserPromptSubmit | OBS-1 PR2 server enrichment handler |
| SubagentStart | OBS-1 PR2 server enrichment handler |
| SubagentStop | OBS-1 PR2 server enrichment handler |
| PreCompact | OBS-1 PR2 server enrichment handler |
| PermissionRequest | OBS-1 PR2 server enrichment handler + investigation (sync `*` matcher may delay permission prompts) |
| TeammateIdle | OBS-1 PR2 server enrichment handler |
| TaskCompleted | OBS-1 PR2 server enrichment handler |

---

## Design Decisions

### 1. Five hooks, not fourteen (C1 fix)

OBS-2 v1 ships exactly 5 CLI handlers: SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, Stop. The remaining 9 events are deferred to v2. Registering hooks for handlers that don't exist wastes startup budget on no-ops and advertises a contract that doesn't exist yet.

### 2. All matchers are `*`

Observability is a standalone plugin that captures events from ALL plugins -- enterprise officers, newsroom reporters, git hooks, built-in agents, and any future agents. Plugin-specific filtering happens in the dashboard, not at the hook registration level.

### 3. Timeout of 5s

The observability hooks are fire-and-forget POST requests to a local HTTP server. The hook reads stdin, builds an event envelope, and POSTs to `http://127.0.0.1:{port}/events` with a 500ms timeout. `bun run` startup is ~5-10ms (no npm resolution). POST completes in <100ms. Compare to enterprise's `captains-log.ts` which needs 15s because it parses the full transcript JSONL.

### 4. `async: true` on PreToolUse, PostToolUse, PostToolUseFailure

These three hooks fire on every tool invocation. With `async: true`, they run in the background without blocking Claude Code. This eliminates the synchronous latency tax on tool calls. Observability telemetry has no ordering requirement -- the server timestamps events on arrival.

SessionStart and Stop remain synchronous:
- **SessionStart**: Ensures session context (model, agent_type) is captured before any tool calls fire
- **Stop**: Ensures the final summary event reaches the server before the process exits

**Windows note:** Synchronous hooks can hang indefinitely on Windows ([#9542](https://github.com/anthropics/claude-code/issues/9542), [claude-plugins-official#351](https://github.com/anthropics/claude-plugins-official/issues/351)). If Windows support is needed, consider making ALL hooks async and accepting that SessionStart context may arrive slightly late. For now (macOS-only), synchronous SessionStart and Stop are correct.

### 5. `bun run` execution model (changed from `bunx`)

Local script (`emit-event.ts`) delegates to the installed `@side-quest/observability` package. This follows the pattern used by every other plugin in this repo:

```
git:            bun run ${CLAUDE_PLUGIN_ROOT}/hooks/git-safety.ts
enterprise:     bun run ${CLAUDE_PLUGIN_ROOT}/hooks/captains-log.ts
biome-runner:   bun run ${CLAUDE_PLUGIN_ROOT}/hooks/biome-check.ts
bun-runner:     bun run ${CLAUDE_PLUGIN_ROOT}/hooks/bun-test.ts
tsc-runner:     bun run ${CLAUDE_PLUGIN_ROOT}/hooks/tsc-check.ts
observability:  bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts   <-- same pattern
```

**Why the switch from `bunx`:**
- Community research found widespread bunx cache corruption issues (oven-sh/bun#24695, #12245, #6237)
- bunx cold-start variance (15ms warm, 500ms-3s cold) is unpredictable at 400+ invocations/session
- `bunx` requires npm publishing (`"private": false`) -- a prerequisite we can eliminate
- Every other plugin in the repo already uses `bun run` -- consistency matters

### 6. `stop_hook_active` recursion guard

The Stop hook handler in `@side-quest/observability` (OBS-2 deliverable) must check `input.stop_hook_active` and exit early if true. This matches the pattern in enterprise's `captains-log.ts`:

```typescript
if (input.stop_hook_active) {
  process.exit(0)
}
```

This prevents infinite recursion if the Stop hook triggers further session activity.

---

## Hook Execution Model (from Claude Code docs)

Key behaviors that inform this design:

- **Hooks run in parallel across plugins.** When both `observability` and `enterprise` are enabled, their Stop hooks fire concurrently. Worst-case latency is `max(5s, 15s) = 15s`, not `sum(5s + 15s) = 20s`.
- **Exit code semantics:** Exit 0 = success. Exit 2 = blocking error (prevents tool execution for PreToolUse). Any other exit code = non-blocking error (stderr shown in verbose mode only, does not block Claude Code). This means a script resolution failure produces a non-blocking error, not a silent drop.
- **Convention-based hook discovery:** `hooks/hooks.json` is discovered automatically without an explicit `"hooks"` field in `plugin.json`. Verified empirically and confirmed by Claude Code documentation.
- **`async: true` behavior:** Async hooks run in the background. They cannot return `decision` or `permissionDecision` fields (those require synchronous hooks). This is exactly right for fire-and-forget observability telemetry.

---

## Known Framework Issues (from community research)

Issues discovered during pre-implementation research that affect the observability plugin design.

| Issue | Impact | Severity | Mitigation |
|-------|--------|----------|------------|
| [#16047](https://github.com/anthropics/claude-code/issues/16047) -- Hooks stop firing after ~2.5 hours | Long sessions lose observability data silently | HIGH | Dashboard flags sessions with no events for >10min as "stale." No fix possible from plugin side. |
| [#10225](https://github.com/anthropics/claude-code/issues/10225), [#14410](https://github.com/anthropics/claude-code/issues/14410) -- Plugin hooks match but never execute | Hooks registered via `hooks/hooks.json` may silently not fire | HIGH | Empirical verification checklist (see below). Fallback: inject into `~/.claude/settings.json`. |
| [#18547](https://github.com/anthropics/claude-code/issues/18547) -- Plugin hooks don't fire in VS Code | VS Code extension ignores `hooks/hooks.json` from plugins | HIGH | Verify during testing. Fallback: setup command that writes to settings.json. |
| [#20211](https://github.com/anthropics/claude-code/issues/20211) -- Sandbox blocks /bin/sh (ENOENT) | `bun run` may fail if sandbox restricts shell access | HIGH | Document that observability requires sandbox to allow `/bin/sh`. |
| [#9542](https://github.com/anthropics/claude-code/issues/9542) -- Sync hooks hang on Windows | SessionStart and Stop hooks hang indefinitely | MEDIUM | macOS-only for v1. Windows: make all hooks async. |
| [#3465](https://github.com/anthropics/claude-code/issues/3465) -- Duplicate events from home directory | Hooks fire twice when CWD is `~` | MEDIUM | Server-side dedup by event ID (`crypto.randomUUID()` in envelope). |
| [#25700](https://github.com/anthropics/claude-code/issues/25700) -- Async hook timeout not enforced | 525 async hooks spawned, zero process terminations | HIGH | Self-destruct timer in emit-event.ts (4.5s). |
| [#9447](https://github.com/anthropics/claude-code/issues/9447) -- Env vars empty in plugin hooks | `$CLAUDE_PROJECT_DIR` etc. not populated | LOW | We use stdin JSON exclusively, not env vars. |
| Shell profile stdout corruption | `.bashrc`/`.zshrc` output breaks JSON parsing | MEDIUM | Two-layer error handling (parse failure -> exit 0). Document as troubleshooting item. |
| v2.1.23 async hook orphan fix | Pre-v2.1.23: async hooks orphaned on headless session end | LOW | Document minimum Claude Code version: v2.1.23+. |

---

## Coexistence with Enterprise's captains-log.ts

Claude Code merges hooks from ALL active plugins. When both `observability` and `enterprise` plugins are enabled, the Stop event fires TWO hooks in parallel:

1. `bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts stop` (from observability plugin) -- POSTs event to server
2. `bun run ${CLAUDE_PLUGIN_ROOT}/hooks/captains-log.ts` (from enterprise plugin) -- writes JSONL to cwd

No conflict because:
- They write to different destinations (HTTP server vs local JSONL files)
- They have different timeouts (5s vs 15s)
- They serve different purposes (real-time streaming vs retrospective log)
- They share the same `session_id` from stdin, enabling cross-correlation
- They run in parallel, neither blocks the other

**No changes to enterprise plugin needed.**

---

## Event-bus-client Relationship

The git plugin contains `plugins/git/hooks/event-bus-client.ts` -- a production-quality HTTP event emitter with port-file discovery, 500ms timeout, negative caching, and abort controller cleanup.

OBS-3's `emit-event.ts` is architecturally similar but simpler:
- **Same pattern:** port file discovery, AbortController timeout, fire-and-forget POST
- **Key difference:** `emit-event.ts` sends raw stdin to `/events/:eventName` (dumb pipe). `event-bus-client.ts` builds its own EventEnvelope and sends to `/events` (smart client).
- **No shared code:** Both are intentionally independent. The git plugin's client may optionally switch to the `/events/:eventName` route in the future (Stage 5g), which would simplify it to the same dumb-pipe model.

---

## Testing Strategy

### Phase 1: Static Validation

#### 1.1 Verify hooks.json is valid JSON

```bash
python3 -m json.tool < plugins/observability/hooks/hooks.json > /dev/null
```

#### 1.2 Verify emit-event.ts runs (no dependencies to resolve)

```bash
echo '{}' | bun run plugins/observability/hooks/emit-event.ts 2>/dev/null; echo "Exit: $?"
# Should exit 0 (no event name -> early exit)
# Should NOT fail with "Cannot find module" -- zero external imports
```

### Phase 2: Plugin Hook Execution Verification Checklist

**Why this matters:** Multiple Claude Code issues ([#10225](https://github.com/anthropics/claude-code/issues/10225), [#14410](https://github.com/anthropics/claude-code/issues/14410), [#11509](https://github.com/anthropics/claude-code/issues/11509), [#18547](https://github.com/anthropics/claude-code/issues/18547)) report plugin hooks that match but never execute. This checklist empirically verifies our hooks fire in all contexts before shipping.

#### 2.1 Verify plugin discovery

```bash
# Enable the observability plugin in Claude Code settings
# Start a new Claude Code session with --debug
claude --debug
# Look for log line: "Loading hooks from plugin: observability"
# Verify all 5 hook registrations appear in debug output
```

**PASS criteria:** Debug output shows observability plugin loaded with 5 hook registrations.
**FAIL action:** Check plugin.json format, hooks/hooks.json path, and `$CLAUDE_PLUGIN_ROOT` resolution.

#### 2.2 Verify SessionStart fires (synchronous)

```bash
# With observability server running:
bun run ~/code/side-quest-observability/packages/server/src/server.ts &

# Start Claude Code session
claude

# Check events arrived
curl http://127.0.0.1:$(cat ~/.cache/side-quest-observability/events.port)/events | jq '.[] | select(.type == "hook.session_start")'
```

**PASS criteria:** At least one `hook.session_start` event with valid `session_id`, `model`, and `source`.
**FAIL action:** Check [#11509](https://github.com/anthropics/claude-code/issues/11509) -- SessionStart from local plugins may not execute.

#### 2.3 Verify PreToolUse/PostToolUse fire (async)

```bash
# During an active Claude Code session, trigger a tool call (e.g., read a file)
# Then check events:
curl http://127.0.0.1:$(cat ~/.cache/side-quest-observability/events.port)/events | jq '[.[] | select(.type | startswith("hook.pre_tool") or startswith("hook.post_tool"))] | length'
```

**PASS criteria:** Event count > 0 for both `hook.pre_tool_use` and `hook.post_tool_use`.
**FAIL action:** Check [#10225](https://github.com/anthropics/claude-code/issues/10225) -- plugin hooks may match but not execute.

#### 2.4 Verify Stop fires (synchronous)

```bash
# Exit Claude Code session (Ctrl+C or /exit)
# Check for stop event:
curl http://127.0.0.1:$(cat ~/.cache/side-quest-observability/events.port)/events | jq '.[] | select(.type == "hook.stop")'
```

**PASS criteria:** Exactly one `hook.stop` event with matching `session_id`.
**FAIL action:** Check `stop_hook_active` guard -- if another Stop hook is active, ours skips.

#### 2.5 Verify hooks fire in VS Code extension

```bash
# Open VS Code with Claude Code extension
# Start a Claude Code session within VS Code
# Trigger a tool call
# Check events arrive at the server
```

**PASS criteria:** Events appear from VS Code session.
**FAIL action:** [#18547](https://github.com/anthropics/claude-code/issues/18547) -- VS Code may not load plugin hooks. Fallback: inject into `~/.claude/settings.json`.

#### 2.6 Verify hooks fire with isLocal: true (development)

```bash
# During local development, verify hooks fire when plugin is loaded locally
# Check debug output for hook execution
```

**PASS criteria:** Events arrive during local plugin development.
**FAIL action:** [#14410](https://github.com/anthropics/claude-code/issues/14410) -- local plugins may not execute hooks. Workaround: temporarily install as non-local.

### Phase 3: Integration Tests

#### 3.1 Verify coexistence with captains-log

Enable both `enterprise` and `observability` plugins. Run a session. Verify both wrote events with the same `session_id`.

#### 3.2 Verify graceful degradation (server down)

Stop the server, start a session. Verify hooks exit 0 (non-blocking) without delays. Check that Claude Code continues normally.

#### 3.3 Verify self-destruct timer

```bash
# Write a fake port file pointing to a port that accepts but never responds
echo '99999' > ~/.cache/side-quest-observability/events.port
# Start a TCP listener that accepts but never responds:
# nc -l 99999 &

echo '{"session_id":"test","transcript_path":"/tmp/t","cwd":"/tmp","permission_mode":"default"}' | \
  timeout 6 bun run plugins/observability/hooks/emit-event.ts session-start
echo "Exit code: $?"
# Should complete within 4.5s and exit 0
# Clean up: rm ~/.cache/side-quest-observability/events.port
```

#### 3.4 Verify async hooks don't block tool calls

Run a session with multiple rapid tool calls. Verify PreToolUse/PostToolUse events arrive at the server without introducing perceptible latency on tool execution.

#### 3.5 Verify duplicate event handling

```bash
# Start Claude Code from home directory (~)
# Trigger tool calls
# Check that events have unique IDs (crypto.randomUUID())
# Even if hooks fire twice (#3465), events are distinguishable
```

### Phase 4: Performance Baseline

#### 4.1 Measure hook execution time

```bash
# Warm path (server running):
echo '{"session_id":"bench","transcript_path":"/tmp/t","cwd":"/tmp","permission_mode":"default","hook_event_name":"SessionStart","source":"cli"}' | \
  time bun run plugins/observability/hooks/emit-event.ts session-start

# Expected: <100ms (bun run ~5ms + stdin parse ~1ms + fetch ~50ms + overhead)
# Compare to bunx which added 15-500ms of npm resolution on top
```

#### 4.2 Measure cold path (server down):

```bash
echo '{"session_id":"bench","transcript_path":"/tmp/t","cwd":"/tmp","permission_mode":"default","hook_event_name":"SessionStart","source":"cli"}' | \
  time bun run plugins/observability/hooks/emit-event.ts session-start

# Expected: <50ms (bun run ~5ms + stdin parse ~1ms + port file miss ~1ms + exit)
```

---

## Fallback: settings.json Injection

If plugin hook execution verification fails (Phase 2), the fallback is a setup command that injects hooks directly into `~/.claude/settings.json`:

```bash
bunx @side-quest/observability setup
# Writes hook entries to ~/.claude/settings.json
# Uses absolute paths instead of ${CLAUDE_PLUGIN_ROOT}
```

This bypasses the plugin hook delivery mechanism entirely. It's less elegant but guaranteed to work since inline settings.json hooks are the most tested code path in Claude Code.

**This is a v1.1 fallback, not a v1 deliverable.** We attempt plugin-delivered hooks first.

---

## Implementation Steps

1. Create directory: `plugins/observability/hooks/`
2. Create `plugins/observability/plugin.json`
3. Create `plugins/observability/hooks/hooks.json`
4. Create `plugins/observability/hooks/emit-event.ts` (self-contained, zero dependencies)
5. Run Phase 1 (static validation)
6. Run Phase 2 (plugin hook execution verification)
7. Run Phase 3 (integration tests)
8. Run Phase 4 (performance baseline)

Total: ~20 minutes. Three files + verification. **No dependency installation step** -- `emit-event.ts` has zero imports from `@side-quest/observability`.
