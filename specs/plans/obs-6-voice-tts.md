# Domain 6: Voice/TTS System -- Implementation Plan

## Status: Completed (v1)

**Parent plan:** `specs/plans/observability-master-plan.md` (Stage 5f)
**Prerequisites:** Domains 1 (Event Server) and 2 (Hook CLI) must be substantially complete.

## Review-Driven Changes

This plan incorporates findings from a 3-pass staff engineer review (Architect, Skeptic, Operator). All three passes returned REQUEST CHANGES. Reviews are at `specs/reviews/obs-6-voice-tts-review-pass-{1,2,3}.md`.

### Accepted -- Scope Cuts (Skeptic)

The original plan had 18 files for a voice notification system. OBS-4 (the entire Vue dashboard) ships 8 files after cuts. Voice was twice the dashboard. This revision ships a minimal v1 that plays pregenerated clips on session Stop.

| Cut item | Days saved | Reason | Deferred to |
|----------|-----------|--------|-------------|
| Full hook integration (SubagentStart/Stop) | 1+ | SubagentStart/SubagentStop are OBS-2 v2 events. No trigger in v1. Same pattern that killed EngagePipeline (OBS-4) and HITL (OBS-5). | v2 |
| Live TTS (`tts.ts`, ElevenLabs client) | 1 | All phrases must be pre-generated before the system is useful. Live TTS is an optimization for a cache-miss scenario that shouldn't happen in normal use. | v1.1 |
| Cross-platform playback (Linux/Windows) | 0.5 | Nathan's hardware: MacBook Pro M4 Pro + Mac Mini M4 Pro. Both macOS. No portability requirement. | v2 |
| 34 phrases with weighted selection | 0.5 | Can't validate weights before listening to clips. Flat random from 2 phrases per context is sufficient. | v1.1 |
| Per-character env var overrides (5 vars) | 0 | Voice IDs are all `TBD_*` placeholders. No IDs to override. | v1.1 |
| `extractVerdict()` / McCoy outcome routing | 0 | Dead code -- SubagentStop doesn't fire in v1. | v2 |
| `list-cached` / `clear-cache` CLI | 0 | Wraps `ls` and `rm`. Not justified. | Deleted |

### Accepted -- Operational Fixes (Operator)

| Fix | Reason |
|-----|--------|
| Add timeout on `await proc.exited` | Corrupted mp3 or unavailable audio device hangs afplay indefinitely, permanently stalling the queue (C1). |
| Wrap `drain()` in try/finally | Unhandled exception leaves `playing = true`, permanently locking the queue (C2). |
| Dedup concurrent synthesis requests | Two hooks firing simultaneously both miss cache, double API charge (C3). Deferred -- not relevant in pregenerated-only mode, but noted for v1.1. |
| Define `cachePut` error contract | Write failure must return null, never throw (C4). |
| Probe for playback binary at startup | Log one warning if `afplay` not found, instead of silent per-clip failures (I1). |
| Store `currentProc` reference | Kill in-flight `afplay` on SIGTERM instead of orphaning (I3). |

### Deferred to v1.1 / v2

| Feature | Deferred to | Blocker/Reason |
|---------|-------------|----------------|
| Per-agent voice triggering (SubagentStart/Stop) | v2 | Needs OBS-2 v2 SubagentStart/SubagentStop handlers |
| Live TTS (ElevenLabs runtime synthesis) | v1.1 | Validate pre-generated clips first, then add live fallback |
| McCoy verdict phrases (`stop_pass` / `stop_fail`) | v2 | Needs SubagentStop + transcript verdict extraction |
| Cross-platform playback (Linux/Windows) | v2 | macOS only for now |
| Weighted phrase selection | v1.1 | Needs listening session to validate phrase quality |
| Voice ID env var overrides | v1.1 | Needs real ElevenLabs voice IDs first |
| Concurrent synthesis dedup (in-flight map) | v1.1 | Only relevant when live TTS is enabled |

---

## v1 Scope: Pregenerated Clips on Session Stop

After cuts, OBS-6 v1 is:
1. A **PlaybackQueue** that plays mp3 clips serially via `afplay`
2. A **POST /voice/notify** route on the observability server
3. A **generate-clips** script for one-time pre-generation
4. Voice triggered by **Stop** event (fires in OBS-2 v1) -- generic "session complete" phrase

