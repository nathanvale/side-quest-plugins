---
name: scan
description: >
  Run a code review on a codebase target. Spock routes to Dr. McCoy's
  medical station, where the Ship's Computer performs diagnostics and
  presents findings.
skill: the-bridge
argument-hint: '"[path] [--focus security|performance|quality|all] [--deep] [--plain] [--yes]"'
---

Run a code review on a codebase target. Dr. McCoy confirms the assignment, then dispatches the Ship's Computer to analyze code and report findings.

## Usage

```
/enterprise:scan src/
/enterprise:scan src/utils/ --focus security
/enterprise:scan . --focus quality --deep
/enterprise:scan packages/core --plain
/enterprise:scan src/components/ --focus performance --deep --plain
/enterprise:scan src/ --yes
/enterprise:scan . --focus security --deep --yes
```

## Flags

| Flag | Description |
|------|-------------|
| `--focus security` | Focus on security vulnerabilities and unsafe patterns |
| `--focus performance` | Focus on performance issues and optimization opportunities |
| `--focus quality` | Focus on code quality, anti-patterns, and maintainability |
| `--focus all` | Review all categories (default) |
| `--deep` | Larger analysis budget (60 files, 800 lines/file) |
| `--plain` | Drop all character voice globally |
| `--yes` | Skip confirmation when all parameters are explicit |

Path is auto-detected from the first positional argument.
