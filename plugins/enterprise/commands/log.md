---
name: log
description: >
  View the Captain's Log -- session activity, token telemetry, and event history.
  Spock reads the JSONL log, filters by event type, and renders a human-friendly
  timeline with session totals.
skill: the-bridge
argument-hint: '"[--filter costs|merged|completed|failed] [--save] [--plain]"'
---

View the Captain's Log for the current session. Spock reads the structured JSONL event log and renders a human-friendly timeline with token telemetry and session totals.

## Usage

```
/enterprise:log
/enterprise:log --filter costs
/enterprise:log --filter merged,completed
/enterprise:log --filter failed
/enterprise:log --save
/enterprise:log --plain
/enterprise:log --filter costs --save --plain
```

## Flags

| Flag | Description |
|------|-------------|
| `--filter costs` | Show only events with token telemetry and cost estimates |
| `--filter merged` | Show only PR merged events |
| `--filter completed` | Show only completed implementation and scan events |
| `--filter failed` | Show only review failures and errors |
| `--save` | Write rendered markdown to `logs/captains-log-{date}.md` |
| `--plain` | Drop all character voice globally |

Filters can be combined with commas: `--filter costs,completed`.
