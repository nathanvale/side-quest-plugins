# Task Orchestration

The Task system is Claude Code's built-in coordination layer. Four tools -- TaskCreate, TaskUpdate, TaskList, TaskGet -- form the backbone of all multi-agent workflows.

**Source hierarchy:** Official docs (code.claude.com) > hooks-mastery (IndyDevDan) > community experience.
**Last verified:** 2026-02-11 against Claude Code common-workflows docs and best-practices docs.

---

## The 3-Task Rule

**Fewer than 3 steps? Just do it directly.** The Task system adds overhead (context for task management, tool calls for CRUD). Only use it when:

- The work has 3+ distinct steps
- Steps have dependencies (must complete in order)
- Multiple agents need to coordinate
- You need progress tracking

For simple tasks, direct execution is faster and cheaper.

## Task Tools Reference

### TaskCreate

Creates a new task in the shared task list.

```typescript
TaskCreate({
  subject: "Implement user authentication",      // Brief, imperative title
  description: "Create login/logout endpoints...", // Detailed requirements + acceptance criteria
  activeForm: "Implementing authentication"        // Present continuous, shown in UI spinner
})
// Returns: taskId (e.g., "1")
```

**Best practices:**
- `subject` -- imperative form ("Add feature", "Fix bug"), max ~70 chars
- `description` -- include acceptance criteria, file paths, constraints
- `activeForm` -- present continuous ("Running tests", "Building API")
- All tasks start as `pending`

### TaskUpdate

Updates task status, dependencies, or assignment.

```typescript
// Mark in progress
TaskUpdate({ taskId: "1", status: "in_progress" })

// Mark completed
TaskUpdate({ taskId: "1", status: "completed" })

// Set dependencies
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })

// Assign owner
TaskUpdate({ taskId: "1", owner: "builder-api" })

// Add metadata for filtering
TaskUpdate({
  taskId: "1",
  metadata: { feature: "auth", phase: "2.1", priority: "critical" }
})

// Delete a task
TaskUpdate({ taskId: "1", status: "deleted" })
```

**Status lifecycle:** `pending` -> `in_progress` -> `completed`

### TaskList

View all tasks and their status.

```typescript
TaskList({})
// Returns: Array of { id, subject, status, owner, blockedBy }
```

### TaskGet

Get full details of a specific task.

```typescript
TaskGet({ taskId: "1" })
// Returns: Full task with description, metadata, blocks, blockedBy
```

## Dependency Chains with addBlockedBy

Use `addBlockedBy` to create execution order. Blocked tasks cannot start until dependencies complete.

```typescript
// Create tasks
TaskCreate({ subject: "Setup database schema", ... })     // Task 1
TaskCreate({ subject: "Implement API endpoints", ... })    // Task 2
TaskCreate({ subject: "Write integration tests", ... })    // Task 3
TaskCreate({ subject: "Final validation", ... })           // Task 4

// Set dependencies
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })          // API waits for DB
TaskUpdate({ taskId: "3", addBlockedBy: ["2"] })          // Tests wait for API
TaskUpdate({ taskId: "4", addBlockedBy: ["1", "2", "3"] }) // Validation waits for all
```

**Dependency rules:**
- Acyclic only -- circular dependencies will deadlock agents
- A task with `blockedBy` entries cannot be claimed until all blockers complete
- Use `TaskList` to check which tasks are unblocked and available

## Tasks Are Session-Scoped

**This is the #1 misconception.** Tasks disappear when sessions end. They are in-memory state, not persisted to disk.

Implications:
- Restarting Claude Code loses all tasks
- Context compaction may lose task context (but tasks themselves survive within the session)
- You cannot resume tasks from a previous session without re-creating them

## The Hydration Pattern

The solution to session-scoped tasks: use a persistent markdown file as the source of truth.

### How It Works

```
Session 1:
  1. Write plan to specs/my-feature.md (persistent file)
  2. TaskCreate for each step from the plan
  3. Work on tasks, mark completed
  4. Sync completed status back to spec file
  5. Git commit captures state

Session 2:
  1. Read specs/my-feature.md
  2. TaskCreate for remaining (uncompleted) steps
  3. Resume exactly where you left off
```

### Spec File Format

```markdown
# Feature: User Authentication

## Tasks

### 1. Setup database schema
- **Status**: completed
- **Depends On**: none
- **Assigned To**: builder-db
- **Acceptance Criteria**: Users table with id, email, password_hash, created_at

### 2. Implement API endpoints
- **Status**: in_progress
- **Depends On**: 1
- **Assigned To**: builder-api
- **Acceptance Criteria**: POST /login, POST /register, GET /me endpoints

### 3. Write integration tests
- **Status**: pending
- **Depends On**: 2
- **Assigned To**: builder-test
- **Acceptance Criteria**: 90%+ coverage on auth endpoints
```

### Hydration on Session Start

```typescript
// Read the spec file
// For each task where status != "completed":
TaskCreate({
  subject: "Implement API endpoints",
  description: "POST /login, POST /register, GET /me endpoints. See specs/auth.md",
  activeForm: "Implementing API endpoints"
})
// Set dependencies based on spec
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })
```

**Compound interest effect:** Each hydration cycle makes specs smarter. Session 1: Claude learns structure. Session 2: builds on established patterns. Session 3: full context, fewer clarifications.

## CLAUDE_CODE_TASK_LIST_ID

Share a task list across multiple Claude instances.

```bash
# Set in environment before launching Claude Code
export CLAUDE_CODE_TASK_LIST_ID="my-project-tasks"
```

