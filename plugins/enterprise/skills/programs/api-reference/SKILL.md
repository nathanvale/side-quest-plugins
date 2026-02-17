---
name: program-api-reference
description: >
  API reference generation program. Injected dynamically into Computer CPUs
  by the dispatching station. Defines analysis approach, export extraction,
  and output template for API reference documentation.
---

# Program: API Reference Generation

## Input Contract

The assignment JSON contains:

```json
{
  "path": "src/utils/",
  "doc_type": "api",
  "file_manifest": [{"name": "index.ts", "size": 512}, ...],
  "existing_docs": ["API.md"],
  "plain": false,
  "budget": {"max_files": 20, "max_lines_per_file": 300}
}
```

## Analysis Phase

Read files from the manifest. Do NOT re-enumerate -- the station already ran Glob.

**Priority read order:**
1. `package.json` (module name, description)
2. `index.ts` / `index.js` (main exports, re-export map)
3. Source files that are re-exported from the index
4. Remaining source files in alphabetical order
5. Test files (for usage examples, lower priority)

**For each source file, extract:**
- Exported functions (name, full signature, JSDoc, implementation notes)
- Exported types/interfaces (name, all properties with types)
- Exported classes (name, constructor, methods, properties)
- Exported constants (name, type, value or description)
- Re-exports (what is re-exported and from where)

## Output Template

Generate an API reference with applicable sections:

```markdown
# API Reference -- {module_name}

{module overview from index file or package description}

## Functions

### `functionName(param: Type): ReturnType`

{description from JSDoc or inferred from implementation}

**Parameters:**
- `param` (`Type`) -- {description}

**Returns:** `ReturnType` -- {description}

**Example:**
\`\`\`typescript
{usage example from tests or inferred}
\`\`\`

## Types

### `TypeName`

{description}

\`\`\`typescript
{type definition}
\`\`\`

## Constants

### `CONSTANT_NAME`

{description and value}

## Re-exports

- `{name}` from `{source}`
```

## Rules

- Omit sections that have no data
- Do not fabricate content
- Attribute code examples to source files where possible (e.g., "from `utils.ts`")
- Include the full type signature for every exported symbol
- Group related functions/types when they share a logical domain
