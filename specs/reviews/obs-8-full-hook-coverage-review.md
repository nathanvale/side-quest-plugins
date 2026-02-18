1. **Verdict**
`REQUEST CHANGES`

2. **Strengths**
- Plan keeps the right macro pattern: dumb hook + server-side enrichment (`plugins/observability/hooks/emit-event.ts:62`, `packages/server/src/server.ts:551`).
- Existing forward-compat hooks in server already reduce rollout risk (`packages/server/src/server.ts:240`, `packages/server/src/server.ts:323`).
- It correctly calls out PermissionRequest timing risk early instead of discovering it in prod (`specs/plans/obs-8-full-hook-coverage.md:38`).

3. **Critical Issues (must fix)**
- The new event field table is partially wrong vs current Claude hook schema.  
  `specs/plans/obs-8-full-hook-coverage.md:29` (`prompt_text`) should be `prompt`; `:31` (`task_description` on SubagentStart) is not in the documented input; `:34` (`permission_type`) is not the documented PermissionRequest field; `:36` (`result`) does not match TaskCompleted input.  
  This is a blocker because enrichment code will silently emit low-value or empty fields.
- Three-tier CID is under-specified and currently scope creep for OBS-8.  
  Today hooks send raw stdin only (`plugins/observability/hooks/emit-event.ts:66`), and server generates one correlation ID (`packages/server/src/schema.ts:51`, `packages/server/src/server.ts:605`).  
  Direct answer: `sessionCid` is effectively `raw.session_id` alias unless you define new semantics; `parentCid` cannot be populated from current payload alone without server-side lineage state (likely keyed by `session_id` + `agent_id`/`task_id`).
- Schema migration blast radius is larger than the plan states.  
  `correlationId` is currently required in server/client types and validation (`packages/server/src/types.ts:101`, `packages/client/src/types.ts:90`, `packages/server/src/server.ts:527`), tests assert it (`packages/server/src/server.test.ts:858`), CLI contract docs show it (`packages/server/src/cli/command.ts:1129`).  
  Adding new required fields without an explicit compatibility strategy (including persisted JSONL readers) is a breaking change risk.

4. **Important Observations (should fix)**
- Architecture fitness: 14 cases do not require refactor yet. Keeping `extractEventFields()` inline is fine for now (`packages/server/src/server.ts:273`). Extraction into a registry can wait until behavior diverges further.
- Item 4 is already done and should be dropped from scope (`packages/server/src/types.ts:18`).
- Async policy is incomplete. PermissionRequest is not unique; UserPromptSubmit, SubagentStop, TeammateIdle, TaskCompleted are also control-path events. You need an explicit event-by-event sync/async rationale, not a single “maybe async” note.
- Cross-repo ordering can be phased. Because of fallback mapping/extraction, hooks can ship before server enrichment (`packages/server/src/server.ts:240`, `packages/server/src/server.ts:323`).  
  Direct answer: coordination is not strictly required, but shipping server enrichment first gives cleaner normalized payloads immediately.
- Direct answer on explicit mapping: `EVENT_NAME_MAP` entries are not technically required for these 9 names because fallback works, but explicit entries still add readability and typo resistance.

5. **Nice-to-haves**
- Use table-driven enrichment tests with one fixture per hook event, plus a small set of real captured payloads.
- Add a “schema drift” test that fails if planned extracted fields aren’t present in fixtures.
- Add temporary telemetry for unknown/default extraction usage rate to detect missed handlers post-rollout.

6. **Questions for the Author**
- Which concrete consumer requires `sessionCid/cid/parentCid` now (dashboard, voice, HITL), versus later OTel alignment?
- What exact algorithm populates `parentCid` from today’s inputs?
- Should `sessionCid` be top-level envelope metadata or simply normalized from `data.sessionId` for now?
- What is your per-event sync/async matrix and rationale for each of the 9 new hooks?
- Do you want to phase as: (A) hooks expansion + raw passthrough capture, (B) schema-validated enrichment, (C) optional CID migration?

7. **Sources**
- Claude Code Hooks Reference (official): https://code.claude.com/docs/en/hooks  
- Plan under review: `specs/plans/obs-8-full-hook-coverage.md`  
