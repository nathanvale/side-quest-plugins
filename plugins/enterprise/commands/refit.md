---
name: refit
description: >
  Analyze code for refactoring opportunities. Scotty's engineering station
  examines complexity, duplication, and coupling, then presents a prioritized
  improvement plan.
skill: the-bridge
argument-hint: '"[path] [--focus complexity|duplication|coupling|all] [--deep] [--plain] [--yes]"'
---

Analyze code for refactoring opportunities. Mr. Scott confirms the assignment, then dispatches the Ship's Computer to examine complexity, duplication, and coupling.

## Usage

```
/enterprise:refit src/
/enterprise:refit src/utils/ --focus complexity
/enterprise:refit . --focus duplication --deep
/enterprise:refit packages/core --plain
/enterprise:refit src/components/ --focus coupling --deep --plain
/enterprise:refit src/ --focus all --yes
/enterprise:refit . --deep --yes
```

## Flags

| Flag | Description |
|------|-------------|
| `--focus complexity` | Focus on cyclomatic complexity and deep nesting |
| `--focus duplication` | Focus on duplicated code patterns across files |
| `--focus coupling` | Focus on import chains, circular dependencies, tight coupling |
| `--focus all` | Analyze all categories (default) |
| `--deep` | Larger analysis budget (60 files, 800 lines/file) |
| `--plain` | Drop all character voice globally |
| `--yes` | Skip confirmation when all parameters are explicit |

Path is auto-detected from the first positional argument.
