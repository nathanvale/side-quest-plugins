# OBS-6 Voice/TTS System Review -- Pass 2 (Skeptic)

**Reviewer lens:** Scope creep, over-engineering, YAGNI violations, "what can we cut?"

---

## 1. Verdict

**REQUEST CHANGES**

OBS-6 ships 18 files for a voice notification system. OBS-4 (the entire real-time Vue dashboard) ships 8 files after Skeptic cuts. Voice is twice the file count of the dashboard. Before writing any code, ask: what is the smallest thing that produces audible feedback when an agent runs?

The answer is: one pre-recorded mp3 file per agent, one `afplay` call in a hook, and nothing else. OBS-6 does not ship that. It ships a full API client, a cross-platform audio abstraction, a weighted random phrase engine, four CLI subcommands, five per-character env var overrides, a two-tier cache directory structure, and 8 unit test files -- for a feature that has no trigger events in v1.

SubagentStart and SubagentStop are OBS-2 v2. Voice literally has nothing to fire against in the current hook schema. This is the same pattern that killed EngagePipeline in OBS-4 and HITL in OBS-5: infrastructure built ahead of the events that would trigger it.

The plan has genuine architectural merit. The server-side serial queue is the right call. The fire-and-forget POST pattern is correct. But the feature set around it needs the same cut discipline that reduced OBS-4 from 16 to 8 files and OBS-5 from 7 sub-stages to a justfile.

---

## 2. Strengths

- **Server-side serial queue is the right architecture.** Moving audio management from short-lived hook processes to the long-lived server solves the overlapping playback problem cleanly. The `PlaybackQueue` design -- FIFO drain, maxDepth back-pressure, maxAgeMs staleness -- is robust without being over-engineered. This is the core insight worth keeping.

- **Fire-and-forget POST pattern is correct.** The hook does one HTTP POST with a 500ms timeout and exits. The server does all the work asynchronously. This is exactly the pattern OBS-2 uses for event emission, and it is right here too.

- **No new npm dependencies.** Using `afplay`, `Bun.spawn`, `globalThis.fetch`, and `Bun.CryptoHasher` keeps the package clean. This is a discipline that should be maintained.

- **"not tested" list is honest.** Explicitly calling out that actual ElevenLabs calls and actual audio playback are out of scope for tests shows good judgment about what automated testing can and cannot do here.

---

## 3. Critical Issues (must fix)

### C1: Voice has no trigger events in OBS-2 v1 -- same blocker that killed HITL and EngagePipeline

The plan requires SubagentStart and SubagentStop hook events. OBS-2 v1 ships exactly 5 events: SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, and Stop. SubagentStart and SubagentStop are explicitly listed in OBS-2's deferred v2 table, blocked on "Dashboard (Domain 4) ships."

OBS-5 Skeptic review (C1): "OBS-2 v1 defers SubagentStart/SubagentStop to v2. There are no HITL events in the v1 event stream. Stage 5d will build infrastructure with nothing to trigger it."

Replace "Stage 5d" with "OBS-6" and the statement is identical.

The plan acknowledges this obliquely in the Architecture section: "Hook events (SubagentStart/SubagentStop) fire 100% reliably with agent_type in stdin." They fire reliably -- in v2. In v1, they do not fire at all.

**Action:** OBS-6 cannot ship as a triggered system until OBS-2 v2 lands. The options are:
- (a) Block OBS-6 entirely on OBS-2 v2. No code written until SubagentStart/Stop are in the hook schema.
- (b) Ship OBS-6 v1 as a manual-only pre-generation tool: run `voice generate-clips` once, play clips on demand via CLI. No server integration, no hook integration. Prove the audio quality and voice IDs work.
- (c) Wire voice to Stop events (which do fire in v1) as a temporary "session ended" notification, with the understanding that per-agent triggering comes in v2.

None of these match the current plan. The current plan builds the full server-side integration for events that will not fire.

### C2: 18 files for a subsystem that cannot be end-to-end tested until OBS-2 v2

