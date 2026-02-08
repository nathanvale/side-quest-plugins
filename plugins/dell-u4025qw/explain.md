# How the Dell U4025QW Cache Refresh Hook Works

*A background process that keeps community knowledge fresh without you ever noticing.*

---

## The Problem

You have a Dell U4025QW monitor skill (`/tech-support`) that answers questions about KVM switching, DDC automation, firmware, and troubleshooting. It has great static reference files, but monitor communities move fast - firmware updates drop, new workarounds appear, bugs get discovered.

Manually researching "what's new in the last 30 days" every time you ask a question is wasteful. But stale community data means you might miss a critical fix.

## The Solution: Silent by Default, Smart When It Matters

The system has two layers:

1. **Background hook** - A SessionStart hook silently refreshes the cache every 30 days. You never see it, you never wait for it.
2. **Skill-level intelligence** - When the skill is invoked, it decides whether the cached data is good enough or whether a fresh refresh is needed, based on what you're asking about.

---

## The Three Modes

The skill operates in three modes. The key design principle: **never prompt the user about cache status**.

### Silent Mode (default)

Cache is fresh, or the question isn't critical enough to warrant a refresh. The skill uses whatever cache exists and proceeds immediately. This is the 95% path.

### Smart Refresh Mode

Cache is stale AND the question is about **Troubleshooting** or **Firmware** - the two categories where stale community data could cause real harm (e.g., recommending a known-bad firmware version). The skill tells the user "Refreshing community intel - this takes about 60 seconds," runs the refresh script inline, then answers with fresh data.

### On-demand Mode

The user passes `--refresh` (e.g., `/tech-support --refresh what firmware should I use?`). Forces a refresh regardless of cache status. Useful when you know something changed and want the latest community findings.

---

## The Architecture

```
User invokes /tech-support [--refresh] [question]
    |
    v
Step 0: Parse --refresh flag
    |
    v
Step 1a: Read cache/last-updated.json
    |
    +-- FORCE_REFRESH?  ---------> Refresh (on-demand)
    |
    +-- Cache fresh? ------------> Proceed silently
    |
    +-- Stale + Troubleshooting/Firmware? --> Refresh (smart)
    |
    +-- Stale + anything else? --> Proceed silently with existing cache
    |
    v
Step 1d: Read community-intel.md (if it exists)
    |
    v
Step 1e: Set cache age footer note
    |
    v
Steps 2-4: Classify, read references, answer
```

The background SessionStart hook runs independently:

```
Session Start
    |
    v
hooks/hooks.json
    |
    v
"Is the cache fresh?"  --yes-->  Exit (<1ms, you never notice)
    |
    no (stale or missing)
    |
    v
Run 6 parallel research queries (async, non-blocking)
    |
    v
Write cache/community-intel.md + cache/last-updated.json (atomic)
    |
    v
Done (next check in 7-30 days based on success ratio)
```

---

## The Files

