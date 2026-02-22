# DAG Execution Reference

**Introduced in: Stage 2 (updated in Stage 3, Stage 4)**

**Purpose:** Technical reference for wave algorithm details, spec file format, idempotency rules, retry protocol, fast path rules, clarifying question heuristics, token estimation, team resolution, and observability events. `SKILL.md` delegates to this document for the mechanics of multi-task decomposition and execution.

---

## Task Decomposition Rules

When the user prompt is complex enough to require multiple tasks, the orchestrator decomposes it into a task graph before any agent is dispatched.

### Minimum Task Count

Decompose into 3 or more tasks. A single-task prompt does not benefit from a DAG -- that case is handled by the fast path (see Fast Path Rules below). If you cannot identify at least 3 distinct, independently verifiable units of work, you may be over-decomposing a simple task. Check whether the fast path applies instead.

### Task ID Format

Each task gets a unique ID in `kebab-case`, descriptive enough to be meaningful in a log without context. Do not use generic IDs like `task-1` or `t3`.

Good examples:
- `define-user-types`
- `implement-get-users-handler`
- `implement-post-users-handler`
- `write-user-route-tests`

### Required Task Fields

Every task must have all five of these fields defined before execution begins:

| Field | Description |
|-------|-------------|
| `subject` | Short imperative description (e.g., "Define User types in src/types/user.ts") |
| `description` | Full requirements: file paths, function signatures, named exports, JSDoc requirements, and all acceptance criteria. Must be complete enough for a builder with no other context to implement correctly. |
| `activeForm` | Present continuous form shown in the UI spinner (e.g., "Defining User types") |
| `dependencies` | List of task IDs that must complete before this task can start. Empty list for root tasks. |
| `wave` | Computed wave number (see Wave Computation Algorithm below). |

### Dependency Rules

- Dependencies are expressed as task IDs (e.g., `dependencies: ["define-user-types"]`)
- A task can depend on multiple other tasks
- **No circular dependencies allowed.** If task A depends on task B and task B depends on task A, the graph is invalid and cannot be executed. Restructure the decomposition.
- **No orphaned tasks.** Every task must be reachable from at least one root (a task with zero dependencies). A task that nothing depends on and that depends on nothing is a root -- that is fine. A task whose only predecessors are themselves unreachable is an orphan -- that is an error.

---

## Wave Computation Algorithm

Waves group tasks by dependency depth. Tasks in the same wave have no dependencies on each other -- they are ready to execute as soon as all tasks in the previous wave complete.

### Definition

- **Wave 1:** All tasks with zero dependencies (the roots).
- **Wave N:** All tasks whose dependencies are ALL in waves 1 through N-1.

### Pseudocode (Kahn's Algorithm, Grouped by Depth)

```
function computeWaves(tasks):
    # Build adjacency and in-degree maps
    inDegree = {}
    dependents = {}   # task -> list of tasks that depend on it
    for each task in tasks:
        inDegree[task.id] = task.dependencies.length
        for each dep in task.dependencies:
            dependents[dep].append(task.id)

    # Start with all root tasks (zero dependencies)
    queue = [task for task in tasks if inDegree[task.id] == 0]
    waves = []
    waveNumber = 1

    while queue is not empty:
        currentWave = []
        nextQueue = []

        for each task in queue:
            task.wave = waveNumber
            currentWave.append(task)

            # Reduce in-degree for all tasks that depend on this one
            for each dependent in dependents[task.id]:
                inDegree[dependent] -= 1
                if inDegree[dependent] == 0:
                    nextQueue.append(dependent)

        waves.append(currentWave)
        queue = nextQueue
        waveNumber += 1

    # Cycle detection: any task with inDegree > 0 is in a cycle
    if any task has inDegree[task.id] > 0:
        raise Error("Circular dependency detected")

    return waves
```

### Concrete Example

For the prompt "add a REST API with GET /users, POST /users, and GET /users/:id -- include types, handlers, and tests":

| Task ID | Dependencies | Wave |
|---------|-------------|------|
| `define-user-types` | (none) | 1 |
| `implement-get-users` | `define-user-types` | 2 |
| `implement-post-users` | `define-user-types` | 2 |
| `implement-get-user-by-id` | `define-user-types` | 2 |
| `write-user-route-tests` | `implement-get-users`, `implement-post-users`, `implement-get-user-by-id` | 3 |

