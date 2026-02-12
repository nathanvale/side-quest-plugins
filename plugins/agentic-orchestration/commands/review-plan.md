---
description: Generate a staff engineer review prompt for a plan/spec document, optionally spawning Codex to execute it
argument-hint: <path-to-spec> [--spawn] [--passes N] [focus areas]
model: opus
disable-model-invocation: true
disallowed-tools: Task, EnterPlanMode
---

# Review Plan

Generate a tailored staff engineer review prompt for a plan or spec document. The output is a prompt you can hand to another agent (Codex, Claude, etc.) to get a thorough architectural review before implementation begins.

Optionally spawns Codex to execute the review automatically, or generates copy-paste prompts if Codex is unavailable.

## Variables

SPEC_PATH: $1 -- Path to the plan/spec file to review (e.g., specs/my-feature.md)
REMAINING_ARGS: $2 -- (Optional) Flags and focus areas. Parse for:
- `--spawn` -- Execute review via `codex exec` instead of generating copy-paste prompts
- `--passes N` -- Number of review passes (default: 1, max: 5). Each pass uses a different reviewer persona.
- Everything else is treated as comma-separated FOCUS_AREAS (e.g., "scope creep, token cost")

## Argument Parsing

Parse REMAINING_ARGS to extract:
1. **SPAWN**: true if `--spawn` is present
2. **PASSES**: integer after `--passes` (default: 1, clamp to 1-5)
3. **FOCUS_AREAS**: everything that isn't a flag

Examples:
- `/review-plan specs/my-feature.md` -- 1 pass, copy-paste output
- `/review-plan specs/my-feature.md --spawn` -- 1 pass, Codex executes it
- `/review-plan specs/my-feature.md --passes 3` -- 3 passes, copy-paste output
- `/review-plan specs/my-feature.md --spawn --passes 3` -- 3 passes, Codex executes each
- `/review-plan specs/my-feature.md --spawn --passes 2 security, migration` -- 2 passes with focus areas, Codex executes

## Instructions

- If no SPEC_PATH is provided, check for spec files in `specs/` and ask the user which one to review.
- Use ultrathink to deeply analyze the plan and identify what a staff engineer reviewer would need to evaluate it.
- The output is a PROMPT (or multiple prompts). Write it as instructions TO the reviewer.
- If SPAWN is true, you will execute reviews via `codex exec`. If false (or Codex unavailable), display prompts for copy-paste.
- If PASSES > 1, generate multiple review prompts with different personas. Each subsequent pass receives the previous pass's verdict and findings, and must find NEW issues only.

## Workflow

### 1. Read the Plan

Read the spec file at SPEC_PATH in full. Understand:
- What is being built
- The proposed architecture and file structure
- Migration/deletion of existing code
- Dependencies and integration points
- Scope and phasing

### 2. Read the Codebase Context

For every file the plan references (existing files to modify, files to delete, adjacent files), read them. The reviewer needs context about:
- What the current code actually looks like (not just what the plan says about it)
- Patterns established by sibling plugins/modules
- Existing conventions the plan must follow

Also read:
- `plugin.json` for any plugins being created or modified
- Existing skills/commands in the same plugin family
- CLAUDE.md or project conventions if referenced

### 3. Identify Review Dimensions

Based on the plan's content, select the most relevant review dimensions. Always include the first three; add others based on the plan:

| Dimension | Include When |
|-----------|-------------|
| **Architecture fitness** | Always -- boundaries, decomposition, abstraction levels |
| **Scope assessment** | Always -- is this the right amount of work for the stated goal? |
| **Consistency with existing patterns** | Always -- does this follow established conventions? |
| **Token economics** | Plan involves skills, lazy-loading, reference docs, or LLM-facing content |
| **Error recovery design** | Plan includes error handling, diagnostics, or troubleshooting flows |
| **Migration safety** | Plan deletes, moves, or rewrites existing files |
| **Testability** | Plan lists verification steps or acceptance criteria |
| **Security** | Plan touches auth, secrets, user input, or external APIs |
| **Performance** | Plan involves caching, I/O, network calls, or scaling concerns |
| **DX (developer experience)** | Plan creates CLI commands, skill interfaces, or user-facing workflows |
| **Dependency risk** | Plan introduces new packages, MCP servers, or external services |
| **Phasing/ordering** | Plan has multiple phases or task dependencies |

### 4. Formulate Pointed Questions

Read the plan closely and identify 3-7 specific questions that probe the plan's weakest points. These should be:
- **Concrete** -- reference specific sections, files, or decisions in the plan
- **Challenging** -- expose assumptions, edge cases, or trade-offs the author may not have considered
- **Answerable** -- the reviewer should be able to form an opinion, not just say "it depends"

Good question patterns:
- "The plan says X, but the existing code does Y. How does this reconcile?"
- "X and Y seem to overlap in responsibility. Which owns Z?"
- "The plan proposes deleting [file]. What currently depends on it?"
- "This adds N commands for v1. Could [A] be folded into [B]?"
- "The plan assumes [X]. What happens if [X] isn't true?"

