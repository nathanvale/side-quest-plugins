---
name: away-mission
description: >
  Explore unfamiliar code with Spock's guidance. User-led exploration of
  a codebase target with reconnaissance suggestions, dependency analysis,
  and iterative Q&A.
skill: the-bridge
argument-hint: '"[--target <path>] [--focus <aspect>] [--plain]"'
---

Explore unfamiliar code with Spock advising. The Captain drives the exploration, Spock provides reconnaissance suggestions and analysis.

## Usage

```
/enterprise:away-mission --target node_modules/some-lib
/enterprise:away-mission --target src/legacy/
/enterprise:away-mission --target packages/unknown-package --focus "how auth works"
/enterprise:away-mission --target . --plain
```

## Flags

| Flag | Description |
|------|-------------|
| `--target <path>` | Path to the codebase area to explore |
| `--focus <aspect>` | Specific aspect to investigate (free text) |
| `--plain` | Drop all character voice globally |

If `--target` is not provided, Spock will prompt for one.
