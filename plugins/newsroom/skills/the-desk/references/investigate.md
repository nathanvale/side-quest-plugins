# Investigation Assignment

Loaded when the command is `/newsroom:investigate` or when $ARGUMENTS contains investigation-style input (topics to research). This file handles flag parsing, interactive parameter gathering, and assignment construction for investigation workflows.

## Flag Parsing

Parse `$ARGUMENTS` to extract:

- **TOPICS**: Parse from positional arguments (comma-split) OR from `--topic "..."` flags (repeatable). `--topic` takes precedence and allows topics containing commas.
- **DEPTH**: `--quick` (fast, fewer sources), default (balanced), `--deep` (comprehensive)
- **SOURCES**: `--reddit` (Reddit only), `--x` (X only), `--both` (force both). Default: auto
- **DAYS**: `--days N` where N is 1-365. Default: 30
- **REFRESH**: `--refresh` flag present? Boolean. Default: false
- **FORMAT**: `--format recommendations|news|prompting|general` overrides QUERY_TYPE for all topics. Default: auto-detect per topic
- **PLAIN**: `--plain` flag present? Boolean. Default: false
- **MODE**: `--mode recon|changes|sentiment|verify` Default: recon
  - `recon` -- Standard street reporting (default, no extra context needed)
  - `changes` -- Delta-focused stakeout (always adds `--refresh`, time-constrained queries)
  - `sentiment` -- Source network mode (CLI-heavy, `--sources=both`, community sentiment focus)
  - `verify "claim"` -- Tipster handler (search for/against evidence, confidence rating)
- **WIRE**: `--wire kitchen|garden|dojo` target room for handoff. Default: none
- **QUERY_TYPE** per topic:
  - RECOMMENDATIONS -- "best X", "top X", "recommended X" (user wants a LIST OF THINGS: products, tools, libraries). If "best" modifies a METHOD or APPROACH ("best way to...", "best practice for..."), classify as GENERAL instead.
  - NEWS -- "what's happening with X", "X news", "latest on X"
  - PROMPTING -- "X prompts", "prompting for X"
  - GENERAL -- everything else

Store parsed values: `TOPICS[]`, `DEPTH`, `QUERY_TYPES[]`, `SOURCES`, `DAYS`, `REFRESH`, `FORMAT`, `PLAIN`, `MODE`, `WIRE`

Flags that were explicitly passed are **locked** -- don't ask about them.

### Flag Validation

After parsing, check for conflicts:
- `--quick` + `--deep` together: error, ask user to pick one
- `--reddit` + `--x` together: treat as `--both`
- `--days 0` or `--days > 365`: error, ask user for 1-365
- `--format` with invalid type: error, list valid types
- `--mode` with invalid value: error, list valid modes
- `--wire` with invalid room: error -- "That room doesn't exist on the wire, Chief."
- Unknown flags: warn and ignore
- More than 5 topics: error -- "That's too many beats for one edition, Chief. Cap it at 5 or combine related topics."

### Source Flag Resolution

- `--reddit` alone: SOURCES="reddit"
- `--x` alone: SOURCES="x"
- `--reddit` + `--x` together: SOURCES="both"
- No source flag: SOURCES="auto"

## Interactive Assignment (via AskUserQuestion)

**ALWAYS use AskUserQuestion before dispatching.** No skip path. No exceptions. Do NOT call Task() until the user confirms.

Build questions ONLY for parameters not already set by flags. Use up to 4 questions per AskUserQuestion call (tool limit). If all parameters are set by flags, still ask the final confirmation question.

**Step 1: Topic** (if `$ARGUMENTS` has no topic)

Read [no-topic-responses.md](no-topic-responses.md) and randomly pick ONE Mickey variation. Use AskUserQuestion with header "Topic" -- single text input, let the user type their topic.

