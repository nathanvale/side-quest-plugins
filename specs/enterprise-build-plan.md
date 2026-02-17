# Plan: Enterprise Plugin P1-P3 Build

## Task Description

Build the full Enterprise plugin from its Level 1 taxonomy spec (`specs/enterprise-skill-taxonomy.md`). This covers 8 phases: voice profiles, log command, chart command, refit command, plugin cleanup + knowledge skills, engage pipeline, away-mission, and Starfleet Command. All artifacts are markdown files (SKILL.md, command.md, reference docs, agent definitions) -- no TypeScript.

## Objective

When complete, the Enterprise plugin has 9 operational commands (`document`, `scan`, `log`, `chart`, `refit`, `engage`, `away-mission`, `orders`, `hail`), 4 voice profiles, 4 knowledge skills, 2 named agents (builder-scotty, validator-mccoy), JSONL observability, and a working Builder/Validator engage pipeline.

## Problem Statement

The Enterprise plugin currently has 2 commands (document, scan), 2 voice profiles (Spock, Computer), and stubs for engineering and programs. The taxonomy spec defines 7 more commands, 2 more voices, knowledge skills, and the engage pipeline -- none of which exist yet.

## Solution Approach

Build incrementally across 8 phases. Each phase produces working artifacts that can be verified independently. Phases 1-4 are foundation (independent, can parallelize). Phase 5 is cleanup + knowledge skills. Phase 6 is the engage pipeline. Phases 7-8 are P3 features.

**Key design decisions:**
1. Bridge stays thin -- route table rows only, workflow logic in references/
2. Log events via Task dispatch (haiku sub-agent with Bash access, ~$0.001/event)
3. Named agents for engage only -- generic ships-computer-cpu for everything else
4. Knowledge skills enhance but don't gate -- chart works without them
5. Sonnet for Builder, Opus for Validator in engage pipeline
6. File boundaries are non-negotiable -- chart output assigns distinct files per task

## Relevant Files

**Source of truth:**
- `specs/enterprise-skill-taxonomy.md` (559 lines) -- Level 1 architecture spec, defines all commands, crew, skill types

**Existing files to modify:**
- `plugins/enterprise/skills/the-bridge/SKILL.md` (142 lines) -- route table, Spock workflow. Add routes for log, chart, refit, engage, away-mission, orders, hail
- `plugins/enterprise/plugin.json` (15 lines) -- skill/command/agent registration
- `plugins/enterprise/.claude-plugin/plugin.json` -- public command catalog
- `specs/enterprise-character-voices.md` (122 lines) -- has Spock + Computer, needs McCoy + Scotty
- `plugins/enterprise/skills/stations/engineering/SKILL.md` (39 lines) -- stub, expand to full Scotty station
- `plugins/enterprise/skills/programs/refactor-analysis/SKILL.md` (40 lines) -- stub, expand to full program
- `plugins/enterprise/skills/stations/medical/SKILL.md` (245 lines) -- add log event emission
- `plugins/enterprise/skills/the-bridge/references/document.md` (271 lines) -- add log event emission

