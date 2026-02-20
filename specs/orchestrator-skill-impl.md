# Plan: Autonomous Orchestrator Skill

## Task Description

Build a skill that acts as a long-running autonomous orchestrator for complex multi-file implementation tasks. It combines Builder/Validator with a DAG-based task framework, parallelises independent work via worktrees, escalates hard tasks to Codex, bounces human-in-the-loop (HITL) issues back to the user, and loops until all tasks are complete -- even if that takes hours.

## Objective

- User describes a feature or set of changes in natural language
- Orchestrator decomposes into a task DAG with dependencies
- Independent tasks run in parallel (worktrees for file isolation)
- Each task follows Builder -> Validator cycle
- Validator can optionally use agent-browser for token-efficient browser testing (82.5% reduction vs Playwright MCP)
- Hard/ambiguous tasks escalate to Codex CLI
- Code review issues (CodeRabbit, reviewer feedback) bounce back to the user for input
- Orchestrator continues autonomously until all tasks are PASS or explicitly blocked on user input
- Progress is visible via task list and optional claude-task-viewer Kanban

## Problem Statement

Today's orchestration patterns exist as separate building blocks (Builder/Validator, TaskCreate, worktrees, sub-agents) but there's no unified skill that wires them together into an autonomous loop. Users must manually coordinate task creation, dependency ordering, agent dispatch, and validation. For complex features touching 10+ files across multiple packages, this manual coordination becomes the bottleneck -- not the coding itself.

## Solution Approach

A single skill (`/orchestrate`) that implements a **Leader/Swarm + Builder/Validator** pattern with these layers:

```
User
  |
  v
Orchestrator (Leader) -- never writes code, only coordinates
  |
  +-- Planner phase:
  |     1. Clarify: 3-5 targeted questions via AskUserQuestion (skip if --yes)
  |     2. Explore codebase -> decompose -> DAG -> write spec file
  |     3. Refine: present spec path -> user edits/hardens -> re-read spec -> confirm
  |
  +-- Execution loop (per wave):
  |     |
  |     +-- Re-read spec file (living document, stays in context)
  |     |
  |     +-- Builder agents (parallel, one per task, worktree-isolated)
  |     |
  |     +-- Validator agents (sequential per task, read-only)
  |     |     +-- Code review (Biome, tsc, tests)
  |     |     +-- Optional: agent-browser assertions
  |     |
  |     +-- Codex escalation (for tasks marked "hard")
  |     |
  |     +-- HITL bounce-back (for tasks needing user input)
  |
  +-- Completion: all tasks PASS -> merge worktrees -> done
```

## Architecture

### 1. Task DAG Layer

Uses Claude Code's native `TaskCreate`/`TaskUpdate` with `addBlockedBy` for dependency chains.

```
TaskCreate({ subject: "Add auth middleware", ... })
TaskCreate({ subject: "Add auth tests", addBlockedBy: ["task-1"] })
TaskCreate({ subject: "Update API routes", addBlockedBy: ["task-1"] })
TaskCreate({ subject: "E2E browser tests", addBlockedBy: ["task-2", "task-3"] })
```

**Wave computation:** Tasks with no unresolved `blockedBy` form the current wave. All tasks in a wave execute in parallel.

**Task metadata fields:**

| Field | Purpose |
|-------|---------|
| `difficulty` | `easy` / `medium` / `hard` -- routes to Builder vs Codex |
| `files` | Explicit file boundaries per task (no overlap) |
| `worktree` | Worktree name if parallel isolation needed |
| `validator` | `code-only` / `browser` / `both` |
| `status` | `pending` / `in_progress` / `building` / `validating` / `blocked_hitl` / `completed` / `failed` |

### 2. Builder Layer

Each Builder is a sub-agent with:
- **System prompt** from `.claude/agents/team/builder.md`
- **File boundaries** -- can only touch files listed in its task
- **PostToolUse hooks** -- Biome lint/format + tsc after every write
- **Worktree isolation** -- for parallel tasks, each Builder works in its own worktree

```typescript
// Dispatch pattern
Task({
  subagent_type: "enterprise:builder-scotty",
  prompt: `Implement: ${task.subject}\n\nFiles: ${task.files.join(", ")}\n\nAcceptance: ${task.description}`,
  run_in_background: true  // parallel execution
})
```

### 3. Validator Layer

Each Validator is a read-only sub-agent (`disallowedTools: Write, Edit, NotebookEdit`) that runs after its Builder completes:

**Code validation (always):**
- Biome lint check
- TypeScript type check
- Test execution (`bun test`)
- Structural review (conventions, patterns)

**Browser validation (when `validator: "browser"` or `"both"`):**

