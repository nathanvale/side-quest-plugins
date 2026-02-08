# How the Claude Code Hooks Plugin Works

*A knowledge bank that stays current with community discoveries.*

---

## What This Plugin Does

The `claude-code` plugin provides a `/hooks` knowledge-bank skill that answers questions about Claude Code hooks -- event lifecycle, hook types (command, prompt, agent), configuration, community patterns, best practices, and troubleshooting.

It combines hand-written reference files (source of truth from official docs) with auto-refreshed community intelligence (recent discoveries from Reddit, X, and web).

---

## The Architecture

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

### Community Intelligence (auto-refreshed)

A background SessionStart hook refreshes community intel every 7 days using `@side-quest/community-intel-cache`. This captures recent community discoveries -- new patterns, workarounds, issues people are reporting.

The refresh interval is shorter (7 days) than the Dell plugin (30 days) because the hooks ecosystem moves faster -- new patterns and issues surface weekly.

---

## Community Intel Refresh

The system uses the same three-mode architecture as the Dell U4025QW plugin:

1. **Silent mode** (default) -- cache is fresh, or the question isn't critical. Uses whatever cache exists.
2. **Smart refresh mode** -- cache is stale AND the question is about troubleshooting. Runs an inline refresh (~60 seconds).
3. **On-demand mode** -- user passes `--refresh`. Forces a refresh regardless.

### Background Hook

```
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
Gather: 6 parallel research queries via @side-quest/last-30-days
    |
    v
Synthesize: pipe results through claude --print for structured markdown
    |
    v
Write cache/community-intel.md + cache/last-updated.json (atomic)
    |
    v
Done (next check in 3-7 days based on success ratio)
```

### Why 7 Days Instead of 30?

The hooks ecosystem is more active than the Dell monitor community. New patterns, issues, and best practices surface weekly as people experiment with hooks. A 7-day refresh interval captures this without being excessive.

---

## The Files

### `community-intel.json` -- Topic configuration

```json
{
  "topics": [
    "Claude Code hooks best practices automation",
    "Claude Code PreToolUse PostToolUse hook examples",
    ...
  ],
  "refreshIntervalDays": 7,
  "thinCacheIntervalDays": 3,
  "context": "Knowledge-bank skill for Claude Code hooks. Focus on: new hook patterns, community recipes, configuration tips, troubleshooting solutions..."
}
```

### `hooks/hooks.json` -- Background trigger

```json
{
  "description": "Refresh community intelligence cache for hooks knowledge at session start",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear",
        "hooks": [
          {
            "type": "command",
            "command": "bunx @side-quest/community-intel-cache refresh --config ${CLAUDE_PLUGIN_ROOT}/community-intel.json --cache-dir ${CLAUDE_PLUGIN_ROOT}/skills/hooks/cache",
            "timeout": 180,
            "async": true
          }
        ]
      }
    ]
  }
}
```

Same design choices as the Dell plugin:
1. **`"matcher": "startup|clear"`** -- fires on new sessions and after `/clear`
2. **`"async": true`** -- runs in background, session starts instantly
3. **`"timeout": 180`** -- 3-minute hard limit

---

## Design Decisions

### Why a Plugin Instead of CLAUDE.md?

Hooks knowledge is structured reference material, not project-specific instructions. A plugin with categorized reference files gives Claude the right context for each question without dumping everything into CLAUDE.md.

### Why Community Intel for a Docs-Based Skill?

The official docs are the source of truth, but the community discovers patterns, gotchas, and workarounds that aren't in the docs. Community intel captures "people are reporting that X doesn't work as expected" and "here's a pattern that's becoming popular."

### Why Zero Refresh Infrastructure?

The `@side-quest/community-intel-cache` CLI handles the entire pipeline -- staleness checks, parallel research queries, LLM synthesis, atomic writes. Adding community intel to a new plugin is just a JSON config file and a hook entry.
