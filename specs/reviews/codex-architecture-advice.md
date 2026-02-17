**Recommendation**
Choose **Option E: protocol-first hybrid**.

- Use **Option A as the baseline**, but make it **filesystem-first**, not vault-first.
- Add **Option B later as an optional accelerator**, not a requirement.
- Reject C and D for now.

This gives you standalone installs, zero dependency assumptions, and low cognitive load.

**Why this is the right fit**
- Marketplace-safe: every room works alone with no install-order coupling.
- No runtime detection needed: rooms just read/write a shared wire path.
- Graceful by default: absent consumers do not break producers.
- Incremental rollout: Newsroom can ship first without waiting on Enterprise/Garden/Dojo.

**Hybrid architecture**
1. Define a **Wire Protocol spec** (`wire_version`, envelope schema, statuses, TTL, idempotency rules).
2. Use a default transport path like `.claude/wire/` with room inboxes.
3. Let Garden optionally mirror/sync to Obsidian (`00 Inbox/Wire/`) for PARA workflows.
4. Later, add an optional Wire MCP server that uses the same schema/storage for faster pull/query/ack.

**Wire artifact**
Make Wire Service primarily a **shared spec + contract tests**, with optional runtime tooling.

- Required artifact: `wire-spec.md` + `wire.schema.json` + test fixtures.
- Optional artifact: `wire-service` plugin exposing MCP tools (`wire_send`, `wire_pull`, `wire_ack`, `wire_status`).
- Keep transports swappable; schema is the stable contract.

**Graceful degradation model**
- If only one room is installed, outgoing wire messages remain `pending` until TTL.
- No hard errors for missing consumers.
- Sender still returns user-facing output immediately.
- If a second room is installed later, it can consume backlog.
- Unknown wire version: ignore safely + log warning.

**Claude Code primitives to leverage**
- `SessionStart` hooks: poll inbox, surface a short “new dispatches” summary.
- Skill/command namespacing: explicit handoff commands (`/newsroom:dispatch`, `/enterprise:pickup-wire`).
- MCP discoverability: optional Wire MCP can be used when present, filesystem fallback otherwise.
- Reuse your existing **shared workflow + adapter** pattern (like your community-intel setup) for cross-room consistency.

**Newsroom-first rollout (practical)**
1. Ship Newsroom with `wire v0.1` writer + reader on `.claude/wire/`.
2. Add Enterprise consumer with ack/archive semantics.
3. Add Garden vault mirror (not required for wire correctness).
4. Add Dojo consumers/templates.
5. Add optional Wire MCP only if needed (latency/query pressure justifies complexity).

Nathan, this keeps your room metaphor intact while avoiding a hard platform dependency too early.