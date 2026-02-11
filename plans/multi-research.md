# Plan: Parallel Multi-Topic Research Command

## Context

The `/last-30-days` skill uses `context: fork`, which runs it as a subagent. Subagents **cannot spawn other subagents** (Task tool unavailable inside). Nathan wants to run multiple research queries concurrently and get a cross-topic synthesis.

**Orchestration pattern:** Leader/Swarm -- one orchestrator (lead) deploys N research agents in parallel, collects results, synthesizes across topics.

## Docs-Verified Constraints

From Claude Code docs + claude-code-guide agents + fleet-sync ground truth:

| Claim | Status | Evidence |
|-------|--------|----------|
| Commands can use Task tool | **CONFIRMED** | `fleet-sync.md` uses `Task` in `allowed-tools`, no `context: fork`, works in production |
| MCP tools blocked in background agents | **CONFIRMED** | Docs: "MCP tools are not available in background subagents" |
| WebSearch blocked in background agents | **UNCERTAIN** | One guide agent says YES blocked, but docs only explicitly mention MCP. Needs smoke test. |
| AskUserQuestion fails in background | **CONFIRMED** | Docs: "tool call fails but the subagent continues" |
| Background agent output can be 0 bytes | **POSSIBLE** | GitHub issue #17011 reports this. Needs smoke test. |
| Foreground agents have all tools | **CONFIRMED** | Docs: "Permission prompts and clarifying questions are passed through to you" |

**Critical unknown: foreground vs background for research agents.**

Fleet-sync says "launch 3 Task agents in parallel" but does NOT specify `run_in_background: true`. Claude may run them foreground-sequentially within waves. If we MUST use foreground agents (because WebSearch is blocked in background), the "parallel" is actually wave-sequential but still faster than single-topic because each agent has isolated context.

## Architecture: Two Strategies

### Strategy A: Background agents (true parallel, CLI-only per agent)

```
Orchestrator
  +---> BG Agent 1: CLI only (no WebSearch)
  +---> BG Agent 2: CLI only (no WebSearch)
  v
Collect via TaskOutput
  v
Orchestrator does WebSearch supplement for ALL topics itself
  v
Cross-topic synthesis
```

**Pro:** True parallelism. **Con:** No WebSearch per agent -- orchestrator must supplement.

### Strategy B: Foreground agents in waves (sequential, full tools)

```
Orchestrator
  +---> FG Agent 1: CLI + WebSearch (blocks)
  +---> FG Agent 2: CLI + WebSearch (blocks)
  v
Cross-topic synthesis
```

**Pro:** Full tool access per agent. **Con:** Sequential, not parallel. Still faster than manual because each agent has focused context.

### Strategy C: Hybrid (smoke test determines)

If smoke test shows WebSearch works in background:
- Use Strategy A with WebSearch per agent (best of both worlds)

If WebSearch is blocked in background:
- Use Strategy A (background CLI-only) + orchestrator WebSearch supplement

**The command is written to support both strategies.** Smoke test in Phase 0 determines which path.

## Changes

### 1. New: `plans/` directory at repo root

Save finalized plan as `plans/multi-research.md`.

### 2. New: `plugins/research/commands/multi-research.md`

**Frontmatter:**

```yaml
---
name: multi-research
description: Research multiple topics in parallel and synthesize cross-topic patterns
argument-hint: '"topic 1" AND "topic 2" [AND "topic 3"] [--quick|--deep]'
allowed-tools: Bash(bunx *), Read, Glob, Grep, Task, AskUserQuestion, WebSearch, WebFetch
---
```

**No `context: fork`** -- runs inline, can use Task tool (proven by fleet-sync).

**Command body instructs Claude to:**

1. **Parse topics** -- split `$ARGUMENTS` on ` AND ` (case-insensitive), trim quotes/whitespace
2. **Extract flags** -- `--quick`, `--deep` passed through to each CLI invocation
3. **Guard: max 5 topics** -- warn if >5 (each topic = full agent context)
4. **Launch Task agents** -- one per topic, `subagent_type: "general-purpose"`
   - If background: `run_in_background: true`, CLI-only prompt
   - If foreground: sequential waves, CLI + WebSearch per agent
5. **Each agent's prompt** includes:
   - CLI: `bunx --bun @side-quest/last-30-days "<topic>" --emit=compact [--quick|--deep]`
   - WebSearch supplement (if foreground or if background supports it)
   - Structured output template
6. **Collect results** -- TaskOutput for background, direct return for foreground
7. **Orchestrator WebSearch** -- if agents ran background (no WebSearch), do 1-2 WebSearches per topic here
8. **Cross-topic synthesis** -- patterns, contradictions, unique insights
9. **Output unified report**

### 3. Modify: `plugins/research/.claude-plugin/plugin.json`

