---
name: coderabbit
description: >
  Run a CodeRabbit AI code review on the current repo. Reviews uncommitted
  changes by default, or committed changes vs a base branch. Use when user
  asks to "review my code", "run a code review", "check my changes with
  CodeRabbit", or "scan for issues before I push".
disable-model-invocation: true
argument-hint: '[--type committed|uncommitted|all] [--base <branch>] [--fix] [--config <file>]'
allowed-tools: Bash(coderabbit:*), Bash(git status:*), Bash(git diff:*), Read, Edit, Write, Glob, Grep, AskUserQuestion
---

# CodeRabbit Review Skill

You orchestrate CodeRabbit CLI reviews. Your job: run the review, parse findings, present them clearly, and optionally fix them.

## Workflow

### 1. Parse Arguments

Extract from `$ARGUMENTS`:

| Flag | Default | Notes |
|------|---------|-------|
| `--type` | `uncommitted` | `committed`, `uncommitted`, or `all` |
| `--base` | - | Base branch for `committed` reviews |
| `--fix` | `false` | Enable auto-remediation |
| `--config` | - | Path to additional instructions file |

### 2. Preflight Check

Before running CodeRabbit:

1. Run `git status` to confirm there are reviewable changes
2. For `--type uncommitted` -- verify there are unstaged/staged changes
3. For `--type committed` -- verify there are commits ahead of base
4. If no changes found, tell the user and stop

### 3. Run CodeRabbit

Build and execute the command:

```bash
~/.local/bin/coderabbit review --prompt-only --type <type> [--base <branch>] [--config <file>]
```

Key flags:
- `--prompt-only` -- structured text output (implies `--plain`, no interactive TUI)
- Always use the full path `~/.local/bin/coderabbit`

See [references/review-workflow.md](references/review-workflow.md) for details on each review type.

### 4. Parse Output

Parse the stdout using the format documented in [references/output-parsing.md](references/output-parsing.md).

Extract each finding into:
- **File** and **line number(s)**
- **Type** (maps to severity)
- **Description** (the "Prompt for AI Agent" block)

### 5. Present Findings

Group findings and present a summary:

```
## CodeRabbit Review: N findings

### Critical (N)
- **file.ts:42** -- Description of the issue

### Important (N)
- **file.ts:15-20** -- Description of the issue

### Suggestions (N)
- **file.ts:8** -- Description of the issue
```

If no findings, congratulate the user -- clean code.

### 6. Remediation (--fix mode)

When `--fix` is set, after presenting the summary:

1. Work through findings from highest severity to lowest
2. For each finding:
   a. Read the affected file
   b. Propose a specific fix based on the CodeRabbit suggestion
   c. Ask the user to confirm before applying (use AskUserQuestion)
   d. Apply the fix using Edit
   e. Move to the next finding
3. After all findings are addressed, run CodeRabbit again to verify no regressions

If `--fix` is NOT set, end with: "Run with `--fix` to walk through remediation."

## Error Handling

- **"No files found for review"** -- No reviewable changes. Tell the user.
- **Auth errors** -- Suggest running `coderabbit auth login`.
- **Rate limits / timeouts** -- Wait and retry once. If still failing, report the error.
- **Non-zero exit code** -- Show the stderr output to the user.

## Important Notes

- Never run CodeRabbit in interactive mode (always use `--prompt-only`)
- The CLI binary lives at `~/.local/bin/coderabbit` -- always use the full path
- CodeRabbit sends diffs to its cloud service for analysis -- the user is aware of this
- Findings are suggestions, not mandates -- always let the user decide what to fix
