# OBS-6 Voice/TTS -- Architect Review Pass 1

**Reviewer:** Architect (system boundaries, data flow, API surface, type safety, integration)
**Date:** 2026-02-17
**Plan:** `/Users/nathanvale/.claude/plans/obs-6-voice-tts.md`
**Cross-references:** OBS-1 (`obs-1-event-server.md`), OBS-2 (`obs-2-hook-cli.md`), master plan (`splendid-watching-diffie.md` section 5f)

---

## 1. Verdict

**REQUEST CHANGES**

The server-side queued playback architecture is the right call -- the reasoning is sound and the
community validation is solid. However there are two blockers that must be resolved before
implementation starts:

1. OBS-6 depends on SubagentStart/SubagentStop, which are OBS-2 v2 events. OBS-2 v1 ships only
   5 events and explicitly defers both to v2. The plan treats this as a resolved dependency ("Domain
   2 must exist") when in fact the specific hook handlers it needs do not exist yet.

2. The plan states voice modules "published to npm" inside `packages/server/src/voice/`. OBS-1's
   `packages/server/package.json` is `"private": true`. This is a factual error in the plan that
   needs to be corrected before the file tree is finalized.

These are fixable without redesigning the system. The remaining issues are important observations
and improvement opportunities.

---

## 2. Strengths

- **Server-side queuing is architecturally correct.** Moving from hook-side TTS to a long-lived
  server with a serial FIFO queue eliminates the overlapping audio problem cleanly. The PlaybackQueue
  design (maxDepth back-pressure, maxAgeMs staleness, clear() on shutdown) is well-considered.

- **Fire-and-forget contract is tight.** The 500ms AbortSignal timeout on `voiceNotify()` and
  the "exit 0 immediately, server handles the rest" principle correctly isolates the hook from any
  voice system failure mode. The timing budget table (section 17) makes this concrete.

- **No new npm dependencies.** Using Bun built-ins for SHA-256, file I/O, and spawning is the right
  call. The voice system adds zero transitive dependencies to the package.

- **Graceful degradation is thorough.** `mode=off`, `mode=pregenerated`, missing API key, missing
  `afplay`/`mpg123`, server not running -- each has an explicit no-op path. Voice is correctly
  treated as non-critical infrastructure.

---

## 3. Critical Issues

### C1 -- Blocking: SubagentStart/SubagentStop are OBS-2 v2 events

The plan states (section 16, "Domain dependencies"):

> Domain 2 (Hook CLI) must exist -- voice POST is called from hook handlers.

This is misleading. OBS-2 v1 ships **5 events only**: SessionStart, PreToolUse, PostToolUse,
PostToolUseFailure, Stop. SubagentStart and SubagentStop are explicitly deferred to v2 in OBS-2's
section 17:

> SubagentStart | Config-driven | Extract agent_id, agent_type [deferred]
> SubagentStop  | Dedicated     | Rich extraction ... [deferred]

The code in OBS-6 section 5 (`handleSubagentStart`, `handleSubagentStop`) lives in handler files
that do not exist in OBS-2 v1. The hook dispatcher in OBS-2 (`handlers/index.ts`) has no
`subagent-start` or `subagent-stop` entries. The `hooks.json` has no SubagentStart or SubagentStop
registrations.

**Consequence:** OBS-6 as written cannot function until OBS-2 v2 ships. The plan must be explicit
about this. Options:

- A: Change the dependency statement to "Requires OBS-2 v2 (SubagentStart/SubagentStop handlers
  deferred -- see OBS-2 section 17)" and sequence OBS-6 after OBS-2 v2.
- B: Ship OBS-6 in two phases: Phase 1 is the server infrastructure (types, config, cache, tts,
  queue, router, CLI), Phase 2 is hook integration once OBS-2 v2 lands.
- C: Treat SubagentStart/SubagentStop as OBS-2 v2 scope and fold the `voiceNotify()` calls into
  the OBS-2 v2 plan rather than OBS-6.

Option B is cleanest -- the voice server infrastructure is independently testable and deliverable
without hook integration.

### C2 -- Blocking: "Published to npm" is factually incorrect

Section 1 (File Tree) states:

> Voice modules live inside `packages/server/` in the `@side-quest/observability` repo
> (published to npm).

OBS-1's `packages/server/package.json` sets `"private": true`. This package is **not published to
npm**. The `bunx @side-quest/observability voice generate-clips` CLI commands (section 11) reference
a package name that does not exist on the npm registry.