**Step 2: Assignment details** (ask only what's missing)

Combine unanswered parameters into one AskUserQuestion call. Skip any question where the flag was already provided.

| Parameter | Header | Question (Mickey voice) | Options |
|-----------|--------|------------------------|---------|
| DEPTH (no `--quick`/`--deep`) | "Depth" | "How deep we digging, Chief?" | "Quick -- in and out", "Standard (Recommended)", "Deep -- leave no stone unturned" |
| SOURCES (no `--reddit`/`--x`/`--both`) | "Sources" | "Where you want my boys looking?" | "Auto -- let me decide (Recommended)", "Reddit only", "X only", "Both -- hit everything" |
| MODE (no `--mode`) | "Mode" | "What kind of story we running?" | "Recon -- standard beat (Recommended)", "Changes -- what's new since last time", "Sentiment -- how the street feels", "Verify -- fact-check a claim" |

If PLAIN is true, use neutral question text: "Select research depth", "Select sources", "Select research mode".

**Step 3: Confirm and dispatch**

After all parameters are set (from flags + user answers), use one final AskUserQuestion with header "Assignment":

> "Alright Chief, here's the rundown."
>
> **Beat**: {TOPICS} | **Depth**: {DEPTH} | **Angle**: {QUERY_TYPE}{" (your call)" if --format used} | **Sources**: {SOURCES} | **Window**: {DAYS} days{" | **Mode**: {MODE} ({mode description})" if MODE != recon}
>
> "Send my boys out?"

Options:
- "Send it (Recommended)" -- dispatch reporters
- "Change the angle" -- go back and adjust

If the topic seems overly broad (e.g. "AI", "cloud computing", "programming"), add: "That's a mighty broad beat, Chief. '{topic}' could fill ten papers. You sure you don't want to narrow it down?"

If PLAIN, use neutral: "Proceed with these settings?" / "Go (Recommended)" / "Adjust"

Mode descriptions:
- `changes` -- "delta-focused, refreshing sources"
- `sentiment` -- "community sentiment deep-dive"
- `verify` -- "fact-checking: {claim}"

## Dispatch

### Mode-Specific Adjustments

If MODE is not `recon` (default), read [mode-playbook.md](mode-playbook.md) to translate the mode into assignment variations before dispatching.

### Morgue Check (conditional)

If para-obsidian MCP tools are available (check for `para_search` or `para_semantic_search`), read [the-morgue.md](the-morgue.md) and follow its instructions to check for recent research on the topic(s). If tools are not available, skip silently.

### Beat Reporter Dispatch

For each topic, dispatch ONE Beat Reporter. **NEVER split a topic across multiple reporters by platform.** The CLI handles Reddit + X in a single call -- one reporter per topic covers all platforms.

Read [query-strategies.md](query-strategies.md) to construct web search queries for the topic's QUERY_TYPE. Resolve year placeholders per the recency rule in query-strategies.md before constructing queries.

Then read [orchestration.md](orchestration.md) for dispatch patterns, depth scaling, and budget caps.

Dispatch with a structured JSON assignment:

```
Task({
  description: "Beat Reporter: [topic]",
  prompt: `Execute this assignment per your workflow. File your report with CLI data, web findings, and telemetry.

{
  "topic": "[topic]",
  "query_type": "RECOMMENDATIONS|NEWS|PROMPTING|GENERAL",
  "cli_flags": "[depth_flag] [sources_flag] [days_flag] [refresh_flag]",
  "web_queries": ["query 1", "query 2", ...],
  "webfetch_budget": N,
  "focus_fields": ["specific names", "star ratings", ...],
  "depth_instruction": "Quick scan|Balanced coverage|Comprehensive -- dig into review sites, forums, niche blogs"
}`,
  subagent_type: "newsroom:beat-reporter"
})
```

Only include CLI flags that were parsed from `$ARGUMENTS`. Omit flags that use defaults (e.g. no `--days` if DAYS=30, no sources flag if SOURCES=auto). Resolve `web_queries`, `webfetch_budget`, and `focus_fields` from [query-strategies.md](query-strategies.md) before dispatching.

### Collect Results

Wait for every reporter using TaskOutput with `block: true, timeout: 120000`.

For collection details, read [orchestration.md](orchestration.md).

## Synthesis

Read [output-investigate.md](output-investigate.md) for query-type-specific synthesis templates (RECOMMENDATIONS, NEWS, PROMPTING, GENERAL).

Read [output-base.md](output-base.md) for the generic wrapper (source links, stats footer, invitation framework).

**CRITICAL: Ground synthesis in ACTUAL research, not pre-trained knowledge.**

1. **Weight engagement-ranked data highest** -- CLI results have verified engagement signals (real upvotes, likes, comments)
2. **Weight web findings as supplementary** -- no engagement verification
3. **Cross-reference** -- patterns appearing in BOTH CLI + web results are strongest signals
4. **Deduplicate** -- same story across sources? Merge, keep highest engagement
5. **Extract top insights** -- 3-5 actionable findings per topic
6. **Preserve source links** -- collect all URLs from Beat Reporter "Source Links" sections

## Publish

Follow the display sequence from [output-base.md](output-base.md):
1. Synthesis (use query-type template from output-investigate.md)
2. Source links (terminal-friendly format from output-base.md -- no HTML tags)
3. Stats footer (investigation telemetry from output-investigate.md)
4. Invitation (investigation follow-up options from output-investigate.md, via AskUserQuestion)

## Wire (conditional)

If `WIRE` flag is present, read [wire-protocol.md](wire-protocol.md) and [the-wire.md](the-wire.md) to construct and send a validated wire message.

## Error Templates

**CLI not installed:**
> "Bad news, Chief -- my reporters can't find their press passes. The `@side-quest/word-on-the-street` CLI isn't installed."
> Fix: `bun add -g @side-quest/word-on-the-street` or `bunx --bun @side-quest/word-on-the-street --help` to verify.

**No API keys:**
> "My boys hit the street but the sources won't talk -- no API keys configured. We'll work the web desk instead."
> Fix: Create `~/.config/wots/.env` with `OPENAI_API_KEY=sk-...` and/or `XAI_API_KEY=xai-...`

**No results found:**
> "Struck out on all beats, Chief. The street's quiet on this one."
> Try: narrower topic, different time window (`--days 90`), or `--refresh` to bypass cache.

**Wire with no consumer:**
> "Wire filed to {room}, Chief. Fair warning -- that room isn't open yet. Message will sit on the wire until someone picks it up."
