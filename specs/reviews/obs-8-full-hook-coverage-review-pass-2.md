1. **Verdict**: **REQUEST CHANGES**

2. **Strengths**
- Clear boundary is preserved: `plugins/observability/hooks/emit-event.ts` stays transport-only, enrichment stays server-side.
- The plan correctly leverages existing forward-compatible behavior (`specs/plans/obs-1-event-server.md:528`, `specs/plans/obs-1-event-server.md:548`).
- Scope is explicitly documented with concrete file targets and verification steps (`specs/obs-8-full-hook-coverage-impl.md:19-27`, `specs/obs-8-full-hook-coverage-impl.md:259-262`).

3. **Critical issues (must fix before implementation)**
- **Source-of-truth mismatch on event count**: `plugins/claude-code/skills/hooks/references/event-reference.md:3` says “All 12 hook events,” but OBS-8 is framed as 14 (`specs/plans/obs-8-full-hook-coverage.md:7`). `TeammateIdle`/`TaskCompleted` are acknowledged as forward-declared (`specs/obs-8-full-hook-coverage-impl.md:266`). This needs a hard compatibility contract (minimum Claude Code version or feature flag) before treating them as required coverage.
- **Scope exceeds what downstream work needs now**: OBS-10 and OBS-11 depend primarily on subagent lifecycle (`specs/plans/obs-10-dashboard-advanced.md:15`, `specs/plans/obs-11-voice-expansion.md:15`, `specs/plans/obs-11-voice-expansion.md:25-27`), and OBS-14 depends on `permission_request` flow (`specs/plans/obs-14-hitl.md:15`, `specs/plans/obs-14-hitl.md:44-46`). Requiring full enrichment for all 9 new events is not justified for unblocking.
- **Phasing adds contract churn without clear payoff**: PR-A already delivers “events flow” (`specs/obs-8-full-hook-coverage-impl.md:13`). PR-B then changes payload shapes later. That creates a moving contract for consumers. Either ship PR-A only now (and defer enrichment to consumer-driven PRs) or do one PR with only the fields proven necessary.
- **Brittle completion criteria**: “14 map entries” + “14 switch cases” as success criteria (`specs/obs-8-full-hook-coverage-impl.md:250-252`) fights the forward-compatible architecture and guarantees maintenance churn on upstream event changes.

4. **Important observations (should fix, but not blocking)**
- `notificationType` and `trigger` appear to have no current consumer in OBS-10/11/14. Default minimal passthrough should be the baseline for new events until a consumer asks for enrichment.
- `agentTranscriptPath` is only relevant to the later McCoy verdict routing path (`specs/plans/obs-11-voice-expansion.md:32-35`), not the primary OBS-11 unblock path.
- `hookEvent` in `data` is likely redundant with envelope `type`; this duplication should be explicitly justified or reduced. Otherwise you maintain two discriminators that can drift.
- The plan is doing selective field curation early (drop vs preview decisions) before consumers exist; that is schema work without demand.
- Test plan should favor one parameterized matrix over many bespoke fixtures; test behavior/invariants, not repetitive configuration.

5. **Nice-to-haves (optional improvements)**
- Add a “consumer -> required events/fields” table to OBS-8 so scope decisions are tied to actual demand.
- Mark `TeammateIdle`/`TaskCompleted` as experimental in docs/config until runtime support is proven.
- Add a small perf sanity check for payload size and WS fanout under subagent-heavy sessions before broad rollout.

6. **Questions for the author**
- What is the minimum Claude Code version that guarantees `TeammateIdle` and `TaskCompleted` hooks?
- Which concrete OBS-10/11/14 code path currently requires `notificationType`?
- Which concrete OBS-10/11/14 code path currently requires `pre-compact.trigger`?
- Who consumes `agentTranscriptPath` before McCoy verdict routing lands?
- Which field should clients treat as canonical discriminator: envelope `type` or `data.hookEvent`?
- If PR-A already satisfies “flow,” why not defer PR-B enrichment until each consumer PR requests specific fields?