# HALT Community Intel Workflow (Delegation-Only)

Shared workflow for community intelligence across knowledge-bank skills.
This is not a registered skill. Parent skills delegate to this document.

HALT stands for:

- **H**igh-signal visibility
- **A**daptive lazy loading
- **L**ifecycle clarity
- **T**rust + telemetry

This workflow is designed for zero-friction UX:

- SessionStart refresh remains always-on in each plugin hook.
- Users do NOT need a manual `--upgrade` to get new intel.
- Staged findings are auto-promoted into verified intel.
- Parent skills keep only domain-specific Steps 2-4.

## Parent Contract

Before using this workflow, the parent skill must:

1. Read `../../shared/community-intel.adapter.json` (relative to parent SKILL.md).
2. Read this workflow file.
3. Execute this workflow using adapter values.

### Adapter Schema

```json
{
  "skillName": "hooks",
  "paths": {
    "configPathBash": "${CLAUDE_PLUGIN_ROOT}/community-intel.json",
    "cacheDirBash": "${CLAUDE_PLUGIN_ROOT}/skills/hooks/cache",
    "cacheMetaReadPath": "cache/last-updated.json",
    "verifiedIntelReadPath": "references/verified-intel.md",
    "verifiedIntelWritePath": "references/verified-intel.md",
    "uxStatePath": "cache/community-intel-ui-state.json"
  },
  "smartRefreshKeywords": ["not working", "error"]
}
```

Notes:

- Use `*ReadPath` / `*WritePath` with Read/Write tools.
- Use `*Bash` paths only in Bash commands.
- `smartRefreshKeywords` is skill-specific and treated as force-refresh intent.

## Step 0: Parse Input

Parse flags from parent input:

- `--refresh`: set `FORCE_REFRESH = true`.
- `--upgrade`: set `SYNC_REPORT_ONLY = true` and `FORCE_REFRESH = true`.
  This flag is optional convenience, not required for normal freshness.
- Otherwise both flags are false.

Strip flags from question text before parent Step 2 classification.

## Step 1: HALT Lifecycle

### 1a. Load adapter values

Load:

- `SKILL_NAME`
- `CONFIG_PATH_BASH`
- `CACHE_DIR_BASH`
- `CACHE_META_READ_PATH`
- `VERIFIED_INTEL_READ_PATH`
- `VERIFIED_INTEL_WRITE_PATH`
- `UX_STATE_PATH`
- `SMART_REFRESH_KEYWORDS`

### 1b. Determine cache state

Read `CACHE_META_READ_PATH`.

- **fresh**: metadata exists and `next_update_after` is in the future.
- **stale**: metadata exists but `next_update_after` is in the past.
- **missing**: metadata file absent.

### 1c. Decide refresh

Use:

- `FORCE_REFRESH` -> refresh now.
- question matches `SMART_REFRESH_KEYWORDS` -> refresh now (even if cache is fresh).
- fresh cache + non-matching question -> no inline refresh.
- stale/missing + non-matching question -> continue with existing data.

Rationale: keep normal questions fast, but favor recency for troubleshooting/high-risk intents.

### 1d. Run inline refresh if needed

If refresh is needed, show:

`Refreshing community intel - this takes about 60 seconds.`

Then run:

```bash
bunx @side-quest/community-intel-cache refresh --config "{CONFIG_PATH_BASH}" --cache-dir "{CACHE_DIR_BASH}" --force
```

If refresh fails, continue in degraded mode with reference files and previously verified intel.

### 1e. Auto-promote staged findings (no manual upgrade required)

Always run extract (silent by default):

```bash
bunx @side-quest/community-intel-cache extract --cache-dir "{CACHE_DIR_BASH}"
```

Handle extract result:

- `no_new` / `no_staged`: nothing to promote.
- `has_new`: auto-promote findings.
- command failure: set degraded note, continue.

Auto-promotion rules for `has_new`:

1. Read `VERIFIED_INTEL_READ_PATH` if present. If missing, start with a header section.
2. Dedupe by finding hash. Treat `Hash: <hash>` as canonical marker.
3. Append only new hashes, grouped by topic.
4. Include each finding in this format:

```markdown
---

## YYYY-MM-DD

### [Title]
[Summary]
Source: [URL]
Topic: [topic]
Hash: [hash]
```

5. Write updated content to `VERIFIED_INTEL_WRITE_PATH`.
6. Record accepted hashes:

```bash
bunx @side-quest/community-intel-cache review --cache-dir "{CACHE_DIR_BASH}" --hashes hash1,hash2,...
```

Error handling:

- Write fails: retry once, then report degraded note, do not record hashes.
- Review fails: keep saved findings, report that hashes may reappear on next sync.

Track `AUTO_PROMOTED_COUNT` and `AUTO_PROMOTED_TOPICS`.

### 1f. HALT visibility state

Read `UX_STATE_PATH`:

- If missing: first-use flow (`FIRST_USE = true`), then write state with `welcomed: true`.
- Otherwise `FIRST_USE = false`.

Build one top status line (`HALT_STATUS_LINE`) using priority:

1. First use:
   `Community intel is active for /{SKILL_NAME}. It refreshes in the background and auto-promotes new findings.`
2. Auto-promoted this run (`AUTO_PROMOTED_COUNT > 0`):
   `Community intel synced: auto-promoted X new findings across Y topics.`
3. Degraded mode:
   `Community intel temporarily degraded; answering from references + previously verified intel.`
4. Otherwise:
   empty (no noise).

### 1g. Adaptive lazy loading guidance

Load verified intel with token discipline:

1. If file is small (<200 lines), read full file.
2. If medium/large, read:
   - most recent sections first
   - sections matching likely categories from question keywords
   - avoid loading the entire archive when not needed
3. Prefer recency + relevance over bulk context.

### 1h. Trust + attribution rule

When a response includes a claim materially informed by verified intel, parent output must add inline attribution:

`(from community intel, MMM YYYY)`

Do this inline where the claim appears, not as a buried footer.

## Step 2: Return to Parent Skill

After Step 1:

- continue to parent skill Step 2-4 for domain reasoning
- prepend `HALT_STATUS_LINE` at top if non-empty
- apply inline community attribution when used

If `SYNC_REPORT_ONLY` is true (`--upgrade` path):

- run Step 1 as above
- return sync summary and stop (no Q&A synthesis needed)
- summary format:
  - `Community intel sync complete for /{SKILL_NAME}.`
  - `Auto-promoted: X findings across Y topics.`
  - include degraded warnings if any

## Step 5: Optional Manual Sync Report (--upgrade)

Backward-compatible alias for `SYNC_REPORT_ONLY` behavior in Step 2.
Users do not need this for normal operation; it exists for explicit audit/sync checks.
