# Best Practices

Performance, architecture, testing, and anti-patterns for Claude Code hooks.

## Performance

### Format on Commit, Not Every Edit

Running formatters on every Edit/Write call adds context window noise -- Claude sees the formatter output in the transcript and may react to it. Consider running formatters:
- On commit (via a pre-commit hook or git hook) instead of on every edit
- Using `async: true` so formatting doesn't block Claude's flow
- Only on specific file types (check file extension in your script)

### Keep Hook Scripts Under 500ms

Synchronous hooks block Claude. Long-running hooks cause noticeable delays. If your hook needs to do heavy work:
- Use `async: true` for non-critical hooks
- Move expensive validation to Stop hooks (run once, not per-tool)
- Cache results locally instead of re-computing

### Use Async for Non-Blocking Operations

Background processing via `async: true` is ideal for:
- Test suites
- Deployment checks
- External API calls
- Logging and analytics

Remember: async hooks cannot return decisions -- the action already proceeded.

---

## Architecture

### Smart Dispatcher Over Many Entries

Instead of many separate matcher groups each with their own script, use one dispatcher script that handles multiple concerns:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/dispatch.sh" }
        ]
      }
    ]
  }
}
```

Benefits: single entry point, easier to debug, no ordering surprises.

### Check stop_hook_active

Stop and SubagentStop hooks can cause infinite loops. Always check:

```bash
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0  # Allow stop
fi
```

Without this check, a Stop hook that blocks will trigger itself endlessly.

### Use Environment Variables for Portable Paths

- `$CLAUDE_PROJECT_DIR` -- project root, works in all hooks
- `${CLAUDE_PLUGIN_ROOT}` -- plugin root, works in plugin hooks
- Always quote paths: `"$CLAUDE_PROJECT_DIR"/.claude/hooks/script.sh`

### Keep Block Messages Short and Actionable

When blocking with exit 2 or `decision: "block"`, the message goes to Claude. Make it:
- Short (Claude's context is limited)
- Actionable (tell Claude what to do instead)
- Specific (which rule was violated)

Good: `"Use bun instead of npm for package management"`
Bad: `"This command violates our organizational policy on package management tooling selection criteria"`

---

## Testing

### Pipe Sample JSON Locally First

Before registering a hook, test it standalone:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | ./my-hook.sh
echo $?  # Should be 2 (blocked)
```

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"npm test"}}' | ./my-hook.sh
echo $?  # Should be 0 (allowed)
```

### Make Scripts Executable

```bash
chmod +x .claude/hooks/my-hook.sh
```

If you see "command not found" errors, the script likely isn't executable.

### Use Debug Mode

- `claude --debug` shows which hooks matched, exit codes, and output
- `Ctrl+O` toggles verbose mode for hook output in the transcript
- Check `/hooks` to verify your hook appears under the correct event

### Treat Hooks Like Production Code

Hooks run on every tool call (potentially hundreds per session). A buggy hook can:
- Block all tool calls (exit 2 unconditionally)
- Cause infinite loops (Stop hook without stop_hook_active check)
- Slow down every interaction (heavy synchronous processing)
- Break JSON parsing (shell profile echo statements)

---

## Anti-Patterns

| Anti-Pattern | Problem | Better Approach |
|-------------|---------|-----------------|
| Format on every Edit/Write | Context window noise, Claude reacts to formatter output | Format on commit or use async |
| Heavy sync processing | Blocks Claude for seconds | Use `async: true` or move to Stop hook |
| Stop hook without stop_hook_active check | Infinite loop | Check `stop_hook_active` and exit 0 if true |
| Hardcoded paths in hook commands | Breaks on different machines | Use `$CLAUDE_PROJECT_DIR` or `${CLAUDE_PLUGIN_ROOT}` |
| Echo statements in shell profile | Breaks JSON parsing in hooks | Wrap echos in `if [[ $- == *i* ]]` guard |
| Many separate hook entries for same event | Hard to debug, ordering surprises | Single smart dispatcher script |
| Exit 2 with JSON on stdout | JSON is ignored on exit 2 | Choose one: exit codes OR exit 0 with JSON |

---

## Security Considerations

- Hooks run with your full user permissions -- review all hook scripts before adding
- Always quote shell variables (`"$VAR"` not `$VAR`)
- Check for path traversal (`..`) in file paths from tool_input
- Avoid processing `.env`, `.git/`, keys, and credentials
- Use absolute paths for scripts
- Validate and sanitize all input from stdin JSON

---

## When to Use Each Hook Type

| Scenario | Recommended Type | Why |
|----------|-----------------|-----|
| Block dangerous commands | `command` | Deterministic, fast, no LLM needed |
| Format code after edits | `command` | Run external tool, no judgment needed |
| Desktop notifications | `command` | Simple shell command |
| Evaluate task completeness | `prompt` | Requires judgment, no file access needed |
| Verify tests pass before stopping | `agent` | Needs to run commands and inspect output |
| Auto-approve safe operations | `command` | Deterministic pattern matching |
| Complex policy evaluation | `prompt` | Nuanced rules better handled by LLM |
