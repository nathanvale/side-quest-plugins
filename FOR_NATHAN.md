# Side Quest Plugins: The Story Behind the Code

*A marketplace of 18 Claude Code plugins that turns "I wish Claude could..." into "Claude already does."*

---

## The Problem We're Actually Solving

Claude Code is powerful out of the box. But "out of the box" means generic. It doesn't know your git workflow. It doesn't know how to search Reddit for community sentiment. It doesn't know your monitor's DDC commands or how to manage your Obsidian vault. It doesn't know that you have ADHD and metaphors help you think.

This repo is the answer to a specific frustration: **every Claude Code session starts from zero**. You explain the same things, set up the same guardrails, teach the same workflows. Plugins fix this by encoding expertise into reusable, composable units that Claude loads automatically.

The marketplace isn't a package registry (yet). It's a monorepo of plugins that share patterns and conventions, installed by symlinking into `~/.claude/plugins/`. Each plugin is self-contained -- its own directory with a `plugin.json` manifest, its own skills, commands, agents, and hooks. No hard dependencies between plugins. If you delete the newsroom plugin, the git plugin keeps working.

---

## The Architecture: A Modular Toolkit

Think of it like a workbench with specialized drawers. Each drawer (plugin) has tools for a specific job. Some drawers have power tools (MCP servers) that connect to external systems. Some have jigs (hooks) that automatically activate when certain things happen. Some have instruction cards (skills) that teach Claude how to do something. And some have quick-reference labels (commands) for common operations.

```
~/.claude/plugins/
├── git/                    Power tools + jigs + instructions
├── newsroom/               Instructions + agents (the foreman's crew)
├── kit/                    Power tools + instructions
├── para-obsidian/          Power tools + instructions + jigs
├── claude-code/            Instructions (6 skill sets)
├── biome-runner/           Power tools + jigs
├── bun-runner/             Power tools + jigs
├── tsc-runner/             Power tools + jigs
├── firecrawl/              Instructions
├── research/               Instructions + agents (predecessor to newsroom)
├── dell-u4025qw/           Instructions + cached intel
├── agentic-orchestration/  Instructions + jigs
├── macos-settings/         Instructions
├── chrome-devtools/        Instructions
├── node-cert/              Instructions
├── utm-testing/            Instructions
├── agent-skills-bridge/    Instructions
└── bun-typescript-starter/ Instructions
```

### The Five Component Types

**Skills** are knowledge banks. A SKILL.md file with YAML frontmatter that tells Claude what tools it can use, whether to fork context, and what references to load on demand. The skill body is the instruction set -- sometimes a character (Mickey "The Desk" Malone), sometimes a workflow, sometimes pure reference material. There are 23 skills across the marketplace.

**Commands** are slash-command entry points. `/git:commit`, `/newsroom:investigate`, `/para-obsidian:triage`. They're thin wrappers that invoke a skill with specific arguments. 45 commands total.

**Agents** are sub-agent definitions. A markdown file that specifies a model, tools, and instructions for a Task subagent. Only 2 exist today (both beat-reporters), but they're the building block for the orchestration system.

**Hooks** are lifecycle handlers. TypeScript files that run on SessionStart, PreToolUse, PostToolUse, PreCompact, or Stop events. The git plugin has 5 hooks totaling 1,681 lines of TypeScript -- the most code in the entire repo. 7 plugins use hooks.

**MCP Servers** are external tool connectors. JSON configs that tell Claude Code to launch a process and communicate via the Model Context Protocol. Kit, x-api, tsc-runner, biome-runner, and bun-runner are all MCP servers.

---

## The Technical Stack (And Why Each Piece)

### Markdown as Code

The radical decision: **skills, commands, and agents are all markdown files**. No compilation, no bundling, no runtime. Claude reads the markdown directly. This means:

- You can edit a skill in any text editor and it takes effect immediately
- Version control is trivial (git diff shows exactly what changed in the instructions)
- No build step, no dependency resolution, no "did I forget to compile?"
- The skill IS the documentation

The tradeoff is that you can't do conditional logic, loops, or data transformation in a skill. But that's what hooks (TypeScript) and MCP servers (external processes) are for. The markdown layer orchestrates, the code layer executes.

### Progressive Disclosure via References

Skills use a `references/` subdirectory for modular knowledge. The main SKILL.md is always loaded (~2,000 tokens). References are loaded conditionally -- only when a flag is set, a mode is activated, or a tool is detected.

