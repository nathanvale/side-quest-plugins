# OBS-6 Voice/TTS System -- Staff Engineer Review, Pass 3 (Operator)

**Reviewer persona:** Operator -- failure modes, recovery behavior, "what breaks at 3am?"
**Plan reviewed:** `/Users/nathanvale/.claude/plans/obs-6-voice-tts.md`
**Cross-references:** OBS-1 pass-3 review (Operator), OBS-2 pass-3 review (Operator)
**Date:** 2026-02-17

---

## 1. Verdict

**REQUEST CHANGES**

The architecture is sound: server-side queued playback is the right call, the fire-and-forget POST model means voice never blocks hooks, and the `maxDepth`/`maxAgeMs` guards show the author is thinking about overload. The problem is the plan has four specific failure modes that will produce either indefinite queue stalls or silent resource leaks in production -- and they all emerge from the same root cause: `await proc.exited` in `playOne()` has no timeout, and every downstream assumption about queue liveness depends on that await completing.

---

## 2. Strengths

- **Serial queue with `playing` flag is the correct design for audio.** A naive concurrent approach would produce garbled overlapping clips. The FIFO serial drain with a single `playing` boolean is simple, correct, and easy to reason about under load. The `maxDepth: 10` back-pressure drop prevents unbounded memory growth.
- **Fire-and-forget hook integration.** Adding `voiceNotify(...).catch(() => {})` inside the existing hook handlers means voice failure cannot propagate an exit code change to Claude Code. The 500ms `AbortSignal.timeout` on the POST client is the right ceiling for a non-critical notification.
- **Pre-generation CLI (`generate-clips`) as a first-class operational tool.** Providing `--dry-run`, `--force`, and `--verbose` flags, plus `list-cached`, `clear-cache`, and `test <agent>` subcommands, means the voice system can be auditioned and validated entirely offline before going live. This is essential for a system with manual ElevenLabs voice ID selection.
- **`maxAgeMs` staleness drop closes the backlog problem.** An event enqueued 30 seconds ago is no longer relevant. Silently dropping it rather than playing a stale "Scotty starting" clip when he already finished is the correct user experience choice.

---

## 3. Critical Issues (must fix)

### C1 -- `await proc.exited` has no timeout -- a hung afplay blocks the queue permanently

**The problem:** `playOne()` is:

```typescript
const proc = spawn(cmd, { stdout: 'ignore', stderr: 'ignore' })
await proc.exited
```

`afplay` is a synchronous native binary. On macOS, `afplay` will hang indefinitely if:

1. **The mp3 file is corrupt or truncated.** A partial write during an ElevenLabs response (network drop mid-transfer, disk full during `cachePut`) produces a file that passes the filesystem `exists` check but causes `afplay` to stall on decode. This is not hypothetical -- `afplay` has a known hang on malformed audio headers.
2. **The audio device is unavailable.** If the output device is disconnected, changes sample rate, or enters a power-save state mid-playback, `afplay` blocks waiting for the device to become ready. Under macOS sleep/wake cycles, this is a realistic scenario.
3. **afplay is killed -STOP (SIGSTOP) by another process.** This is unusual but possible under a security tool or process supervisor.

When `afplay` hangs, `await proc.exited` never resolves. The `drain()` loop's `while (this.queue.length > 0)` is suspended at the `await`. The `playing` flag remains `true`. `enqueue()` checks `if (!this.playing)` and does not start a new drain. All subsequent clips pile up in the queue until `maxDepth` is hit, at which point new clips are silently dropped. **The queue is permanently dead until the server restarts.**

At 3am, this manifests as: voice clips stop playing, no error logged anywhere, no health endpoint change, server continues accepting requests and returning `{ queued: true }`. Everything looks healthy. The developer notices nothing until they realize they haven't heard a clip in 20 minutes.

**Fix:** Wrap `proc.exited` in a `Promise.race` with a timeout that kills the process:

```typescript
private async playOne(filePath: string): Promise<void> {
  const cmd = this.buildCommand(filePath)
  if (!cmd) return

  try {
    const proc = spawn(cmd, { stdout: 'ignore', stderr: 'ignore' })

    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('playback timeout')), this.config.maxPlayMs)
    )

    await Promise.race([proc.exited.then(() => {}), timeout]).catch(() => {
      // Kill hung process before continuing
      try { proc.kill() } catch {}
    })
  } catch {
    // Playback failure is non-critical -- skip and drain next
  }
}
```

Add `maxPlayMs` to `VoiceSystemConfig` with a default of `15_000` (15 seconds -- well above the longest TTS clip but well below "hung forever"). Expose it as `SIDE_QUEST_VOICE_MAX_PLAY_MS` for override.

---

### C2 -- `drain()` exception escapes `playing = false`, permanently locking the queue

**The problem:** The `drain()` method:

```typescript
private async drain(): Promise<void> {
  this.playing = true
  while (this.queue.length > 0) {
    const item = this.queue.shift()!
    if (Date.now() - item.enqueuedAt > this.config.maxAgeMs) continue
    await this.playOne(item.filePath)
  }
  this.playing = false
}
```

`playOne()` wraps its body in a try/catch. But `this.queue.shift()!` is outside the try/catch. If `shift()` somehow throws (contrived, but possible if `this.queue` is replaced with a non-standard array implementation in tests, or if a future refactor changes `QueueItem` validation), or if any line between `this.playing = true` and `this.playing = false` throws an unhandled exception that escapes the `while` loop, `this.playing` is left at `true`.

More concretely: the `!` non-null assertion on `shift()` is technically safe here because the `while` condition checks `this.queue.length > 0`. But `Date.now()` can in theory throw in a sandboxed environment, and more practically, if a future engineer adds a `logger.trace(item)` call inside the loop that throws, the drain is silently dead.

The fix is structural -- `playing = false` must be guaranteed even when the drain throws:

```typescript
private async drain(): Promise<void> {
  this.playing = true
  try {
    while (this.queue.length > 0) {
      const item = this.queue.shift()!
      if (Date.now() - item.enqueuedAt > this.config.maxAgeMs) continue
      await this.playOne(item.filePath)
    }
  } finally {
    this.playing = false
  }
}
```

This is a one-line fix with zero behavioral change on the happy path. It is not optional -- a try/finally around `playing` state is the standard pattern for any flag-based critical section.

---

### C3 -- Concurrent POST /voice/notify triggers duplicate ElevenLabs calls for the same text

**The problem:** `resolveAudioFile` is:

```typescript
async function resolveAudioFile(text, voice, config): Promise<string | null> {
  const hash = cacheKey(text, voice.voiceId)
  const cached = cacheGet(hash, config.cacheDir)
  if (cached.hit) return cached.path     // <-- synchronous check

  if (config.mode === 'pregenerated') return null
  if (!config.apiKey) return null

  const audio = await synthesize(text, voice, config.apiKey)  // <-- async call
  if (!audio) return null

  return cachePut(hash, audio, config.cacheDir)               // <-- synchronous write
}
```

Two simultaneous POST `/voice/notify` requests -- which can happen when SubagentStart events fire for multiple agents within the same event loop tick -- will both call `resolveAudioFile` with the same `text` and `voice.voiceId`. Both will hit `cacheGet` synchronously and both will find a miss (the file does not exist yet). Both will then call `synthesize()`, issuing two concurrent ElevenLabs API requests for identical text.

