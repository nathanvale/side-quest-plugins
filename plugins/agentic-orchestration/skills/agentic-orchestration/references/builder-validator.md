# Builder/Validator Pattern

The foundational agentic orchestration pattern. One agent builds, another validates read-only. 2x compute yields exponentially higher trust.

**Source hierarchy:** Official docs (code.claude.com) > hooks-mastery (IndyDevDan) > community experience.
**Last verified:** 2026-02-11 against Claude Code sub-agents docs.

---

## Core Concept

Builder/Validator separates creation from verification into two independent agents:

- **Builder** -- has full tool access, executes ONE task at a time, writes code/files/tests
- **Validator** -- read-only, cannot modify anything, inspects and reports pass/fail

**Why it works:** The same model that wrote buggy code will often "see" it as correct on review. A fresh context with read-only constraints forces genuine verification -- the validator literally cannot fix issues, only report them.

**The 2x compute equation:** You pay double the tokens but get:
- Independent verification (not rubber-stamping your own work)
- Deterministic quality gates (validator can't cheat by editing)
- Clear accountability (build failures vs validation failures are distinct)
- Higher first-time correctness (catches issues before they compound)

## Builder Agent Definition

Save to `.claude/agents/team/builder.md`:

```markdown
---
name: builder
description: Generic engineering agent that executes ONE task at a time. Use when work needs to be done - writing code, creating files, implementing features.
model: sonnet
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "bun run ${CLAUDE_PROJECT_DIR}/.claude/hooks/validators/lint-check.ts"
        - type: command
          command: "bun run ${CLAUDE_PROJECT_DIR}/.claude/hooks/validators/type-check.ts"
---

# Builder

## Purpose

You are a focused engineering agent responsible for executing ONE task at a time. You build, implement, and create. You do not plan or coordinate - you execute.

## Instructions

- You are assigned ONE task. Focus entirely on completing it.
- Use `TaskGet` to read your assigned task details if a task ID is provided.
- Do the work: write code, create files, modify existing code, run commands.
- When finished, use `TaskUpdate` to mark your task as `completed`.
- If you encounter blockers, update the task with details but do NOT stop - attempt to resolve or work around.
- Do NOT spawn other agents or coordinate work. You are a worker, not a manager.
- Stay focused on the single task. Do not expand scope.

## Workflow

1. **Understand the Task** - Read the task description (via `TaskGet` if task ID provided, or from prompt).
2. **Execute** - Do the work. Write code, create files, make changes.
3. **Verify** - Run any relevant validation (tests, type checks, linting) if applicable.
4. **Complete** - Use `TaskUpdate` to mark task as `completed` with a brief summary of what was done.

## Report

After completing your task, provide a brief report:

## Task Complete

**Task**: [task name/description]
**Status**: Completed

**What was done**:
- [specific action 1]
- [specific action 2]

**Files changed**:
- [file1.ts] - [what changed]
- [file2.ts] - [what changed]

**Verification**: [any tests/checks run]
```

### TypeScript Builder Hooks (biome + tsc)

When using the side-quest runner plugins, the Builder gets automatic quality checks via plugin hooks:

- **biome-runner** -- PostToolUse runs `biome check --write` on `Write|Edit|MultiEdit`, auto-fixes formatting and reports unfixable lint errors
- **tsc-runner** -- PostToolUse runs `tsc --noEmit` on `Write|Edit|MultiEdit`, filtered by nearest tsconfig
- **bun-runner** -- PostToolUse runs `bun test` on edited test files

These fire automatically when the plugins are enabled -- no additional Builder configuration needed. The Builder definition above shows custom hooks for projects without the runner plugins.

### Python Builder Hooks (ruff + ty)

The hooks-mastery approach for Python projects:

```yaml
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/validators/ruff_validator.py"
        - type: command
          command: "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/validators/ty_validator.py"
```

Same pattern, different tools. The principle is identical: deterministic quality enforcement on every file edit.

## Validator Agent Definition

Save to `.claude/agents/team/validator.md`:

```markdown
---
name: validator
description: Read-only validation agent that checks if a task was completed successfully. Use after a builder finishes to verify work meets acceptance criteria.
model: haiku
disallowedTools: Write, Edit, NotebookEdit
---

# Validator

## Purpose

You are a read-only validation agent responsible for verifying that ONE task was completed successfully. You inspect, analyze, and report - you do NOT modify anything.

## Instructions

- You are assigned ONE task to validate. Focus entirely on verification.
- Use `TaskGet` to read the task details including acceptance criteria.
- Inspect the work: read files, run read-only commands, check outputs.
- You CANNOT modify files - you are read-only. If something is wrong, report it.
- Use `TaskUpdate` to mark validation as `completed` with your findings.
- Be thorough but focused. Check what the task required, not everything.

## Workflow

1. **Understand the Task** - Read the task description and acceptance criteria (via `TaskGet` if task ID provided).
2. **Inspect** - Read relevant files, check that expected changes exist.
3. **Verify** - Run validation commands (tests, type checks, linting) if specified.
4. **Report** - Use `TaskUpdate` to mark complete and provide pass/fail status.

## Report

After validating, provide a clear pass/fail report:

## Validation Report

**Task**: [task name/description]
**Status**: PASS | FAIL

**Checks Performed**:
- [x] [check 1] - passed
- [x] [check 2] - passed
- [ ] [check 3] - FAILED: [reason]

**Files Inspected**:
- [file1.ts] - [status]
- [file2.ts] - [status]

**Commands Run**:
- `[command]` - [result]

**Summary**: [1-2 sentence summary of validation result]

**Issues Found** (if any):
- [issue 1]
- [issue 2]
```

## Orchestration Flow

```
User Request
    |
    v
[Lead Agent] -- NEVER writes code, only coordinates
    |
    |-- 1. Analyze requirements, explore codebase
    |-- 2. Create plan (specs/<name>.md)
    |-- 3. TaskCreate for each step
    |-- 4. Set dependencies (addBlockedBy)
    |
    v
[Builder Agent] -- deployed via Task tool
    |
    |-- Reads task via TaskGet
    |-- Executes: writes code, creates files
    |-- PostToolUse hooks auto-validate (lint, typecheck)
    |-- Marks task completed via TaskUpdate
    |
    v
[Validator Agent] -- deployed after Builder completes
    |
    |-- Reads task + acceptance criteria via TaskGet
    |-- Inspects files (read-only)
    |-- Runs validation commands
    |-- Reports PASS/FAIL via TaskUpdate
    |
    v
[Lead Agent] -- reviews validator report
    |
    |-- PASS: proceed to next task
    |-- FAIL: resume Builder to fix issues, re-validate
```

## Complete Example: Adding an Auth Feature

```typescript
// 1. Lead creates tasks
TaskCreate({
  subject: "Implement JWT authentication middleware",
  description: "Create auth middleware that validates JWT tokens...",
  activeForm: "Implementing auth middleware"
})
// Returns taskId: "1"

TaskCreate({
  subject: "Validate auth middleware implementation",
  description: "Verify JWT middleware meets acceptance criteria...",
  activeForm: "Validating auth middleware"
})
// Returns taskId: "2"

// 2. Set dependency
TaskUpdate({ taskId: "2", addBlockedBy: ["1"] })

// 3. Deploy Builder (sonnet -- executes well-specified tasks)
Task({
  description: "Implement auth middleware",
  prompt: "Execute Task 1: Implement JWT authentication middleware. Use TaskGet to read full requirements.",
  subagent_type: "builder",  // Custom agent from .claude/agents/team/
  model: "sonnet"
})

// 4. After Builder completes, deploy Validator (haiku -- mechanical checks only)
Task({
  description: "Validate auth middleware",
  prompt: "Validate Task 1 was completed correctly. Use TaskGet to read acceptance criteria. Report PASS or FAIL.",
  subagent_type: "validator",
  model: "haiku"
})

// 5. If FAIL, resume Builder to fix
Task({
  description: "Fix auth middleware issues",
  prompt: "The validator found these issues: [issues]. Fix them.",
  subagent_type: "builder",
  resume: "abc123"  // Resume with prior context preserved
})
```

## Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---------|---------------|-----|
| Validator has Write/Edit access | Becomes another builder, defeats the pattern | Use `disallowedTools: Write, Edit, NotebookEdit` |
| Skipping the plan step | Builder doesn't know what to build | Always create a spec first, then TaskCreate |
| Validating too late | Errors compound across tasks | Validate after each Builder task, not at the end |
| Lead writes code | Lead loses orchestration context | Lead ONLY uses Task* tools, never writes code directly |
| Single agent builds + validates | Same context = same blind spots | Separate agents = independent verification |
| Builder scope creep | Builder fixes unrelated issues | Builder instructions: "Stay focused on the single task. Do not expand scope." |
| No acceptance criteria | Validator doesn't know what to check | Task description must include specific, measurable criteria |
| Validator runs tests that don't exist yet | Validation fails for wrong reason | Ensure test-writing is part of the Builder task, not validation |

## When NOT to Use Builder/Validator

- **Simple tasks** (<3 steps) -- just do it directly, the overhead isn't worth it
- **Exploration/research** -- use Explore subagent instead
- **Documentation-only changes** -- single pass is sufficient
- **Rapid prototyping** -- the 2x compute cost slows iteration

Use Builder/Validator when the cost of bugs exceeds the cost of verification. Production features, API changes, security-sensitive code, and complex refactors are ideal candidates.

---

*Inspired by IndyDevDan's claude-code-hooks-mastery Builder/Validator system.*
