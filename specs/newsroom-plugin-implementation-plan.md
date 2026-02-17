# Plan: Newsroom Plugin - First Room in the Orchestration System

## Context

Nathan is building a 4-room agentic orchestration system (Newsroom, Enterprise, Garden, Dojo) connected by a Wire Service plugin. The Newsroom ships first. Two staff engineer reviews + a Codex architecture consultation + a 3-pass review (Architect, Cost Analyst, DX Advocate) shaped this plan.

Key decisions:
- **Task system IS the wire** -- TaskCreate with structured metadata replaces filesystem messaging
- **Each room is a standalone marketplace plugin** -- no hard dependencies
- **Metaphor names everywhere** -- ADHD cognitive handles
- **Agent Teams is a future upgrade path** -- build on stable Task primitives now
- **All ~25 spec roles stay as vision** -- only v1 crew gets built
- **Newsroom is the new home** -- research plugin untouched, both coexist for now

---

## Review-Driven Changes

Issues addressed from 3-pass Codex review (specs/reviews/newsroom-plugin-review-pass-{1,2,3}.md):

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Wire contract convention-only | Validation checklist in wire-protocol.md; the-desk validates before TaskCreate |
| 2 | Wire durability underspecified | **Session-scoped ephemeral** for v1; cross-session is wire-service plugin later |
| 3 | Reference duplication drift | Both coexist for now; newsroom becomes primary when ready |
| 4 | the-morgue/the-wire invocation unclear | **Converted to reference docs** inside the-desk/references/ (not separate skills) |
| 5 | Beat-reporter context ambiguous | **Inline** cli-quick-ref into agent body (always needs CLI, cheaper than Read) |
| 6 | Default dispatch loads too many refs | mode-playbook and wire-protocol reads are **conditional** on flags |
| 7 | No budget guardrails | Hard caps in orchestration.md: max 5 topics, max 3 web pages/reporter (quick) |
| 8 | Parallel fanout cost | Accepted -- wall-clock time savings outweigh token cost for 1-3 topics |
| 9 | Wire TaskList growth | Session-scoped wire naturally limits this |
| 10 | Migration undefined | Deferred -- both plugins coexist, no redirect needed for MVP |
| 11 | Flag overload (13+) | Consolidate mode into `--mode recon\|changes\|sentiment\|verify` (1 flag vs 4) |
| 12 | Dead affordances (brief, wire-check) | **Deferred to v1.1** -- v1 ships dispatch + stakeout only |
| 13 | Failure UX missing | Error message templates added to the-desk SKILL.md |
| 14 | stakeout alias invisible | Print "Mode: changes (delta-focused)" in preflight |
| 15 | Default persona wrong for marketplace | **Keep Mickey as default** -- core ADHD cognitive handle; --plain for opt-out |

---

## File Tree

```
plugins/newsroom/
  .claude-plugin/
    plugin.json
  agents/
    beat-reporter.md            # Evolved from research plugin (cli-quick-ref inlined)
  skills/
    the-desk/                   # Editor-in-Chief orchestration (main entry point)
      SKILL.md
      references/
        orchestration.md        # Dispatch patterns, collection, error handling, budget caps
        query-strategies.md     # WebSearch query templates by type
        output-formats.md       # Evening edition formatting + wire summary
        mode-playbook.md        # Mode flag -> assignment translation (conditional read)
        wire-protocol.md        # Wire message schema + validation (conditional read)
        the-morgue.md           # Vault search instructions (was separate skill)
        the-wire.md             # Wire CRUD instructions (was separate skill)
        future-roles.md         # Newsroom-only spec roles as promotion candidates
  commands/
    dispatch.md                 # /newsroom:dispatch (replaces /research:newsroom)
    stakeout.md                 # /newsroom:stakeout (preset for --mode changes)
```

v1 ships 2 commands (dispatch, stakeout). wire-check and brief deferred to v1.1 when other rooms exist.

---

## File-by-File Plan

### `.claude-plugin/plugin.json`

```json
{
  "name": "newsroom",
  "description": "Research intelligence orchestrator -- dispatches reporters, curates findings, publishes evening editions",
  "version": "1.0.0",
  "author": { "name": "Nathan Vale" },
  "keywords": ["research", "intelligence", "newsroom", "reddit", "x", "web-search", "orchestration"],
  "license": "MIT",
  "commands": ["./commands/dispatch.md", "./commands/stakeout.md"],
  "skills": ["./skills/the-desk"]
}
```

One skill (the-desk), two commands, no hooks.

### `agents/beat-reporter.md`

**Evolved from** `plugins/research/agents/beat-reporter.md` (111 lines). Sonnet model.

Changes:
- Remove `skills: [last-30-days-guide]` -- no cross-plugin dependency
- **Inline** the essential CLI reference (~40 lines) directly into the agent body: flags table, output formats, top 5 error recovery patterns
- This saves the runtime Read overhead and eliminates the skill preload cost (~965 tokens saved vs full last-30-days-guide)

