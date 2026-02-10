# Dell U4025QW: HALT Community Intel Architecture

This plugin uses the shared HALT workflow so community intel UX and behavior match other knowledge-bank skills with minimal duplication.

HALT:

- **H**igh-signal visibility
- **A**daptive lazy loading
- **L**ifecycle clarity
- **T**rust + telemetry

## What Users Experience

1. Community intel refreshes automatically in the background.
2. The skill auto-promotes staged findings into verified intel during normal use.
3. Discoverability is explicit but low-noise:
   - one-time first-use note
   - top status line only when actionable
   - inline attribution when community intel informs a claim
4. `--upgrade` is optional sync-report mode, not a required workflow step.

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

### 2) Skill invocation (`/tech-support ...`)

`skills/dell-u4025qw/SKILL.md` does:

1. Read `../../shared/community-intel.adapter.json`
2. Read `../../shared/community-intel-workflow.md` (symlinked canonical workflow)
3. Execute HALT Step 0 + Step 1
4. Return to Dell-specific Step 2-4 for monitor-domain synthesis

Shared workflow Step 1 handles:

- stale/fresh decisioning
- forced inline refresh for troubleshooting/firmware signals (even if cache is technically fresh)
- auto-promotion from staged findings to verified intel
- hash dedupe
- status line + inline attribution guidance
- lazy loading of verified intel slices

## DRY Design

Community intel logic is authored once:

- Canonical workflow: `plugins/research/skills/community-intel/SKILL.md`
- Consumer symlink: `plugins/dell-u4025qw/shared/community-intel-workflow.md`
- Skill adapter: `plugins/dell-u4025qw/shared/community-intel.adapter.json`

Dell-specific values (paths/keywords) live only in the adapter.

## Why `--upgrade` Still Exists

`--upgrade` is optional and triggers a forced sync report:

- refresh + auto-promotion
- summary output
- no manual accept/reject loop

Users can ignore it in normal operation.

## Files That Matter

- `plugins/dell-u4025qw/hooks/hooks.json`
- `plugins/dell-u4025qw/skills/dell-u4025qw/SKILL.md`
- `plugins/dell-u4025qw/shared/community-intel.adapter.json`
- `plugins/dell-u4025qw/shared/community-intel-workflow.md` (symlink)
- `plugins/dell-u4025qw/skills/dell-u4025qw/references/verified-intel.md`

## Safety and Reliability

- Async refresh avoids startup blocking.
- Degraded mode falls back to static references + existing verified intel.
- Staged content is promoted with hash-based dedupe.
- Community-derived claims should be attributed inline.
