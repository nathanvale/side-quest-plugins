# Agent Teams (Experimental)

Agent Teams is Claude Code's native multi-agent coordination feature. Shipped as experimental in January 2026 with Opus 4.6. It adds first-class teammate creation, direct messaging, and shared task lists on top of the existing Task system.

**Source hierarchy:** Official docs (code.claude.com) > community reports (alexop.dev, Reddit) > experience.
**Last verified:** 2026-02-10. Agent Teams is experimental -- APIs and behavior may change.

---

## What Is Agent Teams?

Agent Teams replaces the DIY sub-agent orchestration pattern with native coordination primitives. Instead of manually deploying sub-agents via Task tool and managing communication through task descriptions, teammates can:

- Share a task list and claim work autonomously
- Send messages directly to each other (no primary bottleneck)
- Operate as full Claude instances with their own context windows

**Key difference from DIY sub-agents:** Sub-agents are spawned by the primary and return results to it. Teammates are peer agents that coordinate through shared infrastructure.

## Agent Teams vs DIY Sub-Agents

| Aspect | DIY Sub-Agents | Agent Teams |
|--------|---------------|-------------|
| **Communication** | Through primary only | Direct between teammates |
| **Task list** | Shared via Task tools | Natively shared |
| **Coordination** | Primary orchestrates | Self-organizing or delegated |
| **Context** | Primary sees all results | Each teammate independent |
| **Cost** | One active context at a time (sequential) or multiple (parallel) | Each teammate = full Claude instance |
| **MCP tools** | Not in background agents | Available to teammates |
| **Maturity** | Stable, well-understood | Experimental |

## Coordination Primitives

Agent Teams introduces these tools alongside the existing Task* tools:

### TeamCreate

Create a team of specialized teammates:

```typescript
TeamCreate({
  name: "auth-team",
  teammates: [
    {
      name: "api-builder",
      role: "Implement API endpoints",
      agent: "builder"  // References .claude/agents/team/builder.md
    },
    {
      name: "frontend-builder",
      role: "Build React components",
      agent: "builder"
    },
    {
      name: "validator",
      role: "Verify all implementations",
      agent: "validator"
    }
  ]
})
```

### SendMessage

Send a message directly to a specific teammate:

```typescript
SendMessage({
  to: "api-builder",
  message: "Auth endpoints are ready. You can start building the frontend components that consume them."
})
```

### TeamDelete

Shut down a team and all teammates:

```typescript
TeamDelete({ name: "auth-team" })
```

### New Hook Events

| Event | When It Fires | Use Case |
|-------|---------------|----------|
| **TeammateIdle** | A teammate has no tasks and is waiting | Assign new work or signal completion |
| **TaskCompleted** | A task is marked completed | Trigger dependent work or validation |

## Shared Task List

Teammates share a task list -- this is the core coordination mechanism. Any teammate can:
- View all tasks with `TaskList`
- Claim unclaimed tasks with `TaskUpdate`
- Create new tasks with `TaskCreate`
- Mark tasks complete

This enables the **self-organizing worker swarm** pattern natively: create tasks, launch teammates, teammates claim and execute autonomously.

### Multi-Session Coordination

```bash
export CLAUDE_CODE_TASK_LIST_ID="my-project-tasks"
```

Set this environment variable to share a task list across multiple Claude instances -- including Agent Teams teammates and separate terminal sessions.

## The MULTI_AGENT_PLAN.md Pattern

The simplest and most effective multi-agent communication hub: a shared markdown file.

```markdown
# MULTI_AGENT_PLAN.md

## Current Status
- [x] Database schema created (builder-db, completed)
- [ ] API endpoints (builder-api, in progress)
- [ ] Frontend components (builder-ui, waiting on API)
- [ ] Integration tests (validator, blocked)

## Decisions
- Using JWT for auth (not session cookies)
- PostgreSQL with Drizzle ORM
- React Query for API state

## Issues
- Rate limiting: need to discuss approach
- File upload: max size TBD

## File Assignments
- builder-db: src/db/*, drizzle.config.ts
- builder-api: src/api/*, src/middleware/*
- builder-ui: src/components/auth/*, src/hooks/useAuth.ts
- validator: READ-ONLY (all files)
```

**Why this works:** 75% time reduction reported (Stephen Jones, 4-Agent Specialist Model). The plan file serves as:
- Shared memory between agents
- Decision log
- File boundary enforcement
- Progress tracker

Each teammate reads MULTI_AGENT_PLAN.md at start, updates it as they work, and checks it before starting new tasks.