**Estimated effort:** Half a day, one commit.

---

## 1. File Tree

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

scripts/
  generate-clips.ts     -- one-time pre-generation via ElevenLabs API
```

Total: 9 files (7 source + 1 test + 1 script). Down from 18.

---

## 2. Types

File: `packages/server/src/voice/types.ts`

```typescript
/** POST /voice/notify request body (sent by hooks) */
export interface VoiceNotification {
  agentType: string         // e.g. 'enterprise:builder-scotty'
  phase: 'start' | 'stop'
}

/** Item in the playback queue */
export interface QueueItem {
  filePath: string
  label: string             // for logging: "Scotty: Repairs complete, Captain."
  enqueuedAt: number        // Date.now() for staleness detection
}

/** Voice system runtime config */
export interface VoiceSystemConfig {
  mode: 'on' | 'off'
  cacheDir: string
  maxQueueDepth: number     // default: 10
  maxAgeMs: number          // default: 30000
  maxPlayMs: number         // default: 15000 (kill hung afplay)
}
```

### What's NOT here

- **No `VoiceConfig` with stability/similarityBoost.** That's for the generate-clips script, not the runtime server. The server only needs cache paths.
- **No `outcome` field.** McCoy verdict routing requires SubagentStop (v2).
- **No `PhraseEntry` with weights.** Flat random from 2 phrases per context.

---

## 3. Voice Identity + Phrases

File: `packages/server/src/voice/voices.ts`

Phrases are co-located with voice identity -- no separate `phrases.ts` module needed for 10-14 lines.

```typescript
interface VoiceEntry {
  voiceId: string           // ElevenLabs voice ID (for generate-clips script)
  label: string
  phrases: {
    start: string[]         // 2 phrases each, flat random
    stop: string[]
  }
}

export const VOICE_MAP: Record<string, VoiceEntry> = {
  'enterprise:builder-scotty': {
    voiceId: 'TBD_SCOTTISH_MALE',
    label: 'Scotty',
    phrases: {
      start: [
        "Scotty here, Captain. Beginning repairs.",
        "Aye, I'll get right on it.",
      ],
      stop: [
        "Repairs complete, Captain.",
        "All systems operational, Captain.",
      ],
    },
  },
  'enterprise:validator-mccoy': {
    voiceId: 'TBD_SOUTHERN_MALE',
    label: 'McCoy',
    phrases: {
      start: [
        "I'm a doctor, not a rubber stamp. Let me take a look.",
        "McCoy here. Beginning my review.",
      ],
      stop: [
        "Clean bill of health, Captain.",
        "The examination is complete.",
      ],
    },
  },
  'enterprise:ships-computer-cpu': {
    voiceId: 'TBD_NEUTRAL_FEMALE',
    label: 'Computer',
    phrases: {
      start: [
        "Working.",
        "Processing request.",
      ],
      stop: [
        "Analysis complete.",
        "Report ready, Captain.",
      ],
    },
  },
  'enterprise:API': {
    voiceId: 'TBD_CALM_MALE',
    label: 'Spock',
    phrases: {
      start: [
        "Fascinating. Commencing analysis.",
        "Logical. Proceeding.",
      ],
      stop: [
        "The mission is complete, Captain.",
        "Analysis complete. The data is conclusive.",
      ],
    },
  },
  'newsroom:beat-reporter': {
    voiceId: 'TBD_NEWSMAN_MALE',
    label: 'Mickey Malone',
    phrases: {
      start: [
        "Mickey Malone here. I'm on the beat.",
        "Got a lead, boss. Chasing it down.",
      ],
      stop: [
        "Story filed, chief.",
        "The scoop is in. Read all about it.",
      ],
    },
  },
}

/** Select a random phrase for the given agent and phase. */
export function selectPhrase(agentType: string, phase: 'start' | 'stop'): string | null {
  const entry = VOICE_MAP[agentType]
  if (!entry) return null
  const candidates = entry.phrases[phase]
  if (!candidates || candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]!
}
```

### Design Decisions

- **No weighted selection.** Can't validate weights before listening to clips. Flat random from 2 options is sufficient for v1.
- **No `stop_pass` / `stop_fail` context.** McCoy verdict routing requires SubagentStop (v2). All characters use generic `stop` context.
- **Phrases co-located with voice identity.** No separate `phrases.ts` -- the data is small and tightly coupled.
- **`voiceId` used only by `generate-clips` script.** The server never reads it at runtime -- it just needs the cache path.

---

## 4. Disk Cache

File: `packages/server/src/voice/cache.ts`

```typescript
import { join } from 'node:path'
import { homedir } from 'node:os'
import { contentId } from '@side-quest/core/hash'
import { ensureDirSync, pathExistsSync } from '@side-quest/core/fs'

