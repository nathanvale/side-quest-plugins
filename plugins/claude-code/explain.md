# How the Claude Code Hooks Community Intelligence System Works

*Accumulative community knowledge with human curation - never loses verified findings.*

---

## The Problem

You have a Claude Code hooks skill (`/hooks`) that answers questions about event lifecycle, hook types, configuration, community patterns, best practices, and troubleshooting. It has great static reference files (seven hand-authored docs covering the complete hooks API), but the hooks ecosystem moves fast - new patterns emerge, workarounds get discovered, issues get reported.

Two challenges:

1. **7-day window is lossy** - Each refresh overwrites the previous one. Important findings (community patterns, confirmed workarounds) vanish when they age out of the search window.
2. **Unverified web content in trusted context** - Raw community data auto-injected alongside hand-authored reference files creates prompt injection risk.

## The Solution: Staged Refresh + Human Curation

The system has three layers:

1. **Background hook** - A SessionStart hook silently refreshes the cache every 7 days using `@side-quest/community-intel-cache`. You never see it, you never wait for it.
2. **Verified intel** - Accepted community findings live in `references/verified-intel.md`, committed to git. This is the only community data loaded during normal Q&A.
3. **Upgrade flow** - Run `/hooks --upgrade` to review staged findings, accept or reject them. Accepted findings are appended to verified-intel.md and persist forever.

---

## The Three Modes

The skill operates in three modes. The key design principle: **never prompt the user about cache status**.

### Silent Mode (default)

Cache is fresh, or the question isn't critical enough to warrant a refresh. The skill uses whatever cache exists and proceeds immediately. This is the 95% path.

### Smart Refresh Mode

Cache is stale AND the question is about **Troubleshooting** - the category where stale community data could cause real harm (e.g., missing a known hooks bug or broken pattern). The skill tells the user "Refreshing community intel - this takes about 60 seconds," runs the refresh script inline, then answers with fresh data.

### On-demand Mode

The user passes `--refresh` (e.g., `/hooks --refresh why isn't my hook firing?`). Forces a refresh regardless of cache status. Useful when you know something changed and want the latest community findings.

---

## The Architecture

### Normal Q&A Flow

```
User invokes /hooks [--refresh] [question]
    |
    v
Step 0: Parse --refresh / --upgrade flags
    |
    v
Step 1a: Read cache/last-updated.json
    |
    +-- FORCE_REFRESH?  ---------> Refresh (on-demand)
    |
    +-- Cache fresh? ------------> Proceed silently
    |
    +-- Stale + Troubleshooting? --> Refresh (smart)
    |
    +-- Stale + anything else? --> Proceed silently with existing cache
    |
    v
Step 1d: Read references/verified-intel.md (curated, trusted)
    |
    v
Step 1f: Check for staged findings, nudge if new ones available
    |
    v
Steps 2-4: Classify, read references, answer
```

### Background Refresh

```
Session Start
    |
    v
hooks/hooks.json -> bunx @side-quest/community-intel-cache refresh
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
Write cache/staged-intel.md + cache/staged-raw.json + cache/last-updated.json
    |
    v
Done (next check in 3-7 days based on success ratio)
```

### Upgrade Flow

```
User: /hooks --upgrade
    |
    v
Extract unreviewed findings from staged-raw.json
    |
    v
Present batch summary (numbered list)
    |
    v
User picks: "All", "None", or "1,3,4"
    |
    v
Accepted -> appended to references/verified-intel.md (git-committed)
All decisions -> recorded in cache/reviewed-hashes.json (prevents re-surfacing)
```

---

## The Files

### Reference Files (static, hand-written)

Seven reference files under `skills/hooks/references/` cover the complete hooks API:

| File | Content |
|------|---------|
| `event-reference.md` | All 12 events with JSON schemas and decision control |
| `hook-types-and-config.md` | Three hook types, settings.json, matchers, env vars |
| `decision-control.md` | Exit codes, JSON output, decision patterns per event |
| `community-patterns.md` | 15 copy-pasteable recipes with full configs |
| `best-practices.md` | Performance, architecture, anti-patterns |
| `troubleshooting.md` | Symptom table, debug steps, known issues |
| `hooks-in-plugins.md` | Plugin hooks, skill hooks, agent hooks |

These are the source of truth. They're written from the official Claude Code documentation and don't change unless the hooks API changes.

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
            "command": "bunx @side-quest/community-intel-cache refresh --config \"${CLAUDE_PLUGIN_ROOT}/community-intel.json\" --cache-dir \"${CLAUDE_PLUGIN_ROOT}/skills/hooks/cache\"",
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

2. **`"async": true`** - The hook runs in the background. Your session starts instantly. The alternative was synchronous, which would block startup for up to 2 minutes once every 7 days - terrible UX, especially when you don't know why it's hanging.

3. **`"timeout": 180`** - If the refresh takes longer than 3 minutes, Claude Code kills it. The CLI handles this gracefully.