### 5. Gather Existing Codebase Context

For the review prompt's "Context: Existing Codebase" section, collect:
- **Architecture overview** -- how the repo/plugin system works (read from CLAUDE.md, plugin.json, directory structure)
- **Files being modified** -- for each file the plan touches, summarize what it currently contains with relevant line counts and key sections
- **External dependencies** -- MCP tools, packages, APIs the plan relies on
- **Conventions** -- patterns from existing plugins that the new plan should follow

Be specific. Include line numbers, file paths, and actual content snippets. The reviewer shouldn't need to go read the codebase themselves.

### 6. Check Execution Mode

If SPAWN is true:
1. Run `which codex` to verify Codex CLI is available
2. If not found, warn the user and fall back to copy-paste mode
3. If found, create `specs/reviews/` directory if it doesn't exist
4. Proceed to execution (Step 8 for single pass, Step 9 for multi-pass)

If SPAWN is false:
1. Display the prompt(s) as markdown for copy-paste
2. For multi-pass, display all prompts sequentially with clear separators

### 7. Generate Review Prompt(s)

#### Single Pass (PASSES = 1)

Generate one review prompt using the Output Format below.

#### Multi-Pass (PASSES > 1)

Generate N review prompts, one per pass. Each pass uses a different reviewer persona that brings a distinct perspective. The personas are selected based on the plan's content -- pick the most relevant from this pool:

| Persona | Perspective | Best For |
|---------|------------|----------|
| **Architect** | System design, boundaries, abstractions, long-term maintainability | All plans |
| **Skeptic** | Scope creep, over-engineering, YAGNI, "what can we cut?" | Feature plans, large scopes |
| **Operator** | Failure modes, monitoring, rollback, "what happens at 3am?" | Infrastructure, deployment, error handling |
| **Security Engineer** | Attack surface, trust boundaries, secrets, auth flows | Auth, API, user input plans |
| **DX Advocate** | Ergonomics, cognitive load, naming, discoverability | CLI tools, SDKs, plugin interfaces |
| **Cost Analyst** | Token economics, compute costs, API call volume, caching ROI | LLM-facing features, multi-agent systems |
| **Migration Specialist** | Breaking changes, backwards compat, rollback paths, data migration | Refactors, rewrites, deletions |
| **Test Engineer** | Testability, coverage strategy, edge cases, verification | All plans with acceptance criteria |

**Pass construction rules:**
- Pass 1 always uses the **Architect** persona (broadest perspective)
- Subsequent passes use personas most relevant to the plan's risk areas
- Each pass after the first includes a "Prior Review Summary" section containing the previous pass's verdict, strengths, and all findings
- Later passes are instructed: "The previous reviewer(s) already identified the issues below. Do NOT repeat these. Find what they MISSED."
- The final pass (if PASSES >= 3) includes a "Synthesis" instruction: "In addition to your own findings, provide a 1-paragraph synthesis of whether the accumulated reviews have sufficiently de-risked this plan for implementation."

### 8. Execute Single Pass (SPAWN mode)

Write the review prompt to a temp file and execute:

```bash
# Write prompt to temp file
# (use Write tool to create /tmp/review-plan-prompt.md)

# Execute via Codex
codex exec - \
  --cd "$(pwd)" \
  -o "specs/reviews/<plan-name>-review.md" \
  < /tmp/review-plan-prompt.md
```

After completion:
1. Read the output file
2. Display the review to the user
3. Clean up the temp file

### 9. Execute Multi-Pass (SPAWN mode)

Run passes sequentially. Each pass must complete before the next starts (later passes need the previous verdict).

For each pass N (1 to PASSES):
1. Generate pass N's prompt (including prior review summaries for N > 1)
2. Write to `/tmp/review-plan-pass-N.md`
3. Execute:
   ```bash
   codex exec - \
     --cd "$(pwd)" \
     -o "specs/reviews/<plan-name>-review-pass-N.md" \
     < /tmp/review-plan-pass-N.md
   ```
4. Read the output file to extract verdict and findings for the next pass
5. Display a progress update: `Pass N/PASSES complete: <persona> verdict: <VERDICT>`

After all passes complete:
1. Display a summary table of all verdicts
2. If all passes APPROVE, say so
3. If any pass has critical issues, highlight them
4. Clean up temp files

## Output Format

Generate a complete, self-contained review prompt in this exact structure:

````markdown
# Staff Engineer Review: <Plan Title>

<!-- Pass N of M | Persona: <persona name> -->
<!-- (omit this line for single-pass reviews) -->

You are a staff engineer reviewing <brief description of what's being planned>. Your job is to identify risks, gaps, over-engineering, and missed opportunities before implementation begins.

<If multi-pass and N > 1, include:>
## Prior Review Summary

The following reviewer(s) have already evaluated this plan:

### Pass <N-1>: <Persona> -- Verdict: <VERDICT>

**Strengths identified:**
<bullet list from prior review>

**Issues found:**
<bullet list of all findings from prior review, grouped by severity>