const DEFAULT_CACHE_DIR = join(homedir(), '.cache/side-quest-observability/voices')

/** Compute deterministic cache key from voice ID + phrase text. */
export function cacheKey(text: string, voiceId: string): string {
  return contentId(`${voiceId}:${text}`)
}

/** Look up a cached mp3 by hash. Returns path if exists, null otherwise. */
export function cacheGet(hash: string, cacheDir = DEFAULT_CACHE_DIR): string | null {
  const filePath = join(cacheDir, `${hash}.mp3`)
  return pathExistsSync(filePath) ? filePath : null
}

/**
 * Write audio buffer to disk cache.
 * Returns the file path on success, null on write failure.
 * Never throws -- voice is non-critical.
 */
export async function cachePut(
  hash: string,
  audio: Buffer,
  cacheDir = DEFAULT_CACHE_DIR,
): Promise<string | null> {
  const filePath = join(cacheDir, `${hash}.mp3`)
  try {
    ensureDirSync(cacheDir)
    await Bun.write(filePath, audio)
    return filePath
  } catch {
    return null  // disk full or permission error -- skip this clip
  }
}
```

### Design Decisions

- **`cachePut` returns null on failure, never throws** (Operator C4 fix). Voice is non-critical -- write failures are silent skips.
- **No `pregenerated/` subdirectory.** Flat directory is sufficient for v1's 20 clips (~300KB total).
- **Uses `contentId` from `@side-quest/core/hash`** instead of manual SHA-256 (12-char prefix, same deterministic hashing).

---

## 5. PlaybackQueue -- Serial FIFO Drain

File: `packages/server/src/voice/queue.ts`

This is the core component. A simple FIFO queue that drains one clip at a time via `afplay`, preventing overlapping audio.

```typescript
import { spawn } from 'bun'

/**
 * Serial playback queue. Clips play one at a time, in order.
 *
 * Why not concurrent: Overlapping TTS clips from multiple agents
 * are unintelligible. Serial playback preserves the "bridge chatter"
 * experience -- you hear each character in sequence.
 */
export class PlaybackQueue {
  private queue: QueueItem[] = []
  private playing = false
  private currentProc: ReturnType<typeof spawn> | null = null
  private config: { maxDepth: number; maxAgeMs: number; maxPlayMs: number }

  constructor(opts?: { maxDepth?: number; maxAgeMs?: number; maxPlayMs?: number }) {
    this.config = {
      maxDepth: opts?.maxDepth ?? 10,
      maxAgeMs: opts?.maxAgeMs ?? 30_000,
      maxPlayMs: opts?.maxPlayMs ?? 15_000,
    }
  }

  /** Enqueue a clip. Starts draining if idle. */
  enqueue(item: QueueItem): void {
    if (this.queue.length >= this.config.maxDepth) {
      return // silently drop -- voice is non-critical
    }
    this.queue.push(item)
    if (!this.playing) {
      this.drain()
    }
  }

