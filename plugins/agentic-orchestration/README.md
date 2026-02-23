# Agentic Orchestration

A Higher-Order Prompt (HOP) Orchestrator that decomposes complex prompts into task DAGs and dispatches Builder/Validator agent teams to execute them wave by wave. The orchestrator never writes code itself -- it coordinates agents through a 12-step dispatch protocol with clarifying questions, fast path optimization, plan refinement, token estimation, and retry with resume.

## Install

```bash
/plugin install agentic-orchestration@side-quest
```

## Usage

```bash
# Default engineering team (code implementation)
/orchestrate "add a REST API with GET /users, POST /users, and GET /users/:id"

# Research team (web research and synthesis)
/orchestrate "research top 5 TS testing frameworks" --team research

# Simple tasks use the fast path (skip DAG decomposition)
/orchestrate "add JSDoc to the greet function in src/hello.ts"
```

## How It Works

### Coordination Pattern

**Hierarchical dispatch** -- the orchestrator (opus) decomposes the user's prompt into a dependency-ordered task graph, then dispatches builder and validator agents for each task sequentially within waves.

```text
User prompt -> Orchestrator (opus) -> team profile -> spec file -> Builder (sonnet) -> Validator (haiku)
                                                      ^                    |
                                                      +--- retry (up to 3x, resume: agentId)
```

### Agent Roles

| Agent | Model | Tools | Responsibility |
|-------|-------|-------|---------------|
| Builder | claude-sonnet-4-5 | Read, Write, Edit, Bash, Glob, Grep | Implements code changes per task spec |
| Validator | claude-haiku-4-5 | Read, Bash, Glob, Grep | Verifies builder output against acceptance criteria (read-only) |
| Research Builder | claude-sonnet-4-5 | Read, Write, Edit, Bash, WebSearch, WebFetch | Researches and synthesizes information from web sources |
| Research Validator | claude-haiku-4-5 | Read, Bash, WebFetch | Verifies research coverage, citations, and source quality (read-only) |

### Compute Multiplier

Each task dispatches one builder (~3,000 tokens) and one validator (~1,500 tokens) for a base cost of ~4,500 tokens per task. Retries multiply this:

- No retries: 1x (base)
- 1 retry per task: 2x
- 3 retries per task (worst case): 4x

### Safety

- **Validator is structurally read-only** -- Write, Edit, and NotebookEdit are listed in `disallowedTools` in the validator agent definition. The runtime enforces this.
- **Builder writes only to specified files** -- the agent prompt constrains file boundaries; the validator catches violations.
- **Retry with resume** -- on failure, the builder is resumed (not restarted) so it retains context of what it already tried.
- **User escalation** -- after 3 failed retries, the orchestrator asks the user what to do (skip, guide, or abort).

## Observability

The orchestrator emits lifecycle events via `scripts/emit-event.ts`. Events are fire-and-forget -- if the observability server is not running, they fail silently and never block orchestration.

To enable observability, copy `scripts/emit-event.ts` to your project's `scripts/` directory and ensure `@side-quest/observability` is running.

## Requirements

- **Bun runtime** -- required for emit-event.ts (optional -- events are fire-and-forget)
- **Claude Code** -- the orchestrator dispatches agents via Claude Code's Task tool

## Limitations

- **Sequential wave execution** -- tasks within a wave run one at a time (parallel dispatch planned for a future release)
- **No persistent state** -- orchestration state lives in the spec file on disk; there is no external database or resume server
- **Fixed token estimates** -- token estimation uses per-dispatch assumptions, not actual API usage data