```
skills/the-desk/
├── SKILL.md                    Always loaded (~2,000 tokens)
└── references/
    ├── orchestration.md        Always loaded (~1,150 tokens)
    ├── query-strategies.md     Always loaded (~750 tokens)
    ├── output-formats.md       Always loaded (~1,200 tokens)
    ├── mode-playbook.md        Only if --mode flag (~500 tokens)
    ├── wire-protocol.md        Only if --wire flag (~350 tokens)
    ├── the-morgue.md           Only if para-obsidian detected (~200 tokens)
    ├── the-wire.md             Only if --wire flag (~350 tokens)
    └── future-roles.md         Rarely loaded (~400 tokens)
```

Default dispatch: ~5,100 tokens. Worst case: ~6,900 tokens. This matters because every token of context is a token Claude can't use for reasoning. Fat skills make dumb responses.

### Bun Everywhere

The runtime for hooks, MCP servers, and CLI tools. Bun over Node because it's faster to start (hooks run on every tool call -- startup latency matters), has built-in TypeScript support (no compilation step for hooks), and is the ecosystem Nathan works in daily. The `bunx` command replaces `npx` for package execution.

### Biome for Quality

Single tool replacing ESLint + Prettier. Tabs, single quotes, 80 chars. One config at the monorepo root -- never nested configs. The MCP runner plugins (biome-runner, tsc-runner, bun-runner) expose Biome/TypeScript/Bun as tools Claude can call directly, closing the loop: the quality tools that check your code are also available to the AI writing your code.

---

## Deep Dive: The Newsroom

The newsroom is the crown jewel. It's a multi-agent research orchestrator built on a 1920s journalism metaphor, and it exists because "what are people saying about X?" is a question that deserves a real answer.

### The Cast

**Mickey "The Desk" Malone** is the Editor-in-Chief. He's a skill (`the-desk/SKILL.md`) that orchestrates the entire research operation. Mickey has a voice -- gruff, efficient, newspaper-editor energy. "Got it, Chief. Sending 2 reporters out now." The character isn't decoration. It's an ADHD cognitive handle that makes the orchestration flow intuitive: you're the Publisher giving assignments, Mickey runs the newsroom.

**Beat Reporters** are sub-agents dispatched in parallel via the Task system. Each reporter gets a JSON assignment (topic, query type, CLI flags, web queries, fetch budget) and works independently. They call the `@side-quest/last-30-days` CLI for engagement-ranked Reddit/X data, then run supplementary web research. When they're done, they file a report back to Mickey.

**The Morgue** isn't a skill anymore -- it's a reference doc. If the para-obsidian MCP tools are available, Mickey checks your Obsidian vault for recent research on the topic before dispatching reporters. "Recent research found -- skip or re-run?" No vault tools? Skip silently. No error, no warning, just graceful degradation.

### How a Story Gets Filed

```
You: /newsroom:investigate "React 19 adoption" --quick --reddit

Mickey (the-desk):
  1. Parse: TOPICS=["React 19 adoption"], DEPTH=quick, SOURCES=reddit
  2. Preflight: "Got it, Chief. Sending 1 reporter out now."
  3. Dispatch: Task(subagent_type: "newsroom:beat-reporter", prompt: {assignment JSON})

Beat Reporter (parallel subprocess):
  1. CLI: bunx @side-quest/last-30-days "React 19 adoption" --quick --sources=reddit --emit=compact
  2. CLI returned results? Run supplementary web queries (exclude reddit.com)
  3. CLI returned "WEBSEARCH REQUIRED"? Follow CLI's specific instructions
  4. CLI failed? Web research becomes primary source
  5. File report: CLI Data + Web Findings + Source Links + Telemetry

Mickey (back in main context):
  4. Collect: TaskOutput(block: true, timeout: 120000)
  5. Copy Desk: Synthesize, cross-reference, deduplicate
  6. Publish: Evening Edition with engagement stats + source links
```

### The Four Modes

Modes change what the reporters look for, not how Mickey orchestrates.

| Mode | Metaphor | What Changes |
|------|----------|-------------|
| `recon` (default) | Street Reporter | Standard research -- broad coverage |
| `changes` | Stakeout | Delta-focused, forces `--refresh`, time-constrained queries |
| `sentiment` | Source Network | Forces `--sources=both`, community sentiment focus |
| `verify "claim"` | Tipster Handler | Search for/against evidence, confidence rating |

`--deep` is a depth flag, not a mode. It composes with any mode. `--deep --mode sentiment` means "deep community sentiment analysis."

