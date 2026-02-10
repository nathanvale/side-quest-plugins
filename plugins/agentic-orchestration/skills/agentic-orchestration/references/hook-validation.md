# Hook-Based Self-Validation

Hooks are deterministic enforcement. Prompts are probabilistic guidance. When quality matters, use hooks.

**Source hierarchy:** Official docs (code.claude.com/hooks) > runner plugins (side-quest) > hooks-mastery (IndyDevDan).
**Last verified:** 2026-02-11 against Claude Code hooks docs and hooks-guide docs.

---

## The Self-Validation Principle

| Approach | Enforcement | Consistency | Can Be Ignored? |
|----------|------------|-------------|-----------------|
| **Prompt instruction** | "Please run linting after edits" | ~70% compliance | Yes -- model may skip |
| **Hook (exit 0)** | Runs automatically, informational | 100% execution | No, but result is advisory |
| **Hook (exit 2)** | Runs automatically, blocks on failure | 100% execution + enforcement | No -- Claude must fix to proceed |

**Key insight:** Hooks convert quality aspirations into quality guarantees. A PostToolUse hook with exit code 2 on lint failure means Claude physically cannot proceed with broken code. No amount of "I'll fix that later" works.

## Hook Events for Validation

### PostToolUse -- Targeted Validation

Fires after every tool use. Use with matchers to target specific tools.

**Purpose:** Fast, targeted checks on individual file edits.
**Exit code 2:** Blocks Claude and feeds error back as context (Claude must fix the issue).
**Exit code 0:** Informational -- Claude sees the output but continues.
**Timeout:** 30-40 seconds (keep fast for per-edit checks).

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ./hooks/lint-check.ts",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Stop -- Comprehensive Validation

Fires when Claude is about to respond to the user (before the turn ends).

**Purpose:** Full-project validation before declaring work complete.
**Exit code 2:** Blocks the response, Claude must fix issues first.
**Exit code 0:** Informational -- Claude sees results in its next context.
**Timeout:** 60-120 seconds (comprehensive checks take longer).

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun run ./hooks/full-validation.ts",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

**Critical: The stop_hook_active guard.** Stop hooks can create infinite loops: hook fails -> Claude tries to fix -> Stop fires again -> hook fails again. Always check the `stop_hook_active` environment variable:

```typescript
// In your Stop hook script:
if (process.env.stop_hook_active === "true") {
  // Already in a Stop hook cycle -- exit cleanly to avoid infinite loop
  process.exit(0)
}
```

### PreToolUse -- Safety Gates

Fires before a tool executes. Use for blocking dangerous operations.

**Exit code 2:** Blocks the tool use entirely.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "./hooks/block-dangerous-commands.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

## TypeScript Runner Plugin Stack

Nathan's runner plugins provide a complete TypeScript validation pipeline. Each plugin installs its own hooks automatically when enabled.

### biome-runner

**PostToolUse** (matcher: `Write|Edit|MultiEdit`, timeout: 30s):
- Runs `biome check --write` on the edited file
- Auto-fixes formatting issues
- Reports unfixable lint errors to Claude
- Output: structured JSON for token efficiency

**Stop** (matcher: `*`, timeout: 60s):
- Runs `biome ci` on all changed files
- Exit code 2 blocks if unfixable errors remain
- Comprehensive check before turn completion

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{ "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/biome-check.ts", "timeout": 30 }]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [{ "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/biome-ci.ts", "timeout": 60 }]
      }
    ]
  }
}
```

### tsc-runner

**PostToolUse** (matcher: `Write|Edit|MultiEdit`, timeout: 30s):
- Runs `tsc --noEmit` on edited TypeScript files
- Filters by nearest tsconfig.json (monorepo-aware)
- Reports type errors to Claude

**Stop** (matcher: `*`, timeout: 120s):
- Runs full `tsc --noEmit` typecheck
- Exit code 2 blocks if type errors exist
- Longer timeout for full project check

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{ "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/tsc-check.ts", "timeout": 30 }]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [{ "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/tsc-ci.ts", "timeout": 120 }]
      }
    ]
  }
}
```

### bun-runner

**PostToolUse** (matcher: `*`, timeout: 40s):
- Runs `bun test` on edited test files
- Broader matcher because test files can be edited by any tool
- Reports test failures to Claude

