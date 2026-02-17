---
name: project-conventions
description: >
  Knowledge skill for project conventions and coding standards. Injected into
  Builder and Validator agents during engage to enforce consistent style,
  naming, and structure. Not user-invocable.
user-invocable: false
---

# Knowledge: Project Conventions

This knowledge skill provides context about project coding standards and conventions. Injected into Builder (Scotty) and Validator (McCoy) agents during engage.

## Formatting (Biome)

- **Indentation**: Tabs (not spaces)
- **Quotes**: Single quotes (`'hello'` not `"hello"`)
- **Line width**: 80 characters
- **Semicolons**: Required
- **Trailing commas**: All (ES5+)
- **Tool**: Biome (not Prettier, not ESLint) -- single root `biome.json` only, NEVER nested configs

## Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `my-util.ts`, `user-service.ts` |
| Directories | kebab-case | `test-utils/`, `side-quest/` |
| Functions | camelCase | `doSomething()`, `validatePath()` |
| Variables | camelCase | `const maxRetries = 3` |
| Types/Interfaces | PascalCase | `type MyType`, `interface UserConfig` |
| Constants | camelCase or UPPER_SNAKE_CASE | `const defaultTimeout = 5000` or `const MAX_RETRIES = 3` |
| Test files | colocated with source | `my-util.test.ts` next to `my-util.ts` |

## Exports

- **Named exports only** -- no default exports, ever
- **Barrel exports** -- `index.ts` re-exports public API
- **Internal code** -- prefix with `_` or keep unexported; do not expose implementation details

## File Structure

```
src/
  feature-name/
    feature-name.ts          -- Main implementation
    feature-name.test.ts     -- Colocated tests
    feature-name.types.ts    -- Types (if complex)
    index.ts                 -- Barrel export
```

## Commit Format

Conventional Commits (enforced by commitlint):

```
type(scope): subject

Types: feat, fix, chore, refactor, test, docs, perf, ci
Scope: package or feature name
Subject: imperative, lowercase, no period
```

## What Builders Need

- Follow Biome formatting -- PostToolUse hooks will catch violations
- Use kebab-case for all new files
- Export only named exports from barrel `index.ts`
- Colocate tests with source files
- Use conventional commit format for any git operations

## What Validators Should Flag

- Default exports
- Files not in kebab-case
- Nested biome.json files
- PascalCase or camelCase file names
- Test files in separate `__tests__/` directories instead of colocated
- Missing barrel export for new modules
- Inconsistent naming (mixing conventions within a module)