The results: two API credit charges for identical content, two concurrent file writes to `{hash}.mp3` (last write wins -- fine for the file, but the first writer's result is discarded), and a brief window where the second `cachePut` overwrites a partially-written file from the first.

This is not a correctness catastrophe -- the end result is a valid mp3 on disk -- but it burns API credits and produces a non-deterministic write ordering that could produce a zero-byte or truncated mp3 if `Bun.write()` is interrupted mid-write by the second write to the same path.

**Fix:** Keep an in-memory `Map<hash, Promise<string | null>>` of in-flight synthesis requests. Before calling `synthesize`, check if a promise for this hash is already in-flight and await it:

```typescript
// Module-level (or instance-level if router is a class)
const inFlight = new Map<string, Promise<string | null>>()

async function resolveAudioFile(text, voice, config): Promise<string | null> {
  const hash = cacheKey(text, voice.voiceId)
  const cached = cacheGet(hash, config.cacheDir)
  if (cached.hit) return cached.path

  if (config.mode === 'pregenerated') return null
  if (!config.apiKey) return null

  // Deduplicate concurrent requests for the same content
  if (inFlight.has(hash)) return inFlight.get(hash)!

  const promise = synthesize(text, voice, config.apiKey)
    .then(audio => {
      if (!audio) return null
      return cachePut(hash, audio, config.cacheDir)
    })
    .finally(() => inFlight.delete(hash))

  inFlight.set(hash, promise)
  return promise
}
```

---

### C4 -- `Bun.write()` failure in `cachePut` is unhandled -- queue receives a path to a non-existent file

**The problem:** The plan specifies `cachePut` writes the mp3 to disk and returns the file path:

```typescript
return cachePut(hash, audio, config.cacheDir)
```

`cachePut` calls `Bun.write(filePath, audio)`. If the disk is full, the directory does not exist, or the write is interrupted, `Bun.write()` rejects. The current `resolveAudioFile` does not await `cachePut` with error handling -- it returns the path optimistically. The plan's code shows `return cachePut(hash, audio, config.cacheDir)` which implies `cachePut` returns the path string, not the write result.

There are two interpretations:
1. `cachePut` does `await Bun.write(...); return filePath` -- the write error propagates up through `resolveAudioFile`'s try context, which... has no try context. The error escapes to `handleVoiceNotify`, which also has no try context around `resolveAudioFile`. The unhandled rejection crashes the route handler.
2. `cachePut` does `Bun.write(...).catch(() => {})` and returns the path regardless -- the path is returned to the queue, `afplay` tries to play a zero-byte or non-existent file, `afplay` exits non-zero immediately, `playOne`'s catch swallows it, drain continues. This is the better failure mode but it's not documented.

The plan does not specify `cachePut`'s implementation. The Operator concern is: on disk full, does the queue silently skip the clip (acceptable) or does the route handler crash with an unhandled rejection (not acceptable)?

**Fix:** Define `cachePut`'s error contract explicitly:

```typescript
/**
 * Write audio buffer to disk cache.
 * Returns the file path on success, null on write failure (disk full, etc.).
 * Never throws -- voice is non-critical.
 */
async function cachePut(hash: string, audio: Buffer, cacheDir: string): Promise<string | null> {
  const filePath = path.join(cacheDir, `${hash}.mp3`)
  try {
    await ensureDir(cacheDir)
    await Bun.write(filePath, audio)
    return filePath
  } catch {
    return null  // disk full or permission error -- skip this clip
  }
}
```

And update `resolveAudioFile` to handle the null return from `cachePut`:

```typescript
const filePath = await cachePut(hash, audio, config.cacheDir)
if (!filePath) return null  // write failed -- no path to enqueue
return filePath
```

---

## 4. Important Observations (should fix)

### I1 -- `afplay` not found produces a spawn error that the catch block swallows silently

When `afplay` is not installed (a fresh macOS without Xcode command line tools, or a CI/CD environment), `Bun.spawn(['afplay', filePath])` throws `ENOENT` immediately. The `catch {}` block in `playOne()` swallows it. The queue calls `drain()` on each item, each item produces an immediate throw, each throw is caught, `playing` is eventually set to `false` (with the fix from C2). No audio, no error, no log entry.

This is the correct degradation behavior (voice is non-critical), but it is completely invisible. A developer who set `SIDE_QUEST_VOICE=1` and configured an `ELEVENLABS_API_KEY` will see `{ queued: true }` responses and spend API credits generating clips that are never played, with no indication of why.

**Fix:** Probe for the playback binary once at server startup and log a single warning if absent:

```typescript
// In server.ts, after loading voiceConfig:
if (voiceConfig.mode !== 'off') {
  const playbackCmd = buildPlaybackCommand('/dev/null')  // just the binary name
  if (playbackCmd) {
    const probe = Bun.spawn([playbackCmd[0], '--version'], { stdout: 'ignore', stderr: 'ignore' })
    probe.exited.then(code => {
      if (code !== 0) {
        console.warn(`[voice] Playback binary '${playbackCmd[0]}' found but exited non-zero on probe`)
      }
    }).catch(() => {
      console.warn(`[voice] Playback binary '${playbackCmd[0]}' not found -- audio will not play`)
    })
  }
}
```

This produces exactly one warning at startup, not one per clip.

### I2 -- ElevenLabs 401 after key revocation will spam the server log on every cache miss

The plan's `synthesize()` returns `null` on all non-2xx responses:

```typescript
if (!response.ok) return null
```

After a 401, `resolveAudioFile` returns `null`, the route handler returns `{ queued: false, reason: 'audio_unavailable' }`. This is correct behavior. But each subsequent cache miss (all 34 phrases the first time through, plus any new agent events) will make an API call that returns 401. The plan has a 10-second timeout per request. At normal operating volume (a few SubagentStart events per minute), this is 10 seconds of network overhead per voice notification, plus a growing server log of `audio_unavailable` responses if any logging is added.

More critically: the plan does not distinguish between "ElevenLabs returned 401" (key revoked -- permanent failure, stop trying) and "ElevenLabs returned 500" (server error -- might retry) and "network timeout" (might be transient). All three map to `null`.

**Fix:** Add a transient error check to distinguish permanent auth failures from transient ones. After a 401 or 403, set an in-memory `apiKeyInvalid = true` flag and skip all future synthesis attempts, logging a single error:

```typescript
let apiKeyInvalid = false

export async function synthesize(text, voice, apiKey): Promise<Buffer | null> {
  if (apiKeyInvalid) return null  // skip -- key already known bad

  // ... fetch ...

  if (response.status === 401 || response.status === 403) {
    apiKeyInvalid = true
    console.error('[voice] ElevenLabs API key invalid (401/403) -- voice synthesis disabled')
    return null
  }
  if (!response.ok) return null
  // ...
}
```

This converts O(n) error log spam into a single error message.

### I3 -- Server SIGTERM while afplay is playing -- afplay becomes an orphan process

OBS-1's signal handlers call `removePidFiles(cacheDir)` and `server.stop()` then `process.exit(0)`. The OBS-6 plan (Section 13) says:

> `queue.clear()` prevents orphan playback

`queue.clear()` empties the pending queue array. It does not kill the currently-playing `afplay` process. The signal handler has no reference to the in-flight `proc` from `playOne()`. When the server exits, `afplay` continues playing the current clip as an orphaned child process. On macOS, orphaned children of a killed parent are reparented to init (PID 1) and continue running.

The user hears the last clip play to completion after the server has already exited. This is mildly surprising but not catastrophic. The real issue is if afplay is already hung (the C1 scenario) and the server is SIGTERMed -- the orphaned hung afplay holds the audio device indefinitely.

**Fix:** Store a reference to the in-flight `proc` and kill it on shutdown:

```typescript
export class PlaybackQueue {
  private queue: QueueItem[] = []
  private playing = false
  private currentProc: ReturnType<typeof spawn> | null = null  // track in-flight process
  // ...

  private async playOne(filePath: string): Promise<void> {
    // ...
    try {
      const proc = spawn(cmd, { stdout: 'ignore', stderr: 'ignore' })
      this.currentProc = proc
      // ... timeout race ...
    } finally {
      this.currentProc = null
    }
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

Wire `queue.stop()` (not `queue.clear()`) into the OBS-1 signal handler. The existing `clear()` method stays for non-shutdown use.

### I4 -- Voice route always registers and queue always initializes, even when `mode === 'off'`

Section 13 (Server Registration) shows the queue and route are initialized unconditionally:

```typescript
const voiceConfig = loadVoiceConfig()
const playbackQueue = new PlaybackQueue({ ... })

if (url.pathname === '/voice/notify' && method === 'POST') {
  return handleVoiceNotify(req, voiceConfig, VOICE_MAP, playbackQueue)
}
```

When `SIDE_QUEST_VOICE=off`, the route still matches and `handleVoiceNotify` is called, which then returns `{ queued: false, reason: 'voice_disabled' }`. This is functionally correct -- the route gracefully handles disabled mode. But:

1. The `PlaybackQueue` is instantiated regardless, allocating the queue array and config object.
2. Every POST `/voice/notify` from the hooks (which fire unconditionally after Domain 2 integration) causes the server to receive and handle the request, parse the JSON body, look up the mode, and return a response. For a developer who has set `SIDE_QUEST_VOICE=off` to disable voice entirely, this is non-zero overhead per hook invocation.

This is minor at current scale (34 phrases, 5 agents) but worth noting: the hooks themselves should check the mode before POSTing. The `voiceNotify()` client in the hook handler could check `SIDE_QUEST_VOICE` locally before sending:

```typescript
async function voiceNotify(notification: VoiceNotification): Promise<void> {
  // Fast-path: skip POST entirely if voice is disabled in env
  if (process.env.SIDE_QUEST_VOICE === '0' || process.env.SIDE_QUEST_VOICE === 'off') return

  // ... existing fetch logic ...
}
```

This avoids the network round-trip entirely when voice is off.

### I5 -- Two observability servers running (stale PID file scenario) -- dual afplay instances

OBS-1 discusses stale PID files and the nonce verification fix. But the nonce verification only applies to the emitter's port discovery. The voice POST path (`voiceNotify()`) in OBS-6 uses a separate `discoverPort()` call that reads the port file. If the OBS-1 stale-PID scenario results in two servers binding to the same or different ports -- or if a developer accidentally starts a second server in a separate terminal -- both servers' voice routes are reachable and both will attempt to spawn `afplay`.

In the stale PID case (two servers, different ports, same voice events), both servers receive the POST (they don't -- each hook fires once and POSTs to one port). In the duplicate-server-by-accident case (developer runs `bun run server.ts` while launchd instance is also running), the port file contains the launchd server's port, so the hooks POST to the launchd server only. The manually started server receives no voice POSTs. No dual audio in this case.

The actual risk is the inverse: the port file is stale from a crashed server, a new server starts on a different port, but the port file still points to the old (dead) port. Hooks POST to the dead port, get a connection refused, the `voiceNotify()` catch swallows it -- no voice plays at all despite the server running. This is silent degradation.

**Fix:** This is already handled by OBS-1's nonce verification in `isEventServerRunning`. Confirm that `voiceNotify()`'s `discoverPort()` uses the same nonce-verified path as OBS-1's `discoverEventServer()`, not a simpler port-file-only lookup. If it uses a simpler lookup, align it with the OBS-1 nonce check.

---

## 5. Nice-to-Haves

### N1 -- Cache eviction policy for `--force` regeneration and voice ID changes

The plan notes that env var voice ID overrides (`SIDE_QUEST_VOICE_SCOTTY=customId123`) change the voice ID in `VoiceConfig`. The cache key is `SHA-256("{voiceId}:{text}")`. When the voice ID changes, the old `{hash}.mp3` files are never evicted -- they become orphaned. Similarly, `generate-clips --force` writes new hashes for the new voice ID but does not clean up the old ones.

With 34 phrases x 5 voices at ~15KB each, the base footprint is 2.5MB. With 3 iterations of voice ID changes (audition -> try a second voice -> settle on the third), that's 7.5MB of orphaned files with no eviction path. Add the `pregenerated/` subdirectory (same 34 phrases, different path), and the total is 15MB of unmanaged cache.

`voice clear-cache` exists but clears all clips, including valid pregenerated ones. Consider adding `voice gc-cache` that removes orphaned hashes (hashes not matching any current `{voiceId}:{phrase}` combination).

### N2 -- `test <agent>` CLI command should surface timing, not just play

`voice test <agent>` is documented as playing a test phrase. For voice ID audition purposes, the developer also wants to know: how long did the API call take, which phrase was selected, and what file was written. A `--verbose` flag on `test` that logs the phrase text, the voice ID used, the synthesis latency, and the cache path would significantly improve the voice audition workflow.

### N3 -- Windows `powershell` playback command uses single-quote string interpolation

```typescript
case 'win32':
  return ['powershell', '-NoProfile', '-c',
    `(New-Object Media.SoundPlayer '${filePath}').PlaySync()`]
```

`filePath` is not sanitized before interpolation into the PowerShell command string. A path containing a single quote (e.g., `C:\Users\Nathan's Music\...`) would break the PowerShell syntax. This is also a command injection vector if `filePath` is ever derived from user input (it isn't today -- it's the SHA-256 hash filename -- but the pattern is worth noting for when `cacheDir` becomes configurable).

**Fix:** Use PowerShell's `[System.IO.Path]::GetFullPath()` and escape quotes, or use a variable assignment:

```typescript
case 'win32':
  return ['powershell', '-NoProfile', '-c',
    `$path = '${filePath.replace(/'/g, "''")}'; (New-Object Media.SoundPlayer $path).PlaySync()`]
