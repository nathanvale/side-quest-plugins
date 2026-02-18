# OBS-15: Git Plugin Migration

## Status: Planning

## Goal

Remove the duplicated event system from `@side-quest/git` and repoint it to `@side-quest/observability` as the canonical event infrastructure.

## Context

The observability server was extracted from `@side-quest/git/src/events/`. The original files still exist in side-quest-git. Once `@side-quest/observability-server` is published to npm (OBS-7), the git package can depend on it instead of maintaining its own copy.

## Depends on

- OBS-7 (Publishing) - `@side-quest/observability-server` must be published to npm first

## Items

### side-quest-git Changes

| Item | Description |
|------|-------------|
| Remove `src/events/` directory | Delete all 7 event files (types.ts, schema.ts, store.ts, server.ts, client.ts, emit.ts, cache-key.ts) and their tests |
| Add `@side-quest/observability-server` dependency | `bun add @side-quest/observability-server` |
| Update `worktree/cli.ts` imports | Change `from '../events/...'` to `from '@side-quest/observability-server'` |
| Update cache path | Change `side-quest-git` to `side-quest-observability` in cache directory references |

### side-quest-plugins Changes

| Item | Description |
|------|-------------|
| Update `plugins/git/hooks/event-bus-client.ts` | Repoint to `@side-quest/observability-server` imports and new cache path |

## Verification

1. `cd ~/code/side-quest-git && bun test` - all tests pass with new imports
2. `bun run typecheck` - no type errors
3. Git worktree events still flow to the observability server
4. `plugins/git/hooks/event-bus-client.ts` posts events successfully
5. No remaining references to `src/events/` in the git codebase
