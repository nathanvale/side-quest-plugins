# Investigation Assignment

Loaded when the command is `/newsroom:investigate` or when $ARGUMENTS contains investigation-style input (topics to research). This file handles flag parsing, interactive parameter gathering, and assignment construction for investigation workflows.

## Contents
- [Flag Parsing](#flag-parsing)
- [Interactive Assignment](#interactive-assignment-via-askuserquestion)
- [Dispatch](#dispatch)
- [Fact-Check Pass](#fact-check-pass-conditional)
- [Synthesis](#synthesis)
- [Publish](#publish)
- [Wire](#wire-conditional)
- [Error Templates](#error-templates)

## Reference Routing

| Phase | Reference | Read when |
|-------|-----------|-----------|
| Flag parsing | [no-topic-responses.md](no-topic-responses.md) | No topic in $ARGUMENTS |
| Dispatch | [mode-playbook.md](mode-playbook.md) | MODE != recon |
| Dispatch | [the-morgue.md](the-morgue.md) | para-obsidian MCP tools available |
| Dispatch | [query-strategies.md](query-strategies.md) | Always (construct web queries) |
| Dispatch | [dispatch-rules.md](dispatch-rules.md) | Always (depth scaling, budget caps) |
| Collect | [collection-rules.md](collection-rules.md) | Always (error handling, timeouts) |
| Synthesis | [output-investigate.md](output-investigate.md) | Always (query-type templates) |
| Synthesis | [output-base.md](output-base.md) | Always (source links, stats, invitation) |
| Wire | [wire-protocol.md](wire-protocol.md) + [the-wire.md](the-wire.md) | --wire flag present |

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
- **FACT_CHECK**: `--fact-check` flag present? Boolean. Default: false. Auto-enabled when ANY topic's QUERY_TYPE is NEWS or ANY topic contains "security", "CVE", "vulnerability", or "advisory"
- **WIRE**: `--wire kitchen|garden|dojo` target room for handoff. Default: none
- **QUERY_TYPE** per topic:
  - RECOMMENDATIONS -- "best X", "top X", "recommended X" (user wants a LIST OF THINGS: products, tools, libraries). If "best" modifies a METHOD or APPROACH ("best way to...", "best practice for..."), classify as GENERAL instead.
  - NEWS -- "what's happening with X", "X news", "latest on X"
  - PROMPTING -- "X prompts", "prompting for X"
  - GENERAL -- everything else

Store parsed values: `TOPICS[]`, `DEPTH`, `SOURCES`, `DAYS`, `REFRESH`, `FORMAT`, `PLAIN`, `MODE`, `WIRE`, `FACT_CHECK`

Compute `QUERY_TYPES[]` by applying the rules above to each topic (auto-detected from phrasing, overridden by `--format` if set).

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
> **Beat**: {TOPICS} | **Depth**: {DEPTH} | **Angle**: {QUERY_TYPE}{" (your call)" if --format used} | **Sources**: {SOURCES} | **Window**: {DAYS} days{" | **Mode**: {MODE} ({mode description})" if MODE != recon}{" | **Fact-check**: yes" if FACT_CHECK}
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

### Topic Normalizer

Before dispatching, normalize each topic to improve CLI search precision. The CLI's topic string drives Reddit/X search prompts, YouTube queries, and WebSearch instructions -- small phrasing changes have outsized impact.

**Rules (check query type first, then trim):**

1. **Check query-type exceptions FIRST** -- these override the filler removal in step 2:
   - RECOMMENDATIONS: preserve "best/top" if the user explicitly included them (e.g., "best React frameworks" stays)
   - PROMPTING: preserve "how to" if the user explicitly included it (e.g., "how to prompt Claude" stays)
   - NEWS: will append "release" or "announcement" in step 3
   - GENERAL: no exceptions
2. **Trim to 3-6 core tokens** -- remove filler words NOT protected by step 1: "latest", "new", "guide", "tips", "what's". Keep proper nouns and product/version identifiers.
3. **Preserve disambiguators** -- keep tokens like: v2, 2.1.49, 2026, security, release, CVE
4. **Apply query-type additions:**
   - NEWS: append "release" or "announcement" if not present (e.g., "Claude Code 2.1.49" -> "Claude Code 2.1.49 release")
5. **Shorten if > 8 tokens** -- keep: first 2 proper nouns, 1 version/date token, 1 intent token (release/security) if present

**Examples:**

| Raw Topic | Query Type | Normalized |
|---|---|---|
| "what's new in Claude Code 2.1.49" | NEWS | "Claude Code 2.1.49 release" |
| "best TypeScript frameworks 2026" | RECOMMENDATIONS | "best TypeScript frameworks 2026" |
| "tips for prompt engineering with Claude" | PROMPTING | "prompt engineering Claude" |
| "Rust memory safety discussion" | GENERAL | "Rust memory safety" |

Pass the **normalized** topic to the Beat Reporter in the assignment JSON. If you normalized it, keep the original in the assignment as `raw_topic` for transparency.

### Beat Reporter Dispatch

For each topic, dispatch ONE Beat Reporter. **NEVER split a topic across multiple reporters by platform.** The CLI handles Reddit + X + YouTube in a single call -- one reporter per topic covers all platforms.

Read [query-strategies.md](query-strategies.md) to construct augmentation queries for the topic's QUERY_TYPE. Resolve year placeholders per the recency rule in query-strategies.md before constructing queries. Note: the CLI now generates base web search instructions via `--include-web` -- Desk queries augment those, not replace them (see query-strategies.md "Augmentation Strategy").

Then read [dispatch-rules.md](dispatch-rules.md) for depth scaling and budget caps.

Dispatch with a structured JSON assignment:

```
Task({
  description: "Beat Reporter: [topic]",
  prompt: `Execute this assignment per your workflow. File your report with CLI data, web findings, and telemetry.

{
  "topic": "[normalized topic]",
  "raw_topic": "[original topic, only if normalized]",
  "query_type": "RECOMMENDATIONS|NEWS|PROMPTING|GENERAL",
  "cli_flags": "[depth_flag] [sources_flag] [days_flag] [refresh_flag]",
  "web_queries": ["augmentation query 1", "augmentation query 2", ...],
  "webfetch_budget": N,
  "focus_fields": ["specific names", "star ratings", ...],
  "depth_instruction": "Quick scan|Balanced coverage|Comprehensive -- dig into review sites, forums, niche blogs",
  "plain": false
}`,
  subagent_type: "newsroom:beat-reporter"
})
```

**CLI flags are always included:** `--include-web` and `--include-youtube` are part of the beat reporter's standard invocation (see beat-reporter.md Phase 1). Do NOT add them to `cli_flags` -- they are implicit. Only include user-requested flags in `cli_flags`: depth (`--quick`/`--deep`), sources (`--sources=...`), `--days=N`, `--refresh`.

**Web queries are augmentation, not replacement.** The CLI's `web_search_instructions` provide the base web plan. The `web_queries` array contains Desk-constructed queries that add depth for specific query types (RECOMMENDATIONS, PROMPTING, NEWS). For GENERAL, the `web_queries` array may be empty -- the CLI's base plan is sufficient. Resolve `web_queries`, `webfetch_budget`, and `focus_fields` from [query-strategies.md](query-strategies.md) before dispatching.

### Collect Results

Collect all reporter results using TaskOutput with `block: true, timeout: 120000`. Read [collection-rules.md](collection-rules.md) for error handling.

### Fact-Check Pass (conditional)

**Trigger:** Runs when `FACT_CHECK` is true (explicitly via `--fact-check` OR auto-enabled for NEWS query type / topics containing "security", "CVE", "vulnerability", "advisory"). Skip entirely when not triggered.

**Architecture:** Builder/Validator pattern. Beat reporters are Builders (retrieve data). The Fact Checker agent is the Validator (independently verifies claims against primary sources). Mickey orchestrates both -- he never does web research himself.

After collecting all reporter results, scan for high-risk claims:

**What counts as high-risk:**
- CVEs and security advisories (version-specific vulnerability claims)
- Release announcements (version numbers, dates, feature claims)
- Pricing or benchmark performance claims (numbers that could be wrong)
- "Official" statements attributed to companies or maintainers
- Claims with high engagement but no primary source link

**How many to extract:**

| Context | Claims to verify |
|---------|-----------------|
| Default (`--fact-check`) | Top 3 across all sources |
| NEWS query type | Top 5 across all sources |
| Security-related topic | Top 5, prioritize CVEs |

**Dispatch the Fact Checker:**

Extract claims from reporter results, then dispatch a single `fact-checker` agent:

```
Task({
  description: "Fact Checker: [topic(s)]",
  prompt: `Verify these claims against primary sources per your workflow.

{
  "claims": [
    {
      "id": 1,
      "assertion": "[specific factual claim from reporter data]",
      "source": "[reporter attribution]",
      "category": "release|security|pricing|quote|benchmark"
    }
  ],
  "topic": "[research topic for context]",
  "max_fetches": <claims count * 2>
}`,
  subagent_type: "newsroom:fact-checker"
})
```

Collect results using TaskOutput with `block: true, timeout: 120000`.

The Fact Checker returns a structured report with verdicts (verified/unverified/contradicted) and primary source URLs. Parse this into the Verification section during synthesis.

**Error handling:**
- Fact Checker times out or fails: note "verification unavailable" in telemetry, continue with synthesis
- No high-risk claims identified in reporter data: skip this phase, note "no high-risk claims identified" in telemetry

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
