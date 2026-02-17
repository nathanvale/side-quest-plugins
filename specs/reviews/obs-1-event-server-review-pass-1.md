1. **Verdict**  
`REQUEST CHANGES`

2. **Strengths**
- The plan keeps the proven transport shape (`POST /events`, `GET /events`, `GET /health`, `WS /ws`) instead of inventing a new protocol.
- Extracting from the existing 7 files + test porting is the right baseline for reducing regression risk.
- Ring buffer + append-only JSONL is a good default architecture for low-latency local observability.

3. **Critical issues (must fix before implementation)**
- **Schema break is too large for an extraction PR.** Replacing `correlationId` with required `sessionCid/cid` and renaming `repo/gitRoot` to `app/appRoot` breaks current producers immediately. Current hook client sends `correlationId`, `repo`, `gitRoot` in `plugins/git/hooks/event-bus-client.ts:18`, `plugins/git/hooks/event-bus-client.ts:20`, `plugins/git/hooks/event-bus-client.ts:21`, `plugins/git/hooks/event-bus-client.ts:105`, `plugins/git/hooks/event-bus-client.ts:107`, `plugins/git/hooks/event-bus-client.ts:108`, and tests assert this contract in `plugins/git/hooks/event-bus-client.test.ts:96`, `plugins/git/hooks/event-bus-client.test.ts:98`, `plugins/git/hooks/event-bus-client.test.ts:99`.
- **`(string & {})` on `EventType` weakens type-safe handlers.** It keeps autocomplete but harms control-flow narrowing and allows silent typos. For discriminated unions, the catch-all string branch overlaps known literals, so `event.type === 'hook.session_start'` won’t reliably narrow payload variants.
- **`push()` sync→async with `withFileLock` is unjustified complexity.** In a single Bun server process, sync append is already serialized by the event loop. If server singleton is enforced (PID/port), file locking adds overhead and new failure modes without a demonstrated contention bug.
- **API is incomplete for dashboard consumers.** If dashboard runs on `localhost:5173` and server on `localhost:7483`, browser `fetch` to `/events` will fail without CORS + `OPTIONS` handling. This should be in OBS-1, not deferred.
- **Migration compatibility is under-specified.** Current discovery path is hardcoded to `~/.cache/side-quest-git/<repo>/events.port` in `plugins/git/hooks/event-bus-client.ts:90` and tests create that path in `plugins/git/hooks/event-bus-client.test.ts:21`. Changing cache namespace/path without dual-read/dual-write will silently drop events.
- **`Bun.JSONL.parse` requires an explicit runtime contract.** It exists in local Bun `1.3.9`, but the plan should declare minimum Bun version (`engines`) and fallback behavior for older runtimes.

4. **Important observations (should fix, but not blocking)**
- **Three-tier correlation should be additive first.** Make `correlationId` backward-compatible and introduce `sessionCid/cid/parentCid` as optional until all producers migrate.
- **Route set is mostly sufficient, but replay race remains.** For tailing UIs/CLI, `GET /events` then `WS /ws` can miss events between calls; add a `sinceId/sinceTs` handshake strategy.
- **Naming generalization is incomplete/inconsistent.** If moving to `app*` terminology, ensure all related names and docs migrate coherently (cache key functions, cache directory contracts, event type taxonomy), or keep git-specific naming in v1 extraction.
- **Workspace split is likely premature.** `packages/server` + placeholder `packages/client` adds release/config complexity before client code exists. A single package first is simpler and safer.

5. **Nice-to-haves (optional improvements)**
- Align correlation naming with trace semantics now (`traceId/spanId/parentSpanId`) if OTel export is a near-term goal.
- Add a temporary compatibility shim in `@side-quest/git/events` that re-exports from `@side-quest/observability` during migration.
- Add server identity metadata in pid/port discovery files to reduce stale PID/port misrouting risk.

6. **Questions for the author**
- What is the exact migration contract: dual schema, dual cache paths, and for how long?
- Do you need side-by-side old/new servers during Domain 5g, or can you enforce a single server instance?
- Why must `sessionCid` be required for non-session events (worktree/CLI)?
- Can you show a real contention case that requires `withFileLock` in OBS-1?
- What minimum Bun version will the package guarantee if `Bun.JSONL.parse` is required?
- Are the 14 hook handlers already identified with concrete event names and payload schemas, or is that still provisional?