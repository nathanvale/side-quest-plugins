# Hooks in Plugins, Skills, and Agents

How to define hooks in plugins, skill frontmatter, and agent frontmatter.

## Plugin Hooks

Plugin hooks are defined in `hooks/hooks.json` at the plugin root. They activate when the plugin is enabled and merge with user and project hooks.

### Format

```json
{
  "description": "What these hooks do",
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<regex>",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/my-hook.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Key Details

- **`description`** -- optional top-level field describing the hook's purpose
- **`${CLAUDE_PLUGIN_ROOT}`** -- resolves to the plugin's root directory
- **Read-only in /hooks menu** -- labeled `[Plugin]`, cannot be edited via menu
- **All events supported** -- SessionStart, PreToolUse, PostToolUse, etc.
- **Async supported** -- `"async": true` works in plugin hooks

### Example: Background Cache Refresh

```json
{
  "description": "Refresh community intelligence cache at session start",
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

---

## Skill Frontmatter Hooks

Skills can define hooks in their YAML frontmatter. These hooks are scoped to the skill's lifecycle -- they only run while the skill is active.

### Format

```yaml
---
name: secure-operations
description: Perform operations with security checks
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/security-check.sh"
---
```

### Key Details

- **Scoped to skill lifetime** -- cleaned up when skill finishes
- **All events supported** -- same events as settings-based hooks
- **`once` field supported** -- if true, runs only once per session
- **Same configuration format** -- just written in YAML instead of JSON

### Known Issue

Plugin skill frontmatter hooks are currently silently ignored. The plugin skill loader omits the `hooks` property from returned definitions. Local project skills work correctly.

**Workaround:** Move hooks to `hooks/hooks.json` at the plugin level instead of in skill frontmatter.

**Tracking:** [anthropics/claude-code#17688](https://github.com/anthropics/claude-code/issues/17688)

---

## Agent Frontmatter Hooks

Agents (subagents) use the same frontmatter format as skills. One key difference: `Stop` hooks in agent frontmatter are automatically converted to `SubagentStop`, since that's the event that fires when a subagent completes.

### Format

```yaml
---
description: Agent with completion verification
hooks:
  Stop:
    - hooks:
        - type: prompt
          prompt: "Check if the agent completed all tasks: $ARGUMENTS"
---
```

This `Stop` hook automatically becomes a `SubagentStop` hook at runtime.

---

## Settings.json vs Plugin Hooks

| Aspect | settings.json | Plugin hooks/hooks.json |
|--------|--------------|------------------------|
| **Location** | `.claude/settings.json` or `~/.claude/settings.json` | `hooks/hooks.json` in plugin root |
| **Scope** | Project or user-wide | When plugin is enabled |
| **Editable via /hooks** | Yes | Read-only |
| **Path variables** | `$CLAUDE_PROJECT_DIR` | `${CLAUDE_PLUGIN_ROOT}` |
| **Shareable** | Via repo (project) or not (user) | Yes, bundled with plugin |
| **Description field** | No | Yes (top-level) |

---

## SubagentStart and SubagentStop

These events track the lifecycle of subagents spawned via the Task tool.

**SubagentStart:**
- Fires when a subagent is created
- Matcher filters on agent type: `Bash`, `Explore`, `Plan`, or custom names
- Can inject `additionalContext` into the subagent
- Cannot block subagent creation

**SubagentStop:**
- Fires when a subagent finishes
- Includes `agent_transcript_path` for the subagent's own transcript
- Can block the subagent from stopping (same as Stop decision control)
- Check `stop_hook_active` to prevent infinite loops

---

## Managed Policy Hooks

Enterprise administrators can use managed policy settings to define organization-wide hooks. Setting `allowManagedHooksOnly` blocks all user, project, and plugin hooks -- only managed policy hooks will run.

---

## The /hooks Menu Labels

| Label | Source |
|-------|--------|
| `[User]` | `~/.claude/settings.json` |
| `[Project]` | `.claude/settings.json` |
| `[Local]` | `.claude/settings.local.json` |
| `[Plugin]` | Plugin's `hooks/hooks.json` |
