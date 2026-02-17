# OBS-3 Plugin Registration Review -- Pass 2 (Skeptic)

**Reviewer lens:** Scope creep, over-engineering, YAGNI violations, "what can we cut?"

---

## 1. Verdict

**REQUEST CHANGES**

---

## 2. Strengths

- The two-file scope (plugin.json + hooks.json) is correctly minimal on the surface. The instinct to keep OBS-3 as pure configuration with no logic of its own is sound.
- The `*` matcher choice is coherent -- observability is legitimately cross-cutting, and per-tool filtering belongs at the server layer, not in hook registration config.
- Explicitly scoping to the 5 implemented OBS-2 events (post Architect C1 correction) is the right constraint. Registering only what exists prevents phantom invocations.
- The timeout reasoning (5s for warm-cache bunx) is documented, which is better than leaving it magic.

---

## 3. Critical Issues (new -- not repeats of Pass 1)

### C3: `bunx` is the wrong execution model for this codebase -- full stop

Every single hook in this repo uses `bun run ${CLAUDE_PLUGIN_ROOT}/hooks/<script>.ts`. The git plugin, the bun-runner plugin, the biome-runner plugin, the enterprise plugin -- all of them. Zero npm publishing required, zero package resolution latency, no cold-cache problem, no `private: true` paradox. The observability plugin's hooks should follow the same pattern: local `.ts` files executed via `bun run`.

The plan proposes `bunx @side-quest/observability hook <event>` as if this is an established pattern. It is not. It is an invention that contradicts every existing hook in the codebase and introduces the entire chain of problems identified by the Architect (C2, I3, I4) as downstream consequences. The root cause is the execution model, not the timeout value or the async flag.

**Concrete alternative that eliminates C2, I3, I4 entirely:**

```json
{
  "type": "command",
  "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts SessionStart",
  "timeout": 5
}
```

Where `emit-event.ts` is a thin wrapper that reads `$1` (the event name), calls the event-bus-client pattern already proven in `plugins/git/hooks/event-bus-client.ts`, and exits. No npm. No publish. No resolution. Cold start is Bun's TypeScript startup time (~80ms), not bunx package resolution (500ms+).

This is not a minor implementation detail -- it is the entire architecture of hook execution in this repo. The plan cannot proceed with `bunx`.

### C4: The event-bus client already lives in the git plugin

`plugins/git/hooks/event-bus-client.ts` is a fully implemented, tested HTTP event emitter. It handles port-file discovery, 500ms fire-and-forget timeout, negative caching, abort controller cleanup, and error isolation. It already emits 5 event types that map to the OBS-2 handlers.

The plan proposes creating a new npm package (`@side-quest/observability`) to do what already exists as a local module. This is a YAGNI violation of the first order. Before creating a new plugin with its own hooks, the question that must be answered is: "Why isn't the observability plugin just a hooks.json that calls `bun run ${CLAUDE_PLUGIN_ROOT}/hooks/emit-event.ts` where emit-event.ts imports from the git plugin's event-bus-client?"

If the answer is "separation of concerns -- observability shouldn't depend on the git plugin," that is valid, but it means the emit logic should be duplicated (or extracted to a shared local file), not published to npm.

---

## 4. Important Observations (new -- not repeats of Pass 1)

### I6: The plan's documentation is disproportionate to its actual deliverable

The plan produces two JSON files (~200 lines total). The review brief lists 6 design sections, a coexistence analysis, and a 6-step testing strategy. For a personal dev tool with a single consumer, this level of specification is premature. The testing strategy should be "fire one event, confirm it reaches the server."

The documentation overhead creates its own risk: it makes the plan look more considered than it is, obscuring the critical execution model flaw (C3) behind layers of specification prose.

### I7: `hooks.json` without correct plugin.json is an orphaned config file

The Architect flagged I1 (missing `"hooks": ["./hooks"]` field). The deeper issue: `hooks.json` is only meaningful if a `plugin.json` loads it. If the observability plugin's `plugin.json` has the wrong structure or doesn't reference the hooks directory, all 5 hook registrations are silently ignored. Testing must verify end-to-end loading, not just JSON validity.

### I8: The plan assumes the observability server is running when hooks fire

The event-bus-client in the git plugin handles this gracefully: port-file missing? Skip silently. Port file present but server down? Fetch fails, caught, logged to stderr, hook continues. The `bunx` approach has no equivalent graceful degradation -- if the npm package resolves but the server isn't running, the hook either hangs until timeout or errors in ways that may not be silent. The local `bun run` approach with a thin emit-event.ts inherits the git plugin's proven error handling. The `bunx` approach starts from zero.

---

## 5. Nice-to-Haves

- Consider whether the observability plugin even needs to be a separate plugin. The git plugin already emits events. If the server is the missing piece (OBS-1), the hooks already exist. OBS-3 may be solving a problem that was already solved.
- If the observability plugin does stay separate, the hooks.json description field should be specific to observability, not inherited from a template.

---

## 6. Questions for the Author

1. **Why `bunx` when zero other hooks in this repo use `bunx`?** What decision led to this? Is it inherited from the master plan without re-evaluation?

2. **`plugins/git/hooks/event-bus-client.ts` already exists and emits the same 5 events.** Is OBS-3 intended to replace this, complement it, or duplicate it? What does a separate observability plugin's hooks add?

3. **Is the observability plugin intended to run on machines where the git plugin is not installed?** If not, the shared local module approach (extract event-bus-client to a shared location) is strictly better than npm publishing.

4. **What is the actual user-visible outcome of OBS-3?** "Hooks fire and events reach the server" -- but whose server? Is the server (OBS-1) already running? If not, this is all moot until OBS-1 ships.

5. **The plan says "~10 minutes, two JSON files." It also has a 6-step testing strategy.** Which is the accurate description of the work?

---

## Summary

The plan has a fundamental execution model problem (C3: `bunx` vs `bun run`) that cascades into every other issue the Architect raised. Fix the execution model and half the Architect's critical issues disappear automatically. Additionally, the event-bus-client already exists in the git plugin -- OBS-3 may be over-engineering a problem that is already 80% solved. The smallest thing that works is: one thin `.ts` emit script that imports the existing event-bus-client pattern, plus a `plugin.json` and `hooks.json` that wire up 5 events. No npm, no publish, no new package.
