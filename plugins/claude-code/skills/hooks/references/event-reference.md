# Hook Events Reference

All 12 hook events in lifecycle order. Each event fires at a specific point during a Claude Code session.

## Quick Reference

| Event | When it fires | Can block? | Matcher filters on |
|-------|---------------|------------|-------------------|
| `SessionStart` | Session begins or resumes | No | How session started |
| `UserPromptSubmit` | User submits prompt, before processing | Yes | No matcher support |
| `PreToolUse` | Before a tool call executes | Yes | Tool name |
| `PermissionRequest` | Permission dialog appears | Yes | Tool name |
| `PostToolUse` | After a tool call succeeds | No | Tool name |
| `PostToolUseFailure` | After a tool call fails | No | Tool name |
| `Notification` | Claude Code sends a notification | No | Notification type |
| `SubagentStart` | Subagent is spawned | No | Agent type |
| `SubagentStop` | Subagent finishes | Yes | Agent type |
| `Stop` | Claude finishes responding | Yes | No matcher support |
| `PreCompact` | Before context compaction | No | Compaction trigger |
| `SessionEnd` | Session terminates | No | Exit reason |

## Common Input Fields

All events receive these fields via stdin as JSON:

| Field | Description |
|-------|-------------|
| `session_id` | Current session identifier |
| `transcript_path` | Path to conversation JSON |
| `cwd` | Current working directory when the hook is invoked |
| `permission_mode` | `"default"`, `"plan"`, `"acceptEdits"`, `"dontAsk"`, or `"bypassPermissions"` |
| `hook_event_name` | Name of the event that fired |

---

## SessionStart

Runs when Claude Code starts a new session or resumes an existing one. Keep these hooks fast -- they run on every session.

**Matcher values:**

| Matcher | When it fires |
|---------|---------------|
| `startup` | New session |
| `resume` | `--resume`, `--continue`, or `/resume` |
| `clear` | `/clear` |
| `compact` | Auto or manual compaction |

**Additional input fields:** `source`, `model`, optionally `agent_type`

```json
{
  "session_id": "abc123",
  "hook_event_name": "SessionStart",
  "source": "startup",
  "model": "claude-sonnet-4-5-20250929"
}
```

**Decision control:**
- Stdout text is added as context for Claude
- `additionalContext` in hookSpecificOutput is concatenated from multiple hooks
- Access to `CLAUDE_ENV_FILE` for persisting environment variables

---

## UserPromptSubmit

Runs when user submits a prompt, before Claude processes it. No matcher support -- always fires.

**Additional input fields:** `prompt`

```json
{
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Write a function to calculate factorial"
}
```

**Decision control:**
- Plain text stdout is added as context
- `decision: "block"` prevents prompt processing and erases it
- `additionalContext` in hookSpecificOutput adds context

---

## PreToolUse

Runs before a tool call executes. Matches on tool name: `Bash`, `Edit`, `Write`, `Read`, `Glob`, `Grep`, `Task`, `WebFetch`, `WebSearch`, and MCP tools (`mcp__<server>__<tool>`).

**Additional input fields:** `tool_name`, `tool_input`, `tool_use_id`

**Tool input schemas:**

| Tool | Key fields |
|------|-----------|
| **Bash** | `command`, `description`, `timeout`, `run_in_background` |
| **Write** | `file_path`, `content` |
| **Edit** | `file_path`, `old_string`, `new_string`, `replace_all` |
| **Read** | `file_path`, `offset`, `limit` |
| **Glob** | `pattern`, `path` |
| **Grep** | `pattern`, `path`, `glob`, `output_mode`, `-i`, `multiline` |
| **WebFetch** | `url`, `prompt` |
| **WebSearch** | `query`, `allowed_domains`, `blocked_domains` |
| **Task** | `prompt`, `description`, `subagent_type`, `model` |

**Decision control (via hookSpecificOutput):**

| Field | Description |
|-------|-------------|
| `permissionDecision` | `"allow"` bypasses permission, `"deny"` blocks, `"ask"` prompts user |
| `permissionDecisionReason` | For allow/ask: shown to user. For deny: shown to Claude |
| `updatedInput` | Modifies tool input before execution |
| `additionalContext` | Added to Claude's context before tool executes |

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Destructive command blocked"
  }
}
```

---

## PermissionRequest

Runs when a permission dialog is about to be shown. Matches on tool name. Does not fire in non-interactive mode (`-p`) -- use PreToolUse instead.

**Additional input fields:** `tool_name`, `tool_input`, `permission_suggestions`

**Decision control (via hookSpecificOutput.decision):**

| Field | Description |
|-------|-------------|
| `behavior` | `"allow"` grants permission, `"deny"` denies it |
| `updatedInput` | For allow: modifies tool input |
| `updatedPermissions` | For allow: applies "always allow" rules |
| `message` | For deny: tells Claude why |
| `interrupt` | For deny: if true, stops Claude |

---

## PostToolUse

Runs after a tool completes successfully. Cannot undo -- tool already ran.

**Additional input fields:** `tool_name`, `tool_input`, `tool_response`, `tool_use_id`

**Decision control:**
- `decision: "block"` with `reason` provides feedback to Claude
- `additionalContext` in hookSpecificOutput adds context
- `updatedMCPToolOutput` replaces MCP tool output

---

## PostToolUseFailure

Runs when a tool execution fails.

**Additional input fields:** `tool_name`, `tool_input`, `tool_use_id`, `error`, `is_interrupt`

**Decision control:**
- `additionalContext` in hookSpecificOutput adds context about the failure

---

## Notification

Runs when Claude Code sends notifications.

**Matcher values:** `permission_prompt`, `idle_prompt`, `auth_success`, `elicitation_dialog`

**Additional input fields:** `message`, `title`, `notification_type`

Cannot block or modify notifications. Can return `additionalContext`.

---

## SubagentStart

Runs when a subagent is spawned via the Task tool.

**Matcher values:** `Bash`, `Explore`, `Plan`, or custom agent names

**Additional input fields:** `agent_id`, `agent_type`

Cannot block subagent creation. Can inject `additionalContext` into the subagent.

---

## SubagentStop

Runs when a subagent finishes.

**Additional input fields:** `stop_hook_active`, `agent_id`, `agent_type`, `agent_transcript_path`

**Decision control:** Same as Stop -- `decision: "block"` with `reason` prevents the subagent from stopping.

---

## Stop

Runs when the main Claude agent finishes responding. Does not fire on user interrupts. No matcher support.

**Additional input fields:** `stop_hook_active` (true if already continuing from a stop hook)

**Decision control:**
- `decision: "block"` with `reason` prevents Claude from stopping
- Check `stop_hook_active` to prevent infinite loops

```json
{ "decision": "block", "reason": "Tests not yet verified" }
```

---

## PreCompact

Runs before context compaction.

**Matcher values:** `manual` (from `/compact`), `auto` (context window full)

**Additional input fields:** `trigger`, `custom_instructions`

Cannot block compaction. Can return `additionalContext`.

---

## SessionEnd

Runs when a session terminates. Useful for cleanup tasks.

**Matcher values:** `clear`, `logout`, `prompt_input_exit`, `bypass_permissions_disabled`, `other`

**Additional input fields:** `reason`

No decision control. Cannot block termination.