### `community-intel.json` - Research configuration

Defines the 6 research topics, refresh intervals, and context for LLM synthesis. Shared by the CLI package. The refresh interval is shorter (7 days) than the Dell plugin (30 days) because the hooks ecosystem moves faster - new patterns and issues surface weekly.

### `@side-quest/community-intel-cache` - The engine

The refresh logic was extracted to a shared npm package (`@side-quest/community-intel-cache`) so multiple plugins can reuse it. The CLI handles:

1. **Staleness check** - Fast path exits in <1ms if cache is fresh
2. **Parallel research** - Fires 6 topic queries via `@side-quest/last-30-days`
3. **Synthesis** - Uses `claude --print` to synthesize findings into markdown
4. **Atomic writes** - Writes `staged-intel.md`, `staged-raw.json`, and `last-updated.json`
5. **Extract/Review** - CLI commands for the upgrade workflow

The refresh interval scales:

- **Full success (50%+ queries)**: 7-day interval
- **Thin cache (<50% queries)**: 3-day interval (self-heals sooner)
- **Total failure (0 queries)**: 4-hour backoff (caps retries at ~6/day)

### `skills/hooks/SKILL.md` - The consumer

The skill's Step 0 parses flags (`--refresh`, `--upgrade`). Normal Q&A loads `references/verified-intel.md` (curated), not staged data. A footer nudge appears when unreviewed staged findings exist. The `--upgrade` flow lets you batch-review findings.

### `references/verified-intel.md` - Permanent knowledge

Accepted findings are appended here, committed to git. This file grows over time and never loses content. It's loaded as trusted reference material alongside the hand-authored reference files.

### Reset

To force a fresh refresh, use the CLI:

```bash
bunx @side-quest/community-intel-cache reset --cache-dir ./skills/hooks/cache
```

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
- Critical questions (troubleshooting) get auto-refreshed (smart mode)
- Users who want explicit control have `--refresh` (on-demand mode)

---

## Why Async Background + Inline Refresh

The background hook handles the 99% case: cache stays fresh, sessions start instantly. But when the cache is stale and the question is critical, the skill runs the refresh script inline (synchronous, ~60s). This is acceptable because:

- It only happens for troubleshooting questions with stale cache
- The user gets a clear "this takes about 60 seconds" message
- The alternative (answering with stale data) could recommend a broken pattern

The `--refresh` flag gives users explicit control when they know something changed.

---

## Why This Exists as a Plugin Hook (Not a Skill Hook)

This was originally a `PreToolUse:Read` hook defined in SKILL.md frontmatter. But plugin skill frontmatter hooks are broken - Claude Code silently ignores them (GitHub issue [anthropics/claude-code#17688](https://github.com/anthropics/claude-code/issues/17688)). The root cause: plugin skill loaders omit the `hooks` property from their returned definitions, while local skill loaders correctly include it.

The workaround: move the hook to `hooks/hooks.json` (plugin-level). Plugin-level hooks work correctly. The change also improved the architecture - SessionStart is a better trigger than PreToolUse:Read because it runs once at session start instead of on every file read.

---

## Why a Plugin Instead of CLAUDE.md?

Hooks knowledge is structured reference material, not project-specific instructions. A plugin with categorized reference files gives Claude the right context for each question without dumping everything into CLAUDE.md.

---

## Error Handling

The CLI is designed to never break your session:

- **All exit paths return 0** - A failing hook should never block Claude Code
- **Per-query timeouts** - A single slow query doesn't block the others
- **Partial success** - If 4 out of 6 queries succeed, the cache is written with those 4 (at a 3-day interval to self-heal)
- **Total failure backoff** - If all queries fail, a 4-hour backoff is written to prevent retry storms
- **Atomic writes** - Cache files use core/fs atomic operations
- **Diagnostics collection** - Errors are accumulated and emitted in the final status JSON for debugging
- **Max-age sanity check** - Cache older than 60 days is treated as stale regardless of `next_update_after` (guards against clock skew)

---

## Cache Lifecycle

```
Day 0:   First session -> no cache -> async refresh -> staged files written (7d interval)
Day 1:   Session start -> cache fresh -> exit <1ms
Day 1:   /hooks "hook not firing?" -> answers from reference files + verified-intel.md
         Footer: "3 new community findings available. Run /hooks --upgrade to review."
Day 1:   /hooks --upgrade -> reviews findings -> 2 accepted to verified-intel.md
Day 4:   Session start -> cache fresh -> exit <1ms
Day 7:   Session start -> cache stale -> async refresh -> new staged files
Day 7:   /hooks "hook not firing" before hook finishes
         -> stale + troubleshooting -> smart refresh (~60s) -> answer
Day 8:   /hooks --upgrade -> reviews new batch of findings
...
```

The `.gitignore` pattern `plugins/*/skills/*/cache/*` ensures cache files are never committed. Only `.gitkeep` is tracked. Verified intel lives in `references/verified-intel.md` and IS committed.
