# Plan: OBS-6 Voice TTS System -- Pre-generated Clips + Playback Queue

## Task Description

Build a voice feedback system that plays pre-generated Star Trek character audio clips during Claude Code sessions. v1 triggers on Stop events only (generic "session complete" phrase from the Computer character). Per-agent triggering via SubagentStart/SubagentStop is deferred to v2.

The system consists of a PlaybackQueue (serial FIFO via `afplay`), a disk cache, voice identity mapping, an HTTP route for external consumers, and in-process triggering from the server's enrichment pipeline.

## Objective

1. A `PlaybackQueue` that plays mp3 clips serially via `afplay` with timeout and staleness guards
2. A `POST /voice/notify` route for external consumers
3. In-process `triggerVoice()` called from server.ts on Stop events
4. A `generate-clips.ts` script for one-time ElevenLabs pre-generation
5. 5 character voice identities with 2 phrases each (start + stop)

## Problem Statement

The observability system streams events to a visual dashboard but has no audio feedback. Star Trek character voices announcing agent activity would make the multi-agent "bridge crew" experience tangible and delightful.

## Solution Approach

Pregenerated-only in v1. All phrases are generated once via ElevenLabs API and cached to disk. At runtime, the server looks up cached clips by hash and enqueues them for serial playback. No live TTS calls at runtime (deferred to v1.1).

The voice system lives inside the server process. When `handleHookEvent('stop', ...)` fires, it calls `triggerVoice()` directly -- no HTTP round-trip.

## Relevant Files

Use these files to complete the task:

- `specs/plans/obs-6-voice-tts.md` -- full detailed plan (source of truth)
- `specs/plans/obs-1-event-server.md` section 2.4 -- server enrichment pipeline where voice triggers
- `packages/server/src/server.ts` (OBS-1) -- wire voice route + SIGTERM cleanup + in-process trigger

### New Files

```
packages/server/src/voice/
  index.ts              -- barrel export
  types.ts              -- VoiceNotification, QueueItem, VoiceSystemConfig
  voices.ts             -- VOICE_MAP: agent_type -> { voiceId, label, phrases }
  cache.ts              -- disk cache: get(hash) -> path | null, put(hash, buffer) -> path | null
  queue.ts              -- PlaybackQueue: FIFO serial drain, afplay only
  queue.test.ts         -- serial drain, timeout, try/finally, maxDepth, staleness
  router.ts             -- POST /voice/notify handler
  router.test.ts        -- request parsing, queued/not-queued responses
  config.ts             -- loadVoiceConfig from env

scripts/
  generate-clips.ts     -- one-time pre-generation via ElevenLabs API
```

## Implementation Phases

### Phase 1: Foundation -- Types + Voice Identity

**Read first:** `specs/plans/obs-6-voice-tts.md` sections 2-3

1. Create `voice/types.ts`:
   - `VoiceNotification` (agentType, phase)
   - `QueueItem` (filePath, label, enqueuedAt)
   - `VoiceSystemConfig` (mode, cacheDir, maxQueueDepth, maxAgeMs, maxPlayMs)

2. Create `voice/voices.ts`:
   - `VoiceEntry` interface (voiceId, label, phrases.start[], phrases.stop[])
   - `VOICE_MAP` with 5 characters (Scotty, McCoy, Computer, Spock, Mickey Malone)
   - 2 phrases per character per phase (start + stop)
   - `selectPhrase()` function (flat random)

3. Create `voice/config.ts`:
   - `loadVoiceConfig()` reads `SIDE_QUEST_VOICE` env var
   - Default: mode `on`, cache at `~/.cache/side-quest-observability/voices/`
   - maxQueueDepth: 10, maxAgeMs: 30000, maxPlayMs: 15000

### Phase 2: Core Implementation -- Cache + Queue + Router

**Read first:** `specs/plans/obs-6-voice-tts.md` sections 4-6

