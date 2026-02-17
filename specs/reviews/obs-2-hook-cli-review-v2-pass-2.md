# OBS-2 Hook CLI (Revised) - Staff Engineer Review

**Pass:** 2 of 3
**Persona:** Skeptic
**Reviewer lens:** Scope creep, over-engineering, YAGNI violations, premature abstractions, unnecessary complexity, "what can we cut?"
**Plan version:** Revised (post 3-pass review, 836 lines)
**Date:** 2026-02-17

---

## Verdict: APPROVE WITH CONDITIONS

The revised plan is dramatically better than the original. The cuts from 14 to 5 handlers, removal of model caching, removal of transcript scanning, and removal of `observe()` wrapping are all correct. But the remaining structure is still heavier than it needs to be. This is a CLI that reads JSON from stdin and POSTs it to localhost. The abstraction and type layers are sized for a system with 20+ event types -- not 5. Ship it leaner and add structure when the complexity earns it.

---

## Strengths

- **The scope cuts from the first review round were the right calls.** 14 handlers to 5, removing model caching, removing transcript scanning, removing `observe()` -- each of these removed a source of runtime risk and maintenance burden. The plan author listened to feedback and cut aggressively. That discipline is rare and worth calling out.

- **Fire-and-forget with 500ms timeout is the correct operational model.** The hook must never interfere with the observed system. The plan is clear-eyed about this constraint and does not try to add retry logic, local spooling, or delivery guarantees. Good.

- **Coexistence with captains-log.ts is well-reasoned.** Rather than trying to replace or merge with the existing hook, the plan defines a clear boundary: captains-log does session-end transcript parsing, the new CLI does per-event forwarding. No overlap, no migration risk.

---

## Critical Issues

### C3: 13 type definitions for 5 events is a type system that costs more than it earns

**Severity:** Over-engineering that will slow implementation and create maintenance drag.

The plan defines: `CommonHookInput`, `SessionStartInput`, `PreToolUseInput`, `PostToolUseInput`, `PostToolUseFailureInput`, `StopInput`, `SessionStartPayload`, `PreToolUsePayload`, `PostToolUsePayload`, `PostToolUseFailurePayload`, `StopPayload`, `HookEventPayload` (union), `HookHandler`, and `EventConfig` -- that is 13-14 type definitions.

But the extractPayload functions in EventConfig cast `input as Record<string, unknown>` anyway (visible in the code sample). The per-event input interfaces (`SessionStartInput`, etc.) are never used as function parameter types -- the config entries receive `CommonHookInput` and immediately cast. The per-event payload interfaces (`SessionStartPayload`, etc.) are dead types as noted in Pass 1's I2 -- `extractPayload` returns `Record<string, unknown>`, not the strict payload.

So 10 of the 13 types are documentation-as-code that the compiler never enforces. That is a code comment with extra steps.

**Recommendation:** Ship v1 with 3 types: `CommonHookInput` (the validated shape from stdin), `EventConfig` (the handler registry), and `HookHandler` (the function signature for the stop handler). Drop the per-event input and payload interfaces entirely. If a future version needs type-safe payloads, add them when `extractPayload` is made generic. Writing types that nothing checks is pure overhead.

### C4: The `handlers/` subdirectory with 3 files is a premature directory boundary

**Severity:** Structural complexity without structural benefit.

The plan places handler logic in `handlers/index.ts` (dispatcher), `handlers/config.ts` (4 config entries), and `handlers/stop.ts` (1 handler with a boolean guard). Three files in a subdirectory for what amounts to ~60 lines of code.

The "complex" stop handler is 6 lines:

```typescript
export async function handleStop(input: CommonHookInput): Promise<void> {
  const typed = input as Record<string, unknown>
  if (typed.stop_hook_active === true) return
  await emitHookEvent('hook.stop', input, { ... })
}
```

This does not justify its own file. The dispatcher in `index.ts` is a lookup + call -- maybe 15 lines. The config is a flat object literal -- maybe 40 lines.

