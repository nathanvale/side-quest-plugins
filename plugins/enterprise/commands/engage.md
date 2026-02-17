---
name: engage
description: >
  Execute an implementation plan. Spock coordinates Builder (Scotty) and
  Validator (McCoy) in a 2-station pipeline -- implement, review, fix, repeat.
  Requires a plan file from /enterprise:chart.
skill: the-bridge
argument-hint: '"[--plan <path>] [--skip-validation] [--plain] [--yes]"'
---

Execute an implementation plan with the Builder/Validator pipeline. Scotty implements each task, McCoy reviews. PASS/FAIL loop with automatic retries.

## Usage

```
/enterprise:engage --plan specs/auth-plan.md
/enterprise:engage --plan specs/auth-plan.md --yes
/enterprise:engage --plan specs/auth-plan.md --skip-validation
/enterprise:engage --plan specs/auth-plan.md --plain
/enterprise:engage --plan specs/auth-plan.md --skip-validation --yes --plain
```

## Flags

| Flag | Description |
|------|-------------|
| `--plan <path>` | Path to the plan file (from `/enterprise:chart` output) |
| `--skip-validation` | Skip McCoy's review step (Builder only) |
| `--plain` | Drop all character voice globally |
| `--yes` | Skip confirmation, begin execution immediately |

A plan file is required. If not provided, Spock will prompt for one.
