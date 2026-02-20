1. **Verdict**: **REQUEST CHANGES**

2. **Strengths**
- The repo boundary is mostly clean: `plugins/observability/hooks/emit-event.ts:62` stays a true dumb pipe, and enrichment remains server-side.
- Splitting into PR-A (`hooks.json`) and PR-B (server enrichment/tests) is the right deployment shape for blast-radius control.
- The current enrichment pipeline is coherent and central (`packages/server/src/server.ts:571`), so adding events in one place keeps behavior predictable.
- Table-driven tests for new cases are a good direction given the repetitive shape in `packages/server/src/server.test.ts:638`.

3. **Critical issues (must fix before implementation)**
- **Forward-compat regression for `teammate-idle` / `task-completed`**.  
  Adding explicit minimal cases will drop future fields that are currently preserved by default passthrough (`packages/server/src/server.ts:322`).  
  Fix: either keep these two on default for now, or include a `raw` passthrough alongside normalized fields.
- **Known PostToolUse field bug should be fixed in same PR**.  
  `extractEventFields` currently reads `raw.tool_result` (`packages/server/src/server.ts:302`). If docs now define `tool_response`, this is a correctness bug in the same function you are expanding.  
  Fix: `raw.tool_response ?? raw.tool_result` for backward compatibility, and update test fixture at `packages/server/src/server.test.ts:747`.
- **Async policy for terminal lifecycle events is risky**.  
  Plan says all 9 new hooks become `"async": true`, but existing lifecycle-critical hooks are sync (`plugins/observability/hooks/hooks.json:4`, `plugins/observability/hooks/hooks.json:55`).  
  Risk: end-of-lifecycle events can be dropped when process exits.  
  Fix: keep `SessionEnd` (and likely `TaskCompleted`, maybe `SubagentStop`) synchronous unless you have measured delivery guarantees.
- **`matcher: "*"` on events without matcher support needs proof**.  
  If Claude rejects/ignores unsupported matcher config, you silently lose hooks.  
  Fix: validate against current hook schema and run a smoke test before merge; do not assume Stop behavior generalizes.

4. **Important observations (should fix)**
- `extractEventFields` switch at `packages/server/src/server.ts:273` is still acceptable at 14 events, but you are at the threshold where a dispatch map (`event -> extractor`) is cleaner and easier to test incrementally.
- Recursion guard should move from hardcoded `if` to a small policy set/map near `handleHookEvent` (`packages/server/src/server.ts:590`) to avoid guard drift as events grow.
- Selective extraction is mostly correct: `model`/`source` belong to `session-start` unless docs guarantee them across events. Don’t force cross-event fields just for symmetry.
- `EVENT_NAME_MAP` additions are mostly redundant with fallback (`packages/server/src/server.ts:240`). Keeping them for explicitness is fine, but it’s not functionally required.
- Dropping `custom_instructions` and `permission_suggestions` entirely may hurt observability. At least consider truncated preview/count fields.

5. **Nice-to-haves**
- Add a lightweight contract check (CI script or test fixture) that compares hook names in `plugins/observability/hooks/hooks.json` with expected server extraction coverage to reduce cross-repo drift.
- For sensitive/large fields, define one policy: `preview` + truncation + optional `raw` retention flag, instead of ad hoc dropping per case.
- The 5-agent orchestration is probably overkill for this scope; 2 builders + 1 validator is likely enough.

6. **Questions for the author**
- Do you want **lossless forward-compat** for known events, or only for unknown events? That decision drives whether explicit minimal cases are acceptable.
- Why is `SessionEnd` planned async when existing start/stop lifecycle points are sync?
- What evidence do we have that matcher is legal on `UserPromptSubmit`, `TeammateIdle`, and `TaskCompleted`?
- Is there any reason not to include the `tool_response` compatibility fix now, Nathan, since the same code path is being touched?
- Should recursion guarding be event-policy based (set/map) so future guarded events don’t require repeated handler logic?