```json
"commands": ["./commands/last-30-days.md", "./commands/multi-research.md"]
```

### 4. No changes to existing files

- `skills/last-30-days/SKILL.md` -- unchanged
- `commands/last-30-days.md` -- unchanged
- CLI package -- unchanged

## Output Format

```
Researching N topics in parallel (N agents)...

---

## Topic 1: "Claude Code MCP servers"
[2-3 sentence synthesis from actual research]
- Reddit: {n} threads | {sum} upvotes
- X: {n} posts | {sum} likes
- Web: {n} pages
- Top voices: r/{sub}, @{handle}

## Topic 2: "Cursor vs Claude Code"
[2-3 sentence synthesis]
...

---

## Cross-Topic Patterns
- Pattern 1: ...
- Pattern 2: ...

## Unique to Each Topic
- Topic 1 only: ...
- Topic 2 only: ...

## Contradictions
- Topic 1 says X, but Topic 2 says Y
```

## Known Risks

1. **WebSearch in background agents** -- needs smoke test. Fallback: orchestrator supplements.
2. **Background agent output loss** -- GitHub #17011. Smoke test to verify. Agent prompts should explicitly tell agent to return structured output.
3. **Cost** -- N topics = N agents. 3 topics ~= 4x compute.

---

## Runtime Testing Plan

All tests in Claude Code CLI. Manual invocation, verify behavior.

### Phase 0: Smoke Tests (run BEFORE building anything)

| # | Test | How to run | Pass | Fail action |
|---|------|-----------|------|-------------|
| 0a | WebSearch in background agent | Launch Task with `run_in_background: true`, prompt: "Use WebSearch for 'Claude Code 2026'. Return top 3 results." Collect via TaskOutput. | Returns search results | Strategy A: CLI-only per agent, orchestrator supplements |
| 0b | Bash in background agent | Launch Task with `run_in_background: true`, prompt: "Run: `bunx --bun @side-quest/last-30-days 'test' --emit=compact --mock` and return the output." | Returns CLI mock output | Fundamental blocker -- escalate |
| 0c | Multiple background agents in parallel | Launch 3 Tasks with `run_in_background: true` in single message. Each does different WebSearch. | All 3 return results | Fall back to foreground sequential |
| 0d | Background agent output not empty | Check TaskOutput returns non-empty content for 0a/0b | Non-empty results | Use Write tool in agent prompt to persist to file, Read to collect |

### Phase 1: Command Parsing

| # | Test | Input | Pass |
|---|------|-------|------|
| 1a | No arguments | `/multi-research` | Shows usage/help |
| 1b | Single topic | `/multi-research "Claude Code MCP"` | Works as 1-agent research |
| 1c | Two topics | `/multi-research "MCP servers" AND "Cursor" --quick` | Parses 2 topics |
| 1d | Three topics | `/multi-research "a" AND "b" AND "c" --quick` | Parses 3 topics |
| 1e | Case-insensitive AND | `/multi-research "a" and "b"` | Parses correctly |
| 1f | Unquoted topics | `/multi-research best tools AND cursor` | Handles gracefully |
| 1g | Too many topics | 6+ topics with AND | Warns about cost |

### Phase 2: Agent Execution

| # | Test | What to verify | Pass |
|---|------|---------------|------|
| 2a | Agents launch | 2-topic run | Both agents start (check Task tool calls) |
| 2b | CLI runs per agent | Check agent output | Contains CLI research results |
| 2c | WebSearch per agent | Check agent output (if 0a passed) | Contains web supplement |
| 2d | Flags pass through | `--deep` flag | CLI invocations use the flag |

### Phase 3: Synthesis Quality

| # | Test | What to verify | Pass |
|---|------|---------------|------|
| 3a | Per-topic sections | 2-topic run completes | Output has sections for both topics with stats |
| 3b | Cross-topic patterns | Related topics (e.g., "Claude Code" AND "Cursor") | Shared themes identified |
| 3c | Unique findings | Same as 3b | Per-topic unique insights shown |
| 3d | Contradictions | Topics with opposing views | Contradictions section populated |

### Phase 4: Error Handling

| # | Test | How | Pass |
|---|------|-----|------|
| 4a | One agent fails | Nonsensical topic + real topic | Real topic returns results, failed shows graceful error |
| 4b | API rate limiting | Run when Reddit/X is rate-limited | Graceful degradation per agent |

### Phase 5: Regression

| # | Test | How | Pass |
|---|------|-----|------|
| 5a | Single-topic unchanged | `/last-30-days Claude Code --quick` | Same behavior as before |
| 5b | AI trends digest | Check plugin.json registration | Still registered and working |

### Test Execution Order

1. **Phase 0** -- smoke tests determine architecture strategy
2. Build the command (strategy determined by Phase 0 results)
3. **Phases 1-5** -- functional testing
