# OBS-7: Publish @side-quest/observability-server to npm

## Status: Implemented

## Goal

Make the observability server installable from npm so users can run:

```bash
bunx @side-quest/observability-server server
```

This gives them the event server + embedded Vue dashboard with zero repo cloning.

## Problem

1. `packages/server/package.json` had `"private": true`
2. `bin` pointed to source (`.ts`) not built output (`.js`)
3. No `publishConfig` for npm
4. Dashboard assets lived in a sibling package - not available when installed via npm
5. `.changeset/config.json` had `"access": "restricted"`

## Changes

### packages/server/package.json

- Removed `"private": true`
- Fixed `bin` to point to built output: `"observability": "./dist/cli/index.js"`
- Added `publishConfig: { "access": "public", "provenance": true }`
- Updated `files` to `["dist/**", "README.md", "LICENSE", "CHANGELOG.md"]`
- Added `exports["./cli"]` and `exports["./package.json"]` entries
- Added `postbuild` script: `"bun scripts/copy-client-assets.ts"`

### packages/server/bunup.config.ts

Converted to array config with two builds:
- **Library:** `./src/index.ts` -> `dist/index.js` (with types, clean)
- **CLI:** `./src/cli/index.ts` -> `dist/cli/index.js` (shebang banner, no types, no clean)

### packages/server/src/server.ts

Replaced hardcoded `clientDistDir` path with `resolveClientDistDir()` that checks three candidates:
1. `../../client/dist` (dev: running from source in monorepo)
2. `public` (npm: running from `dist/index.js`)
3. `../public` (npm: running from `dist/cli/index.js`)

Falls back gracefully (API routes work, dashboard returns 404).

### packages/server/scripts/copy-client-assets.ts (new)

Postbuild script that copies `packages/client/dist/` into `packages/server/dist/public/`. This embeds the dashboard inside the published npm package.

### package.json (root)

Changed build from parallel filter to explicit sequencing:
```json
"build": "bun run --cwd packages/client build && bun run --cwd packages/server build"
```

Client must build first so the postbuild copy has assets to copy.

### .changeset/config.json

Changed `"access": "restricted"` to `"access": "public"`.

## What stays unchanged

- `packages/client/` - remains private, just a build input
- All server source modules (voice, store, emit, schema, etc.)
- CLI source (`src/cli/index.ts`) - already correct
- Test suite - no changes needed
- Dev workflow (`just dev`, `bun run --watch`) - continues to work

## Published package structure

```text
dist/
  index.js          # library bundle
  index.d.ts        # types
  cli/
    index.js        # CLI entry (#!/usr/bin/env bun)
  public/
    index.html      # Vue dashboard
    assets/
      index-*.js
      index-*.css
README.md
LICENSE
CHANGELOG.md
```

## Verification

1. `bun run build` - builds client then server, copies assets
2. `ls packages/server/dist/public/index.html` - confirms asset copy worked
3. `bun test --recursive` - all tests still pass
4. `bun run packages/server/dist/cli/index.js server &` - starts from built output
5. `curl http://127.0.0.1:7483/health` - server responds
6. `curl http://127.0.0.1:7483/` - dashboard HTML served from dist/public/
7. `bun pm pack --cwd packages/server` - dry run package, inspect contents
