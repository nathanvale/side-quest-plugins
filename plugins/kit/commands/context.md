---
description: Extract full enclosing definition around a file:line
argument-hint: <file-path> <line-number>
model: claude-haiku-4-5-20251001
---

# Extract Code Context

Extract the full enclosing function/class/method around a specific line.

## Your Task

Execute kit_context with the provided arguments: $ARGUMENTS

Parse arguments:
- First arg: file path (e.g., `src/kit-wrapper.ts`)
- Second arg: line number (e.g., `42`)

Use the MCP tool:
```
kit_context({ file_path: "<path>", line: <number>, response_format: "json" })
```

What happens:
- Kit CLI finds the enclosing definition (function, class, method) containing the line
- Returns the complete definition body with context
- Much more efficient than reading the entire file

Display the extracted context with syntax highlighting.
