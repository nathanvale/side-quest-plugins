# Plan: OBS-2 Hook CLI Entry Point

## Task Description

Create the CLI entry point for the observability server. After the v3 "dumb hook, smart server" restructuring, OBS-2 is the thinnest domain -- a single file (`cli/index.ts`, ~15 lines) that starts the server. This ships as part of the OBS-1 repo.

## Objective

A working CLI command `observability server` that starts the event server with all enrichment, WebSocket, and persistence capabilities from OBS-1.

## Problem Statement

The `@side-quest/observability` package needs an executable entry point so the server can be started from the command line (used by the justfile in OBS-5 and potentially launchd in v1.1).

## Solution Approach

A minimal CLI with a single `server` subcommand. No `hook` subcommand (hooks are self-contained scripts in OBS-3). The CLI is ~15 lines that parse argv and call `startServer()`.

## Relevant Files

Use these files to complete the task:

- `specs/plans/obs-2-hook-cli.md` -- full detailed plan (source of truth), section 4
- `packages/server/src/server.ts` (OBS-1) -- the `startServer()` function to call
- `packages/server/package.json` -- needs `bin` entry

### New Files

```
packages/server/src/cli/
  index.ts    -- CLI entry point (~15 lines)
```

## Implementation Phases

### Phase 1: Foundation

This is a single-phase task -- create one file and update package.json.

### Phase 2: Core Implementation

1. Create `packages/server/src/cli/index.ts`:

```typescript
import { startServer } from '../server.js'

async function main(): Promise<void> {
  const command = process.argv[2]

  if (command === 'server') {
    await startServer()
  } else {
    process.stderr.write('Usage: observability server\n')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

2. Add bin entry to `packages/server/package.json`:

```json
{
  "bin": {
    "observability": "./src/cli/index.ts"
  }
}
```

### Phase 3: Integration & Polish

No separate polish phase -- this is a trivial task integrated into OBS-1's extraction.

## Team Orchestration

- You operate as the team lead and orchestrate the team to execute the plan.
- IMPORTANT: You NEVER operate directly on the codebase. Use Task and Task* tools only.
- Take note of the session id (agentId) of each team member for resume operations.

### Model Selection Guide

| Role | Model | Rationale |
|------|-------|-----------|
| All builders | sonnet | Executes well-specified tasks reliably |
| All validators | haiku | Mechanical checks: read files, run commands, report PASS/FAIL |

### Team Members

- Builder
  - Name: builder-cli
  - Role: Create CLI entry point and wire to server
  - Agent Type: enterprise:builder-scotty
  - Model: sonnet
  - Resume: true

- Validator
  - Name: validator-cli
  - Role: Verify CLI starts server correctly
  - Agent Type: enterprise:validator-mccoy
  - Model: haiku
  - Resume: true

## Step by Step Tasks

- Execute every step in order, top to bottom.
- Before starting, run TaskCreate for each task so all team members can see the full plan.

### 1. Create CLI Entry Point
- **Task ID**: create-cli
- **Depends On**: none (assumes OBS-1 server.ts exists)
- **Assigned To**: builder-cli
- **Agent Type**: enterprise:builder-scotty
- **Model**: sonnet
- **Parallel**: false
- Read `specs/plans/obs-2-hook-cli.md` section 4
- Create `packages/server/src/cli/index.ts` (~15 lines)
- Add `"bin": { "observability": "./src/cli/index.ts" }` to packages/server/package.json
- Verify: `bun run packages/server/src/cli/index.ts server` starts the server

### 2. Validate CLI
- **Task ID**: validate-cli
- **Depends On**: create-cli
- **Assigned To**: validator-cli
- **Agent Type**: enterprise:validator-mccoy
- **Model**: haiku
- **Parallel**: false
- `bun run packages/server/src/cli/index.ts server` -- server starts, ctrl+c to stop
- `bun run packages/server/src/cli/index.ts` -- prints usage to stderr, exits 1
- `bun run packages/server/src/cli/index.ts nonsense` -- prints usage to stderr, exits 1
- `bun run typecheck` -- cli/index.ts has no type errors

## Acceptance Criteria

1. `packages/server/src/cli/index.ts` exists and is ~15 lines
2. Running `bun run packages/server/src/cli/index.ts server` starts the event server
3. Running without args or with unknown args prints usage and exits 1
4. `bin` entry in package.json points to the CLI
5. TypeScript compiles cleanly

## Validation Commands

- `bun run packages/server/src/cli/index.ts server` -- starts server
- `bun run typecheck` -- no type errors

## Notes

- This is the thinnest domain in the entire plan. ~30 minutes of work.
- No `hook` subcommand -- hooks are self-contained scripts in OBS-3.
- The `startServer()` function must be exported from server.ts (OBS-1 responsibility).
- This task is typically folded into OBS-1's implementation as step 4 in the coordinator.
