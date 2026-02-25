# Newsroom

A multi-agent research orchestrator for Claude Code, themed around 1920s investigative journalism. Mickey "The Desk" Malone receives your topic and dispatches beat reporters in parallel across Reddit, X, and the web. Reports come back with engagement metrics, source links, and a synthesized briefing.

---

## Install

```
/plugin install newsroom@side-quest
```

---

## Usage

```
/newsroom:investigate "React 19 adoption" --quick --reddit
/newsroom:investigate "Bun vs Node" --deep --mode sentiment
/newsroom:stakeout "Claude Code plugins"
```

---

## Research Modes

| Mode | Description |
|------|-------------|
| `recon` | Default. Broad coverage across all sources |
| `changes` | Delta-focused -- what changed recently |
| `sentiment` | Community feeling and opinion trends |
| `verify` | Evidence search for a specific claim |

Pass via `--mode <name>`. Default is `recon`.

---

## Architecture

One agent type -- `beat-reporter` -- is dispatched N times in parallel by the editor (supervisor). Each reporter covers one source: Reddit, X, or the web. Mickey collects and synthesizes all filed reports.

| Role | Agent | Function |
|------|-------|----------|
| Mickey "The Desk" Malone | editor (skill) | Supervisor -- parses topic, dispatches reporters, synthesizes |
| Beat Reporter | beat-reporter (agent) | Covers one source, returns metrics + links |

Supervisor pattern: 1 editor dispatches N reporters. Expect 2-5x compute vs a single-agent search.

---

## Requirements

- `@side-quest/word-on-the-street` CLI (`wots`) -- required for Reddit and X data
- Firecrawl MCP -- optional; falls back to standard web search if not configured

---

## License

MIT