Wave 1 runs first (types). Wave 2 runs after (all three handlers, sequentially). Wave 3 runs last (tests, once all handlers are complete).

---

## Execution Protocol

### Wave Sequencing

Execute waves in order: complete all tasks in Wave N before starting Wave N+1. This is the guarantee that dependencies are always satisfied before a task begins.

### Within-Wave Sequencing (Stage 2 Constraint)

In Stage 2 and Stage 3, tasks within a wave are executed sequentially -- one at a time, foreground dispatch, wait for completion. Do not attempt to run multiple tasks concurrently. Parallel dispatch is introduced in Stage 8.

### Per-Task Cycle

For each task in each wave, follow this sequence:

```
1. Read the spec file (see Spec File Format below)
2. Update task status to `in_progress` in the spec file
3. Emit wave.started (once per wave, before the first task in that wave)
4. Dispatch the $BUILDER_AGENT:
     Task tool, model: sonnet, foreground: true
     Store the agentId returned -- needed for retry resume
     Prompt: "Read task <task-id> from the spec at <spec-path> and implement it.
              When done, update the spec file task status to `completed` and
              summarize your changes."
5. Wait for builder to complete
6. Dispatch the $VALIDATOR_AGENT:
     Task tool, model: haiku, foreground: true
     Prompt: "Read task <task-id> from the spec at <spec-path> and verify the
              builder's work meets all acceptance criteria.
              Update the spec file execution log with VERDICT: PASS or VERDICT: FAIL."
7. Wait for validator to complete
8. Parse the verdict from the spec file or validator's output
9. Record verdict in the spec file execution log
10. If VERDICT: FAIL: enter retry protocol (see Retry Protocol below)
11. If VERDICT: PASS: continue to next task
```

### Wave Boundary: Re-Read the Spec File

At each wave boundary -- before starting the first task in a new wave -- re-read the spec file from disk.

**Why this is mandatory:** Context compaction can evict the plan from the LLM's working context. An LLM mid-orchestration that loses the spec plan may hallucinate task details or skip steps. Re-reading from disk is the defense -- the spec file IS the source of truth, not the LLM's in-context memory of it.

Emit `spec.reread` when you do this (see Observability Events below).

### Failure Handling

**Stage 2 behavior (superseded):** In Stage 2, any VERDICT: FAIL stopped execution immediately with no retry. This is preserved in the Stage 2 branch for reference.

**Stage 3 behavior (current):** On VERDICT: FAIL, enter the retry protocol. Only stop if retries are exhausted AND the user chooses "Abort orchestration". See the Retry Protocol section below for full mechanics.

---

## Spec File Format

### Location and Naming

- Directory: `specs/`
- Filename: derived from the user prompt, kebab-case, descriptive.
  - "add a REST API" -> `specs/rest-api.md`
  - "implement user authentication with JWT" -> `specs/user-auth-jwt.md`
  - When in doubt, keep it short but unambiguous.

### When to Write

Write the spec file BEFORE dispatching any agents. The spec file is a plan, not a report. Agents read it. The orchestrator updates it during execution. It is the source of truth at all times.

### When to Update

Update the spec file at these points:
- When a task's status changes (pending -> in_progress -> completed | failed | skipped)
- When a retry is triggered (increment `Retries` count on the task)
- When an execution log entry is added (builder dispatched, validator dispatched, verdict received, retry attempt)
- When the final result is written

### Full Template

```markdown
# Orchestration Spec: <title>

## Prompt

<original user prompt, verbatim>

## Task Graph

| Task ID | Subject | Dependencies | Wave | Status |
|---------|---------|-------------|------|--------|
| <task-id> | <subject> | (none) | 1 | pending |
| <task-id> | <subject> | <dep-id> | 2 | pending |
| <task-id> | <subject> | <dep-id>, <dep-id> | 3 | pending |

## Tasks

### <task-id>

- Subject: <short imperative description>
- Dependencies: (none) | <task-id>, <task-id>
- Wave: N
- Status: pending | in_progress | completed | failed | skipped
- Retries: 0

**Description:**
<full requirements, file paths, function signatures, named exports, JSDoc requirements>

**Acceptance Criteria:**
- <criterion 1>
- <criterion 2>
- <criterion N>

### <next-task-id>

...

## Execution Log

### Wave 1

- Task `<task-id>`: builder dispatched -> builder completed -> validator dispatched -> validator completed -> VERDICT: PASS
- Task `<task-id>`: builder dispatched -> builder completed -> validator dispatched -> validator completed -> VERDICT: FAIL
  - Retry 1: builder re-dispatched (resume: <agentId>) -> builder completed -> validator dispatched -> VERDICT: PASS

### Wave 2

- Task `<task-id>`: builder dispatched -> ...

## Result

<final summary: what was built, which tasks passed, which failed or were skipped, total retries, files created or modified>
```

