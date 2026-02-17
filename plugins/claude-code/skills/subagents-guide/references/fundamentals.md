# Sub-agents Fundamentals

What sub-agents are, how they work, built-in agents, lifecycle, and the three execution models in Claude Code.

Source: code.claude.com/docs/en/sub-agents, code.claude.com/docs/en/features-overview

---

## What Sub-agents Are

Sub-agents are specialized AI assistants that handle specific types of tasks. Each sub-agent runs in its own context window with a custom system prompt, specific tool access, and independent permissions. When Claude encounters a task that matches a sub-agent's description, it delegates to that sub-agent, which works independently and returns results.

**Key characteristics**:
- Each gets its own 200k context window
- Receives only its system prompt (plus basic environment details), not the full Claude Code system prompt
- Returns a concise summary to the parent, not the full transcript
- Cannot spawn other sub-agents (no nesting)

Sub-agents help you:
- **Preserve context** -- keep exploration and implementation out of your main conversation
- **Enforce constraints** -- limit which tools a sub-agent can use
- **Reuse configurations** -- user-level agents work across all projects
- **Specialize behavior** -- focused system prompts for specific domains
- **Control costs** -- route tasks to faster, cheaper models like Haiku

---

## Three Execution Models

Claude Code provides three ways to delegate work. Choose based on isolation needs and communication patterns.

| | Sub-agents | Agent Teams | Skills |
|---|-----------|-------------|--------|
| **What** | Isolated workers returning summaries | Multiple independent sessions with shared tasks | Reusable content loaded on-demand |
| **Context** | Own 200k window | Own window, fully independent | Main conversation (or forked via `context: fork`) |
| **Communication** | Report back to parent only | Peer-to-peer messaging + shared task list | Inline with conversation |
| **Nesting** | Cannot spawn other sub-agents | Cannot create nested teams | Can fork into a sub-agent |
| **Context cost** | Low (summary returns) | High (~7x standard sessions) | Minimal (on-demand loading) |
| **Best for** | Focused tasks where only the result matters | Complex work requiring discussion and collaboration | Reference knowledge, quick workflows |

---

## Built-in Sub-agents

Claude Code includes built-in sub-agents that Claude automatically uses when appropriate. Each inherits the parent conversation's permissions with additional tool restrictions.

| Agent | Model | Tools | Purpose | When Used |
|-------|-------|-------|---------|-----------|
| **Explore** | Haiku | Read-only (no Write/Edit) | File discovery, code search, codebase exploration | Claude needs to search or understand a codebase without making changes. Specifies thoroughness: quick, medium, or very thorough |
| **Plan** | Inherits | Read-only (no Write/Edit) | Codebase research for planning | In plan mode, when Claude needs to understand the codebase before presenting a plan |
| **General-purpose** | Inherits | All tools | Complex research, multi-step operations, code modifications | Task requires both exploration and modification, complex reasoning, or multiple dependent steps |
| **Bash** | Inherits | Bash | Terminal commands in separate context | Running terminal commands that benefit from context isolation |
| **Claude Code Guide** | Haiku | Read-only | Questions about Claude Code features | User asks about Claude Code features, configuration, or usage |
| **statusline-setup** | Sonnet | Read-only | Configure status line | User runs /statusline |

---

## Sub-agent Lifecycle

### Invocation

Claude automatically delegates tasks based on:
- The task description in your request
- The `description` field in sub-agent configurations
- Current context

You can also request a specific sub-agent explicitly:
```
Use the test-runner subagent to fix failing tests
Have the code-reviewer subagent look at my recent changes
```

To encourage proactive delegation, include "use proactively" in your sub-agent's description.

### Foreground vs Background

- **Foreground sub-agents** block the main conversation until complete. Permission prompts and clarifying questions pass through to you.
- **Background sub-agents** run concurrently while you continue working. Claude pre-approves necessary permissions before launch. Background sub-agents auto-deny anything not pre-approved. MCP tools are NOT available in background sub-agents.

Claude decides foreground vs background based on the task. You can also:
- Ask Claude to "run this in the background"
- Press **Ctrl+B** to background a running task

Disable background tasks: set `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`.

### Resuming

Each invocation creates a new instance with fresh context. To continue an existing sub-agent's work, ask Claude to resume it. Resumed sub-agents retain their full conversation history.

```
Use the code-reviewer subagent to review the authentication module
[Agent completes]

Continue that code review and now analyze the authorization logic
[Claude resumes the subagent with full context from previous conversation]
```

Sub-agent transcripts persist in `~/.claude/projects/{project}/{sessionId}/subagents/` as `agent-{agentId}.jsonl`.

### Auto-compaction

Sub-agents support automatic compaction using the same logic as the main conversation. Default trigger: ~95% capacity. Override with `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` (e.g., `50` for earlier compaction).

---

## Key Limitations

1. **No nesting** -- sub-agents cannot spawn other sub-agents
2. **Fresh context** -- each invocation starts new (but resumable via agent ID)
3. **No MCP in background** -- MCP tools are unavailable in background sub-agents
4. **Auto-deny in background** -- background sub-agents auto-deny unapproved permissions
5. **Context return** -- many sub-agents returning detailed results can consume main context
6. **No conversation history** -- sub-agents don't see the parent's conversation history
7. **Cleanup** -- transcripts cleaned up based on `cleanupPeriodDays` setting (default: 30 days)
