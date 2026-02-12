# chrome-devtools

Reliable browser automation via Chrome DevTools MCP. Wraps the flaky Chrome DevTools MCP connection in a skill-based interface with layered health checks (list_pages -> lsof -> curl -> process checks), snapshot-first element finding, auth detection, 1Password secret storage, and graceful degradation.

## Prerequisites

Chrome DevTools MCP must be configured at the user level (not in this plugin). The plugin assumes the MCP is already available and focuses on making it reliable.

## Commands

| Command | Description |
|---------|-------------|
| `/chrome-devtools:automate [workflow]` | Automate browser tasks -- screenshots, form filling, testing |
| `/chrome-devtools:screenshot <url>` | Take a screenshot of a URL (optional: `--full-page`, `--device`) |
| `/chrome-devtools:fix [--check]` | Diagnose and fix MCP connection issues |

## Skill

The `chrome-devtools` skill provides the core automation engine. It handles connection checks, workflow routing, auth detection, secret safety, and graceful degradation. Reference docs are loaded lazily based on the workflow type.

## Examples

See [examples.md](examples.md) for 10 ready-to-use prompts.

## Troubleshooting

Quick health check:

```
/chrome-devtools:fix --check
```

Full interactive troubleshooter (diagnose -> offer fixes -> execute -> re-verify):

```
/chrome-devtools:fix
```
