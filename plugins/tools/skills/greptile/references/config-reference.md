# Greptile Configuration Reference

Greptile is configured via `greptile.json` at the repo root or a `.greptile/`
folder. Dashboard settings provide org-level defaults.

## Configuration Hierarchy

Priority (highest first):

1. **Org enforced rules** -- set by admins in dashboard, cannot be overridden
2. **`.greptile/` folder** -- repo-level, cascading overrides
3. **`greptile.json`** -- repo-level, single file
4. **Dashboard settings** -- org/repo defaults

## greptile.json Schema

Place at repository root.

```json
{
  "strictness": 2,
  "commentTypes": ["logic", "syntax", "style"],
  "triggerOnUpdates": false,
  "skipReview": null,
  "model": null,
  "ignorePatterns": [
    "*.lock",
    "*.min.js",
    "dist/**",
    "node_modules/**",
    "**/*.generated.ts"
  ],
  "labels": [],
  "disabledLabels": ["skip-review"],
  "includeAuthors": [],
  "excludeAuthors": ["dependabot[bot]"],
  "includeBranches": [],
  "excludeBranches": [],
  "includeKeywords": [],
  "ignoreKeywords": [],
  "fileChangeLimit": 100,
  "instructions": "Focus on security issues and performance regressions.",
  "customContext": {
    "rules": [
      {
        "pattern": "src/api/**/*.ts",
        "instruction": "All API endpoints must implement rate limiting middleware."
      }
    ],
    "files": [
      "docs/style-guide.md",
      "docs/architecture.md"
    ]
  },
  "patternRepositories": [
    "owner/shared-types"
  ],
  "shouldUpdateDescription": true,
  "updateExistingSummaryComment": true,
  "updateSummaryOnly": false,
  "fixWithAI": true,
  "includeConfidenceScore": true,
  "includeSequenceDiagram": true,
  "includeIssuesTable": true
}
```

### Review Behaviour

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `strictness` | 1/2/3 | 2 | 1 = lenient, 2 = balanced, 3 = strict |
| `commentTypes` | string[] | all | `logic`, `syntax`, `style`, `info` |
| `triggerOnUpdates` | boolean | false | Review every push, not just PR open |
| `skipReview` | string | null | `"AUTOMATIC"` to disable auto-reviews |
| `model` | string | null | Override AI model selection |
| `instructions` | string | null | Natural language review instructions |

### File Filtering

| Field | Type | Description |
|-------|------|-------------|
| `ignorePatterns` | string[] | Gitignore-style patterns to skip |
| `fileChangeLimit` | number | Skip review if file count exceeds this |

### PR Filtering

| Field | Type | Description |
|-------|------|-------------|
| `labels` | string[] | Only review PRs with these labels |
| `disabledLabels` | string[] | Skip PRs with these labels |
| `includeAuthors` | string[] | Only review PRs by these authors |
| `excludeAuthors` | string[] | Skip PRs by these authors |
| `includeBranches` | string[] | Only review PRs targeting these branches |
| `excludeBranches` | string[] | Skip PRs targeting these branches |

### Review Output

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `shouldUpdateDescription` | boolean | true | Auto-update PR description |
| `updateExistingSummaryComment` | boolean | true | Edit existing summary vs new comment |
| `updateSummaryOnly` | boolean | false | Only post summary, no inline comments |
| `fixWithAI` | boolean | true | Include AI fix suggestions |
| `includeConfidenceScore` | boolean | true | Show 0-5 confidence rating |
| `includeSequenceDiagram` | boolean | true | Auto-generate diagrams |
| `includeIssuesTable` | boolean | true | File-by-file issue table |

### Custom Context

| Field | Type | Description |
|-------|------|-------------|
| `customContext.rules` | object[] | Scoped rules with `pattern` + `instruction` |
| `customContext.files` | string[] | Reference docs for reviewer context |
| `patternRepositories` | string[] | Related repos to cross-reference |

## .greptile/ Folder

The `.greptile/` folder supports everything `greptile.json` does, plus:

- **Cascading overrides** -- place config files in subdirectories for scoped rules
- **Separate rules files** -- split rules into multiple files for organization
- **Structured rules** -- rules with severity levels and disable-by-ID support

### Folder Structure

```
.greptile/
├── config.json          # Same schema as greptile.json
├── rules/
│   ├── security.md      # Security-focused rules
│   ├── performance.md   # Performance rules
│   └── testing.md       # Test coverage rules
└── ignore               # Additional ignore patterns
```

### Structured Rules (in rules files)

```markdown
# Security Rules

## SEC-001: SQL Injection Prevention
**Severity:** critical
**Pattern:** src/db/**/*.ts
Never use string concatenation for SQL queries. Always use parameterized queries.

## SEC-002: Input Validation
**Severity:** important
**Pattern:** src/api/**/*.ts
All user input must be validated before processing.
```

Rules can be disabled by ID (e.g., `SEC-001`) from the dashboard or via
`greptile.json` ignore settings.

## Generating Configuration

To create a starter `greptile.json`:

```bash
# Minimal config
echo '{
  "strictness": 2,
  "ignorePatterns": ["*.lock", "dist/**", "node_modules/**"],
  "excludeAuthors": ["dependabot[bot]"]
}' > greptile.json
```

The skill can help generate or modify configuration based on the user's
preferences and repo structure.