### Notes on the Template

- The Task Graph table gives a quick overview of the full plan at a glance.
- Each task's description must be complete enough for a builder agent with no other context to implement correctly. Do not rely on the builder reading the user prompt -- the builder reads only the task.
- Acceptance Criteria must be specific and verifiable. "Works correctly" is not verifiable. "Returns 200 with `{ id, name, email }` for an existing user" is verifiable.
- The `Retries: 0` field on each task is incremented by the orchestrator each time a retry is triggered. It is the source of truth for retry statistics in the final report.
- The Execution Log is append-only during execution. Do not overwrite earlier entries. Retry attempts are appended as sub-entries under the original task log entry.
- Write the Result section only after all waves complete (or after an abort stops execution).

---

## Idempotency Rules

The spec file enables the orchestrator to resume from an interruption without re-executing completed work.

### Task-Level Idempotency

Before dispatching a builder for a task, read the task's `Status` from the spec file.

- If status is `completed`: skip the task entirely. Do not re-dispatch the builder or validator.
- If status is `skipped`: skip the task entirely. It was user-skipped after retry exhaustion.
- If status is `in_progress`: the previous run was interrupted mid-task. Re-dispatch the builder (treat as a fresh start for that task).
- If status is `pending`: proceed normally.

### Wave-Level Idempotency

Before starting a wave, check the status of all tasks in that wave from the spec file.

- If ALL tasks in the wave have status `completed` or `skipped`: skip the wave entirely. Move to the next wave.
- If SOME tasks are `completed` or `skipped` and others are `pending`: execute only the pending tasks.
- If ANY task is `failed`: do not start the wave. Apply the retry protocol or report existing failure.

### Why This Matters

LLM orchestrators can be interrupted by context window limits, network failures, or user cancellation. Without idempotency, resuming an interrupted orchestration would re-execute already-completed and already-validated tasks -- wasting tokens, potentially overwriting good work, and confusing the validator with a file that already matches the spec.

With idempotency, re-invoking `/orchestrate` with the same prompt on the same spec file safely skips completed work and picks up from where execution stopped.

---

## Retry Protocol

**Introduced in: Stage 3**

When a task receives VERDICT: FAIL, do not stop immediately. Apply the retry protocol: re-dispatch the builder up to 3 times before escalating to the user.

### Core Mechanics

**Builder retry uses `resume: agentId`.**
Store the agentId returned by the Task tool after each builder dispatch. On retry, pass `resume: <agentId>` to the Task tool so the builder receives its previous conversation context. This means the validator's feedback lands in a thread that already knows what was built -- the builder does not need to re-read the spec from scratch and already has full context of what it tried.

**Validator always gets a fresh dispatch (no resume).**
The validator's job is an independent read-and-check. Resuming a validator would inherit the previous run's framing, which could bias the verdict toward leniency or carry over stale context. Fresh dispatch keeps each validation independent.

**Retry prompt (builder):**
```
Your previous implementation of task <task-id> failed validation.

The validator's specific findings:
<paste validator report from Execution Log>

Fix these issues. When done, update the spec file task status and append a
summary of your corrections to the Execution Log.
```

### Retry Sequence

```
Initial dispatch (attempt 0):
  builder dispatched -> builder completed
  validator dispatched -> validator completed
  VERDICT: FAIL

Retry attempt 1:
  emit retry.started { taskId, attempt: 1, maxAttempts: 3 }
  increment Retries counter in spec file
  builder re-dispatched (resume: agentId) with validator feedback
  builder completed
  validator dispatched (fresh, no resume)
  validator completed
  VERDICT: PASS -> emit retry.succeeded, mark task completed, continue
  VERDICT: FAIL -> retry attempt 2

Retry attempt 2:
  emit retry.started { taskId, attempt: 2, maxAttempts: 3 }
  increment Retries counter in spec file
  builder re-dispatched (resume: latest agentId)
  ... (same cycle)
  VERDICT: PASS -> emit retry.succeeded, continue
  VERDICT: FAIL -> retry attempt 3

Retry attempt 3:
  ... (same cycle)
  VERDICT: PASS -> emit retry.succeeded, continue
  VERDICT: FAIL -> emit retry.exhausted, escalate to user
```

