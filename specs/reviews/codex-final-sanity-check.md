Short verdict: not fully coherent yet. The biggest remaining risk is a hidden dependency chain (`wire-service` -> vault transport -> `para-obsidian`) that conflicts with “independently installable.”

1. **Consistency check**
- There is a real contradiction: `wire-service` is described as optional, but persistence is “Obsidian vault for everything,” and vault writes currently imply `para-obsidian` tooling.
- If rooms require vault APIs to emit wire messages, rooms are not actually standalone.
- Another gap: Red Wire “requires owner approval,” but no approval mechanism is defined (queue location, command, timeout, retry, escalation).
- Another gap: `ttl` exists in schema, but no sweeper/expiry behavior is defined, so backlog growth will become operational pain.

2. **Garden rebuild concern**
- Rebuilding Garden is only wise if Garden is an orchestration/domain layer, not a reimplementation of `para-obsidian` infra.
- Recommended relationship:
- `para-obsidian` = storage/tools platform (MCP ops, low-level vault primitives).
- `garden` = workflow/agent UX layer (daily flow, inbox triage policy, PARA decisions, review loops).
- If Garden duplicates the 25 tools, you’ll create permanent divergence and maintenance drag.

3. **Wire-service feasibility**
- Hidden dependency is not acceptable if “install independently” is a hard requirement.
- Make wire transport vault-independent now:
- `WireTransport` interface with `send`, `receive`, `ack`, `sweepExpired`.
- Default adapter: local filesystem (`Bun.file` / `Bun.write`) in a plugin-owned path.
- Optional adapter: Obsidian vault mirror (via `para-obsidian`) for knowledge persistence.
- This keeps wire functional without Garden/Obsidian, while still enabling vault-native history when available.

4. **Agent Teams upgrade path**
- Add a thin orchestration abstraction now so runtime backend is swappable:
- `Coordinator` interface: `createTask`, `delegate`, `listTasks`, `onTaskCompleted`, `onTeammateIdle`.
- `Messaging` interface: `publish`, `subscribe`, `requestReply`.
- `StateStore` interface: `get`, `put`, `appendEvent`.
- Current implementation: Task-tool + filesystem wire.
- Future implementation: Agent Teams coordinator + same message/state contracts.
- Keep room logic dependent on interfaces only; backend selected by config. That makes upgrade mostly config + adapter wiring, not prompt rewrites.

5. **Newsroom v1 -> v2 gap**
- Newsroom core can stay mostly the same (EIC + Beat Reporter modes).
- v2 changes should be additive:
- Add wire client integration (`send_handoff`, `poll_inbox`, `ack_message`).
- Add message envelope/schema validation.
- Add capability detection (`wire-service` present? `para-obsidian` present?).
- Add graceful fallback (persist local handoff note when wire unavailable).
- No new agent roles required for v2; avoid premature role explosion.

6. **Missing artifacts for Newsroom v1 (ship-ready checklist)**
- `plugins/newsroom/plugin.json` with explicit capability flags and optional deps.
- `plugins/newsroom/agents/editor-in-chief.md` with clear routing rules.
- `plugins/newsroom/agents/beat-reporter.md` with mode contract (`--recon`, `--monitor`, `--community`, `--verify`, `--deep`).
- `plugins/newsroom/skills/news-brief/SKILL.md` and `plugins/newsroom/skills/dispatch/SKILL.md`.
- Command entrypoints for at least briefing + dispatch (names can stay metaphorical, descriptions literal).
- Wire contracts even if wire is not installed yet:
- `plugins/newsroom/wire/message.schema.json`
- `plugins/newsroom/wire/types.ts`
- `plugins/newsroom/wire/capabilities.ts`
- `plugins/newsroom/wire/transport-fs.ts`
- Optional `plugins/newsroom/wire/transport-obsidian.ts` behind capability check.
- Red Wire approval artifacts:
- approval queue schema
- owner-approval command
- timeout/expiry rule
- Tests:
- schema validation tests
- standalone mode tests (no wire installed)
- wire-installed integration tests
- backlog replay test (consumer arrives later)
- ttl expiry test
- Red Wire approval-path test

Nathan, if you lock only one thing before building more agents, lock the transport/coordination interfaces first. That prevents most rewrite risk.