  /** Serial drain loop. Plays one clip, waits for it to finish, plays next. */
  private async drain(): Promise<void> {
    this.playing = true
    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift()!

        // Drop stale clips (enqueued 30s+ ago -- no longer relevant)
        if (Date.now() - item.enqueuedAt > this.config.maxAgeMs) {
          continue
        }

        await this.playOne(item.filePath)
      }
    } finally {
      this.playing = false
    }
  }

  /** Play a single clip via afplay with timeout guard. */
  private async playOne(filePath: string): Promise<void> {
    try {
      const proc = spawn(['afplay', filePath], {
        stdout: 'ignore',
        stderr: 'ignore',
      })
      this.currentProc = proc

      // Race against timeout -- kill hung afplay (Operator C1 fix)
      const timeout = new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('playback timeout')), this.config.maxPlayMs)
      )

      await Promise.race([proc.exited.then(() => {}), timeout]).catch(() => {
        try { proc.kill() } catch {}
      })
    } catch {
      // Playback failure is non-critical -- skip and drain next
    } finally {
      this.currentProc = null
    }
  }

  /** Queue depth for health checks. */
  get depth(): number {
    return this.queue.length
  }

  /** Whether a clip is currently playing. */
  get isPlaying(): boolean {
    return this.playing
  }

  /** Clear queue without killing current clip. */
  clear(): void {
    this.queue = []
  }

  /** Kill current clip and clear queue (call on SIGTERM). */
  stop(): void {
    this.queue = []
    if (this.currentProc) {
      try { this.currentProc.kill() } catch {}
      this.currentProc = null
    }
  }
}
```

### Operator Fixes Applied

| Fix | What changed |
|-----|-------------|
| C1: `maxPlayMs` timeout | `Promise.race` with timeout kills hung `afplay` after 15s |
| C2: try/finally on `drain()` | `playing = false` is guaranteed even on unhandled exception |
| I3: `currentProc` tracking | `stop()` kills in-flight process on SIGTERM, preventing orphans |

### What's NOT here

- **No cross-platform `buildCommand()`.** macOS `afplay` only. No Linux/Windows branches.
- **No volume control.** Uses system default volume.

### Queue Behavior Under Load

| Scenario | Behavior |
|---|---|
| 3 agents start simultaneously | All 3 enqueued, play serially (~2-4s each) |
| 15 rapid events (burst) | First 10 enqueued, last 5 dropped (maxDepth) |
| Event enqueued 30s+ ago | Clip dropped as stale (maxAgeMs) |
| afplay hangs on corrupt mp3 | Killed after 15s (maxPlayMs), queue continues |
| Server shutting down (SIGTERM) | `queue.stop()` kills current clip, clears queue |
| Exception in drain loop | try/finally ensures `playing = false`, queue recoverable |

---

## 6. HTTP Route: POST /voice/notify

File: `packages/server/src/voice/router.ts`

```typescript
/**
 * POST /voice/notify
 *
 * Receives voice notification, resolves to a cached audio clip,
 * and enqueues for serial playback. Returns 200 immediately --
 * the hook does not wait for audio to play.
 *
 * Request body: { agentType: string, phase: 'start'|'stop' }
 * Response: 200 { queued: true } | 200 { queued: false, reason: string }
 */
export async function handleVoiceNotify(
  req: Request,
  config: VoiceSystemConfig,
  queue: PlaybackQueue,
): Promise<Response> {
  if (config.mode === 'off') {
    return Response.json({ queued: false, reason: 'voice_disabled' })
  }

  const body: VoiceNotification = await req.json()

  // 1. Select phrase
  const text = selectPhrase(body.agentType, body.phase)
  if (!text) {
    return Response.json({ queued: false, reason: 'unknown_agent' })
  }

  // 2. Look up cached clip
  const entry = VOICE_MAP[body.agentType]
  if (!entry) {
    return Response.json({ queued: false, reason: 'unknown_agent' })
  }
  const hash = cacheKey(text, entry.voiceId)
  const filePath = cacheGet(hash, config.cacheDir)
  if (!filePath) {
    return Response.json({ queued: false, reason: 'not_cached' })
  }

  // 3. Enqueue for playback
  queue.enqueue({
    filePath,
    label: `${entry.label}: "${text}"`,
    enqueuedAt: Date.now(),
  })

  return Response.json({ queued: true, label: entry.label, text })
}
```

### What's NOT here

- **No `resolveAudioFile` with live TTS fallback.** Pregenerated-only mode -- if the clip isn't cached, return `not_cached`. No ElevenLabs API calls at runtime.
- **No request body size limit.** The body is 3 small string fields. Adding a 4KB limit is reasonable but not critical for v1.
- **No concurrent synthesis dedup (in-flight map).** Not relevant in pregenerated-only mode.

---

## 7. Voice Triggering (v1: Stop Event -- In-Process)

The v1 voice trigger fires on **Stop** events, which the server's enrichment pipeline already processes (OBS-1 `handleHookEvent`). This gives a generic "session complete" audio notification. Per-agent triggering (SubagentStart/SubagentStop) is deferred to v2.

### Architecture: In-Process Call (not HTTP self-call)

Voice lives in the same server process as the enrichment pipeline. When `handleHookEvent('stop', ...)` fires in `server.ts`, it calls the voice system directly -- no HTTP round-trip, no port discovery, no `fetch()` to localhost.

```typescript
// In packages/server/src/server.ts, inside handleHookEvent():