**Recommendation:** Collapse `handlers/` into a single file: `dispatch.ts` (or inline it in `hook.ts`). One file with: the config map, the stop guard, and the dispatch function. When a sixth handler arrives that has genuinely complex logic (branching, state, multiple conditionals), extract it then. Not before.

---

## Important Observations

### I7: 8 source files for "read stdin, extract fields, POST to localhost" is 3-4x what's needed

The plan proposes 8 source files:

1. `cli/index.ts` -- entry point
2. `cli/hook.ts` -- stdin reading + validation
3. `cli/emitter.ts` -- envelope construction + fetch
4. `cli/types.ts` -- type definitions
5. `cli/handlers/index.ts` -- dispatcher
6. `cli/handlers/config.ts` -- config map
7. `cli/handlers/stop.ts` -- stop handler

Plus shared: `cache-key.ts` (existing), `types.ts` (server types, existing).

The minimum viable structure is 3-4 files:

1. `cli/index.ts` -- entry point (stdin read, validate, dispatch)
2. `cli/emit.ts` -- envelope construction + fetch + port discovery
3. `cli/types.ts` -- the 3 types that matter (CommonHookInput, EventConfig, HookHandler)

That is it. The config map, stop handler, and dispatcher are small enough to live in `index.ts`. You can always extract later -- extracting a function into a new file is trivial; collapsing an unnecessary abstraction is not.

**Suggestion:** Target 4 files maximum for v1. Merge types into the file that uses them if they are only used in one place.

### I8: `truncate` import from `@side-quest/core/utils` for string slicing is a dependency you do not need

The plan imports `truncate` from `@side-quest/core/utils` for tool input/result previews. This is `str.slice(0, maxLen)` with maybe an ellipsis suffix.

Importing a package dependency for something achievable in one expression adds: a build-time dependency, a version coupling point, and a mental lookup ("what does truncate do?") for every future reader. The answer is: it slices a string.

**Suggestion:** Use `str.slice(0, 2000)` inline. Or if you want the ellipsis: `str.length > 2000 ? str.slice(0, 2000) + '...' : str`. Two expressions. No import.

### I9: 4 test files for 8 source files is proportionate in count but the test matrix pattern is premature

4 test files is not unreasonable. The concern is the test structure: the plan proposes a "contract-style test matrix" pattern where each event type gets a parameterized test case with fixture payloads.

For 4 config-driven handlers that are flat field extractions, a single test file with 4 `it()` blocks is sufficient. Each test: construct input, call the config's `extractPayload`, assert the output object. No matrix pattern, no parameterized test factory, no shared fixture files.

The stop handler deserves its own test with 2 cases (active = true returns early, active = false/missing emits).

The emitter deserves its own test (envelope shape, fetch call, timeout behavior).

That is 2-3 test files, not 4. And each should be flat `describe`/`it` blocks, not test factories.

**Suggestion:** One test file per "unit of behavior": `dispatch.test.ts` (config lookups + payload extraction), `emit.test.ts` (envelope construction + fetch), `hook.test.ts` (stdin parsing + validation + integration). Three files.

### I10: The deferred items tracker (section 18) should be deleted from the plan

8 deferred items in a plan document is a backlog masquerading as a plan section. Deferred items belong in issue tickets, not in implementation specs. Their presence in the plan creates two risks:

1. **Scope creep pressure.** Implementers see the deferred list and think "while I'm in here, I could just..." This is how 5-handler CLIs become 14-handler CLIs.
2. **Plan staleness.** Deferred items become stale faster than the core plan. When someone reads this plan in 3 months, the deferred items will be partially done, partially irrelevant, and partially misleading.

**Suggestion:** Move deferred items to GitHub issues. Reference the issue numbers in a single line at the bottom of the plan: "Future work tracked in #XX, #YY." Delete the section.

