# Learnings Bootstrap Guide

How to teach CodeRabbit your team's preferences so reviews improve over time.

## What Are Learnings?

CodeRabbit maintains a vector database of natural-language preferences. When you
tell it "Don't flag unused imports in test files", it stores that as a learning
and applies it via semantic search on future reviews.

## Scoping

| Scope | Behavior |
|-------|----------|
| `local` | Applies only to this repo |
| `global` | Applies across your entire org |
| `auto` (default) | Local for public repos, global for private |

Configured in `.coderabbit.yaml`:

```yaml
knowledge_base:
  learnings:
    scope: "auto"
```

## Adding Learnings

### Method 1: Chat in PR comments

Reply to any CodeRabbit comment on a PR:

```
@coderabbitai Don't flag missing JSDoc in test files.
@coderabbitai We use Bun, not Node -- suggest bun:test patterns, not jest.
@coderabbitai Our cache module intentionally serves stale data on 429 errors. Don't flag this as a bug.
```

### Method 2: Import from a standards file

In any PR comment:

```
@coderabbitai add a learning using docs/coding-standards.md
```

CodeRabbit reads the file and extracts preferences as learnings.

> **Note:** `.claude/CLAUDE.md` is auto-detected by CodeRabbit as code guidelines -- it does not need manual import via this command.

### Method 3: Manage via web UI

Visit `app.coderabbit.ai/settings/repositories` to:
- View all learnings with similarity search
- Edit or delete individual learnings
- Export to CSV
- Import from CSV (useful for migrating between orgs)

## Recommended Bootstrap Learnings

For a TypeScript + Bun + Biome project, teach CodeRabbit these preferences on
your first few PRs:

### Style and tooling

```
@coderabbitai We use Biome for formatting and linting, not ESLint or Prettier. Don't suggest ESLint rules or Prettier config.
@coderabbitai We use Bun as our runtime and test runner. Suggest bun: APIs and Bun.spawnSync patterns, not node: or jest.
@coderabbitai We use tabs for indentation, single quotes, and trailing commas. This is enforced by Biome.
```

### Architecture

```
@coderabbitai src/index.ts is a pure barrel export. It must have zero logic, only re-exports.
@coderabbitai src/cli.ts is the only file allowed to do I/O. Library code in src/lib/ must be pure functions.
@coderabbitai The only allowed runtime dependency is @side-quest/core. Flag any new dependencies added to "dependencies" in package.json.
```

### Testing

```
@coderabbitai Tests live in tests/index.test.ts and use Bun.spawnSync for CLI subprocess testing. The --mock flag loads fixtures.
@coderabbitai Don't require JSDoc on test functions or describe blocks.
```

### Known patterns (prevent false positives)

```
@coderabbitai Stale cache fallback on 429 errors is intentional. The cache module serves expired data as a graceful degradation strategy.
@coderabbitai N-gram deduplication uses 3-char grams with 70% Jaccard similarity threshold. This is tuned and correct.
@coderabbitai WebSearch delegation is by design -- the CLI outputs JSON instructions for Claude's WebSearch tool rather than searching directly.
```

## Maintenance

- Review learnings quarterly (stale learnings cause false negatives)
- If you disable "Data Retention" in CodeRabbit settings, all learnings are
  **immediately and irrevocably deleted** -- no warning, no export prompt
- Export to CSV before making settings changes

## Critical Warning

Learnings only apply during PR-based reviews on the Pro plan with data retention
enabled. The CLI's `--prompt-only` mode does NOT access learnings unless you're
authenticated with a Pro account.
