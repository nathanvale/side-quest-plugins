**Verdict**  
`REQUEST CHANGES`

**Strengths**
- Preserves the core runtime architecture (ring buffer, HTTP routes, WS broadcast), which is the right baseline for extraction.
- Starts from production-tested source files and existing tests instead of redesigning from scratch.
- Separates observability concerns into a dedicated package, which is directionally correct.
- Implementation sequence is explicit and reviewable.

**Critical Issues (must fix before implementation)**
- The PR is not an extraction; it is extraction + redesign. That creates avoidable regression risk and makes failures hard to localize.
- Three-tier correlation IDs are premature for this PR. Keep `correlationId` as-is; add `sessionCid/cid/parentCid` only when Domain 2 ships.
- `withFileLock` + async `push()` changes behavior and call graph without a demonstrated concurrency bug in the current single-process model. Cut for v1.
- `loadFromDisk()` is anticipatory complexity. No concrete restart-replay requirement is shown for v1 real-time query use.
- Type widening is a step backward for safety:
  - `(string & {})` `EventType` allows silent typos.
  - `source: string` removes useful constraints from `'cli' | 'hook'`.
- Workspace split (`packages/server` + placeholder `packages/client`) is overhead with no current second consumer. Defer until client exists.

**Important Observations (should fix)**
- Renames `repo -> app` and `gitRoot -> appRoot` look over-generalized. With current consumers tied to git/hooks, this obscures intent more than it helps.
- `node:fs/node:crypto` to `@side-quest/core/*` changes should be minimized to what is strictly necessary for extraction.
- Migration risk is currently low because usage appears concentrated; that argues for a mechanical port plus compatibility shim, not broad API evolution.
- Test scope is fine if it is mostly a straight port. New tests for new behavior should wait until that behavior is intentionally introduced.

**Nice-to-Haves**
- Do this as 2-3 PRs:
  1. Mechanical extraction only.
  2. Correlation model expansion + hook event taxonomy.
  3. Persistence/replay and locking if proven needed.
- Add explicit “deferred” tickets for each cut item so future work is intentional, not lost.
- Keep a temporary re-export/shim in `@side-quest/git` for smoother downstream migration.

**Questions for the author**
- What concrete production failure or benchmark justifies `withFileLock` now?
- What exact v1 use case requires `loadFromDisk()` on startup?
- Which current consumer needs `source: string` instead of `'cli' | 'hook'`?
- Which current consumer needs extensible `EventType` now, and how are typos prevented?
- Why pay workspace/config cost before a real client package exists?
- Nathan, can we define a strict “extraction acceptance bar” as: no semantic changes, no new features, all existing tests green, then iterate?