### Spec File Updates During Retry

For each retry attempt:
1. Increment `Retries: N` on the task in the Tasks section.
2. Append a retry entry to the Execution Log under the task's wave section:
   ```
   - Retry <N>: builder re-dispatched (resume: <agentId>) -> builder completed -> validator dispatched -> VERDICT: PASS|FAIL
   ```
3. If retry succeeds: update task Status to `completed`.
4. If retry exhausted: update task Status to `failed`.

### After 3 Failures: User Escalation

Emit `retry.exhausted`, then ask the user via AskUserQuestion with three options:

**"Skip this task"**
- Mark task Status as `skipped` in the spec file.
- Continue to the next task in the wave (and subsequent waves).
- Note in the Result section that this task was skipped after retry exhaustion.

**"Provide guidance for the builder"**
- Accept the user's description of what needs fixing.
- Incorporate the guidance into the next builder prompt.
- Dispatch one more builder+validator cycle (this additional cycle is NOT counted against the 3-attempt cap -- it is a user-guided override).
- If PASS: continue normally. If FAIL: ask the user again.

**"Abort orchestration"**
- Update task Status to `failed` in the spec file.
- Write the Result section with the failure summary and retry count.
- Emit `orchestration.cancelled` with reason "retry exhausted, user aborted".
- Stop. Do not execute further tasks or waves.

---

## Fast Path Rules

**Introduced in: Stage 3**

The fast path is an optimization that bypasses DAG decomposition, spec file creation, wave execution, and plan refinement for trivially simple prompts. It is essentially the Stage 1 dispatch loop preserved as an optimization within Stage 3.

### Fast Path Criteria

ALL of the following must be true to trigger the fast path:

1. **Single, self-contained change** -- the prompt describes one coherent unit of work with no sub-tasks.
2. **Affects 1-2 files at most** -- the change is localized; it does not require modifications across multiple modules.
3. **Estimated less than 20 lines of code** -- the implementation is small enough that one builder dispatch will complete it in a single pass.
4. **No dependencies between sub-tasks** -- there are no ordering constraints because there is only one task.

**Canonical examples that trigger fast path:**
- "Add JSDoc to the greet function in src/hello.ts"
- "Rename variable `userId` to `accountId` in src/auth.ts"
- "Fix the typo in the README introduction paragraph"
- "Add a missing semicolon to line 42 of src/index.ts"

**Examples that do NOT trigger fast path:**
- "Add authentication to the app" (vague scope, multiple files)
- "Refactor the user module" (unclear scope, likely many files)
- "Add tests for the API endpoints" (multiple test files, depends on endpoint structure)

### Fast Path Dispatch Shape

When the fast path triggers:

1. Create ONE task via TaskCreate (no wave annotation, no dependency graph).
2. Dispatch builder (sonnet, foreground) with the full task description and acceptance criteria.
3. Dispatch validator (haiku, foreground, fresh) to verify.
4. Parse verdict.
5. On PASS: report result and emit `orchestration.completed`.
6. On FAIL: apply the retry protocol (same mechanics as full execution -- up to 3 retries with `resume: agentId`).

There is no spec file, no plan refinement step, no token estimation step, and no wave events. The `task.created` event fires. The `agent.dispatched`, `agent.completed`, and `verdict.received` events fire. Retry events fire if needed. `orchestration.completed` fires at the end.

### Why Preserve the Fast Path

Without the fast path, a prompt like "add JSDoc to one function" would trigger full DAG decomposition (minimum 3 tasks), a spec file write, a plan refinement loop, token estimation presentation, and TaskCreate calls for all three synthesized tasks -- all for a change a single builder call can complete in seconds. The fast path eliminates this overhead for the cases where it provides no value.

---

## Clarifying Questions Heuristics

**Introduced in: Stage 3**

Before decomposing or routing to the fast path, evaluate whether the prompt is specific enough to act on without asking the user for more information.

### Ambiguity Signals

Any of the following signals should trigger clarification:

- **No target files or paths specified** -- "add authentication" without naming any files leaves the builder guessing at scope.
- **No function signatures or types mentioned** -- "add a user service" could mean a class, a module, a set of functions, or an HTTP client.
- **Vague scope language** -- "improve performance", "fix the bugs", "add error handling", "clean up the code".
- **Multiple valid interpretations** -- "add login" could mean JWT, session cookies, OAuth, or a simple username/password check.

