---
name: hail
description: >
  Generate stakeholder-facing reports from the Captain's Log. Compile
  standup updates, sprint reviews, or PR descriptions from recorded events.
skill: the-bridge
argument-hint: '"[--target standup|review|pr] [--since <date>] [--plain]"'
---

Generate stakeholder-facing reports by compiling Captain's Log events into formatted summaries.

## Usage

```
/enterprise:hail --target standup
/enterprise:hail --target review
/enterprise:hail --target pr
/enterprise:hail --target standup --since 2026-02-15
/enterprise:hail --target review --plain
```

## Flags

| Flag | Description |
|------|-------------|
| `--target standup` | Generate a standup update (yesterday's completions, today's plan, blockers) |
| `--target review` | Generate a sprint review summary (all merged PRs, scan results, metrics) |
| `--target pr` | Generate a PR description from recent changes and log events |
| `--since <date>` | Filter events from this date onward (ISO format: YYYY-MM-DD) |
| `--plain` | Drop all character voice globally |

If `--target` is not provided, Spock will prompt for the report type.
