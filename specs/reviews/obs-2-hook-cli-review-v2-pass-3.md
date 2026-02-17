# OBS-2 Hook CLI (Revised) - Staff Engineer Review

**Pass:** 3 of 3
**Persona:** Operator
**Reviewer lens:** Failure modes, recovery behavior, performance under load, "what breaks at 3am?"
**Plan version:** Revised (post 3-pass review, 836 lines)
**Date:** 2026-02-17

---

## 1. Verdict: APPROVE WITH CONDITIONS

The fire-and-forget model is correct and the 500ms timeout is defensible for the happy path. But the plan introduces a per-hook git subprocess that the existing event-bus-client explicitly avoids, creating a new hot-path bottleneck that scales linearly with tool call count. The async hook semantics are under-specified, and the plan has no answer for what happens when bunx cold-starts compound across a 200-tool-call session. Fix the git spawn issue (C5) and clarify the async lifecycle (C6) before implementation. Everything else is risk the system can absorb.

---

## 2. Strengths

- **The 500ms AbortController timeout with fire-and-forget semantics is the correct operational posture.** Observability that can block the observed system is an anti-pattern. The plan is clear-eyed about this and does not attempt retries, queues, or delivery guarantees. This is the right v1 contract.

- **Port file discovery with silent null return is graceful.** When the server is not running, the hook pays only the cost of a stat() call (or Bun.file().exists()), logs nothing, and exits 0. Users never see observability failures. This is the correct behavior for optional infrastructure.

- **The SIDE_QUEST_EVENTS=0 kill switch is zero-cost when engaged.** The early return before any I/O means the kill switch truly disables all overhead, not just the network call. Important for debugging sessions where hook latency matters.

- **Coexistence with the existing event-bus-client.ts in the git plugin is well-partitioned.** The git plugin's event-bus-client runs in-process (long-lived, with module-level caching). OBS-2's emitter runs per-invocation (short-lived, no caching possible). The plan correctly does not try to share code between these two fundamentally different execution models.

---

## 3. Critical Issues

### C5: canonicalizeAppRoot spawns git on every hook invocation -- the existing event-bus-client avoids this for good reason

**Severity:** Performance regression that scales with session length.

The plan's emitter calls `execSync('git rev-parse --show-toplevel')` inside every hook invocation. The existing event-bus-client.ts (line 40) uses `getStableRepoName(cwd)` which reads git config files without spawning a subprocess, and caches the result at module level so it runs exactly once per process lifetime.

OBS-2's hook CLI cannot use module-level caching because each hook is a fresh process. But it CAN avoid the git spawn entirely.

