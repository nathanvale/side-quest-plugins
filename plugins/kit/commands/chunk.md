---
description: Split a file into LLM-friendly chunks
argument-hint: <file-path> [--strategy symbols|lines] [--max-lines N]
model: claude-haiku-4-5-20251001
---

# Chunk File for LLM Processing

Split a file into chunks at function boundaries or by line count.

## Your Task

Execute kit_chunk with the provided arguments: $ARGUMENTS

Parse arguments:
- First arg: file path (e.g., `src/kit-wrapper.ts`)
- `--strategy symbols|lines` -- Chunking strategy (default: symbols)
- `--max-lines N` -- Max lines per chunk (only for lines strategy, default: 50)

Use the MCP tool:
```
kit_chunk({
  file_path: "<path>",
  strategy: "symbols",  // or "lines"
  max_lines: 50,         // only for lines strategy
  response_format: "json"
})
```

What happens:
- **symbols** strategy: Splits at function/class boundaries (semantic chunking)
- **lines** strategy: Splits by line count (configurable)
- Returns chunks with metadata (name, line ranges, content)

Display the chunks with their metadata.
