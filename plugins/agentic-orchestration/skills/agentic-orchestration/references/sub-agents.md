# Sub-Agent Architecture

Sub-agents are isolated AI assistants that run in their own context window with custom system prompts, tool restrictions, and permissions. They are the execution primitive behind all multi-agent patterns.

**Source hierarchy:** Official docs (code.claude.com/sub-agents) > hooks-mastery (IndyDevDan) > community experience.
**Last verified:** 2026-02-11 against Claude Code sub-agents docs.

---

## The #1 Misconception

**A sub-agent's markdown body is its SYSTEM PROMPT, not a user prompt.**

When you create `.claude/agents/team/builder.md`, the markdown content becomes the system prompt that shapes the agent's behavior. The `prompt` field in the Task tool call is the user message -- the specific task to execute.

```
.claude/agents/team/builder.md (SYSTEM PROMPT)
    -> "You are a focused engineering agent..."
    -> Defines personality, workflow, constraints

Task({ prompt: "Implement auth endpoints" }) (USER MESSAGE)
    -> The specific task this invocation should do
```

This means:
- System prompt: reusable, describes the agent's role and rules
- User message: per-invocation, describes the specific task
- The agent sees BOTH: system prompt + user message

## Information Flow

```
User
  |
  v
[Primary Agent] -- main conversation, full context
  |
  |-- Task({ prompt: "...", subagent_type: "builder" })
  |
  v
[Sub-Agent] -- isolated context, custom system prompt
  |
  |-- Receives: system prompt (from .md file) + user message (from prompt field)
  |-- Works: reads files, writes code, runs commands
  |-- Returns: summary back to primary
  |
  v
[Primary Agent] -- receives sub-agent summary
  |
  v
User -- sees primary's synthesis
```

**Key constraint:** Sub-agents cannot spawn other sub-agents. The Task tool is not available inside a sub-agent. If your workflow needs nested delegation, chain sub-agents from the primary conversation.

## Built-In Sub-Agents

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| **Explore** | Haiku | Read-only | Fast codebase search and analysis |
| **Plan** | Inherit | Read-only | Codebase research for plan mode |
| **general-purpose** | Inherit | All | Complex multi-step tasks |
| **Bash** | Inherit | Bash | Terminal commands in separate context |

Claude automatically delegates based on task description:
- "Search for X" -> Explore (fast, cheap)
- "Fix this bug" -> general-purpose (needs write access)
- Explicit request -> "Use the builder agent to..."

## Creating Custom Agents

### File-Based (Recommended)

Save as `.claude/agents/team/<name>.md`:

```markdown
---
name: builder
description: Engineering agent that executes tasks. Use for writing code, creating files, implementing features.
model: opus
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "bun run ./hooks/lint-check.ts"
---

You are a focused engineering agent. Execute ONE task at a time.
[... system prompt ...]
```

### Frontmatter Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (lowercase, hyphens) |
| `description` | Yes | When Claude should delegate to this agent |
| `tools` | No | Allowlist of tools. Inherits all if omitted |
| `disallowedTools` | No | Denylist. Removed from inherited or specified set |
| `model` | No | `sonnet`, `opus`, `haiku`, or `inherit` (default) |
| `permissionMode` | No | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `skills` | No | Skills to preload into the agent's context at startup |
| `hooks` | No | Hooks scoped to this agent's lifecycle |
| `color` | No | Background color in the UI |

### Agent Scopes (Priority Order)

| Location | Scope | Priority |
|----------|-------|----------|
| `--agents` CLI flag | Current session | 1 (highest) |
| `.claude/agents/` | Current project | 2 |
| `~/.claude/agents/` | All projects | 3 |
| Plugin `agents/` | Where plugin enabled | 4 (lowest) |

Same-name agents: higher priority wins.

### CLI-Defined Agents (Ephemeral)

```bash
claude --agents '{
  "quick-reviewer": {
    "description": "Fast code reviewer",
    "prompt": "Review code for quality and security.",
    "tools": ["Read", "Grep", "Glob"],
    "model": "haiku"
  }
}'
```

Only for the current session. Not saved to disk.

## Agent Definition Best Practices

### Write Descriptions for Delegation

Claude uses the `description` field to decide when to delegate. Be specific:

**Good:** "Engineering agent that executes tasks. Use for writing code, creating files, implementing features."
**Bad:** "A helpful agent."

Add "Use proactively" to encourage automatic delegation without explicit request.

### Limit Tool Access

Grant only what's needed:

```yaml
# Read-only validator
disallowedTools: Write, Edit, NotebookEdit

# Database reader
tools: Bash
# + PreToolUse hook to block non-SELECT queries

# Documentation writer
tools: Read, Write, Glob, Grep
```

### Preload Skills

Inject domain knowledge at startup:

