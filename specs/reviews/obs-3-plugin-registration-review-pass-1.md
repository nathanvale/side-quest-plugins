# OBS-3 Plugin Registration Review -- Pass 1 (Architect)

**Reviewer lens:** System boundaries, API contracts, integration points, consistency with existing patterns

**Plan:** `/Users/nathanvale/.claude/plans/obs-3-plugin-registration.md`

**Cross-references:**
- OBS-2 finalized plan: `/Users/nathanvale/.claude/plans/obs-2-hook-cli.md`
- OBS-1 finalized plan: `/Users/nathanvale/.claude/plans/obs-1-event-server.md`
- OBS-6 Architect review: `specs/reviews/obs-6-voice-tts-review-pass-1.md` (C2)
- Existing hooks.json: enterprise, git, agentic-orchestration, bun-runner
- Existing plugin.json: enterprise, newsroom

---

## 1. Verdict

**REQUEST CHANGES**

The plan is stale relative to OBS-2's finalized design. The most critical problem is that OBS-3 registers 14 hook events while OBS-2 v1 ships exactly 5 CLI handlers -- nine registered hooks invoke CLI subcommands that do not exist. Additionally, the `bunx` distribution blocker (`private: true` on `packages/server`) remains unresolved and was previously flagged as a blocker in OBS-6's Architect review (C2). Both issues must be fixed before these two JSON files are created.

---

## 2. Strengths

- **The plugin.json structure is correct and minimal.** `name`, `description`, no `skills`/`agents`/`commands` -- this is the right shape for a hooks-only plugin, consistent with enterprise and newsroom patterns.

- **`*` matcher rationale is sound.** Observability is cross-plugin by definition. Filtering at the hook matcher level would require per-plugin entries and is the wrong layer. Dashboard filtering is the correct approach.

- **Coexistence analysis with captains-log.ts is thorough.** The plan correctly identifies that both fire on Stop, correctly explains they write to different destinations for different consumers, and correctly concludes no changes to the enterprise plugin are needed.

- **5s timeout reasoning is appropriate for warm-cache bunx.** The characterization of the warm execution path (<200ms total) is accurate. The timeout budget is defensible for the fire-and-forget POST architecture OBS-2 implements.

---

## 3. Critical Issues (must fix before implementation)

### C1 -- Blocking: OBS-3 registers 14 events; OBS-2 v1 ships only 5

The OBS-3 plan was written against an earlier OBS-2 draft. OBS-2's 3-pass review explicitly cut 9 events to v2. OBS-2's finalized plan ships exactly 5 handlers:

| Event | OBS-2 v1 status |
|-------|-----------------|
| SessionStart | Shipped |
| PreToolUse | Shipped |
| PostToolUse | Shipped |
| PostToolUseFailure | Shipped |
| Stop | Shipped |
| SessionEnd | Deferred to v2 |
| Notification | Deferred to v2 |
| UserPromptSubmit | Deferred to v2 |
| SubagentStart | Deferred to v2 |
| SubagentStop | Deferred to v2 |
| PreCompact | Deferred to v2 |
| PermissionRequest | Deferred to v2 |
| TeammateIdle | Deferred to v2 |
| TaskCompleted | Deferred to v2 |

When Claude Code fires a hook invoking `bunx @side-quest/observability hook subagent-start`, the OBS-2 v1 dispatcher finds no handler, logs the unknown event (only if `SIDE_QUEST_HOOK_DEBUG=1`), and exits 0. Silent drop, no crash. This means:

1. Operators will not know 9 registrations are no-ops without reading debug logs
2. 9 bunx cold-starts per session spend timeout budget producing no data
3. hooks.json advertises a contract that does not exist, misleading future maintainers

**Fix:** OBS-3's hooks.json must match OBS-2 v1's event scope -- 5 events only. The remaining 9 events are added when OBS-2 v2 ships.

### C2 -- Blocking: `packages/server` is `private: true`; `bunx @side-quest/observability` cannot resolve

