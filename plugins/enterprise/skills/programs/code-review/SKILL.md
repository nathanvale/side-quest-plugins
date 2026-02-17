---
name: program-code-review
description: >
  Code review program. Injected dynamically into Computer CPUs by the
  medical station. Defines analysis approach, priority read order,
  check categories, and output template for code review reports.
---

# Program: Code Review

## Input Contract

The assignment JSON contains:

```json
{
  "path": "src/",
  "doc_type": "review",
  "review_focus": "security|performance|quality|all",
  "file_manifest": [{"name": "auth.ts", "size": 2048}, ...],
  "plain": false,
  "budget": {"max_files": 30, "max_lines_per_file": 500}
}
```

## Analysis Phase

Read files from the manifest. Do NOT re-enumerate -- the station already ran Glob.

**Priority read order:**
1. Configuration files (`package.json`, `tsconfig.json`, `biome.json`, `.eslintrc*`) -- establish project conventions
2. Entry/index files (`index.ts`, `main.ts`) -- understand module structure
3. Source files ordered by size descending (larger files are more likely to contain issues)
4. Test files (for coverage gaps, test quality)

**For each source file, check based on `review_focus`:**

### Focus: `security`
- Injection vulnerabilities (SQL, command, path traversal)
- Unsafe `eval()`, `Function()`, `innerHTML`, `dangerouslySetInnerHTML`
- Hardcoded secrets, API keys, credentials
- Missing input validation at system boundaries
- Insecure cryptographic usage
- Prototype pollution risks
- Unvalidated redirects
- Missing authentication/authorization checks

### Focus: `performance`
- Unnecessary re-renders (React components without memoization where needed)
- N+1 query patterns
- Unbounded loops or recursion
- Missing pagination on data fetching
- Large synchronous operations that should be async
- Memory leaks (event listeners not cleaned up, unclosed resources)
- Inefficient data structures (array lookups where Maps/Sets would be better)
- Bundle size concerns (large imports that could be tree-shaken)

### Focus: `quality`
- Dead code (unused exports, unreachable branches)
- Code duplication (similar logic in multiple places)
- Overly complex functions (deep nesting, long parameter lists, excessive branching)
- Missing error handling at system boundaries
- Inconsistent naming or style (relative to project conventions from config files)
- Type safety issues (`any` types, missing null checks, unsafe casts)
- Poor abstraction (god functions, feature envy, inappropriate coupling)
- Missing or misleading documentation on public APIs

### Focus: `all`
- Run all three categories above
- Prioritize findings by severity across categories

## Severity Classification

- **Critical**: Security vulnerabilities, data loss risks, crashes, race conditions
- **Warning**: Performance issues, maintainability concerns, potential bugs
- **Info**: Style inconsistencies, minor improvements, suggestions

## Output Template

Generate a code review report:

```markdown
## Code Review Report

### Summary

| Category | Critical | Warning | Info |
|----------|----------|---------|------|
| Security | {N} | {N} | {N} |
| Performance | {N} | {N} | {N} |
| Quality | {N} | {N} | {N} |
| **Total** | **{N}** | **{N}** | **{N}** |

### Critical Issues

#### {issue_title}

**File**: `{file_path}:{line_number}`
**Category**: {security|performance|quality}

{description of the issue}

```{language}
// Current code
{problematic code snippet}
```

**Suggested fix:**
```{language}
{suggested replacement}
```

---

### Warnings

#### {issue_title}

**File**: `{file_path}:{line_number}`
**Category**: {security|performance|quality}

{description}

---

### Info

#### {issue_title}

**File**: `{file_path}:{line_number}`
**Category**: {security|performance|quality}

{description}
```

## Rules

- **No false positives over completeness.** Only report issues you are confident about. When uncertain, omit rather than guess.
- **Attribute every finding.** Every issue must reference a specific file and line number.
- **No editorializing.** Report what is wrong and how to fix it. Do not lecture about best practices in general.
- **Respect the focus.** If `review_focus` is `security`, do not report quality issues unless they are also security-relevant.
- **Actionable fixes.** Every critical and warning issue should include a concrete suggested fix, not just a description.
- **Cross-reference conventions.** Check findings against project config (tsconfig strictness, biome rules, etc.). Do not flag things the project has explicitly configured to allow.
- **Omit empty sections.** If no critical issues exist, omit the Critical Issues section entirely.
