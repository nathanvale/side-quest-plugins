# Orchestration Patterns Taxonomy

Six proven patterns for multi-agent orchestration, a decision matrix for choosing, anti-patterns to avoid, and cost-benefit analysis.

**Source hierarchy:** Official docs (code.claude.com) > hooks-mastery (IndyDevDan) > Anthropic 2026 Trends > community experience.
**Last verified:** 2026-02-10.

---

## The Six Patterns

| Pattern | Agents | Communication | Best For |
|---------|--------|---------------|----------|
| **Builder/Validator** | 2 (build + verify) | Task system | Single features, code quality |
| **3 Amigo** | 3 (PM + UX + Code) | Progressive enrichment | Greenfield features, full-stack |
| **Leader/Swarm** | 1 lead + N workers | Task system + PLAN.md | Complex features, parallel work |
| **Pipeline** | N sequential stages | Output of stage N = input of N+1 | Data processing, multi-pass refinement |
| **Watchdog** | N workers + 1 monitor | Continuous validation | Long-running tasks, quality gates |
| **Agent Teams** | N native teammates | Shared task list + direct messaging | Cross-layer features, peer coordination |

### Builder/Validator

The foundational pattern. One agent builds, another validates read-only. See [builder-validator.md](builder-validator.md) for full details.

```
Lead -> TaskCreate -> Builder (writes code) -> Validator (reads only) -> Lead
```

**When to use:** Any task where the cost of bugs exceeds the cost of 2x compute. Production features, security-sensitive code, API changes.

### 3 Amigo

Three specialized agents progressively enrich context before coding begins (George Vetticaden):

```
PM Agent: requirements, user stories, acceptance criteria
    -> feeds into...
UX Designer Agent: wireframes, interaction flows, component specs
    -> feeds into...
Code Agent: implementation with full context from PM + UX
```

Each agent produces 7-8 structured artifacts that feed downstream. The Code Agent starts with rich context instead of bare requirements.

**When to use:** Greenfield features where requirements need refinement. Empty directory to working system in hours.

### Leader/Swarm

One lead agent coordinates multiple worker agents:

```
Lead (never codes)
  |-- Worker 1 (builder-api)     -> API files
  |-- Worker 2 (builder-ui)      -> Frontend files
  |-- Worker 3 (builder-db)      -> Database files
  |-- Validator (read-only)      -> Verifies all
```

The lead creates tasks, sets dependencies, deploys agents, and monitors progress. Workers operate independently on assigned files.

**When to use:** Features touching 3+ layers with clear file boundaries. The lead provides "single brain" coordination.

### Pipeline

Agents process work sequentially, each stage refining the output:

```
Stage 1: Analyze requirements    -> spec.md
Stage 2: Generate code           -> src/*.ts
Stage 3: Write tests             -> tests/*.test.ts
Stage 4: Review and polish       -> final src/*.ts
```

Each stage's output is the next stage's input. Unlike Leader/Swarm, stages don't run in parallel.

**When to use:** Multi-pass refinement, data processing, progressive code generation.

### Watchdog

A monitoring agent continuously validates while workers build:

```
Workers (building) ----> Watchdog (continuously monitoring)
                  <----  (reports issues via Task system)
```

The Watchdog runs on a loop: check outputs, flag regressions, verify invariants. Unlike Validator (which runs once after Builder), Watchdog runs continuously.

**When to use:** Long-running tasks, CI-like continuous validation, protecting against regression.

### Agent Teams (Native)

Claude Code's built-in team coordination. See [agent-teams.md](agent-teams.md) for full details.

```
Teammates coordinate via shared task list + direct messages
No primary bottleneck
Self-organizing work distribution
```

**When to use:** When you need peer-to-peer communication, or when DIY orchestration becomes too complex.

## Decision Matrix

### Step 1: Is Multi-Agent Needed?

