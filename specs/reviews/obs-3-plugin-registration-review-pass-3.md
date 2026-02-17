# OBS-3 Plugin Registration Review -- Pass 3 (Operator)

**Reviewer lens:** Failure modes, recovery behavior, performance under load, "what breaks at 3am?"

---

## 1. Verdict

**REQUEST CHANGES**

The accumulated reviews have correctly identified the core execution model failure (C3), the redundant npm package (C4), and the event count mismatch (C1/C2). This Operator pass finds three additional issues that the prior reviewers missed -- two of them critical at runtime.

---

## 2. Strengths

- The process spawn budget analysis is accurate. 710 spawns per session is the honest number and not a reason to block -- the existing git plugin already contributes ~600 of those.
- The 500ms abort-and-continue pattern in `event-bus-client.ts` is exactly the right graceful degradation model. The negative-caching of `portCheckFailed` means a downed server costs exactly one port-file stat per hook process, not a 500ms timeout per call.
- `*` as a PreToolUse/PostToolUse matcher is consistent with how `agentic-orchestration` already uses it for async community-intel refresh. The precedent exists.

---

## 3. Critical Issues (NEW -- not repeats of Pass 1/2)

### C5: The git plugin.json has no `"hooks"` field -- hooks.json may be an orphan

The git plugin's `.claude-plugin/plugin.json` has:

```json
{
  "name": "git",
  "skills": ["./skills/git-expert"],
  "commands": [...]
  // NO "hooks" field
}
```

The enterprise plugin similarly has no `"hooks"` field. If hook discovery is NOT convention-based (i.e., requires explicit `"hooks": ["./hooks"]`), these hooks files are NOT being loaded. The observability hooks would silently do nothing -- exactly like git and enterprise hooks may be doing right now.

**Failing path:** OBS-3 ships. Author tests hooks by running the script directly. Tests pass. Plugin goes live. Zero events ever fire because the plugin.json wiring is missing. Nobody notices because observability of observability is zero.

This must be verified empirically: does the git plugin's command-logger actually accumulate entries in `~/.claude/logs/git-command-log.jsonl`? If yes, convention-based discovery works. If no, the entire existing hook infrastructure is broken and OBS-3 is being planned on a foundation that isn't wired up.

### C6: Multiple Stop hooks with conflicting timeout budgets create unbounded session-end latency

At session Stop, three hooks fire (Claude Code may serialize Stop hooks across plugins):

| Hook | Plugin | Timeout |
|------|--------|---------|
| `auto-commit-on-stop.ts` | git | 10s |
| `captains-log.ts` | enterprise | 15s |
| observability stop hook | OBS-3 | 5s |

Worst case: 10s + 15s + 5s = **30 seconds of blocking latency at session end.** The user sees the terminal hang for up to 30 seconds after every session close. `auto-commit-on-stop.ts` calls git (can block on credential helpers, network pushes, slow index). `captains-log.ts` calls `readFileSync` on the full transcript (unbounded size -- a 200-tool-call session transcript could be tens of MB).

The plan adds a 5s hook to an already-expensive Stop chain without acknowledging the compound effect. At 3am with a stalled git credential dialog and a 50MB transcript, session end hangs for 30 seconds minimum.

---

## 4. Important Observations (NEW)

### I9: The negative cache in `event-bus-client.ts` is process-scoped, but hooks are single-use processes

```typescript
// event-bus-client.ts
let portCheckFailed = false
```

This module-level negative cache skips the port-file check after a first miss. The optimization is designed for long-running processes. But every hook invocation is a fresh `bun run` process. The cache is initialized to `false` on every spawn. The "optimization" never fires.

This means the 500ms timeout is the actual worst-case floor when the server is down, not an edge case. In a 200-tool-call session with the server down, that's 200 x 500ms = potentially 100 seconds of serial timeout overhead spread across the session. With the `*` matcher, every tool call fires a hook. The negative cache never helps.

The fix: use port-file non-existence as the fast path. If `portFile` doesn't exist, exit in microseconds. This already works correctly for the stat call. The issue is when the port file exists but the server is dead -- then the 500ms fetch timeout fires every single time.

