> **Note**: This review was conducted pre-implementation. Several issues have since been resolved:
> - Critical #3 (reference duplication): newsroom is now canonical; research newsroom skill removed
> - Critical #4 (skill decomposition): the-morgue/the-wire converted to reference docs as recommended
> - Critical #5 (beat-reporter context): CLI reference inlined into agent body
> - Observation #3 (future-roles scope): moved to newsroom-only scope

1. **Verdict**
`REQUEST CHANGES`

2. **Strengths**
- Reusing the proven EIC + Beat Reporter flow is pragmatic and lowers implementation risk (`plugins/research/skills/newsroom/SKILL.md:121`, `plugins/research/agents/beat-reporter.md:18`).
- Moving role explosion into mode flags is the right architectural direction for v1 (single reporter archetype scales better than many near-duplicate agents).
- Choosing Task primitives for early orchestration aligns with existing repo patterns (`plugins/agentic-orchestration/skills/agentic-orchestration/references/task-orchestration.md:3`).
- Command namespacing (`/newsroom:*`) is consistent with plugin-level discoverability patterns.

3. **Critical issues (must fix before implementation)**
1. **Wire contract is convention-only; no enforcement path exists.**  
Task metadata is untyped at runtime, so malformed envelopes and unknown `wire_version` will silently propagate.  
Reference model you already use elsewhere: schema envelope + version checks (`plugins/git/plans/side-quest-git.md:333`, `plugins/git/plans/side-quest-git.md:344`, `plugins/git/plans/side-quest-git.md:667`).  
Required fix: define `wire.schema.json`, add strict validation in `the-wire`, define reject/dead-letter behavior, and explicit version policy (`major` mismatch -> ignore + warn).

2. **Task-based wire durability is underspecified and currently conflicts with backlog semantics.**  
Tasks are documented as session-scoped (`plugins/agentic-orchestration/skills/agentic-orchestration/references/task-orchestration.md:111`). `CLAUDE_CODE_TASK_LIST_ID` shares lists across instances, but does not by itself solve long-lived persistence semantics (`plugins/agentic-orchestration/skills/agentic-orchestration/references/task-orchestration.md:182`).  
Required fix: either explicitly scope wire to session-only ephemeral messaging, or add persistence/hydration + TTL sweeper + replay contract.

3. **Reference duplication creates guaranteed drift unless ownership is explicit.**  
You’re copying `orchestration.md`, `query-strategies.md`, and `output-formats.md` while the current `research` newsroom remains active (`plugins/research/.claude-plugin/plugin.json:23`, `plugins/research/skills/newsroom/references/orchestration.md:1`, `plugins/research/skills/newsroom/references/query-strategies.md:1`, `plugins/research/skills/newsroom/references/output-formats.md:1`).  
Required fix: pick one canonical source. Either deprecate `research` newsroom or enforce generated copies + CI drift check.

4. **Skill decomposition (`the-desk` / `the-morgue` / `the-wire`) is not mechanically clear.**  
There is no explicit skill-to-skill call primitive shown in your plan. `user-invocable: false` only hides from user menus; it does not create deterministic parent-child invocation contracts (`plugins/claude-code/skills/skills-guide/references/fundamentals.md:156`).  
Required fix: if these are internal modules, make them reference docs (like your delegation-doc pattern in `plugins/research/skills/community-intel/SKILL.md:1`) or separate agents invoked via `Task`.

5. **Beat-reporter context plan is ambiguous and token savings are overstated.**  
Agents preload full listed skills (`plugins/agentic-orchestration/skills/agentic-orchestration/references/sub-agents.md:170`). Current reporter explicitly depends on `last-30-days-guide` and CLI invocation (`plugins/research/agents/beat-reporter.md:10`, `plugins/research/agents/beat-reporter.md:26`).  
If `cli-quick-ref` is pasted inline, that is static prompt bloat; if runtime `Read`, it is procedural and must be explicitly mandated.  
Required fix: choose one mechanism and measure real token deltas against current baseline.

4. **Important observations (should fix, non-blocking)**
1. **Token economics (current baseline):**  
`the-desk` body + current 3 refs is ~3,922 words (~5.1k tokens) before reporter outputs (`plugins/research/skills/newsroom/SKILL.md`, `plugins/research/skills/newsroom/references/orchestration.md`, `plugins/research/skills/newsroom/references/query-strategies.md`, `plugins/research/skills/newsroom/references/output-formats.md`).  
Current `beat-reporter + last-30-days-guide` preload is ~1,489 words (~1.9k tokens) (`plugins/research/agents/beat-reporter.md`, `plugins/research/skills/last-30-days-guide/SKILL.md`).  
Implication: quick-ref helps, but not by “88%” unless you were counting docs that are not always preloaded.

2. **`stakeout` looks like flag sugar, not a separate capability.**  
If it is just `dispatch --monitor`, keep one command and document presets. Add a separate command only when stakeout has distinct lifecycle/state behavior.

3. **`future-roles.md` for all rooms is scope leakage in a room-local runtime skill.**  
Put cross-room vision docs under `specs/orchestrators/` (design-time), not `skills/the-desk/references/` (runtime prompt-time).

4. **“Standalone” should be reframed as “degrades gracefully with optional capabilities.”**  
Core newsroom quality still depends on external CLI (`plugins/research/agents/beat-reporter.md:26`). Without it, you’re in web-only mode, which is a materially different product.

5. **Agent Teams migration is only partial with current design.**  
`Task` dispatch maps, but wire semantics (ack, correlation, expiry, versioning) won’t auto-map unless you define transport/coordinator interfaces now.

5. **Nice-to-haves**
- Add a `wire` contract test suite with valid/invalid fixtures.
- Add a compatibility shim plan for `/research:last-30-days` (`plugins/research/commands/last-30-days.md:16`) during migration.
- Add capability flags in `plugin.json` metadata (`requires_cli`, `optional_morgue`, `optional_wire`).

6. **Questions for the author**
1. Which artifact is canonical for shared newsroom reference content after split: `research` or `newsroom`?
2. Do you want wire durability across Claude restarts, or is session-only acceptable for v1?
3. Should `the-morgue`/`the-wire` be true agents or just internal reference modules?
4. Is `stakeout` intended to become scheduled delta-monitoring (stateful), or stay as `--monitor` preset?
5. What is the backward-compat policy for `/research:last-30-days` once `/newsroom:dispatch` ships?
6. Nathan, do you want cross-room role catalogs in runtime context, or strictly in design docs?