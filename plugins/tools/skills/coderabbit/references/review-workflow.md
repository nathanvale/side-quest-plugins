# Review Workflow Reference

How to run CodeRabbit for each review scenario.

## Review Types

### Uncommitted Changes (default)

Reviews unstaged and staged changes against the current HEAD.

```bash
~/.local/bin/coderabbit review --prompt-only --type uncommitted
```

Best for: reviewing work before committing.

### Committed Changes

Reviews commits on the current branch vs a base branch.

```bash
~/.local/bin/coderabbit review --prompt-only --type committed --base main
```

If `--base` is omitted, CodeRabbit uses the repo's default branch. Always prefer explicit `--base` to avoid surprises.

Best for: pre-PR review of all branch changes.

### All Changes

Reviews both committed and uncommitted changes.

```bash
~/.local/bin/coderabbit review --prompt-only --type all --base main
```

Best for: comprehensive review before pushing.

## Custom Instructions

Pass additional context files with `--config`:

```bash
~/.local/bin/coderabbit review --prompt-only --type uncommitted --config .coderabbit.yaml
~/.local/bin/coderabbit review --prompt-only --type committed --base main --config .claude/CLAUDE.md
```

Multiple config files are supported:

```bash
~/.local/bin/coderabbit review --prompt-only --config .coderabbit.yaml --config .claude/CLAUDE.md
```

### Auto-inject project standards

The skill automatically appends the project's CLAUDE.md (or .coderabbit.yaml) as a `--config` file on every CLI invocation. This means CodeRabbit enforces the same coding standards documented in CLAUDE.md without extra configuration. The lookup order is:

1. `.claude/CLAUDE.md`
2. `CLAUDE.md`
3. `.coderabbit.yaml`

If the user explicitly passes `--config`, the standards file is appended as an additional config (not replaced).

## Working Directory

CodeRabbit runs in the current working directory by default. Use `--cwd` to target a different repo:

```bash
~/.local/bin/coderabbit review --prompt-only --cwd /path/to/other/repo
```

## Output Modes

The CLI supports three output modes:

| Flag | Mode | Use case |
|------|------|----------|
| (none) | Interactive TUI | Human browsing findings with arrow keys |
| `--plain` | Plain text | Detailed findings with fix suggestions, human-readable |
| `--prompt-only` | Token-efficient | Minimal structured text designed for LLM consumption |

**Always use `--prompt-only` in skill context.** It implies `--plain` (no TUI) and produces output optimized for AI agents -- file paths, line numbers, severity, and suggested fixes in a compact format.

The `--plain` flag is useful if the user wants more verbose output to read themselves.

There is no `--output=json` flag. Output is always plain text.

## Re-Triggering a Review

### After fixing issues (CLI mode)

Re-run the same command. CodeRabbit analyzes the current state of the working tree each time -- it doesn't cache previous results locally.

```bash
# Same command as before -- reviews the current state fresh
~/.local/bin/coderabbit review --prompt-only --type uncommitted
```

### After fixing issues (PR mode)

Post a comment on the PR to trigger a fresh CodeRabbit review:

```bash
gh pr comment {PR_NUMBER} --body "@coderabbitai review"
```

Other useful PR comment triggers:
- `@coderabbitai full review` -- force a complete re-review (not incremental)
- `@coderabbitai resolve` -- resolve all open CodeRabbit comment threads
- `@coderabbitai generate unit tests` -- generate tests for changed code

After posting, wait for CodeRabbit to process (can take several minutes), then re-fetch comments via the GitHub API.

### Timing expectations

Reviews take 7-30+ minutes depending on change scope. Plan accordingly -- don't poll in a tight loop. A reasonable approach is to run the CLI command, let it block until complete, then parse the output.

## Error Scenarios

### Authentication Failed

```
Error: Authentication required
```

Fix: `~/.local/bin/coderabbit auth login`

### No Files for Review

```
REVIEW ERROR: Review failed: No files found for review
```

This means the selected `--type` has no matching changes. Check `git status` and `git log` to confirm.

### Rate Limiting

CodeRabbit's cloud service may rate-limit. If you see timeout or 429 errors, wait 30 seconds and retry once.

### Network Errors

The CLI requires internet access to reach CodeRabbit's review service. VPN or proxy issues may interfere -- check `proxy-status` if on a corporate network.