OBS-3 states: "Domain 2 (Hook CLI) must be complete -- `@side-quest/observability` must be published to npm so `bunx` can resolve it."

OBS-1's `packages/server/package.json` has `"private": true`. This package is not published to npm. `bunx @side-quest/observability hook session-start` fails with a resolution error on every invocation.

This was independently flagged as blocking in OBS-6's Architect review (C2).

Options:

- **(A) Flip `private: false` on `packages/server`.** Scope change to OBS-1 that must be explicitly decided.
- **(B) Use `bun run ${CLAUDE_PLUGIN_ROOT}/hooks/<script>.ts`.** Matches git and enterprise patterns. No npm publish required. Unblocks OBS-3 immediately.
- **(C) Separate the CLI into a standalone published package** (`@side-quest/obs-hooks`). Avoids publishing the full server.

Option B is the conservative unblocking choice.

---

## 4. Important Observations (should fix, not blocking)

### I1: plugin.json `hooks` field discrepancy with OBS-2's finalized scaffold

OBS-3's `plugin.json` has no `hooks` field. OBS-2's finalized plan explicitly includes `"hooks": ["./hooks"]`. The git plugin supports OBS-3's claim (no `hooks` field, yet Claude Code discovers hooks.json). However, OBS-2's finalized scaffold is the output of a 3-pass review and should be treated as authoritative. Align with OBS-2's version until Claude Code's discovery behavior is confirmed.

### I2: plugin.json description is stale and inconsistent with OBS-2

OBS-3 has: `"Real-time agent observability - streams Claude Code lifecycle events to a local dashboard"`

OBS-2's finalized scaffold has: `"Real-time agent observability -- streams Claude Code lifecycle events to @side-quest/observability server"`

Use OBS-2's version -- it is more technically precise and came out of the review process.

### I3: No `async: true` on PreToolUse/PostToolUse creates synchronous latency per tool call

PreToolUse and PostToolUse fire on every tool invocation synchronously. With a `*` matcher and 5s timeout, every tool call has a synchronous latency tax: ~200ms warm, up to 5s cold. For a session with 50 tool calls, that's 100 synchronous hook invocations.

The agentic-orchestration plugin uses `"async": true` for its bunx hooks for exactly this reason. Consider `async: true` for PreToolUse and PostToolUse specifically.

### I4: Timeout budget is barely sufficient for cold-cache bunx

Worst-case cold-path: bunx resolution (2-3s) + process startup (50ms) + git rev-parse (500ms) + HTTP POST (500ms) = ~4s. Within 5s budget but barely. Nathan's CLAUDE.md documents bunx cache corruption as a known issue. Consider 10s for SessionStart/Stop (matching git plugin).

### I5: PermissionRequest with `*` matcher warrants investigation before v2

PermissionRequest hooks may block waiting for a decision. A synchronous `*` matcher on PermissionRequest means bunx fires on every permission request -- any delay postpones user interaction. Investigate before adding in v2.

---

## 5. Nice-to-Haves

- **N1:** Generate hooks.json from a script to prevent event name typos as v2 events are added.
- **N2:** Companion README in hooks directory documenting the v1/v2 event boundary.
- **N3:** Document `SIDE_QUEST_EVENTS=0` kill switch in plugin README.

---

## 6. Questions for the Author

**Q1.** OBS-2's finalized plan registers 5 events. OBS-3 registers 14. Which is authoritative?

**Q2.** Has the `packages/server` `private: true` issue been resolved since OBS-6's review flagged it?

**Q3.** Is `"hooks": ["./hooks"]` required in plugin.json or is it convention-based? OBS-2 includes it; OBS-3 omits it.

**Q4.** Should PreToolUse/PostToolUse be `async: true`? Fire-and-forget POST has no ordering requirement.

**Q5.** The testing strategy references `bunx @side-quest/observability server`. If `packages/server` is `private: true`, this also fails. Has the test path been validated?