### The Fallback Chain

This is where graceful degradation gets serious:

```
CLI success          --> Web research (supplementary)
CLI "WEBSEARCH REQ"  --> Web research (CLI-directed queries)
CLI failure          --> Web research (primary source)

WebFetch success     --> Use content
WebFetch empty/403   --> Firecrawl CLI fallback
Firecrawl failure    --> Skip URL, continue with what we have
```

The web-scraping skill handles the WebFetch-to-Firecrawl handoff. Product Hunt is the canonical test case -- it consistently 403s WebFetch (anti-bot protection) but Firecrawl renders it fine.

### Evolution from Research

The research plugin was the prototype. Single agent, single topic, no orchestration. `/research:last-30-days "topic"` called the CLI and returned results. Simple.

The newsroom added:
- **Multi-topic**: Up to 5 topics, dispatched in parallel
- **Modes**: 4 research angles instead of one
- **Orchestration**: Editor-in-Chief coordinates, reporters execute
- **Wire protocol**: Handoff to future rooms (Kitchen, Garden, Dojo)
- **Morgue**: Check past research before dispatching

Both plugins coexist. The research plugin isn't deprecated -- it's simpler and sometimes simpler is what you want.

---

## Deep Dive: The Git Plugin

The git plugin is the most production-ready code in the repo. 1,681 lines of TypeScript across 7 hook files, plus a skill and 10 commands. It turns Claude from "a tool that can run git commands" into "a tool that understands git workflows."

### The Safety Net (git-safety.ts, 321 lines)

The PreToolUse hook intercepts every Bash command before execution. It pattern-matches against a blocklist:

- `git push --force` / `git push -f` -- blocked always
- `git reset --hard` -- blocked always
- `git clean -f` -- blocked always
- `git checkout .` / `git restore .` -- blocked (would discard all changes)
- Commits to main/master -- blocked (create a branch first)
- `git add .` / `git add -A` -- blocked (stage specific files)

This isn't paranoia. These are the commands that destroy work. A single `git clean -f` in the wrong directory wipes untracked files permanently. The hook catches it before Claude executes it, every time.

### Session Memory (session-summary.ts, 309 lines)

The PreCompact hook fires when Claude's context window is about to be compressed. Before the compression happens, the hook extracts key decisions, learnings, and the current state of work into a "cortex" summary. This summary survives the compression, so Claude doesn't lose track of what it was doing.

The cortex is keyed by the main worktree root, not the current directory. This means switching between worktrees of the same repo shares session memory. If you learned something about the codebase in worktree A, Claude remembers it in worktree B.

### Auto-Commit on Stop (auto-commit-on-stop.ts, 178 lines)

When you end a Claude Code session on a feature branch with uncommitted changes, the Stop hook creates a WIP commit. "chore(wip): session checkpoint" -- skips hooks, just saves your work. This has saved work more than once when a session crashed or timed out.

Only fires on feature branches. Never on main. Never on detached HEAD.

---

## Deep Dive: The Claude Code Plugin

The most meta plugin in the marketplace: a knowledge bank about Claude Code itself. Six skills that teach Claude how to build, review, test, and document Claude Code extensions.

### skill-builder

An interactive scaffolding tool. You describe what you want, it generates the SKILL.md, references, and command files. Has `disable-model-invocation: true` in its frontmatter -- it's a pure orchestrator that doesn't call the LLM for generation, it just structures your input into the right file format.

### skill-reviewer

8-dimension grading with remediation prompts. Evaluates a skill on: structure, progressive disclosure, tool usage, token efficiency, error handling, testing, documentation, and DX. Each dimension gets a score and specific fix suggestions. The grading rubric itself is a reference doc -- the skill loads it conditionally.

### skill-smoketest

Functional testing via sub-agents. Spawns test agents that exercise a skill's dependencies (E-1 through E-5 patterns):

- E-1: Tool existence (does the MCP server respond?)
- E-2: Bash tool availability (can the skill run commands?)
- E-3: Reference file accessibility (do all referenced files exist?)
- E-4: Cross-skill references (do linked skills resolve?)
- E-5: Fallback chain integration (does the fallback actually work end-to-end?)

E-5 is the newest -- it was added after realizing that "tool exists" doesn't prove "tool works." Product Hunt is the test target for web-scraping fallback chains.

---

## The Orchestration Vision: Four Rooms and a Wire

