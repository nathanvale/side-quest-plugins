---
name: orders
description: >
  Pull requirements from Jira or GitHub and convert them into a mission
  briefing that feeds into /enterprise:chart. Starfleet Command integration.
skill: the-bridge
argument-hint: '"[--source jira|github] [--sprint <id>] [--plain]"'
---

Pull requirements from external sources and convert them into a mission briefing format compatible with `/enterprise:chart`.

## Usage

```
/enterprise:orders --source github
/enterprise:orders --source jira --sprint POS-42
/enterprise:orders --source github --plain
/enterprise:orders --source jira
```

## Flags

| Flag | Description |
|------|-------------|
| `--source jira` | Pull from Jira (requires JIRA_* env vars) |
| `--source github` | Pull from GitHub issues/PRs |
| `--sprint <id>` | Filter to a specific sprint or milestone |
| `--plain` | Drop all character voice globally |

If `--source` is not provided, Spock will auto-detect based on available configuration (GitHub is default if both are available).