### Question Generation Guidelines

When clarification is needed, ask 2-4 specific, actionable questions:

- **Narrow scope, do not expand it.** Ask questions that eliminate ambiguity, not questions that open new directions. "Which file should the function go in?" not "What other features should we add while we're at it?"
- **Include concrete options where possible.** "JWT, session cookies, or OAuth?" is easier to answer than "What kind of authentication?". Options reduce cognitive load and speed up the response.
- **Do not ask about implementation details the builder should decide.** Variable naming, internal structure, code style -- these are builder decisions, not orchestration inputs. Only ask about things that would change the task graph or acceptance criteria.
- **Prioritize questions by impact.** If you can only ask two questions, ask the ones that would most change what gets built.

**Example -- "add authentication" prompt:**
1. Which files or modules should authentication apply to? (e.g., all API routes, specific endpoints, the entire app)
2. What authentication mechanism? (JWT tokens, session cookies, or OAuth via a provider)
3. Should the implementation include tests?

### Skip Condition

Skip clarification and emit `clarification.skipped` with a reason when:

- The prompt names specific files or modules
- The prompt specifies function signatures or types
- The prompt has a clear, unambiguous scope with one obvious interpretation
- The user has already answered clarifying questions in this session (do not ask twice)

---

## Token Estimation Model

**Introduced in: Stage 3**

Before dispatching any agents (after plan approval, before creating tasks), estimate the token cost of the full orchestration and present it to the user as informational context.

### Per-Task Estimation Formula

| Dispatch | Input Tokens | Output Tokens | Total |
|----------|-------------|--------------|-------|
| Builder | ~2,000 | ~1,000 | ~3,000 |
| Validator | ~1,000 | ~500 | ~1,500 |
| **Per-task total** | | | **~4,500** |

These are conservative estimates. Actual usage varies by task complexity and spec file length (which grows as the execution log fills).

### Wave-Level Calculation

```
Wave N estimated tokens = (number of tasks in Wave N) x 4,500
Total estimated tokens  = sum of all wave estimates
```

### Retry Multiplier

If retries are likely (complex tasks, underspecified acceptance criteria):

- No retries (best case): 1x multiplier -- base estimate
- 1 retry per task: 2x multiplier (one extra builder + validator cycle per task)
- 3 retries per task (worst case): 4x multiplier

Present the base estimate to the user. Mention the retry multiplier if the tasks look complex.

### Model Cost Assumptions

- **Builders** dispatch on **sonnet** (higher capability, higher cost).
- **Validators** dispatch on **haiku** (sufficient for read-and-verify, lower cost).

The cost ratio between sonnet and haiku matters if translating token counts to dollar estimates. For token counts alone, use the formula above directly.

### Presentation Format

```
Token estimate (before retries):
  Wave 1: 1 task  -- ~4,500 tokens
  Wave 2: 3 tasks -- ~13,500 tokens
  Wave 3: 1 task  -- ~4,500 tokens
  Total:          -- ~22,500 tokens

Note: retries add ~4,500 tokens per retry attempt if needed.
```

This is informational only. There is no approval gate. The orchestrator continues to Step 9 immediately after presenting the estimate.

---

## Team Resolution

**Introduced in: Stage 4**

The orchestrator resolves which agents to dispatch by reading a team profile at the start of every orchestration run. This decouples agent identity from orchestration logic -- the 12-step dispatch protocol is identical regardless of which team is selected.

### Team Profile Location

Team profiles live in `.claude/skills/orchestrator/teams/`. Each profile is a markdown file with YAML frontmatter.

### Team Profile Format

```yaml
---
name: <team-name>
description: <what this team is optimized for>
builder: <agent-slug>
validator: <agent-slug>
---
```

The `builder` and `validator` fields reference agent definition files in `.claude/agents/` (without the `.md` extension).

### Resolution Algorithm

1. Parse `--team <name>` from the end of the user prompt. If present, strip the flag from the prompt.
2. If no `--team` flag: default to `engineering`.
3. Read `.claude/skills/orchestrator/teams/<name>.md`.
4. Parse YAML frontmatter to extract `builder` and `validator` fields.
5. Set `$BUILDER_AGENT` and `$VALIDATOR_AGENT` to the resolved values.
6. Emit `team.resolved` event with the team name and resolved agent identities.

