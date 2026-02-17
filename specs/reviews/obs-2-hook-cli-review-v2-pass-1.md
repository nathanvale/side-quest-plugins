# OBS-2 Hook CLI (Revised) - Staff Engineer Review

**Pass:** 1 of 3
**Persona:** Architect
**Reviewer lens:** System boundaries, API contracts, integration points, cross-domain alignment, data flow correctness, long-term maintainability
**Plan version:** Revised (post 3-pass review, 836 lines)
**Date:** 2026-02-17

---

## Verdict: APPROVE WITH CONDITIONS

The revision is significantly improved. The scope cuts are aggressive and correct. The config-driven handler pattern is clean and extensible. The coexistence strategy with captains-log is well-reasoned. However, there are contract alignment issues between OBS-2's emitter and OBS-1's type system that will cause type errors or silent failures at integration time.

---

## Strengths

- **Config-driven handler pattern is excellent.** 4 of 5 handlers collapsed into config entries, with a clear path to adding 9 more as one-liners. This is the right abstraction level for v1 -- not too generic (framework), not too specific (14 separate files).

- **stdin reading uses the proven pattern.** `readFileSync('/dev/stdin', 'utf-8')` is battle-tested in captains-log.ts with thousands of invocations. No risk of stream hangs, no async complexity.

- **Two-layer error handling is proportionate.** The original 4-layer design was over-engineered for a fire-and-forget CLI. Main catch + handler catch is exactly right. Silent by default, debug-gated -- correct for observability tooling that must never interfere with the observed system.

- **Scope discipline is tight.** Cutting from 14 to 5 handlers, removing `observe()` wrapping, removing structured logging, removing three-tier CIDs -- these cuts all reduce risk without sacrificing the core value proposition.

---

## Critical Issues

### C1: EventType mismatch -- OBS-2 emits types OBS-1 cannot accept

**Severity:** Will cause runtime rejection or type errors at integration time.

OBS-2's emitter constructs envelopes with `type: eventType` where `eventType` is `'hook.session_start'`, `'hook.pre_tool_use'`, `'hook.post_tool_use'`, `'hook.post_tool_use_failure'`, `'hook.stop'` (section 7, config.ts `eventType` fields).

OBS-1 PR1's `EventType` is:

```typescript
type EventType = CliEventType | HookEventType
// where HookEventType = 'session.started' | 'session.ended' | 'session.compacted' | 'safety.blocked' | 'command.executed'
```

These are completely different string sets. `'hook.session_start'` is not `'session.started'`. OBS-1 PR2 adds `ClaudeHookEvent` members (`'hook.session_start'` etc.), but PR2 is deferred and depends on OBS-2 shipping.

This creates a circular dependency: OBS-2 emits types that require OBS-1 PR2, but OBS-1 PR2 is deferred until OBS-2 ships.

**Resolution options:**
1. OBS-1 PR1 adds the 5 v1 `ClaudeHookEvent` members (`'hook.session_start'` | `'hook.pre_tool_use'` | `'hook.post_tool_use'` | `'hook.post_tool_use_failure'` | `'hook.stop'`). Fold this into PR1 scope since OBS-2 is the immediate consumer.
2. OBS-2's emitter uses `string` for the `type` field in its local envelope construction, bypassing OBS-1's type constraint. The server's ingress validation (POST /events) already validates `typeof type === 'string'` -- it does not check against the `EventType` union at runtime. But this undermines the type safety contract.
3. Ship OBS-1 PR2's type expansion as a small prerequisite PR before OBS-2.

Option 1 is cheapest and safest. The plan should explicitly state this dependency.

### C2: Import path mismatch -- `generateCorrelationId` lives in `@side-quest/core/instrumentation`, not `@side-quest/core/utils`

**Severity:** Build failure.

Section 9 (emitter.ts) imports:

```typescript
import { nanoId, generateCorrelationId } from '@side-quest/core/utils'
```

But `generateCorrelationId` is exported from `@side-quest/core/instrumentation` (verified: `side-quest-core/src/instrumentation/context.ts` line 77, re-exported from `instrumentation/index.ts` line 42). `@side-quest/core/utils` exports `nanoId` but NOT `generateCorrelationId`.

OBS-1's `schema.ts` gets this right:

```typescript
import { generateCorrelationId } from '@side-quest/core/instrumentation'
import { nanoId } from '@side-quest/core/utils'
```

The OBS-2 emitter must split these into two import lines.

### C3: Relative import path for `cache-key.ts` is wrong

**Severity:** Build failure.

Section 9 (emitter.ts) imports:

```typescript
import { getAppCacheKey, getAppCacheDir } from '../cache-key.js'
```

The file tree (section 2) shows:
- Emitter location: `packages/server/src/cli/emitter.ts`
- Cache key location: `packages/server/src/cache-key.ts`

The relative path from `src/cli/emitter.ts` to `src/cache-key.ts` is indeed `../cache-key.js` -- this is actually correct. However, this creates a tight coupling between the CLI module and the server's root-level module. If the CLI is ever extracted to its own package (which the workspace monorepo pattern enables), this import breaks.