The specs directory contains the blueprint for something ambitious: a 4-room agentic system connected by a wire service. Each room is a standalone plugin with its own metaphor, roles, and workflows.

### The Rooms

| Room | Metaphor | Purpose | Status |
|------|----------|---------|--------|
| Newsroom | 1920s journalism | Research and intelligence | Implemented |
| Kitchen | Escoffier's brigade | Software engineering | Spec only |
| Garden | Permaculture | Knowledge cultivation (PARA) | Spec only |
| Dojo | Martial arts training | Learning and skill development | Spec only |

### The Wire Service

Rooms communicate via wire messages -- TaskCreate calls with structured metadata. Two wire types:

**Green Wire** flows freely between rooms. "Hey Kitchen, the community is asking for dark mode" -- informational, no approval needed. Context requests, shipped notifications, ingredient queries.

**Red Wire** requires owner (your) approval. "Kitchen wants to reprioritize the backlog based on community sentiment" -- that's a scope change, and scope changes route through you.

The wire is session-scoped in v1. Messages live and die with the Claude Code session. Cross-session persistence is deferred to a future wire-service plugin.

### The Kitchen (Spec)

Escoffier's brigade system mapped to software engineering. Stations (Saucier for backend, Garde Manger for frontend, Rotisseur for infrastructure) coordinate under an Executive Chef orchestrator. Quality gates at "The Pass" before shipping. The newsroom feeds intel to the kitchen via green wire: "community wants X" becomes a ticket on the order board.

### Why Metaphors Matter

Every room uses a real-world metaphor with centuries of operational wisdom baked in. A newsroom has editors, reporters, a morgue (archive), and a wire service. A kitchen has stations, mise en place, and a pass. These aren't cute names -- they're **cognitive handles** that make complex orchestration patterns intuitive. When Mickey says "reporter just filed," you instantly understand the state machine. When the Kitchen says "ticket on the rail," you know what that means.

For someone with ADHD, this is the difference between "I need to check the status of parallel sub-agent task #3's output collection phase" and "has the reporter filed yet?" Same information, wildly different cognitive load.

---

## The HALT Workflow

Some plugins maintain cached community intelligence that auto-refreshes. The pattern is called HALT: **H**igh-signal visibility, **A**daptive lazy loading, **L**ifecycle clarity, **T**rust + telemetry.

```
cache/
├── staged-intel.md         Pending findings (not yet verified)
├── community-intel.md      Promoted verified intel
├── reviewed-hashes.json    Deduplication (don't re-process known items)
└── last-updated.json       Timestamps for freshness checks
```

The SessionStart hook checks `last-updated.json`. If the cache is stale, it triggers a refresh. New findings land in `staged-intel.md`. Once verified by the user or the skill, they're promoted to `community-intel.md` and their hashes are recorded for deduplication.

The dell-u4025qw and claude-code/hooks plugins use this pattern. It's how the monitor knowledge bank stays current with firmware updates and community workarounds without you having to manually research every session.

---

## Bugs We Hit (And What They Taught Us)

### The Stringer Problem

The newsroom originally dispatched two agents per topic: a Beat Reporter (CLI) and a Stringer (WebSearch). They ran in parallel. The idea was speed -- don't wait for the CLI to finish before searching the web.

The problem: the CLI sometimes returns "WEBSEARCH REQUIRED" with specific, targeted search instructions. But the Stringer was already running with generic template queries. The CLI's intelligence was wasted.

Fix: merge the Stringer into the Beat Reporter. One agent per topic, sequential phases (CLI first, then web informed by CLI output). Slower by ~30-60 seconds per topic, but the web queries are actually useful now.

**Lesson**: Parallel isn't always better. When step B's quality depends on step A's output, sequential wins.

### The Firecrawl Inline Fix

The beat-reporter agent originally had `skills: [last-30-days-guide]` to load CLI reference material. This created a cross-plugin dependency -- the newsroom plugin needed the research plugin installed. Worse, the skills preload cost ~965 tokens of context for reference material the reporter always needs.

Fix: inline the essential CLI reference (~40 lines) directly into the agent body. No cross-plugin dependency, no runtime Read, and the context cost is static and predictable.

**Lesson**: Cross-plugin dependencies are fragile. If an agent always needs something, inline it.

### The Context Fork Revelation

Early skill designs ran in the main conversation context. This meant a research skill's 5,000 tokens of reference material stayed in context for the entire session, even after the research was done. With multiple skill invocations, context filled up fast.

