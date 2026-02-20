1. **Verdict**: **REQUEST CHANGES**

2. **Strengths**
- The plan is aiming for deterministic, table-driven coverage instead of ad-hoc tests, which is the right direction for 14 event types.
- It explicitly calls out special behavior paths (truncation and recursion guard), not just happy-path extraction.
- It reuses the existing HTTP integration pattern in `packages/server/src/server.test.ts:638`, which already gives strong confidence when applied consistently.
- It keeps quality gates (`test`/`tsc`/`biome`) in scope for PR-B.

3. **Critical issues (must fix before implementation)**
- **Integration level is ambiguous.** If new tests are implemented as `extractEventFields` unit tests only, they will not validate route mapping, status codes, event type normalization, persistence, or skip semantics. Require HTTP round-trip tests for each new event (POST + GET), matching `packages/server/src/server.test.ts:638`.
- **Missing/null field behavior is not specified or tested.** New cases dereference fields like `raw.session_id`, `raw.reason`, etc. Add explicit sparse-payload tests (`{}`, missing keys, `null` values) so behavior is intentional and non-crashy.
- **SubagentStop guard coverage is underspecified.** Match the full Stop guard contract in `packages/server/src/server.test.ts:773`: `(a)` guarded call returns `200` + `status: "skipped"`, `(b)` no event stored, `(c)` non-guarded call stores normally.
- **Fixture realism is a major risk.** “Realistic stdin payloads” cannot be invented safely. Use captured, redacted real hook payloads (golden fixtures), otherwise tests may pass against schemas Claude never emits.
- **Flake/isolation risk in table tests is high.** POST-then-immediate-GET can race and shared store state can bleed across cases. Use unique `session_id`s and deterministic cleanup/polling helpers.

4. **Important observations (should fix)**
- Extra truncation tests add value only for **wiring**, not truncate algorithm behavior. `truncateField` behavior is already covered; new checks should prove the correct per-event field is routed through truncation (wrong key / missing call is the real regression).
- Add one regression that proves a newly explicit event now follows its explicit enrichment path, while keeping unknown forward-compat behavior validated in `packages/server/src/server.test.ts:823`.
- Acceptance criteria should explicitly state that the pre-existing Hook Enrichment tests remain and pass; “bun test passes” is too easy to satisfy after accidental test weakening/removal.
- If broadcast is part of the intended pipeline, POST+GET tests don’t validate it. Add at least one subscriber/broadcast assertion for a new event type.

5. **Nice-to-haves**
- Add a contract test that checks normalized type naming (`hook.<snake_case>`) for each event row.
- Add a serialization sanity test to ensure enriched payloads don’t leak `undefined` keys unexpectedly.
- Generate table rows from a shared fixture manifest to reduce maintenance drift.

6. **Questions for the author**
- Will Phase 3 tests be HTTP integration tests, unit tests, or both?
- How will you capture and redact real stdin payloads for fixtures?
- Will `subagent-stop` assertions be identical in rigor to the existing Stop guard test?
- How will you prevent table-test flakiness from async persistence and shared state?
- Are you preserving all existing enrichment tests, or replacing them with the table matrix?

7. **Synthesis**
Across all three passes, architecture and scope risks are mostly surfaced, but test confidence is still not implementation-ready. The residual risk is silent regressions from fixture mismatch, unit-only coverage, and flaky integration assertions. If you tighten PR-B to require real-payload integration fixtures, explicit sparse-payload/guard assertions, and stable isolation mechanics, the plan becomes materially de-risked for implementation.