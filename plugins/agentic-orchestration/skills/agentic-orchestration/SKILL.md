---
name: agentic-orchestration
description: >
  Knowledge bank for agentic orchestration patterns - Builder/Validator, Agent Teams,
  multi-agent coordination, hook-based self-validation, task dependency chains,
  meta-prompts, sub-agent architecture.
  Triggers on: builder validator, agent teams, TeamCreate, SendMessage, TeammateIdle,
  multi-agent, orchestration, task orchestration, TaskCreate, TaskUpdate, TaskList,
  dependency chain, parallel agents, meta-prompt, plan with team, plan_w_team,
  sub-agent, agent chaining, delegation, 3 amigo, leader swarm, pipeline,
  watchdog, self-validation, hook validation, PostToolUse quality, Stop hook validate,
  which pattern, when to use, orchestration pattern, compute advantage,
  indydevdan, hooks-mastery, agentic coding, run_in_background, resume agent.
argument-hint: "[--refresh] [--upgrade] [question about agentic orchestration]"
allowed-tools: Bash, Read, Write, Glob, Grep, WebSearch, AskUserQuestion
---

# Agentic Orchestration Knowledge Bank

Expert guidance for agentic orchestration patterns in Claude Code -- Builder/Validator, Agent Teams, multi-agent coordination, hook-based self-validation, task dependency chains, meta-prompts, and sub-agent architecture.

Inspired by IndyDevDan's claude-code-hooks-mastery and Anthropic's Agent Teams feature.

## Community Intel Configuration

| Variable | Value |
|----------|-------|
| SKILL_NAME | `agentic-orchestration` |
| CACHE_DIR | `${CLAUDE_PLUGIN_ROOT}/skills/agentic-orchestration/cache` |
| CONFIG_PATH | `${CLAUDE_PLUGIN_ROOT}/community-intel.json` |
| VERIFIED_INTEL_PATH | `${CLAUDE_PLUGIN_ROOT}/skills/agentic-orchestration/references/verified-intel.md` |
| SMART_REFRESH_KEYWORDS | agent teams, experimental, gotcha, broken, not working, cost, help |

## Steps 0 and 1: Community Intel

Check if `../../shared/community-intel-workflow.md` exists (relative to this file).

If it does NOT exist, community intel is unavailable. Tell the user: "Community intel requires the research plugin. Reinstall this plugin after adding the research plugin to your marketplace." Then skip to Step 2 without community intel footers.

If it exists, read and follow the workflow. Use the configuration values from the table above.
After Step 1 completes, return here and proceed to Step 2.
If --upgrade mode, follow Step 5 in the community intel workflow and stop.

## Step 2: Classify the Question

Parse the user's question into one or more categories. If you already classified in Step 1b, reuse that classification.

If a question spans multiple categories, identify the primary concern and secondary categories. Address primary first, then connect to secondary categories with separate headed sections.

| Category | Keywords / Signals | Reference File |
|----------|-------------------|----------------|
| **Builder/Validator** | builder, validator, 2x compute, build-then-verify, read-only agent, disallowedTools, worker agent, validation agent | [builder-validator.md](references/builder-validator.md) |
| **Hook Validation** | self-validating, Stop hook, validate output, PostToolUse quality, auto-format, ruff, ty, biome, tsc, bun-test, runner plugin, hook enforcement | [hook-validation.md](references/hook-validation.md) |
| **Task Orchestration** | TaskCreate, TaskUpdate, TaskList, TaskGet, addBlockedBy, dependency chain, parallel, run_in_background, 3-task rule, resume, hydration, wave, session-scoped, task list | [task-orchestration.md](references/task-orchestration.md) |
| **Meta-Prompts** | plan_w_team, plan template, team plan, spec document, meta prompt, orchestration prompt, plan format | [meta-prompts.md](references/meta-prompts.md) |
| **Sub-Agents** | sub-agent, subagent, system prompt, agent chaining, meta-agent, info flow, delegation, foreground, background, context fork, agent definition | [sub-agents.md](references/sub-agents.md) |
| **Agent Teams** | agent teams, TeamCreate, SendMessage, TeammateIdle, teammate, delegate mode, native orchestration, experimental, team coordination | [agent-teams.md](references/agent-teams.md) |
| **Pattern Selection** | which pattern, when to use, 3 amigo, leader swarm, pipeline, watchdog, pattern comparison, decision matrix, cost, anti-pattern, over-orchestrate | [patterns-taxonomy.md](references/patterns-taxonomy.md) |

## Step 3: Read Reference Files

Read the relevant reference files based on the classification. Always read the primary reference file for the category. Verified intel was already loaded in Step 1d.

For multi-category questions, read all relevant files.

## Step 4: Synthesize Answer

### Universal Response Structure

Every response should follow this structure:

1. **One-line answer** -- direct, no preamble
2. **Key details** -- tables, steps, bullets as appropriate
3. **Configuration** -- code snippets, copy-paste ready agent definitions or hook configs
4. **Examples** -- concrete, working implementations the user can adapt
5. **Gotchas** -- bold warnings for common pitfalls
6. **Sources** -- reference files cited

### For Builder/Validator Questions

1. State the pattern and why 2x compute improves trust
2. Show complete Builder and Validator agent definitions
3. Include hook configuration for the user's stack (TypeScript or Python)
4. Explain the orchestration flow (Plan -> TaskCreate -> Build -> Validate -> Complete)
5. Note the most common mistake (validator with write access)

### For Hook Validation Questions