async function handleHookEvent(req: Request, eventName: string): Promise<Response> {
  // ... existing enrichment logic (validate, map type, generate envelope, store, broadcast) ...

  store.push(envelope)
  server.publish('events.all', JSON.stringify(envelope))
  server.publish(`events.${eventType}`, JSON.stringify(envelope))

  // Voice trigger -- in-process, fire-and-forget
  if (eventName === 'stop' && playbackQueue) {
    triggerVoice('enterprise:ships-computer-cpu', 'stop', playbackQueue, voiceConfig)
  }

  return new Response(JSON.stringify({ id: envelope.id }), { status: 201, headers: CORS_HEADERS })
}
```

The `triggerVoice` helper resolves a cached clip and enqueues it:

```typescript
import { selectPhrase, VOICE_MAP } from './voice/voices.js'
import { cacheKey, cacheGet } from './voice/cache.js'

/** Resolve a cached voice clip and enqueue for playback. Non-blocking, never throws. */
function triggerVoice(
  agentType: string,
  phase: 'start' | 'stop',
  queue: PlaybackQueue,
  config: VoiceSystemConfig,
): void {
  if (config.mode === 'off') return

  const text = selectPhrase(agentType, phase)
  if (!text) return

  const entry = VOICE_MAP[agentType]
  if (!entry) return

  const hash = cacheKey(text, entry.voiceId)
  const filePath = cacheGet(hash, config.cacheDir)
  if (!filePath) return  // not cached -- skip silently (pregenerated-only in v1)

  queue.enqueue({
    filePath,
    label: `${entry.label}: "${text}"`,
    enqueuedAt: Date.now(),
  })
}
```

### Why in-process instead of HTTP self-call

The previous revision had `voiceNotify()` POSTing to `http://127.0.0.1:{port}/voice/notify` -- the server calling itself over HTTP. This was an artifact of the v2 architecture where voice lived in a separate handler file. With the dumb hook model:

- Voice and enrichment live in the same `server.ts` process
- No port discovery needed (no `discoverPort()`, no nonce verification)
- No network overhead (~0ms vs ~5ms for localhost fetch)
- No failure modes from self-referential HTTP (port file stale, connection refused to self)
- The `POST /voice/notify` route still exists for external consumers (see Section 8)

### What this means for v1

- On every session Stop, the Computer says "Analysis complete." or "Report ready, Captain."
- Per-character voice (Scotty, McCoy, Spock, Mickey) plays only when SubagentStart/SubagentStop land in v2.
- All 5 characters' clips are pre-generated and cached -- ready for v2 wiring with zero additional work.

### v2: Per-Agent Triggering via Enrichment Pipeline

When OBS-1 PR2 adds SubagentStart/SubagentStop enrichment handlers, voice triggers expand:

```typescript
// v2 addition to handleHookEvent():
if (eventName === 'subagent-start' && playbackQueue) {
  const agentType = String(raw.agent_type ?? '')
  triggerVoice(agentType, 'start', playbackQueue, voiceConfig)
}
if (eventName === 'subagent-stop' && playbackQueue) {
  const agentType = String(raw.agent_type ?? '')
  triggerVoice(agentType, 'stop', playbackQueue, voiceConfig)
}
```

Zero new files needed -- just two more `if` blocks in the enrichment pipeline.

---

## 8. Server Registration

```typescript
// In packages/server/src/server.ts
import { PlaybackQueue } from './voice/queue.js'
import { handleVoiceNotify } from './voice/router.js'
import { loadVoiceConfig } from './voice/config.js'
import { triggerVoice } from './voice/trigger.js'

const voiceConfig = loadVoiceConfig()
const playbackQueue = voiceConfig.mode !== 'off'
  ? new PlaybackQueue({
      maxDepth: voiceConfig.maxQueueDepth,
      maxAgeMs: voiceConfig.maxAgeMs,
      maxPlayMs: voiceConfig.maxPlayMs,
    })
  : null

// Probe for afplay at startup (Operator I1 fix)
if (playbackQueue) {
  const probe = Bun.spawn(['afplay', '--help'], { stdout: 'ignore', stderr: 'ignore' })
  probe.exited.catch(() => {
    console.warn('[voice] afplay not found -- audio will not play')
  })
}

// Primary trigger: in-process call from handleHookEvent() -- see Section 7
// triggerVoice() is called directly from the enrichment pipeline, no HTTP needed.

// External HTTP route (for future WS-based voice services or manual testing)
// Skip entirely if voice is off.
if (playbackQueue && url.pathname === '/voice/notify' && method === 'POST') {
  return handleVoiceNotify(req, voiceConfig, playbackQueue)
}

// SIGTERM cleanup -- kill in-flight clip (Operator I3 fix)
// Wire into OBS-1's existing signal handler:
process.on('SIGTERM', () => {
  playbackQueue?.stop()
  // ... existing cleanup ...
})

// Health endpoint includes voice status
// GET /health -> { ..., voice: { mode, queueDepth, isPlaying } }
```

