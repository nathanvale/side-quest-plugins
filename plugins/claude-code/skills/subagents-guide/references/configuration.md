# Sub-agent Configuration

How to create, configure, and manage custom sub-agents: file format, frontmatter fields, scope, tool control, hooks, memory, and the /agents command.

Source: code.claude.com/docs/en/sub-agents

---

## Creating Sub-agents

### Using /agents Command (Recommended)

The `/agents` command provides an interactive interface:
- View all available sub-agents (built-in, user, project, plugin)
- Create new sub-agents with guided setup or Claude generation
- Edit existing sub-agent configuration and tool access
- Delete custom sub-agents
- See which sub-agents are active when duplicates exist

### Manual Creation

Sub-agent files use YAML frontmatter for configuration, followed by the system prompt in Markdown:

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

Sub-agents are loaded at session start. If you create one manually, restart your session or use `/agents` to load it immediately.

---

## Scope and Priority

Store sub-agents in different locations depending on scope. Higher-priority locations win when names conflict.

| Location | Path | Scope | Priority |
|----------|------|-------|----------|
| CLI flag | `--agents '{json}'` | Current session only | 1 (highest) |
| Project | `.claude/agents/` | This project | 2 |
| User | `~/.claude/agents/` | All your projects | 3 |
| Plugin | Plugin's `agents/` directory | Where plugin is enabled | 4 (lowest) |

**Project agents** -- ideal for codebase-specific agents. Check into version control.

**User agents** -- personal agents available everywhere.

**CLI agents** -- exist only for the session, useful for quick testing or automation:

```bash
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  }
}'
```

---

## Frontmatter Reference

### Required Fields

| Field | Rules |
|-------|-------|
| `name` | Lowercase letters and hyphens only. Must match folder name. Max 64 characters. |
| `description` | When Claude should delegate to this sub-agent. Claude uses this to decide when to use it. |

### Optional Fields

| Field | Description | Default |
|-------|-------------|---------|
| `tools` | Tools the sub-agent can use (allowlist). Inherits all if omitted. | Inherits all |
| `disallowedTools` | Tools to deny (denylist), removed from inherited or specified list. | -- |
| `model` | `sonnet`, `opus`, `haiku`, or `inherit`. | `inherit` |
| `permissionMode` | `default`, `acceptEdits`, `dontAsk`, `delegate`, `bypassPermissions`, or `plan`. | `default` |
| `maxTurns` | Maximum agentic turns before the sub-agent stops. | -- |
| `skills` | Skills to preload into sub-agent context at startup (full content injected). | -- |
| `mcpServers` | MCP servers available. Server name (referencing configured server) or inline definition. | -- |
| `hooks` | Lifecycle hooks scoped to this sub-agent. | -- |
| `memory` | Persistent memory scope: `user`, `project`, or `local`. | -- |

---

## Tool Control

### Allowlist with `tools`

```yaml
tools: Read, Grep, Glob, Bash
```

### Denylist with `disallowedTools`

```yaml
disallowedTools: Write, Edit
```

### Restricting Sub-agent Spawning

When an agent runs as the main thread with `claude --agent`, restrict which sub-agents it can spawn:

```yaml
tools: Task(worker, researcher), Read, Bash
```

This allowlists only `worker` and `researcher`. To allow any sub-agent: `Task` without parentheses. To block all spawning: omit `Task` from tools entirely.

This restriction only applies to agents running as the main thread. Sub-agents cannot spawn other sub-agents regardless.

### Disabling Specific Sub-agents

Add to the `deny` array in settings or use CLI flag:

```json
{
  "permissions": {
    "deny": ["Task(Explore)", "Task(my-custom-agent)"]
  }
}
```

```bash
claude --disallowedTools "Task(Explore)"
```

---

## Permission Modes

| Mode | Behavior |
|------|----------|
| `default` | Standard permission checking with prompts |
| `acceptEdits` | Auto-accept file edits |
| `dontAsk` | Auto-deny permission prompts (explicitly allowed tools still work) |
| `delegate` | Coordination-only mode for agent team leads. Restricts to team management tools |
| `bypassPermissions` | Skip all permission checks (use with caution) |
| `plan` | Plan mode (read-only exploration) |

If the parent uses `bypassPermissions`, it takes precedence and cannot be overridden.

---

## Preloading Skills

Inject skill content into a sub-agent's context at startup:

```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---

Implement API endpoints. Follow the conventions from the preloaded skills.
```

Full skill content is injected, not just made available for invocation. Sub-agents don't inherit skills from the parent -- list them explicitly.

---

## MCP Server Access

Reference configured servers by name or define inline:

```yaml
mcpServers:
  - slack
  - name: custom-server
    command: node
    args: ["server.js"]
```

**Important**: MCP tools are NOT available in background sub-agents.

---

## Hooks

### In Sub-agent Frontmatter

Hooks defined in frontmatter only run while that sub-agent is active:

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
```

`Stop` hooks in frontmatter are automatically converted to `SubagentStop` events.

### In settings.json (Project-Level)

Respond to sub-agent lifecycle events in the main session:

```json
{
  "hooks": {
    "SubagentStart": [
      {
        "matcher": "db-agent",
        "hooks": [
          { "type": "command", "command": "./scripts/setup-db.sh" }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          { "type": "command", "command": "./scripts/cleanup.sh" }
        ]
      }
    ]
  }
}
```

| Event | Matcher Input | When It Fires |
|-------|---------------|---------------|
| `PreToolUse` | Tool name | Before the sub-agent uses a tool |
| `PostToolUse` | Tool name | After the sub-agent uses a tool |
| `Stop` | (none) | When the sub-agent finishes (converted to SubagentStop) |
| `SubagentStart` | Agent type name | When a sub-agent begins execution |
| `SubagentStop` | Agent type name | When a sub-agent completes |

---

## Persistent Memory

Give sub-agents a persistent directory that survives across conversations:

```yaml
---
name: code-reviewer
description: Reviews code for quality and best practices
memory: user
---

You are a code reviewer. Update your agent memory with patterns,
conventions, and recurring issues you discover.
```

| Scope | Location | Use When |
|-------|----------|----------|
| `user` | `~/.claude/agent-memory/<name>/` | Learnings across all projects (recommended default) |
| `project` | `.claude/agent-memory/<name>/` | Project-specific, shareable via version control |
| `local` | `.claude/agent-memory-local/<name>/` | Project-specific, NOT checked into version control |

When memory is enabled:
- System prompt includes instructions for reading/writing to the memory directory
- First 200 lines of `MEMORY.md` in the memory directory are included in the prompt
- Read, Write, Edit tools are automatically enabled

**Tips**:
- Ask the sub-agent to consult its memory before starting work
- Ask it to update memory after completing a task
- Include memory instructions directly in the agent's markdown file
