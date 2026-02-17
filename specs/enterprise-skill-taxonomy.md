# Enterprise Skill Taxonomy & Crew Ownership

*Level 1 spec -- architecture and ownership. Each command requires a separate Level 2 spec (implementation workflow) before building.*

---

## 1. Skill Types

Three types of composable skills:

| Type | What It Is | Injected Into | Example |
|------|-----------|---------------|---------|
| **Action skill** | A capability an officer OWNS. When executing, the officer may dispatch programs to the Computer. | Nothing -- it IS the capability | code-review (McCoy), session-log (Spock), refactor-analysis (Scotty) |
| **Knowledge skill** | Provides context, no output. SKILL.md files listed in agent `skills:` frontmatter. | Officers who need the knowledge at dispatch time | sidequest-core, project-conventions |
| **Program skill** | Instructions for the Ship's Computer CPU agent. Injected into Task prompts at dispatch. | Computer CPU prompts | program-readme, program-code-review |

### The action-to-program relationship

An action skill is what an officer owns. A program is what the Computer executes. McCoy owns the `code-review` action skill; when executing it, he dispatches the `program-code-review` program to the Computer. The officer provides voice and workflow; the program provides CPU instructions.

### Composition model

Skills compose laterally as a graph, not hierarchically as a tree:

```
Commands (user-facing: /enterprise:*)
  |
  v
Officers (own action skills, provide voice + workflow)
  |-- dispatch --> Programs (Ship's Computer CPU instructions)
  |-- read -----> Knowledge Skills (injected context via skills: frontmatter)
  |-- execute --> Action Skills (the capability itself)
```

---

## 2. Filesystem Layout

Every skill type maps to a concrete directory path. Annotations mark what exists today.

```
plugins/enterprise/
  commands/
    chart.md                      # Command entry points (user-facing)
    document.md                   # (exists)
    scan.md                       # (exists)
    refit.md
    engage.md
    log.md
    away-mission.md
  skills/
    the-bridge/                   # Spock's orchestrator (exists)
      SKILL.md
      references/
        document.md               # (exists)
        scan.md                   # (exists)
    stations/                     # One per officer who handles a command
      medical/SKILL.md            # McCoy (exists)
      engineering/SKILL.md        # Scotty (exists, stub)
    knowledge/                    # NEW -- injected context, no output
      sidequest-core/SKILL.md
      project-conventions/SKILL.md
      testing-patterns/SKILL.md
      api-contracts/SKILL.md
    ops/
      computer/SKILL.md           # Ship's Computer protocols (exists)
    programs/                     # CPU task instructions (exists)
      readme/SKILL.md             # (exists)
      api-reference/SKILL.md      # (exists)
      code-review/SKILL.md        # (exists)
      security-scan/SKILL.md      # (exists, stub)
      refactor-analysis/SKILL.md  # (exists, stub)
  agents/
    ships-computer-cpu.md         # (exists) -- generic executor
```

### Knowledge skill contract

- **Format:** SKILL.md with standard frontmatter (name, description, `user-invocable: false`)
- **Location:** `skills/knowledge/{name}/SKILL.md`
- **Injection:** Dynamic -- listed in agent `skills:` frontmatter, loaded at dispatch time
- **Scope:** Plugin-shipped defaults. Users can add project-specific knowledge skills.
- **Size budget:** Each knowledge skill should be under 2,000 tokens
- **Frontmatter:** `user-invocable: false` hides from the `/` menu. These are background context for agents, not user-facing commands. Description is still required as a summary for consuming agents.

Example knowledge skill frontmatter:

```yaml
---
name: sidequest-core
description: Core utilities reference -- spawn, validation, test helpers. Injected into agents that need codebase context.
user-invocable: false
---
```

### Plugin.json registration

Only register the-bridge, active stations, and computer-operations as preloaded skills. Knowledge skills and programs are read dynamically at dispatch time, not preloaded at plugin init. This keeps the static token tax lean.

---

## 3. Command Map

Seven commands, each with a primary handler:

| Command | Primary Handler | TOS Parallel | What It Does |
|---------|----------------|-------------|-------------|
| `/enterprise:chart` | Spock (direct) | "Plot a course" / mission planning | Analyze requirements + codebase, produce implementation plan |
| `/enterprise:document` | Spock (dispatches Computer) | Science officer analysis | Generate documentation (README, API reference) |
| `/enterprise:log` | Spock (direct) | Captain's/science log | Session summary -- what changed, decisions, recap |
| `/enterprise:scan` | McCoy (medical station, dispatches Computer) | Medical tricorder | Code review -- diagnose issues, classify severity |
| `/enterprise:refit` | Scotty (engineering station, dispatches Computer) | Spacedock refit | Refactoring -- restructure, reduce complexity |
| `/enterprise:engage` | Spock (Lead -- coordinates only, never codes) | "Ahead warp factor 2" | Full pipeline: implement then review from a plan |
| `/enterprise:away-mission` | Spock (assembles landing party, user leads) | Beam down to planet | Explore unfamiliar code -- external deps, new codebase, deep debugging |

**Note on away-mission:** The user IS "the Captain" (Kirk) per the existing bridge SKILL.md. Kirk is not a separate AI crew member. Away-mission is user-led with Spock assembling the AI landing party as advisor.

---

## 4. Crew Roster & Skill Ownership

### Operational Crew (MVP)

**Spock** (Bridge -- First Officer / Science Officer)
- Action skills: spec-planning, session-log
- Voice: Precise, logical, no contractions, probability estimates
- Role: Lead orchestrator. Dispatches to stations and Computer. **Never executes programs directly** -- dispatches to Computer for documentation, analysis, etc. This avoids the "Lead That Codes" anti-pattern where the orchestrator loses the coordination thread.
- Existing: the-bridge SKILL.md, character voice spec

**McCoy** (Medical Station -- Chief Medical Officer)
- Action skills: code-review, security-scan
- Voice: Blunt, emotional, medical metaphors, "I'm a doctor, not a..."
- Role: Validator. Owns the review voice. In engage, McCoy is the read-only Validator agent (disallowedTools: Write, Edit, NotebookEdit).
- Existing: medical station SKILL.md, program-code-review, program-security-scan

**Scotty** (Engineering Station -- Chief Engineer)
- Action skills: refactor-analysis, build-config
- Voice: Practical, protective, proud of systems, "I'm giving her all she's got!"
- Role: Builder for infrastructure/refactoring work. In engage, Scotty's voice applies to the Builder agent for backend/infra tasks.
- Existing: engineering station SKILL.md (stub), program-refactor-analysis (stub)

**Ship's Computer** (Throughout -- shared execution resource)
- Executes programs dispatched by any officer
- Voice: Neutral, factual, "Working.", "Analysis complete."
- No ownership -- it is a tool, not a crew member
- Existing: computer-operations SKILL.md, ships-computer-cpu agent

### Future Crew (P3 expansion slots)

These officers are defined for future expansion. They do NOT get stations, SKILL.md files, voice specs, or programs until a concrete use case requires them. They are listed here to reserve the TOS mapping and prevent role collisions.

| Officer | Station | Future Role | Build Trigger |
|---------|---------|-------------|---------------|
| Sulu | Helm | Frontend implementation | When engage needs frontend-specific Builder voice |
| Chekov | Navigator | State/utilities | When engage needs state management specialization |
| Uhura | Comms | Integration testing | When cross-service contract validation is needed |
| Chapel | Sickbay | Design systems / a11y | When accessibility audit becomes a distinct phase |
| Rand | Yeoman | Scaffolding / formatting | When boilerplate generation is frequent enough to justify |
| Kyle | Transporter | Deployment / CI-CD | When deploy automation needs a specialized agent |

**Prerequisite for building any future crew member:** Extend `specs/enterprise-character-voices.md` with a full voice profile before implementing their station.

---

## 5. Knowledge Skills

Knowledge skills are NOT tasks. They are context that gets injected into officers at different phases. Same knowledge, different purpose depending on who is reading it.