Counting the file tree: 9 source files, 8 test files, 1 CLI script. Compare:
- OBS-4 (entire Vue dashboard): 8 files after Skeptic cuts
- OBS-5 (server lifecycle + DevOps): static serving one-liner + a justfile
- OBS-6 (voice notification): 18 files

The ratio is inverted. Voice is a notification side-channel. The dashboard is the primary product. A side-channel should not be twice the implementation cost of the primary product.

The 18-file count is driven by fine-grained module separation: `config.ts`, `voices.ts`, `phrases.ts`, `cache.ts`, `tts.ts`, `playback.ts`, `queue.ts`, `router.ts`, each with a paired test. Some of these separations are justified (queue is genuinely complex). Others can be collapsed.

**Action:** See "What v1 minimal looks like" section below for a concrete 5-file alternative.

### C3: ElevenLabs live TTS integration is over-specified for v1

The plan builds a full `tts.ts` API client with model selection, stability/similarity_boost params, timeout, and error handling -- then immediately acknowledges that all 34 phrases need to be pre-generated before first run anyway ("Run `voice generate-clips` once to warm all 34 phrases").

If every phrase must be pre-generated before the system is useful, then the live TTS path is an optimization for a scenario ("new phrase added, cache miss at runtime") that should not happen in normal use. The pre-generation step makes live TTS a dev/maintenance tool, not a runtime requirement.

For v1, pre-generated clips as the **only** path is simpler, cheaper (no API key required for users), and sidesteps the rate-limiting and credit-burning problems entirely. Live TTS can be added in v1.1 once voice IDs are known and phrases are validated.

**Action:** Cut `tts.ts` and `tts.test.ts` from v1. Ship `mode=pregenerated` as the only mode. Add a `generate-clips.ts` script (or just a shell script) for the one-time generation step.

---

## 4. Important Observations (should fix)

### I1: 34 phrases with weighted random selection is over-specified for v1

The phrase library has per-phrase weights (1, 2, or 3), four context variants (`start`, `stop`, `stop_pass`, `stop_fail`), a fallback chain (`stop_fail` -> `stop`), and a weighted random selection algorithm. This is appropriate for a shipped product where phrase variety matters. For v1, you do not know yet whether you will keep 34 phrases, collapse some characters, or remove the `outcome` distinction entirely.

Weighted selection requires knowing which phrases feel natural, which ones get old fast, and which voice IDs actually sound right. You cannot know any of that before pre-generating and listening to the clips. Building a weighted random engine before that listening session is speculation.

A flat random from a small set (2-3 phrases per character per context) is sufficient for v1. The weights can be added in v1.1 after a listening session reveals which phrases to prefer.

The selection algorithm itself is fine (7 lines). The issue is the 34-phrase corpus requiring validation work before the weights make any sense.

**Recommendation:** Reduce to 2 phrases per character per applicable context (no weights -- flat random). That is 10-14 phrases total. Validate by listening before expanding.

### I2: Four CLI subcommands for a voice cache is not justified

The plan specifies `generate-clips`, `list-cached`, `clear-cache`, and `test` as subcommands under `voice`. Compare to the rest of the CLI surface:

- OBS-2 has 2 commands: `hook <event>` and `server`.
- OBS-5 has 7 justfile recipes for the entire server lifecycle.
- OBS-6 proposes 4 subcommands for the voice cache alone.

`list-cached` and `clear-cache` are operational convenience commands. They answer "what mp3 files are in `~/.cache/side-quest-observability/voices/`?" The answer is already available via `ls` and `rm -rf`. Building CLI wrappers for directory listing and deletion is YAGNI.

**Recommendation:** Ship `generate-clips` only. Add `test <agent>` as a flag on generate-clips (`--test` or `--play`). Delete `list-cached` and `clear-cache` entirely -- they wrap `ls` and `rm`.

### I3: Cross-platform playback (Windows PowerShell, Linux mpg123) is dead code for this project

The `buildCommand()` method in `PlaybackQueue` has three branches: `afplay` (macOS), `mpg123 -q` (Linux), and `powershell -NoProfile -c (New-Object Media.SoundPlayer...)` (Windows).