**The math:** In a 200-tool-call session with `*` matchers and `async: true` on PreToolUse/PostToolUse/PostToolUseFailure (per OBS-3's hooks.json), the hook fires on:
- 1 SessionStart
- 200 PreToolUse
- 200 PostToolUse
- ~10 PostToolUseFailure (estimated)
- 1 Stop
- **Total: ~412 hook invocations**

Each invocation spawns `git rev-parse --show-toplevel` at ~20-50ms. That is 8-20 seconds of aggregate git subprocess time per session, plus the process creation overhead (fork/exec) for each spawn. On a loaded machine (CI, multiple Claude Code sessions), these git processes compete for the process table and file descriptors.

The event-bus-client solves this by never spawning git. It reads `.git/config` directly via `getStableRepoName()`. OBS-2 should do the same.

**Fix:** Replace `canonicalizeAppRoot` with a non-spawning equivalent:

1. Walk up from `cwd` looking for `.git` directory (this is what `git rev-parse --show-toplevel` does internally).
2. `const gitRoot = findGitRoot(cwd)` where `findGitRoot` is a simple loop: check for `.git` at each parent directory. Pure filesystem stat calls, no subprocess.
3. Or import `getMainWorktreeRoot` from the git plugin's `git-status-parser` -- but this creates a cross-plugin dependency that may not be desirable. The walk-up approach is 10 lines and has zero dependencies.

This eliminates 412 subprocess spawns per session and removes the 500ms timeout on the git call that currently eats into the 500ms fetch timeout budget.

### C6: Async hook lifecycle is under-specified -- timeout enforcement, process cleanup, and error propagation are unknown

**Severity:** The plan assumes `async: true` hooks behave like synchronous hooks with a longer leash, but Claude Code's documentation does not guarantee this.

OBS-3's hooks.json sets `async: true` on PreToolUse, PostToolUse, and PostToolUseFailure. The plan's emitter relies on this for the fire-and-forget model. But the plan does not address:

1. **Does Claude Code enforce the `timeout` field on async hooks?** If yes, the 5s timeout applies and the plan works. If no, a hook with a stale port file that connection-times-out at the OS level (typically 75s on macOS) runs for 75 seconds before failing. With 200+ tool calls, that is hundreds of zombie bunx processes.

2. **What signal does Claude Code send when killing an async hook?** SIGTERM allows graceful cleanup (the AbortController fires, fetch aborts, process exits). SIGKILL does not -- the bunx process and its bun child are orphaned. If Claude Code uses SIGKILL, or if it kills only the parent shell process without propagating to the process group, orphaned bun processes accumulate.

3. **What happens to error output from async hooks?** Synchronous hooks can block with exit code 2. Async hooks presumably cannot block (they are background). But does Claude Code log their stderr? If not, `SIDE_QUEST_HOOK_DEBUG=1` output is lost for the 3 most frequent hook types.

4. **Is there a concurrency limit on async hooks?** If Claude Code fires 10 tool calls in rapid succession (e.g., parallel file reads), that is 10 concurrent PreToolUse hooks + 10 concurrent PostToolUse hooks = 20 simultaneous bunx processes. Each consumes ~30-50MB of memory (Bun runtime baseline). That is 600MB-1GB of transient memory pressure.

**Fix:** Before implementation, empirically verify:
- Run a hook with `async: true` and `timeout: 5`, have it sleep for 30s, observe whether Claude Code kills it at 5s.
- Check if the process group is killed (run `ps` during the test to see if child processes survive parent kill).
- Confirm stderr from async hooks appears in `claude --debug` output.
- Fire 20 concurrent async hooks and observe memory/process count.

Document the findings in the plan. If async hooks have no timeout enforcement, the plan needs a process-level self-destruct: `setTimeout(() => process.exit(0), 4500)` as the first line of the CLI entry point.

---

## 4. Important Observations

### I12: Per-hook negative cache is structurally impossible -- every invocation pays full discovery cost when the server is down

The event-bus-client.ts has `let portCheckFailed = false` (line 34) as a module-level negative cache. When the port file is missing, it sets the flag and all subsequent `postEvent` calls short-circuit. This is effective because the event-bus-client runs in a long-lived process.

OBS-2's hook CLI runs as a fresh process per invocation. There is no cross-invocation state. When the observability server is down for an entire session:
- 412 hook invocations each: spawn bunx, start bun, read stdin, parse JSON, attempt to read port file, find it missing, exit 0.
- Estimated cost per invocation (warm bunx, no git spawn if C5 is fixed): ~40-80ms.
- Aggregate: 16-33 seconds of wasted process spawning across the session.

This is not catastrophic but it is wasteful. The plan should acknowledge this as a known limitation of the per-process execution model and note that a cross-process negative cache (e.g., a `.no-server` sentinel file with a TTL) is a v2 optimization.

**Suggestion:** For v1, accept the cost. For v2, consider a sentinel file: when port file is missing, write `~/.cache/side-quest-observability/{cacheKey}/.no-server` with a 60s TTL. Subsequent hooks check the sentinel first (one stat call) and skip if it exists and is fresh.

### I13: readFileSync('/dev/stdin') has no size cap -- a malformed stdin payload can OOM the process

Claude Code writes hook input as JSON to stdin. Normal payloads are small (1-10KB). But if Claude Code has a bug, or if a future hook type includes large content (e.g., full file contents in PostToolUse `tool_result`), the stdin payload could be arbitrarily large.

`readFileSync('/dev/stdin', 'utf-8')` reads the entire stdin into a single string. A 100MB payload (pathological case) would allocate ~200MB in V8 (UTF-16 internal representation) and likely cause the process to be killed by the OS or timeout.

The existing captains-log.ts has the same pattern and has been running without issues, which suggests Claude Code's stdin payloads are well-behaved in practice. But captains-log only fires once per session (Stop). OBS-2's hooks fire 400+ times.

**Suggestion:** This is low risk for v1 given captains-log's production track record. But add a defensive check after the read: if `stdin.length > 1_000_000` (1MB), log a debug warning and exit 0. This prevents the JSON.parse from attempting to parse a 100MB string.

### I14: Port file staleness has no detection mechanism -- stale port = connection timeout on every hook

When the observability server crashes without cleaning up its port file, `discoverPort` returns the stale port number. Every subsequent hook attempts to connect to a port where nothing is listening. The OS-level connection timeout on macOS for localhost is fast (immediate ECONNREFUSED if the port is closed), so this is actually benign in the common case -- the fetch fails immediately and the 500ms timeout is never reached.

However, if the port has been recycled by another process (e.g., a different server binds to the same port), the hook sends POST requests to an unrelated service. This is a data leak, albeit to localhost. The POST body contains session IDs, tool names, and potentially sensitive input previews.

The probability is low (ephemeral port range is large, and the observability server uses a specific port range), but non-zero.

**Suggestion:** Add a lightweight handshake: include a `X-SQ-App: observability` header in the POST, and have the server validate it. If a future version adds a server health endpoint, the hook can verify the port is actually the observability server before sending data. For v1, document the risk and accept it.

### I15: The per-hook execution timeline does not account for bunx module resolution variance

The plan estimates the warm path at 60-140ms. This assumes bunx's module cache is warm (package already resolved and cached in the temp directory). But bunx's caching behavior is not deterministic:

1. **Temp directory cleanup:** macOS periodically cleans `/private/var/folders/`. If the bunx cache is evicted mid-session, subsequent hooks cold-start. Cold bunx resolution is 500ms-3s depending on npm registry latency.

2. **Multiple bunx versions:** If Bun is upgraded mid-session (unlikely but possible via `brew upgrade`), the bunx cache key changes and all hooks cold-start.

3. **Disk pressure:** Under heavy disk I/O (large git operations, builds), the bunx cache read can be slow (SSD: negligible; NFS/network mount: significant).

For a 200-tool-call session, even 5% of hooks hitting cold cache (10 hooks * 2s each = 20s) is noticeable. With `async: true`, users do not experience this directly (no blocking), but the process table accumulates more concurrent hooks because slow hooks overlap with new ones.

**Suggestion:** This is inherent to the bunx execution model and not fixable without changing the architecture (e.g., moving to `bun run ${CLAUDE_PLUGIN_ROOT}/hooks/...` like the git and enterprise plugins do). The plan should document the expected variance and note that switching from bunx to a local script (avoiding npm resolution entirely) is the escape hatch if bunx latency becomes a production problem.

---

## 5. Nice-to-Haves

1. **Process-level self-destruct timer.** Add `setTimeout(() => process.exit(0), 4500)` as the very first line of the CLI entry point, before any imports. This guarantees the process dies before Claude Code's 5s timeout regardless of what hangs (stdin, git, fetch, DNS). The 500ms margin allows cleanup. This is defense-in-depth against unknown hang modes.

2. **Startup timing telemetry.** When `SIDE_QUEST_HOOK_DEBUG=1`, emit timing for each phase: `stdin_ms`, `git_ms`, `port_ms`, `fetch_ms`, `total_ms`. This costs nothing in production and is invaluable for diagnosing "hooks feel slow" reports.

3. **Consider `bun run` instead of `bunx` for the hook command.** The git plugin, enterprise plugin, bun-runner, biome-runner, and tsc-runner all use `bun run ${CLAUDE_PLUGIN_ROOT}/hooks/<script>.ts`. Only the agentic-orchestration plugin uses `bunx`. Using `bun run` with a local script eliminates: npm resolution latency, bunx cache corruption risk, cold-start variance, and the `private: true` publishing blocker (C2 from OBS-3 pass 1). This is arguably a critical fix rather than a nice-to-have, but I am deferring to OBS-3's scope since it owns the hooks.json registration.

---

## 6. Questions for the Author

1. **Have you empirically tested async hook timeout enforcement?** The plan's fire-and-forget model depends on Claude Code killing async hooks at the configured timeout. If async hooks run to completion (no timeout enforcement), the entire resource model changes. A 30-second test would resolve this.

2. **Why `execSync('git rev-parse')` instead of walking the directory tree?** The event-bus-client avoids subprocess spawns entirely. Was there a specific reason to use `execSync` for app root canonicalization, or was this inherited from an earlier draft?

3. **What is the expected stdin payload size for PreToolUse with large tool inputs?** If a user writes a 50KB file via the Write tool, does Claude Code include the full file content in the PreToolUse stdin payload? If so, 200 tool calls with 50KB payloads = 10MB of aggregate stdin data parsed across the session.

4. **Is the one-server-per-project model intentional?** The emitter uses `getAppCacheKey(appRoot)` to locate the port file. Different git roots produce different cache keys. If a developer works across 3 projects in one day, they need 3 running observability servers. Is this the intended deployment model, or should there be a single server that accepts events from multiple projects?

5. **What is the recovery path when a user reports "my dashboard shows no events"?** Today the answer is: check if the server is running, check if the port file exists, check if `SIDE_QUEST_EVENTS` is not set to 0, run with `SIDE_QUEST_HOOK_DEBUG=1`. Is this sufficient, or should there be a `side-quest-obs doctor` command?

---

## 7. Synthesis

Across three review passes, the plan has been examined for architectural soundness (Pass 1), scope discipline (Pass 2), and operational resilience (this pass). The core design -- config-driven dispatch, fire-and-forget emit, 500ms timeout, silent failure -- is correct and ships well. The accumulated review findings cluster into three themes:

**Resolved by prior passes:** Type alignment with OBS-1 (C1), import path errors (C2), dead types (C3), premature directory structure (C4), plugin.json inconsistencies (I6), and scope bloat (I7-I11). These are all addressable during implementation.

**New from this pass:** The git subprocess on every hook invocation (C5) is the single highest-impact finding across all three passes. It introduces 412 process spawns per session that the existing codebase explicitly avoids. This is straightforward to fix (10-line directory walk) and must be fixed before implementation. The async hook lifecycle ambiguity (C6) is the highest-uncertainty finding -- it may be fine or it may create zombie process accumulation, and a 30-second empirical test resolves it.

**Residual risk after all fixes:** The per-process execution model (no cross-invocation caching, no negative cache, no circuit breaker) means the system degrades gracefully but wastefully when the server is down. This is acceptable for v1 best-effort telemetry. The bunx cold-start variance is inherent to the distribution model and is mitigated by the `async: true` configuration on high-frequency hooks. The plan is implementation-ready after C5 and C6 are addressed.