| Knowledge Skill | What It Knows | Who Gets It Injected | Status |
|-----------------|--------------|---------------------|--------|
| sidequest-core | Core utilities (spawn, validation, test helpers) | Planner (Spock), Builder (Scotty), Validator (McCoy) | Planned |
| project-conventions | Biome config, naming rules, file structure, commit style | Builder, Validator | Planned |
| testing-patterns | Test structure, mock hygiene, cleanup, coverage | Builder, Validator (McCoy) | Planned |
| api-contracts | Endpoint shapes, auth patterns, error formats | Planner (Spock), Validator (McCoy) | Planned |

### Injection mechanism

Knowledge skills are listed in the `skills:` frontmatter of agent definitions. When an officer dispatches a sub-agent via the Task tool, the relevant knowledge skills are included in the agent's `skills:` array. The Claude Code runtime preloads those SKILL.md files into the agent's context at startup.

Example -- Builder agent for an engage dispatch:

```yaml
# Injected dynamically by Spock based on the plan
skills:
  - sidequest-core
  - project-conventions
  - testing-patterns
```

The key insight: a knowledge skill appears multiple times in a pipeline but serves different purposes:

- **Planner (Spock)** reads sidequest-core to know which utilities to reference in the plan
- **Builder (Scotty)** reads sidequest-core to know which imports to use
- **Validator (McCoy)** reads sidequest-core to flag cases where someone rolled their own instead of using core

---

## 6. The `engage` Pipeline

The most complex command. Designed around the Leader/Swarm + Builder/Validator orchestration pattern.

**Core principle:** Spock is the Lead. The Lead NEVER codes -- only coordinates via Task tools. Crew voices are applied to standard Builder/Validator agent roles.

### MVP engage (2-station)

```
/enterprise:engage [plan-reference]
    |
    v
SPOCK (Lead) reads the plan (from /enterprise:chart output)
    |
    1. TaskCreate for each implementation step
    |  - Assigns file boundaries per task (no two agents edit same file)
    |  - Sets dependencies via addBlockedBy
    |
    2. BUILDER (Scotty's voice) implements
    |  - Single foreground agent, opus model
    |  - Knowledge skills injected: sidequest-core, project-conventions
    |  - PostToolUse hooks: biome, tsc (via runner plugins)
    |  - Marks tasks completed via TaskUpdate
    |
    3. VALIDATOR (McCoy's voice) reviews the work
    |  - Read-only agent: disallowedTools: Write, Edit, NotebookEdit
    |  - Reports PASS/FAIL per acceptance criteria
    |  - If FAIL: resume Builder to fix, re-validate
    |
    v
"Mission complete, Captain."
```

### Why 2 agents, not 10

Each sub-agent dispatch costs ~4,000-7,000 tokens overhead. The original 5-station pipeline would cost $2.00-3.50 per run vs $0.43-0.50 for a single scan. The 2-station version keeps the cost at ~2x (Builder/Validator pattern) while delivering independent verification.

### Future engage (wave-based, when proven)

Once the 2-station MVP is proven, expand to wave-based execution with file boundaries:

```
Wave 1 (parallel, no deps):
  Task: Scaffold files (if needed)

Wave 2 (parallel, depends on Wave 1):
  Task: Implement feature A (Builder, Scotty voice, files: src/api/*)
  Task: Implement feature B (Builder, Sulu voice, files: src/ui/*)

Wave 3 (depends on Wave 2):
  Task: Validate all (Validator, McCoy voice, read-only)

Wave 4 (depends on Wave 3 PASS):
  Task: Build verification + tests
```

**Key constraint:** Distinct files per agent. Spock assigns file boundaries from the chart plan before dispatching builders. Two agents editing the same file means merge conflicts and lost work.

---

## 7. Implementation Priority

Which commands and stations to build next (after document + scan which are done):

