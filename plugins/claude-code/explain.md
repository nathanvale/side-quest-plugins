# Claude Code Hooks: HALT Community Intel Architecture

This plugin uses a shared HALT workflow so community intel behavior is consistent and DRY across skills.

HALT:

- **H**igh-signal visibility
- **A**daptive lazy loading
- **L**ifecycle clarity
- **T**rust + telemetry

## What Users Experience

1. Community intel refreshes in the background on SessionStart.
2. Users do not need manual curation steps to get new findings into verified intel.
3. The skill surfaces discoverability through:
   - one-time first-use note
   - top status line only when actionable
   - inline attribution when community intel informs a claim
4. `--upgrade` is optional and acts as an explicit sync report.

## Runtime Flow

### 1) Session start (always-on, async)

`hooks/hooks.json` runs:

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

This keeps staged cache current without blocking user flow.

### 2) Skill invocation (`/hooks ...`)

`skills/hooks/SKILL.md` does:

1. Read `../../shared/community-intel.adapter.json`
2. Read `../../shared/community-intel-workflow.md` (symlinked canonical workflow)
3. Execute HALT Step 0 + Step 1
4. Return to hooks-specific Step 2-4 for domain reasoning

Shared workflow Step 1 includes:

- forced inline refresh for troubleshooting signals (even if cache is technically fresh)
- auto-promotion from staged findings into `references/verified-intel.md`
- dedupe by finding hash
- lazy-loading guidance for verified intel
- status-line and attribution rules

## DRY Design

Community intel behavior is centralized once:

- Canonical workflow: `plugins/research/skills/community-intel/SKILL.md`
- Consumer symlink: `plugins/claude-code/shared/community-intel-workflow.md`
- Skill adapter: `plugins/claude-code/shared/community-intel.adapter.json`

Only adapter values are plugin-specific.

## Why `--upgrade` Still Exists

`--upgrade` is optional convenience for explicit sync-report mode:

- forces refresh + promotion pass
- returns sync summary
- does not require manual per-finding triage

Normal Q&A already performs auto-promotion checks, so most users never need this command.

## Files That Matter

- `plugins/claude-code/hooks/hooks.json`
- `plugins/claude-code/skills/hooks/SKILL.md`
- `plugins/claude-code/shared/community-intel.adapter.json`
- `plugins/claude-code/shared/community-intel-workflow.md` (symlink)
- `plugins/claude-code/skills/hooks/references/verified-intel.md`

## Safety and Reliability

- Refresh command is async and time-bounded.
- Failures degrade gracefully to static references plus previously verified intel.
- Unreviewed/staged data is not blindly injected as trusted context.
- Verified intel is append-only and hash-deduped.