4. Create `voice/cache.ts`:
   - `cacheKey(text, voiceId)` using `contentId` from `@side-quest/core/hash`
   - `cacheGet(hash, cacheDir)` returns path if exists, null otherwise
   - `cachePut(hash, audio, cacheDir)` writes buffer, returns path or null (never throws)

5. Create `voice/queue.ts` -- PlaybackQueue:
   - FIFO serial drain via `afplay`
   - `maxDepth` back-pressure (silently drop when full)
   - `maxAgeMs` staleness detection (skip clips enqueued > 30s ago)
   - `maxPlayMs` timeout via Promise.race (kill hung afplay after 15s -- Operator C1)
   - try/finally on drain() (Operator C2 -- playing=false guaranteed)
   - `currentProc` tracking for SIGTERM cleanup (Operator I3)
   - `stop()` kills current clip + clears queue
   - `clear()` clears queue without killing current clip

6. Create `voice/router.ts`:
   - `handleVoiceNotify(req, config, queue)` -- POST /voice/notify
   - Returns `{ queued: false, reason: 'voice_disabled' }` when off
   - Returns `{ queued: false, reason: 'unknown_agent' }` for unmapped agents
   - Returns `{ queued: false, reason: 'not_cached' }` when clip missing
   - Returns `{ queued: true, label, text }` on success
   - No live TTS fallback -- pregenerated-only

7. Create `voice/index.ts` barrel export

### Phase 3: Integration & Polish -- Server Wiring + Tests + Script

**Read first:** `specs/plans/obs-6-voice-tts.md` sections 7-10

8. Wire into server.ts:
   - Import PlaybackQueue, handleVoiceNotify, loadVoiceConfig, triggerVoice
   - Initialize PlaybackQueue if mode !== 'off'
   - Probe for afplay at startup (Operator I1 -- one warning, not per-clip)
   - Add `POST /voice/notify` route (skip entirely if voice off)
   - Add in-process `triggerVoice()` call in handleHookEvent for Stop events
   - Add `playbackQueue?.stop()` to SIGTERM handler
   - Include voice status in /health endpoint

9. Write `voice/queue.test.ts`:
   - Serial drain order (FIFO)
   - maxDepth back-pressure drops
   - maxAgeMs staleness drops
   - Timeout kills hung process
   - try/finally guarantees playing=false
   - stop() kills current process
   - enqueue-after-drain starts new cycle

10. Write `voice/router.test.ts`:
    - Request parsing
    - voice_disabled response when off
    - unknown_agent for unmapped agent
    - not_cached when clip missing
    - queued: true when clip exists

11. Create `scripts/generate-clips.ts`:
    - Iterate VOICE_MAP entries
    - For each phrase: compute cache key, check if cached, call ElevenLabs if not
    - Support `--dry-run` and `--play` flags
    - Requires `ELEVENLABS_API_KEY` env var

12. Add justfile recipe `voice-generate` (wraps generate-clips.ts)

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. Use Task and Task* tools only.
- Take note of the session id (agentId) of each team member for resume operations.

### Model Selection Guide

| Role | Model | Rationale |
|------|-------|-----------|
| All builders | sonnet | Executes well-specified tasks reliably |
| All validators | opus | Semantic code review requires strongest reasoning for edge cases, convention violations, and logic errors |

### Team Members

- Builder
  - Name: builder-voice
  - Role: Build voice system (cache, queue, router, config, voices)
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-voice-integration
  - Role: Wire voice into server.ts + create generate-clips script
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-voice
  - Role: Verify queue behavior, router responses, server integration
  - Agent Type: enterprise:validator-mccoy
  - Model: opus
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. Create Voice Types + Identity + Config
- **Task ID**: voice-types
- **Depends On**: none (assumes OBS-1 server exists)
- **Assigned To**: builder-voice
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read `specs/plans/obs-6-voice-tts.md` sections 2-3
- Create voice/types.ts, voice/voices.ts, voice/config.ts
- 5 characters, 2 phrases each per phase
- selectPhrase() with flat random