```
Is the task < 3 steps?
  YES -> Do it directly. No orchestration needed.

Is the task well-defined and sequential?
  YES -> Single agent with Task system for tracking.

Does the task have independent parallel tracks?
  YES -> Continue to pattern selection.

Does the task need competing approaches?
  YES -> Agent Teams with parallel builders.
```

### Step 2: Choose a Pattern

```
How many layers does the feature touch?

1 layer:
  -> Builder/Validator (quality matters)
  -> Single agent (speed matters)

2-3 layers with clear file boundaries:
  -> Leader/Swarm (parallel workers)
  -> Agent Teams (if peer communication needed)

Full-stack greenfield:
  -> 3 Amigo (need requirements refinement)
  -> Leader/Swarm (requirements are clear)

Multi-pass refinement:
  -> Pipeline

Long-running with quality requirements:
  -> Watchdog + Builder/Validator per worker
```

### Step 3: DIY vs Agent Teams

```
Do agents need direct communication?
  NO -> DIY sub-agents (simpler, stable)
  YES -> Agent Teams (if available)

Is the feature long-running (>10 min)?
  NO -> DIY sub-agents
  YES -> Agent Teams (better autonomy)

Are you comfortable with experimental features?
  NO -> DIY sub-agents
  YES -> Agent Teams
```

## Pattern Combinations

Patterns compose. Common combinations:

| Combination | How It Works |
|-------------|-------------|
| **Leader/Swarm + Builder/Validator** | Each swarm worker is a Builder; Validator checks each worker's output |
| **Pipeline + Builder/Validator** | Each pipeline stage has a Builder and Validator pass |
| **3 Amigo + Leader/Swarm** | PM and UX refine requirements; Leader/Swarm implements |
| **Agent Teams + Watchdog** | Native teammates with a monitoring teammate |

## Core Principles

### Visibility Over Intelligence

Better specs > smarter model. A mediocre model with a detailed plan outperforms a powerful model with vague instructions. Invest 80% of effort in planning and review, 20% in execution.

### The 80/20 Rule

```
Planning and Review: 80% of effort
  - Requirements analysis
  - Spec writing
  - Task decomposition
  - Acceptance criteria
  - Code review

Execution: 20% of effort
  - Agent writes the code
  - Usually gets it right with good specs
```

### File Boundaries Are Non-Negotiable

**Assign distinct files per agent. Never have two agents editing the same file.**

This is the most common source of multi-agent failures. When two agents edit the same file:
- Edits may overwrite each other
- Merge conflicts that neither agent can resolve
- Inconsistent state that breaks the build

Enforce via MULTI_AGENT_PLAN.md file assignments or task descriptions.

### Context Isolation

Narrow scope per agent = better reasoning. LLMs degrade as context grows.

```
Bad:  One agent with 200K context doing PM + Design + Code + Testing
Good: Four agents with 50K context each, focused on one role
```

Each sub-agent starts with a fresh context. This is a feature, not a limitation -- it prevents context pollution and keeps reasoning sharp.

### The Compute Advantage Equation

From IndyDevDan: `(Compute Scaling x Autonomy) / (Time + Effort + Cost)`

Maximize numerator:
- Use Opus for complex reasoning (planning, validation)
- Use parallel agents for throughput
- Maximize autonomous execution windows

Minimize denominator:
- Better specs reduce iteration cycles
- Deterministic hooks reduce manual review
- Resume pattern reduces context rebuilding

### Spend Money to Save Time

Premium compute (Opus) yields superior ROI: `expensive model x fast x fewer iterations >> cheaper model x slow x more iterations`.

Opus for planning and validation. Sonnet for straightforward building tasks. Haiku for read-only research.

## Anthropic 2026 Trends Alignment

From the Agentic Coding Trends Report:

| Trend | Implication for Orchestration |
|-------|------------------------------|
| **Trend 1:** More code from AI agents | Orchestration becomes the primary human skill |
| **Trend 2:** Orchestration is THE skill gap | "Framework > Tool" -- knowing patterns matters more than knowing features |
| **Trend 3:** Collaboration Paradox | More agents require MORE human coordination, not less |
| **Trend 4:** Context management is critical | Narrow context per agent, hydration patterns, spec files |

