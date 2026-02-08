# Community Patterns and Recipes

Complete, copy-pasteable hook configurations for common use cases. Each recipe includes the settings.json config and explanation.

---

## 1. Auto-Format on Edit (Prettier)

Format files after Claude edits them. Uses PostToolUse to run after Edit/Write.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

**Tip:** For Biome, replace with `jq -r '.tool_input.file_path' | xargs npx biome check --write`.

**Performance note:** Formatting on every edit adds context window noise. Consider formatting on commit instead (see recipe 5).

---

## 2. Dangerous Command Firewall

Block destructive shell commands before they execute.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/block-dangerous.sh"
          }
        ]
      }
    ]
  }
}
```

Script (`.claude/hooks/block-dangerous.sh`):
```bash
#!/bin/bash
COMMAND=$(jq -r '.tool_input.command')

DANGEROUS_PATTERNS=(
  'rm -rf'
  'git reset --hard'
  'git clean -f'
  'git push --force'
  'drop table'
  'drop database'
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qi "$pattern"; then
    echo "Blocked: '$pattern' is not allowed by hook policy" >&2
    exit 2
  fi
done

exit 0
```

---

## 3. Sensitive File Protection

Prevent Claude from modifying .env, lock files, or .git/ contents.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh"
          }
        ]
      }
    ]
  }
}
```

Script:
```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

PROTECTED_PATTERNS=(".env" "package-lock.json" ".git/" "yarn.lock" "bun.lockb")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH matches protected pattern '$pattern'" >&2
    exit 2
  fi
done

exit 0
```

---

## 4. Package Manager Enforcement

Force Claude to use your preferred package manager (e.g., pnpm over npm).

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.command' | grep -qE '^npm (install|add|remove|ci)' && { echo 'Use pnpm instead of npm' >&2; exit 2; } || exit 0"
          }
        ]
      }
    ]
  }
}
```

---

## 5. Auto-Commit Checkpoints

Create WIP commits after significant file changes.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/auto-checkpoint.sh",
            "async": true
          }
        ]
      }
    ]
  }
}
```

Script:
```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then exit 0; fi

cd "$CLAUDE_PROJECT_DIR" || exit 0
git add "$FILE_PATH"
git commit -m "chore(wip): session checkpoint" --no-verify 2>/dev/null || true
exit 0
```

---

## 6. Desktop Notifications (macOS)

Get notified when Claude needs attention.

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude Code needs your attention\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

For Linux: `notify-send 'Claude Code' 'Claude Code needs your attention'`

---

## 7. Context Re-Injection After Compaction

Re-inject critical context when the context window gets compacted.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Reminder: use Bun, not npm. Run bun test before committing. Current sprint: auth refactor.'"
          }
        ]
      }
    ]
  }
}
```

For dynamic context, replace the echo with a script that reads from git log, open issues, etc.

---

## 8. Test-Gated PR Creation

Block `gh pr create` until tests pass.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/test-gate-pr.sh"
          }
        ]
      }
    ]
  }
}
```

Script:
```bash
#!/bin/bash
COMMAND=$(jq -r '.tool_input.command')

if echo "$COMMAND" | grep -q 'gh pr create'; then
  TEST_RESULT=$(npm test 2>&1)
  if [ $? -ne 0 ]; then
    echo "Blocked: tests must pass before creating PR" >&2
    echo "$TEST_RESULT" >&2
    exit 2
  fi
fi

exit 0
```

---

## 9. Prompt-Based Stop Hook

Use an LLM to evaluate whether Claude has completed all tasks.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Evaluate if Claude should stop: $ARGUMENTS. Check if all tasks are complete, errors are addressed, and no follow-up work is needed. Respond with {\"ok\": true} to allow stopping, or {\"ok\": false, \"reason\": \"explanation\"} to continue.",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

---

## 10. Agent-Based Test Verification

Spawn an agent to verify tests pass before Claude finishes.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify that all unit tests pass. Run the test suite and check the results. $ARGUMENTS",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

---

## 11. Async Background Testing

Run tests in the background after file changes, report results on next turn.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/run-tests-async.sh",
            "async": true,
            "timeout": 300
          }
        ]
      }
    ]
  }
}
```

Script:
```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.js ]]; then
  exit 0
fi

RESULT=$(npm test 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "{\"systemMessage\": \"Tests passed after editing $FILE_PATH\"}"
else
  echo "{\"systemMessage\": \"Tests failed after editing $FILE_PATH: $RESULT\"}"
fi
```

---

## 12. Audit Logging

Log every Bash command Claude runs to a file.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.command' >> ~/.claude/command-log.txt"
          }
        ]
      }
    ]
  }
}
```

---

## 13. Environment Variable Setup

Set environment variables at session start using CLAUDE_ENV_FILE.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/setup-env.sh"
          }
        ]
      }
    ]
  }
}
```

Script:
```bash
#!/bin/bash
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo 'export NODE_ENV=development' >> "$CLAUDE_ENV_FILE"
  echo 'export DEBUG_LOG=true' >> "$CLAUDE_ENV_FILE"
  echo 'export PATH="$PATH:./node_modules/.bin"' >> "$CLAUDE_ENV_FILE"
fi
exit 0
```

---

## 14. MCP Tool Monitoring

Log operations from specific MCP servers.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__memory__.*",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"Memory operation: $(jq -r '.tool_name')\" >> ~/mcp-operations.log"
          }
        ]
      }
    ]
  }
}
```

---

## 15. Smart Dispatcher Pattern

Single entry point that routes to internal logic based on event data.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/smart-dispatch.sh"
          }
        ]
      }
    ]
  }
}
```

Script:
```bash
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Route 1: Block dangerous commands
for pattern in 'rm -rf' 'git reset --hard' 'git push --force'; do
  if echo "$COMMAND" | grep -qi "$pattern"; then
    echo "Blocked: '$pattern' is not allowed" >&2
    exit 2
  fi
done

# Route 2: Enforce package manager
if echo "$COMMAND" | grep -qE '^npm (install|add|remove)'; then
  echo "Use bun instead of npm" >&2
  exit 2
fi

# Route 3: Log everything
echo "$COMMAND" >> ~/.claude/command-log.txt

exit 0
```

A single dispatcher is easier to maintain than many separate hook entries.
