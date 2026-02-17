# OBS-2 Hook CLI Review -- Pass 1 (Architect)

**Reviewer lens:** System boundaries, abstraction levels, API surface, data flow correctness, long-term maintainability

---

## 1. Verdict

**REQUEST CHANGES**

The plan has solid structural instincts -- fire-and-forget semantics, model caching, and the 4-layer error guard are all well-considered. However, there are two contradictions with OBS-1's current plan that would cause integration failures, and the port discovery model needs resolution before any code is written. The handler granularity is also over-engineered for v1.

---

## 2. Strengths

- **Fire-and-forget with 500ms timeout is correct.** Hooks must never block Claude Code. The plan inherits this pattern from the proven `event-bus-client.ts` and that's the right call.

- **Model cache with TTL is a smart optimization.** Avoiding repeated transcript scans across high-frequency hook events (PreToolUse, PostToolUse) is necessary. The 60s TTL is a reasonable balance between freshness and cost.

- **4-layer error guard with always-exit-0 is exactly right.** A hook that crashes or hangs is worse than a hook that silently drops an event. The plan correctly prioritizes reliability of the host (Claude Code) over completeness of telemetry.

- **Recursion guard for stop hooks.** Carrying forward the `stop_hook_active` pattern from `captains-log.ts` shows awareness of a real production footgun.

---

## 3. Critical Issues (must fix before implementation)

### C1: Port discovery model contradicts OBS-1

The plan uses a **global** port file at `~/.cache/side-quest-observability/events.port`. The existing production code in `event-bus-client.ts` uses **per-repo** port files at `~/.cache/side-quest-git/{repoName}/events.port`. OBS-1's revised plan uses **per-app cache keys** via `getAppCacheKey(appRoot)`, producing directories like `side-quest-plugins-a1b2c3d4e5f6/`.

These three approaches are mutually incompatible. The hook CLI receives `cwd` from stdin but has no knowledge of the app's cache key hash. It cannot derive the per-app cache key without duplicating the hashing logic from OBS-1.

**Recommendation:** Align with OBS-1. Two options:

- **(A) Share the cache key derivation.** Export `getAppCacheKey()` from a shared utility and have the hook CLI use it with `input.cwd` to locate the correct port file. This is the cleanest approach but creates a build-time dependency between the CLI and the server's cache module.
- **(B) Use an environment variable.** Have the observability server set `SIDE_QUEST_EVENTS_PORT=<port>` in the environment before Claude Code starts. The hook CLI reads the env var directly -- no file discovery needed. This is simpler and eliminates the port file race condition entirely. However, it requires the server to inject the env var, which may not be feasible depending on how Claude Code sessions are launched.

Option A is more robust. Either way, this must be resolved before implementation begins.

### C2: Envelope schema misalignment with OBS-1

The emitter constructs envelopes with `sessionCid`, `cid`, and `schemaVersion: '1.0.0'` (string). OBS-1's current plan uses `correlationId` (single field) and `schemaVersion: 1` (number). These are three distinct mismatches:

| Field | OBS-2 plan | OBS-1 current |
|-------|-----------|---------------|
| Schema version | `'1.0.0'` (string) | `1` (number) |
| Correlation | `sessionCid` + `cid` | `correlationId` |
| Unique ID | `id: nanoId()` | Not present |

If OBS-2 ships against OBS-1's current server, the server will receive fields it doesn't expect and miss fields it does expect. The event will either be rejected or stored with missing correlation data.

**Recommendation:** The emitter MUST match OBS-1's current envelope schema exactly. Use `correlationId`, `schemaVersion: 1` (number), and no `sessionCid`/`cid` fields. When OBS-1 PR2 ships with three-tier CIDs, update the emitter in a coordinated change. Do not pre-build for a schema that doesn't exist yet.

### C3: `Bun.stdin.stream()` is unproven -- use the proven pattern

The plan uses `Bun.stdin.stream()` with async iteration. The existing production hook (`captains-log.ts`) uses `readFileSync('/dev/stdin', 'utf-8')`, which is proven to work with Claude Code's stdin piping.

`Bun.stdin.stream()` introduces two risks:
1. **Hanging:** If Claude Code doesn't close stdin cleanly, the async iterator may never resolve, consuming the entire hook timeout.
2. **Buffering:** Async streams may deliver partial JSON chunks that need manual reassembly.

There is no upside to switching. The stdin payload is a single JSON object (not a stream of events). Synchronous read is correct.

**Recommendation:** Use `readFileSync('/dev/stdin', 'utf-8')` exactly as `captains-log.ts` does. This is a one-line change with zero risk.

### C4: `cwd` is not a stable app identity

If users invoke Claude Code from a subdirectory (e.g., `~/code/my-project/src/`), the `cwd` from stdin won't match the app root that the server used to derive its cache key. The port file lookup will fail silently (negative cache kicks in) and all events for that session are lost.

**Recommendation:** Port lookup must use the same canonical root derivation algorithm as the server. If OBS-1 uses git root or a `package.json` walk-up, the hook CLI must do the same. Alternatively, option B from C1 (env var) sidesteps this entirely.

### C5: No runtime validation at handler boundary

Every handler casts `input as XxxInput` without validation. If Claude Code changes its stdin schema (adds fields, removes fields, changes types), the handler silently produces events with `undefined` values that get serialized and sent to the server.

**Recommendation:** Add a lightweight validation step at the dispatcher level. Not a full schema validator (too heavy for a hook), but at minimum check that required fields exist:

```typescript
function assertFields(input: unknown, fields: string[]): void {
  for (const f of fields) {
    if ((input as any)[f] === undefined) {
      log.warn(`Missing expected field: ${f}`)
    }
  }
}
```

This turns silent corruption into observable warnings without affecting the exit code.

---

## 4. Important Observations (should fix, not blocking)

### I1: 14 handler files is over-engineered for v1

11 of the 14 handlers follow an identical pattern: cast input, optionally extract model, build a flat data object, call `emitHookEvent`. The only handlers with meaningful logic are:

- `stop.ts` -- recursion guard
- `subagent-stop.ts` -- transcript parsing, token extraction, verdict scanning
- Potentially `notification.ts` -- if it needs special formatting

The other 11 are boilerplate that differ only in which fields they pluck from the input.

**Recommendation:** Use a **config-driven generic handler** for the simple cases. Keep `stop.ts` and `subagent-stop.ts` as dedicated files. This reduces 14 files to ~4 (config, generic handler, stop, subagent-stop) and makes adding new events a one-line config change instead of a new file + test + registry update.

### I2: Model cache reads entire transcript into memory

`extractModelFromTranscript` calls `readTextFileSync(transcriptPath)` and then `split('\n')` to iterate in reverse. For heavy sessions (2000+ messages), transcripts can reach 10-50MB. This allocates the full string plus the split array in memory.

The 60s TTL prevents repeated reads, but the first read per session is still O(n) in transcript size, and it happens during a hook invocation with a 5s timeout budget.

**Recommendation:** Read only the last N bytes of the file (e.g., 64KB) using `Bun.file(path).slice(-65536)`. The model name appears in recent messages, so the tail of the file is sufficient. This caps memory usage regardless of transcript size.

### I3: CLI binary lives inside `packages/server/src/cli/`

The hook CLI is a separate binary with a separate entry point, separate build artifact, and separate npm distribution (`bunx @side-quest/observability hook <event>`). Placing it inside the server package conflates two distinct concerns:

- The **server** is a long-running process that receives events and stores them.
- The **CLI** is a short-lived process that sends events and exits.

**Recommendation:** For v1, keeping them co-located is acceptable if the CLI has its own entry point in `package.json` (`bin` field) and its own build target. But note this as tech debt -- if the CLI grows (e.g., `observability query`, `observability replay`), it should move to its own package.

### I4: `observe()` wrapping adds per-process overhead on hot path

Every hook invocation wraps the handler in `observe()` which adds timing and logging. For high-frequency events like `PreToolUse` (50+ times per minute in active sessions), this overhead compounds. Each hook spawns a fresh process, so there's no warm-up benefit.

**Recommendation:** Gate `observe()` behind a debug flag or sample rate for v1. The hook itself is the observability layer -- adding observability-of-observability on the hot path is premature.

### I5: Four layers of try/catch is more than needed

The plan describes main catch -> dispatcher catch -> handler catch -> emitter catch. In a single-shot process, if the dispatcher throws, main catches it. The inner catches are only useful for partial-failure recovery, but there's nothing to recover to -- the hook either emits an event or it doesn't.

**Recommendation:** Two layers suffice: one around the handler+emit (to log and swallow), one at main (to ensure exit 0). Fewer layers means less cognitive overhead when debugging.

---

## 5. Nice-to-Haves (optional improvements)

- **N1: Dry-run mode.** An env var like `SIDE_QUEST_HOOK_DRY_RUN=1` that logs the constructed envelope to stderr instead of POSTing would make debugging hook issues much easier during development.

- **N2: Port discovery chain.** Implement a fallback chain: explicit env var `SIDE_QUEST_EVENTS_PORT` -> per-app cache key file -> legacy per-repo file. This provides forward and backward compatibility.

- **N3: Fixture-based contract tests.** Capture real Claude Code hook payloads for all 14 events and use them as test fixtures. This catches schema drift early and documents the actual stdin shape.

- **N4: `hookDurationMs` in event payload.** Including the hook's own execution time in the emitted event gives free observability-of-observability without additional infrastructure.

- **N5: "Invalid payload" event type.** When validation fails, emit a lightweight `hook.invalid-payload` event so schema failures are observable rather than silently dropped.

---

## 6. Questions for the Author

1. **Have you tested `Bun.stdin.stream()` with Claude Code hooks?** The existing production hook uses `readFileSync('/dev/stdin')`. What motivated the switch to async streams for a single-object stdin read?

2. **How will the port file path be coordinated with OBS-1?** The plan says global, OBS-1 says per-app. Who resolves this, and when? This blocks implementation.

3. **Which envelope contract is authoritative for OBS-2's ship target:** current OBS-1 single `correlationId`, or future PR2 three-tier CIDs? If OBS-2 ships first, the server will reject or mishandle the envelope.

4. **How will the hook CLI canonicalize project root from `cwd`?** If a user runs Claude Code from `~/code/my-project/src/`, the `cwd` won't match the server's app root. Does the CLI need git-root detection or package.json walk-up?

5. **The `bunx` invocation model means every hook spawns a fresh process and resolves the package.** `captains-log.ts` uses `bun run ${CLAUDE_PLUGIN_ROOT}/hooks/captains-log.ts` which avoids package resolution. Has the cold-start cost of `bunx` been measured? If it's >200ms, that eats significantly into the 5s budget.

6. **Is server-side envelope validation strict (reject unknown fields) or permissive (store and ignore)?** This determines how safely OBS-2 can add new fields ahead of OBS-1 server changes.

7. **What's the acceptable event loss model for v1?** Best-effort with silent drops, or should there be a local spool/retry for when the server is temporarily unavailable?