```bash
# agent-browser assertions -- 82.5% fewer tokens than Playwright MCP
npx agent-browser navigate http://localhost:3000
npx agent-browser get text @main-content
npx agent-browser eval "document.querySelectorAll('.error').length === 0"
npx agent-browser screenshot /tmp/validation-screenshot.png
```

Token efficiency (Pulumi benchmarks):
- Playwright MCP: 31,117 chars for 6 assertions
- agent-browser: 5,455 chars for same 6 assertions
- Per-click: 12,891 chars vs 6 chars

### 4. Codex Escalation Layer

Tasks marked `difficulty: "hard"` route to Codex CLI:

```bash
codex exec - \
  --cd "$(pwd)" \
  -o "/tmp/codex-output-${taskId}.md" \
  < /tmp/codex-prompt-${taskId}.md
```

**When to escalate:**
- Task requires deep reasoning across many files
- Builder failed validation twice
- Task involves complex refactoring or migration
- User explicitly marks a task as hard

**Return path:** Codex output is read back, applied by the orchestrator, then sent through normal Validator flow.

### 5. HITL Bounce-Back Layer

When a Validator returns FAIL with issues requiring human judgment:

```typescript
// Orchestrator marks task as blocked
TaskUpdate({ taskId, status: "blocked_hitl" })

// Presents issues to user
AskUserQuestion({
  questions: [{
    question: "CodeRabbit flagged: X. How should we proceed?",
    options: [
      { label: "Fix it", description: "Builder will address the feedback" },
      { label: "Ignore it", description: "Mark as accepted, continue" },
      { label: "Rethink approach", description: "I'll provide new direction" }
    ]
  }]
})

// After user responds, unblock and continue
TaskUpdate({ taskId, status: "pending" })
```

**Bounce-back triggers:**
- Validator finds ambiguous issues (not clear-cut PASS/FAIL)
- Code review feedback from CodeRabbit or human reviewer
- Architectural decisions the orchestrator can't make
- Builder failed 3 times on same task

### 6. Persistence Layer

Tasks are session-scoped but the spec file is the source of truth:

```
specs/<feature>-orchestrator.md  <-- Hydration source
  |
  v
TaskCreate (session start)  <-- Hydrate from spec
  |
  v
TaskUpdate (during work)    <-- Track progress
  |
  v
Spec file updated           <-- Persist on completion/pause
```

**Cross-session resume:** On restart, orchestrator reads the spec, identifies incomplete tasks, re-hydrates the DAG, and continues from where it left off.

## Relevant Files

### Existing (read, not modified)
- `plugins/agentic-orchestration/skills/agentic-orchestration/SKILL.md` -- current knowledge bank skill
- `plugins/agentic-orchestration/skills/agentic-orchestration/references/builder-validator.md` -- B/V pattern
- `plugins/agentic-orchestration/skills/agentic-orchestration/references/task-orchestration.md` -- TaskCreate patterns
- `plugins/agentic-orchestration/skills/agentic-orchestration/references/sub-agents.md` -- sub-agent architecture
- `plugins/agentic-orchestration/skills/agentic-orchestration/references/patterns-taxonomy.md` -- pattern decision matrix
- `plugins/git/skills/git-expert/WORKTREE.md` -- worktree management

### New Files

```
plugins/agentic-orchestration/
├── commands/
│   └── orchestrate.md              # User-facing command
├── skills/
│   └── orchestrator/
│       ├── SKILL.md                # Orchestrator skill definition
│       └── references/
│           ├── dag-execution.md    # Wave computation, dependency resolution
│           ├── codex-escalation.md # Codex CLI integration patterns
│           ├── browser-validation.md # agent-browser integration
│           └── hitl-protocol.md    # Human-in-the-loop bounce-back rules
└── agents/                         # Agent definition files
    ├── orchestrator-lead.md        # Leader agent (never codes)
    ├── builder.md                  # Builder agent template
    └── validator.md                # Validator agent template
```

## Implementation Phases

### Phase 1: DAG Engine + Basic Loop

**Goal:** Orchestrator can decompose a task description into a DAG and execute sequentially with Builder/Validator.