| Priority | Command/Station | Why | Deliverable |
|----------|----------------|-----|-------------|
| P0 (done) | document, scan | Already operational | -- |
| P1 | chart | Spock's planning capability -- enables engage | Level 2 spec, then command + bridge reference |
| P1 | refit (Scotty) | Refactoring is high-value, self-contained | Level 2 spec, then engineering station + program |
| P1 | log | Observability backbone -- all other commands emit to it. Enables standups. | Level 2 spec, then bridge reference + event schema |
| P2 | engage (MVP) | 2-station: Builder + Validator. Requires chart. | Level 2 spec with Builder/Validator agent defs |
| P3 | away-mission | Exploratory, less structured | Level 2 spec (user-led, Spock advises) |
| P3 | Future crew | Sulu, Chekov, Uhura, Chapel, Rand, Kyle | Voice specs first, then stations as engage demands |
| P3 | Starfleet Command (orders, hail) | Stakeholder integration -- requires log + chart operational first | Level 2 spec for orders + hail commands |

### Immediate next steps after this taxonomy

1. Write Level 2 implementation spec for `/enterprise:chart`
2. Write Level 2 implementation spec for `/enterprise:refit`
3. Build chart command + bridge reference
4. Build refit command + engineering station + refactor-analysis program

---

## 8. Starfleet Command (future -- stakeholder integration layer)

In TOS, the Enterprise does not choose its own missions. Kirk receives orders from Starfleet Command -- admirals, commodores, and diplomats who define objectives, set constraints, and expect status reports. The crew executes; Command decides what is worth executing.

### The mapping

```
Starfleet Command (product owners, stakeholders, agile ceremonies)
  |
  | Mission orders (Jira tickets, GitHub issues, sprint goals)
  |
  v
The Captain (you) -- interprets, prioritizes, approves
  |
  v
Spock (chart) -- translates requirements into implementation plan
  |
  v
Crew (engage) -- executes the plan
  |
  | Status reports, mission logs
  |
  v
Starfleet Command (sprint review, stakeholder updates)
```

### Agile ceremonies as Starfleet communications

| Ceremony | TOS Parallel | What It Produces | Enterprise Connection |
|----------|-------------|-----------------|----------------------|
| Daily standup | Subspace check-in with Command | Status update -- what was done, what is next, blockers | `/enterprise:log` generates the standup summary from session activity |
| Sprint planning | Mission briefing from the Admiralty | Prioritized backlog for the sprint | Future `/enterprise:orders` pulls tickets, Spock charts them into plans |
| Sprint review | Mission debrief at Starbase | Demo of what shipped, stakeholder feedback | Future `/enterprise:hail` compiles what was delivered with before/after |
| Retrospective | Post-mission analysis | What worked, what did not, what to change | Future integration -- crew performance metrics, pattern analysis |

### Why this matters

The Enterprise plugin currently starts at "the Captain has a task." But in real teams, tasks originate from stakeholders via ceremonies. Connecting to that layer means:

- Sprint planning feeds directly into chart (mission orders become implementation plans)
- Standups are auto-generated from session logs (no manual status writing)
- Sprint reviews compile from engage outputs (what was built, what was reviewed)
- The Captain spends less time translating between stakeholder-speak and engineer-speak

### Future commands (P3)

| Command | TOS Parallel | What It Does |
|---------|-------------|-------------|
| `/enterprise:orders` | "New orders from Starfleet, Captain" | Pull and prioritize requirements from Jira/GitHub into mission briefing format |
| `/enterprise:hail` | "Hailing Starfleet Command" | Generate stakeholder-facing status (PR descriptions, standup summaries, sprint review decks) |

Not building this now. The crew needs to be operational before connecting to Command. But the architecture reserves the integration points: `log` already captures session activity (P1), and `chart` already translates requirements into plans (P1). Starfleet Command is the layer that feeds requirements in and receives status out.

---

## 9. Captain's Log (observability across the pipeline)

In TOS, Kirk dictates the Captain's Log as events unfold -- "Captain's Log, Stardate 4523.3..." -- creating a running narrative that any officer (or Starfleet Command) can review later. This is the Enterprise plugin's **observability layer**: a structured activity log that captures events across the entire pipeline.

### The problem it solves

Things happen throughout a session -- plans are written, code is implemented, reviews come back, PRs get comments, builds pass or fail. When someone at standup asks "what's the status?" or when you need to write a sprint review, that information is scattered across git logs, PR comments, session history, and your memory. The Captain's Log collects it in one place.