Nathan's hardware: MacBook Pro M4 Pro and Mac Mini M4 Pro. Both macOS. The observability server is a personal dev tool. There is no Windows CI target, no Linux server deployment, no portability requirement stated anywhere in the OBS plan.

The Linux `mpg123` branch is called out in the plan's own challenges table as "Graceful degradation to silence; document as optional dependency" -- meaning it is acknowledged as potentially non-functional. The Windows branch requires testing on a platform that is not available.

Dead code in a shipped module that is never exercised is a test coverage gap and a maintenance liability. The OBS-2 Skeptic review accepted "Cross-platform stdin (non-/dev/stdin): deferred to v2. Windows support needed." The same logic applies.

**Recommendation:** Remove the Linux and Windows branches from `buildCommand()`. `afplay` only. Add a comment: "// Linux/Windows support deferred -- use pre-generated clips with a custom playback command." No test needed for code that does not exist.

### I4: Five per-character env var overrides are premature configuration surface

The config table specifies `SIDE_QUEST_VOICE_SCOTTY`, `SIDE_QUEST_VOICE_MCCOY`, `SIDE_QUEST_VOICE_COMPUTER`, `SIDE_QUEST_VOICE_SPOCK`, and `SIDE_QUEST_VOICE_MICKEY` as runtime voice ID overrides. These exist to allow swapping voice IDs without code changes.

But the voice IDs in the plan are all `TBD_*` placeholders. The entire premise of these env var overrides is that you have picked voice IDs and might want to change them. You have not picked voice IDs yet.

The right time to add runtime override support is after the voice IDs are selected and hardcoded, and you discover that changing them requires a code change. That is a real friction point. It is also not a v1 problem -- it is a post-validation problem.

**Recommendation:** Remove per-character env var overrides from v1 config. Ship hardcoded voice IDs with a comment "// Replace with your ElevenLabs voice IDs after auditioning." One global `ELEVENLABS_API_KEY` env var plus `SIDE_QUEST_VOICE=off|pregenerated|full` is sufficient.

### I5: McCoy verdict extraction couples voice tightly to transcript parsing

`extractVerdict()` reads the last 2KB of a transcript file and regex-matches `VERDICT: PASS` or `VERDICT: FAIL`. This is transcript parsing logic inside a voice notification handler.

This creates a coupling between two concerns: (1) firing the audio event, and (2) determining what phrase to play. The plan's own architecture says the server handles "phrase selection" -- but extracting the verdict happens in the hook handler (Domain 2), not in the server.

More importantly, SubagentStop is a v2 hook event. `extractVerdict()` is dead code in v1 for the same reason the rest of the hook integration is: the event does not fire.

**Recommendation:** Defer `extractVerdict()` to v2, alongside the full SubagentStop handler. When it ships, route the `outcome` field through the event envelope (OBS-2 v2 SubagentStop payload) rather than re-parsing the transcript in the voice handler.

---

## 5. Summary of Recommended Cuts

| Item | Files / complexity saved | Defer to |
|------|--------------------------|----------|
| Full hook integration (SubagentStart/Stop POST) | 0 new files, but removes all voice wiring from Domain 2 handlers | v2, blocked on OBS-2 v2 SubagentStart/Stop |
| Live TTS (`tts.ts` + `tts.test.ts`) | 2 files | v1.1 after voice IDs validated and pre-generated clips confirmed working |
| `list-cached` + `clear-cache` CLI subcommands | 0 files (no dedicated file) -- reduces generate-clips.ts scope | Delete permanently (wrap `ls`/`rm`, not justified) |
| Cross-platform playback (Linux + Windows branches) | ~15 lines in `playback.ts`, 1 test file reduced | v2 if portability ever needed |
| Per-character env var overrides (5 vars) | 0 files -- reduces config.ts scope | v1.1 after voice IDs are selected and hardcoded |
| `extractVerdict()` / McCoy outcome routing | 0 new files -- removes cross-concern coupling from Domain 2 | v2, alongside OBS-2 v2 SubagentStop dedicated handler |
| 34 phrases with weighted selection | Reduces phrases.ts to ~20 lines, phrases.test.ts simplified | v1.1 after listening session validates phrase variety |
| **Total** | **2 files cut outright, 4 files significantly reduced** from 18-file plan | |