1. Create `orchestrate.md` command -- accepts natural language task description
2. Create `SKILL.md` for orchestrator -- step-by-step instructions for decomposition
3. Implement wave computation logic in SKILL.md instructions (topological sort on `addBlockedBy`)
4. Create Builder agent definition with PostToolUse hooks
5. Create Validator agent definition (read-only, code checks only)
6. Basic loop: plan -> wave -> build -> validate -> next wave -> done
7. **Clarifying questions (pre-decomposition):** At the start of the Opus planning phase, before codebase exploration or decomposition, ask 3-5 targeted questions about ambiguous requirements using AskUserQuestion. Resolve ambiguity before the expensive reasoning begins -- a wrong assumption here amplifies through every downstream task. The /interview pattern (1,118 likes, @jarrodwatts) shows that structured questioning before planning produces "bulletproof specs." Skip if `--yes` flag is set or requirements are unambiguous.
8. **Iterative plan refinement:** After decomposition, present the spec file path and let the user edit it directly before confirming execution. Flow: decompose -> write spec -> present spec path + summary -> user can edit/harden spec (optionally via Codex or another model to add TS contracts, JSON schemas, exact file paths) -> orchestrator re-reads spec -> confirm -> execute. Spec file format must be simple markdown -- no magic syntax -- so external tools can edit without breaking the parser. Addresses the #1 community complaint about plan mode: "I want 'here's the plan, let's iterate on it'" (u/NatteringNabob69, r/ClaudeCode)
9. **Spec file as living document:** Re-read the spec file at the start of each wave (not just at session resume). The "Planning with files" skill (1,937 likes, @anthonyriera) beats native plan mode because Claude returns to planning files throughout execution. This keeps the plan in context and allows mid-execution adjustments.
10. **Fast path gate:** After decomposition, if the result is <=2 tasks with no dependencies, the orchestrator exits early with a message: "This task is simple enough to handle directly -- no orchestration needed." Then either: (a) hand off to a single Builder/Validator cycle (no DAG, no waves, no spec file), or (b) suggest the user just runs `/enterprise:engage` instead. This is an explicit quality gate -- orchestration adds value for complex multi-file work, not for quick wins. Avoids the over-engineering trap the community warns about (orq.ai, r/ClaudeAI 18-agent thread).
11. **Token cost estimation:** Display estimated token cost in decomposition summary before user confirmation
12. **Idempotent Builders:** Builder steps must be re-runnable without corrupting prior work (per Temporal/Dagster patterns)

**Verification:** Single feature request decomposes into 3+ tasks, executes in order, passes validation. Simple request (1-2 tasks) takes the fast path. Clarifying questions fire for ambiguous requests. User can edit spec file before confirming execution.

### Phase 2: Parallel Execution + Worktrees

**Goal:** Independent tasks within a wave run in parallel using worktrees.

1. Integrate `git worktree` commands for parallel isolation
2. Add `run_in_background: true` to Builder dispatch
3. Implement worktree merge strategy (merge back to feature branch after validation)
4. Add file boundary enforcement (no two tasks in same wave touch same files)
5. Handle merge conflicts gracefully (escalate to HITL if conflicts arise)
6. **Evaluate `claude -p` subprocess vs Task tool:** Community reports hooks are global (no `is_subagent` field in hook JSON). `claude -p` subprocess spawning gives more predictable control flow for parallel execution. Evaluate both approaches. (Source: r/ClaudeAI orchestrator builder, Jan 9)
7. **TeammateTool readiness:** Design Task-tool dispatching layer as replaceable. Anthropic's `TeammateTool` (13-op multi-agent system) is feature-flagged in the binary and may ship publicly. (Source: paddo.dev reverse engineering)
8. **Async coordination:** Prefer message-passing (TaskUpdate metadata) over shared filesystem state for inter-task coordination. At scale (33+ agents), async message bus beats shared files. (Source: @gizinaiteam)

**Verification:** 3 independent tasks run in 3 worktrees simultaneously, merge cleanly.

### Phase 3: agent-browser Validation

**Goal:** Validator can run browser assertions using agent-browser for UI-facing tasks.

1. Create `browser-validation.md` reference with assertion patterns
2. Add `validator: "browser"` metadata to task schema
3. Validator agent definition gets `allowed-tools: Bash(npx agent-browser:*)`
4. Implement Ralph Wiggum Loop: build -> deploy locally -> browser assert -> loop
5. Screenshot capture for validation evidence

**Verification:** Builder creates a Vue component, Validator uses agent-browser to verify it renders correctly.

### Phase 4: Codex Escalation

**Goal:** Hard tasks route to Codex CLI and return results to the orchestration loop.

1. Create `codex-escalation.md` reference with prompt templates
2. Implement difficulty assessment heuristic (file count, cross-package, refactoring signals)
3. Codex prompt generation from task context
4. Output parsing and application
5. Normal validation flow after Codex output is applied

**Verification:** A deliberately hard task (cross-package refactor) routes to Codex, returns, passes validation.

### Phase 5: HITL Bounce-Back + Persistence

**Goal:** Orchestrator can pause for human input and resume across sessions.