### `skills/the-desk/SKILL.md`

**Evolved from**: `plugins/research/skills/newsroom/SKILL.md` (204 lines)

**What carries over unchanged:**
- Mickey "The Desk" Malone character and voice
- Phase 1: Parse the Assignment (topic/depth/sources/days/refresh/format/plain parsing)
- Phase 2: Dispatch Reporters (parallel background Task calls)
- Phase 3: Copy Desk (synthesis with engagement-ranked data)
- Phase 4: Publish Evening Edition

**What changes:**
- Frontmatter: `allowed-tools` adds TaskCreate, TaskUpdate, TaskList, TaskGet
- Phase 1: parse `--mode recon|changes|sentiment|verify` (single enum flag, replaces 4 boolean flags) + `--wire enterprise|garden|dojo` handoff flag
- Phase 2 (**conditional**): if `--mode` is not default, read `references/mode-playbook.md` to translate mode into assignment variations
- Phase 2.5 (**conditional**): if para-obsidian MCP tools available, follow `references/the-morgue.md` to check vault for recent research
- NEW Phase 5 (**conditional**): if `--wire` flag present, read `references/wire-protocol.md`, validate metadata fields, create wire task via TaskCreate
- Agent reference: `subagent_type: "newsroom:beat-reporter"`
- **Error templates**: structured messages for CLI missing, no API keys, invalid flags, no results

**Token budget (default dispatch):**
- SKILL.md: ~2,000 tokens
- orchestration.md: ~1,150 tokens
- query-strategies.md: ~750 tokens
- output-formats.md: ~1,200 tokens
- **Total desk context**: ~5,100 tokens (same as current research:newsroom)
- mode-playbook, wire-protocol, the-morgue, the-wire, future-roles: loaded **only when needed**

### `skills/the-desk/references/orchestration.md`

**Copy** from research plugin (140 lines). Changes:
- `subagent_type` updated to `"newsroom:beat-reporter"`
- Add budget caps section: max 5 topics, max 3 web pages/reporter (quick), max 5 (default), max 8 (deep)
- Add max CLI output rows: truncate compact output to top 50 results

### `skills/the-desk/references/query-strategies.md`

**Direct copy** from research plugin. No changes.

### `skills/the-desk/references/output-formats.md`

**Copy** from research plugin (204 lines) with addition: "Wire Summary" format section for --wire handoffs.

### `skills/the-desk/references/mode-playbook.md` (NEW, conditional read)

**Only loaded when `--mode` flag is not `recon` (default).**

| Mode | Metaphor | Assignment Difference |
|------|----------|----------------------|
| `recon` (default) | Street Reporter | Standard CLI + web research (no read needed) |
| `changes` | Stakeout | Delta-focused, always `--refresh`, time-constrained queries |
| `sentiment` | Source Network | CLI-heavy, `--sources=both`, community sentiment focus |
| `verify "claim"` | Tipster Handler | Verify claim, search for/against evidence, confidence rating |

Note: `--deep` is a depth flag, not a mode. It composes with any mode.

### `skills/the-desk/references/wire-protocol.md` (NEW, conditional read)

**Only loaded when `--wire` flag is present.**

Wire message schema using Task metadata with validation checklist:

Required fields (validated before send):
- `wire_version`: must be "1"
- `wire_type`: must be "green" or "red"
- `from_room`: must be "newsroom"
- `to_room`: must be one of "enterprise", "garden", "dojo", "broadcast"
- `message_type`: must be from defined list
- `wire_id`: auto-generated "wire-newsroom-{timestamp}"

Optional fields: `priority`, `correlation_id`, `requires_ack`, `expires_at`

Invalid metadata -> warn user, do not send.

Wire is **session-scoped ephemeral** in v1. No cross-session persistence, no TTL sweeper, no replay.

### `skills/the-desk/references/the-morgue.md` (NEW, conditional read)

**Replaces the-morgue SKILL.md** -- now a reference doc, not a separate skill.

Instructions for the EIC: if para-obsidian MCP tools are available, search `03 Resources/` for the topic. If hits exist within 30 days, summarize findings and ask user: "Recent research found -- skip or re-run?" If tools unavailable, skip silently.

~30 lines. Only loaded when vault tools are detected.

### `skills/the-desk/references/the-wire.md` (NEW, conditional read)

**Replaces the-wire SKILL.md** -- now a reference doc, not a separate skill.

Wire CRUD operations for the EIC:
- **Send**: validate per wire-protocol.md, TaskCreate
- **Check incoming** (v1.1): TaskList filtered by metadata
- **Acknowledge** (v1.1): TaskUpdate

~40 lines. Only loaded when `--wire` flag is present.