### 2. Create Cache + Queue + Router
- **Task ID**: voice-core
- **Depends On**: voice-types
- **Assigned To**: builder-voice
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read `specs/plans/obs-6-voice-tts.md` sections 4-6
- Create voice/cache.ts (contentId hash, null-on-failure contract)
- Create voice/queue.ts (PlaybackQueue with all operator fixes)
- Create voice/router.ts (handleVoiceNotify)
- Create voice/index.ts barrel export

### 3. Write Voice Tests
- **Task ID**: voice-tests
- **Depends On**: voice-core
- **Assigned To**: builder-voice
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read `specs/plans/obs-6-voice-tts.md` section 11
- Create voice/queue.test.ts (FIFO, maxDepth, maxAge, timeout, try/finally, stop)
- Create voice/router.test.ts (parsing, disabled, unknown, not_cached, queued)
- Verify: `bun test voice/`

### 4. Wire Voice into Server + Create Script
- **Task ID**: voice-integration
- **Depends On**: voice-tests
- **Assigned To**: builder-voice-integration
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read `specs/plans/obs-6-voice-tts.md` sections 7-10
- Wire PlaybackQueue, voice route, triggerVoice into server.ts
- Add afplay probe at startup
- Add SIGTERM cleanup for playback queue
- Add voice status to /health endpoint
- Create scripts/generate-clips.ts
- Add voice-generate recipe to justfile

### 5. Validate Voice System
- **Task ID**: validate-voice
- **Depends On**: voice-integration
- **Assigned To**: validator-voice
- **Agent Type**: enterprise:validator-mccoy
- **Model**: opus
- **Parallel**: false
- `bun test voice/` -- all queue and router tests pass
- `bun run typecheck` -- no type errors in voice/
- POST /voice/notify with unknown agent returns `{ queued: false, reason: 'unknown_agent' }`
- POST /voice/notify with voice disabled returns `{ queued: false, reason: 'voice_disabled' }`
- /health includes voice status (mode, queueDepth, isPlaying)
- voice/ directory has 8 source files + 2 test files + 1 script
- No circular imports between voice/ and server.ts

## Acceptance Criteria

1. `packages/server/src/voice/` contains 8 source files
2. PlaybackQueue drains FIFO with maxDepth, maxAge, maxPlay guards
3. Cache uses `contentId` for deterministic hashing
4. `cachePut` returns null on failure (never throws)
5. `POST /voice/notify` returns correct responses for all cases
6. In-process `triggerVoice()` fires on Stop events
7. afplay probed at startup with single warning if missing
8. SIGTERM kills in-flight clip via `queue.stop()`
9. /health includes voice status
10. Queue and router tests pass
11. `scripts/generate-clips.ts` iterates VOICE_MAP and generates clips
12. `SIDE_QUEST_VOICE=off` disables voice entirely (no queue instantiation)

## Validation Commands

- `bun test voice/` -- voice-specific tests
- `bun test` -- all tests including voice
- `bun run typecheck` -- no type errors

## Notes

- v1 only triggers on Stop (generic "session complete" from Computer character).
- Per-agent voice (Scotty, McCoy, Spock, Mickey) triggers when SubagentStart/SubagentStop land in v2.
- All 5 characters' clips are pre-generated and cached -- ready for v2 with zero additional work.
- Live TTS (ElevenLabs at runtime) is deferred to v1.1.
- Cross-platform playback (Linux/Windows) is deferred to v2 -- macOS only for v1.
- Voice IDs in VOICE_MAP are `TBD_*` placeholders until ElevenLabs voices are selected.
- The `generate-clips.ts` script requires `ELEVENLABS_API_KEY` but the server runtime does NOT.
- afplay playback is async -- it never blocks the HTTP response or the enrichment pipeline.
- Total latency added to Stop enrichment: ~2ms (phrase select + cache lookup + enqueue).