### Design Decisions

- **In-process trigger is primary, HTTP route is secondary.** The enrichment pipeline calls `triggerVoice()` directly (Section 7). The `POST /voice/notify` route exists for external consumers (manual testing via `curl`, future WS-based voice service in v2) but the server never calls itself over HTTP.
- **No queue instantiation when `mode === 'off'`** (Operator I4 fix). Skip the route entirely.
- **One afplay probe at startup.** Single warning instead of per-clip silent failures.
- **`queue.stop()` not `queue.clear()`** on SIGTERM. Kills in-flight process.

---

## 9. Configuration

File: `packages/server/src/voice/config.ts`

Two env vars for v1. That's it.

| Variable | Required | Default | Description |
|---|---|---|---|
| `SIDE_QUEST_VOICE` | No | `on` | `off` = disable voice entirely. `on` = play pre-generated clips. |
| `ELEVENLABS_API_KEY` | For `generate-clips` only | none | Not needed at server runtime. Only used by the one-time generation script. |

### What's NOT here

- **No `SIDE_QUEST_VOICE_SCOTTY` etc.** Per-character overrides deferred to v1.1.
- **No `mode=full` for live TTS.** Server runs pregenerated-only. Live TTS deferred to v1.1.
- **No `SIDE_QUEST_VOICE_CACHE_DIR`.** Default `~/.cache/side-quest-observability/voices/` is fine for v1.
- **No `SIDE_QUEST_VOICE_MAX_QUEUE` etc.** Hardcoded defaults (10, 30s, 15s) are fine for v1.

---

## 10. Pre-generation Script

File: `scripts/generate-clips.ts`

A standalone script (not a CLI subcommand) that generates all voice clips once. Run from the repo:

```bash
cd ~/code/side-quest-observability
ELEVENLABS_API_KEY=sk-... bun run scripts/generate-clips.ts
```

The script:
1. Iterates all entries in `VOICE_MAP`
2. For each agent's `start` and `stop` phrases, computes cache key
3. Checks if clip already exists in cache (skip if cached)
4. Calls ElevenLabs API to synthesize
5. Writes mp3 to cache via `cachePut`
6. Reports progress: `[scotty] start: "Scotty here, Captain..." -> ~/.cache/.../abc123def456.mp3`

Supports `--dry-run` (show what would be generated) and `--play` (play each clip after generating via `afplay`).

### Why not `bunx`

The `@side-quest/observability` package has `"private": true` (Architect C2). It is not published to npm. `bunx` would fail. The script runs from the local repo via `bun run`.

A justfile recipe wraps it:

```just
# Pre-generate voice clips (requires ELEVENLABS_API_KEY)
voice-generate:
    @ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY:?Set ELEVENLABS_API_KEY} \
      bun run scripts/generate-clips.ts
    @echo "Voice clips generated to ~/.cache/side-quest-observability/voices/"
```

---

## 11. Testing Strategy

| File | Tests |
|---|---|
| `queue.test.ts` | Serial drain order (FIFO), maxDepth back-pressure drops, maxAgeMs staleness drops, timeout kills hung proc, try/finally guarantees `playing = false`, `stop()` kills current proc, enqueue-after-drain starts new cycle |
| `router.test.ts` | Request parsing, `voice_disabled` response when off, `unknown_agent` for unmapped agent, `not_cached` when clip missing, `queued: true` when clip exists |

### Not Tested (by design)

- Actual ElevenLabs API calls (costs credits) -- tested manually via `generate-clips --play`
- Actual `afplay` audio playback (platform-dependent, makes noise) -- tested manually

