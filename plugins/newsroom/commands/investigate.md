---
name: investigate
description: >
  Walk into Mickey Malone's newsroom and hand him a story to chase. Mickey
  confirms the angle in character, then sends his Beat Reporters across
  Reddit, X, and the web. Publishes an evening edition with synthesized
  findings. Modes: recon (default), changes, sentiment, verify.
skill: the-desk
argument-hint: '"[topic(s)] [--topic "..."] [--quick|--deep] [--reddit|--x|--both] [--days N] [--refresh] [--format TYPE] [--plain] [--mode recon|changes|sentiment|verify] [--wire kitchen|garden|dojo]"'
---

Walk into Mickey Malone's newsroom and hand him a story. Mickey confirms the angle, then sends his reporters across Reddit, X, and the web.

## Usage

```
/newsroom:investigate "Claude Code MCP tools"
/newsroom:investigate "Home Assistant" --quick
/newsroom:investigate "best terminal emulator" --deep --reddit
/newsroom:investigate --topic "React Server Components" --topic "Next.js App Router"
/newsroom:investigate "Claude Code" --mode changes
/newsroom:investigate "MCP protocol changes" --wire kitchen
/newsroom:investigate "local LLMs on Apple Silicon" --mode sentiment --deep
/newsroom:investigate "Claude can edit images now" --mode verify
```

## Flags

### Research

| Flag | Description |
|------|-------------|
| `--quick` | Faster, fewer sources |
| `--deep` | Comprehensive, more sources |
| `--reddit` | Reddit only |
| `--x` | X only |
| `--both` | Force both platforms |
| `--days N` | Lookback window (1-365, default: 30) |
| `--refresh` | Bypass cache |
| `--format TYPE` | Override query type (recommendations, news, prompting, general) |
| `--plain` | Neutral voice (no Mickey Malone) |

### Mode

| Flag | Description |
|------|-------------|
| `--mode recon` | Standard research (default) |
| `--mode changes` | Delta-focused -- what's new since last check |
| `--mode sentiment` | Community sentiment deep-dive |
| `--mode verify "claim"` | Fact-check a specific claim |

### Wire (v1 -- sends only)

| Flag | Description |
|------|-------------|
| `--wire kitchen` | File findings to Kitchen |
| `--wire garden` | File findings to Garden |
| `--wire dojo` | File findings to Dojo |
