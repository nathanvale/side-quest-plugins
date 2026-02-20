---
name: coderabbit
description: >
  Run a CodeRabbit AI code review on the current repo. Reviews uncommitted
  changes by default, or committed changes vs a base branch. Can also pull
  CodeRabbit's review comments directly from an open GitHub PR. Use when user
  asks to "review my code", "run a code review", "check my changes with
  CodeRabbit", or "scan for issues before I push".
argument-hint: '[--type committed|uncommitted|all] [--base <branch>] [--analyze] [--fix] [--preflight] [--trends] [--config <file>] [--source auto|cli|pr]'
allowed-tools: Bash(coderabbit:*), Bash(git status:*), Bash(git diff:*), Bash(gh:*), Read, Edit, Write, Glob, Grep, AskUserQuestion
---

# CodeRabbit Review Skill

You orchestrate CodeRabbit code reviews. Your job: resolve the review source (local CLI or PR comments), parse findings, present them clearly, and optionally fix them.

## Usage

```
/tools:coderabbit                              # Review uncommitted changes
/tools:coderabbit --type committed --base main # Review branch vs main
/tools:coderabbit --analyze                    # Staff-engineer analysis (read-only, no edits)
/tools:coderabbit --fix                        # Interactive remediation (analyze + apply edits)
/tools:coderabbit --preflight                  # Auto-fix loop before commit (max 3 passes)
/tools:coderabbit --source pr --analyze        # Analyze PR findings without editing
/tools:coderabbit --source pr --fix            # Fix findings from PR comments
/tools:coderabbit --source cli                 # Force CLI mode
/tools:coderabbit --config .coderabbit.yaml    # Custom instructions
/tools:coderabbit --trends                     # Analyze review history
```

## Workflow

### 1. Parse Arguments

Extract from `$ARGUMENTS`:

| Flag | Default | Notes |
|------|---------|-------|
| `--type` | `uncommitted` | `committed`, `uncommitted`, or `all` |
| `--base` | - | Base branch for `committed` reviews |
| `--analyze` | `false` | Staff-engineer analysis: read code, assess each finding, recommend fix/defer/dismiss. **Read-only -- never edits files.** Works in all environments (Claude Code, Codex, Cursor). |
| `--fix` | `false` | Interactive remediation: runs the same analysis as `--analyze`, then applies approved edits. **Requires interactive environment** (Claude Code, Cursor). In non-interactive environments (Codex), `--fix` behaves identically to `--analyze` -- it will NOT auto-apply edits. Use `--preflight` for autonomous fixes. |
| `--preflight` | `false` | Autonomous fix loop -- review, fix, re-review (max 3 passes) |
| `--config` | - | Path to additional instructions file |
| `--source` | `auto` | `auto`, `cli`, or `pr` |
| `--trends` | `false` | Analyze local review history for patterns |

### 2. Source Resolution

Determine where findings come from based on `--source`:

**`auto` (default):**
1. Run `gh pr view --json number,state 2>/dev/null`
2. If an **open** PR exists on the current branch, try **PR mode**
3. If PR mode finds **zero unresolved** CodeRabbit threads (neither active nor outdated), **fall back to CLI mode** automatically. Report what you found in PR mode (e.g., "CodeRabbit review still pending, no unresolved threads") and note that CLI results are being shown instead. **Do NOT fall back if there are unresolved outdated threads** -- those are still actionable.
4. If no open PR exists, use **CLI mode** directly

**`pr` (explicit):**
- Require an open PR. If none exists, error: "No open PR found on this branch. Push your changes and open a PR first, or use `--source cli`."

**`cli` (explicit):**
- Skip PR detection. Use the CodeRabbit CLI directly (existing behavior).

### 3A. PR Mode -- Fetch PR Comments

When source resolves to PR mode, fetch CodeRabbit's review comments from GitHub.

See [references/pr-comment-parsing.md](references/pr-comment-parsing.md) for full details.