**Stop** (matcher: `*`, timeout: 90s):
- Runs all changed tests
- Exit code 0 (informational) -- doesn't block, but Claude sees results
- Longer timeout for full test suite

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [{ "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/bun-test.ts", "timeout": 40 }]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [{ "command": "bun run ${CLAUDE_PLUGIN_ROOT}/hooks/bun-test-ci.ts", "timeout": 90 }]
      }
    ]
  }
}
```

## Python Validation Stack (Comparison)

The hooks-mastery approach for Python projects uses the same two-layer pattern:

| Layer | TypeScript Stack | Python Stack |
|-------|-----------------|--------------|
| **Lint + Format (PostToolUse)** | biome check --write | ruff check --fix + ruff format |
| **Type Check (PostToolUse)** | tsc --noEmit | ty check |
| **Tests (PostToolUse)** | bun test | pytest (targeted) |
| **Full Lint (Stop)** | biome ci | ruff check (full) |
| **Full Types (Stop)** | tsc --noEmit (full) | ty check (full) |
| **Full Tests (Stop)** | bun test (all changed) | pytest (all) |

**Same pattern, different tools.** The architecture is language-agnostic:
1. PostToolUse: fast, targeted, per-file checks (30-40s timeout)
2. Stop: comprehensive, full-project checks (60-120s timeout)
3. Structured output: JSON for token efficiency

## Hook Configuration in Agent Definitions

Hooks can be scoped to specific agents via frontmatter:

```yaml
---
name: builder
hooks:
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "bun run ./hooks/lint-check.ts"
  Stop:
    - hooks:
        - type: command
          command: "bun run ./hooks/full-validation.ts"
---
```

**Scoping matters:** Hooks in agent frontmatter only fire while that agent is active. When the agent completes, hooks are cleaned up. This means:
- Builder gets lint/typecheck hooks (it writes code)
- Validator does NOT get those hooks (it's read-only)
- Lead does NOT get those hooks (it only coordinates)

## Hook Configuration Locations

| Location | When It Runs | Use Case |
|----------|-------------|----------|
| `~/.claude/settings.json` | All sessions | Personal preferences |
| `.claude/settings.json` | This project | Project-specific validation |
| `.claude/settings.local.json` | This project (git-ignored) | Local overrides |
| Agent frontmatter `hooks:` | While agent is active | Agent-scoped validation |
| Plugin `hooks/hooks.json` | While plugin is enabled | Plugin-managed hooks |

## JSON Output for Token Efficiency

All three runner plugins output structured JSON, not raw CLI output. This matters for context window management:

**Bad** -- raw CLI output (verbose, wastes tokens):
```
src/auth.ts:15:3 - error TS2345: Argument of type 'string' is not
assignable to parameter of type 'number'.
  15 |   const result = doThing(name);
     |                         ~~~~
```

**Good** -- structured JSON (compact, actionable):
```json
{
  "status": "fail",
  "errors": [
    { "file": "src/auth.ts", "line": 15, "code": "TS2345", "message": "Argument of type 'string' is not assignable to parameter of type 'number'" }
  ],
  "summary": "1 type error in 1 file"
}
```

## Timeout Strategy

| Hook Event | Timeout | Rationale |
|-----------|---------|-----------|
| PreToolUse | 5s | Must be near-instant (blocks execution) |
| PostToolUse (lint/format) | 30s | Single file, fast tools |
| PostToolUse (typecheck) | 30s | Filtered by nearest tsconfig |
| PostToolUse (test) | 40s | May need to compile + run |
| Stop (lint CI) | 60s | All changed files |
| Stop (typecheck full) | 120s | Full project |
| Stop (test full) | 90s | Changed test files |

**Rule of thumb:** PostToolUse hooks should feel invisible (<30s). Stop hooks can take longer since they only fire at turn boundaries.

## Recipes

### Auto-Format on Every Edit

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs bunx biome check --write",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

**Gotcha:** Formatting on every edit adds context window noise. Consider using `async: true` so it doesn't block Claude's flow, or rely on the biome-runner plugin which handles this more efficiently.

### Block Commits Without Tests

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo \"$TOOL_INPUT\" | jq -r '.tool_input.command' | grep -q 'git commit' && echo 'Run tests first' >&2 && exit 2 || exit 0",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### Validate New Files Have Exports

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs grep -l 'export' || (echo 'New file has no exports' >&2 && exit 2)",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

## Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---------|---------------|-----|
| Stop hook without stop_hook_active check | Infinite loop: fail -> fix -> fail -> fix... | Check `process.env.stop_hook_active === "true"` |
| Raw CLI output | Wastes context tokens | Return structured JSON |
| PostToolUse timeout >60s | Blocks Claude on every edit | Keep <40s, use Stop for comprehensive checks |
| Async hooks trying to block | Async hooks cannot return exit code 2 | Use synchronous hooks for blocking |
| Same validation in PostToolUse AND Stop | Redundant work, doubles cost | PostToolUse: targeted. Stop: comprehensive. Don't overlap |
| Hooks in wrong settings file | Hook doesn't fire | Check location: user vs project vs local |

---

*Hook validation patterns drawn from IndyDevDan's ruff/ty validators and side-quest runner plugins (biome-runner, tsc-runner, bun-runner).*
