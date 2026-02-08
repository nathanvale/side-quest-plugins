# Hook Types and Configuration

Three hook types, configuration locations, matcher patterns, environment variables, and the `/hooks` menu.

## Three Hook Types

| Type | How it works | Decision method | Best for |
|------|-------------|----------------|----------|
| `command` | Runs a shell command | Exit codes + JSON stdout | Deterministic rules, scripts, external tools |
| `prompt` | Single LLM call (Haiku default) | `{ ok: true/false, reason }` | Judgment-based decisions without file access |
| `agent` | Multi-turn subagent with tool access | `{ ok: true/false, reason }` | Verification requiring file inspection |

### Command Hooks

Your script receives JSON on stdin. Communicate results via exit codes and stdout.

| Field | Required | Description |
|-------|----------|-------------|
| `type` | yes | `"command"` |
| `command` | yes | Shell command to execute |
| `timeout` | no | Seconds before canceling (default: 600) |
| `statusMessage` | no | Custom spinner message while running |
| `once` | no | If true, runs only once per session (skills only) |
| `async` | no | If true, runs in background without blocking |

### Prompt Hooks

Single-turn LLM evaluation. Supported events: PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, UserPromptSubmit, Stop, SubagentStop.

| Field | Required | Description |
|-------|----------|-------------|
| `type` | yes | `"prompt"` |
| `prompt` | yes | Prompt text. Use `$ARGUMENTS` for hook input JSON |
| `model` | no | Model to use (default: fast model) |
| `timeout` | no | Seconds (default: 30) |

Response schema:
```json
{ "ok": true }
{ "ok": false, "reason": "Explanation shown to Claude" }
```

### Agent Hooks

Multi-turn subagent with access to Read, Grep, Glob tools. Up to 50 turns. Same events as prompt hooks.

| Field | Required | Description |
|-------|----------|-------------|
| `type` | yes | `"agent"` |
| `prompt` | yes | Prompt describing what to verify. Use `$ARGUMENTS` for input |
| `model` | no | Model to use (default: fast model) |
| `timeout` | no | Seconds (default: 60) |

Same response schema as prompt hooks.

---

## Configuration Structure

Hooks are defined in JSON with three levels of nesting:

```json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<regex pattern>",
        "hooks": [
          {
            "type": "command",
            "command": "your-script.sh"
          }
        ]
      }
    ]
  }
}
```

1. **Event** -- which lifecycle point (e.g., `PreToolUse`)
2. **Matcher group** -- regex filter for when it fires (e.g., `"Bash"`)
3. **Hook handlers** -- one or more handlers to run when matched

All matching hooks run in parallel. Identical handlers are deduplicated automatically.

---

## Configuration Locations

| Location | Scope | Shareable |
|----------|-------|-----------|
| `~/.claude/settings.json` | All your projects | No, local to machine |
| `.claude/settings.json` | Single project | Yes, committable |
| `.claude/settings.local.json` | Single project | No, gitignored |
| Managed policy settings | Organization-wide | Yes, admin-controlled |
| Plugin `hooks/hooks.json` | When plugin is enabled | Yes, bundled with plugin |
| Skill/agent frontmatter | While component is active | Yes, in component file |

Hooks added through `/hooks` menu take effect immediately. Manual file edits require reload or session restart.

---

## Matcher Patterns

The `matcher` field is a regex string. Use `"*"`, `""`, or omit entirely to match all occurrences.

| Event | What matcher filters | Example values |
|-------|---------------------|----------------|
| PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest | Tool name | `Bash`, `Edit\|Write`, `mcp__.*` |
| SessionStart | How session started | `startup`, `resume`, `clear`, `compact` |
| SessionEnd | Why session ended | `clear`, `logout`, `prompt_input_exit`, `other` |
| Notification | Notification type | `permission_prompt`, `idle_prompt`, `auth_success` |
| SubagentStart, SubagentStop | Agent type | `Bash`, `Explore`, `Plan`, custom names |
| PreCompact | Compaction trigger | `manual`, `auto` |
| UserPromptSubmit, Stop | No matcher support | Always fires |

Matchers are case-sensitive regex: `Edit|Write` matches either tool, `Notebook.*` matches any tool starting with "Notebook".

### MCP Tool Matching

MCP tools follow `mcp__<server>__<tool>` pattern:

- `mcp__memory__create_entities` -- Memory server's create tool
- `mcp__filesystem__read_file` -- Filesystem server's read tool
- `mcp__memory__.*` -- All tools from memory server
- `mcp__.*__write.*` -- Any "write" tool from any server

---

## Environment Variables

| Variable | Available in | Description |
|----------|-------------|-------------|
| `$CLAUDE_PROJECT_DIR` | All hooks | Project root directory |
| `${CLAUDE_PLUGIN_ROOT}` | Plugin hooks | Plugin's root directory |
| `$CLAUDE_ENV_FILE` | SessionStart only | File path for persisting env vars |
| `$CLAUDE_CODE_REMOTE` | All hooks | Set to `"true"` in remote web environments |

### CLAUDE_ENV_FILE

Write `export` statements to persist environment variables for subsequent Bash commands:

```bash
#!/bin/bash
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo 'export NODE_ENV=production' >> "$CLAUDE_ENV_FILE"
  echo 'export PATH="$PATH:./node_modules/.bin"' >> "$CLAUDE_ENV_FILE"
fi
exit 0
```

Use `>>` (append) to preserve variables set by other hooks.

---

## The /hooks Menu

Type `/hooks` in Claude Code to view, add, and delete hooks interactively.

Each hook is labeled with its source:
- `[User]` -- from `~/.claude/settings.json`
- `[Project]` -- from `.claude/settings.json`
- `[Local]` -- from `.claude/settings.local.json`
- `[Plugin]` -- from plugin's `hooks/hooks.json` (read-only)

The menu includes a toggle to disable all hooks (`"disableAllHooks": true`).

---

## Async Hooks

Set `"async": true` on command hooks to run in the background.

Constraints:
- Only `type: "command"` supports async
- Cannot return decisions (action already proceeded)
- Output delivered on next conversation turn via `systemMessage` or `additionalContext`
- Each execution creates a separate background process (no deduplication)

---

## Security Snapshot

Hooks capture a snapshot at startup. Mid-session changes to hook config are detected and require review in `/hooks` before taking effect. This prevents malicious modifications from running without user review.

Enterprise admins can set `allowManagedHooksOnly` to block user, project, and plugin hooks.