**Use cases:**
- Multiple terminal windows working on the same project
- Agent Teams (native) sharing a coordinated task list
- CI/CD pipelines coordinating with interactive sessions

**Gotcha:** Don't share task list IDs across different repos -- task pollution makes the list unusable.

## Wave-Based Execution

Organize tasks into dependency waves for maximum parallelism:

```
Wave 1 (parallel -- no dependencies):
  Task 1: Setup database schema
  Task 2: Create project scaffolding
  Task 3: Configure CI pipeline

Wave 2 (parallel -- depends on Wave 1):
  Task 4: Implement API endpoints     [blockedBy: 1]
  Task 5: Build frontend components   [blockedBy: 2]

Wave 3 (parallel -- depends on Wave 2):
  Task 6: Write API tests             [blockedBy: 4]
  Task 7: Write frontend tests        [blockedBy: 5]

Wave 4 (sequential -- depends on all):
  Task 8: Integration testing          [blockedBy: 6, 7]
  Task 9: Final validation             [blockedBy: 8]
```

### Deploying Waves

```typescript
// Wave 1: launch all in parallel
Task({
  description: "Setup database",
  prompt: "Execute Task 1...",
  subagent_type: "builder",
  run_in_background: true
})
Task({
  description: "Create scaffolding",
  prompt: "Execute Task 2...",
  subagent_type: "builder",
  run_in_background: true
})
Task({
  description: "Configure CI",
  prompt: "Execute Task 3...",
  subagent_type: "builder",
  run_in_background: true
})

// Wait for Wave 1, then launch Wave 2...
```

## Self-Organizing Worker Swarm

An advanced pattern where agents autonomously claim work without a central dispatcher.

### How It Works

1. Lead creates all tasks with dependencies upfront
2. Multiple worker agents are launched in parallel
3. Each worker loops: `TaskList -> find unclaimed/unblocked work -> claim -> execute -> repeat`
4. Workers naturally load-balance based on task availability

### Worker Agent Prompt

```
You are an autonomous worker agent. Your job:

1. Run TaskList to see available tasks
2. Find a task that is:
   - status: "pending"
   - owner: empty (unclaimed)
   - blockedBy: empty or all completed
3. Claim it: TaskUpdate({ taskId, status: "in_progress", owner: "worker-N" })
4. Execute the task fully
5. Mark complete: TaskUpdate({ taskId, status: "completed" })
6. Go back to step 1

If no tasks are available, wait briefly and check again.
If all tasks are completed, report summary and stop.
```

**Gotcha:** Race conditions -- two workers may try to claim the same task. The second claim is harmless (task is already in_progress) but wastes a turn. This is acceptable overhead for the parallelism gains.

## Metadata for Dynamic Filtering

Use metadata to categorize and filter tasks at scale:

```typescript
TaskCreate({
  subject: "Implement auth middleware",
  description: "...",
  activeForm: "Implementing auth",
  metadata: {
    feature: "auth",
    phase: "2.1",
    priority: "critical",
    layer: "api"
  }
})
```

Workers can filter by metadata when choosing tasks. This enables phase-sequencing, priority-based execution, and layer-specific agent assignment.

## Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---------|---------------|-----|
| Over-splitting tasks | Each task = overhead. 20 micro-tasks depletes context | Group related work. ~5-10 active tasks max |
| No acceptance criteria | Validators can't verify completion | Include specific, measurable criteria in description |
| Circular dependencies | Deadlocks -- tasks waiting on each other forever | DAG only. Draw the dependency graph before creating tasks |
| Assuming persistence | Tasks vanish on session restart | Use hydration pattern with persistent spec files |
| Same task list across repos | Task pollution -- irrelevant tasks clog the list | Use unique CLAUDE_CODE_TASK_LIST_ID per project |
| Skipping dependency setup | Agents work out of order, test code that doesn't exist | Always set addBlockedBy before deploying agents |
| Lead doing task work | Lead loses orchestration context, becomes a bottleneck | Lead ONLY coordinates via Task* tools |

## End-to-End Example

```typescript
// 1. Create the task list from your plan
const tasks = [
  { subject: "Create User model and migration",    deps: [] },
  { subject: "Implement auth endpoints",           deps: ["1"] },
  { subject: "Add JWT middleware",                  deps: ["1"] },
  { subject: "Write auth tests",                   deps: ["2", "3"] },
  { subject: "Validate all auth work",             deps: ["4"] }
]

// 2. Create all tasks
for (const task of tasks) {
  TaskCreate({ subject: task.subject, description: "...", activeForm: "..." })
}

// 3. Set dependencies
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })
TaskUpdate({ taskId: "3", addBlockedBy: ["1"] })
TaskUpdate({ taskId: "4", addBlockedBy: ["2", "3"] })
TaskUpdate({ taskId: "5", addBlockedBy: ["4"] })

// 4. Deploy Wave 1 (task 1 -- no deps)
Task({ prompt: "Execute Task 1...", subagent_type: "builder" })

// 5. Deploy Wave 2 (tasks 2, 3 -- parallel after task 1)
Task({ prompt: "Execute Task 2...", subagent_type: "builder", run_in_background: true })
Task({ prompt: "Execute Task 3...", subagent_type: "builder", run_in_background: true })

// 6. Deploy Wave 3 (task 4 -- after 2 and 3)
Task({ prompt: "Execute Task 4...", subagent_type: "builder" })

// 7. Deploy Validation (task 5 -- after all)
Task({ prompt: "Validate all auth work...", subagent_type: "validator" })
```

---

*Task system patterns drawn from IndyDevDan's plan_w_team command and community hydration workflows.*