**Revised assessment:** The path is technically correct for the current file tree. Downgrading from "critical" to "important" (see I1). But the plan should document this coupling explicitly.

---

## Important Observations

### I1: CLI-to-server coupling via relative imports

The CLI (`packages/server/src/cli/`) imports from its parent package's root (`packages/server/src/cache-key.ts`). This is fine for v1 but creates a coupling risk. If the CLI later becomes its own entry point or package, these imports break.

**Suggestion:** Add a comment in the plan noting that `cache-key.ts`, `types.ts` (in the server root), and the CLI's `types.ts` are in different module boundaries. If v2 extracts the CLI into `packages/cli/`, a re-export from the server package will be needed.

### I2: `EventConfig.extractPayload` return type erases strict payloads

Section 7 (config.ts) defines:

```typescript
export interface EventConfig {
  extractPayload: (input: CommonHookInput) => Record<string, unknown>
}
```

But section 3c defines strict typed payloads (`SessionStartPayload`, `PreToolUsePayload`, etc.) with no index signature. The extractors return `Record<string, unknown>`, not the typed payloads.

This means the typed payload interfaces in section 3c are dead types -- nothing enforces them. The actual payloads flowing through `emitHookEvent` are untyped `Record<string, unknown>`.

**Suggestion:** Either:
1. Make `EventConfig` generic: `EventConfig<T extends HookEventPayload>` with `extractPayload: (input: CommonHookInput) => T`. This enforces the typed payloads at compile time.
2. Accept that the typed payloads are documentation-only for v1 and note this explicitly. The runtime behavior is correct; it's just not enforced by the type system.

Option 2 is pragmatic for v1 given the config-driven pattern. But the plan should acknowledge the gap rather than presenting typed payloads and untyped extractors side-by-side without comment.

### I3: `canonicalizeAppRoot` 500ms timeout may be tight for cold git spawns

The plan acknowledges this (section 9 comment). In a bunx invocation: bunx spawns bun, bun runs the CLI, CLI spawns `git rev-parse --show-toplevel`. That's three process levels deep.

In practice, `git rev-parse --show-toplevel` is fast (usually <50ms even cold) because it doesn't touch the index or objects. The 500ms budget is likely fine. But the fallback to raw `cwd` means port discovery may fail when invoked from a subdirectory, since `getAppCacheKey(cwd)` and `getAppCacheKey(gitRoot)` produce different cache keys.

This is a correctness issue, not a performance issue. If git times out, the emitter silently uses the wrong app root, constructs the wrong cache key, looks for a port file that doesn't exist, and drops the event.

**Suggestion:** Log the fallback path when `SIDE_QUEST_HOOK_DEBUG=1` so this is diagnosable. Currently `canonicalizeAppRoot` falls back silently.

### I4: Stop handler's `return` vs captains-log's `process.exit(0)`

The plan's Stop handler (section 8) uses `return` when `stop_hook_active === true`:

```typescript
if (typed.stop_hook_active === true) return
```

The production captains-log.ts (line 225) uses `process.exit(0)`:

```typescript
if (input.stop_hook_active) {
  process.exit(0);
}
```

Both produce exit code 0 because the main function's `.finally(() => process.exit(0))` catches the early return. The `return` approach is cleaner -- it avoids abrupt process termination and lets the finally handler run naturally. But the behavioral difference should be documented: `return` from a handler propagates through `dispatchHook()`'s try/catch, back to `main()`, which resolves the promise, hits `.finally()`, and exits 0. Correct.

However, note that `process.exit(0)` in the `.finally()` block may fire before pending async operations (like a setTimeout cleanup) complete. For the stop handler's early-return case this doesn't matter (no async work was started), but for handlers that call `emitHookEvent` and return, there's a subtle race: the `.finally(() => process.exit(0))` fires immediately after the promise resolves, but the response from the fetch in `emitHookEvent` might not have been fully read yet. The `await` in the handler should prevent this, but if `emitHookEvent` swallows errors and returns early, the process exits before the TCP connection is fully torn down.

**Suggestion:** This is unlikely to cause data loss (the POST body is already sent by the time `fetch` resolves), but add a comment noting that `process.exit(0)` in `.finally()` is intentional and safe because the `await` in the handler completes before the promise chain resolves.

### I5: `assertCommonFields` doesn't check `permission_mode` or `hook_event_name`

Section 5 (hook.ts) validates only 3 of 5 `CommonHookInput` fields:

```typescript
function assertCommonFields(input: unknown): input is CommonHookInput {
  return (
    typeof obj.session_id === 'string' &&
    typeof obj.transcript_path === 'string' &&
    typeof obj.cwd === 'string'
  )
}
```

But `CommonHookInput` declares 5 fields: `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name`. The validator narrows to `CommonHookInput` despite not checking `permission_mode` -- which is then used in every payload extractor (`input.permission_mode`).

If Claude Code ever sends stdin without `permission_mode`, all payloads silently include `undefined` for `permissionMode`. This wouldn't crash, but the server receives incomplete data.