**Existing files for reference (read, don't modify):**
- `plugins/enterprise/agents/ships-computer-cpu.md` (17 lines) -- agent pattern template
- `plugins/enterprise/skills/ops/computer/SKILL.md` (113 lines) -- Computer protocols
- `plugins/enterprise/commands/document.md` (36 lines) -- command pattern template
- `plugins/enterprise/commands/scan.md` (38 lines) -- command pattern template
- `plugins/enterprise/skills/the-bridge/references/scan.md` -- reference pattern template

### New Files

**Phase 1:**
- (none -- modifying `specs/enterprise-character-voices.md`)

**Phase 2:**
- `plugins/enterprise/commands/log.md`
- `plugins/enterprise/skills/the-bridge/references/log.md`

**Phase 3:**
- `plugins/enterprise/commands/chart.md`
- `plugins/enterprise/skills/the-bridge/references/chart.md`

**Phase 4:**
- `plugins/enterprise/commands/refit.md`
- `plugins/enterprise/skills/the-bridge/references/refit.md`

**Phase 5:**
- `plugins/enterprise/skills/knowledge/sidequest-core/SKILL.md`
- `plugins/enterprise/skills/knowledge/project-conventions/SKILL.md`
- `plugins/enterprise/skills/knowledge/testing-patterns/SKILL.md`
- `plugins/enterprise/skills/knowledge/api-contracts/SKILL.md`

**Phase 6:**
- `plugins/enterprise/commands/engage.md`
- `plugins/enterprise/skills/the-bridge/references/engage.md`
- `plugins/enterprise/agents/builder-scotty.md`
- `plugins/enterprise/agents/validator-mccoy.md`

**Phase 7:**
- `plugins/enterprise/commands/away-mission.md`
- `plugins/enterprise/skills/the-bridge/references/away-mission.md`

**Phase 8:**
- `plugins/enterprise/commands/orders.md`
- `plugins/enterprise/commands/hail.md`
- `plugins/enterprise/skills/the-bridge/references/orders.md`
- `plugins/enterprise/skills/the-bridge/references/hail.md`

## Implementation Phases

### Phase 1: Foundation -- Voice Profiles

Add McCoy and Scotty voice sections to `specs/enterprise-character-voices.md`.

**McCoy (~60 lines):** Extract voice rules from `skills/stations/medical/SKILL.md:17-35`. Add franchise DNA (TOS + Films I-VI). Catchphrases: "I'm a doctor, not a...", "He's dead, Jim", "Dammit Jim". Adapted signature lines table for code review context.

**Scotty (~60 lines):** Practical, protective, proud of engineering. Franchise DNA: "I'm giving her all she's got!", "I cannae change the laws of physics!", "The haggis is in the fire now". Adapted signature lines table for refactoring context.

### Phase 2: Foundation -- Log Command

The observability backbone. Every subsequent command emits log events here.

1. Create `commands/log.md` (~30 lines) -- frontmatter, flags (`--filter`, `--save`, `--plain`), usage examples
2. Create `references/log.md` (~250 lines) -- JSONL event schema (12 event types from taxonomy Section 9), telemetry block structure, appendLog() contract (Task dispatch to haiku sub-agent), read/filter/render workflow, `--save` to markdown
3. Add `/enterprise:log` route to bridge SKILL.md + handler section referencing `references/log.md`

**appendLog() contract:** Officers emit events via Task dispatch:
```
Task({ subagent_type: "general-purpose", model: "haiku", description: "Append log event", prompt: "Append this JSON line to logs/captains-log-{date}.jsonl using Bash: {event JSON}" })
```

**Log reliability caveat:** Fire-and-forget means silent failures possible. Acceptable for v1 (logs are observability, not critical path). Revisit if Phase 8 `hail` builds on log data.

### Phase 3: Foundation -- Chart Command

Planning officer. Spock handles directly (same pattern as document).

1. Create `commands/chart.md` (~35 lines) -- flags (`--deep`, `--plain`, `--yes`)
2. Create `references/chart.md` (~180 lines) -- requirements gathering, codebase reconnaissance, plan output structure (tasks, dependencies, **file boundaries per task** required for engage), markdown plan file output, log event emission
3. Add `/enterprise:chart` route to bridge SKILL.md

### Phase 4: Foundation -- Refit Command

Engineering station. Validates station pattern for Scotty.

1. Create `commands/refit.md` (~38 lines) -- flags (`--focus complexity|duplication|coupling|all`, `--deep`, `--plain`, `--yes`)
2. Create `references/refit.md` (~80 lines) -- flag parsing, route to engineering station
3. Add `/enterprise:refit` route to bridge SKILL.md
4. Expand `stations/engineering/SKILL.md` (39 -> ~250 lines) -- full Scotty voice, 6-step workflow mirroring medical station exactly
5. Expand `programs/refactor-analysis/SKILL.md` (40 -> ~150 lines) -- full program instructions for Computer CPU

### Phase 5: Integration -- Cleanup + Knowledge Skills + Log Retrofit

Three concerns, one phase.

**Registration cleanup:**
- Update `plugin.json` -- skills, commands, agents arrays
- Update `.claude-plugin/plugin.json` -- full command catalog, bridge-only skill

**Log retrofit:**
- Add appendLog to `references/document.md` (documentation_completed event)
- Add appendLog to `stations/medical/SKILL.md` (scan_completed event)
- Verify engineering already has refit_completed from Phase 4

**Knowledge skills (4 new SKILL.md files under `skills/knowledge/`):**
- `sidequest-core` (~150 lines) -- core utilities, import patterns, builder/validator guidance
- `project-conventions` (~120 lines) -- biome config, naming, file structure, commits
- `testing-patterns` (~130 lines) -- test structure, mock hygiene, resource cleanup
- `api-contracts` (~140 lines) -- endpoint shapes, auth, error format, schemas

All knowledge skills: `user-invocable: false`, under 2,000 tokens each.

### Phase 6: Core -- Engage Pipeline

2-station Builder/Validator MVP.

1. Create `commands/engage.md` (~40 lines) -- flags (`--plan <path>`, `--skip-validation`, `--plain`, `--yes`)
2. Create `references/engage.md` (~300 lines) -- read plan, TaskCreate with file boundaries, Builder dispatch (sonnet), Validator dispatch (opus), PASS/FAIL with max 3 retries, log events at every stage, error recovery
3. Create `agents/builder-scotty.md` (~80 lines) -- model: sonnet, full tools, dynamically injected knowledge skills, Scotty voice
4. Create `agents/validator-mccoy.md` (~70 lines) -- model: opus, disallowedTools: Write/Edit/NotebookEdit, McCoy voice, PASS/FAIL reporting
5. Add `/enterprise:engage` route to bridge SKILL.md
6. Register agents in plugin.json

### Phase 7: P3 -- Away-Mission

User-led exploration with Spock as advisor.

1. Create `commands/away-mission.md` (~35 lines)
2. Create `references/away-mission.md` (~180 lines) -- landing party assembly, reconnaissance suggestions, iterative Q&A, log events
3. Add route to bridge, register command

### Phase 8: P3 -- Starfleet Command

External integration + reporting.

1. Create `commands/orders.md` (~40 lines) -- pull from Jira/GitHub
2. Create `commands/hail.md` (~40 lines) -- generate standup/review/PR descriptions from logs
3. Create `references/orders.md` (~200 lines) -- mission briefing format, feed to chart
4. Create `references/hail.md` (~220 lines) -- read JSONL, stakeholder-facing output
5. Add 2 routes to bridge, register commands

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. Use Task and Task* tools only.
- Take note of the session id (agentId) of each team member for resume operations.
- This is a **markdown-only** plugin. No TypeScript compilation, no test suite. Validation is structural (file exists, frontmatter parses, references resolve, line counts within budget).

### Model Selection Guide

| Role | Model | Rationale |
|------|-------|-----------|
| All builders | sonnet | Executes well-specified markdown writing tasks reliably |
| All validators | haiku | Mechanical checks: file exists, frontmatter valid, line count, cross-references |

### Team Members

- Builder
  - Name: builder-voices
  - Role: Write McCoy and Scotty voice profiles
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-log
  - Role: Create log command, reference doc, and bridge route
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-chart
  - Role: Create chart command, reference doc, and bridge route
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-refit
  - Role: Create refit command, reference doc, expand engineering station + refactor-analysis program
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-cleanup
  - Role: Plugin registration, log retrofit, knowledge skills
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-engage
  - Role: Create engage command, reference doc, builder-scotty + validator-mccoy agents
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Builder
  - Name: builder-p3
  - Role: Create away-mission + Starfleet Command commands and references
  - Agent Type: general-purpose
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-foundation
  - Role: Validate Phases 1-4 (voices, log, chart, refit)
  - Agent Type: general-purpose
  - Model: haiku
  - Resume: true

- Validator
  - Name: validator-integration
  - Role: Validate Phase 5 (registration, log retrofit, knowledge skills)
  - Agent Type: general-purpose
  - Model: haiku
  - Resume: true

- Validator
  - Name: validator-engage
  - Role: Validate Phase 6 (engage pipeline, agents, bridge route)
  - Agent Type: general-purpose
  - Model: haiku
  - Resume: true

- Validator
  - Name: validator-final
  - Role: End-to-end validation of all 9 commands, all references, bridge line count
  - Agent Type: general-purpose
  - Model: haiku
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.
- **IMPORTANT:** Phases 1-4 builders operate on distinct files and CAN run in parallel.
- Each builder prompt MUST include: (a) the full content of reference files it needs to read as patterns, (b) the taxonomy spec sections relevant to its work, (c) explicit file paths for every file to create or modify.

### 1. Write Voice Profiles (McCoy + Scotty)
- **Task ID**: build-voices
- **Depends On**: none
- **Assigned To**: builder-voices
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (Wave 1)
- Read `specs/enterprise-character-voices.md` -- understand Spock and Computer sections as the pattern
- Read `plugins/enterprise/skills/stations/medical/SKILL.md:17-35` -- extract McCoy's existing voice rules
- Read `plugins/enterprise/skills/stations/engineering/SKILL.md:32-33` -- Scotty's voice stub
- Add McCoy section (~60 lines) to character-voices.md after the Computer section: Voice Profile, Franchise DNA (TOS episodes + Films I-VI), Adapted Signature Lines table for code review context
- Add Scotty section (~60 lines) after McCoy: Voice Profile (practical, protective, proud, accent inflections), Franchise DNA, Adapted Signature Lines table for refactoring context
- Follow the exact structure of the Spock and Computer sections (### Voice Profile, ### Franchise DNA, ### Adapted Signature Lines)
- McCoy catchphrases: "I'm a doctor, not a {X}!", "He's dead, Jim.", "Dammit Jim", "I can fix that.", "The patient is in good health, Captain."
- Scotty catchphrases: "I'm giving her all she's got!", "I cannae change the laws of physics!", "The haggis is in the fire now", "Aye, she'll hold together."

### 2. Build Log Command + Reference
- **Task ID**: build-log
- **Depends On**: none
- **Assigned To**: builder-log
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (Wave 1)
- Read `plugins/enterprise/commands/document.md` and `commands/scan.md` as command pattern templates
- Read `plugins/enterprise/skills/the-bridge/references/document.md` as reference doc pattern
- Read `specs/enterprise-skill-taxonomy.md` Section 9 (Captain's Log) for event schema
- Create `plugins/enterprise/commands/log.md` (~30 lines): frontmatter (name: log, description, skill: the-bridge, argument-hint with flags), usage examples, flag table (`--filter=costs|merged|completed|failed`, `--save`, `--plain`)
- Create `plugins/enterprise/skills/the-bridge/references/log.md` (~250 lines): JSONL event schema (all 12 event types), telemetry block structure (tokens_in, tokens_out, model, duration_s, sub_agents, cost_est), JSONL file location `logs/captains-log-{date}.jsonl`, read + filter + render workflow (Spock handles directly), markdown output format (stardate headers, event details, session totals), `--save` workflow, appendLog() contract as Task dispatch pattern
- Edit `plugins/enterprise/skills/the-bridge/SKILL.md` -- add `/enterprise:log` row to route table (after scan row) and add a "Workflow: /enterprise:log" section that says "Read references/log.md and follow instructions. Spock handles directly."
- CONSTRAINT: Bridge SKILL.md must stay under 250 lines total

### 3. Build Chart Command + Reference
- **Task ID**: build-chart
- **Depends On**: none
- **Assigned To**: builder-chart
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (Wave 1)
- Read `plugins/enterprise/commands/document.md` as command pattern template
- Read `plugins/enterprise/skills/the-bridge/references/document.md` as reference doc pattern
- Read `specs/enterprise-skill-taxonomy.md` Sections 3 (Command Map) and 6 (Engage Pipeline) for chart requirements
- Create `plugins/enterprise/commands/chart.md` (~35 lines): frontmatter, flags (`--deep`, `--plain`, `--yes`), usage examples
- Create `plugins/enterprise/skills/the-bridge/references/chart.md` (~180 lines): requirements gathering (from $ARGUMENTS or interactive via AskUserQuestion), codebase reconnaissance (Glob target, Read key files), plan output structure (tasks with IDs, dependencies via addBlockedBy, **file boundaries per task** -- REQUIRED for engage, acceptance criteria per task), output format (markdown plan file saved to working directory), log event emission (`plan_created` with telemetry), confirmation flow (unless --yes)
- Edit bridge SKILL.md -- add route table row and workflow section for chart (same pattern as log: "Read references/chart.md and follow instructions")
- CONSTRAINT: Bridge SKILL.md must stay under 250 lines total

### 4. Build Refit Command + Engineering Station
- **Task ID**: build-refit
- **Depends On**: none
- **Assigned To**: builder-refit
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: true (Wave 1)
- Read `plugins/enterprise/commands/scan.md` as command pattern (refit mirrors scan)
- Read `plugins/enterprise/skills/the-bridge/references/scan.md` as reference pattern
- Read `plugins/enterprise/skills/stations/medical/SKILL.md` (245 lines) as the EXACT station pattern to mirror
- Read `plugins/enterprise/skills/programs/code-review/SKILL.md` as program pattern
- Read `plugins/enterprise/skills/stations/engineering/SKILL.md` (stub)
- Read `plugins/enterprise/skills/programs/refactor-analysis/SKILL.md` (stub)
- Read `specs/enterprise-character-voices.md` for Scotty voice (NOTE: if voices aren't written yet because tasks run in parallel, use the stub voice from engineering SKILL.md and the plan description: practical, protective, proud, accent inflections)
- Create `plugins/enterprise/commands/refit.md` (~38 lines): frontmatter, flags (`--focus complexity|duplication|coupling|all`, `--deep`, `--plain`, `--yes`), usage examples
- Create `plugins/enterprise/skills/the-bridge/references/refit.md` (~80 lines): flag parsing (mirror scan.md), route to engineering station with parsed params
- Expand `plugins/enterprise/skills/stations/engineering/SKILL.md` (39 -> ~250 lines): MIRROR medical-station structure EXACTLY. Full Scotty voice (blunt, protective, proud, accent inflections, "Captain" address). Step 1: Confirm (AskUserQuestion unless --yes). Step 2: Reconnaissance (Glob). Step 3: Read refactor-analysis program. Step 4: Dispatch Computer CPU (single or parallel with --deep). Step 5: Collect results (TaskOutput). Step 6: Present with Scotty voice framing + telemetry footer. Follow-up options. Emit `refit_completed` log event via appendLog.
- Expand `plugins/enterprise/skills/programs/refactor-analysis/SKILL.md` (40 -> ~150 lines): full program instructions for Computer CPU. Complexity detection (deep nesting, long functions, cyclomatic complexity). Duplication detection. Coupling analysis (import chains, circular deps). Output: categorized suggestions with priority, before/after sketches. Telemetry section.
- Edit bridge SKILL.md -- add route table row and workflow section for refit
- CONSTRAINT: Bridge SKILL.md must stay under 250 lines total

### 5. Validate Foundation (Phases 1-4)
- **Task ID**: validate-foundation
- **Depends On**: build-voices, build-log, build-chart, build-refit
- **Assigned To**: validator-foundation
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: false
- **Checks:**
  - `specs/enterprise-character-voices.md` has exactly 4 sections (Spock, Computer, McCoy, Scotty) with ### Voice Profile, ### Franchise DNA, ### Adapted Signature Lines in each
  - `plugins/enterprise/commands/log.md` exists with valid frontmatter (name: log, skill: the-bridge)
  - `plugins/enterprise/skills/the-bridge/references/log.md` exists and contains appendLog() contract
  - `plugins/enterprise/commands/chart.md` exists with valid frontmatter
  - `plugins/enterprise/skills/the-bridge/references/chart.md` exists and contains "file boundaries" requirement
  - `plugins/enterprise/commands/refit.md` exists with valid frontmatter
  - `plugins/enterprise/skills/the-bridge/references/refit.md` exists
  - `plugins/enterprise/skills/stations/engineering/SKILL.md` is >200 lines with Scotty voice rules and 6-step workflow
  - `plugins/enterprise/skills/programs/refactor-analysis/SKILL.md` is >100 lines with full program instructions
  - `plugins/enterprise/skills/the-bridge/SKILL.md` route table has 6 entries (document, scan, log, chart, refit, + stub placeholder) AND file is under 250 lines
  - No broken references -- every file path mentioned in bridge route table exists

### 6. Build Cleanup + Knowledge Skills + Log Retrofit
- **Task ID**: build-cleanup
- **Depends On**: validate-foundation
- **Assigned To**: builder-cleanup
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false
- Read current `plugins/enterprise/plugin.json` and `plugins/enterprise/.claude-plugin/plugin.json`
- Read `specs/enterprise-skill-taxonomy.md` Sections 2 (Filesystem Layout) and 5 (Knowledge Skills)
- **Registration cleanup:**
  - Update `plugins/enterprise/plugin.json`: skills array = `["./skills/the-bridge", "./skills/stations/medical", "./skills/stations/engineering", "./skills/ops/computer"]`, commands array = `["./commands/document.md", "./commands/scan.md", "./commands/log.md", "./commands/chart.md", "./commands/refit.md"]`, agents array = `["./agents/ships-computer-cpu.md"]`
  - Update `plugins/enterprise/.claude-plugin/plugin.json`: commands lists all 7 core commands (document, scan, log, chart, refit, engage, away-mission), skills = `["./skills/the-bridge"]` only
- **Log retrofit:**
  - Edit `plugins/enterprise/skills/the-bridge/references/document.md` -- add appendLog `documentation_completed` event emission after Step 6 (Present to Captain), before Follow-Up section. Use the same Task dispatch pattern from references/log.md.
  - Edit `plugins/enterprise/skills/stations/medical/SKILL.md` -- add appendLog `scan_completed` event emission after Step 6 (Present to Captain), before Follow-Up section
  - Verify `plugins/enterprise/skills/stations/engineering/SKILL.md` already has `refit_completed` emission from Phase 4
- **Knowledge skills** (create 4 files under `plugins/enterprise/skills/knowledge/`):
  - `sidequest-core/SKILL.md` (~150 lines): frontmatter with `name: sidequest-core`, `description: Core utilities and patterns for the SideQuest monorepo. Injected into Builder agents for implementation guidance and Validator agents for convention enforcement.`, `user-invocable: false`. Body: spawn utility patterns, validation helpers, test utilities, import patterns with examples, "What builders need" section, "What validators need" section.
  - `project-conventions/SKILL.md` (~120 lines): frontmatter with `user-invocable: false`. Body: Biome config (tabs, single quotes, 80-char), naming conventions (kebab-case files, camelCase functions, PascalCase types), file structure patterns, commit format (conventional commits).
  - `testing-patterns/SKILL.md` (~130 lines): frontmatter with `user-invocable: false`. Body: test structure (describe/it, colocated test files), mock hygiene (cleanup, no leaked state), resource cleanup (afterEach patterns), coverage expectations.
  - `api-contracts/SKILL.md` (~140 lines): frontmatter with `user-invocable: false`. Body: endpoint shapes, auth patterns, error format conventions, request/response schemas.
- CONSTRAINT: Each knowledge SKILL.md under 2,000 tokens

### 7. Validate Integration (Phase 5)
- **Task ID**: validate-integration
- **Depends On**: build-cleanup
- **Assigned To**: validator-integration
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: false
- **Checks:**
  - `plugins/enterprise/plugin.json` has correct skills, commands, and agents arrays
  - `.claude-plugin/plugin.json` lists all 7 core commands and only the-bridge skill
  - `references/document.md` contains "documentation_completed" and appendLog pattern
  - `stations/medical/SKILL.md` contains "scan_completed" and appendLog pattern
  - `stations/engineering/SKILL.md` contains "refit_completed"
  - All 4 knowledge skills exist under `skills/knowledge/` with `user-invocable: false` in frontmatter
  - Each knowledge SKILL.md is under 200 lines (proxy for 2,000 tokens)
  - No orphaned files -- every file in plugin.json arrays actually exists

### 8. Build Engage Pipeline
- **Task ID**: build-engage
- **Depends On**: validate-integration
- **Assigned To**: builder-engage
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false
- Read `specs/enterprise-skill-taxonomy.md` Section 6 (Engage Pipeline)
- Read `plugins/enterprise/agents/ships-computer-cpu.md` as agent definition pattern
- Read `specs/enterprise-character-voices.md` for McCoy and Scotty voice profiles
- Read `plugins/enterprise/skills/the-bridge/references/document.md` as reference doc pattern
- Create `plugins/enterprise/commands/engage.md` (~40 lines): frontmatter (name: engage, skill: the-bridge), flags (`--plan <path>`, `--skip-validation`, `--plain`, `--yes`), usage examples
- Create `plugins/enterprise/skills/the-bridge/references/engage.md` (~300 lines):
  - Read plan file (from chart output or user-provided `--plan` path)
  - Validate plan has file boundaries per task (abort if missing)
  - TaskCreate for each implementation step with file boundaries and addBlockedBy
  - Builder dispatch: `Task({ subagent_type: "enterprise:builder-scotty", model: "sonnet" })` with knowledge skills injected in prompt
  - Validator dispatch: `Task({ subagent_type: "enterprise:validator-mccoy", model: "opus" })` with acceptance criteria
  - PASS/FAIL logic: if FAIL, resume Builder (using agentId) with FAIL details, re-validate. Max 3 retries (resume preserves context so retries are cheap). 4 consecutive FAILs -> abort, present accumulated issues to Captain
  - Log events at every stage: implementation_started, implementation_completed, review_passed, review_failed, fix_applied
  - Session totals summary
  - Error recovery: Builder timeout -> abort with partial log
- Create `plugins/enterprise/agents/builder-scotty.md` (~80 lines):
  - Frontmatter: name: builder-scotty, description (use proactively for implementation tasks), model: sonnet, tools (full set), skills (dynamically list: sidequest-core, project-conventions, testing-patterns)
  - Body: Scotty voice rules (reference character-voices.md patterns). "You are Mr. Scott, Chief Engineer." Task execution workflow: read task from prompt, implement, mark complete via TaskUpdate. Report format (files changed, what was done). Stay focused on single task, do not expand scope.
  - PostToolUse hooks for biome, tsc if available
- Create `plugins/enterprise/agents/validator-mccoy.md` (~70 lines):
  - Frontmatter: name: validator-mccoy, description, model: opus, tools: [Read, Glob, Grep, Bash], disallowedTools: [Write, Edit, NotebookEdit]
  - Body: McCoy voice rules. "You are Dr. McCoy. You inspect, you do NOT modify." Validation workflow: read task + acceptance criteria via TaskGet, inspect files (read-only), run validation commands, report PASS/FAIL with specific details. If FAIL, list every issue with file path and line reference.
- Edit bridge SKILL.md -- add `/enterprise:engage` route table row + workflow section ("Read references/engage.md and follow instructions")
- Edit `plugins/enterprise/plugin.json` -- add `"./agents/builder-scotty.md"`, `"./agents/validator-mccoy.md"` to agents array, add `"./commands/engage.md"` to commands array
- CONSTRAINT: Bridge SKILL.md must stay under 250 lines total

### 9. Validate Engage Pipeline
- **Task ID**: validate-engage
- **Depends On**: build-engage
- **Assigned To**: validator-engage
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: false
- **Checks:**
  - `commands/engage.md` exists with valid frontmatter (name: engage, skill: the-bridge)
  - `references/engage.md` exists, contains "file boundaries", "TaskCreate", "PASS/FAIL", "resume", "4 consecutive FAILs"
  - `agents/builder-scotty.md` exists with frontmatter: model: sonnet, has skills field
  - `agents/validator-mccoy.md` exists with frontmatter: model: opus, has disallowedTools containing Write and Edit and NotebookEdit
  - Bridge SKILL.md route table has engage entry, file is under 250 lines
  - `plugin.json` agents array contains builder-scotty and validator-mccoy
  - `plugin.json` commands array contains engage
  - No broken references in engage.md -- all skill paths and agent names resolve

### 10. Build P3 Commands (Away-Mission + Starfleet Command)
- **Task ID**: build-p3
- **Depends On**: validate-engage
- **Assigned To**: builder-p3
- **Agent Type**: general-purpose
- **Model**: sonnet
- **Parallel**: false
- Read existing command and reference patterns
- **Away-Mission:**
  - Create `plugins/enterprise/commands/away-mission.md` (~35 lines): frontmatter, flags (`--target <path>`, `--focus <aspect>`, `--plain`), usage examples
  - Create `plugins/enterprise/skills/the-bridge/references/away-mission.md` (~180 lines): user-led exploration (Captain drives, Spock advises), landing party assembly (Computer for analysis, McCoy for diagnostics if needed), reconnaissance suggestions (dependency graph, entry points, patterns), iterative Q&A flow via AskUserQuestion, log event emission
- **Starfleet Command:**
  - Create `plugins/enterprise/commands/orders.md` (~40 lines): frontmatter, flags (`--source jira|github`, `--sprint <id>`, `--plain`)
  - Create `plugins/enterprise/commands/hail.md` (~40 lines): frontmatter, flags (`--target standup|review|pr`, `--since <date>`, `--plain`)
  - Create `plugins/enterprise/skills/the-bridge/references/orders.md` (~200 lines): pull requirements from Jira/GitHub via Bash (gh CLI), convert to mission briefing format, feed to chart, log event emission
  - Create `plugins/enterprise/skills/the-bridge/references/hail.md` (~220 lines): read JSONL log events, generate standup/review/PR descriptions, stakeholder-facing output (professional, no character voice regardless of --plain)
- Edit bridge SKILL.md -- add 3 route table rows (away-mission, orders, hail)
- Edit both plugin.json files -- add commands
- CONSTRAINT: Bridge SKILL.md must stay under 250 lines total

### 11. Final Validation
- **Task ID**: validate-all
- **Depends On**: build-p3
- **Assigned To**: validator-final
- **Agent Type**: general-purpose
- **Model**: haiku
- **Parallel**: false
- **End-to-end checks:**
  - All 9 commands exist with valid frontmatter: document, scan, log, chart, refit, engage, away-mission, orders, hail
  - All 9 commands have `skill: the-bridge` in frontmatter
  - Bridge SKILL.md route table has 9 entries (or 7 core + 2 stub references for orders/hail)
  - Bridge SKILL.md is under 250 lines
  - All 4 voice profiles in character-voices.md (Spock, Computer, McCoy, Scotty)
  - All 4 knowledge skills exist with `user-invocable: false`
  - Both agents (builder-scotty, validator-mccoy) exist with correct model and tool restrictions
  - `plugin.json` skills array has exactly: the-bridge, stations/medical, stations/engineering, ops/computer
  - `plugin.json` agents array has exactly: ships-computer-cpu, builder-scotty, validator-mccoy
  - Every reference file mentioned in bridge route table exists on disk
  - No file exceeds 300 lines (except references/engage.md which can be up to 350)
  - Log retrofit: document.md contains "documentation_completed", medical SKILL.md contains "scan_completed", engineering SKILL.md contains "refit_completed"

## Acceptance Criteria

1. 9 command files exist with valid frontmatter under `plugins/enterprise/commands/`
2. 4 voice profiles (Spock, Computer, McCoy, Scotty) in `specs/enterprise-character-voices.md`
3. Bridge SKILL.md under 250 lines with route table entries for all commands
4. Engineering station expanded to ~250 lines mirroring medical station pattern
5. Refactor-analysis program expanded to ~150 lines with full Computer CPU instructions
6. Log reference doc contains appendLog() contract and 12 event types
7. Chart reference doc requires file boundaries per task in plan output
8. Engage reference doc has Builder/Validator flow with PASS/FAIL, max 3 retries, file boundary enforcement
9. builder-scotty agent: model sonnet, full tools, knowledge skills
10. validator-mccoy agent: model opus, disallowedTools Write/Edit/NotebookEdit
11. 4 knowledge skills under skills/knowledge/ with user-invocable: false, each under 200 lines
12. plugin.json correctly registers all skills, commands, and agents
13. Log retrofit: document, scan, and refit all emit log events
14. No broken references or orphaned files

## Validation Commands

This is a markdown-only plugin. No TypeScript compilation or test suite. Validation is structural:

- `ls plugins/enterprise/commands/*.md | wc -l` -- should be 9
- `grep -c "skill: the-bridge" plugins/enterprise/commands/*.md` -- all 9 should match
- `wc -l plugins/enterprise/skills/the-bridge/SKILL.md` -- must be under 250
- `grep "user-invocable: false" plugins/enterprise/skills/knowledge/*/SKILL.md` -- all 4 should match
- `grep "disallowedTools" plugins/enterprise/agents/validator-mccoy.md` -- should contain Write, Edit, NotebookEdit
- `grep "model: sonnet" plugins/enterprise/agents/builder-scotty.md` -- should match
- `grep "model: opus" plugins/enterprise/agents/validator-mccoy.md` -- should match

## Notes

- **Bridge line budget:** The bridge SKILL.md MUST stay under 250 lines. Every new command adds ONLY a route table row + a short workflow section that says "Read references/X.md and follow instructions." All workflow logic lives in reference files.
- **appendLog pattern:** Officers don't have Bash access. They emit log events by dispatching a lightweight haiku sub-agent: `Task({ subagent_type: "general-purpose", model: "haiku", prompt: "Append this JSON line to logs/... using Bash: ..." })`. Cost: ~$0.001 per event.
- **File boundaries:** Chart output MUST include file assignments per task. Engage validates boundaries before dispatching -- two Builder dispatches must never edit the same file.
- **Named agents for engage only:** The generic ships-computer-cpu pattern continues for document, scan, and refit. Builder-scotty and validator-mccoy are justified because they need distinct tool permissions and persistent voice.
- **Knowledge skills enhance but don't gate:** Chart works without knowledge skills. They're built in Phase 5 before engage needs them for injection.
- **Log reliability:** Fire-and-forget means silent failures. Acceptable for v1. Revisit if Phase 8 `hail` builds on log data.
- **Wave 1 parallelism:** Tasks 1-4 (build-voices, build-log, build-chart, build-refit) operate on distinct files and can run in parallel. The bridge SKILL.md is the only shared file -- each builder adds its own route. To avoid conflicts, consider having each builder output their bridge additions separately and having the lead merge them, OR run them sequentially. Sequential is safer for v1.
- **Taxonomy spec is source of truth:** Builders should read `specs/enterprise-skill-taxonomy.md` sections relevant to their work. Do not deviate from the spec's filesystem layout, event types, or crew assignments.
