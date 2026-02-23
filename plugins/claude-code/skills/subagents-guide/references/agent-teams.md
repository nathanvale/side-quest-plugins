# Agent Teams

Coordinating multiple Claude Code instances working together with shared tasks, messaging, and centralized management.

Source: code.claude.com/docs/en/agent-teams

---

## Status

Agent teams are **experimental** and disabled by default. Enable with:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

---

## What Agent Teams Are

Agent teams let you coordinate multiple Claude Code instances. One session acts as the team lead, coordinating work and synthesizing results. Teammates work independently, each in its own context window, and communicate directly with each other.

Unlike sub-agents (which report back to the parent only), you can interact with individual teammates directly.

---

## Sub-agents vs Agent Teams

| | Sub-agents | Agent Teams |
|---|-----------|-------------|
| **Context** | Own window; results return to caller | Own window; fully independent |
| **Communication** | Report back to parent only | Teammates message each other directly |
| **Coordination** | Main agent manages all work | Shared task list with self-coordination |
| **Best for** | Focused tasks where only the result matters | Complex work requiring discussion |
| **Token cost** | Lower (summarized back) | Higher (~7x standard sessions) |

**Use sub-agents** when you need quick, focused workers that report back.
**Use agent teams** when teammates need to share findings, challenge each other, and coordinate on their own.

---

## Best Use Cases

- **Research and review** -- multiple teammates investigate different aspects simultaneously
- **New modules or features** -- each teammate owns a separate piece
- **Debugging with competing hypotheses** -- test different theories in parallel
- **Cross-layer coordination** -- frontend, backend, and tests each owned by a different teammate

Agent teams add coordination overhead. For sequential tasks, same-file edits, or dependent work, a single session or sub-agents are more effective.

---

## Architecture

| Component | Role |
|-----------|------|
| **Team lead** | Main session that creates the team, spawns teammates, coordinates work |
| **Teammates** | Separate Claude Code instances working on assigned tasks |
| **Task list** | Shared list of work items that teammates claim and complete |
| **Mailbox** | Messaging system for communication between agents |

Config stored at `~/.claude/teams/{team-name}/config.json`.
Task list at `~/.claude/tasks/{team-name}/`.

---

## Display Modes

| Mode | Description | Requirements |
|------|-------------|-------------|
| **in-process** | All teammates in main terminal. Shift+Up/Down to select. | Any terminal |
| **split panes** | Each teammate gets own pane. Click to interact. | tmux or iTerm2 |
| **auto** (default) | Split panes if in tmux, in-process otherwise | -- |

Configure in settings.json:

```json
{
  "teammateMode": "in-process"
}
```

Or per session: `claude --teammate-mode in-process`

---

## Working with Teams

### Starting a Team

```
Create an agent team to review PR #142. Spawn three reviewers:
- One focused on security
- One checking performance
- One validating test coverage
```

### Delegate Mode

Prevents the lead from implementing tasks itself. Restricts the lead to coordination-only tools. Press **Shift+Tab** to toggle.

### Talking to Teammates

- **In-process**: Shift+Up/Down to select, type to message. Enter to view session, Escape to interrupt. Ctrl+T for task list.
- **Split panes**: Click into a pane to interact.

### Task Management

Tasks have three states: pending, in progress, completed. Tasks can depend on other tasks.
- Lead assigns tasks explicitly, or teammates self-claim
- File locking prevents race conditions on claims

### Shutting Down

```
Ask the researcher teammate to shut down
```

Then clean up:

```
Clean up the team
```

Always use the lead to clean up. Teammates should not run cleanup.

---

## Permissions

Teammates start with the lead's permission settings. If the lead uses `--dangerously-skip-permissions`, all teammates do too. You can change individual teammate modes after spawning.

---

## Context and Communication

Each teammate loads project context at spawn (CLAUDE.md, MCP servers, skills) plus the spawn prompt. The lead's conversation history does NOT carry over.

**Communication methods**:
- **message** -- send to one specific teammate
- **broadcast** -- send to all (use sparingly, costs scale with team size)
- **Automatic delivery** -- messages arrive automatically, no polling needed
- **Idle notifications** -- teammates notify the lead when they finish

---

## Limitations

1. **No session resumption** with in-process teammates -- `/resume` and `/rewind` don't restore them
2. **Task status can lag** -- teammates sometimes fail to mark tasks as completed
3. **Shutdown can be slow** -- teammates finish their current request first
4. **One team per session** -- clean up before starting a new one
5. **No nested teams** -- teammates cannot spawn their own teams
6. **Lead is fixed** -- cannot promote a teammate to lead
7. **Permissions set at spawn** -- can change after, but not at spawn time
8. **Split panes require tmux or iTerm2** -- not supported in VS Code terminal, Windows Terminal, or Ghostty
