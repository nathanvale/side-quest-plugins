# Output Parsing Reference

How to parse CodeRabbit's `--prompt-only` output.

## Output Structure

The `--prompt-only` flag produces structured text to stdout. The output has two sections:

### Progress Lines (ignore)

```
Starting CodeRabbit review in plain text mode...
Connecting to review service
Setting up
Analyzing
Reviewing
```

These are status updates. Skip them.

### Findings (parse these)

Each finding is delimited by a line of `=` characters:

```
============================================================================
File: <filename>
Line: <line> or <start> to <end>
Type: <type>

Prompt for AI Agent:
Verify each finding against the current code and only fix it if needed.

<description of the issue and suggested fix>
```

### Completion Line

```
Review completed ✔
```

If this line is missing, the review may have failed or been interrupted.

## Parsing Algorithm

1. Split stdout on `============` separator lines
2. For each block, extract:
   - **File**: value after `File: `
   - **Line**: value after `Line: ` (may be a single number or `N to M` range)
   - **Type**: value after `Type: ` (e.g. `potential_issue`)
   - **Description**: everything after the `Verify each finding...` preamble line

## Type Mapping

CodeRabbit uses `Type:` values. Map them to severity for display:

| CodeRabbit Type | Display Severity |
|----------------|-----------------|
| `security` | Critical |
| `bug` | Critical |
| `potential_issue` | Important |
| `improvement` | Suggestion |
| `style` | Suggestion |
| `nitpick` | Nitpick |
| Other / unknown | Important (default) |

Note: as of early 2026, most findings come through as `potential_issue`. The type taxonomy may expand in future CLI versions.

## Edge Cases

- **Update banner**: CodeRabbit may print an update notification box at the top (with `╔══...` borders). Ignore everything before `Starting CodeRabbit review`.
- **No findings**: If the output contains `Review completed` but no `====` separator blocks, the review found no issues. This is a clean bill of health.
- **Multiple files**: Findings for different files are interleaved in the output. Group by file when presenting.
- **@-prefixed filenames**: In the description text, filenames are sometimes prefixed with `@` (e.g. `@security.js`). Strip the `@` when referencing actual file paths.