Summary:
1. Get repo info: `gh repo view --json nameWithOwner --jq .nameWithOwner`
2. Fetch review threads via GraphQL (preferred) or REST inline comments
3. Fetch summary comment: `gh api repos/{owner}/{repo}/issues/{n}/comments`
4. Filter by CodeRabbit author (`coderabbitai[bot]` for REST, `coderabbitai` for GraphQL)
5. Check for rate-limit markers in comment bodies
6. Check for stale review (CodeRabbit comment older than latest commit)
7. Extract findings from all **unresolved** threads (both active and outdated)

**What counts as "actionable":** Any unresolved CodeRabbit thread (`isResolved: false`), regardless of whether it is outdated. Outdated threads (`isOutdated: true`) had their surrounding code change but were never resolved -- they are still actionable. See [references/pr-comment-parsing.md](references/pr-comment-parsing.md) for the full `isResolved` x `isOutdated` matrix.

**Presentation grouping:**
- **Active findings** (`!isResolved && !isOutdated`) -- primary group
- **Outdated findings** (`!isResolved && isOutdated`) -- secondary group, labeled "Outdated (code changed since review)". Note that these may already be fixed by the code changes that made them outdated -- read the current code before recommending action.

If no CodeRabbit comments exist on the PR (no unresolved threads at all), let the user know. They may want to trigger a review by posting `@coderabbitai review` as a PR comment:
```bash
gh pr comment {PR_NUMBER} --body "@coderabbitai review"
```

### 3B. CLI Mode -- Run CodeRabbit CLI

Before running CodeRabbit:

1. Run `git status` to confirm there are reviewable changes
2. For `--type uncommitted` -- verify there are unstaged/staged changes
3. For `--type committed` -- verify there are commits ahead of base
4. If no changes found, tell the user and stop

Build and execute the command:

```bash
~/.local/bin/coderabbit review --prompt-only --type <type> [--base <branch>] [--config <file>]
```

Key flags:
- `--prompt-only` -- structured text output (implies `--plain`, no interactive TUI)
- Always use the full path `~/.local/bin/coderabbit`

#### Auto-inject project standards

Always pass the project's coding standards as context so CodeRabbit enforces them during review. Look for these files in order and pass the first one found:

1. `.claude/CLAUDE.md` (project-level)
2. `CLAUDE.md` (root)
3. `.coderabbit.yaml` (root)

If the user didn't pass `--config` explicitly and one of these files exists, append it:

```bash
~/.local/bin/coderabbit review --prompt-only --type uncommitted --config .claude/CLAUDE.md
```

If the user DID pass `--config`, append the standards file as an additional `--config` (the flag supports multiple files):

```bash
~/.local/bin/coderabbit review --prompt-only --type uncommitted --config user-file.md --config .claude/CLAUDE.md
```

See [references/review-workflow.md](references/review-workflow.md) for details on each review type.

### 4. Parse Output

**PR mode**: Extract findings from API response fields. Each inline comment maps to:
- **File**: `.path`
- **Line**: `.line` (or `.original_line`)
- **Type**: inferred from body keywords (see [references/pr-comment-parsing.md](references/pr-comment-parsing.md))
- **Description**: `.body` (may contain suggestion code blocks)

**CLI mode**: Parse stdout using the format documented in [references/output-parsing.md](references/output-parsing.md).

**Empty output**: If CodeRabbit returns "Review completed" (or similar success message) with no findings in stdout, report "No actionable findings" and **stop immediately**. Do not attempt to verify changes, diff against HEAD, or investigate further -- an empty review means CodeRabbit found nothing to flag.

### 5. Present Findings

Group findings and present a summary with source attribution:

```
## CodeRabbit Review (PR #42): N findings

### Critical (N)
- **file.ts:42** -- Description of the issue

### Important (N)
- **file.ts:15-20** -- Description of the issue

### Suggestions (N)
- **file.ts:8** -- Description of the issue

Source: PR #42 review comments
```

