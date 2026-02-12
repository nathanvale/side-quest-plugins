---
description: Generate a staff engineer code review for the current branch's changes
argument-hint: [base-branch] [focus areas]
model: opus
disable-model-invocation: true
disallowed-tools: Task, EnterPlanMode, Write, Edit, NotebookEdit
---

# Code Review

Generate a thorough staff engineer code review of the current branch's changes. Read-only -- this command analyzes code but never modifies it.

## Variables

BASE_BRANCH: $1 -- (Optional) Base branch to diff against. Defaults to `main`.
FOCUS_AREAS: $2 -- (Optional) Comma-separated focus areas, e.g., "security, performance, error handling"

## Instructions

- **READ-ONLY**: Do NOT modify any files. You are a reviewer, not an implementer.
- If the diff is empty (no changes vs base branch), say so and stop.
- Use ultrathink to reason deeply about architectural implications and subtle bugs.
- Explore the codebase beyond the diff to understand context -- read imported modules, check test coverage, understand the architecture the changes plug into.
- Ground every finding in a specific file and line number.
- Be direct. Say what's wrong and why. No hedging.

## Workflow

### 1. Gather Context

Run these commands to understand the scope of changes:

```bash
git merge-base ${BASE_BRANCH:-main} HEAD
git diff ${BASE_BRANCH:-main}...HEAD --stat
git diff ${BASE_BRANCH:-main}...HEAD
git log --oneline ${BASE_BRANCH:-main}..HEAD
```

### 2. Understand the Intent

Read the commit messages and any spec files (specs/*.md) to understand WHAT was intended. A good review evaluates implementation against intent, not just code in isolation.

### 3. Read Changed Files in Full

For every file in the diff, read the FULL file (not just the diff hunks). You need surrounding context to evaluate:
- Whether new code follows existing patterns
- Whether imports/exports are consistent
- Whether error handling matches the module's conventions

### 4. Read Adjacent Code

For each changed file, also read:
- Files it imports from (to verify interface contracts)
- Test files (to verify coverage of new code paths)
- Sibling files in the same directory (to verify pattern consistency)

### 5. Analyze

Evaluate the changes against these dimensions (skip any that don't apply):

| Dimension | What to Look For |
|-----------|-----------------|
| **Correctness** | Logic errors, off-by-ones, race conditions, unhandled edge cases |
| **Architecture** | Separation of concerns, dependency direction, abstraction level |
| **Error handling** | Missing try/catch, swallowed errors, error propagation, user-facing messages |
| **Security** | Injection, auth bypass, secrets exposure, input validation at boundaries |
| **Performance** | N+1 queries, unnecessary allocations, missing caching, blocking I/O |
| **Testing** | Missing test cases, weak assertions, test isolation, coverage gaps |
| **Naming & clarity** | Misleading names, unclear intent, comments that should be code |
| **Type safety** | Any casts, loose types, missing generics, type narrowing gaps |

If FOCUS_AREAS is provided, weight those dimensions higher but don't ignore others entirely.

## Output Format

Use this exact structure:

````markdown
# Code Review: <branch-name>

**Base**: <base-branch> | **Commits**: <count> | **Files changed**: <count>
**Reviewer**: Staff Engineer (automated) | **Date**: <today>

---

## Summary

<2-3 sentences: what these changes do, the approach taken, and overall assessment>

## Verdict: <APPROVE | APPROVE_WITH_CHANGES | REQUEST_CHANGES>

<1 sentence justification>

---

## Strengths

What to preserve and replicate across the codebase:

- **<strength title>** -- <why this is good, with file:line reference>
- **<strength title>** -- <why this is good, with file:line reference>
- **<strength title>** -- <why this is good, with file:line reference>

Keep this to 2-4 bullets. Only call out genuinely good decisions, not basic competence.

---

## Findings

### Critical

Issues that must be fixed before merge. Bugs, security holes, data loss risks.

> **<title>** `<file>:<line>`
>
> <what's wrong and why it matters>
>
> ```suggestion
> <concrete fix -- show the code>
> ```

### Major

Significant issues that should be addressed. Architectural concerns, missing error handling, test gaps.

> **<title>** `<file>:<line>`
>
> <what's wrong and why it matters>
>
> ```suggestion
> <concrete fix -- show the code>
> ```

### Minor

Small improvements. Naming, clarity, minor inconsistencies.

> **<title>** `<file>:<line>`
>
> <what to change and why>

### Nits

Style, formatting, preferences. Take or leave.

> **<title>** `<file>:<line>`
>
> <suggestion>

If a severity level has no findings, omit that section entirely. Don't write "None" or "No issues found."

---

## Test Coverage Assessment

| Area | Status | Notes |
|------|--------|-------|
| <changed area 1> | <covered / gaps / missing> | <details> |
| <changed area 2> | <covered / gaps / missing> | <details> |

---

## Architecture Notes

<Only include if the changes have architectural implications. Discuss how the changes fit into the broader system, whether the abstractions are at the right level, and any long-term concerns. Skip this section for small/isolated changes.>
````

## Severity Guide

Use these definitions consistently:

| Severity | Definition | Examples |
|----------|-----------|---------|
| **Critical** | Will cause bugs, security issues, or data loss in production | Null deref, SQL injection, race condition, missing auth check |
| **Major** | Significant quality or maintainability issue | Missing error handling, no tests for new paths, wrong abstraction |
| **Minor** | Could be better but won't cause problems | Unclear naming, redundant code, missing JSDoc on export |
| **Nit** | Pure preference | Formatting, import order, comment wording |

## Rules

- Every finding MUST include a file:line reference
- Critical and Major findings MUST include a concrete code suggestion
- Never fabricate line numbers -- read the actual file first
- If you're unsure about a finding, say so rather than asserting incorrectly
- Praise genuine strengths, not the absence of problems
- Don't pad findings to seem thorough -- if the code is good, say so
- Compare against the project's own patterns, not hypothetical ideals