### The Collaboration Paradox

Adding agents increases throughput but also increases coordination overhead. The sweet spot:
- 2-3 agents for most features
- 4-5 agents for large cross-layer work
- **9+ agents without governance = chaos**

Each additional agent must justify its coordination cost.

## Cost-Benefit Analysis

| Pattern | Cost Multiple | When Justified |
|---------|--------------|----------------|
| Single agent | 1x | Simple tasks, prototyping |
| Builder/Validator | 2x | Production features, quality-critical code |
| 3 Amigo | 3x | Greenfield features needing requirements refinement |
| Leader/Swarm (3 workers) | 4x | Cross-layer features with clear boundaries |
| Agent Teams (3 teammates) | 3x+ | Peer coordination, long-running tasks |

**The 2x compute trade-off:** Builder/Validator doubles compute but catches issues before they compound. A bug caught in validation costs 2x compute. A bug caught in production costs 10-100x in rework.

## Production Validation

Anthropic's engineering blog documents building a C compiler with Claude Code:
- **16 agents** coordinating across modules
- **2,000+ sessions** over the project
- **100,000+ lines** of generated code
- Agents specialized by compiler phase (lexer, parser, optimizer, codegen)
- File boundaries strictly enforced per phase

Key takeaway: orchestration scales to real production systems when patterns are followed rigorously.

## Anti-Patterns

### Over-Orchestrating Simple Tasks

**Symptom:** 3 agents for a config file change.
**Fix:** If < 3 steps, do it directly.

### Agents Doing Too Many Things

**Symptom:** One agent is PM + Designer + Builder + Tester.
**Fix:** One role per agent. Specialization beats generalization.

### Lead That Codes

**Symptom:** Lead agent writes code AND coordinates.
**Fix:** Lead ONLY uses Task* tools. Writing code = losing the orchestration thread.

### Missing Acceptance Criteria

**Symptom:** Validator doesn't know what to check. Reports "PASS" on broken code.
**Fix:** Every task must have specific, measurable acceptance criteria.

### Using Agent Teams When Task System Is Enough

**Symptom:** Paying 3x compute for work that a single agent with Task tracking could do.
**Fix:** Use the decision matrix. Agent Teams adds value only when peer communication is needed.

### Test Generation Death Spirals

**Symptom:** Agent generates tests, tests fail, agent generates more tests to fix, those fail...
**Fix:** Builder writes tests as part of implementation. Validator runs existing tests, doesn't generate new ones.

### Context Compaction Degradation

**Symptom:** After compaction, agent forgets files it read, decisions it made, plan context.
**Fix:** Write decisions to MULTI_AGENT_PLAN.md. Re-read the plan after long-running tasks. Use specs/ files as persistent memory.

### Task Pollution

**Symptom:** Shared task list ID used across repos. Tasks from project A appear in project B.
**Fix:** Use unique CLAUDE_CODE_TASK_LIST_ID per project.

### Vibe Coding

**Symptom:** Casual prompting without specs. "Build me an auth system."
**Fix:** Write a plan first. Use the /plan-with-team command. 80% planning, 20% execution.

### Context Starvation

**Symptom:** Minimal context "to save tokens." Agent hallucinates because it doesn't have enough information.
**Fix:** More context upfront = fewer iterations = lower total cost. Include file paths, acceptance criteria, examples.

### 10-20 Minute Autonomy Windows

Beyond ~20 minutes of autonomous work, agents tend to drift from the original requirements.

**Fix:** Human checkpoints. Check in after each major task. Re-read the spec. Course-correct early.

---

*Patterns synthesized from IndyDevDan's hooks-mastery, Anthropic 2026 Trends Report, community reports (sjramblings.io, medium/@george.vetticaden, alexop.dev), and Anthropic's engineering blog.*
