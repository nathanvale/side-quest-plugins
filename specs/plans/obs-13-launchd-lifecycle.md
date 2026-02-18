# OBS-13: Launchd + Lifecycle Management

## Status: Planning

## Goal

Auto-start the observability server on login and provide proper lifecycle management so the server is always available without manual `just dev`.

## Context

v1 runs the server in foreground via `just dev` with `bun --watch`. This works for development but means the server isn't running when you open a new terminal or restart your machine. Launchd makes it a background service.

The plan explicitly states: "When the system proves its value over at least a week of `just dev` usage" before adding launchd.

## Depends on

- OBS-12 (Server Hardening) - readiness probe and diagnostics should be in place first

## Items

### Launchd Setup

| Item | Description | Source spec |
|------|-------------|-------------|
| Launchd plist | `com.sidequest.observability.plist` with `KeepAlive.SuccessfulExit = false`, `ThrottleInterval = 10`. Logs to `~/Library/Logs/side-quest-observability/`. | OBS-5 |
| newsyslog config | Prevent unbounded growth of stdout.log/stderr.log via log rotation. | OBS-5 |

### Justfile Recipes

| Recipe | Description | Source spec |
|--------|-------------|-------------|
| `just start` | Start the launchd service with polling health check (10 retries at 500ms intervals, fail with clear error). | OBS-5 |
| `just stop` | Stop the launchd service. | OBS-5 |
| `just restart` | Stop then start. | OBS-5 |
| `just install` | Install the launchd plist. | OBS-5 |
| `just uninstall` | Remove the launchd plist and stop the service. | OBS-5 |
| `just logs` | Tail the launchd stdout/stderr logs. | OBS-5 |

### Emitter Readiness Probe

| Item | Description | Source spec |
|------|-------------|-------------|
| Health check in emitter | Cache health check result per-process before posting events. Skip emit on probe failure. Prevents hooks from blocking when server is starting up. | OBS-5 |

## Verification

1. `just install && just start` - server starts and stays running
2. Kill the server process - launchd restarts it within 10s
3. Reboot machine - server auto-starts on login
4. `just logs` - shows server output with rotation
5. `just stop && just uninstall` - clean removal
6. Hook emitter gracefully degrades when server is starting (readiness probe)
