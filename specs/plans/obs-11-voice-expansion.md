# OBS-11: Voice Expansion

## Status: Planning

## Goal

Expand the voice system from "Computer says one thing on Stop" to full per-agent voice feedback with live TTS fallback and McCoy verdict routing.

## Context

v1 ships with pre-generated clips only, triggered on Stop events with a generic "Computer" voice. The voice infrastructure (PlaybackQueue, cache, config, router) is solid. This plan expands triggering to per-agent SubagentStart/SubagentStop and adds live ElevenLabs synthesis as a cache-miss fallback.

## Depends on

- OBS-8 (Full Hook Coverage) - SubagentStart/SubagentStop enrichment handlers are the primary trigger
- OBS-6 (Voice System) - Phrase library, weighted selection, and configuration foundation

## Items

### Per-Agent Voice Triggering

**Repo:** side-quest-observability
**File:** `packages/server/src/server.ts`

When OBS-8 adds SubagentStart/SubagentStop enrichment:
- SubagentStart: extract `agent_type`, call `triggerVoice(agentType, 'start', ...)`
- SubagentStop: extract `agent_type`, call `triggerVoice(agentType, 'stop', ...)`

### McCoy Verdict Routing

**Files:** `packages/server/src/server.ts`, `packages/server/src/voice/voices.ts`

Extract verdict from SubagentStop transcript:
- Read the full `agent_transcript_path` and find the last occurrence of `/VERDICT:\s*(PASS|FAIL)/i`
- Case-insensitive, whitespace-tolerant matching handles variations like "Verdict: PASS", "verdict: pass", "VERDICT:PASS"
- Route to `stop_pass` or `stop_fail` phrase sets for McCoy based on the captured group

Add priority queue support: McCoy FAIL verdict jumps ahead of pending start clips.

### Live TTS (ElevenLabs)

**New file:** `packages/server/src/voice/tts.ts`

| Item | Description |
|------|-------------|
| ElevenLabs client | `generateSpeech(text, config)` using `eleven_flash_v2_5` model (~75ms latency) |
| Cache-miss synthesis | On cache miss, call ElevenLabs API, save to disk cache, then play |
| Concurrent synthesis dedup | In-flight `Map<hash, Promise>` prevents duplicate API charges when two hooks fire simultaneously |
| 401 circuit breaker | Set `apiKeyInvalid` flag on 401/403, skip all future synthesis attempts |

### Phrase & Config Improvements

| Item | Description | Source spec |
|------|-------------|-------------|
| Weighted phrase selection | Replace flat random with weighted selection after listening session validates which phrases sound natural | OBS-6 |
| Expanded phrase library | 34 phrases (up from 20) with weights | OBS-6 |
| Per-character env var overrides | `SIDE_QUEST_VOICE_SCOTTY=customVoiceId123` etc. Needs real ElevenLabs voice IDs first. | OBS-6 |
| `SIDE_QUEST_VOICE_CACHE_DIR` env var | Override default `~/.cache/side-quest-observability/voices/` | OBS-6 |
| `SIDE_QUEST_VOICE_MAX_QUEUE` tuning | Override hardcoded defaults (10, 30s, 15s) | OBS-6 |

### Cross-Platform Playback

**File:** `packages/server/src/voice/queue.ts`

Detect platform and use appropriate player:
- macOS: `afplay` (built-in)
- Linux: `aplay` or `paplay`
- Windows: `powershell -c "(New-Object Media.SoundPlayer '<path>').PlaySync()"`

Reference: `@claude-code-hooks/sound` npm package pattern.

### External WS Voice Consumer (v3, optional)

If voice needs to be decoupled from the server (independent start/stop, separate process for live TTS with ElevenLabs connection pooling), a standalone voice service can subscribe to `ws://localhost:{port}/ws?type=hook.subagent_start`.

## Verification

1. SubagentStart triggers correct character voice (Scotty for builder-scotty, McCoy for validator-mccoy)
2. SubagentStop triggers stop phrases with correct verdict routing for McCoy
3. Cache miss triggers ElevenLabs synthesis, saves to disk, plays clip
4. Concurrent duplicate requests only hit API once (dedup map)
5. 401 from ElevenLabs sets circuit breaker, no further API calls
6. Weighted selection produces expected distribution over 100+ calls
