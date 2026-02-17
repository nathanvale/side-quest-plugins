---
name: document
description: >
  Generate documentation for a codebase target. Spock confirms the parameters,
  then dispatches the Ship's Computer to analyze code and produce READMEs or
  API references.
skill: the-bridge
argument-hint: '"[path] [--type readme|api] [--deep] [--plain] [--yes]"'
---

Generate documentation for a codebase target. Spock confirms the assignment, then dispatches the Ship's Computer to analyze code and produce documentation.

## Usage

```
/enterprise:document src/
/enterprise:document src/utils/ --type api
/enterprise:document . --type readme --deep
/enterprise:document packages/core --plain
/enterprise:document src/components/ --type api --deep --plain
/enterprise:document src/ --type readme --yes
/enterprise:document . --type api --deep --yes
```

## Flags

| Flag | Description |
|------|-------------|
| `--type readme` | Generate a README for the target |
| `--type api` | Generate an API reference for exported symbols |
| `--deep` | Larger analysis budget (50 files, 500 lines/file) |
| `--plain` | Drop all character voice globally |
| `--yes` | Skip confirmation when all parameters are explicit |

Path is auto-detected from the first positional argument. Doc type is auto-detected if `--type` is omitted (package.json or project root = readme, exported functions/classes = api, default = readme).
