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
~/.local/bin/coderabbit review --prompt-only --type committed --base main --config claude.md
```

Multiple config files are supported:

```bash
~/.local/bin/coderabbit review --prompt-only --config .coderabbit.yaml --config team-standards.md
```

## Working Directory

CodeRabbit runs in the current working directory by default. Use `--cwd` to target a different repo:

```bash
~/.local/bin/coderabbit review --prompt-only --cwd /path/to/other/repo
```

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