**Suggestion:** Either validate `permission_mode` in `assertCommonFields`, or make `permission_mode` optional in `CommonHookInput` and default it in the extractors.

### I6: OBS-2's plugin.json includes `"hooks": ["./hooks"]` but OBS-3 omits it

Section 11 of OBS-2 shows:

```json
{
  "name": "observability",
  "description": "...",
  "hooks": ["./hooks"]
}
```

OBS-3's revised plugin.json (File 1) intentionally omits the `hooks` field, noting that "Claude Code discovers `hooks/hooks.json` by convention." This is validated empirically (the git plugin has no `hooks` field in plugin.json).

OBS-2 should align with OBS-3 and drop the `hooks` field. Having the field present is not harmful (Claude Code likely ignores it or uses it), but the inconsistency between the two plans will cause confusion during implementation.

**Suggestion:** Remove `"hooks": ["./hooks"]` from OBS-2's plugin.json scaffold to match OBS-3's researched finding.

---

## Nice-to-Haves

1. **Envelope type assertion in tests.** The test strategy (section 14) verifies `hookEvent` and `sessionId` from the payload, but doesn't assert the full envelope shape sent to the server (schemaVersion, id, type, app, appRoot, source, correlationId). Adding one integration-level test that captures the full envelope from `emitHookEvent` and asserts every field would catch contract drift early.

2. **`SIDE_QUEST_HOOK_DEBUG` could be `SIDE_QUEST_DEBUG` or `DEBUG`.** Most Node.js tooling uses `DEBUG=*` (following the `debug` package convention) or a unified debug flag. Having a hook-specific env var means users need to know about it. For v1 this is fine, but consider aligning with a broader debug convention in v2.

3. **`app: 'observability'` is hardcoded.** The emitter (section 9) hardcodes `app: 'observability'`. OBS-1's EventEnvelope uses `app` to identify which application generated the event. Using the package name is reasonable, but if multiple instances of the observability system are running (e.g., different plugin versions), they'd be indistinguishable. Consider deriving `app` from the package.json `name` field or making it configurable.

---

## Questions for the Author

1. **C1 resolution path:** How do you plan to sequence the OBS-1 PR1 type expansion? If OBS-2 ships before OBS-1 PR2, the emitter constructs envelopes with types that aren't in OBS-1's union. Does the server accept arbitrary strings for `type`, or does it validate against the `EventType` union? If the former, the type mismatch is a TypeScript-only problem. If the latter, events get rejected at runtime.

2. **Is `nanoId` from `@side-quest/core/utils` the same implementation as OBS-1's?** OBS-1's `schema.ts` imports `nanoId` from `@side-quest/core/utils` (confirmed). OBS-2 does the same. But OBS-2 also imports `generateCorrelationId` from `@side-quest/core/utils` (incorrect -- see C2). Was this a copy-paste error from an earlier draft, or was there intent to create a utils-only dependency?

3. **Port file race condition on startup.** When Claude Code starts a session, SessionStart fires. If the observability server hasn't started yet (or hasn't written its port file yet), `discoverPort` returns null and the event is dropped. Is this acceptable for v1? The SessionStart event contains model and agent_type -- arguably the most valuable event for the dashboard. If it's reliably dropped on first session, the dashboard never knows what model is being used.

4. **`emitHookEvent` signature: `eventData: Record<string, unknown>`.** This is the same type erasure noted in I2. The emitter accepts untyped data, but the plan defines strict payload types. Is the intent that the emitter is type-agnostic (accepts anything), or should it enforce payload shapes? If the former, the strict payload types are consumer-side contracts only.

5. **Why `readFileSync` import in `index.ts`?** Section 4 shows `import { readFileSync } from 'node:fs'` in the CLI entry point, but `readFileSync` is only used in `hook.ts`. Is this a leftover from an earlier draft?

---

## Summary Table

| ID | Severity | Summary | Effort |
|----|----------|---------|--------|
| C1 | Critical | EventType mismatch -- OBS-2 emits types not in OBS-1's union | Small (add 5 types to OBS-1 PR1) |
| C2 | Critical | `generateCorrelationId` import path wrong (utils vs instrumentation) | Trivial (fix import line) |
| I1 | Important | CLI-to-server coupling via relative imports | Document only |
| I2 | Important | Typed payloads are dead types -- extractors return `Record<string, unknown>` | Small (make generic or document gap) |
| I3 | Important | `canonicalizeAppRoot` fallback drops events silently | Trivial (add debug log) |
| I4 | Important | `return` vs `process.exit(0)` behavioral difference should be documented | Document only |
| I5 | Important | `assertCommonFields` skips `permission_mode` validation | Trivial (add one check) |
| I6 | Important | `plugin.json` `hooks` field inconsistency between OBS-2 and OBS-3 | Trivial (remove field) |

**Verdict: APPROVE WITH CONDITIONS** -- fix C1 and C2 before implementation. The remaining items can be addressed during implementation without plan revision.