### I11: `EventConfig.requiredFields` is a runtime validation framework for 4 entries

If the plan includes a `requiredFields` array on each EventConfig entry, then `dispatchHook` presumably iterates these and checks for `undefined` before calling `extractPayload`. This is a mini validation framework.

For 4 config entries with 2-4 required fields each, this validation loop provides marginal safety over the alternative: let `extractPayload` return whatever it returns, and let the server reject malformed events. The server must validate incoming events anyway (it cannot trust any client). Adding client-side field validation for a trusted, co-located system (hook CLI talks to localhost server) is defense-in-depth that costs more in complexity than it saves in debugging time.

**Suggestion:** Drop `requiredFields` from EventConfig. The `assertCommonFields` check in `hook.ts` (which validates the 3 critical fields from stdin) is sufficient client-side validation. Let the server own schema validation.

---

## Nice-to-Haves

1. **Consider whether `cli/types.ts` needs to exist at all.** If the types are only used in one or two files, define them where they are used. A types file is justified when 3+ files import from it. For v1, the 3 remaining types might all live in `index.ts` or `emit.ts`.

2. **The `schemaVersion: '1.0.0' as const` in the emitter is fine but could be a top-level constant.** If it changes, you want to change it in one place. A `const SCHEMA_VERSION = '1.0.0' as const` at the top of the emitter file is marginally better than an inline literal.

3. **The plan's section numbering (18 sections for an 836-line plan) suggests the plan itself could be shorter.** An implementation plan for a 4-file CLI should be 200-300 lines. The remaining 500+ lines are context, rationale, and deferred items that belong elsewhere. Not blocking, but worth noting for future plan authoring.

---

## Questions for the Author

1. **If you had to ship this tomorrow with 4 files instead of 8, which files would you keep?** This is the real litmus test for whether the abstractions are load-bearing or decorative.

2. **How many of the 13 type definitions are actually referenced in `extractPayload` function signatures or test assertions?** If the answer is fewer than 5, the rest are dead weight.

3. **What is the actual runtime cost of the `handlers/` abstraction?** Not CPU cost -- cognitive cost. When a new developer reads the code, do they understand the system faster with 3 files in a subdirectory, or with one file that does dispatch + config + stop guard in 80 lines?

4. **Has the `truncate` function from `@side-quest/core/utils` been used elsewhere in the observability system, or is this the only consumer?** If it is only used here, the import is not earning its keep.

5. **Nathan, would you accept a v1 that is literally 3 files and ~200 lines of implementation code?** The revised plan is already lean compared to the original. But it could be leaner. The question is whether you value the structural headroom for future events, or whether you would rather pay that cost when the future events actually arrive.

---

## Summary Table

| ID | Severity | Summary | Effort |
|----|----------|---------|--------|
| C3 | Critical | 13 type definitions for 5 events -- 10 are dead types the compiler never checks | Small (delete 10 interfaces) |
| C4 | Critical | `handlers/` subdirectory with 3 files for ~60 lines of code | Small (merge into 1 file) |
| I7 | Important | 8 source files is 3-4x minimum viable for this deliverable | Medium (restructure to 3-4 files) |
| I8 | Important | `truncate` import from core for string slicing -- use `str.slice()` | Trivial (inline one expression) |
| I9 | Important | Test matrix pattern is premature for 4 config entries | Small (flatten to 2-3 test files) |
| I10 | Important | Deferred items tracker should be issues, not plan sections | Trivial (move to GitHub issues) |
| I11 | Important | `requiredFields` in EventConfig is client-side validation the server already owns | Small (remove from config) |

**Verdict: APPROVE WITH CONDITIONS** -- address C3 and C4 before implementation. The remaining items are strong recommendations that will reduce implementation time and maintenance burden, but are not blocking. The core design (config-driven dispatch, fire-and-forget emit, 500ms timeout) is sound. The issue is that the packaging around the core design is 2x heavier than it needs to be for 5 events.