---

## 12. Implementation Sequence

| Step | Files | Notes |
|---|---|---|
| 1 | `voice/types.ts` | All other files import types |
| 2 | `voice/voices.ts` | Voice identity + phrases (co-located) |
| 3 | `voice/cache.ts` | Disk cache read/write with null-on-failure contract |
| 4 | `voice/queue.ts` + `queue.test.ts` | Core component -- serial FIFO drain with timeout + try/finally |
| 5 | `voice/router.ts` + `router.test.ts` | HTTP endpoint, wired to cache + queue |
| 6 | `voice/config.ts` + `voice/index.ts` | Config loader + barrel export |
| 7 | Server registration | Wire voice route + SIGTERM cleanup + in-process trigger into server.ts |
| 8 | `scripts/generate-clips.ts` | One-time pre-generation |

**Domain dependencies:**
- Domain 1 (Event Server) must exist -- voice triggers from server.ts enrichment pipeline, voice route registered on the server
- Domain 2 is NOT a dependency -- voice is triggered in-process by the server, not by a hook handler
- SubagentStart/SubagentStop (OBS-1 PR2) NOT required for v1

---

## 13. Timing Budget

Voice triggering is in-process (Section 7) -- no HTTP round-trip.

| Step | Time | Notes |
|---|---|---|
| Phrase select (`selectPhrase`) | ~0.1ms | Random index into 2-element array |
| Cache key compute (`contentId`) | ~0.5ms | SHA-256 prefix |
| Cache lookup (`pathExistsSync`) | ~1ms | Single stat call |
| Queue enqueue | ~0.1ms | Array push + start drain |
| **Total added to Stop enrichment** | **~2ms** | Non-blocking -- drain is async |
| Cache MISS: skip silently | ~2ms | Same as above minus enqueue |
| afplay playback (async, queued) | ~2-4s per clip | Runs after Response is sent |

The voice trigger adds ~2ms to the Stop event's enrichment path. Playback happens asynchronously after the HTTP response is returned -- it never blocks the hook or the client.

---

## v1.1: Live TTS + Phrase Expansion (deferred)

When pregenerated clips are validated and voice IDs are selected:

1. **Live TTS fallback**: Add `tts.ts` ElevenLabs client with `mode=full`. On cache miss, synthesize live instead of returning `not_cached`.
2. **Concurrent synthesis dedup** (Operator C3): In-flight `Map<hash, Promise>` prevents duplicate API charges.
3. **401 circuit breaker** (Operator I2): Set `apiKeyInvalid` flag on 401/403, skip all future synthesis.
4. **Weighted phrase selection**: After listening session validates which phrases sound natural.
5. **Per-character env var overrides**: `SIDE_QUEST_VOICE_SCOTTY=customVoiceId123` etc.
6. **Expanded phrase library**: 34 phrases (up from 20) with weights.

---

## v2: Per-Agent Voice Triggering (deferred)

When OBS-2 v2 ships SubagentStart/SubagentStop:

1. **SubagentStart handler**: Maps `agent_type` to voice, plays start phrase for the specific officer.
2. **SubagentStop handler**: Maps `agent_type` to voice, plays stop phrase. McCoy gets `stop_pass` / `stop_fail` via `extractVerdict()`.
3. **Verdict extraction**: Read last 2KB of transcript for `VERDICT: PASS/FAIL`. Move server-side (Architect I2) -- hook sends `transcriptPath`, server reads asynchronously.
4. **Priority queue**: McCoy FAIL verdict jumps ahead of pending start clips.

---

## Critical Files

| File | Role |
|------|------|
| `packages/server/src/server.ts` (OBS-1) | Register voice route + SIGTERM cleanup + in-process `triggerVoice()` from enrichment pipeline |
| `specs/plans/obs-1-event-server.md` | Signal handlers, enrichment pipeline (`handleHookEvent`) where voice trigger lives |

## References

- [bennycheung -- Hear Your AI Agents Work](https://bennycheung.github.io/hear-your-ai-agents-work) -- server-as-audio-gateway pattern
- [peon-ping](https://github.com/PeonPing/peon-ping) -- 2.1k stars, CESP standard, serial queue
- [@claude-code-hooks/sound](https://github.com/beefiker/claude-code-hooks) -- cross-platform playback pattern
- [ElevenLabs TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) -- endpoint reference