### Default Team

When no `--team` flag is specified, the orchestrator uses the `engineering` team profile. This resolves to:

- `BUILDER_AGENT: builder` (the standard code implementation agent)
- `VALIDATOR_AGENT: validator` (the standard read-only verification agent)

This preserves backward compatibility -- all Stage 1-3 orchestrations work identically without any --team flag.

### Available Teams

| Team | Builder | Validator | Use Case |
|------|---------|-----------|----------|
| `engineering` (default) | `builder` | `validator` | Code implementation and modification |
| `research` | `research-builder` | `research-validator` | Web research, synthesis, and information gathering |

---

## Observability Events

These events are emitted via Bash throughout orchestration. The full catalog includes Stage 1, Stage 2, and Stage 3 events.

Emit each event via Bash:

```
bun run scripts/emit-event.ts <event-type> '<json-data>'
```

### Stage 1 Events (unchanged)

#### orchestration.started

```
bun run scripts/emit-event.ts orchestration.started '{
  "orchestrationId": "<id>",
  "prompt": "<user prompt>",
  "team": "<team-name>",
  "builderAgent": "<resolved-builder-agent>",
  "validatorAgent": "<resolved-validator-agent>"
}'
```

#### task.created

```
bun run scripts/emit-event.ts task.created '{
  "orchestrationId": "<id>",
  "taskId": "<numeric-id>",
  "subject": "<subject>"
}'
```

#### agent.dispatched

```
bun run scripts/emit-event.ts agent.dispatched '{
  "orchestrationId": "<id>",
  "taskId": "<numeric-id>",
  "role": "builder|validator",
  "agentType": "builder|validator",
  "model": "sonnet|haiku"
}'
```

#### agent.completed

```
bun run scripts/emit-event.ts agent.completed '{
  "orchestrationId": "<id>",
  "taskId": "<numeric-id>",
  "role": "builder|validator",
  "agentType": "builder|validator"
}'
```

#### verdict.received

```
bun run scripts/emit-event.ts verdict.received '{
  "orchestrationId": "<id>",
  "taskId": "<numeric-id>",
  "verdict": "PASS|FAIL"
}'
```

#### orchestration.completed

```
bun run scripts/emit-event.ts orchestration.completed '{
  "orchestrationId": "<id>",
  "verdict": "PASS|FAIL",
  "taskCount": <n>,
  "retriesTotal": <n>,
  "fastPath": <true|false>,
  "clarifyingQuestionsAsked": <n>
}'
```

On failure, also include `failedTaskId` and `failedWave`:

```
bun run scripts/emit-event.ts orchestration.completed '{
  "orchestrationId": "<id>",
  "verdict": "FAIL",
  "failedTaskId": "<task-id>",
  "failedWave": <n>,
  "retriesTotal": <n>,
  "fastPath": <false>
}'
```

### Stage 2 Events (unchanged)

#### decomposition.completed

Emitted after the task graph is fully constructed and wave numbers are assigned, before the spec file is written.

```
bun run scripts/emit-event.ts decomposition.completed '{
  "orchestrationId": "<id>",
  "taskCount": <n>,
  "waveCount": <n>,
  "tasks": ["<task-id>", "<task-id>", ...]
}'
```

#### spec.written

Emitted after the spec file is written to disk.

```
bun run scripts/emit-event.ts spec.written '{
  "orchestrationId": "<id>",
  "specPath": "specs/<filename>.md"
}'
```

#### spec.reread

Emitted each time the spec file is re-read at a wave boundary (context compaction defense).

```
bun run scripts/emit-event.ts spec.reread '{
  "orchestrationId": "<id>",
  "specPath": "specs/<filename>.md",
  "waveNumber": <n>
}'
```

#### wave.started

Emitted when a wave begins, before the first task in that wave is dispatched.

```
bun run scripts/emit-event.ts wave.started '{
  "orchestrationId": "<id>",
  "waveNumber": <n>,
  "taskIds": ["<task-id>", "<task-id>", ...]
}'
```

#### wave.completed

Emitted when all tasks in a wave have received verdicts (all PASS, skipped, or execution stopped).

```
bun run scripts/emit-event.ts wave.completed '{
  "orchestrationId": "<id>",
  "waveNumber": <n>,
  "verdicts": {
    "<task-id>": "PASS",
    "<task-id>": "PASS"
  }
}'
```

