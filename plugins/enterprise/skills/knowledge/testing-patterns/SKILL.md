---
name: testing-patterns
description: >
  Knowledge skill for testing patterns and best practices. Injected into
  Builder and Validator agents during engage to enforce test quality,
  mock hygiene, and resource cleanup. Not user-invocable.
user-invocable: false
---

# Knowledge: Testing Patterns

This knowledge skill provides context about testing standards and best practices. Injected into Builder (Scotty) and Validator (McCoy) agents during engage.

## Test Structure

### File Organization

- Tests colocated with source: `feature.test.ts` next to `feature.ts`
- Test runner: Bun test (compatible with Jest/Vitest API)
- Use `describe`/`it` blocks with descriptive names

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

describe('featureName', () => {
  describe('methodName', () => {
    it('should handle the happy path', () => {
      // arrange, act, assert
    });

    it('should throw when input is invalid', () => {
      expect(() => methodName(null)).toThrow('input is required');
    });
  });
});
```

### Naming Convention

- `describe` blocks: feature or method name
- `it` blocks: `should {expected behavior}` -- describe the outcome, not the implementation
- Avoid `test()` -- use `it()` for consistency

## Mock Hygiene

### Rule: Clean Up Every Mock

Every mock MUST be cleaned up in `afterEach`. Leaked mocks cause flaky tests.

```typescript
let mockRestore: () => void;

beforeEach(() => {
  const mock = mockStdio();
  mockRestore = mock.restore;
});

afterEach(() => {
  mockRestore();
});
```

### Rule: No Global Mock State

- Do NOT mock at module scope
- Do NOT use `jest.mock()` / `mock.module()` unless absolutely necessary
- Prefer dependency injection over module mocking
- If you must mock a module, restore it in `afterEach`

### Rule: Mock Only What You Own

- Mock your own modules, not third-party libraries
- For external APIs, use fixture data or test servers
- If testing integration, do not mock -- use real dependencies

## Resource Cleanup

### Rule: Always Clean Up Temp Files

```typescript
let cleanup: () => void;

beforeEach(() => {
  const tmp = createTempDir();
  cleanup = tmp.cleanup;
});

afterEach(() => {
  cleanup();
});
```

### Rule: Always Clean Up Processes

If a test spawns a process, kill it in `afterEach`:

```typescript
afterEach(() => {
  if (proc) proc.kill();
});
```

### Rule: Always Close Handles

Servers, file handles, database connections -- close in `afterEach`.

## Coverage Expectations

- New code should have tests
- Critical paths (error handling, edge cases) must be covered
- Do not test implementation details -- test behavior
- No snapshot tests unless the output format is a contract (e.g., CLI output)

## What Builders Need

- Write tests for every new function/module
- Use `describe`/`it` with descriptive names
- Clean up all resources in `afterEach`
- Prefer `createTempDir()` from core for file system tests
- Follow arrange/act/assert pattern

## What Validators Should Flag

- Missing tests for new code
- Missing `afterEach` cleanup for mocks, temp dirs, or processes
- Global mock state (mocks defined at module scope)
- Testing implementation details instead of behavior
- Using `test()` instead of `it()`
- Missing error case tests for functions that throw
- Snapshot tests for non-contract outputs