1. State the self-validation principle (hooks = deterministic, prompts = probabilistic)
2. Show the relevant hook configuration (PostToolUse for targeted, Stop for comprehensive)
3. Provide runner plugin examples for the user's stack
4. Include timeout strategy (PostToolUse: 30-40s, Stop: 60-120s)
5. Warn about Stop hook infinite loops (stop_hook_active guard)

### For Task Orchestration Questions

1. State the tool and its purpose
2. Show complete TaskCreate/TaskUpdate/TaskList usage
3. Include dependency chain setup with addBlockedBy
4. Explain session-scoped nature and hydration pattern for persistence
5. Warn about over-splitting (>10 active tasks = context depletion)

### For Meta-Prompt Questions

1. Explain what a meta-prompt is (prompt that generates structured output)
2. Show the plan format template with all required sections
3. Include team orchestration rules (lead never codes)
4. Show Stop hook validation for plan structure
5. Explain how to adapt for the user's project

### For Sub-Agent Questions

1. Clarify the #1 misconception (system prompt, not user prompt)
2. Show information flow diagram (User -> Primary -> Sub-Agent -> Primary)
3. Provide complete agent definition with frontmatter
4. Include foreground vs background guidance
5. Warn that subagents cannot spawn subagents

### For Agent Teams Questions

1. State that Agent Teams is experimental (shipped Jan 2026)
2. Compare with DIY sub-agents (when to use each)
3. Show available coordination primitives
4. Include the MULTI_AGENT_PLAN.md communication pattern
5. Warn about cost (each teammate = full Claude instance) and limitations

### For Pattern Selection Questions

1. Show the 6-pattern comparison table
2. Walk through the decision matrix for the user's scenario
3. Recommend a specific pattern with reasoning
4. Note pattern combinations (e.g., Leader/Swarm + Builder/Validator per worker)
5. Include cost-benefit analysis and anti-patterns to avoid

## Response Guidelines

- **Always cite the reference file** you're drawing from
- **Provide complete configs** -- users should be able to copy/paste agent definitions, hook configs, task setups
- **Include agent definitions** -- full frontmatter + system prompt, ready to save as .md files
- **Warn about pitfalls** -- especially session-scoped tasks, context drift, cost multipliers, file conflicts
- **Include verified intel** -- if verified-intel.md has relevant accepted findings, mention them
- **Be direct** -- answer the question first, then provide context
- **Tables for comparisons** -- use tables when comparing patterns, agent types, or tool choices
- **Code blocks** -- show exact TypeScript and JSON for all configurations
- **Attribution** -- when referencing IndyDevDan's patterns, credit the source
- **Cache age footer** -- if CACHE_AGE_NOTE is set, include it as an italicized footer

## Examples

### Example 1: Builder/Validator Setup

```text
User: How do I set up Builder/Validator in my TypeScript project?

Skill: [Reads builder-validator.md]

Builder/Validator uses 2x compute to get trustworthy results: one agent builds, another validates read-only.

**Builder agent** (.claude/agents/team/builder.md):
[Shows complete agent definition with biome/tsc PostToolUse hooks]

**Validator agent** (.claude/agents/team/validator.md):
[Shows complete read-only agent definition with disallowedTools]

**Orchestration flow:**
1. Create plan with TaskCreate for each step
2. Set dependencies with addBlockedBy
3. Deploy Builder with Task tool
4. Deploy Validator after Builder completes
5. Mark complete or iterate on failures

**Gotcha:** The validator MUST have `disallowedTools: Write, Edit, NotebookEdit`.
If it can modify files, it's just another builder with extra steps.
```

### Example 2: Which Pattern to Use

```text
User: I have a feature that touches the API, frontend, and database. Which orchestration pattern?

Skill: [Reads patterns-taxonomy.md + builder-validator.md]

Use **Leader/Swarm + Builder/Validator** for cross-layer features:

1. Leader coordinates 3 Builders (API, frontend, DB) working in parallel
2. Each Builder has its own file boundaries (no overlapping files)
3. After all Builders complete, deploy Validators per layer
4. Leader synthesizes validation reports

[Shows decision matrix excerpt]
[Shows task dependency setup]

**Key rule:** Assign distinct files per agent. Two agents editing
the same file = merge conflicts and lost work.

If you have Claude Code's Agent Teams enabled, consider using native
teammates instead -- they share a task list and can communicate directly.
See agent-teams.md for the migration path.
```

### Example 3: Task Persistence Across Sessions

```text
User: My tasks disappear when I restart Claude. How do I persist them?

Skill: [Reads task-orchestration.md]

Tasks are session-scoped -- this is the #1 misconception.
Use the **hydration pattern** for persistence:

1. Write your plan to a markdown file (e.g., specs/my-feature.md)
2. Include task definitions with IDs, dependencies, and acceptance criteria
3. On session start, read the spec and hydrate via TaskCreate
4. During work, mark tasks complete with TaskUpdate
5. On session end, sync status back to the spec file

[Shows complete hydration workflow]

**For multi-instance coordination:** Set CLAUDE_CODE_TASK_LIST_ID
environment variable so multiple Claude instances share the same task list.

*Community intel last updated 2 days ago.*
```

### Example 4: Upgrade Mode

```text
User: /agentic-orchestration --upgrade

Skill: [Detects --upgrade flag, delegates to community intel workflow]
Skill: [Runs extract command, gets 3 new findings]
Skill: [Auto-accepts findings, appends to verified-intel.md, records hashes]
Skill: "Auto-accepted 3 new findings across 4 topics."
```