### `hooks/hooks.json` - The background trigger

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ${CLAUDE_PLUGIN_ROOT}/scripts/refresh-cache.ts",
            "timeout": 120,
            "async": true
          }
        ]
      }
    ]
  }
}
```

Three design choices here:

1. **`"matcher": "startup|clear"`** - Fires on new sessions and after `/clear`. Doesn't fire on `resume` or `compact` (cache doesn't go stale mid-session).

2. **`"async": true`** - The hook runs in the background. Your session starts instantly. The alternative was synchronous, which would block startup for up to 2 minutes once every 30 days - terrible UX, especially when you don't know why it's hanging.

3. **`"timeout": 120`** - If the refresh takes longer than 2 minutes, Claude Code kills it. The script handles this gracefully.

### `scripts/refresh-cache.ts` - The engine

This is a self-contained Bun script (no external dependencies beyond `@side-quest/last-30-days`). Here's the flow:

**Step 1: Check staleness**

```typescript
function isCacheFresh(cacheDir: string): boolean {
    // Requires BOTH last-updated.json AND community-intel.md to exist
    // Guards against clock skew: max 60-day age regardless of next_update_after
    const metadata = JSON.parse(readFileSync('last-updated.json', 'utf-8'))
    const nextUpdate = new Date(metadata.next_update_after)
    return nextUpdate.getTime() > Date.now()
}
```

This is the fast path. 99% of sessions hit this and exit in under a millisecond. The `next_update_after` timestamp is set 7-30 days ahead when the cache is written (depending on success ratio).

**Step 2: Run parallel research queries**

If the cache is stale, the script fires 6 research topics in parallel:

- Dell U4025QW firmware update issues
- Dell U4025QW macOS color calibration Display P3 settings
- Dell U4025QW KVM switching multiple Mac computers
- Dell U4025QW sleep wake disconnect Thunderbolt macOS
- Dell U4025QW BetterDisplay Lunar MonitorControl m1ddc macOS
- Dell U4025QW HiDPI scaling resolution macOS

Each query spawns `bunx --bun @side-quest/last-30-days "{topic}" --emit=json --quick`, which searches Reddit, X, and the web for recent activity. Each has a 60-second timeout. If a query fails, the script logs the error and continues with the rest.

**Step 3: Write the cache (atomic)**

Results are formatted into `community-intel.md` - a markdown document with the top 5 results per source (Reddit, X, Web) for each topic, sorted by engagement score. Both files are written atomically (write to `.tmp`, then `renameSync()`) to prevent the skill from reading a half-written file.

A `last-updated.json` file records when the refresh happened and when the next one should be. The refresh interval scales:

- **Full success (50%+ queries)**: 30-day interval
- **Thin cache (<50% queries)**: 7-day interval (self-heals sooner)
- **Total failure (0 queries)**: 4-hour backoff (caps retries at ~6/day)

**Step 4: Emit status**

The script always exits 0 (non-blocking). It writes a JSON status line to stdout for observability:

```json
{"status": "refreshed", "detail": "5/6 topics (interval: 30d)"}
```

Or if the cache was already fresh:

```json
{"status": "fresh"}
```

### `skills/dell-u4025qw/SKILL.md` - The consumer

The skill's Step 0 parses the `--refresh` flag. Step 1 reads the cache metadata, decides whether to refresh (using the three-mode decision table), loads community intel, and sets a cache age footer note. The skill never prompts the user about cache status - it either proceeds silently or refreshes inline with a brief "this takes about 60 seconds" message.

If the cache is missing or the refresh fails, the skill proceeds with reference files only. No error, no "come back later," just graceful degradation.

### `scripts/reset-cache.ts` - Developer utility

Deletes `community-intel.md` and `last-updated.json` to force a refresh on the next session. Useful for testing.

---

## Why This Design

### Previous design (v1): AskUserQuestion on stale cache

The original skill prompted users with "Community intel is refreshing. Want to wait or answer now?" This had three problems:

1. **Decision fatigue** - Users had to make a meta-decision before getting to their actual question
2. **ADHD-hostile** - A 90-second "wait for it" path with no progress feedback is a focus killer
3. **"Come back later" pattern** - The "answer now" path suggested trying again later, which meant the user might never get community data

### Current design (v2): Silent by default, smart when it matters

The three-mode system eliminates the prompt entirely:

- Most questions work fine with slightly stale data (silent mode)
- Critical questions (troubleshooting, firmware) get auto-refreshed (smart mode)
- Users who want explicit control have `--refresh` (on-demand mode)

The `explain.md` documentation always said "graceful degradation, no prompt to the user" - the skill now actually implements that.

---

## Why Async Background + Inline Refresh

The background hook handles the 99% case: cache stays fresh, sessions start instantly. But when the cache is stale and the question is critical, the skill runs the refresh script inline (synchronous, ~60s). This is acceptable because:

- It only happens for troubleshooting/firmware questions with stale cache
- The user gets a clear "this takes about 60 seconds" message
- The alternative (answering with stale data) could recommend a known-bad firmware

The `--refresh` flag gives users explicit control when they know something changed.

---

## Why This Exists as a Plugin Hook (Not a Skill Hook)

This was originally a `PreToolUse:Read` hook defined in SKILL.md frontmatter. But plugin skill frontmatter hooks are broken - Claude Code silently ignores them (GitHub issue [anthropics/claude-code#17688](https://github.com/anthropics/claude-code/issues/17688)). The root cause: plugin skill loaders omit the `hooks` property from their returned definitions, while local skill loaders correctly include it.

The workaround: move the hook to `hooks/hooks.json` (plugin-level). Plugin-level hooks work correctly. The change also improved the architecture - SessionStart is a better trigger than PreToolUse:Read because it runs once at session start instead of on every file read.

---

## Error Handling

The script is designed to never break your session:

- **All exit paths return 0** - A failing hook should never block Claude Code
- **Per-query timeouts** - A single slow query doesn't block the others
- **Partial success** - If 4 out of 6 queries succeed, the cache is written with those 4 (at a 7-day interval to self-heal)
- **Total failure backoff** - If all queries fail, a 4-hour backoff is written to prevent retry storms
- **Atomic writes** - Cache files are written to `.tmp` then renamed, so the skill never reads a half-written file
- **Diagnostics collection** - Errors are accumulated and emitted in the final status JSON for debugging
- **`bunx` resolution fallback** - Tries `Bun.which('bunx')`, then `/opt/homebrew/bin/bunx`, then `/usr/local/bin/bunx`, then bare `bunx`
- **Max-age sanity check** - Cache older than 60 days is treated as stale regardless of `next_update_after` (guards against clock skew)

---

## Cache Lifecycle

```
Day 0:   First session -> no cache -> async refresh -> cache written (30d interval)
Day 1:   Session start -> cache fresh -> exit <1ms
Day 15:  Session start -> cache fresh -> exit <1ms
Day 15:  /tech-support "my monitor disconnects" -> stale? no -> silent mode
Day 30:  Session start -> cache stale -> async refresh -> new cache
Day 30:  /tech-support "my monitor disconnects" before hook finishes
         -> stale + troubleshooting -> smart refresh (~60s) -> answer
Day 31:  Session start -> cache fresh -> exit <1ms
Day 31:  /tech-support --refresh "latest firmware?"
         -> on-demand refresh (~60s) -> answer with fresh data
...
```

The `.gitignore` pattern `plugins/*/skills/*/cache/*` ensures cache files are never committed. Only `.gitkeep` is tracked.
