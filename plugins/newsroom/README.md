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

Two agent types -- `beat-reporter` and `fact-checker` -- are dispatched by the editor (supervisor). Beat reporters are dispatched N times in parallel (one per topic). The fact-checker runs after reporters file, verifying high-risk claims against primary sources.

| Role | Agent | Function |
|------|-------|----------|
| Mickey "The Desk" Malone | editor (skill) | Supervisor -- parses topic, dispatches reporters, synthesizes |
| Beat Reporter | beat-reporter (agent) | Covers one topic across all platforms, returns metrics + links |
| Fact Checker | fact-checker (agent) | Verifies claims against primary sources (Builder/Validator) |

Supervisor pattern: 1 editor dispatches N reporters. Expect 2-5x compute vs a single-agent search.

---

## Requirements

- `@side-quest/word-on-the-street` CLI (`wots`) -- required for Reddit and X data
- Firecrawl MCP -- optional; falls back to standard web search if not configured

---

## License

MIT
