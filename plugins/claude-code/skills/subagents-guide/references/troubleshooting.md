# Troubleshooting

Common problems with sub-agents and agent teams, symptoms, causes, and fixes.

Source: code.claude.com/docs/en/sub-agents, code.claude.com/docs/en/agent-teams

---

## Quick Reference

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Sub-agent never triggers | Description doesn't match user request | Add trigger phrases to description field |
| Sub-agent triggers too often | Description too broad | Make description more specific |
| Permission denied in sub-agent | Permission not pre-approved for background | Run in foreground, or pre-approve permissions |
| MCP tools not working | Running as background sub-agent | Run in foreground (MCP unavailable in background) |
| Sub-agent can't spawn children | Sub-agents can't nest | Chain from main conversation instead |
| Agent file not loading | Created after session start | Restart session or use /agents to reload |
| Agent team not appearing | Feature not enabled | Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` |
| Orphaned tmux session | Team not cleaned up properly | `tmux ls` then `tmux kill-session -t <name>` |
| High token costs | Too many agents or wrong model | Use haiku for exploration, sonnet for work |

---

## Sub-agent Issues

### Agent Not Spawning

**Symptoms**: Claude doesn't delegate to your custom agent.

**Debug steps**:
1. Check the agent appears: run `/agents` and verify it's listed
2. Check description: does it include trigger phrases matching your request?
3. Check scope: is the agent file in the right location? (`.claude/agents/` or `~/.claude/agents/`)
4. Check loading: agents load at session start. Restart if you created the file mid-session
5. Check conflicts: if duplicate names exist, higher-priority scope wins (CLI > project > user > plugin)

### Permission Errors

**Symptoms**: Sub-agent fails with permission denied.

**Causes**:
- Background sub-agents auto-deny unapproved permissions
- `permissionMode: dontAsk` denies all prompts
- Parent's `bypassPermissions` overrides child settings

**Fixes**:
- Run in foreground for interactive permission prompts
- Pre-approve needed permissions before backgrounding
- Check `permissionMode` in agent frontmatter
- Resume a failed background agent in foreground: ask Claude to "resume that agent"

### MCP Tools Not Available

**Symptoms**: Sub-agent can't use MCP tools, calls fail silently.

**Cause**: MCP tools are NOT available in background sub-agents.

**Fixes**:
- Run the sub-agent in foreground
- Pre-fetch MCP data before spawning the sub-agent
- Move MCP calls to the main conversation, then delegate analysis to sub-agent

### Context Overflow

**Symptoms**: Main conversation becomes slow or loses context after many sub-agent returns.

**Cause**: Many sub-agents returning detailed results consume main context.

**Fixes**:
- Ask sub-agents for concise summaries, not full output
- Use `/compact` to summarize the main conversation
- For sustained parallelism, use agent teams (each teammate has independent context)
- Reduce the number of concurrent sub-agents

### Sub-agent Returns Unhelpful Results

**Symptoms**: Sub-agent completes but returns generic or incomplete results.

**Causes**:
- System prompt too vague
- Missing context (sub-agents don't see parent's conversation history)
- Wrong model for the task complexity

**Fixes**:
- Write specific, actionable system prompts with clear steps
- Include all necessary context in the delegation message
- Use a more capable model (sonnet instead of haiku for complex tasks)

---

## Agent Team Issues

### Teammates Not Appearing

**Debug steps**:
1. In in-process mode: press Shift+Down to cycle through active teammates
2. Check task complexity: Claude decides whether to spawn based on the task
3. For split panes: verify tmux is installed (`which tmux`)
4. For iTerm2: verify `it2` CLI is installed and Python API is enabled

### Too Many Permission Prompts

**Cause**: Teammate permission requests bubble up to the lead.

**Fix**: Pre-approve common operations in permission settings before spawning teammates.

### Teammates Stopping on Errors

**Symptoms**: Teammate stops after encountering an error instead of recovering.

**Fixes**:
- Check output using Shift+Up/Down in in-process mode
- Give additional instructions directly to the teammate
- Spawn a replacement teammate to continue

### Lead Implements Instead of Delegating

**Symptoms**: The lead starts doing work instead of waiting for teammates.

**Fixes**:
- Tell the lead: "Wait for your teammates to complete their tasks before proceeding"
- Enable delegate mode (Shift+Tab) to restrict lead to coordination-only tools

### Task Status Lag

**Symptoms**: Tasks appear stuck even though work is done.

**Cause**: Teammates sometimes fail to mark tasks as completed.

**Fix**: Check if work is actually done, then manually update task status or tell the lead to nudge the teammate.

### Orphaned Sessions

**Symptoms**: tmux session persists after team ends.

**Fix**:
```bash
tmux ls
tmux kill-session -t <session-name>
```

---

## Environment Variables for Debugging

| Variable | Purpose |
|----------|---------|
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` | Disable background tasks to force foreground execution |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50` | Compact earlier to prevent context overflow |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | Enable agent teams |

---

## Known Limitations

These are architectural constraints, not bugs:

1. **Sub-agents cannot spawn other sub-agents** -- use chaining from main conversation
2. **No MCP in background sub-agents** -- run in foreground for MCP access
3. **Agent teams are experimental** -- expect rough edges
4. **No session resumption for agent team teammates** -- `/resume` and `/rewind` don't restore them
5. **One team per session** -- clean up current team before starting a new one
6. **Split panes not supported** in VS Code terminal, Windows Terminal, or Ghostty
7. **Lead is fixed** -- cannot promote a teammate or transfer leadership