Or for CLI mode:

```
## CodeRabbit Review: N findings

...

Source: local CLI analysis
```

If no findings, let the user know -- no actionable issues found. If they want a fresh review (e.g. after pushing new changes), they can re-trigger. Mention the appropriate command for the current source mode:
- **CLI mode**: re-run the skill
- **PR mode**: `gh pr comment {PR_NUMBER} --body "@coderabbitai review"`

Do not automatically re-trigger. Just inform them how.

**Do NOT show a standalone refresh block when findings exist.** The stale review warning (see Error Handling) already includes the refresh command when applicable. Showing both is redundant.

### 6. Analysis (--analyze mode)

When `--analyze` is set (or `--fix` is set -- fix implies analyze), adopt the **staff engineer peer review** persona. You are a fellow staff engineer sitting down with a senior engineer (the user) to talk through each finding together. This is a conversation between peers, not a bot applying patches.

**`--analyze` is read-only. It NEVER edits files.** This makes it safe to run in any environment -- Claude Code, Codex, Cursor, CI -- without risk of unwanted changes.

#### Persona

- Speak as a staff engineer who has read the code and the finding
- Be honest about signal vs noise -- not every finding deserves a fix
- Explain the "why" behind your recommendation, not just the "what"
- Respect the user's context -- they know the codebase better than CodeRabbit does
- Keep it concise. No speeches. Engineers talking shop.

#### Context7 enrichment (optional)

If a finding references a specific library API, deprecation, or version-specific behavior, use Context7 to pull official docs for cross-reference validation before making your recommendation. See [references/context7-enrichment.md](references/context7-enrichment.md) for details. Limit to 3 lookups per session. Skip silently if Context7 is unavailable.

#### For each finding, walk through:

1. **Read the affected code** -- understand the actual context, not just the diff hunk
2. **Enrich with Context7** (if applicable) -- validate the suggestion against official library docs
3. **Give your honest read** -- explain what the finding is flagging and whether it's a real concern in practice. Be specific: "this matters because X" or "this is technically correct but won't bite us because Y"
4. **Make a recommendation** using one of three options:
   - **Fix it now** -- the finding is legitimate and the fix is small enough to belong in this PR
   - **Defer** -- the finding is valid but the fix is out of scope, would bloat the diff, or needs its own PR
   - **Dismiss** -- the finding is noise, a false positive, or technically correct but not worth the change

#### After all findings (analyze-only):

- Summarize your recommendations in a table (finding, severity, recommendation)
- If anything was recommended as "Fix it now", end with: "Run with `--fix` to apply fixes interactively."
- If anything was recommended as "Defer", suggest: "Want me to open a tracking issue for the deferred items?"

If neither `--analyze` nor `--fix` is set, end with: "Run with `--analyze` to get a staff-engineer assessment, or `--fix` to walk through remediation."

### 6b. Remediation (--fix mode)

`--fix` runs the full analysis from step 6 above, then **additionally applies edits** with user approval.

**Important: `--fix` requires an interactive environment.** In non-interactive environments (Codex, CI agents) where AskUserQuestion is unavailable and the environment does not support waiting for user replies, `--fix` behaves identically to `--analyze` -- present the analysis and recommendations but **do NOT apply any edits**. End with: "This environment doesn't support interactive remediation. Use `--preflight` for autonomous fixes, or copy the recommendations above and apply them manually."

#### Applying fixes (interactive environments only):

After presenting each finding's analysis (steps 1-4 from section 6):

5. **Present the options and get user input:**

   **Interactive environments (Claude Code, Cursor, IDE agents):**
   Use AskUserQuestion with your recommendation marked. Include a brief code snippet of the proposed fix when recommending "Fix it now". **Wait for the user to respond before proceeding.** Do NOT apply fixes without explicit approval.

   **Semi-interactive environments (terminals without AskUserQuestion):**
   Present the same choices as a numbered markdown list and **explicitly wait for the user to reply** before proceeding. Do not assume silence means consent.