### Event types

| Event | TOS Parallel | Source | Example |
|-------|-------------|--------|---------|
| Plan created | "Plot laid in, Captain" | `/enterprise:chart` output | "Chart complete: 4 tasks, 3 files, est. 2 dispatches" |
| Implementation started | "Engaging at warp 2" | `/enterprise:engage` dispatch | "Builder dispatched: task 1/4, files: src/api/auth.ts" |
| Implementation completed | "We've arrived, Captain" | Builder TaskUpdate(completed) | "Task 1/4 complete: auth middleware, 3 files changed" |
| Review passed | "Clean bill of health" | Validator PASS report | "McCoy: PASS -- 4/4 checks, no issues" |
| Review failed | "He's dead, Jim" | Validator FAIL report | "McCoy: FAIL -- 2 issues: missing error handling, no tests" |
| Fix applied | "Damage repaired" | Builder resume after FAIL | "Builder resumed: fixed 2 issues from review" |
| PR created | "Hailing Starfleet" | `gh pr create` | "PR #42 opened: feat(auth): add JWT middleware" |
| PR comment received | "Incoming transmission" | `gh pr view` / webhook | "Comment from Josh: can we add refresh token support?" |
| PR merged | "Mission accomplished" | `gh pr merge` | "PR #42 merged to main" |
| Commit created | "Log entry recorded" | git commit | "feat(auth): add JWT middleware -- 4 files, +180 -12" |
| Scan completed | "Medical scan complete" | `/enterprise:scan` output | "Scan: 3 issues (1 critical, 2 minor)" |
| Refit completed | "She's ready, Captain" | `/enterprise:refit` output | "Refit: 2 files refactored, complexity reduced 40%" |

### Token telemetry

The #1 community pain point (624 upvotes on r/ClaudeCode, Feb 2026) is "black box" token consumption. Every Captain's Log event includes a `telemetry` block:

```yaml
telemetry:
  tokens_in: 4200        # Prompt tokens consumed
  tokens_out: 1800       # Completion tokens generated
  model: opus            # Model used
  duration_s: 54         # Wall clock seconds
  sub_agents: 1          # Number of sub-agent dispatches
  cost_est: "$0.12"      # Estimated cost (based on public pricing)
```

This enables:

- `/enterprise:log --filter=costs` -- "where did my budget go this session?"
- Per-command cost breakdown -- "chart costs $0.08 avg, engage costs $0.92 avg"
- Sprint-level cost tracking -- "this sprint burned $14.20 across 16 engage runs"
- Anomaly detection -- "this scan cost 3x the average, probably hit deep mode"

Token counts come from the Task tool's response metadata (already available in sub-agent results). No external proxy needed for v1.

### Log format

Structured, queryable markdown rendered from the JSONL source of truth:

```markdown
## Captain's Log -- Stardate 2026.02.16

### 09:15 -- Chart: auth-middleware
- **Event**: plan_created
- **Command**: /enterprise:chart
- **Summary**: 4 tasks, targeting src/api/auth/*, est. 2 Builder dispatches
- **Artifact**: specs/auth-middleware-plan.md
- **Telemetry**: 3.2k in / 1.1k out, opus, 12s, $0.08

### 09:22 -- Engage: task 1/4
- **Event**: implementation_started
- **Command**: /enterprise:engage
- **Officer**: Scotty (Builder)
- **Files**: src/api/auth/middleware.ts, src/api/auth/jwt.ts
- **Task**: "Create JWT validation middleware"

### 09:31 -- Engage: task 1/4
- **Event**: implementation_completed
- **Officer**: Scotty (Builder)
- **Duration**: 9 min
- **Files changed**: 3 (+180 -12)
- **Telemetry**: 8.4k in / 3.2k out, opus, 540s, $0.42

### 09:33 -- Review: task 1/4
- **Event**: review_passed
- **Officer**: McCoy (Validator)
- **Verdict**: PASS (4/4 checks)
- **Duration**: 2 min
- **Telemetry**: 6.1k in / 0.8k out, opus, 120s, $0.18

### Session totals
- **Events**: 4 | **Duration**: 18 min | **Cost**: $0.68
- **Tokens**: 17.7k in / 5.1k out | **Sub-agents**: 2
```