```

### N4 -- `maxClipAgeMs` field name in `VoiceSystemConfig` inconsistently maps to constructor option `maxAgeMs`

`VoiceSystemConfig` declares `maxClipAgeMs`. The `PlaybackQueue` constructor option is `maxAgeMs`. The server registration passes `voiceConfig.maxClipAgeMs` as `maxAgeMs`. This is a trivial inconsistency but creates a naming mismatch between the config object and the queue's own API. Standardize on `maxAgeMs` throughout, or rename the queue option to `maxClipAgeMs` to match the config type.

---

## 6. Questions for the Author

1. **afplay hang budget:** What is the maximum acceptable clip duration? Most TTS clips are 2-4 seconds. A `maxPlayMs` of 15,000ms (15s) gives a 4x safety margin. Is that sufficient, or should it be lower (e.g., 8,000ms) to fail faster on a hung clip and keep the queue moving?

2. **`cachePut` return contract:** Does `cachePut` in the planned implementation return `null` on write failure, or does it throw? This determines whether C4 is a latent bug or already handled. If `cachePut` already returns `null` on failure, C4 is demoted to a documentation issue.

3. **Duplicate synthesis on cold cache:** On first run (empty cache), two SubagentStart events fire within the same event loop tick. Is burning two API credits for identical content acceptable as a one-time cold-start cost, or should the in-flight deduplication from C3 be mandatory? If the 34 phrases are always pre-generated before live use, C3 may only matter for dynamic phrase additions.

4. **SIGTERM afplay orphan:** Is the "last clip plays to completion after server shutdown" behavior acceptable, or should shutdown be hard (kill afplay immediately)? The answer affects whether `queue.stop()` with a `proc.kill()` is needed or whether `queue.clear()` is sufficient.

5. **Voice route when `mode === 'off'`:** Is it acceptable for hooks to unconditionally POST to `/voice/notify` when voice is disabled, relying on the server to short-circuit? Or should the hooks skip the POST entirely? This affects how much latency the hook accumulates when voice is disabled (500ms timeout vs 0ms).

6. **`discoverPort()` implementation:** Does `voiceNotify()`'s port discovery use OBS-1's nonce-verified `isEventServerRunning()` check, or a simpler port-file-only read? If the latter, I5 is a real gap.

---

## 7. Synthesis

OBS-6 arrives after two rounds of prior review hardening on OBS-1 and OBS-2. It inherits a strong operational baseline: the fire-and-forget POST model from OBS-2 means voice failure is truly invisible to Claude Code, and the `PlaybackQueue` design reflects direct community pattern adoption (peon-ping's serial queue) rather than ad-hoc invention. The critical failures here are all concentrated in a single component: `playOne()` and its relationship to the `playing` flag. C1 (no afplay timeout) and C2 (no try/finally on `playing`) together produce a queue that can permanently stall with no observable signal -- the worst category of failure for a background audio system. C3 (concurrent synthesis deduplication) and C4 (cachePut error contract) are correctness issues with real-money consequences (API credits) and potential data corruption (concurrent writes to the same file path). The fixes for all four are mechanical and non-invasive -- they do not require rethinking the architecture. Combined with the Architect and Skeptic passes (which presumably validated the server-side queue design, ElevenLabs integration, and pre-generation CLI), this plan is close to implementation-ready. Resolve C1 and C2 first (they are a pair -- one causes the stall, the other makes it permanent), then C3 and C4, and the system's failure mode surface collapses to "voice is silently absent" rather than "server state is corrupted."