```yaml
skills:
  - api-conventions
  - error-handling-patterns
```

Full skill content is loaded into the agent's context (not just made available). Agents don't inherit skills from the parent -- you must list them explicitly.

### Scope Hooks to Agents

Hooks in agent frontmatter only fire while that agent is active:

```yaml
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "./hooks/lint-check.sh"
  Stop:
    - hooks:
        - type: command
          command: "./hooks/validate-output.sh"
```

`Stop` hooks in frontmatter are automatically converted to `SubagentStop` events.

## Foreground vs Background

### Foreground (Default)

```typescript
Task({
  description: "Implement feature",
  prompt: "...",
  subagent_type: "builder"
  // run_in_background defaults to false
})
```

- Blocks primary conversation until complete
- Permission prompts pass through to user
- AskUserQuestion works
- All MCP tools available

### Background

```typescript
Task({
  description: "Implement feature",
  prompt: "...",
  subagent_type: "builder",
  run_in_background: true
})
// Returns immediately with agentId and output_file
```

- Primary continues working
- Permission prompts auto-deny (must pre-approve)
- AskUserQuestion calls fail (agent continues)
- **MCP tools NOT available**
- Use `TaskOutput` to check progress:

```typescript
// Non-blocking check
TaskOutput({ task_id: "agentId", block: false, timeout: 5000 })

// Blocking wait
TaskOutput({ task_id: "agentId", block: true, timeout: 300000 })
```

**Ctrl+B** backgrounds a running foreground task.

### When to Use Each

| Use Case | Mode | Reason |
|----------|------|--------|
| Complex feature implementation | Foreground | May need permission prompts or clarification |
| Parallel research tasks | Background | Independent, read-only, no permissions needed |
| Validation after build | Foreground | Need to see results before proceeding |
| Wave-based parallel builds | Background | Launch multiple, wait for all |

## Resume Pattern

Every sub-agent invocation returns an `agentId`. Use it to continue work with full context preserved.

```typescript
// First invocation
Task({
  description: "Build user service",
  prompt: "Create CRUD operations...",
  subagent_type: "builder"
})
// Returns agentId: "abc123"

// Later: resume with full context
Task({
  description: "Continue user service",
  prompt: "Add input validation to the endpoints you created.",
  subagent_type: "builder",
  resume: "abc123"
})
```

**When to resume vs start fresh:**
- **Resume:** continuing related work, agent needs prior context, fixing validation failures
- **Fresh:** unrelated task, clean slate preferred, agent context is too large

Sub-agent transcripts persist at `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`. They survive main conversation compaction and can be resumed after restarting Claude Code (within the same session).

## The Meta-Agent Pattern

An agent that creates other agents dynamically based on the task:

```markdown
---
name: meta-agent
description: Creates specialized agents on the fly for unique tasks
model: opus
---

You are a meta-agent. When given a task:

1. Analyze what skills and tools are needed
2. Create a temporary agent definition optimized for this specific task
3. Deploy it using the Task tool with appropriate configuration

Consider:
- What tools does this task need?
- What model is appropriate?
- What system prompt would best focus the agent?
- Should it run in foreground or background?
```

**When useful:** One-off tasks that don't justify a permanent agent definition. The meta-agent creates a focused, disposable specialist.

## Agent Chaining

For multi-step workflows, chain agents from the primary conversation:

```typescript
// Step 1: Research
const research = Task({
  description: "Research auth patterns",
  prompt: "Analyze the codebase's auth module...",
  subagent_type: "Explore"
})

// Step 2: Implement (uses research findings)
const build = Task({
  description: "Implement auth improvements",
  prompt: `Based on research findings: ${research.summary}. Implement improvements...`,
  subagent_type: "builder"
})

// Step 3: Validate
Task({
  description: "Validate auth changes",
  prompt: "Verify the auth improvements meet requirements...",
  subagent_type: "validator"
})
```

Each agent in the chain is independent -- the primary synthesizes results between steps.

## Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---------|---------------|-----|
| Sub-agent spawns sub-agent | Not supported -- Task tool unavailable in sub-agents | Chain from primary instead |
| Background agent needs MCP | MCP tools not available in background | Run in foreground or use non-MCP alternatives |
| No description on agent | Claude doesn't know when to delegate | Write specific, keyword-rich descriptions |
| Overly broad system prompt | Agent tries to do everything | One role, one focus per agent |
| Not resuming on failure | New agent lacks context of what was built | Use resume with original agentId |
| Permission denied in background | Background auto-denies unapproved tools | Pre-approve permissions or run foreground |
| Agent with too many skills loaded | Context bloat reduces reasoning quality | Load only essential skills |

---

*Sub-agent architecture based on Claude Code official docs and IndyDevDan's team agent patterns.*