### Query patterns

| Question | Command | What It Returns |
|----------|---------|----------------|
| "What happened this session?" | `/enterprise:log` | Full session timeline |
| "What did we ship?" | `/enterprise:log --filter=merged,completed` | Only completed work and merged PRs |
| "What's blocking us?" | `/enterprise:log --filter=failed,comment` | Review failures and PR feedback |
| "Where did my budget go?" | `/enterprise:log --filter=costs` | Per-event token counts and cost estimates |
| "Generate my standup" | `/enterprise:hail --standup` (P3) | Yesterday's completions, today's plan, blockers |
| "Sprint review summary" | `/enterprise:hail --review` (P3) | All merged PRs + scan results for the sprint |

### Connection to existing commands

- `/enterprise:log` (P1) is the **reader** -- formats and queries the log
- The **Stop hook** (`hooks/captains-log.ts`) is the **writer** -- parses the session transcript and writes events at session end
- `/enterprise:hail` (P3, Starfleet Command) is the **reporter** -- compiles logs into stakeholder-facing summaries

Commands are no longer "writers" -- they execute their workflows without any logging responsibility. The hook detects their activity from the transcript and writes the corresponding events.

### Implementation -- three tiers

The log is NOT a separate system. Events are captured deterministically by a Stop hook that parses the session transcript at session end. No model discretion -- the hook fires automatically. Officers do not emit events; the hook extracts them from the transcript.

**Tier 1: JSONL on disk (the foundation)**

A Stop hook (`hooks/captains-log.ts`) fires at the end of every session. It reads the session transcript, scans for Enterprise command patterns (Skill invocations, Task dispatches with Builder/Validator prefixes), and appends one JSON object per detected event to a JSONL file:

```
logs/captains-log-2026-02-16.jsonl
```

