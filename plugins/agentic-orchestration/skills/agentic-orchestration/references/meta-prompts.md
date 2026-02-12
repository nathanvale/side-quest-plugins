# Meta-Prompts

A meta-prompt is a prompt that generates structured output -- specifically, a plan document that other agents can execute. The `/plan_w_team` command is the canonical example.

**Source hierarchy:** Official docs (code.claude.com/skills) > hooks-mastery (IndyDevDan) > community experience.
**Last verified:** 2026-02-11 against Claude Code skills docs and hooks-mastery plan_w_team.md.

---

## What Is a Meta-Prompt?

A meta-prompt doesn't write code. It writes a **plan** that describes:
- What to build
- Who builds it (team members)
- In what order (task dependencies)
- How to validate (acceptance criteria)

**Why it matters:** "Great planning is great prompting" (IndyDevDan). A detailed spec creates multiplicative returns -- every agent downstream benefits from clarity. The moat isn't the tool; it's the framework.

## Anatomy of plan_w_team

The plan_w_team command has four key components:

### 1. Frontmatter Configuration

```yaml
---
description: Creates a concise engineering implementation plan
argument-hint: [user prompt] [orchestration prompt]
model: opus
disallowed-tools: Task, EnterPlanMode
hooks:
  Stop:
    - hooks:
        - type: command
          command: "./hooks/validate-new-file.sh --directory specs --extension .md"
        - type: command
          command: >-
            ./hooks/validate-file-contains.sh
            --directory specs
            --extension .md
            --contains '## Task Description'
            --contains '## Objective'
            --contains '## Relevant Files'
            --contains '## Step by Step Tasks'
            --contains '## Acceptance Criteria'
            --contains '## Team Orchestration'
            --contains '### Team Members'
---
```

**Key decisions:**
- `model: opus` -- planning requires the strongest reasoning
- `disallowed-tools: Task, EnterPlanMode` -- the planner cannot execute, only plan
- Stop hooks validate the plan structure before allowing completion

### 2. Variables and Inputs

```text
USER_PROMPT: $1                    -- what the user wants built
ORCHESTRATION_PROMPT: $2           -- optional guidance for team composition
PLAN_OUTPUT_DIRECTORY: specs/
TEAM_MEMBERS: .claude/agents/team/*.md
GENERAL_PURPOSE_AGENT: general-purpose
```

### 3. Instructions (the "How")

The meta-prompt instructs Claude to:
1. Analyze requirements from USER_PROMPT
2. Explore the codebase directly (no subagents during planning)
3. Design the solution approach
4. Define team members from available agents
5. Create step-by-step tasks with dependencies
6. Generate a kebab-case filename
7. Save to specs/ directory

**Critical rule:** "You operate as the team lead and orchestrate the team to execute the plan. You're responsible for deploying the right team members with the right context. IMPORTANT: You NEVER operate directly on the codebase."

### 4. Stop Hook Validation

The Stop hooks ensure every plan has required sections. If a section is missing, Claude is blocked from completing and must add it. This is deterministic enforcement -- the plan literally cannot be saved without the right structure.

**For TypeScript projects without UV/Python**, replace the validation scripts with instruction-based validation (list the required sections in the skill) or write TypeScript equivalents:

```typescript
// hooks/validate-plan-sections.ts
const input = JSON.parse(await Bun.stdin.text())
const specs = Bun.glob("specs/*.md")

for await (const file of specs) {
  const content = await Bun.file(file).text()
  const required = [
    "## Task Description", "## Objective", "## Relevant Files",
    "## Step by Step Tasks", "## Acceptance Criteria",
    "## Team Orchestration", "### Team Members"
  ]
  const missing = required.filter(section => !content.includes(section))
  if (missing.length > 0) {
    console.error(`Missing sections in ${file}: ${missing.join(", ")}`)
    process.exit(2)
  }
}
```

## Plan Format Template

This is the complete plan format. Replace `<requested content>` with actual content. Everything else should appear exactly as shown.

