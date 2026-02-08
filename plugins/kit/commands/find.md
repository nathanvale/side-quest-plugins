---
description: Find symbol definitions or list file symbols from the index
argument-hint: <symbol-name|file-path>
model: claude-haiku-4-5-20251001
---

# Find Symbol or File Overview

Find where a symbol is defined, or list all symbols in a file, using PROJECT_INDEX.json.

## Your Task

Execute kit_find with the provided arguments: $ARGUMENTS

Determine mode from arguments:
- If argument looks like a file path (contains `/` or `.ts`/`.js`/`.py`): use file_path mode
- Otherwise: use symbol_name mode

Use the MCP tool:
- `kit_find({ symbol_name: "<name>", response_format: "json" })` -- find symbol definition
- `kit_find({ file_path: "<path>", response_format: "json" })` -- list all symbols in file

What happens:
- Symbol mode: Exact match, then fuzzy fallback
- File mode: Returns all functions, classes, types with line numbers

Display results showing definitions found or file structure.