## When to Use Agent Teams

### Ideal For

- **Competing hypotheses** -- two builders try different approaches, pick the winner
- **Cross-layer features** -- API + frontend + database need coordinated work
- **Parallel reviews** -- multiple validators checking different aspects simultaneously
- **Long-running tasks** -- teammates work independently for extended periods

### Avoid When

- **Sequential tasks** -- if step 2 depends entirely on step 1, a single agent is simpler
- **Same-file edits** -- two teammates editing the same file = merge conflicts
- **Simple problems** -- <3 steps, direct execution is faster and cheaper
- **Tight budget** -- each teammate is a full Claude instance

### Decision Tree

```
Is the task simple (<3 steps)?
  YES -> Just do it directly
  NO -> Continue

Do tasks have clear file boundaries?
  NO -> Use single agent with Task system
  YES -> Continue

Do agents need to communicate during work?
  NO -> Use DIY sub-agents (Task tool + run_in_background)
  YES -> Continue

Is Agent Teams available and stable enough?
  YES -> Use Agent Teams
  NO -> Use DIY sub-agents with MULTI_AGENT_PLAN.md
```

## Migration Path: DIY to Agent Teams

### Before (DIY Sub-Agents)

```typescript
// Primary orchestrates everything
TaskCreate({ subject: "Build API", ... })
TaskCreate({ subject: "Build UI", ... })
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })

// Deploy sequentially or parallel
Task({ prompt: "Execute Task 1", subagent_type: "builder", run_in_background: true })
// Wait...
Task({ prompt: "Execute Task 2", subagent_type: "builder" })
```

### After (Agent Teams)

```typescript
// Create team
TeamCreate({
  name: "feature-team",
  teammates: [
    { name: "api-builder", role: "API endpoints", agent: "builder" },
    { name: "ui-builder", role: "Frontend components", agent: "builder" },
    { name: "reviewer", role: "Validate all work", agent: "validator" }
  ]
})

// Create shared tasks
TaskCreate({ subject: "Build API", ... })
TaskCreate({ subject: "Build UI", ... })
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })

// Teammates self-organize: claim tasks, execute, communicate directly
// TeammateIdle hook fires when a teammate finishes and needs work
```

The key difference: you don't manually deploy and monitor agents. Teammates coordinate autonomously.

## Limitations and Gotchas

### Cost Multiplier

Each teammate is a full Claude instance. A 3-person team = 3x the compute cost. Budget accordingly:

| Team Size | Cost Multiple | When Justified |
|-----------|--------------|----------------|
| 2 teammates | 2x | Builder + Validator (standard) |
| 3 teammates | 3x | Cross-layer features |
| 4+ teammates | 4x+ | Large features with clear boundaries |

### Context Compaction Risks

Teammates undergo independent context compaction. After compaction, a teammate may forget:
- Files it previously read
- Decisions from earlier in the conversation
- The MULTI_AGENT_PLAN.md contents

**Mitigation:** Teammates should re-read MULTI_AGENT_PLAN.md periodically, especially after long-running tasks.

### File Conflict Prevention

**Rule: Assign distinct files per teammate. Two teammates on the same file = merge conflicts.**

Enforce via MULTI_AGENT_PLAN.md file assignments section. If two teammates need to modify the same file, serialize the work (one completes before the other starts).

### Experimental Status

Agent Teams is experimental as of February 2026:
- APIs may change between releases
- Some edge cases may not be handled gracefully
- Community patterns are still emerging
- Fall back to DIY sub-agents if you hit issues

### Filesystem Persistence

Team state persists at `~/.claude/teams/{team-name}/`. This enables:
- Resume after Claude Code restart (within same session)
- Debugging team communication
- Understanding teammate context

## The 4-Agent Specialist Model

A proven Agent Teams configuration (Stephen Jones):

| Agent | Role | Tools | File Scope |
|-------|------|-------|------------|
| **Architect** | Designs solution, creates MULTI_AGENT_PLAN.md | Read-only | All files |
| **Builder** | Implements code | All | Assigned files only |
| **Validator** | Verifies implementation | Read-only | All files |
| **Scribe** | Documents changes, updates plan | Write (docs only) | *.md, CHANGELOG |

Communication flows through MULTI_AGENT_PLAN.md, not direct messages. The Scribe keeps the plan updated as work progresses.

---

*Agent Teams documentation based on Anthropic official docs and community patterns (alexop.dev, sjramblings.io, Reddit r/ClaudeCode Jan-Feb 2026).*
