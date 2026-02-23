# Decision Control Reference

How hooks communicate results back to Claude Code through exit codes and JSON output.

## Exit Codes

| Exit code | Meaning | JSON processed? |
|-----------|---------|-----------------|
| **0** | Success -- action proceeds | Yes, stdout parsed for JSON |
| **2** | Blocking error -- action stopped | No, stderr fed to Claude as error |
| **Other** | Non-blocking error -- action proceeds | No, stderr shown in verbose mode |

Choose one approach per hook: exit codes alone, OR exit 0 with JSON. Never mix exit 2 with JSON output.

## Exit Code 2 Behavior Per Event

| Event | Can block? | What happens on exit 2 |
|-------|------------|----------------------|
| PreToolUse | Yes | Blocks the tool call |
| PermissionRequest | Yes | Denies the permission |
| UserPromptSubmit | Yes | Blocks prompt processing, erases prompt |
| Stop | Yes | Prevents stopping, continues conversation |
| SubagentStop | Yes | Prevents subagent from stopping |
| PostToolUse | No | Shows stderr to Claude (tool already ran) |
| PostToolUseFailure | No | Shows stderr to Claude (tool already failed) |
| Notification | No | Shows stderr to user only |
| SubagentStart | No | Shows stderr to user only |
| SessionStart | No | Shows stderr to user only |
| SessionEnd | No | Shows stderr to user only |
| PreCompact | No | Shows stderr to user only |

---

## JSON Output Fields

### Universal Fields (all events)

| Field | Default | Description |
|-------|---------|-------------|
| `continue` | `true` | If false, Claude stops entirely. Takes precedence over event-specific fields |
| `stopReason` | none | Message shown to user when continue is false. Not shown to Claude |
| `suppressOutput` | `false` | If true, hides stdout from verbose mode |
| `systemMessage` | none | Warning message shown to user |

```json
{ "continue": false, "stopReason": "Build failed, fix errors first" }
```

---

## Decision Patterns by Event

### Top-Level Decision Pattern

Used by: **UserPromptSubmit**, **PostToolUse**, **PostToolUseFailure**, **Stop**, **SubagentStop**

```json
{
  "decision": "block",
  "reason": "Test suite must pass before proceeding"
}
```

- Only value is `"block"` -- to allow, omit `decision` or exit 0 with no JSON
- `reason` is shown to Claude (for Stop/SubagentStop, tells Claude why to continue)

### PreToolUse Decision Pattern

Uses `hookSpecificOutput` for richer control: allow, deny, or escalate.

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "Safe command",
    "updatedInput": { "command": "npm run lint" },
    "additionalContext": "Running in production environment"
  }
}
```

| Field | Description |
|-------|-------------|
| `permissionDecision` | `"allow"` bypasses permission, `"deny"` blocks, `"ask"` prompts user |
| `permissionDecisionReason` | For allow/ask: shown to user. For deny: shown to Claude |
| `updatedInput` | Modifies tool input before execution |
| `additionalContext` | Added to Claude's context |

**Deprecated fields:** Top-level `decision` and `reason` for PreToolUse are deprecated. Use `hookSpecificOutput` instead. Old values `"approve"` and `"block"` map to `"allow"` and `"deny"`.

### PermissionRequest Decision Pattern

Uses `hookSpecificOutput.decision` object.

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow",
      "updatedInput": { "command": "npm run lint" },
      "updatedPermissions": [{ "type": "toolAlwaysAllow", "tool": "Bash" }]
    }
  }
}
```

| Field | Description |
|-------|-------------|
| `behavior` | `"allow"` grants, `"deny"` denies |
| `updatedInput` | For allow: modifies tool input |
| `updatedPermissions` | For allow: applies "always allow" rules |
| `message` | For deny: tells Claude why |
| `interrupt` | For deny: if true, stops Claude |

---

## Context Injection

Several events support adding context to Claude's conversation:

| Event | Method | Notes |
|-------|--------|-------|
| SessionStart | Stdout text OR `additionalContext` | Multiple hooks' values concatenated |
| UserPromptSubmit | Stdout text OR `additionalContext` | Plain stdout shown as hook output |
| PreToolUse | `additionalContext` in hookSpecificOutput | Added before tool executes |
| PostToolUse | `additionalContext` in hookSpecificOutput | Added after tool success |
| PostToolUseFailure | `additionalContext` in hookSpecificOutput | Added alongside error |
| Notification | `additionalContext` in hookSpecificOutput | Added to conversation |
| SubagentStart | `additionalContext` in hookSpecificOutput | Injected into subagent |

---

## Decision Priority

When multiple hooks fire for the same event:
- All matching hooks run in parallel
- If any hook blocks (exit 2 or decision: "block"), the action is blocked
- For PreToolUse: deny takes precedence over allow/ask
- `continue: false` takes precedence over all event-specific decisions