The generate-clips CLI, the `bunx @side-quest/observability hook subagent-start` registrations, and
any user-facing documentation need to be aligned with the actual distribution model. If `packages/server`
is meant to be published as part of OBS-6, that is a scope change to OBS-1 that needs to be called
out explicitly and negotiated.

If the intent is that the CLI runs from the local monorepo (e.g., `bun run packages/server/src/cli/index.ts`),
the hooks.json entries need to reflect that.

---

## 4. Important Observations

### I1 -- Module location diverges from master plan

The master plan (section 5f) places voice modules at `packages/server/src/cli/voice/voices.ts` and
`packages/server/src/cli/voice/cache.ts`. OBS-6 moves them to `packages/server/src/voice/` (one
level up, not under `cli/`).

The OBS-6 location is arguably better -- voice is a server concern, not a CLI concern. The router
and queue belong in server-space. But this is a deliberate deviation from the master plan that should
be noted explicitly so the master plan can be updated. If the master plan is treated as a reference
by other implementers, the stale path will cause confusion.

### I2 -- `extractVerdict` is a synchronous `readFileSync` on a potentially large file

Section 12 shows:

```typescript
const content = readFileSync(transcriptPath, 'utf-8')
const tail = content.slice(-2048)
```

This reads the **entire transcript file** into memory to take the last 2KB. Transcript files can
be large (multi-tool sessions easily reach 500KB-2MB). `readFileSync` is blocking -- it holds the
Node/Bun event loop for the duration of the file read. For a hook handler that should return in
<5ms, a synchronous 2MB read on a loaded filesystem is a latency risk.

The plan already notes the 5ms hook budget (section 17). A targeted fix: use `Bun.file().slice()`
or `fs.openSync` + `read` at an offset from the end to read only the last 2048 bytes. This is
possible with a file descriptor and a `seek` to `size - 2048`.

Alternatively, since the hook already exits before voice plays, the verdict extraction could be
moved server-side: SubagentStop sends `transcriptPath` in the POST body and the server reads it
asynchronously. This removes the synchronous file I/O from the hook path entirely and aligns with
the "hooks are dumb POST clients" principle stated in the architecture.

### I3 -- `discoverPort()` reads from disk on every `voiceNotify()` call

The `voiceNotify()` function (section 5) calls `discoverPort()` on every invocation. `discoverPort`
reads a file from `~/.cache/side-quest-observability/*/events.port`. In a multi-agent session,
SubagentStart and SubagentStop events fire frequently. Each call reads from disk.

For a hook process this is acceptable (the process exits after one call). However, if `voiceNotify`
is also called from within a long-running server context in the future, caching the port at startup
would be important.

For the current design (hook-side calls only), document this explicitly. It is not a bug but it is
worth calling out for future maintainers.

### I4 -- Cache key stability with placeholder voice IDs

Section 8 shows:

```typescript
'enterprise:builder-scotty': {
  voiceId: 'TBD_SCOTTISH_MALE',
  ...
}
```

The SHA-256 cache key is computed as `{voiceId}:{text}`. Any clips generated or cached while
`voiceId` is `'TBD_SCOTTISH_MALE'` will produce keys like
`sha256("TBD_SCOTTISH_MALE:Scotty here, Captain...")`. When the real ElevenLabs voice ID is
substituted, every cache key changes and all prior cache entries become orphaned (no longer
matched). The cache directory will accumulate stale entries.

This is mitigated by the `--force` flag on `voice generate-clips`, but only if the operator
remembers to run it. A more robust approach: add a `voices.json` config file (or write the resolved
voice IDs to the cache dir at server startup) so that operators can diff what changed, and run a
`voice invalidate-cache --reason voice-id-changed` to clean up predictably.

Minimum acceptable fix: document in the voice IDs section that changing a voice ID invalidates all
cached clips for that agent and requires running `voice generate-clips --force --agent <type>`.

### I5 -- PlaybackQueue has no SIGTERM cleanup hook

The plan acknowledges this in the behavior table:

> Server shutting down | `queue.clear()` prevents orphan playback

But `queue.clear()` is never wired to SIGTERM in the server registration code (section 13). OBS-1
PR1 already registers `process.on('SIGTERM', cleanup)` which calls `server.stop()`. The voice
system needs to be included in that cleanup: call `playbackQueue.clear()` before stopping the
server, and wait for `proc.exited` if a clip is currently playing.

The current `playOne()` method does `await proc.exited` inside the drain loop, which runs in a
floating promise. On SIGTERM, if `drain()` is mid-await, the spawned `afplay` process becomes an
orphan. The plan's own behavior table says this is handled -- the implementation plan doesn't wire
it up.