**Do NOT repeat these issues.** Find what the previous reviewer(s) missed. Bring your <persona> perspective to uncover blind spots.

<End of prior review section>

## Your Review Mandate

<If multi-pass, add persona framing:>
You are reviewing this plan as a **<persona name>**. Your specific lens: <1-2 sentences describing this persona's perspective and what they prioritize>.

Evaluate this plan across these dimensions:

<numbered list of 5-8 dimensions, each with a 1-2 sentence description of what to look for, tailored to THIS specific plan>

## Specific Questions to Address

<bulleted list of 3-7 pointed questions that probe the plan's weakest points, each as a full paragraph with context>

## Context: Existing Codebase

### <Section Title, e.g., "Plugin Architecture" or "Module Structure">

<description of how the system works, with code blocks for directory structures and file paths>

### Files Being Modified

<for each file the plan touches: path, line count, summary of current contents, which sections are affected>

### <Additional Context Sections as Needed>

<e.g., "Existing MCP Tools", "API Surface", "Database Schema" -- whatever the reviewer needs to understand the landscape>

---

## The Plan

<reproduce or summarize the plan here -- include the proposed file tree, key architectural decisions, phasing, and migration steps. Include enough detail that the reviewer can evaluate without reading the original spec>

---

## Deliverable

Provide your review as:

1. **Verdict**: APPROVE / APPROVE WITH CONDITIONS / REQUEST CHANGES
2. **Strengths** -- what the plan gets right (2-4 bullets, genuine praise only)
3. **Critical issues** (must fix before implementation)
4. **Important observations** (should fix, but not blocking)
5. **Nice-to-haves** (optional improvements)
6. **Questions for the author** (things you'd ask in a review)

<If this is the final pass of a multi-pass review (PASSES >= 3), add:>

7. **Synthesis** -- In 1 paragraph, assess whether the accumulated reviews (yours and all prior passes) have sufficiently de-risked this plan for implementation. What residual risk remains?

Be direct and specific. Reference file paths and line numbers where relevant. If something is over-engineered for v1, say so and suggest what to cut.
````

## Copy-Paste Output Format (non-spawn mode)

When not spawning Codex, display the prompt(s) with clear framing:

### Single Pass

```
## Review Prompt

Copy this prompt into Codex, Claude, or your preferred reviewer:

---

<the full review prompt>

---

To run this with Codex automatically:

  codex exec - --cd "$(pwd)" -o specs/reviews/<plan-name>-review.md < prompt.md

Or re-run this command with --spawn to execute automatically.
```

### Multi-Pass

```
## Review Prompts (N passes)

### Pass 1: <Persona>

Copy this prompt into your reviewer:

---

<pass 1 prompt>

---

After receiving the Pass 1 review, run Pass 2:

### Pass 2: <Persona>

<pass 2 prompt -- includes Pass 1's findings in Prior Review Summary>

---

[...repeat for each pass...]

---

To run all passes automatically with Codex:

  /review-plan <spec-path> --spawn --passes N
```

## Spawn Output Format

When spawning Codex, display progress and results:

```
## Spawning Codex Review

Plan: <spec-path>
Passes: N
Mode: codex exec (read-only)

### Pass 1: <Persona>
Spawning... `codex exec - --cd $(pwd) -o specs/reviews/<name>-review-pass-1.md`
<show a brief progress indicator or wait for completion>
Verdict: <VERDICT>

### Pass 2: <Persona>
Spawning... (includes Pass 1 findings)
Verdict: <VERDICT>

[...repeat...]

---

## Review Summary

| Pass | Persona | Verdict |
|------|---------|---------|
| 1 | <persona> | <verdict> |
| 2 | <persona> | <verdict> |
| N | <persona> | <verdict> |

Review files saved to:
- specs/reviews/<name>-review-pass-1.md
- specs/reviews/<name>-review-pass-2.md

<If any critical issues, highlight them here>
```

## Rules

- The output must be a complete, self-contained prompt. The reviewer should NOT need access to the original spec file or the codebase.
- Include actual code snippets and file contents in the context section -- don't just reference paths.
- Every question must be grounded in something specific from the plan or codebase, not generic ("have you considered security?").
- The review dimensions must be tailored to this plan, not a generic checklist.
- If the plan references files that don't exist yet (new files to create), note their proposed contents from the plan.
- If FOCUS_AREAS is provided, ensure those areas appear as review dimensions and have pointed questions targeting them.
- Don't pad the prompt. If the plan is simple, the review prompt should be shorter. Match complexity to the plan's scope.
- For multi-pass: later passes MUST NOT repeat earlier findings. The value of multiple passes comes from fresh perspectives finding NEW issues.
- For spawn mode: if `codex` is not on PATH, fall back to copy-paste mode with a message explaining how to install Codex.
- For spawn mode: always use read-only sandbox (the default). Never pass `--full-auto` or `--sandbox danger-full-access` for reviews.
- Clean up temp files (`/tmp/review-plan-*.md`) after execution.