### `skills/the-desk/references/future-roles.md` (NEW)

**Newsroom roles only** (not all rooms -- each room's plugin carries its own).

Documents ~10 Newsroom spec roles as promotion candidates: Street Reporter, Stakeout, Source Network, Tipster Handler, Foreign Bureau, Investigative Desk, Travel Desk, Review Desk, Morgue Librarian. For each: metaphor, what mode it maps to today, promotion criteria.

~60 lines. Rarely loaded -- only when the EIC needs to understand the full roster.

### `commands/dispatch.md`

`/newsroom:dispatch [topic(s)] [flags]` -- main entry point.

Flags:
- Research: `--quick`, `--deep`, `--reddit`, `--x`, `--both`, `--days N`, `--refresh`, `--format TYPE`, `--plain`
- Mode: `--mode recon|changes|sentiment|verify` (default: recon)
- Wire: `--wire enterprise|garden|dojo` (deferred but parseable -- warns if no consumer)

### `commands/stakeout.md`

`/newsroom:stakeout "topic"` -- shorthand for `/newsroom:dispatch "topic" --mode changes`.

Preflight prints: "Mode: changes (delta-focused, refreshing sources)" so user learns the mapping.

---

## Key Design Decisions

### Wire = Tasks (session-scoped)

Wire messages are TaskCreate calls with structured metadata. Session-scoped in v1 -- wire tasks live and die with the Claude Code session. Cross-session persistence deferred to wire-service plugin.

### Conditional reference loading

Default dispatch loads 3 references (~3,100 tokens). Mode flags add mode-playbook (~500 tokens). Wire flag adds wire-protocol + the-wire (~700 tokens). Morgue check adds the-morgue (~200 tokens). **Worst case**: ~4,500 tokens of references. **Typical case**: ~3,100 tokens.

### No separate skills for morgue/wire

The-morgue and the-wire are reference docs inside the-desk, not separate skills. The EIC reads them conditionally. This eliminates the "how do skills invoke other skills?" problem entirely.

### Inline CLI reference in agent body

Beat-reporter agent body includes essential CLI flags, formats, and error recovery inline (~40 lines). No `skills:` field, no runtime Read. The reporter always runs the CLI, so static cost is justified.

### Mickey stays as default

The newsroom metaphor is core to the ADHD-friendly design. `--plain` exists for professional contexts. Marketplace users who install the plugin are opting into the experience.

---

## Implementation Sequence

1. Create plugin scaffold (plugin.json, directory structure)
2. Create beat-reporter.md (evolve from research plugin, inline cli-quick-ref)
3. Port the-desk SKILL.md from research newsroom skill, add mode parsing + conditional reads + wire phase + error templates
4. Create references: copy orchestration.md (+ budget caps), query-strategies.md, output-formats.md (+ wire summary) from research
5. Create new references: mode-playbook.md, wire-protocol.md, the-morgue.md, the-wire.md, future-roles.md
6. Create commands: dispatch.md, stakeout.md
7. Test: `/newsroom:dispatch "test topic" --quick` end-to-end
9. Test: `/newsroom:stakeout "Home Assistant"` produces mode=changes output
10. Test: `/newsroom:dispatch "MCP changes" --wire enterprise` creates validated wire task

---

## Verification

1. **Standalone dispatch**: `/newsroom:dispatch "Claude Code" --quick` produces evening edition matching current `/research:newsroom` output
2. **Mode flag**: `/newsroom:dispatch "Home Assistant" --mode changes` produces delta-focused output with refresh
3. **Stakeout**: `/newsroom:stakeout "Home Assistant"` produces identical output to #2
4. **Wire send**: `/newsroom:dispatch "MCP protocol changes" --wire enterprise` creates a task with validated wire metadata
5. **Invalid wire**: `--wire invalid-room` produces a clear error, no task created
6. **Graceful degradation**: works without para-obsidian (morgue skips), without CLI (web-only mode with warning)
7. **Error UX**: missing CLI produces actionable error message, not cryptic failure

---

## Critical Source Files

| File | Purpose |
|------|---------|
| `plugins/research/skills/newsroom/SKILL.md` | Primary source to port into the-desk |
| `plugins/research/skills/newsroom/references/*` | Three reference files to copy |
| `plugins/research/agents/beat-reporter.md` | Agent definition to evolve |
| `plugins/research/.claude-plugin/plugin.json` | Pattern reference for plugin.json |
| `plugins/research/skills/last-30-days-guide/SKILL.md` | Extract ~40 lines for inline CLI ref |
| `plugins/research/skills/last-30-days-guide/references/troubleshooting.md` | Extract top 5 error patterns |
| `specs/orchrestrators/the-newsroom-agentic-orchestration-plan.md` | Vision doc for future-roles.md |
| `specs/orchrestrators/the-wire-service-communication-protocol.md` | Wire protocol vision |