### Stage 3 Events (new)

#### clarification.started

Emitted when the orchestrator begins asking the user clarifying questions.

```
bun run scripts/emit-event.ts clarification.started '{
  "orchestrationId": "<id>"
}'
```

#### clarification.completed

Emitted after the user has answered clarifying questions and the prompt has been re-parsed.

```
bun run scripts/emit-event.ts clarification.completed '{
  "orchestrationId": "<id>",
  "questionsAsked": <N>
}'
```

#### clarification.skipped

Emitted when the prompt is specific enough that no clarification is needed.

```
bun run scripts/emit-event.ts clarification.skipped '{
  "orchestrationId": "<id>",
  "reason": "<brief explanation of why the prompt was specific enough>"
}'
```

#### fast_path.evaluated

Emitted after the fast path gate check completes, regardless of the result.

```
bun run scripts/emit-event.ts fast_path.evaluated '{
  "orchestrationId": "<id>",
  "triggered": <true|false>,
  "reason": "<brief explanation>"
}'
```

#### plan.presented

Emitted when the task graph is shown to the user for review (Step 7 of the full path).

```
bun run scripts/emit-event.ts plan.presented '{
  "orchestrationId": "<id>",
  "taskCount": <n>,
  "waveCount": <n>
}'
```

#### plan.approved

Emitted when the user approves the task graph without modifications.

```
bun run scripts/emit-event.ts plan.approved '{
  "orchestrationId": "<id>"
}'
```

#### plan.modified

Emitted when the user requests changes to the task graph during plan refinement. May be emitted multiple times in a single refinement loop.

```
bun run scripts/emit-event.ts plan.modified '{
  "orchestrationId": "<id>",
  "modifications": "<brief summary of what the user changed>"
}'
```

#### orchestration.cancelled

Emitted when the user cancels the orchestration, either during plan refinement or after retry exhaustion.

```
bun run scripts/emit-event.ts orchestration.cancelled '{
  "orchestrationId": "<id>",
  "reason": "<user cancelled at plan review | retry exhausted, user aborted>"
}'
```

#### tokens.estimated

Emitted after the token estimate is calculated and presented to the user.

```
bun run scripts/emit-event.ts tokens.estimated '{
  "orchestrationId": "<id>",
  "estimatedTokens": <total>,
  "breakdown": {
    "wave1": <tokens>,
    "wave2": <tokens>,
    "wave3": <tokens>
  }
}'
```

#### retry.started

Emitted at the beginning of each retry attempt for a failed task.

```
bun run scripts/emit-event.ts retry.started '{
  "orchestrationId": "<id>",
  "taskId": "<numeric-id>",
  "attempt": <N>,
  "maxAttempts": 3
}'
```

#### retry.succeeded

Emitted when a retry attempt produces VERDICT: PASS.

```
bun run scripts/emit-event.ts retry.succeeded '{
  "orchestrationId": "<id>",
  "taskId": "<numeric-id>",
  "attempt": <N>
}'
```

#### retry.exhausted

Emitted when all 3 retry attempts have failed and the user must decide how to proceed.

```
bun run scripts/emit-event.ts retry.exhausted '{
  "orchestrationId": "<id>",
  "taskId": "<numeric-id>"
}'
```

### Stage 4 Events (new)

#### team.resolved

Emitted after the team profile is read and agent identities are resolved, before any other processing. This is the first event after `orchestration.started`.

```
bun run scripts/emit-event.ts team.resolved '{
  "orchestrationId": "<id>",
  "team": "<team-name>",
  "builderAgent": "<resolved-builder-agent>",
  "validatorAgent": "<resolved-validator-agent>"
}'
```

### Full Event Sequence -- Stage 3 (3-Wave Orchestration with Clarification, Fast Path Evaluation, Plan Refinement, Token Estimation, and Retry)