### I10: Bunx cache corruption will silently drop all observability events

Nathan's known issue (CLAUDE.md): bunx caches packages in temp directories that can become corrupted. The proposed `bunx` execution model combines this known failure mode with hooks that are designed to be fire-and-forget. When the bunx cache is corrupted:
- The hook process exits non-zero
- Claude Code's hook runner swallows the error
- No events reach the observability server
- No user-visible indication anything is wrong

The corruption is per-package, not global. `@side-quest/observability` can fail while other bunx packages work fine. The user has no way to distinguish "server is down" from "bunx cache is corrupted" from "hooks are wired incorrectly" (C5). All three failure modes produce the same symptom: no data.

### I11: The Stop hook must handle `stop_hook_active` recursion guard

`captains-log.ts` has:
```typescript
if (input.stop_hook_active) {
  process.exit(0);
}
```

If the observability stop hook triggers further session activity (unlikely but possible), the `stop_hook_active` guard must be present. The plan doesn't mention this. The existing enterprise hook correctly handles it and OBS-3 must too.

---

## 5. Nice-to-Haves

- Add a `SIDE_QUEST_OBS_DEBUG=1` env var that causes hooks to log port-file path and server response to stderr. Currently when nothing works, diagnosis requires `claude --debug` and grepping through verbose output.
- Consider a health-check command (`just obs-health` or `/obs:status`) that tests the full chain: port file exists, server responds, event accepted. No fast diagnostic path exists today.
- The 500ms emission timeout in `event-bus-client.ts` has no jitter. If multiple hooks fire near-simultaneously, they all time out at the exact same millisecond. Not a correctness issue, but worth noting.

---

## 6. Questions for the Author

1. **C5 confirmation:** Is the git plugin's hooks.json actually firing today? Run a session with the git plugin enabled and check `~/.claude/logs/git-command-log.jsonl` -- does it accumulate entries? If not, the entire existing hook infrastructure is broken and OBS-3 is being planned on top of a foundation that isn't wired up.

2. **I9 compound timeout:** Have you measured what happens to session latency when the observability server is not running and the `*` PreToolUse/PostToolUse hooks fire? Each hook spawns a process, connects to a nonexistent server, waits 500ms, aborts, exits. In a 200-call session that's potentially 100+ seconds of aggregate blocking latency.

3. **Stop chain ordering:** Does Claude Code guarantee the order Stop hooks fire across plugins? If they run in parallel, multiple hooks reading `transcript_path` simultaneously creates a potential race. If they run serially, the compound timeout is the real concern (C6).

4. **Graceful degradation UX:** When the observability server is down, what does Nathan see? Nothing? Stderr message? Does `claude --debug` show anything useful? What's the expected troubleshooting path?

---

## 7. Synthesis

Three passes of review have built a coherent and complete picture of why this plan needs rework. The Architect correctly identified the 14-vs-5 event mismatch and the package resolution failure. The Skeptic correctly identified that `bunx` is the wrong execution model and that the event-bus-client already solves the problem locally. This Operator pass adds two critical findings: the git and enterprise plugin.json files may be missing their `"hooks"` declarations (C5), meaning the hooks infrastructure may not actually be functioning today, and the additive Stop hook latency creates a worst-case 30-second session-end hang (C6).

The residual risk after all three passes is concentrated in three areas. First, **verification risk**: nobody has confirmed that `git/hooks/hooks.json` actually loads. If hooks aren't wired, the plan builds on broken infrastructure. Second, **execution model risk**: the `bunx` approach is wrong (Skeptic C3), and the `bun run` alternative has the I9 problem where the negative cache never fires in single-use processes. The fix is trivial but must be stated explicitly. Third, **operational risk**: zero observability on observability (I10), missing plugin.json wiring (C5), and no diagnostic tooling means that when this breaks, there is no fast path to diagnosis. The plan needs a health-check mechanism before it ships.

The core deliverable -- two JSON files -- remains the right minimal scope. But those two JSON files depend on the execution model being changed (C3), the event count matching OBS-2 v1 (C1), and the hook discovery mechanism being verified (C5).
