# Enterprise

A multi-agent orchestration plugin for Claude Code, themed around a Star Trek starship bridge. Spock coordinates a crew of specialized agents to handle documentation, code review, refactoring, implementation planning, and automated execution.

**No TypeScript source code** -- the entire system is defined through markdown skill definitions, agent configurations, and JSON manifests, orchestrated via Claude Code's agent/skill/tool infrastructure.

---

## Commands

| Command | Description |
|---------|-------------|
| `/enterprise:document` | Generate README or API reference for a codebase target |
| `/enterprise:scan` | Run code review diagnostics (security, performance, quality) |
| `/enterprise:chart` | Plan an implementation with tasks, dependencies, and file boundaries |
| `/enterprise:engage` | Execute a plan via Builder/Validator pipeline with automated retries |
| `/enterprise:refit` | Analyze code for refactoring opportunities |
| `/enterprise:log` | View session activity, token telemetry, and event history |
| `/enterprise:away-mission` | Explore unfamiliar code with guided reconnaissance |
| `/enterprise:orders` | Pull requirements from Jira or GitHub into a mission briefing |
| `/enterprise:hail` | Generate stakeholder reports (standups, sprint reviews, PR descriptions) |

### Common Flags

| Flag | Description |
|------|-------------|
| `--deep` | Larger analysis budget (50 files, 500 lines/file vs 20/300 default) |
| `--plain` | Drop all character voice globally |
| `--yes` | Skip confirmation when all parameters are explicit |
| `--type readme\|api` | Documentation type (for `/enterprise:document`) |
| `--focus security\|performance\|quality\|all` | Review focus (for `/enterprise:scan`) |

---

## Architecture

### Bridge Crew

The plugin models a Star Trek bridge with distinct crew roles mapped to Claude Code agents:

| Role | Agent | Model | Function |
|------|-------|-------|----------|
| **Captain** | User | -- | Issues commands, confirms parameters |
| **Spock** | the-bridge (skill) | opus | Science Officer - routes all commands, orchestrates workflows |
| **Dr. McCoy** | medical-station (skill) | sonnet | Chief Medical Officer - code review and diagnostics |
| **Scotty** | engineering-station (skill) | sonnet | Chief Engineer - refactoring analysis |
| **Ship's Computer** | ships-computer-cpu (agent) | sonnet | Analysis engine - reads codebase, generates reports |
| **Builder** | builder-scotty (agent) | sonnet | Implementation agent - writes code per plan tasks |
| **Validator** | validator-mccoy (agent) | opus | Review agent - read-only verdict (PASS/FAIL) |

### Information Flow

```
User Command
    |
    v
the-bridge (Spock)
    |--- Parse flags, confirm with Captain
    |
    |---> /scan ---------> medical-station (McCoy) ---> Ship's Computer
    |---> /refit --------> engineering-station (Scotty) -> Ship's Computer
    |---> /document -----> Ship's Computer (with program-readme or program-api-reference)
    |---> /chart --------> Spock reconnaissance -> plan file in specs/
    |---> /engage -------> Builder/Validator pipeline (per task in plan)
    |---> /log ----------> Read JSONL log, render timeline
    |---> /hail ---------> Generate stakeholder report from log
    |---> /orders -------> Pull requirements from Jira/GitHub
    |---> /away-mission -> Guided codebase exploration
```

### Skill Injection Pattern

Program skills are not standalone -- they are dynamically injected into Ship's Computer prompts:

- **program-readme** -- README generation instructions
- **program-api-reference** -- API documentation extraction
- **program-code-review** -- Security, performance, and quality analysis
- **program-refactor-analysis** -- Complexity, duplication, and coupling assessment

Knowledge skills are injected into Builder/Validator agents for project context:

- **sidequest-core** -- Core utilities reference
- **project-conventions** -- Naming, formatting, export rules
- **testing-patterns** -- Test structure, mocking, cleanup
- **api-contracts** -- API design, error handling patterns

---

## Key Design Patterns

### Builder/Validator Pipeline (`/engage`)

Tasks from a plan file are executed in dependency order:

1. **Builder (Scotty)** implements code changes (sonnet)
2. PostToolUse hooks run `biome check` and `tsc --noEmit` after every Write/Edit
3. **Validator (McCoy)** reviews changes for semantic correctness (opus, read-only)
4. On **FAIL**: Builder resumes with failure details (max 3 retries)
5. On **PASS**: task marked complete, next task begins

Two-tier validation: cheap mechanical (biome + tsc at sonnet cost) before expensive semantic review (opus).

### File Boundary Enforcement

Every file in a plan MUST be assigned to exactly one task. Before dispatching any Builder, the system validates file boundaries. If any file appears in multiple tasks, the entire pipeline aborts. This prevents merge conflicts in multi-agent execution.

### Parallel Dispatch

When `--deep` is set and file count exceeds thresholds:

1. File manifest is split into partitions (~20 files each, max 4)
2. Multiple Ship's Computer CPUs dispatch in a single message (parallel)
3. Results are collected, merged, and deduplicated

### Budget-Aware Analysis

Every analysis task has caps: `max_files` and `max_lines_per_file`. The Ship's Computer respects these, notes truncation, and includes telemetry in every report. This prevents runaway token usage on large codebases.

### Captain's Log

Officers emit JSONL events via fire-and-forget haiku Tasks:

```json
{
  "ts": "2026-02-16T10:30:00Z",
  "event": "documentation_completed",
  "command": "document",
  "officer": "spock",
  "summary": "README generated for plugins/enterprise",
  "telemetry": { "tokens_in": 12000, "tokens_out": 3400, "model": "sonnet" }
}
```

View with `/enterprise:log`. Generate reports with `/enterprise:hail`.

---

## Directory Structure

```
plugins/enterprise/
  plugin.json                          Plugin manifest
  .claude-plugin/plugin.json           Claude plugin metadata
  agents/
    ships-computer-cpu.md              Analysis engine agent
    builder-scotty.md                  Implementation agent
    validator-mccoy.md                 Code review agent
  skills/
    the-bridge/
      SKILL.md                         Main orchestrator (Spock)
      references/                      Command workflow documentation
        document.md, scan.md, chart.md, engage.md,
        log.md, refit.md, away-mission.md, orders.md, hail.md,
        no-topic-responses.md
    stations/
      medical/SKILL.md                 Dr. McCoy's code review station
      engineering/SKILL.md             Scotty's refactoring station
    ops/
      computer/SKILL.md                Ship's Computer operational protocols
    programs/
      readme/SKILL.md                  README generation program
      api-reference/SKILL.md           API reference program
      code-review/SKILL.md             Code review program
      refactor-analysis/SKILL.md       Refactoring analysis program
      security-scan/SKILL.md           Security scan (stub)
    knowledge/
      sidequest-core/SKILL.md          Core utilities reference
      project-conventions/SKILL.md     Coding standards
      testing-patterns/SKILL.md        Test patterns
      api-contracts/SKILL.md           API design patterns
  commands/
    document.md, scan.md, chart.md, engage.md,
    log.md, refit.md, away-mission.md, orders.md, hail.md
```

---

## Usage Examples

### Generate a README

```
/enterprise:document src/ --type readme
/enterprise:document src/ --type readme --deep --yes
```

### Run a code review

```
/enterprise:scan src/auth/ --focus security
/enterprise:scan . --focus all --deep
```

### Plan and execute

```
/enterprise:chart "Add JWT authentication middleware"
/enterprise:engage --plan specs/jwt-auth-plan.md
```

### Explore unfamiliar code

```
/enterprise:away-mission packages/core
```

### View session activity

```
/enterprise:log
/enterprise:log --filter scan
```

---

## Character Voice

All output is framed in Star Trek character voice by default:

- **Spock** -- No contractions, "Captain", Vulcan precision and logic
- **McCoy** -- Blunt, emotional, medical metaphors ("this code has a fever")
- **Scotty** -- Practical, Scottish, protective of the codebase ("she canna take much more")
- **Ship's Computer** -- Neutral, factual ("Working.", "Affirmative.")

Use `--plain` on any command to drop all character voice.

---

## License

MIT
