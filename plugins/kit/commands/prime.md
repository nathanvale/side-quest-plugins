---
description: Generate or refresh PROJECT_INDEX.json for fast codebase queries
argument-hint: [path] [--force]
model: claude-haiku-4-5-20251001
---

# Prime the Codebase Index

Generate PROJECT_INDEX.json to enable token-efficient codebase queries.

## Your Task

Run kit_prime with any provided arguments: $ARGUMENTS

Use the MCP tool:
- `kit_prime({ response_format: "json" })` -- default, index current repo
- `kit_prime({ path: "<dir>", response_format: "json" })` -- index specific directory
- `kit_prime({ force: true, response_format: "json" })` -- force regenerate

If no arguments, run with defaults. Parse `--force` flag from arguments.

What happens:
- Auto-detects git repository root
- Checks for existing index (skips if fresh < 24h)
- Generates new index if missing, stale, or `--force` used
- Reports file count, symbol count, and index size

Display the results showing index status.