```markdown
# Plan: <task name>

## Task Description
<describe the task in detail based on the prompt>

## Objective
<clearly state what will be accomplished when this plan is complete>

## Problem Statement
<clearly define the specific problem or opportunity this task addresses>
<!-- Include for features or medium/complex tasks -->

## Solution Approach
<describe the proposed solution approach and how it addresses the objective>
<!-- Include for features or medium/complex tasks -->

## Relevant Files
Use these files to complete the task:

- `path/to/file.ts` - why this file is relevant
- `path/to/other.ts` - why this file is relevant

### New Files
- `path/to/new-file.ts` - what this new file will contain

## Implementation Phases
<!-- Include for medium/complex tasks -->

### Phase 1: Foundation
<describe foundational work needed>

### Phase 2: Core Implementation
<describe main implementation work>

### Phase 3: Integration & Polish
<describe integration, testing, and final touches>

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- You're responsible for deploying the right team members with the right context.
- IMPORTANT: You NEVER operate directly on the codebase. You use Task and Task* tools.
- Take note of the session id of each team member for resume operations.

### Model Selection Guide

| Role | Model | Rationale |
|------|-------|-----------|
| All builders | sonnet | Executes well-specified tasks reliably |
| All validators | haiku | Mechanical checks: read files, run commands, report PASS/FAIL |

### Team Members

- Builder
  - Name: <unique name, e.g., builder-api>
  - Role: <single focus area>
  - Agent Type: <subagent type from team/*.md or general-purpose>
  - Model: sonnet
  - Resume: true

- Validator
  - Name: <unique name, e.g., validator-api>
  - Role: <what this validator checks>
  - Agent Type: validator
  - Model: haiku
  - Resume: true

## Step by Step Tasks

- IMPORTANT: Execute every step in order, top to bottom.
- Before you start, run TaskCreate for each task.

### 1. <First Task Name>
- **Task ID**: <unique-kebab-case-id>
- **Depends On**: none
- **Assigned To**: <team member name>
- **Agent Type**: <subagent type>
- **Model**: <sonnet|haiku per Model Selection Guide>
- **Parallel**: <true/false>
- <specific action to complete>
- <specific action to complete>

### 2. <Second Task Name>
- **Task ID**: <unique-kebab-case-id>
- **Depends On**: <previous Task ID>
- **Assigned To**: <team member name>
- **Agent Type**: <subagent type>
- **Model**: <sonnet|haiku per Model Selection Guide>
- **Parallel**: <true/false>
- <specific action>
- <specific action>

### N. Final Validation
- **Task ID**: validate-all
- **Depends On**: <all previous Task IDs>
- **Assigned To**: <validator name>
- **Agent Type**: validator
- **Model**: haiku
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met

## Acceptance Criteria
<list specific, measurable criteria that must be met>

## Validation Commands
Execute these commands to validate the task is complete:

- `bun test` - Run all tests
- `bunx tsc --noEmit` - Verify no type errors
- `bunx biome ci .` - Lint and format check

## Notes
<optional additional context, considerations, or dependencies>
```

## Team Orchestration Rules

1. **Lead never codes** -- the lead uses Task* tools only. Writing code directly loses the orchestration context and defeats the pattern.

2. **One task per agent** -- each Builder/Validator gets exactly one task. Scope creep in agents is a top failure mode.

3. **Dependencies before deployment** -- set all `addBlockedBy` relationships before launching any agents. Launching agents before dependencies are set = race conditions.

4. **Resume for context** -- store the agentId from each Task invocation. When a Validator reports FAIL, resume the Builder (not a fresh one) so it has full context of what it built.

5. **Validate per task, not at the end** -- catch issues early. A validation failure in task 2 is cheaper to fix than discovering it after task 8.

6. **Plan is the single source of truth** -- the spec file (specs/*.md) is what everyone references. Don't add context verbally; update the plan.

## Adapting for Your Project

### TypeScript/Bun Stack

Replace hooks-mastery's Python-specific patterns:

| hooks-mastery (Python) | Your Adaptation (TypeScript) |
|------------------------|------------------------------|
| `uv run ruff_validator.py` | biome-runner plugin (auto-hooks) |
| `uv run ty_validator.py` | tsc-runner plugin (auto-hooks) |
| `uv run validate_new_file.py` | TypeScript validation script or instruction-based |
| `uv run validate_file_contains.py` | TypeScript validation script or instruction-based |
| `uv add` for dependencies | `bun add` for dependencies |
| `pytest` for tests | `bun test` for tests |

### Without Stop Hook Validation Scripts

If you don't want to write validation scripts, use instruction-based validation:

```yaml
---
description: Creates an implementation plan
model: opus
disallowed-tools: Task, EnterPlanMode
---

# Plan With Team

IMPORTANT: Your plan MUST include ALL of these sections:
- ## Task Description
- ## Objective
- ## Relevant Files
- ## Step by Step Tasks
- ## Acceptance Criteria
- ## Team Orchestration with ### Team Members

If any section is missing, add it before completing.
```

This is less reliable than hook-based validation (probabilistic vs deterministic) but works for getting started.

## Report Format

After creating the plan, provide this summary:

```text
Plan Created

File: specs/<filename>.md
Topic: <brief description>
Key Components:
- <main component 1>
- <main component 2>
- <main component 3>

Team Task List:
- <task and owner>

Team members:
- <member and role>

When ready, execute the plan by running:
/build specs/<filename>.md
```

---

*Plan format and team orchestration rules adapted from IndyDevDan's plan_w_team command.*