6. **If the user agrees to fix** -- apply the edit. If they defer or dismiss, move on. No judgment either way.
7. **If in PR mode and a fix was applied** -- reply to the comment, resolve the thread, and verify resolution:
   1. **Reply**: `gh api repos/{owner}/{repo}/pulls/{pr}/comments/{comment_id}/replies -X POST -f body="Fixed -- [description]."`
      - The full path with `/pulls/{pr}` is required -- omitting it causes 404.
   2. **Get thread ID**: Query `reviewThreads` via GraphQL, match `comments.nodes[0].databaseId` to the REST `comment_id`.
   3. **Resolve**: `mutation { resolveReviewThread(input: {threadId: "..."}) { thread { id isResolved } } }`
   4. **Verify**: Re-query `isResolved` for the thread. If already resolved, skip silently.
   - Only do this for findings that were actually **fixed inline** -- not deferred or dismissed.
   - See [references/pr-comment-parsing.md](references/pr-comment-parsing.md) for full endpoint details, bot-login filtering, and troubleshooting.

#### After all findings (fix mode):

- Summarize what was fixed, deferred, and dismissed
- If anything was deferred, suggest: "Want me to open a tracking issue for the deferred items?"
- If fixes were applied, offer to re-review (see Re-Review Loop below)

### 7. Preflight Mode (--preflight)

When `--preflight` is set, run an **autonomous review-fix-recheck loop** designed to clean up code before committing. This is the "catch it while context is hot" workflow.

`--preflight` implies `--source cli`, `--type uncommitted`, and `--fix` behavior -- but without interactive prompts. You make the call on each finding autonomously.

#### Loop (max 3 passes)

```
Pass 1: Review -> Fix critical/important findings -> Re-review
Pass 2: Review -> Fix remaining findings -> Re-review
Pass 3: Review -> Report any remaining (do NOT fix)
```

#### Decision criteria (autonomous -- no AskUserQuestion)

For each finding, decide based on severity and confidence:

| Severity | Action |
|----------|--------|
| Critical (security, bug) | Fix immediately. These are always worth fixing. |
| Important (potential_issue) | Fix if the suggested change is clearly correct and low-risk. Skip if ambiguous. |
| Suggestion (improvement, style) | Skip. Style suggestions don't belong in preflight. |
| Nitpick | Skip always. |

**Important constraints:**
- Never introduce new logic or refactor during preflight -- only fix what CodeRabbit flagged
- Never change test files during preflight (tests should be fixed separately)
- If a fix requires importing a new dependency, skip it
- If a fix touches more than 10 lines, skip it (too risky for autonomous mode)
- If unsure, skip. Preflight is conservative by design.

#### Pass tracking

After each pass, report:

```
## Preflight Pass N/3

- Findings: X
- Auto-fixed: Y (list files:lines)
- Skipped: Z (list reasons)
```

#### Exit conditions

Stop the loop early when:
- **Clean pass** -- no findings (or only nitpicks/suggestions). Report success.
- **No fixable findings** -- all remaining findings are skipped. Report what's left.
- **Rate limited** -- hit CodeRabbit's rate limit. Report findings so far, suggest manual review.
- **Max passes reached** -- after 3 passes, stop regardless. Report remaining.

#### Final summary

```
## Preflight Complete

- Passes: N
- Total findings: X
- Auto-fixed: Y
- Remaining: Z
- Status: [Clean / N issues remaining]

Ready to commit.
```

If there are remaining Critical findings after 3 passes, warn: "There are still critical findings. Consider running `/tools:coderabbit --fix` for interactive review before committing."

### 8. Trend Analysis (--trends)

When `--trends` is set, analyze local review history instead of running a new review.

See [references/trend-analysis.md](references/trend-analysis.md) for implementation details.

### 9. Re-Triggering Reviews

