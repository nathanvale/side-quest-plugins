# Troubleshooting

Symptom table, debug steps, and known issues for Claude Code hooks.

## Quick Reference

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Hook not firing | Wrong matcher or event | Check `/hooks`, verify matcher is case-sensitive match |
| "Hook error" in transcript | Script exits non-zero unexpectedly | Test script standalone: `echo '{"tool_name":"Bash"}' \| ./hook.sh` |
| "command not found" | Script not executable or wrong path | `chmod +x ./hook.sh`, use absolute path or `$CLAUDE_PROJECT_DIR` |
| "jq: command not found" | jq not installed | `brew install jq` (macOS), `apt-get install jq` (Linux) |
| JSON validation failed | Shell profile echo statements | Wrap echos in `if [[ $- == *i* ]]` guard |
| `/hooks` shows no hooks | Manual file edit not reloaded | Restart session or open `/hooks` to reload |
| Stop hook runs forever | Missing `stop_hook_active` check | Check `stop_hook_active` field, exit 0 if true |
| Hook blocks everything | Overly broad exit 2 logic | Test edge cases, add safe early returns |
| PermissionRequest hook not firing in `-p` mode | Not supported in non-interactive mode | Use PreToolUse instead |
| Hook decision ignored | Using async hook | Async hooks cannot return decisions |
| Plugin hook can't be edited | Plugin hooks are read-only | Override with user/project hook at same event |
| Skill frontmatter hook not firing | Known issue (claude-code#17688) | Move hook to plugin `hooks/hooks.json` |
| Hook output not visible | Normal -- stdout hidden by default | Toggle verbose mode with `Ctrl+O` |
| Hook changes mid-session ignored | Security snapshot behavior | Review changes in `/hooks` menu or restart session |

---

## Debug Steps

### 1. Verify Hook is Registered

Type `/hooks` and check:
- Your hook appears under the correct event
- The matcher pattern is correct
- The source label matches where you defined it ([User], [Project], [Local], [Plugin])

### 2. Test Script Standalone

Pipe sample JSON to your script and check the exit code:

```bash
# Test with a command that should be blocked
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | ./my-hook.sh
echo "Exit code: $?"

# Test with a command that should pass
echo '{"tool_name":"Bash","tool_input":{"command":"npm test"}}' | ./my-hook.sh
echo "Exit code: $?"
```

### 3. Check Matcher Pattern

Matchers are case-sensitive regex:
- `Bash` matches "Bash" but not "bash"
- `Edit|Write` matches either tool
- `mcp__memory__.*` matches all memory server tools
- Empty string or `*` matches everything

### 4. Validate JSON Output

If your hook returns JSON, check it's valid:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"test"}}' | ./my-hook.sh | jq .
```

Common JSON issues:
- Shell profile printing text before JSON (see "JSON validation failed" below)
- Missing quotes around strings
- Trailing commas
- Using single quotes instead of double quotes

### 5. Check Environment Variables

In your hook script, verify variables are set:

```bash
echo "PROJECT_DIR: $CLAUDE_PROJECT_DIR" >&2
echo "PLUGIN_ROOT: ${CLAUDE_PLUGIN_ROOT}" >&2
```

stderr output appears in verbose mode (`Ctrl+O`).

### 6. Enable Debug Mode

```bash
claude --debug
```

Shows:
- Which hooks matched for each event
- Hook command that was executed
- Exit code returned
- Stdout/stderr output

Toggle verbose mode with `Ctrl+O` for hook output in the transcript.

---

## Known Issues

### Skill Frontmatter Hooks Silently Ignored

Plugin skill frontmatter hooks (`hooks:` in SKILL.md YAML) are silently ignored. The plugin skill loader omits the `hooks` property from returned definitions.

**Workaround:** Move hooks to `hooks/hooks.json` at the plugin level.

**Tracking:** [anthropics/claude-code#17688](https://github.com/anthropics/claude-code/issues/17688)

### Async Hooks Cannot Return Decisions

Setting `async: true` means the hook runs in the background. By the time it finishes, the action it was responding to has already completed. Decision fields like `permissionDecision`, `decision`, and `continue` have no effect.

**If you need to block:** Use synchronous hooks (default behavior).

### JSON Parse Failures from Shell Profile

When Claude Code runs a hook, it spawns a shell that sources your profile (`~/.zshrc` or `~/.bashrc`). Unconditional `echo` statements prepend text to JSON output:

```
Shell ready on arm64
{"decision": "block", "reason": "Not allowed"}
```

**Fix:** Wrap echo statements in an interactive-shell guard:

```bash
# In ~/.zshrc or ~/.bashrc
if [[ $- == *i* ]]; then
  echo "Shell ready"
fi
```

### PostToolUse Cannot Undo Actions

The tool has already executed by the time PostToolUse fires. You can provide feedback to Claude via `decision: "block"` with a `reason`, but the action itself cannot be reversed.

### Stop Hooks Fire on Every Response

Stop hooks fire whenever Claude finishes responding, not only at "task completion." A multi-turn conversation may trigger Stop after each response. Design your Stop hook logic to handle this -- don't assume it only fires once.

### PermissionRequest Not Available in Non-Interactive Mode

When running Claude Code with `-p` (non-interactive/headless mode), PermissionRequest hooks don't fire because there's no permission dialog. Use PreToolUse hooks instead for automated permission decisions.

### Hook Timeout Defaults

If your hook seems to get killed unexpectedly, check the timeout:

| Type | Default timeout |
|------|----------------|
| command | 600 seconds (10 minutes) |
| prompt | 30 seconds |
| agent | 60 seconds |

Set explicit `timeout` if your hook needs more or less time.