Fix: `context: fork` in skill frontmatter. The skill runs in an isolated context that's discarded when it's done. Only the output flows back to the main conversation.

**Lesson**: Context is a finite resource. Treat it like memory allocation -- acquire what you need, release it when you're done.

---

## Best Practices Embedded in This Codebase

### 1. Token Budgeting

Every skill has a token budget annotation. The newsroom's the-desk is ~5,100 tokens default, ~6,900 worst case. These aren't aspirational -- they're constraints that drive design decisions. When a reference file would push the budget over the limit, it becomes conditional.

### 2. Graceful Degradation Chains

Never hard-fail on a missing dependency. The newsroom works without the para-obsidian vault (morgue skips silently). It works without the CLI (web-only mode with a warning). It works without Firecrawl (WebFetch results only). Each degradation step is documented and tested.

### 3. Metaphor-Driven Design

Every orchestration concept maps to a real-world role. This isn't about making the code "fun" -- it's about reducing cognitive load. "The reporter filed their story" is faster to process than "sub-agent task completed and output was collected." Same information, less mental parsing.

### 4. Conditional Loading

Reference files are loaded on-demand based on flags, detected tools, or mode. This keeps the default path lean while supporting power-user features. The mode-playbook only loads when `--mode` isn't the default. The wire protocol only loads when `--wire` is present. The morgue only loads when para-obsidian tools are detected.

### 5. Multi-Pass Review

The newsroom plugin went through 7 review passes before implementation: 2 staff engineer reviews, a Codex architecture consultation, and a 3-pass review (Architect, Cost Analyst, DX Advocate). 15 issues were identified and resolved. The review docs live in `specs/reviews/` as institutional memory.

---

## How the CI/CD Works

8 GitHub Actions workflows, each doing exactly one thing:

**PR Quality** (`pr-quality.yml`): Biome lint + TypeScript type check + Bun tests. The gate job aggregates results -- if any check fails or cancels, the gate fails with a detailed status report.

**Commit Lint** (`commitlint.yml`): Conventional commits enforced on PRs. `feat(newsroom): add investigate command` passes. `added stuff` fails.

**Security** (`security.yml` + `codeql.yml`): CodeQL for static analysis, Trivy for vulnerability scanning. Runs on schedule and on PRs.

**Dependency Review** (`dependency-review.yml`): Supply chain security. Catches known-vulnerable dependencies before they merge.

**Dependabot Auto-Merge** (`dependabot-auto-merge.yml`): Patch updates merge automatically. Minor and major updates require review.

The monorepo has a single `biome.json` at the root. Never nested configs -- that's a rule in the CLAUDE.md. One source of truth for formatting and linting.

---

## What's Next

The newsroom is v1. The implementation plan (`specs/newsroom-plugin-implementation-plan.md`) documents every file, every design decision, and every tradeoff. The nice-to-haves include reporter telemetry, structured JSON dispatch payloads, conditional web-augment (skip web when CLI is sufficient), and `--plain` mode for professional contexts.

The Kitchen is next. The spec is written (`specs/orchestrators/the-kitchen-agentic-orchestration-plan.md`), the wire protocol is designed, and the newsroom already supports `--wire kitchen` (it warns "no consumer" since the Kitchen doesn't exist yet, but the plumbing is there).

The Garden and Dojo are further out. The Garden integrates with para-obsidian for knowledge cultivation. The Dojo handles learning and skill development. Both specs exist but haven't been through the review gauntlet yet.

The Wire Service plugin will eventually handle cross-session message persistence, TTL sweeping, and replay. For now, the session-scoped Task system is enough.

---

## Final Thoughts

This codebase is built on a belief: **AI assistants should accumulate expertise, not start from zero every session**. Plugins are the mechanism. Skills encode what Claude should know. Hooks encode what Claude should do automatically. Commands encode what you do repeatedly. Agents encode how work gets delegated.

The metaphor system (newsroom, kitchen, garden, dojo) isn't whimsy -- it's an accessibility feature. When your brain processes "the reporter filed their story" faster than "sub-agent output collected," the metaphor is doing real cognitive work. Every naming decision, every character voice, every room label is there to reduce the gap between "what's happening in the system" and "what it feels like is happening."

18 plugins. 23 skills. 45 commands. 1,681 lines of hook TypeScript. 5 orchestration specs. 7 review docs. And it all started because typing the same git safety rules into every session got old.

Not bad for a side quest.

---

*-- Built for a brain that works differently, by someone who stopped apologizing for it.*
