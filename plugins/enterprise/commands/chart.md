---
name: chart
description: >
  Plan an implementation before executing. Spock performs codebase reconnaissance,
  gathers requirements, and produces a structured plan with tasks, dependencies,
  and file boundaries that engage can execute.
skill: the-bridge
argument-hint: '"[path or description] [--deep] [--plain] [--yes]"'
---

Plan an implementation task. Spock performs codebase reconnaissance, gathers requirements interactively, and produces a structured plan with tasks, dependencies, and file boundaries.

## Usage

```
/enterprise:chart "add JWT auth middleware to src/api/"
/enterprise:chart src/components/ --deep
/enterprise:chart "refactor the validation layer" --yes
/enterprise:chart . --plain
/enterprise:chart "add dark mode support" --deep --yes
```

## Flags

| Flag | Description |
|------|-------------|
| `--deep` | Deeper reconnaissance -- read more files, explore dependencies |
| `--plain` | Drop all character voice globally |
| `--yes` | Skip confirmation, produce plan directly |

The first positional argument is either a path to target or a description of the work to plan. If it looks like a file path (contains `/` or `.`), treat it as a target directory. Otherwise, treat it as a natural language description of the task.
