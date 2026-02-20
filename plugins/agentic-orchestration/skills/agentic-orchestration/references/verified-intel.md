# Verified Community Intel - Agentic Orchestration

Accepted community findings from research. Each entry was reviewed and confirmed relevant.

**Last updated:** 2026-02-20.
**Research scope:** Reddit (r/ClaudeAI, r/ClaudeCode, r/AI_Agents, r/clawdbot, r/aiengineering), X, technical blogs/papers. 13 Reddit threads, 57+ X posts, 31 web sources analyzed across three research sweeps.

---

## 1. Multi-Agent Orchestration Patterns

### 1a. Architecture-Task Alignment Matters More Than Agent Count

Google Research's 180-configuration study (Jan 2026, 770 likes on X) is the clearest empirical finding: DAG/parallel approaches deliver +81% gains on parallelizable tasks but -70% on tasks that are inherently sequential. "More agents is better" is wrong -- the topology of coordination matters more than the number of agents.

**Implication for orchestrator design:** The fast path gate (<=2 tasks, no dependencies = skip DAG) is empirically justified. Don't force sequential work through parallel machinery.

**Source:** [@GoogleResearch](https://x.com/GoogleResearch/status/2016621362480382213) (770 likes, 101 RTs)

### 1b. Builder/Validator is the Consensus Pattern

Multiple frameworks (CrewAI, LangGraph, AutoGen) and community implementations all converge on "one agent writes, another reviews." [DataCamp's framework comparison](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen) notes CrewAI and AutoGen represent different philosophical splits ("CrewAI for multi-role collaboration, AutoGen for iterative reasoning") but both implement the builder/validator concept. The [3-agent Planner/Executor/Critic variant](https://www.reddit.com/r/AI_Agents/comments/1r82abw/claude_code_as_an_agent_orchestrator_my_3agent/) (r/AI_Agents, Feb 18, 4 pts, 5 comments) is the most common community extension.

[PubNub best practices guide](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/) specifically recommends keeping subagent task scope narrow to avoid context overflow.

**Sources:**
- [CrewAI vs LangGraph vs AutoGen](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen) -- datacamp.com
- [Best practices for Claude Code subagents](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/) -- pubnub.com
- [Claude Code as an Agent Orchestrator: My 3-Agent Workflow Results](https://www.reddit.com/r/AI_Agents/comments/1r82abw/claude_code_as_an_agent_orchestrator_my_3agent/) -- r/AI_Agents (4 pts, 5 comments)

### 1c. 3 Retries is the Empirically Correct Ceiling

The [Maxim reliability study](https://www.getmaxim.ai/articles/multi-agent-system-reliability-failure-patterns-root-causes-and-production-validation-strategies/) and [MAST failure taxonomy](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/) (1,600+ annotated traces across 7 frameworks) both identify explicit retry thresholds as the #1 fix for multi-agent failures. 41-86.7% failure rate across state-of-the-art open-source MAS -- with the #1 fix being "explicit retry thresholds." Performance saturation in multi-agent loops plateaus around 4 agents.

**Danger: retry loop ambiguity.** The most dangerous failure mode: timeout causes retry of an already-completed operation. This leads to state corruption (double-writes, duplicate code). Mitigation: before retrying, check if the Builder's file changes already landed. On timeout, do not retry -- read target files to assess completion state.

**Sources:**
- [Multi-Agent System Reliability](https://www.getmaxim.ai/articles/multi-agent-system-reliability-failure-patterns-root-causes-and-production-validation-strategies/) -- getmaxim.ai
- [Why Your Multi-Agent System is Failing: 17x Error Trap](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/) -- towardsdatascience.com

### 1d. Dynamic Wave Recomputation > Pre-Computed Waves

[Kinde's Temporal/Dagster/LangGraph comparison](https://www.kinde.com/learn/ai-for-software-engineering/ai-devops/orchestrating-multi-step-agents-temporal-dagster-langgraph-patterns-for-long-running-work/) and [adaptive coordination research](https://x.com/omarsar0/status/2002760233656217751) favor runtime recomputation over pre-computed schedules. All three production orchestration frameworks (Temporal, Dagster, LangGraph) share one cross-cutting pattern: **idempotent activities**. If a wave step fails, it can be re-run from that node without corrupting prior waves.

**Implication:** Recompute waves after each wave completes (not upfront). Builder steps must be idempotent -- re-running on the same files should produce the same result, not duplicate code.

**Sources:**
- [Orchestrating Multi-Step Agents: Temporal/Dagster/LangGraph](https://www.kinde.com/learn/ai-for-software-engineering/ai-devops/orchestrating-multi-step-agents-temporal-dagster-langgraph-patterns-for-long-running-work/) -- kinde.com
- [@omarsar0](https://x.com/omarsar0/status/2002760233656217751) -- Adaptive coordination research (254 likes)

### 1e. Over-Engineering Warning

The community is explicitly skeptical of multi-agent systems that solve problems a single well-prompted agent could handle. The [18-agent thread](https://www.reddit.com/r/ClaudeAI/comments/1qfu9pm/) (r/ClaudeAI, 133 pts, 95 comments) was dismissed as "overengineered solution in search of a problem." [orq.ai's failure analysis](https://orq.ai/blog/why-do-multi-agent-llm-systems-fail) specifically calls out teams building DAG orchestration for tasks a single agent would complete faster.

**Implication:** Add a fast path gate. If decomposition produces <=2 tasks with no dependencies, redirect to a simpler pattern (single Builder/Validator or `/enterprise:engage`).

**Sources:**
- [I built 18 autonomous agents...](https://www.reddit.com/r/ClaudeAI/comments/1qfu9pm/) -- r/ClaudeAI (133 pts, 95 comments)
- [Why Multi-Agent LLM Systems Fail](https://orq.ai/blog/why-do-multi-agent-llm-systems-fail) -- orq.ai

### 1f. Common Multi-Agent Failure Modes

From the [Maxim reliability study](https://www.getmaxim.ai/articles/multi-agent-system-reliability-failure-patterns-root-causes-and-production-validation-strategies/) and [MAST failure taxonomy](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/):

| Failure Mode | Description | Mitigation |
|-------------|-------------|------------|
| State sync failures | Agent A updates state before Agent B reads it -- duplicate operations | File boundaries per task (no overlap) |
| Race conditions | Scale quadratically with agent count: N agents = N(N-1)/2 potential conflicts | Sequential Phase 1, parallel Phase 2 with worktrees |
| Coordination overhead | Each handoff adds 100-500ms; 10-agent workflow = 1-5s overhead before real work | 3-8 task sweet spot |
| Retry loop ambiguity | Timeout causes retry of already-completed operation | No retry on timeout, check files first |
| Capability saturation | Adding agents past ~4 produces noise, not improvement | Dynamic wave recomputation, not more agents |

### 1g. Agentic Design Pattern Taxonomy

[8 agentic design patterns with Google ADK](https://x.com/Saboo_Shubham_/status/2007520607358071032) (@Saboo_Shubham_, 399 likes, 83 RTs): sequential pipeline, parallel dispatch, supervisor orchestration, and others. [LangChain's formal breakdown](https://x.com/LangChain/status/2011527733176856671) identifies 4 core patterns: subagents (centralized), handoffs (sequential state transitions), skills (on-demand capability loading), router (parallel dispatch). [Google ADK documentation](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) covers the full taxonomy.

**Sources:**
- [@Saboo_Shubham_](https://x.com/Saboo_Shubham_/status/2007520607358071032) (399 likes)
- [@LangChain](https://x.com/LangChain/status/2011527733176856671) (352 likes)
- [Google ADK multi-agent patterns](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) -- developers.googleblog.com

---

## 2. Claude Code Agent Architecture

### 2a. Claude Code Task System Supports DAGs Natively

Tasks support explicit `blocks`/`blockedBy` dependencies, enabling DAG-based workflows. State is persisted to `~/.claude/tasks` on the local filesystem -- durable across terminal restarts. This replaced the earlier Todos system in [Claude Code 2.1](https://www.dplooy.com/blog/claude-code-tasks-complete-guide-to-ai-agent-workflow) (Jan 22, 2026).

**Source:** [Claude Code Tasks: Complete Guide](https://www.dplooy.com/blog/claude-code-tasks-complete-guide-to-ai-agent-workflow) -- dplooy.com

### 2b. Hook Globality is a Hard Technical Blocker

Hooks are global -- when the orchestrator sets a hook, it fires for Builder subagents too. There is no `is_subagent` field in hook JSON. Documented by a [community orchestrator builder](https://www.reddit.com/r/ClaudeAI/comments/1q8884m/) (r/ClaudeAI, Jan 9, 25 comments) who spent hours debugging this.

**Community workaround:** Use `claude -p` subprocess spawning from shell scripts instead of in-agent Task dispatching for more predictable control flow.

**Implication:** Phase 2 parallel execution must evaluate `claude -p` subprocess vs `run_in_background: true` Task dispatching.

**Source:** [Built a multi-agent orchestrator...](https://www.reddit.com/r/ClaudeAI/comments/1q8884m/) -- r/ClaudeAI (13 pts, 25 comments)

### 2c. Anthropic's TeammateTool is Feature-Flagged in the Binary

Researchers [reverse-engineering the Claude Code binary](https://paddo.dev/blog/claude-code-hidden-swarm/) (paddo.dev, Feb 2026) found `TeammateTool` -- a fully-implemented 13-operation multi-agent orchestration system behind two feature flag functions. Architecture includes:

- `~/.claude/teams/` directories
- Direct messaging between agents
- Broadcast operations
- Plan approval/rejection workflows
- Environment variables: `CLAUDE_CODE_TEAM_NAME`, `CLAUDE_CODE_AGENT_ID`, `CLAUDE_CODE_AGENT_TYPE`
- Roles: Leader/Manager, Swarm/Polecats, Watchdog/Witness, Pipeline

**Implication:** Design the Task-tool dispatching layer as replaceable. TeammateTool may ship publicly and supersede custom orchestration at the coordination layer.

**Source:** [Claude Code's Hidden Multi-Agent System](https://paddo.dev/blog/claude-code-hidden-swarm/) -- paddo.dev

### 2d. Official Agent Teams Shipped (Research Preview)

Anthropic [officially announced agent teams](https://x.com/claudeai/status/2019467383191011698) (Feb 5, 2026, 4,052 likes). [40K+ downloads across early Claude Code agents](https://x.com/dani_avila7/status/2017096001232781477) (@dani_avila7, 1,443 likes). Subagents run in isolated context and execute independently.

**Sources:**
- [@claudeai](https://x.com/claudeai/status/2019467383191011698) (4,052 likes, 368 RTs)
- [@dani_avila7](https://x.com/dani_avila7/status/2017096001232781477) (1,443 likes)

### 2e. Skills Architecture Limitations

Skill selection is entirely LLM-driven from text description matching -- no algorithmic fallback. ~1,500+ tokens per turn overhead. Vague descriptions cause matching failures. Progressive disclosure design (only metadata loaded initially, full instructions on demand) mitigates context bloat but doesn't solve invocation reliability. ([Deep dive by Lee Han Chung](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/))

**Implication for injectable skills:** Make `use-when` descriptions extremely specific and action-oriented.

**Source:** [Claude Agent Skills: A First Principles Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) -- leehanchung.github.io

### 2f. Context Depletion is the Real Cost

Steve Yegge reportedly runs 3 concurrent Claude Max accounts to sustain Gas Town's pace ([shipyard.build analysis](https://shipyard.build/blog/claude-code-multi-agent/)). The dominant pain point isn't capability -- it's token burn. Both Gas Town and Multiclaude are described as "expensive and experimental" with rapid context depletion as the primary concern.

**Implication:** Add token cost estimation to orchestration decomposition summaries. Using subagents (separate context windows) mitigates main-context depletion.

**Source:** [Multi-agent orchestration for Claude Code in 2026](https://shipyard.build/blog/claude-code-multi-agent/) -- shipyard.build

### 2g. Community Orchestration Tools

| Tool | Approach | Notes |
|------|----------|-------|
| **Gas Town** (Steve Yegge) | Hierarchical "mayor" agent model | Expensive, 3x Claude Max accounts ([analysis](https://shipyard.build/blog/claude-code-multi-agent/)) |
| **Multiclaude** | "Brownian ratchet" supervisor | Assign-and-monitor pattern ([analysis](https://shipyard.build/blog/claude-code-multi-agent/)) |
| **VibeKanban** | Worktree support | Git isolation for parallel tasks |
| **Every Code** | Fork of Codex CLI, multi-LLM | Cross-model orchestration |
| **AxonFlow** | Self-hosted control plane | Infrastructure-heavy |
| **Pied-Piper** | Claude Code subagents + Beads | Task manager integration |
| **[NOUDE](https://x.com/octaviopvn1/status/2020862490846937242)** (@octaviopvn1) | Claude Code sessions as graph nodes | Low engagement but novel architecture |
| **[Agyn](https://x.com/omarsar0/status/2021267975786070509)** | 4 specialized roles: manager/researcher/engineer/reviewer | Open-source, compared to Claude Code agent teams (405 likes) |

**Sources:**
- [Multi agent orchestration](https://www.reddit.com/r/ClaudeCode/comments/1psh80y/) -- r/ClaudeCode (76 pts, 58 comments)
- [Claude Code just spawned 3 AI agents...](https://www.reddit.com/r/AI_Agents/comments/1qydazj/) -- r/AI_Agents (1,087 pts, 221 comments)

---

## 3. Plan Mode -- Claude Code vs Codex

### 3a. Claude Code Plan Mode Wins on Quality and Safety

Claude Code's plan mode is runtime-enforced read-only. Codex's plan mode is [prompt-level instruction only](https://smartscope.blog/en/generative-ai/chatgpt/codex-plan-mode-complete-guide/) -- not enforced at runtime. The OpenAI Codex team is actively soliciting feedback ([GitHub Discussion #7355](https://github.com/openai/codex/discussions/7355)) and citing Claude Code as a point of comparison.

[Armin Ronacher's deep dive](https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/) confirms: plan mode is structured prompt injection across four phases (Initial Understanding, Design, Review, Final Plan). The capability difference is workflow ergonomics, not fundamental model capability.

**Sources:**
- [What Actually Is Claude Code's Plan Mode?](https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/) -- lucumr.pocoo.org
- [Plan/Spec Mode -- openai/codex Discussion #7355](https://github.com/openai/codex/discussions/7355)
- [Codex Plan Mode Complete Guide](https://smartscope.blog/en/generative-ai/chatgpt/codex-plan-mode-complete-guide/) -- smartscope.blog

### 3b. The #1 Complaint: Persistence

The plan lives in a temp folder, isn't easily editable, and doesn't stay in context during execution. Multiple power users have built workarounds:

- **["Planning with files" skill](https://x.com/anthonyriera/status/2018221220160827828)** (@anthonyriera, 1,937 likes) -- Claude returns to planning files throughout execution. Key: the plan persists and is referenced continuously, not treated as a one-time artifact.
- **[/interview command](https://x.com/jarrodwatts/status/2006138974834716993)** (@jarrodwatts, 1,118 likes) -- 20-50 clarifying questions before planning = "bulletproof specs"
- **Cross-session pattern** ([u/KingPonzi, r/ClaudeCode](https://www.reddit.com/r/ClaudeCode/comments/1qr2mzw/)) -- Plan mode > get plan file path > end session > new session > "execute this plan"

[@boristane's viral post](https://x.com/boristane/status/2021628652136673282) (793 likes): "Plan mode sucks, across all coding agents. I wrote down my workflow: plan in a dedicated doc, annotate the doc, iteratively work with Claude with a persistent artifact that doesn't get compacted."

**Implication:** The orchestrator's spec file pattern (`specs/<name>-orchestrator.md`) directly addresses this. Re-reading the spec at each wave boundary keeps the plan in context through long sessions.

**Sources:**
- [@anthonyriera](https://x.com/anthonyriera/status/2018221220160827828) (1,937 likes)
- [@jarrodwatts](https://x.com/jarrodwatts/status/2006138974834716993) (1,118 likes)
- [@boristane](https://x.com/boristane/status/2021628652136673282) (793 likes)
- [Your opinion on plan mode](https://www.reddit.com/r/ClaudeCode/comments/1qr2mzw/) -- r/ClaudeCode (3 pts, 43 comments)

### 3c. The Hybrid Workflow is the Dominant Pattern

Six independent practitioners converge on the same recommendation: plan with Claude Code (Opus) or Codex (GPT-5.2 xHigh), then implement with Claude Code.

| Practitioner | Pattern | Engagement |
|-------------|---------|------------|
| [@TheAhmadOsman](https://x.com/TheAhmadOsman/status/2013074496266121237) | Plan with Codex XHigh, implement with Opus | 1,146 likes |
| [@pankajkumar_dev](https://x.com/pankajkumar_dev/status/2017502432750932044) | "Hybrid Workflow -- Plan with Claude, Build with Codex" | 431 likes |
| [@venkat_systems](https://x.com/venkat_systems/status/2023862376672751953) | "claude-code for plan, codex for impl" | -- |
| [@shanraisshan](https://x.com/shanraisshan/status/2022376289277992969) | "Opus 4.6 for planning, Codex CLI 5.3 for review" | -- |
| [@LLMJunky](https://x.com/LLMJunky/status/2013157135056539690) | "Plan with Codex 5.2 xHigh without leaving Claude Code" | 328 likes |
| @rojakdude | Plan/execute split across tools | -- |

**The Codex-as-spec-hardener pattern:** A proven refinement loop is to run a decomposed spec through Codex (GPT-5.2 xHigh) before execution. In practice, Codex adds concrete references the decomposition pass misses -- TypeScript contract paths, JSON schema definitions, exact file locations, interface signatures, tighter acceptance criteria. The first pass (Opus decomposition) captures intent and architecture; the second pass (Codex) hardens the spec with implementation-level precision.

**Implication:** The orchestrator's iterative refinement flow supports this naturally. After decomposition, the user can run the spec through Codex or edit it directly before confirming.

### 3d. Clarifying Questions Before Planning

The [/interview pattern](https://x.com/jarrodwatts/status/2006138974834716993) (@jarrodwatts, 1,118 likes) demonstrates that structured questioning before planning produces dramatically better specs. Community variant: plan mode + 20-50 clarifying questions = "bulletproof specs."

**Implication:** Clarifying questions should happen at the very start of the Opus planning phase -- before codebase exploration or decomposition -- so the expensive reasoning runs on clarified requirements, not guesses.

### 3e. Plan-Then-Execute is the Dominant Best Practice

The [AGI in Progress substack](https://agiinprogress.substack.com/p/mastering-claude-code-plan-mode-the) documents the standard three-phase workflow: use plan mode to validate assumptions and ask clarifying questions, generate a spec/plan file as a reviewable artifact, then execute against it.

Failure mode: plan mode cannot create files, run commands, install packages, or make commits -- any planning that requires running code to validate assumptions must happen outside plan mode.

**Source:** [Mastering Claude Code Plan Mode](https://agiinprogress.substack.com/p/mastering-claude-code-plan-mode-the) -- agiinprogress.substack.com

---

## 4. Higher-Order Prompts & Composable Agent Architecture

### 4a. IndyDevDan's 4-Layer Stack is the Canonical Model

[IndyDevDan's 4-layer architecture](https://www.youtube.com/watch?v=efctPj6bjCY) ([VSCode snippets](https://gist.github.com/disler/d9f1285892b9faf573a0699aad70658f)) has become the de facto mental model for Claude Code agent architecture. Multiple independent practitioners arrived at the same taxonomy without citing him -- suggesting organic convergence, not downstream influence:

| Layer | Purpose | IndyDevDan's Name | Community Equivalent |
|-------|---------|-------------------|---------------------|
| 1 | Raw capability | **Skills** | "Procedural memory" ([r/AI_Agents](https://www.reddit.com/r/AI_Agents/comments/1qhvn47/)), "libraries" ([@y_matsuwitter](https://x.com/y_matsuwitter/)) |
| 2 | Scale + specialization | **Sub-agents** | "Microservices" ([@y_matsuwitter](https://x.com/y_matsuwitter/)), "autonomous executors" |
| 3 | Orchestration | **Commands/Prompts** | "Reusable prompts" ([@ericzakariasson](https://x.com/ericzakariasson/status/2011751971284570133), 241 likes), "API layer" |
| 4 | Reusability | **Just file** | Task runners, CLI entry points |

Independently documented by: [marioottmann.com](https://marioottmann.com/articles/claude-code-customization-guide), [codewithseb.com](https://www.codewithseb.com/blog/claude-code-skills-reusable-ai-workflows-guide) (98% token savings architecture), and [Anthropic's own Agent Skills standard](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills).

### 4b. Higher-Order Prompts (HOPs) -- Prompt-as-Parameter Composition

A HOP is a prompt that takes another prompt as a parameter -- like a higher-order function in programming. The fixed wrapper contains consistent workflow logic (save directories, screenshot capture, error handling, reporting). The variable inner prompt contains the specific task.

IndyDevDan's example: an `automate` command takes `$1` (another prompt) as its argument. The wrapper handles setup/teardown; the inner prompt handles what to actually do. You can swap the inner prompt without touching the orchestration logic.

**The pattern has been independently formalized in three places:**

1. **IndyDevDan** ([YouTube](https://www.youtube.com/watch?v=efctPj6bjCY)) -- coined "HOP" (Higher Order Prompt), demonstrated with browser automation wrapper
2. **Medium/Data Science Collective** -- "[Deep Agents and High-Order Prompts (HOPs): The Next Substrate of AI Reasoning](https://medium.com/data-science-collective/deep-agents-and-high-order-prompts-hops-the-next-substrate-of-ai-reasoning-562c19aa25f6)" -- independently formalized: "don't tell the model what to produce -- tell it how to reason, reflect, and decide"
3. **LangChain JS `deepagents`** ([@LangChain_JS](https://x.com/LangChain_JS/status/2018346035240923577), 565 likes, 53 RTs) -- "4 architectural patterns that kept showing up" across Claude Code and Manus, packaged as an [npm library](https://x.com/LangChain_JS/status/2022371506073014582)

**Implication for orchestrator design:** The DAG engine, wave computation, retry logic, and spec file persistence are the fixed HOP wrapper. The builder agent, validator agent, and domain voice are the inner prompt parameters. This makes the orchestrator agent-agnostic -- it doesn't need to know about Star Trek or 1920s newsrooms. It just needs: "here's a builder, here's a validator, here's the task."

### 4c. skill-compose: The Closest Live Agent-Agnostic Implementation

[skill-compose](https://github.com/MooseGoose0701/skill-compose) ([@tom_doerr](https://x.com/tom_doerr/status/2023784067284562270), 159 likes, 20 RTs) builds agents from skills-as-first-class-artifacts rather than workflow graphs. The "Skill-Compose-My-Agent" feature is the HOP pattern in working software:

- User describes agent requirements at a high level
- System locates matching skills from a registry
- Drafts missing skills if needed
- Wires them together with contracts, references, and rubrics
- Tool/MCP integration requires no manual glue-code

This is the closest thing found to an agent-agnostic orchestrator that accepts builder/validator as parameters. Skills are versioned and composable.

### 4d. Community Extension Taxonomy

[@ericzakariasson](https://x.com/ericzakariasson/status/2011751971284570133) (241 likes, 10 RTs) documented a clean taxonomy of coding agent extensions that maps directly to the plugin architecture:

| Extension Type | What It Is | Trigger | Example |
|---------------|------------|---------|---------|
| **Commands** | Reusable prompts | User-triggered (`/command`) | `commands/orchestrate.md` |
| **Skills** | Dynamic context/instructions | Auto-triggered by LLM matching | `skills/orchestrator/SKILL.md` |
| **Rules** | Declarative, always-on | Loaded every turn | `CLAUDE.md` |
| **MCPs** | Tools/actions | Available when server connected | Runner MCPs, Chrome DevTools |
| **Hooks** | Intercept/inject context | Fired on events | PostToolUse biome/tsc |

### 4e. Progressive Disclosure is the Token Efficiency Pattern

[Anthropic's Agent Skills architecture](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) uses progressive disclosure: only skill metadata is loaded at startup; full instructions inject on demand. This yields ~98% token savings ([codewithseb.com analysis](https://www.codewithseb.com/blog/claude-code-skills-reusable-ai-workflows-guide)). [Lee Han Chung's deep dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) confirms the dual-message injection mechanism.

[@LangChain_JS](https://x.com/LangChain_JS/status/2022371506073014582) (48 likes): "Most agent setups still dump everything into the system prompt. `deepagents` skills are reusable, on-demand capabilities loaded only when relevant."

**Implication for injectable skill design (Phase 1.5):** Skills with `injectable: true` frontmatter should follow progressive disclosure. The orchestrator reads metadata (`use-when`) at decomposition time, but only injects full skill content into Builder prompts for matching tasks.

### 4f. Three Problems with Composable Skills

| Problem | Description | Source |
|---------|-------------|--------|
| **Trust/security scoping** | "What matters isn't what skills they have -- it's what they're scoped to access" | [r/clawdbot](https://www.reddit.com/r/clawdbot/comments/1r7zokg/) (11 pts, 12 comments) |
| **Registry fragmentation** | Multiple registries (VoltAgent, ClawdHub, agentskills.io, [skill-compose](https://github.com/MooseGoose0701/skill-compose)) with no convergence yet | Multiple X posts |
| **Context collision** | Dumping everything into system prompt is still common; progressive disclosure requires discipline | [@LangChain_JS](https://x.com/LangChain_JS/status/2022371506073014582), [@aditya_vellanki](https://x.com/aditya_vellanki/status/2024218322997309731): "they plan until instructions collide" |

### 4g. Community Framing: MCP vs Skills vs Sub-Agents

Multiple practitioners independently converged on the same mental model:

- **MCP** = external API / "the hands" (tools and actions)
- **Skills** = libraries / "the brain" (domain knowledge and procedures)
- **Sub-agents** = microservices (autonomous task executors)

[@y_matsuwitter](https://x.com/y_matsuwitter/) (442 likes, Dec 31) arrived at this framing in Japanese without referencing IndyDevDan. [@0x_nirob](https://x.com/0x_nirob/status/2017081993666974119) (292 likes, 112 RTs): "Composable AI sounds advanced but in practice most agents still operate in isolation... context preservation is what makes agents a coordinated system."

[Agent Skills arxiv paper (2602.12430)](https://arxiv.org/html/2602.12430v1) provides the academic formalization: architecture, acquisition, and security of agent skills for LLMs.

### 4h. Emerging Skill Composition Ecosystem

| Project | What It Does | Source |
|---------|-------------|--------|
| **skill-compose** | Build agents from composable skills, not workflow graphs | [@tom_doerr](https://x.com/tom_doerr/status/2023784067284562270) (159 likes), [GitHub](https://github.com/MooseGoose0701/skill-compose) |
| **deepagents** | 4 architectural patterns from Claude Code + Manus as npm library | [@LangChain_JS](https://x.com/LangChain_JS/status/2018346035240923577) (565 likes) |
| **Synapse** | Agent-native skill composition engine | [@aditya_vellanki](https://x.com/aditya_vellanki/status/2024218322997309731) (8 likes) |
| **0G Agent Skills** | Turn Claude Code/Cursor/Copilot into expert 0G developers | [@0G_labs](https://x.com/0G_labs/status/2022460765408760139) (478 likes) |
| **Agno Agent Skills** | "From prompts to capabilities" -- skill-first agent framework | [agno.com](https://www.agno.com/blog/from-prompts-to-capabilities-introducing-agnos-agent-skills) |
| **BDI Mental States** | Belief-Desire-Intention cognitive architecture as a reusable skill | [@koylanai](https://x.com/koylanai/status/2007927864826687609) (323 likes) |

[@asteris_ai](https://x.com/asteris_ai/status/2023502785615196641): "Skill synthesis for reasoning agents is modular intelligence: build small reusable skills, compose them at test time. Prompts become less important than skill libraries and routing."

---

## 5. All Patterns Worth Adopting

| Pattern | Source | Applicability |
|---------|--------|--------------|
| Async message bus over shared files | [@gizinaiteam](https://x.com/gizinaiteam/status/2023000029888438531) (33 agents) | Parallel execution at scale |
| Progressive disclosure for skills | [Lee Han Chung deep dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) | Injectable skill design |
| `claude -p` subprocess over Task tool | [r/ClaudeAI orchestrator thread](https://www.reddit.com/r/ClaudeAI/comments/1q8884m/) | Alternative to `run_in_background` |
| Token cost estimation before execution | [shipyard.build](https://shipyard.build/blog/claude-code-multi-agent/) | User cost awareness |
| Idempotent activities | [Kinde: Temporal/Dagster/LangGraph](https://www.kinde.com/learn/ai-for-software-engineering/ai-devops/orchestrating-multi-step-agents-temporal-dagster-langgraph-patterns-for-long-running-work/) | Builder retry safety |
| Disposable subagents pattern | [@joshuaday](https://x.com/joshuaday/status/2024161983898275855) | Clean context isolation |
| Clarifying questions before planning | [@jarrodwatts /interview](https://x.com/jarrodwatts/status/2006138974834716993) (1,118 likes) | Spec quality improvement |
| Plan file as persistent living doc | [@anthonyriera "Planning with files"](https://x.com/anthonyriera/status/2018221220160827828) (1,937 likes) | Spec file re-read at each wave |
| Iterative plan refinement | [u/NatteringNabob69](https://www.reddit.com/r/ClaudeCode/comments/1qr2mzw/), [@boristane](https://x.com/boristane/status/2021628652136673282) (793 likes) | User edits spec before execution |
| Codex-as-spec-hardener | [@TheAhmadOsman](https://x.com/TheAhmadOsman/status/2013074496266121237) (1,146 likes), Nathan Vale | Second-pass spec tightening |
| Hybrid plan-then-execute across tools | [6 independent practitioners](#3c-the-hybrid-workflow-is-the-dominant-pattern) | Codex escalation for hard tasks |
| Higher-Order Prompts (HOPs) | [IndyDevDan](https://www.youtube.com/watch?v=efctPj6bjCY), [Medium/DSC](https://medium.com/data-science-collective/deep-agents-and-high-order-prompts-hops-the-next-substrate-of-ai-reasoning-562c19aa25f6), [deepagents](https://x.com/LangChain_JS/status/2018346035240923577) | Agent-agnostic orchestrator wrapper |
| Skill-as-first-class-artifact | [skill-compose](https://github.com/MooseGoose0701/skill-compose) ([@tom_doerr](https://x.com/tom_doerr/status/2023784067284562270), 159 likes) | Composable agent construction |
| Progressive disclosure (98% token savings) | [Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills), [codewithseb.com](https://www.codewithseb.com/blog/claude-code-skills-reusable-ai-workflows-guide) | Injectable skill loading |
| Extension taxonomy (5 types) | [@ericzakariasson](https://x.com/ericzakariasson/status/2011751971284570133) (241 likes) | Plugin architecture mapping |
| MCP = hands, Skills = brain, Agents = microservices | [@y_matsuwitter](https://x.com/y_matsuwitter/) (442 likes) | Mental model for separation of concerns |

---

## 6. Key Community Voices

| Voice | Contribution | Engagement |
|-------|-------------|------------|
| [@GoogleResearch](https://x.com/GoogleResearch/status/2016621362480382213) | 180-config study: architecture > agent count | 770 likes |
| [@anthonyriera](https://x.com/anthonyriera/status/2018221220160827828) | "Planning with files" skill beats native plan mode | 1,937 likes |
| [@TheAhmadOsman](https://x.com/TheAhmadOsman/status/2013074496266121237) | Hybrid workflow: plan Codex, implement Opus | 1,146 likes |
| [@jarrodwatts](https://x.com/jarrodwatts/status/2006138974834716993) | /interview pattern: questions before planning | 1,118 likes |
| [@antoniosarosi](https://x.com/antoniosarosi/status/2019168835673420174) | Claude plans in 3 min vs Codex 26 min | 996 likes |
| [@boristane](https://x.com/boristane/status/2021628652136673282) | Plan mode persistence is the #1 problem | 793 likes |
| [@finbarrtimbers](https://x.com/finbarrtimbers/status/2002765191134732642) | Claude Code's plan UX strictly superior to Codex | 520 likes |
| [@claudeai](https://x.com/claudeai/status/2019467383191011698) | Official agent teams announcement | 4,052 likes |
| [@dani_avila7](https://x.com/dani_avila7/status/2017096001232781477) | 40K downloads across 3 Claude Code agents | 1,443 likes |
| [@LangChain](https://x.com/LangChain/status/2011527733176856671) | 4 multi-agent architecture patterns | 352 likes |
| [@Saboo_Shubham_](https://x.com/Saboo_Shubham_/status/2007520607358071032) | 8 agentic design patterns with Google ADK | 399 likes |
| [Armin Ronacher](https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/) | Plan mode is prompt injection, not a sandbox | lucumr.pocoo.org |
| [paddo.dev](https://paddo.dev/blog/claude-code-hidden-swarm/) | TeammateTool reverse engineering | paddo.dev |
| [Maxim / MAST](https://www.getmaxim.ai/articles/multi-agent-system-reliability-failure-patterns-root-causes-and-production-validation-strategies/) | Retry thresholds as #1 multi-agent fix | getmaxim.ai |
| [IndyDevDan](https://www.youtube.com/watch?v=efctPj6bjCY) | 4-layer stack, HOP pattern, agentic engineering | [YouTube](https://www.youtube.com/watch?v=efctPj6bjCY), [gist](https://gist.github.com/disler/d9f1285892b9faf573a0699aad70658f) |
| [@LangChain_JS](https://x.com/LangChain_JS/status/2018346035240923577) | deepagents: 4 patterns from Claude Code + Manus | 565 likes |
| [@tom_doerr](https://x.com/tom_doerr/status/2023784067284562270) | skill-compose: agents from skills not graphs | 159 likes |
| [@ericzakariasson](https://x.com/ericzakariasson/status/2011751971284570133) | Coding agent extension taxonomy (5 types) | 241 likes |
| [@0x_nirob](https://x.com/0x_nirob/status/2017081993666974119) | Context preservation makes agents coordinate | 292 likes |
| [@Python_Dv](https://x.com/Python_Dv/status/2006865016239346060) | Layered agentic AI stack visualization | 1,588 likes |

---

## 7. Contradictions and Open Debates

| Debate | Side A | Side B | Status |
|--------|--------|--------|--------|
| More agents vs fewer | Vendor messaging: "more is better" | [Google Research](https://x.com/GoogleResearch/status/2016621362480382213): -70% on sequential tasks | Settling on "task-contingent" |
| DAG complexity vs simplicity | Formal frameworks ([LangGraph](https://x.com/LangChain/status/2011527733176856671), CrewAI) | Practitioners: one orchestrator + [disposable subagents](https://x.com/joshuaday/status/2024161983898275855) | No clear winner |
| Builder/Validator vs conversation loops | Explicit pass/fail (LangGraph/CrewAI) | Iterative refinement ([AutoGen](https://www.datacamp.com/tutorial/crewai-vs-langgraph-vs-autogen)) | Depends on whether validation is deterministic |
| Plan mode quality | [@IliaWhy](https://x.com/IliaWhy/status/2024254224641438046): "Opus 4.6 plan mode is insane" | [@boristane](https://x.com/boristane/status/2021628652136673282): "plan mode sucks" | Both acknowledge persistence is the real issue |
| Claude Code vs Codex for planning | Opus wins on quality ([multiple sources](#3a-claude-code-plan-mode-wins-on-quality-and-safety)) | Codex xHigh wins on price + fewer bugs ([@TheAhmadOsman](https://x.com/TheAhmadOsman/status/2013074496266121237)) | [Hybrid workflow](#3c-the-hybrid-workflow-is-the-dominant-pattern) dominates |
| Native Agent Teams vs DIY subagents | [Official support](https://x.com/claudeai/status/2019467383191011698), cleaner API | More control, [proven patterns](https://www.reddit.com/r/ClaudeCode/comments/1psh80y/) | Teams too new/experimental for production |
| Hardcoded agents vs agent-as-parameter | Simpler, less abstraction, faster to ship | HOP pattern: [orchestrator is agent-agnostic](https://medium.com/data-science-collective/deep-agents-and-high-order-prompts-hops-the-next-substrate-of-ai-reasoning-562c19aa25f6), accepts builder/validator as params | HOPs emerging but no dominant implementation yet |
| Public skill registries vs build-your-own | Ecosystem leverage, [community registries](https://www.reddit.com/r/clawdbot/comments/1r7zokg/) | Security scoping, specialization, no lock-in ([IndyDevDan](https://www.youtube.com/watch?v=efctPj6bjCY): "don't outsource learning") | Build-your-own dominates among serious practitioners |
| Skills vs just prompting | Skills add structure, progressive disclosure, [98% token savings](https://www.codewithseb.com/blog/claude-code-skills-reusable-ai-workflows-guide) | Skills add overhead, LLM-driven matching is [fragile](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) | Skills winning for repeat workflows; prompts for one-offs |
