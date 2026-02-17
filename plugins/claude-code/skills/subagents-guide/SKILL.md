---
name: subagents-guide
description: >
  Knowledge bank for Claude Code sub-agents -- built-in agents, custom agent configuration,
  agent teams, context isolation, costs, model selection, and troubleshooting.
  Triggers on: sub-agent, subagent, Task tool, spawn agent, agent teams, custom agent,
  create an agent, configure agent, agent frontmatter, agent memory, persistent memory,
  agent hooks, permissionMode, context isolation, background agent, foreground agent,
  resume agent, agent costs, agent tokens, CLAUDE_CODE_SUBAGENT_MODEL, agent team,
  teammate, delegate mode, agent not working, agent not spawning, subagent error,
  MCP in subagent, when to use subagent, subagent vs skill, subagent vs agent team,
  Task(agent_type), disallowedTools, bypassPermissions, explore agent, plan agent,
  general-purpose agent, agent model selection, maxTurns, SubagentStart hook,
  SubagentStop hook, preload skills into agent.
allowed-tools: Read, Glob, Grep
---

# Claude Code Sub-agents Guide -- Knowledge Bank

Authoritative guidance for configuring and using Claude Code sub-agents, extracted from
Anthropic's official documentation. Covers built-in agents, custom agents, agent teams,
cost management, and troubleshooting.

## Source Authority

This skill draws from:
- Official Claude Code documentation at code.claude.com/docs/en/sub-agents
- Official Claude Code documentation at code.claude.com/docs/en/agent-teams
- Official Claude Code documentation at code.claude.com/docs/en/costs
- Official Claude Code documentation at code.claude.com/docs/en/model-config

Reference files are the primary source. Community intel is opt-in via
`/newsroom:investigate` -- see Community Perspective below.

## Community Perspective (Opt-In)

This skill does NOT maintain a community intel cache. It can hand off to
`/newsroom:investigate` for live community signal when the user wants real-world examples.

**Auto-detect these signals** -- if the user's question contains any of these, offer to
run community research:
- "what are people doing with subagents", "how are others using agents"
- "has anyone", "examples in the wild", "inspiration"
- "community", "Reddit", "what's trending"
- "real-world examples", "cool agent setups"
- "best agents", "popular agents"

**When detected**:
1. Answer from reference files first (the official answer)
2. Then invoke `/newsroom:investigate` with a tailored query
3. Present both: "Here's what the docs say" followed by "Here's what the community is doing"

**Do NOT auto-invoke research** for standard doc questions.

## Step 1: Classify the Question

Parse the user's question into one or more intent categories.

| Intent | Trigger Signals | Reference File |
|--------|----------------|----------------|
| **Getting Started** | what is a subagent, how do subagents work, Task tool, built-in agents, Explore agent, Plan agent, general-purpose agent, when to use subagent | [fundamentals.md](references/fundamentals.md) |
| **Configuration** | create agent, custom agent, agent frontmatter, agent YAML, tools field, disallowedTools, permissionMode, maxTurns, agent hooks, persistent memory, memory scope, preload skills, mcpServers, agent file, .claude/agents/, --agents flag | [configuration.md](references/configuration.md) |
| **Agent Teams** | agent team, teammate, delegate mode, shared task list, team lead, spawn teammate, parallel sessions, team coordination, in-process mode, split panes, tmux | [agent-teams.md](references/agent-teams.md) |
| **Costs & Models** | agent cost, agent tokens, pricing, model selection, haiku, sonnet, opus, CLAUDE_CODE_SUBAGENT_MODEL, prompt caching, auto-compaction, reduce cost, token usage, context window | [costs-and-models.md](references/costs-and-models.md) |
| **Patterns** | best practices, when to use, subagent vs skill, subagent vs agent team, parallel research, chain agents, isolate output, permission scoping, foreground, background, resume agent | [patterns-and-best-practices.md](references/patterns-and-best-practices.md) |
| **Troubleshooting** | agent not working, agent not spawning, subagent error, permission denied, MCP not available, background agent failed, agent stuck, orphaned session, team not appearing | [troubleshooting.md](references/troubleshooting.md) |

## Step 2: Read Reference Files

Read the relevant reference file(s) based on the classification. For multi-intent
questions, read all relevant files.

## Step 3: Synthesize Answer

### Response Structure

Every response should follow this structure:

1. **Direct answer** -- one-line answer, no preamble
2. **Minimal example** -- copy-paste ready YAML config, agent file, or command
3. **Why it works** -- brief explanation of the design decision
4. **Verify step** -- how to test it ("run /agents", "check agent appears")
5. **Common failure** -- what goes wrong and how to fix it
6. **Source** -- reference file cited

### For Getting Started Questions

1. Show the three execution models (subagents, agent teams, skills)
2. List the built-in agents with model/tools/purpose
3. Show a minimal custom agent file
4. Link to configuration.md for full setup

### For Configuration Questions

1. Show the exact YAML field and its purpose
2. Show a minimal agent file with the field in context
3. Note constraints (scope priority, naming rules)
4. Cross-reference related fields

### For Agent Teams Questions

1. Compare with subagents (communication, context, coordination, cost)
2. Show how to enable and start a team
3. Include display mode options
4. Note experimental status and limitations

### For Cost Questions

1. Show official cost numbers ($6/dev/day average)
2. Present model selection guidance (haiku/sonnet/opus)
3. Show CLAUDE_CODE_SUBAGENT_MODEL env var
4. Note agent team cost multiplier (~7x)

### For Pattern Questions

1. Show the decision matrix (when to use what)
2. Provide the complete pattern with example
3. Explain trade-offs (cost, latency, context)
4. Include gotchas

### For Troubleshooting Questions

1. Match symptoms to common causes
2. Provide debug steps in order of likelihood
3. Include exact commands or settings to verify
4. Note known limitations

## Response Guidelines

- **Always cite the reference file** you draw from
- **Provide copy-paste agent configs** -- users should be able to use them immediately
- **Show YAML frontmatter** for agent definitions
- **Be direct** -- answer first, then context
- **Tables for comparisons** -- subagent vs team vs skill, built-in agents, model costs
- **Warn about limitations** -- no nesting, no MCP in background, experimental features
- **Link to sibling skills** when the question crosses into hooks, skills, or MCP territory

## Examples

### Example 1: Getting Started

```text
User: What are subagents in Claude Code?

Skill: [Reads fundamentals.md]

Subagents are isolated AI workers that run in their own 200k context window.
They handle a task and return a summary to your main conversation.

Three built-in subagents:

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| Explore | Haiku | Read-only | Codebase search |
| Plan | Inherits | Read-only | Research during plan mode |
| General-purpose | Inherits | All | Complex multi-step tasks |

You can also create custom agents as Markdown files in .claude/agents/:

  ---
  name: code-reviewer
  description: Reviews code for quality. Use proactively after code changes.
  tools: Read, Grep, Glob, Bash
  model: sonnet
  ---
  You are a code reviewer. Analyze code for quality, security, and best practices.

Test: ask "What agents are available?" or invoke /agents.

Source: fundamentals.md
```

### Example 2: Configuration

```text
User: How do I restrict which tools a subagent can use?

Skill: [Reads configuration.md]

Use the `tools` field (allowlist) or `disallowedTools` field (denylist):

  ---
  name: safe-researcher
  description: Research agent with restricted capabilities
  tools: Read, Grep, Glob, Bash
  disallowedTools: Write, Edit
  ---

For finer control, use PreToolUse hooks to validate operations conditionally
(e.g., allow Bash but only for SELECT queries).

Verify: run /agents and check the agent's tool list.

Common failure: omitting the tools field entirely means the agent inherits ALL
tools from the main conversation.

Source: configuration.md
```

### Example 3: Cross-Domain

```text
User: Should I use a subagent or a skill for my code review workflow?

Skill: [Reads patterns-and-best-practices.md]

Use a subagent if the review reads many files and you want to keep verbose
output out of your main context. Use a skill if the review is quick and you
want results inline with your conversation.

| | Subagent | Skill |
|---|---------|-------|
| Context | Isolated 200k window | Main conversation |
| Output | Summary returned | Full output inline |
| Best for | Verbose, self-contained tasks | Reference knowledge, quick workflows |
| Cost | Higher (separate context) | Lower (shared context) |

For a comprehensive code review across many files, a subagent with
model: sonnet and read-only tools is the better choice.

Source: patterns-and-best-practices.md
```

### Example 4: Community Perspective

```text
User: What are people building with custom agents?

Skill: [Detects community signal -> "what are people building"]
Skill: [Reads patterns-and-best-practices.md for official patterns first]

Here's what the official docs cover for agent patterns:
[brief summary of patterns from patterns-and-best-practices.md]

Let me check what the community is building...

Skill: [Invokes /newsroom:investigate "Claude Code custom agents subagents examples"]

From the community (last 30 days):
[research results with engagement metrics]
```
