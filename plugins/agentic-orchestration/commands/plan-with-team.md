---
description: Creates a Builder/Validator team implementation plan and saves it to specs/
argument-hint: <what to build> [orchestration guidance]
model: opus
disable-model-invocation: true
disallowed-tools: Task, EnterPlanMode
---

# Plan With Team

Create a detailed implementation plan based on the user's requirements. Analyze the request, think through the implementation approach, and save a comprehensive specification document to `specs/<name>.md` that can be used as a blueprint for team-based execution with Builder/Validator agents.

## Variables

USER_PROMPT: $1
ORCHESTRATION_PROMPT: $2 -- (Optional) Guidance for team assembly, task structure, and execution strategy
PLAN_OUTPUT_DIRECTORY: `specs/`
TEAM_MEMBERS: `.claude/agents/team/*.md`
GENERAL_PURPOSE_AGENT: `general-purpose`

## Instructions

- **PLANNING ONLY**: Do NOT build, write code, or deploy agents. Your only output is a plan document saved to PLAN_OUTPUT_DIRECTORY.
- If no USER_PROMPT is provided, stop and ask the user to provide it.
- If ORCHESTRATION_PROMPT is provided, use it to guide team composition, task granularity, dependency structure, and parallel/sequential decisions.
- Use ultrathink to reason deeply about the best implementation approach.
- Explore the codebase directly (no subagents) to understand existing patterns and architecture.
- Follow the Plan Format below exactly.
- Generate a descriptive, kebab-case filename based on the main topic.
- Create the `specs/` directory if it doesn't exist.
- If a file with the same name already exists, append `-2` (or `-3`, etc.) to avoid collision.
- Save the plan and provide the report format at the end.
- You are the team lead. Refer to the Team Orchestration section for your role.

### Team Orchestration Rules

As team lead, you coordinate work using Task* tools. You NEVER write code directly.

1. **Lead never codes** -- use TaskCreate, TaskUpdate, TaskList, TaskGet, and Task tool only
2. **One task per agent** -- each Builder/Validator gets exactly one focused task
3. **Dependencies before deployment** -- set all addBlockedBy before launching agents
4. **Resume for context** -- store agentId, resume on validation failure
5. **Validate per task** -- don't wait until the end
6. **Plan is the source of truth** -- update the spec file, not verbal context

### Validation Stack (TypeScript/Bun)

When defining Builder agents, note the validation stack:
- **biome-runner** plugin: PostToolUse auto-formats and lints on Write|Edit
- **tsc-runner** plugin: PostToolUse typechecks on Write|Edit
- **bun-runner** plugin: PostToolUse runs tests on test file edits

These fire automatically when enabled. Validation commands for the plan:
- `bun test` -- run all tests
- `bunx tsc --noEmit` -- typecheck
- `bunx biome ci .` -- lint and format check

## Workflow

IMPORTANT: **PLANNING ONLY** -- Do not execute, build, or deploy.

1. **Analyze Requirements** -- Parse USER_PROMPT to understand the core problem
2. **Explore Codebase** -- Directly understand existing patterns, architecture, relevant files
3. **Design Solution** -- Develop technical approach and architecture decisions
4. **Define Team** -- Identify team members from TEAM_MEMBERS files or use GENERAL_PURPOSE_AGENT
5. **Define Tasks** -- Create step-by-step tasks with IDs, dependencies, assignments
6. **Generate Filename** -- Descriptive kebab-case based on plan topic
7. **Save Plan** -- Write to PLAN_OUTPUT_DIRECTORY/<filename>.md
8. **Report** -- Provide summary in the report format below

## Plan Format

IMPORTANT: Replace `<requested content>` with actual content. Everything else appears exactly as shown.

````markdown
# Plan: <task name>

## Task Description
<describe the task in detail based on the prompt>

## Objective
<clearly state what will be accomplished when this plan is complete>

## Problem Statement
<define the specific problem or opportunity this task addresses>

## Solution Approach
<describe the proposed solution and how it addresses the objective>

## Relevant Files
Use these files to complete the task:

<list files with bullet points explaining relevance>

### New Files
<list new files to be created, if any>

## Implementation Phases

### Phase 1: Foundation
<foundational work needed>

### Phase 2: Core Implementation
<main implementation work>

### Phase 3: Integration & Polish
<integration, testing, final touches>

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. Use Task and Task* tools only.
- Take note of the session id (agentId) of each team member for resume operations.

### Team Members

- Builder
  - Name: <unique name, e.g., builder-api>
  - Role: <single focus area>
  - Agent Type: <subagent type from team/*.md or general-purpose>
  - Resume: true

- Validator
  - Name: <unique name, e.g., validator-api>
  - Role: <what this validator checks>
  - Agent Type: validator
  - Resume: true

<additional team members as needed>

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. <First Task Name>
- **Task ID**: <unique-kebab-case-id>
- **Depends On**: none
- **Assigned To**: <team member name>
- **Agent Type**: <subagent type>
- **Parallel**: <true/false>
- <specific action to complete>
- <specific action to complete>

### 2. <Second Task Name>
- **Task ID**: <unique-kebab-case-id>
- **Depends On**: <previous Task ID>
- **Assigned To**: <team member name>
- **Agent Type**: <subagent type>
- **Parallel**: <true/false>
- <specific action>

### N. Final Validation
- **Task ID**: validate-all
- **Depends On**: <all previous Task IDs>
- **Assigned To**: <validator name>
- **Agent Type**: validator
- **Parallel**: false
- Run all validation commands
- Verify acceptance criteria met

## Acceptance Criteria
<list specific, measurable criteria>

## Validation Commands
- `bun test` -- run all tests
- `bunx tsc --noEmit` -- verify no type errors
- `bunx biome ci .` -- lint and format check

## Notes
<optional additional context, dependencies, or considerations>
````

## Report

After saving the plan, provide this summary:

```
Plan Created

File: specs/<filename>.md
Topic: <brief description>

Key Components:
- <main component 1>
- <main component 2>
- <main component 3>

Team:
- <member name>: <role>
- <member name>: <role>

Tasks:
- <task 1> (assigned to <member>)
- <task 2> (assigned to <member>)

To execute this plan, run it in a new session with the team lead role.
```
