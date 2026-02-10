# How the Dell U4025QW Cache Refresh Hook Works

*A background process that keeps community knowledge fresh without you ever noticing.*

---

## The Problem

You have a Dell U4025QW monitor skill (`/tech-support`) that answers questions about KVM switching, DDC automation, firmware, and troubleshooting. It has great static reference files, but monitor communities move fast - firmware updates drop, new workarounds appear, bugs get discovered.

Manually researching "what's new in the last 30 days" every time you ask a question is wasteful. But stale community data means you might miss a critical fix.

## The Solution: Silent by Default, Smart When It Matters

The system has three layers:

1. **Background hook** - A SessionStart hook silently refreshes the cache every 30 days. You never see it, you never wait for it.
2. **Skill-level intelligence** - When the skill is invoked, it decides whether the cached data is good enough or whether a fresh refresh is needed, based on what you're asking about.
3. **Verified intel** - A `--upgrade` mode lets you batch-review staged findings and accept them into a permanent `verified-intel.md` file. Accepted findings persist forever in git. The skill only loads verified content during normal Q&A.

---

## The Four Modes

The skill operates in four modes. The key design principle: **never prompt the user about cache status**.

### Silent Mode (default)

Cache is fresh, or the question isn't critical enough to warrant a refresh. The skill uses reference files + verified intel and proceeds immediately. This is the 95% path.

### Smart Refresh Mode

Cache is stale AND the question is about **Troubleshooting** or **Firmware** - the two categories where stale community data could cause real harm (e.g., recommending a known-bad firmware version). The skill tells the user "Refreshing community intel - this takes about 60 seconds," runs the refresh inline, then answers with fresh data.

### On-demand Mode

The user passes `--refresh` (e.g., `/tech-support --refresh what firmware should I use?`). Forces a refresh regardless of cache status. Useful when you know something changed and want the latest community findings.

### Upgrade Mode

The user runs `/tech-support --upgrade` to review staged community findings. The skill extracts unreviewed findings from the cache, presents them as a numbered list, and lets you accept or reject each one. Accepted findings are appended to `references/verified-intel.md` (git-committed, permanent). Rejected findings are recorded so they don't re-surface.

---

## The Architecture

```text
User invokes /tech-support [--refresh] [--upgrade] [question]
    |
    v
Step 0: Parse --refresh and --upgrade flags
    |
    +-- UPGRADE_MODE? ----------> Step 5: Upgrade Flow
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
Step 1d: Read references/verified-intel.md (curated, trusted)
    |
    v
Step 1e: Set cache age footer note
    |
    v
Step 1f: Check for unreviewed staged findings (nudge)
    |
    v
Steps 2-4: Classify, read references, answer
```

The background SessionStart hook runs independently:

```text
Session Start
    |
    v
hooks/hooks.json
    |
    v
bunx @side-quest/community-intel-cache refresh --config ... --cache-dir ...
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
Synthesize via Claude (or fallback to raw markdown)
    |
    v
Write cache/staged-intel.md + cache/staged-raw.json + cache/last-updated.json (atomic)
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
            "command": "bunx @side-quest/community-intel-cache refresh --config \"${CLAUDE_PLUGIN_ROOT}/community-intel.json\" --cache-dir \"${CLAUDE_PLUGIN_ROOT}/skills/dell-u4025qw/cache\"",
            "timeout": 180,
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

2. **`"async": true`** - The hook runs in the background. Your session starts instantly. The alternative was synchronous, which would block startup for up to 3 minutes once every 30 days - terrible UX, especially when you don't know why it's hanging.

3. **`"timeout": 180`** - If the refresh takes longer than 3 minutes, Claude Code kills it. The CLI handles this gracefully.

### `@side-quest/community-intel-cache` - The engine

The refresh logic lives in the [`@side-quest/community-intel-cache`](https://www.npmjs.com/package/@side-quest/community-intel-cache) npm package. This is a shared CLI used by all knowledge-bank plugins. Topics are configured via `community-intel.json` at the plugin root.

**Refresh flow:**

1. **Check staleness** - Reads `cache/last-updated.json`. If `next_update_after` is in the future, exits in under a millisecond.
2. **Run parallel research queries** - Fires 6 topics via `@side-quest/last-30-days`, each with a 60-second timeout.
3. **Synthesize** - Uses Claude to synthesize findings into a summary (falls back to raw markdown if synthesis fails).
4. **Write cache (atomic)** - Writes `staged-intel.md`, `staged-raw.json`, and `last-updated.json` atomically.
5. **Emit status** - Writes JSON status to stdout for observability.

The refresh interval scales:

- **Full success (50%+ queries)**: 30-day interval
- **Thin cache (<50% queries)**: 7-day interval (self-heals sooner)
- **Total failure (0 queries)**: 4-hour backoff (caps retries at ~6/day)

### `community-intel.json` - The configuration

```json
{
  "topics": [
    "Dell U4025QW firmware update issues",
    "Dell U4025QW macOS color calibration Display P3 settings",
    "Dell U4025QW KVM switching multiple Mac computers",
    "Dell U4025QW sleep wake disconnect Thunderbolt macOS",
    "Dell U4025QW BetterDisplay Lunar MonitorControl m1ddc macOS",
    "Dell U4025QW HiDPI scaling resolution macOS"
  ],
  "refreshIntervalDays": 30,
  "thinCacheIntervalDays": 7,
  "context": "Knowledge-bank skill for the Dell U4025QW..."
}
```

### `skills/dell-u4025qw/SKILL.md` - The consumer

The skill's Step 0 parses the `--refresh` and `--upgrade` flags. Step 1 reads the cache metadata, decides whether to refresh (using the decision table), loads verified intel, and sets a cache age footer note. Step 1f checks for unreviewed staged findings and appends a nudge footer. The skill never prompts the user about cache status - it either proceeds silently or refreshes inline with a brief "this takes about 60 seconds" message.

If the cache is missing or the refresh fails, the skill proceeds with reference files only. No error, no "come back later," just graceful degradation.

### `references/verified-intel.md` - Curated community knowledge

Reviewed and accepted findings live here permanently. This file is git-committed and loaded as trusted reference material during normal Q&A. It grows over time as you run `--upgrade` and accept findings.

### Cache files (gitignored)

| File | Purpose |
|------|---------|
| `cache/staged-intel.md` | Synthesized markdown from latest refresh (not loaded in Q&A) |
| `cache/staged-raw.json` | Raw research results for finding extraction |
| `cache/last-updated.json` | Staleness metadata |
| `cache/reviewed-hashes.json` | Tracks which findings have been reviewed |

---

## Why This Design

### Previous design (v1): AskUserQuestion on stale cache

The original skill prompted users with "Community intel is refreshing. Want to wait or answer now?" This had three problems:

1. **Decision fatigue** - Users had to make a meta-decision before getting to their actual question
2. **ADHD-hostile** - A 90-second "wait for it" path with no progress feedback is a focus killer
3. **"Come back later" pattern** - The "answer now" path suggested trying again later, which meant the user might never get community data

### Previous design (v2): Auto-inject all community intel

The background refresh worked well, but all community findings were automatically injected into the skill's context. Problems:

1. **30-day window is lossy** - Each refresh overwrites the previous one. Important findings vanish when they age out.
2. **Prompt injection risk** - Unverified web content auto-injected into trusted context.

### Current design (v3): Silent refresh + verified intel + upgrade mode

The three-layer system addresses all issues:

- Background refresh gathers staged findings silently
- Normal Q&A uses only verified (human-reviewed) intel
- `--upgrade` mode provides a batch review workflow for curating findings
- Verified intel accumulates permanently in git

---

## Why Async Background + Inline Refresh

The background hook handles the 99% case: cache stays fresh, sessions start instantly. But when the cache is stale and the question is critical, the skill runs the refresh inline (synchronous, ~60s). This is acceptable because:

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

The CLI is designed to never break your session:

- **All exit paths return 0** - A failing hook should never block Claude Code
- **Per-query timeouts** - A single slow query doesn't block the others
- **Partial success** - If 4 out of 6 queries succeed, the cache is written with those 4 (at a 7-day interval to self-heal)
- **Total failure backoff** - If all queries fail, a 4-hour backoff is written to prevent retry storms
- **Atomic writes** - Cache files are written to `.tmp` then renamed, so the skill never reads a half-written file
- **Diagnostics collection** - Errors are accumulated and emitted in the final status JSON for debugging
- **`bunx` resolution fallback** - Resolves bunx via Bun.which, then common paths, then bare PATH lookup
- **Max-age sanity check** - Cache older than 60 days is treated as stale regardless of `next_update_after` (guards against clock skew)

---

## Cache Lifecycle

```text
Day 0:   First session -> no cache -> async refresh -> cache written (30d interval)
Day 1:   Session start -> cache fresh -> exit <1ms
Day 15:  Session start -> cache fresh -> exit <1ms
Day 15:  /tech-support "my monitor disconnects" -> stale? no -> silent mode
Day 30:  Session start -> cache stale -> async refresh -> new cache
Day 30:  /tech-support "my monitor disconnects" before hook finishes
         -> stale + troubleshooting -> smart refresh (~60s) -> answer
Day 31:  /tech-support --upgrade
         -> shows 12 new findings -> accept 8, reject 4
         -> 8 findings appended to verified-intel.md
Day 60:  /tech-support --upgrade
         -> shows 6 new findings (previous 8 are in verified-intel, 4 rejected)
         -> accept 3, reject 3
...
```

The `.gitignore` pattern `plugins/*/skills/*/cache/*` ensures cache files are never committed. Only `.gitkeep` is tracked. Verified intel lives in `references/` and is committed to git.