1. Create `hitl-protocol.md` reference with trigger rules
2. Implement `blocked_hitl` status with `AskUserQuestion` integration
3. Spec file persistence -- write progress back to markdown on pause/completion
4. Hydration on resume -- read spec, reconstruct DAG, continue
5. Session timeout handling (auto-checkpoint before context limit)

**Verification:** Orchestrator hits ambiguous issue, asks user, receives answer, continues. Session restarts and picks up where it left off.

## Team Orchestration

This spec itself should be implemented using the Builder/Validator pattern:

| Phase | Agent | Model | Role |
|-------|-------|-------|------|
| All | Lead (you) | Opus | Coordinate, never code |
| 1-5 | Builder | Sonnet | Write skill files, agent defs, commands |
| 1-5 | Validator | Sonnet | Review each phase output (read-only) |

### Task Dependency Chain

```
[Phase 1: DAG Engine]
  |
  +-- [Phase 2: Parallel/Worktrees] (blocked by Phase 1)
  |
  +-- [Phase 3: Browser Validation] (blocked by Phase 1)
  |
  +-- [Phase 4: Codex Escalation] (blocked by Phase 1)
  |
  +-- [Phase 5: HITL + Persistence] (blocked by Phase 1)
```

Phases 2-4 can run in parallel after Phase 1. Phase 5 depends only on Phase 1.

## Key Design Decisions

### Why CLI-first for agent-browser (not MCP)?

agent-browser has no MCP server. The CLI interface is intentionally minimal:
- `npx agent-browser navigate <url>`
- `npx agent-browser click @e1`
- `npx agent-browser get text @e1`

This maps cleanly to `Bash` tool calls. No schema negotiation overhead. The Vizzly team's research confirms: CLI with `--json` output beats MCP for token efficiency in agent workflows.

### Why Codex for hard tasks (not more sub-agents)?

Sub-agents can't spawn sub-agents. For tasks requiring deep multi-file reasoning, Codex operates as a separate process with its own full context window. The orchestrator treats it as a "black box" -- prompt in, code out, validate normally.

### Why worktrees (not sequential)?

Sequential execution of independent tasks is wasted time. Worktrees provide git-native isolation without branches. Each Builder gets a clean working directory. Merge conflicts are caught at merge time and escalated to HITL.

### Why session-scoped tasks + spec file persistence (not Beads)?

Beads (`.beads/beads.jsonl`) solves cross-session memory but adds a dependency. The hydration pattern -- spec file as source of truth, TaskCreate to populate session -- works with zero new dependencies and matches existing patterns in the codebase.

### Why a fast path gate for simple decompositions?

Google Research's 180-configuration study shows -70% performance on sequential tasks when forced through parallel/DAG machinery. The community (orq.ai, r/ClaudeAI 18-agent thread) is explicitly skeptical of over-engineered multi-agent systems. If decomposition produces <=2 tasks with no dependencies, orchestration adds coordination overhead without benefit. The gate catches this early and redirects -- either to a single Builder/Validator cycle or to `/enterprise:engage` which already handles sequential plan execution well. The orchestrator's value proposition is complex multi-file work with dependencies; using it for quick wins is like driving a semi to the corner shop.

### Why idempotent Builder steps?

All three production orchestration frameworks (Temporal, Dagster, LangGraph) share one cross-cutting requirement: idempotent activities. If a Builder fails mid-execution and is retried, it must not duplicate code or create inconsistent state. This means Builders should check existing state before writing -- read target files first, apply changes relative to current state, not from a blank slate.

### Why no retry on Builder timeout?

The Maxim reliability study identifies retry loop ambiguity as a top-3 failure mode: timeout causes retry of an already-completed operation, leading to state corruption (double-writes, duplicate code). Our 300s Builder timeout with no-retry-on-timeout prevents this. If a Builder times out, the orchestrator reads target files to assess whether work was partially/fully completed, then decides: mark complete, dispatch fresh Builder, or escalate to user.

### Why clarifying questions before decomposition?

The /interview pattern (1,118 likes, @jarrodwatts) demonstrates that 20-50 clarifying questions before planning produces "bulletproof specs." Our version is lighter -- 3-5 targeted questions via AskUserQuestion -- but the principle is the same: ambiguity in requirements amplifies through the DAG. A wrong assumption in decomposition means every downstream task inherits the error. Critically, these questions happen at the very start of the Opus planning phase -- before codebase exploration or decomposition -- so the expensive reasoning runs on clarified requirements, not guesses. Skipped with `--yes` for scripted/automated usage.

### Why iterative plan refinement (not just confirm/reject)?