Concrete fix: add a `destroy()` method to `PlaybackQueue` that sets a `destroyed` flag, calls
`clear()`, and if `afplay`/`mpg123` is currently running, kills the spawned process
(`proc.kill?.()`) before exiting.

### I6 -- `handleVoiceNotify` has no request body size limit

OBS-1 PR1 added a 1MB body size limit on `POST /events` as an Operator hardening finding. The
`POST /voice/notify` handler in section 4 calls `await req.json()` without any size check. The
body is expected to be small (three string fields), but defence-in-depth suggests adding a 4KB
limit consistent with the minimal payload size.

---

## 5. Nice-to-Haves

### N1 -- `outcome` type widens silently in resolveContext

`resolveContext(phase, outcome)` accepts `outcome?: string` even though `VoiceNotification`
declares `outcome?: 'pass' | 'fail'`. The `handleVoiceNotify` function reads `body.outcome`
directly without re-validation after `req.json()`. A runtime value of `outcome: 'PASS'` (uppercase)
would fall through to the generic `'stop'` context and lose the pass/fail distinction.

Validate `outcome` explicitly after JSON parse: `if (body.outcome !== 'pass' && body.outcome !== 'fail') body.outcome = undefined`.

### N2 -- Scotty has generic `stop` phrases, not `stop_pass`/`stop_fail`

The phrase library has McCoy with `stop_pass` / `stop_fail` context variants. Scotty only has
`stop`. When the outcome is `pass` or `fail`, `resolveContext` returns `stop_pass` or `stop_fail`,
but Scotty has no phrases for those contexts. The fallback in `selectPhrase` correctly degrades to
`stop`. This is intentional (Scotty doesn't deliver verdicts) but it is implicit. A comment in
`phrases.ts` clarifying that Scotty/Computer/Spock/Mickey use `stop` only (not pass/fail) would
prevent future confusion when adding new characters.

### N3 -- `generate-clips` CLI is not in the file tree section but is in section 1

Section 1 (File Tree) lists `generate-clips.ts` as one of the 9 source files. Section 11 describes
the CLI commands. However section 2 (implementation sequence, step 12) lists it last and marks it
as depending on voices, phrases, cache, tts. That is correct. But the CLI also surfaces four
sub-commands (`list-cached`, `clear-cache`, `test <agent>`) that are not in the file tree. Are
these in `generate-clips.ts` or a separate CLI routing module? Clarify.

### N4 -- Windows playback path has a shell injection surface

Section 3 (PlaybackQueue) builds the Windows command as:

```typescript
return ['powershell', '-NoProfile', '-c',
  `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`]
```

`filePath` is a value read from the local disk cache directory (which the server controls), so in
practice it is trusted. However if the cache directory can be influenced by an external actor
(symlinks, TOCTOU on `~/.cache`), a crafted filename could inject PowerShell. Replace with a
variable reference: `['powershell', '-NoProfile', '-c', '(New-Object Media.SoundPlayer $args[0]).PlaySync()', '-args', filePath]`.

---

## 6. Questions for the Author

**Q1.** Given that SubagentStart/SubagentStop are OBS-2 v2 events and OBS-2 v1 does not have them,
is OBS-6 intended to ship before, alongside, or after OBS-2 v2? The implementation sequence in
section 16 says "Domain 2 must exist" but does not distinguish v1 from v2. What is the actual gate?

**Q2.** The plan says voice modules live in `packages/server/` which is `"private": true` (per
OBS-1). The `bunx @side-quest/observability voice generate-clips` syntax implies the package is
published. How is the voice CLI distributed to end users? Is OBS-6 a trigger to flip `private: false`
on `packages/server`?

**Q3.** `extractVerdict` runs a synchronous `readFileSync` on the full transcript file inside the
hook handler (pre-server-response). The architecture principle is "hooks are dumb POST clients that
fire a notification and exit immediately." Why is transcript parsing happening in the hook rather
than server-side? If the hook sends `transcriptPath` in the POST body, the server can read it
asynchronously and the hook never touches the filesystem.

**Q4.** The `playOne()` method stores `proc` as a local variable inside the async drain loop.
On SIGTERM, is there any mechanism to reach this `proc` to kill it? The `PlaybackQueue` class has
no reference to the currently-playing process. How does the author intend to kill the in-flight
`afplay` process on shutdown?

**Q5.** The VOICE_MAP in section 8 includes `newsroom:beat-reporter` (Mickey Malone). The newsroom
plugin is a separate domain. Is the voice system intended to be a shared cross-plugin concern, or
is this incidental? If cross-plugin, what is the update path when a new plugin (e.g., `dojo:`) adds
agents? Hard-coded entries in `voices.ts` do not scale.