```
orchestration.started
team.resolved               { team: "engineering", builderAgent: "builder", validatorAgent: "validator" }

# Step 2: Clarifying Questions
clarification.started
# (user answers questions)
clarification.completed     { questionsAsked: 2 }

# Step 3: Fast Path Gate
fast_path.evaluated         { triggered: false, reason: "5 tasks, multiple files" }

# Step 4-5: Decompose and compute waves
decomposition.completed     { taskCount: 5, waveCount: 3 }

# Step 6: Write spec file
spec.written                { specPath: "specs/rest-api.md" }

# Step 7: Plan Refinement
plan.presented              { taskCount: 5, waveCount: 3 }
plan.modified               { modifications: "split implement-get-users into two tasks" }
plan.presented              { taskCount: 6, waveCount: 3 }
plan.approved

# Step 8: Token Estimation
tokens.estimated            { estimatedTokens: 27000, breakdown: { wave1: 4500, wave2: 18000, wave3: 4500 } }

# Step 9: Create all tasks
task.created                { taskId: "1", subject: "Define User types" }
task.created                { taskId: "2", subject: "Implement GET /users handler" }
task.created                { taskId: "3", subject: "Implement GET /users pagination" }
task.created                { taskId: "4", subject: "Implement POST /users" }
task.created                { taskId: "5", subject: "Implement GET /users/:id" }
task.created                { taskId: "6", subject: "Write user route tests" }

# Step 10: Execute Wave 1
spec.reread                 { waveNumber: 1 }
wave.started                { waveNumber: 1, taskIds: ["define-user-types"] }
  agent.dispatched          { role: "builder", taskId: "1", model: "sonnet" }
  agent.completed           { role: "builder", taskId: "1" }
  agent.dispatched          { role: "validator", taskId: "1", model: "haiku" }
  agent.completed           { role: "validator", taskId: "1" }
  verdict.received          { taskId: "1", verdict: "PASS" }
wave.completed              { waveNumber: 1, verdicts: { "define-user-types": "PASS" } }

# Step 10: Execute Wave 2 (one task fails and requires retry)
spec.reread                 { waveNumber: 2 }
wave.started                { waveNumber: 2, taskIds: ["implement-get-users", ...] }
  agent.dispatched          { role: "builder", taskId: "2", model: "sonnet" }
  agent.completed           { role: "builder", taskId: "2" }
  agent.dispatched          { role: "validator", taskId: "2", model: "haiku" }
  agent.completed           { role: "validator", taskId: "2" }
  verdict.received          { taskId: "2", verdict: "FAIL" }
  retry.started             { taskId: "2", attempt: 1, maxAttempts: 3 }
  agent.dispatched          { role: "builder", taskId: "2", model: "sonnet" }  # resume: agentId
  agent.completed           { role: "builder", taskId: "2" }
  agent.dispatched          { role: "validator", taskId: "2", model: "haiku" }  # fresh dispatch
  agent.completed           { role: "validator", taskId: "2" }
  verdict.received          { taskId: "2", verdict: "PASS" }
  retry.succeeded           { taskId: "2", attempt: 1 }
  # (remaining wave 2 tasks proceed normally)
  ...
wave.completed              { waveNumber: 2, verdicts: { ... } }

# Step 10: Execute Wave 3
spec.reread                 { waveNumber: 3 }
wave.started                { waveNumber: 3, taskIds: ["write-user-route-tests"] }
  ...
wave.completed              { waveNumber: 3, verdicts: { ... } }

# Steps 11-12: Update spec and report
orchestration.completed     { verdict: "PASS", taskCount: 6, retriesTotal: 1, fastPath: false, clarifyingQuestionsAsked: 2 }
```

**Fast path event sequence (trivial prompt, no clarification needed):**

```
orchestration.started
team.resolved               { team: "engineering", builderAgent: "builder", validatorAgent: "validator" }
clarification.skipped       { reason: "file and function named explicitly" }
fast_path.evaluated         { triggered: true, reason: "single file, < 5 lines" }
task.created                { taskId: "1", subject: "Add JSDoc to greet function" }
agent.dispatched            { role: "builder", taskId: "1", model: "sonnet" }
agent.completed             { role: "builder", taskId: "1" }
agent.dispatched            { role: "validator", taskId: "1", model: "haiku" }
agent.completed             { role: "validator", taskId: "1" }
verdict.received            { taskId: "1", verdict: "PASS" }
orchestration.completed     { verdict: "PASS", taskCount: 1, retriesTotal: 0, fastPath: true, clarifyingQuestionsAsked: 0 }
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [`SKILL.md`](../SKILL.md) | The SKILL.md that delegates to this reference for wave algorithm details |

> **Note:** This reference was extracted from the [orchestrator-prototype](https://github.com/nathanvale/orchestrator-prototype) repository. For pattern documentation (dispatch loop, task DAG, wave computation, spec-as-source-of-truth, retry-with-resume, fast-path-gate, iterative-refinement, team profiles), see the `docs/patterns/` directory in that repository.