The #1 community complaint about Claude Code plan mode is "I want 'here's the plan, let's iterate on it'" -- not a binary yes/no gate (u/NatteringNabob69, r/ClaudeCode, 43 comments). @boristane's viral post (793 likes) argues for a persistent doc workflow where the user can annotate and revise. Our flow writes the spec file first, presents its path, and lets the user edit it directly in their editor before the orchestrator re-reads and confirms. The spec file is the collaboration surface -- not a prompt buried in context.

**The Codex-as-spec-hardener pattern:** A proven refinement loop is to run the decomposed spec through a second model (e.g., Codex CLI with GPT-5.2 xHigh) before execution. In practice, this adds concrete references that the decomposition pass misses -- TypeScript contract paths, JSON schema definitions, exact file locations, interface signatures, and tighter acceptance criteria. The first pass (Opus decomposition) captures intent and architecture; the second pass (Codex or another model) hardens the spec with implementation-level precision. This is the hybrid workflow the community converges on (@TheAhmadOsman, 1,146 likes; @venkat_systems; @shanraisshan), applied to the spec artifact itself rather than just the code.

**Refinement flow:**
1. Orchestrator decomposes (Opus) -> writes `specs/<name>-orchestrator.md`
2. User reviews -- optionally runs spec through Codex or another tool for hardening
3. User edits spec directly (add TS contracts, tighten criteria, add schema refs)
4. Orchestrator re-reads spec -> presents diff summary -> confirm -> execute

The spec file format must be stable enough that external tools can edit it without breaking the orchestrator's parser. This means: simple markdown structure, clear section headers, no magic syntax.

### Why re-read the spec file at each wave?

The "Planning with files" skill (1,937 likes, @anthonyriera) outperforms native plan mode because Claude returns to the planning files throughout the entire process -- not just at the start. Context compaction can evict the original plan from memory mid-execution. Re-reading the spec at each wave boundary ensures the orchestrator stays aligned with the plan even in long-running sessions. It also picks up any mid-execution edits the user makes to the spec file (e.g., reprioritizing tasks, adjusting acceptance criteria).

### Design Consideration: Higher-Order Prompt (HOP) Architecture

**Status:** Not locked in. Brainstorming. Design consideration for Phase 1 implementation.

**The concern:** The current plan hardcodes `enterprise:builder-scotty` and `enterprise:validator-mccoy`. If we build it this way, we'll have to untie it later when the Newsroom or Dojo want to use the same orchestration engine with their own agents.

**The HOP pattern:** IndyDevDan's [4-layer agentic architecture](https://www.youtube.com/watch?v=efctPj6bjCY) ([VSCode snippets](https://gist.github.com/disler/d9f1285892b9faf573a0699aad70658f)) introduces the concept of a Higher-Order Prompt -- a prompt that takes another prompt as a parameter, like a higher-order function in programming. The fixed wrapper contains consistent orchestration logic; the variable inner prompt contains the specific agents and domain voice. Three independent sources have formalized this pattern:

1. **IndyDevDan** -- coined "HOP," demonstrated with browser automation wrapper taking `$1` as an inner prompt
2. **[Medium/Data Science Collective](https://medium.com/data-science-collective/deep-agents-and-high-order-prompts-hops-the-next-substrate-of-ai-reasoning-562c19aa25f6)** -- independently formalized: "don't tell the model what to produce -- tell it how to reason, reflect, and decide"
3. **[LangChain JS `deepagents`](https://x.com/LangChain_JS/status/2018346035240923577)** (565 likes) -- "4 architectural patterns that kept showing up" across Claude Code and Manus

**Applied to the orchestrator:**

The HOP wrapper (fixed):
- DAG engine, wave computation, retry logic
- Spec file persistence, iterative refinement
- Clarifying questions, fast path gate
- Token cost estimation, summary reporting

The inner parameters (variable):
- Which builder agent to dispatch (`enterprise:builder-scotty`, `newsroom:beat-reporter`, etc.)
- Which validator agent to dispatch (`enterprise:validator-mccoy`, `newsroom:editor-desk`, etc.)
- Domain voice/persona (Star Trek, 1920s newsroom, Miyagi dojo)
- Domain-specific acceptance criteria patterns

**Possible interface:**

```
# Explicit team flag
/agentic-orchestration:orchestrate "add JWT auth" --team enterprise
/agentic-orchestration:orchestrate "investigate competitor pricing" --team newsroom

# Or inferred from context / codebase
/agentic-orchestration:orchestrate "add JWT auth"  # auto-detects enterprise agents available
```

**The closest live implementation** is [skill-compose](https://github.com/MooseGoose0701/skill-compose) ([@tom_doerr](https://x.com/tom_doerr/status/2023784067284562270), 159 likes) which builds agents from composable skills-as-first-class-artifacts rather than workflow graphs.

**What this means for Phase 1:** The SKILL.md should parameterize agent references rather than hardcoding enterprise agents. This could be as simple as variables at the top of the skill (`BUILDER_AGENT`, `VALIDATOR_AGENT`) that default to enterprise but can be overridden. The DAG engine doesn't care who builds and validates -- it just needs a builder and a validator.

**IndyDevDan's 4-layer stack (for reference):**

| Layer | Purpose | Our Equivalent |
|-------|---------|---------------|
| 1. Skills | Raw capability | `skills/orchestrator/SKILL.md` + references |
| 2. Sub-agents | Scale + specialization | `enterprise:builder-scotty`, `enterprise:validator-mccoy` (parameterized) |
| 3. Commands | Orchestration | `commands/orchestrate.md` |
| 4. Just file | Reusability | Plugin registration in `plugin.json` |

**Community validation:** [@ericzakariasson](https://x.com/ericzakariasson/status/2011751971284570133) (241 likes) independently documented the same taxonomy. [@y_matsuwitter](https://x.com/y_matsuwitter/) (442 likes) arrived at "MCP = external API, Skills = libraries, Sub-Agents = microservices" in Japanese without referencing IndyDevDan. The mental model is converging organically across the community.

**Three problems to watch for** (from community composability research):
1. **Trust/security scoping** -- "What matters isn't what skills they have -- it's what they're scoped to access" ([r/clawdbot](https://www.reddit.com/r/clawdbot/comments/1r7zokg/), 11 pts)
2. **Context collision** -- Skills must use progressive disclosure (~98% token savings per [codewithseb.com](https://www.codewithseb.com/blog/claude-code-skills-reusable-ai-workflows-guide)), not dump everything into system prompt
3. **Registry fragmentation** -- Multiple skill registries emerging with no convergence. Our plugin architecture avoids this by keeping skills co-located with their domain plugin.

## Open Questions

1. **Max parallel worktrees?** -- Need to benchmark. 3-5 seems safe for most machines.
2. **Codex timeout?** -- Complex tasks may take 5+ minutes. Need a reasonable timeout with progress polling.
3. **Browser validation port management?** -- Multiple parallel validators may need different ports for local dev servers.
4. **Cost guardrails?** -- Multi-hour autonomous runs could be expensive. Should there be a token/cost budget with user confirmation at thresholds?
5. **Agent-browser on M4 Pro?** -- darwin-arm64 issue was fixed in v0.9.1 but should be verified before relying on it for validation.
6. **TeammateTool overlap?** -- Anthropic's feature-flagged `TeammateTool` (13-operation multi-agent system found in Claude Code binary, Feb 2026) may ship officially and overlap with our Task-tool dispatching layer. Design for replaceability at that layer. (Source: paddo.dev reverse engineering)
7. **HOP architecture for Phase 1?** -- Should the orchestrator SKILL.md parameterize builder/validator agents from day one (agent-agnostic HOP), or hardcode enterprise agents and refactor later? Parameterizing upfront is more work but avoids untying later. The community has validated the pattern but no dominant implementation exists yet for orchestration-level HOPs.

---

## Community Due Diligence (Feb 2026)

Research conducted across Reddit (r/ClaudeAI, r/ClaudeCode, r/AI_Agents), X, and technical blogs/papers. 6 Reddit threads (up to 1,087 pts), 24 X posts, and 13 web sources analyzed.

### What the Community Validates

**1. Builder/Validator is the consensus pattern.**
Multiple frameworks (CrewAI, LangGraph, AutoGen) and community implementations all converge on "one agent writes, another reviews." The enterprise:builder-scotty / enterprise:validator-mccoy split is textbook correct. The 3-agent Planner/Executor/Critic pattern (r/AI_Agents, Feb 18) is the most common community variant. PubNub best practices guide recommends keeping subagent task scope narrow to avoid context overflow.

**2. 3 retries is the empirically correct ceiling.**
The Maxim reliability study and MAST failure taxonomy (1,600+ annotated traces across 7 frameworks) both identify explicit retry thresholds as the #1 fix for multi-agent failures. Our 3 retries + ask-user-on-4th matches production systems. Performance saturation in multi-agent loops plateaus around 4 agents -- adding more past that point produces diminishing or negative returns.

**3. Dynamic wave recomputation > pre-computed waves.**
Kinde/Temporal research and adaptive coordination papers both favor runtime recomputation. "Recompute after each wave" handles failures gracefully -- the right call vs pre-computing the full schedule upfront.

**4. 3-8 tasks is the sweet spot.**
Google Research's 180-configuration study (770 likes, @GoogleResearch Jan 28) found performance saturates around 4 agents. Our 3-8 range keeps things productive without coordination overhead. Key finding: +81% on parallelizable tasks, -70% on sequential ones. Architecture-task alignment matters more than agent count.

**5. Leader never writes code -- validated.**
The community's "orchestrator spawns disposable subagents" pattern (@joshuaday) matches our Task-tool-only leader. Clean separation is the consensus approach.

**6. Sequential execution in Phase 1 is correct sequencing.**
Google Research's -70% finding on sequential tasks confirms: get the decomposition + loop right first, parallelize in Phase 2.

### Community-Identified Risks

**Risk 1: Hook Globality (Phase 2+ Blocker)**
Hooks are global -- when the orchestrator sets a hook, it fires for Builder subagents too. No `is_subagent` field in hook JSON. Documented by r/ClaudeAI orchestrator builder (Jan 9, 25 comments). Community workaround: use `claude -p` subprocess spawning instead of in-agent Task dispatching for more control. **Action:** Note in Phase 2 planning. Evaluate `claude -p` subprocess vs `run_in_background: true` Task dispatching.

**Risk 2: Retry Loop Ambiguity (State Corruption)**
Most dangerous retry failure mode: timeout causes retry of an already-completed operation. Builder has 300s timeout -- if it times out but the Task tool actually completed the work, a naive retry re-dispatches a Builder that may double-write. **Action:** Before retrying, check if the Builder's file changes already landed (read the target files). The "no retry on timeout" rule in dag-execution.md must explain *why* -- preventing state corruption from double-execution.

**Risk 3: Context Depletion is the Real Cost**
Steve Yegge reportedly runs 3 concurrent Claude Max accounts to sustain Gas Town's pace (shipyard.build). The dominant pain point isn't capability -- it's token burn. Each Builder dispatch + Validator dispatch consumes significant context. With 8 tasks x (Builder + Validator) = 16 agent dispatches minimum, plus retries. **Action:** Add a token estimate to the decomposition summary so users see the cost before confirming. Using subagents (separate context windows) already mitigates the main-context depletion.

**Risk 4: Skill Invocation Reliability (Phase 1.5)**
Skill selection is entirely LLM-driven from text description matching -- no algorithmic fallback (Lee Han Chung deep dive, leehanchung.github.io). Vague descriptions cause matching failures. **Action:** Make `use-when` descriptions in injectable skills extremely specific and action-oriented. Test matching reliability before relying on it.

**Risk 5: Over-Engineering Warning**
The community is explicitly skeptical of multi-agent systems that solve problems a single well-prompted agent could handle. The 18-agent thread (r/ClaudeAI, 133 pts, 95 comments) was dismissed as "overengineered solution in search of a problem." orq.ai failure analysis calls out teams building DAG orchestration for tasks a single agent would complete faster. **Action:** Add a fast path -- if decomposition produces 1-2 tasks with no dependencies, skip the DAG machinery and run directly.

### Recommendations Adopted

**R1: Fast Path for Simple Tasks**
If decomposition produces <=2 tasks with no dependencies, skip wave/DAG overhead and run sequentially. Avoids the over-engineering trap for small requests. Added to SKILL.md Step 1 as an early exit.

**R2: Idempotent Builder Steps**
All three production orchestration frameworks (Temporal, Dagster, LangGraph) share one pattern: idempotent activities. If a wave step fails, re-running it must not corrupt prior work. Builders must be idempotent -- re-running on the same files should produce the same result, not duplicate code. Added to dag-execution.md reference.

**R3: Token Cost Estimation**
Add estimated token cost to the decomposition summary (displayed before user confirmation). Formula: `tasks * 2 (builder + validator) * avg_tokens_per_dispatch + retry_buffer`. Users can make informed go/no-go decisions.

**R4: TeammateTool Awareness (Phase 2+ Design)**
Anthropic's `TeammateTool` (13-operation multi-agent system) is feature-flagged in the Claude Code binary. Includes `~/.claude/teams/`, direct messaging between agents, broadcast operations, plan approval/rejection. Design the Task-tool dispatching layer as replaceable so it can swap to TeammateTool when it ships publicly.

**R5: Async Message Bus Pattern (Phase 2)**
At 33 agents, @gizinaiteam solved coordination with an async message bus, not shared files. For Phase 2 parallel execution, prefer message-passing (TaskUpdate metadata) over shared filesystem state for inter-task coordination.

### Community Patterns Worth Stealing

| Pattern | Source | Phase |
|---------|--------|-------|
| Async message bus over shared files | @gizinaiteam (33 agents) | Phase 2 |
| Progressive disclosure for skills | Lee Han Chung deep dive | Phase 1.5 |
| `claude -p` subprocess over Task tool | r/ClaudeAI orchestrator thread | Phase 2 alt |
| Token cost estimation before execution | shipyard.build | Phase 1 |
| Idempotent activities | Temporal/Dagster/LangGraph | Phase 1 |
| Disposable subagents pattern | @joshuaday | Phase 1 (already adopted) |
| Clarifying questions before planning | @jarrodwatts /interview (1,118 likes) | Phase 1 |
| Plan file as persistent living doc | @anthonyriera "Planning with files" (1,937 likes) | Phase 1 |
| Iterative plan refinement (not yes/no) | u/NatteringNabob69, @boristane (793 likes) | Phase 1 |
| Hybrid plan-then-execute across tools | @TheAhmadOsman (1,146 likes), 6 practitioners | Phase 4 (Codex) |

### Key Sources

**Reddit:**
- [Claude Code just spawned 3 AI agents...](https://www.reddit.com/r/AI_Agents/comments/1qydazj/) -- 1,087 pts, 221 comments
- [I built 18 autonomous agents...](https://www.reddit.com/r/ClaudeAI/comments/1qfu9pm/) -- 133 pts, 95 comments
- [Built a multi-agent orchestrator...](https://www.reddit.com/r/ClaudeAI/comments/1q8884m/) -- 13 pts, 25 comments
- [Multi agent orchestration](https://www.reddit.com/r/ClaudeCode/comments/1psh80y/) -- 76 pts, 58 comments

**X (high-engagement):**
- @GoogleResearch -- "More agents is better" is wrong. 180 configs, +81%/-70% (770 likes)
- @claudeai -- Official agent teams announcement (4,052 likes)
- @dani_avila7 -- 40K downloads across 3 Claude Code agents (1,443 likes)
- @LangChain -- 4 multi-agent patterns (352 likes)
- @Saboo_Shubham_ -- 8 agentic design patterns with Google ADK (399 likes)

**Research & Analysis (Multi-Agent Orchestration):**
- [Google Research: architecture-task alignment](https://x.com/GoogleResearch/status/2016621362480382213)
- [Maxim: Multi-Agent System Reliability](https://www.getmaxim.ai/articles/multi-agent-system-reliability-failure-patterns-root-causes-and-production-validation-strategies/)
- [MAST Failure Taxonomy: 41-86.7% failure rates across 7 frameworks](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/)
- [Kinde: Temporal/Dagster/LangGraph orchestration patterns](https://www.kinde.com/learn/ai-for-software-engineering/ai-devops/orchestrating-multi-step-agents-temporal-dagster-langgraph-patterns-for-long-running-work/)
- [paddo.dev: TeammateTool reverse engineering](https://paddo.dev/blog/claude-code-hidden-swarm/)
- [Lee Han Chung: Claude Skills deep dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [shipyard.build: Gas Town/Multiclaude comparison](https://shipyard.build/blog/claude-code-multi-agent/)
- [orq.ai: Why multi-agent systems fail](https://orq.ai/blog/why-do-multi-agent-llm-systems-fail)

**Research & Analysis (Plan Mode):**
- [Armin Ronacher: What Actually Is Claude Code's Plan Mode?](https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/) -- Plan mode is structured prompt injection, not a sandbox
- [OpenAI Codex Discussion #7355: Plan/Spec Mode](https://github.com/openai/codex/discussions/7355) -- Codex team citing Claude Code as gold standard
- [Mastering Claude Code Plan Mode](https://agiinprogress.substack.com/p/mastering-claude-code-plan-mode-the) -- Plan -> Spec File -> Execute as dominant pattern
- [Codex Plan Mode Complete Guide](https://smartscope.blog/en/generative-ai/chatgpt/codex-plan-mode-complete-guide/) -- Codex plan mode not runtime-enforced

**X (Plan Mode, high-engagement):**
- @anthonyriera -- "Planning with files" skill DESTROYED the rest (1,937 likes)
- @TheAhmadOsman -- Plan with Codex XHigh, implement with Opus (1,146 likes)
- @jarrodwatts -- /interview command: 20-50 questions = bulletproof specs (1,118 likes)
- @antoniosarosi -- Claude plans in 3 min vs Codex 26 min (996 likes)
- @boristane -- "plan mode sucks" -- persistent doc workflow instead (793 likes)
- @finbarrtimbers -- Claude Code's plan mode UX strictly superior to Codex (520 likes)

**Reddit (Plan Mode):**
- [Your opinion on plan mode](https://www.reddit.com/r/ClaudeCode/comments/1qr2mzw/) -- 3 pts, 43 comments (heavy engagement vs score)
