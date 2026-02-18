# OBS-12: Server Hardening

## Status: Planning

## Goal

Operational improvements to the event server - reliability, diagnostics, and performance features that don't depend on new hook events.

## Context

The server works well for v1 usage. These items improve robustness for longer-running deployments, add diagnostic tooling, and clean up edge cases identified during v1 development.

## Depends on

Nothing - these are independent server improvements.

## Items

### Diagnostics & Monitoring

| Item | Description | Source spec |
|------|-------------|-------------|
| `/metrics` endpoint | Aggregate metrics from JSONL logs, expose via `GET /metrics`. Dashboard consumes this for PulseChart sparkline. | OBS-1 |
| `doctor` diagnostics command | CLI command that checks server health, port file state, cache directory integrity, disk usage. | OBS-1 |

### Cache & Storage

| Item | Description | Source spec |
|------|-------------|-------------|
| Cache directory GC | Opportunistic cleanup of stale `cacheKey` directories on server startup. Scan `~/.cache/side-quest-observability/`, remove dirs with no activity (no file modifications) in 30+ days, log what was cleaned. | OBS-1 |
| Per-app JSONL subdirectories | Dashboard needs per-project event history. Store events in `~/.cache/side-quest-observability/events/{appRoot-hash}/events.jsonl` instead of a single file. | OBS-1 |

### Concurrency & Resilience

| Item | Description | Source spec |
|------|-------------|-------------|
| `withFileLock` on `push()` | Only add if a real concurrency bug is demonstrated. Would make `push()` async and require all callers to `await`. | OBS-1 PR3 |
| `loadFromDisk()` via `Bun.JSONL.parse` | Only add if a restart-replay use case materializes (e.g., dashboard needs historical events after server restart). Uses `Bun.JSONL.parse()` (native, Bun v1.3.7+). | OBS-1 PR3 |
| `withTimeout` wrapper on emitter | Nice-to-have. AbortController works fine for now. | OBS-1 |

### Hook Reliability

| Item | Description | Source spec |
|------|-------------|-------------|
| Cross-invocation negative cache | Server-down sessions waste ~16-33s on failed port file checks. Add sentinel file with 60s TTL so subsequent hooks in the same session skip the check. | OBS-2 |
| Nonce file in port file | Stale port file after server crash. Server writes nonce to port file, hook validates nonce matches before connecting. | OBS-2 |
| Per-hook timing telemetry | `SIDE_QUEST_HOOK_DEBUG=1` emits `stdin_ms`, `port_ms`, `fetch_ms`, `total_ms` to stderr. | OBS-2 |
| appRoot canonicalization | `appRoot` is raw `cwd`, not canonicalized. Dashboard normalizes by detecting common prefixes or using session_id grouping. Server-side canonicalization would be cleaner. | OBS-2 |

### Plugin Fallback

| Item | Description | Source spec |
|------|-------------|-------------|
| settings.json injection fallback | If plugin hook execution verification fails, provide a setup command that injects hooks directly into `~/.claude/settings.json`. Uses absolute paths instead of `${CLAUDE_PLUGIN_ROOT}`. | OBS-3 |

## Verification

1. `/metrics` returns valid JSON with event counts, rates, and error stats
2. `doctor` command reports green/red status for each subsystem
3. Cache GC removes stale directories older than 30 days
4. Per-app JSONL writes to correct subdirectories
5. Negative cache prevents repeated port file checks when server is down
6. `SIDE_QUEST_HOOK_DEBUG=1` outputs timing breakdown to stderr