---

## 6. What v1 minimal looks like

The smallest thing that delivers audible agent feedback:

**Trigger:** `Stop` event (fires in OBS-2 v1). One clip plays when any session ends. Not per-agent, not per-character -- just a confirmation sound.

**Files (5 total):**

```
packages/server/src/voice/
  types.ts          -- VoiceNotification, QueueItem only (drop VoiceConfig complexity for now)
  cache.ts          -- get(hash) -> path | null, put(hash, buffer) -> path (flat dir only, no pregenerated subdir)
  queue.ts          -- PlaybackQueue as written (this is the core, keep it)
  router.ts         -- POST /voice/notify: look up pre-generated mp3 by agentType, enqueue, return 200
  router.test.ts    -- request parsing, queued/not-queued responses

voice/generate-clips.ts  -- CLI: for each agent, synthesize one phrase via ElevenLabs, write to cache
```

**Phrase strategy:** One hardcoded phrase per character per phase. No weights. No random selection. No `phrases.ts` module -- the phrase is a string constant in `voices.ts` next to the voice ID.

**Playback:** `afplay` only. macOS. No platform detection needed.

**Mode:** `pregenerated` only in v1. Run `voice generate-clips` once. If the file is not in cache, skip silently. No live TTS fallback.

**Hook wiring:** Wire to `Stop` event (OBS-2 v1, fires today) with a generic "session complete" phrase from the Computer voice. Per-agent voice triggering defers to v2 when SubagentStart/Stop ship.

**Config:** Two env vars -- `ELEVENLABS_API_KEY` (for one-time clip generation) and `SIDE_QUEST_VOICE=off|on` (kill switch).

This is 5-6 files (vs 18), one mode (vs three), one platform (vs three), one phrase per context (vs 34), and zero dependency on v2 events. It delivers the core value: you hear a sound when Claude Code finishes. Everything else -- character selection, phrase variety, outcome-based McCoy lines, cross-platform -- is v1.1 or v2.

---

## 7. Questions for the Author

1. **SubagentStart/SubagentStop are OBS-2 v2.** What is the actual timeline for OBS-2 v2? If it is weeks away, OBS-6's hook integration is blocked for weeks. If it is months away, building the voice server integration now is pure speculation. Has the dependency been formally stated in the plan ordering?

2. **Voice IDs are all `TBD_*` placeholders.** Have any ElevenLabs voices been auditioned? The per-character voice parameter tuning (`stability: 0.7`, `similarityBoost: 0.8`, etc.) implies a specific voice ID is already in mind. Without known voice IDs, `generate-clips` cannot run, the cache cannot be pre-populated, and no audio can be heard. How far are we from having real voice IDs to put in VOICE_MAP?

3. **The plan pre-generates 34 phrases but weighted selection means some phrases have 3x the probability of others.** After pre-generation, the low-weight phrases exist in cache but are rarely selected. Is the intention to pre-generate all 34 and let the weights govern selection at runtime, or to pre-generate only the high-weight phrases? If the latter, `pregenerated` mode silently drops low-weight phrases with no fallback.

4. **`mode=full` (live TTS) is listed as the default when `SIDE_QUEST_VOICE=1`.** What happens on the first run, before any clips are cached, if the ElevenLabs API key is not set? The code returns `null` from `synthesize()` and the router returns `{ queued: false, reason: 'audio_unavailable' }` -- silent failure. Is that the right first-run experience, or should the first run print a setup message?

5. **The `generate-clips` CLI is the only path to pre-populating the cache, but it requires an ElevenLabs API key.** Is there a plan to ship a set of pre-generated mp3 files in the repo or as a package asset? If not, every new installation requires an API key and a generation step before any audio plays. Has this onboarding friction been considered?