Hook registration (`hooks/hooks.json`):

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/captains-log.ts",
        "timeout": 15
      }]
    }]
  }
}
```

The hook detects Enterprise events by scanning the transcript for:
- **Skill calls** matching `enterprise:*` commands (document, scan, refit, chart, engage, etc.)
- **Task dispatches** with description prefixes like `"Builder: ..."`, `"Validator: ..."`, `"Ship's Computer: ..."`

Each detected event is written as one JSON line:

```json
{"ts":"2026-02-16T09:15:03Z","event":"plan_created","command":"chart","officer":"spock","summary":"chart: invoked","telemetry":{"tokens_in":0,"tokens_out":0,"model":"unknown","duration_s":0,"sub_agents":0,"cost_est":"$0.00"}}
{"ts":"2026-02-16T09:22:18Z","event":"implementation_completed","command":"engage","officer":"scotty","summary":"Builder: Create JWT validation middleware","telemetry":{"tokens_in":0,"tokens_out":0,"model":"sonnet","duration_s":0,"sub_agents":1,"cost_est":"$0.00"}}
```

The JSONL file IS the integration point. It is just a file. Anything can read a file:

- A CI/CD pipeline can parse it
- A Slack webhook script can `cat | jq` summaries from it
- A Jira API script can update tickets from it
- A standup bot can read yesterday's log
- `/enterprise:log` reads it and renders human-friendly markdown
- `/enterprise:hail` (P3) reads it and compiles stakeholder reports

No SDK, no API client, no database. The simplest possible contract: **structured JSONL on disk, committed to git.**

**Why Stop hook instead of PostToolUse or fire-and-forget Tasks:**

| Approach | Pros | Cons |
|----------|------|------|
| PostToolUse on Task | Real-time per-event | Can't see Task output (tokens, duration). No tool_output in stdin. |
| Fire-and-forget Task (old approach) | Simple dispatch pattern | Depends on model discretion -- Step 7 gets skipped. Unreliable. |
| **Stop hook + transcript** | Deterministic. Gets full session. Single write at end. | Not real-time -- writes at session end. |

The Captain's Log is read via `/enterprise:log` which is a retrospective query. Real-time logging is Tier 3 (webhook, opt-in). For v1, writing all events at session end is correct and reliable.

**Tier 2: Human-readable markdown (the view layer)**

`/enterprise:log` reads the JSONL and renders it as the structured markdown shown above. The markdown is a **view**, not the source of truth. You can also run `/enterprise:log --save` to write a rendered markdown snapshot to `logs/captains-log-2026-02-16.md` for commit or sharing.

**Tier 3: Webhook (real-time, opt-in)**

For real-time integration with external services (Slack, Datadog, custom dashboards), a future PostToolUse hook could POST each event as it happens. This would complement the Stop hook (which writes the JSONL) with real-time notifications.

Configure with one env var:

```bash
export ENTERPRISE_WEBHOOK_URL="https://hooks.slack.com/services/T.../B.../..."
```

The webhook would be fire-and-forget. If it fails, the JSONL file still has the event. No data loss.

### Why three tiers

| Tier | Cost | Latency | Requires | Use Case |
|------|------|---------|----------|----------|
| JSONL on disk | Zero | Batch at session end | Stop hook (always on) | Default -- always on |
| Markdown view | Zero | On-demand (read + format) | `/enterprise:log` | Human consumption, standups |
| Webhook | Network call per event | ~100-500ms | Env var + endpoint | Real-time dashboards, Slack alerts |

Tier 1 is always on. Tiers 2 and 3 are opt-in. This keeps the observability layer zero-cost during normal operation while enabling any integration that can read a file or receive an HTTP POST.

---

## Prior Review Findings

Three prior reviews (in `specs/reviews/enterprise-v1-review-pass-{1,2,3}.md`) returned REQUEST CHANGES. This taxonomy addresses or acknowledges each critical finding:

| Prior Finding | Status | How Addressed |
|---------------|--------|---------------|
| **Pass 1: Misleading command surface** (7 commands registered, 2 implemented) | Addressed | Priority table (Section 7) explicitly sequences what gets built when. Stubs removed from root plugin.json until implemented. |
| **Pass 1: Boundary leak** (Spock both orchestrates AND executes) | Addressed | Section 4 explicitly states Spock "never executes programs directly -- dispatches to Computer." Documentation execution goes through Computer, not Spock. |
| **Pass 2: High cognitive load flags** | Deferred | Individual command UX is a Level 2 concern. Each command spec will address flag design. |
| **Pass 2: Mandatory confirmation friction** | Deferred | Level 2 concern. The `--yes` flag pattern from document/scan carries forward. |
| **Pass 3: ~6,500 static token tax** | Addressed | Section 2 specifies dynamic loading for knowledge skills and programs. Only bridge + active station + computer preloaded. |
| **Pass 3: Sub-agent overhead not justified** | Addressed | Section 6 redesigns engage as 2-station Builder/Validator (2x cost, not 5-10x). Single-dispatch commands (chart, refit, log) use the existing Computer CPU pattern. |
| **Pass 3: Max scan cost $0.43-0.50** | Acknowledged | Engage MVP targets ~2x scan cost ($0.86-1.00). Full wave-based engage deferred until MVP proves the economics. |

---

## Verification Checklist

After reading this spec, verify:

1. All 7 commands from `.claude-plugin/plugin.json` are listed in the command map (Section 3)
2. All 4 operational crew members (Spock, McCoy, Scotty, Computer) have voice profiles in `specs/enterprise-character-voices.md`
3. All 6 future crew members are listed as P3 expansion slots with build triggers (Section 4)
4. Every action skill has exactly one primary owner -- scan Section 4 for duplicates
5. Every knowledge skill lists specific injection targets and has a defined SKILL.md path (Sections 2 + 5)
6. The engage pipeline uses Leader/Swarm + Builder/Validator pattern with max 2-3 agents for MVP (Section 6)
7. No orphaned skills or characters without purpose -- every entry in Sections 4-5 traces to a command in Section 3
8. The Captain's Log event schema covers all command outputs (Section 9) -- every command in Section 3 appears as an event writer
9. Prior review findings from passes 1-3 are all addressed or explicitly deferred with rationale