The user may ask you to re-run a CodeRabbit review at any point -- after fixes, after new commits, or just because they want a fresh pass. Here's how:

#### CLI mode

Re-run the same command. CodeRabbit analyzes the current state fresh each time:
```bash
~/.local/bin/coderabbit review --prompt-only --type uncommitted
```

#### PR mode

Post a comment on the PR to trigger a fresh review:
```bash
gh pr comment {PR_NUMBER} --body "@coderabbitai review"
```
**Do NOT poll or wait for results.** CodeRabbit may take several minutes to complete its review. After posting the trigger comment, report that the review was triggered and stop. The user can re-run the skill to check for updated findings.

Other useful PR comment triggers:
- `@coderabbitai full review` -- force a complete re-review (not incremental)
- `@coderabbitai resolve` -- resolve all open CodeRabbit comment threads

#### Guidelines

- **Never re-trigger automatically.** Only re-run when the user asks for it.
- **Never poll for results.** After triggering a PR review, stop. Do not loop, sleep, or retry waiting for CodeRabbit to finish.
- If running multiple reviews in a session, be mindful of rate limits (see below).
- When presenting re-review results, compare against the previous run if you have the context.

#### Rate limits

Reviews consume rate-limited quota:

| Plan | Reviews/hour |
|------|-------------|
| Free/OSS | 2 |
| Trial | 5 |
| Pro | 8 |

If you hit a rate limit (429 or timeout), tell the user and suggest waiting. Do not retry in a loop -- a single retry after 30 seconds is acceptable, then stop.

#### Re-review summary

After a re-review, present a comparison:

```
## Re-Review Results

- Initial findings: N
- Fixed: X
- Remaining: Y (N critical, M minor)
- New findings: Z

[Assessment of whether the fixes are clean]
```

## Error Handling

- **"No files found for review"** -- No reviewable changes. Tell the user.
- **Auth errors** -- Suggest running `coderabbit auth login` (CLI) or `gh auth login` (PR mode).
- **Rate limits / timeouts** -- Wait and retry once. If still failing, report the error.
- **Non-zero exit code** -- Show the stderr output to the user.
- **No open PR on branch** -- Auto mode falls back to CLI. Explicit `--source pr` errors with guidance.
- **No CodeRabbit comments on PR** -- Suggest adding `@coderabbitai review` as a PR comment to trigger a review.
- **Rate-limited CodeRabbit comment** -- Body contains "Rate limit exceeded". Warn the user and suggest re-triggering the review later.
- **Stale review** -- CodeRabbit's last comment is older than the latest commit. Include this warning inline in the Notes section: "Review may be stale -- CodeRabbit's last comment predates the latest push. To refresh: `gh pr comment {PR_NUMBER} --body '@coderabbitai review'`". Do NOT add a separate refresh block at the bottom -- the warning is self-contained.

## Important Notes

- **Never poll, sleep, or loop waiting for external state changes.** This includes waiting for CodeRabbit reviews to complete, PR status checks to clear, merge readiness to change, or any other async external process. Report the current state, tell the user what to do next, and stop. The user can re-run the skill to check for updates.
- Never run CodeRabbit CLI in interactive mode (always use `--prompt-only`)
- The CLI binary lives at `~/.local/bin/coderabbit` -- always use the full path
- CodeRabbit sends diffs to its cloud service for analysis -- the user is aware of this
- Findings are suggestions, not mandates -- always let the user decide what to fix (except in `--preflight` where you decide autonomously)
- PR mode uses `gh` CLI -- ensure the user is authenticated (`gh auth status`)
- PR mode reads comments for analysis, and writes replies + resolves threads only when `--fix` applies a fix
- Auto-inject CLAUDE.md as `--config` on every CLI invocation for coding standards context
- Context7 enrichment is optional and best-effort -- skip silently if unavailable
- For learnings bootstrap guidance, see [references/learnings-guide.md](references/learnings-guide.md)
