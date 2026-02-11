---
name: last-30-days
description: >
  Research any topic from the last 30 days across Reddit, X, and the web.
  Supports single topics with deep prompt-writing follow-up, or multiple
  topics (separated by AND) with parallel agents and cross-topic synthesis.
  Use when users ask about recent trends, community opinions, recommendations,
  or current discussions on any topic.
argument-hint: '"topic" or "topic 1" AND "topic 2" [--quick|--deep]'
allowed-tools: Bash(bunx *), Read, Glob, Grep, Task, AskUserQuestion, WebSearch, WebFetch
---

# last-30-days: Research Any Topic from the Last 30 Days

Research ANY topic across Reddit, X, and the web. Surface what people are actually discussing, recommending, and debating right now.

Supports two modes:
- **Single topic**: Deep research with prompt-writing follow-up
- **Multi-topic**: Parallel background agents with cross-topic synthesis

## Usage

```
/last-30-days [topic]
/last-30-days [topic] for [tool]
/last-30-days [topic] --quick
/last-30-days [topic] --deep
/last-30-days "topic 1" AND "topic 2"
/last-30-days "topic 1" AND "topic 2" AND "topic 3" --quick
```

**Examples:**
- `/last-30-days best Claude Code skills` - recommendations
- `/last-30-days photorealistic people in Nano Banana Pro` - prompting research
- `/last-30-days what's happening with OpenAI` - news
- `/last-30-days "Claude Code" AND "Cursor" AND "GitHub Copilot" --quick` - multi-topic comparison

---

## Proactive Invocation

This skill can be invoked proactively when the user asks about recent community discussions, trends, or opinions. No need to ask permission -- just launch the research. The user can always cancel/interrupt if they didn't want research.

---

## Step 1: Parse Arguments

Parse `$ARGUMENTS` to extract topics, flags, and mode.

### Flag extraction (do this FIRST)

Extract and strip flags from the FULL `$ARGUMENTS` string BEFORE splitting on AND:

1. Scan for `--quick` or `--deep` anywhere in the string
2. Store matched flag as `FLAGS` string (e.g., `--quick` or `--deep` or empty)
3. Remove all `--quick` and `--deep` occurrences from the arguments string

This prevents flags from being appended to the last topic.

### Mode detection

After stripping flags, check if the remaining string contains ` AND ` (case-insensitive):
- **Contains AND** -> MULTI-TOPIC mode (Step 2M)
- **No AND** -> SINGLE-TOPIC mode (Step 2S)

### Topic parsing (after flags are stripped)

**For MULTI-TOPIC mode:**
1. Split the flag-stripped string on ` AND ` (case-insensitive regex: `\s+[Aa][Nn][Dd]\s+`)
2. For each segment: strip whitespace, strip surrounding quotes, skip if empty
3. Store as `TOPICS[]` array
4. **Max 5 topics** - if more, use AskUserQuestion to confirm or trim

**For SINGLE-TOPIC mode:**
1. The entire flag-stripped string is the topic
2. Parse for TARGET TOOL: `[topic] for [tool]` pattern
3. Parse QUERY TYPE:
   - **PROMPTING** - "X prompts", "prompting for X", "X best practices"
   - **RECOMMENDATIONS** - "best X", "top X", "what X should I use"
   - **NEWS** - "what's happening with X", "X news", "latest on X"
   - **GENERAL** - anything else

Store: `TOPIC`, `TARGET_TOOL` (or "unknown"), `QUERY_TYPE`

### Validation

**No arguments provided:** Show usage help and stop.

```
Usage: /last-30-days [topic] [--quick|--deep]
       /last-30-days "topic 1" AND "topic 2" [--quick|--deep]

Research any topic from the last 30 days across Reddit, X, and the web.

Single topic examples:
  /last-30-days best Claude Code skills
  /last-30-days photorealistic people for Midjourney --deep

Multi-topic examples:
  /last-30-days "Claude Code" AND "Cursor"
  /last-30-days "React" AND "Vue" AND "Svelte" --quick
```

---

## Step 2S: Single-Topic Research

For single-topic mode, run research directly in the orchestrator (no sub-agents needed).

### CLI Research

Run the CLI tool:

```bash
bunx --bun @side-quest/last-30-days "$TOPIC" --emit=compact $FLAGS 2>&1
```

Capture the ENTIRE output -- this contains Reddit threads, X posts, and engagement metrics.

### Check the output mode

The CLI output will indicate the mode:
- **"Mode: both"** or **"Mode: reddit-only"** or **"Mode: x-only"**: CLI found results, WebSearch is supplementary
- **"Mode: web-only"**: No API keys, Claude must do ALL research via WebSearch

### Supplement with WebSearch

For **ALL modes**, do WebSearch to supplement (or provide all data in web-only mode).

Choose search queries based on QUERY_TYPE:

**If RECOMMENDATIONS** ("best X", "top X", "what X should I use"):
- Search for: `best {TOPIC} recommendations`
- Search for: `{TOPIC} list examples`
- Search for: `most popular {TOPIC}`
- Goal: Find SPECIFIC NAMES of things, not generic advice

**If NEWS** ("what's happening with X", "X news"):
- Search for: `{TOPIC} news 2026`
- Search for: `{TOPIC} announcement update`
- Goal: Find current events and recent developments

**If PROMPTING** ("X prompts", "prompting for X"):
- Search for: `{TOPIC} prompts examples 2026`
- Search for: `{TOPIC} techniques tips`
- Goal: Find prompting techniques and examples

**If GENERAL** (default):
- Search for: `{TOPIC} 2026`
- Search for: `{TOPIC} discussion`
- Goal: Find what people are actually saying

For ALL query types:
- **USE THE USER'S EXACT TERMINOLOGY** - don't substitute based on your knowledge
- EXCLUDE reddit.com, x.com, twitter.com (covered by CLI)
- **DO NOT output "Sources:" list** - stats come at the end

### Synthesize

**CRITICAL: Ground synthesis in ACTUAL research content, not pre-existing knowledge.**

Weight Reddit/X sources HIGHER (engagement signals). Identify patterns across all sources. Note contradictions. Extract top 3-5 actionable insights.

**If RECOMMENDATIONS**: Extract SPECIFIC NAMES, count mentions, list by popularity.

**If PROMPTING**: Identify the PROMPT FORMAT the research recommends (JSON, structured, natural language, keywords).

### Display Results

**FIRST - What I learned (based on QUERY_TYPE):**

**If RECOMMENDATIONS:**
```
Most mentioned:
1. [Specific name] - mentioned {n}x (r/sub, @handle, blog.com)
2. [Specific name] - mentioned {n}x (sources)
...
Notable mentions: [other specific things with 1-2 mentions]
```

**If PROMPTING/NEWS/GENERAL:**
```
What I learned:

[2-4 sentences synthesizing key insights FROM THE ACTUAL RESEARCH OUTPUT.]

KEY PATTERNS I'll use:
1. [Pattern from research]
2. [Pattern from research]
3. [Pattern from research]
```

**THEN - Stats:**

For **full/partial mode**:
```
---
All agents reported back!
- Reddit: {n} threads | {sum} upvotes | {sum} comments
- X: {n} posts | {sum} likes | {sum} reposts
- Web: {n} pages | {domains}
- Top voices: r/{sub1}, r/{sub2} | @{handle1}, @{handle2} | {web_author} on {site}
```

For **web-only mode**:
```
---
Research complete!
- Web: {n} pages | {domains}
- Top sources: {author1} on {site1}, {author2} on {site2}

Want engagement metrics? Add API keys to ~/.config/research/.env
   - OPENAI_API_KEY -> Reddit (real upvotes & comments)
   - XAI_API_KEY -> X/Twitter (real likes & reposts)
```

**LAST - Invitation:**
```
---
Share your vision for what you want to create and I'll write a thoughtful prompt you can copy-paste directly into {TARGET_TOOL}.
```

**IF TARGET_TOOL is unknown**, ask NOW (not before research).

**IMPORTANT**: After displaying results, WAIT for the user to respond. Don't dump generic prompts.

### Prompt Writing (after user shares vision)

When the user responds with what they want to create, write a **single, highly-tailored prompt**.

**CRITICAL: Match the FORMAT the research recommends:**
- Research says "JSON prompts" -> write AS JSON
- Research says "structured parameters" -> use key: value format
- Research says "natural language" -> use conversational prose

```
Here's your prompt for {TARGET_TOOL}:

---

[The actual prompt IN THE FORMAT THE RESEARCH RECOMMENDS]

---

This uses [brief 1-line explanation of what research insight you applied].
```

After delivering a prompt, offer to write more:

> Want another prompt? Just tell me what you're creating next.

---

## Step 2M: Multi-Topic Research

For multi-topic mode, launch parallel background agents.

### Launch Research Agents

Launch one Task agent per topic using `subagent_type: "general-purpose"`.

**Strategy:** Launch ALL agents as background agents in a single message for true parallel execution. Each agent runs the CLI tool and WebSearch independently.

Tell the user research is starting:

```
Researching {N} topics in parallel ({N} agents)...
Topics: {comma-separated list of topics in quotes}
Depth: {FLAGS or "default"}
```

For each topic in `TOPICS[]`, launch a Task agent with this prompt (substitute `{TOPIC}`, `{FLAGS}`):

```
You are a focused research agent. Research the topic "{TOPIC}" from the last 30 days.

## Step 1: Run the CLI research tool

Run this command and capture its full output:

```bash
bunx --bun @side-quest/last-30-days "{TOPIC}" --emit=compact {FLAGS} 2>&1
```

Capture the ENTIRE output -- this contains Reddit threads, X posts, and engagement metrics.

## Step 2: Supplement with WebSearch

Run 2-3 WebSearch queries to supplement the CLI data:

1. `{TOPIC} 2026` -- recent discussions and news
2. `{TOPIC} discussion recommendations` -- community opinions
3. `{TOPIC} comparison review` -- if the topic involves a tool/product

Exclude reddit.com, x.com, twitter.com (already covered by CLI).

## Step 3: Return structured output

Return your findings in EXACTLY this format (do not deviate):

---BEGIN RESEARCH REPORT---
## TOPIC: {TOPIC}

## CLI_OUTPUT_SUMMARY:
[Summarize the key findings from the CLI output in 3-5 bullet points.
Include specific numbers: thread counts, upvote counts, post counts, like counts.]

## CLI_RAW_STATS:
- Mode: [both|reddit-only|x-only|web-only]
- Reddit threads: [N]
- Reddit total upvotes: [N]
- Reddit total comments: [N]
- X posts: [N]
- X total likes: [N]
- X total reposts: [N]

## WEB_SUPPLEMENT:
[Summarize the key findings from WebSearch in 3-5 bullet points.
Include source domains and author names where available.]
- Web pages found: [N]
- Key domains: [comma-separated list]

## TOP_VOICES:
[List the most authoritative/cited voices across all sources]
- Subreddits: [r/sub1, r/sub2]
- X handles: [@handle1, @handle2]
- Web authors: [name1 on domain1, name2 on domain2]

## KEY_FINDINGS:
1. [Most important finding with evidence]
2. [Second finding with evidence]
3. [Third finding with evidence]
4. [Fourth finding if notable]
5. [Fifth finding if notable]

## SENTIMENT:
[Overall community sentiment: positive/negative/mixed/neutral]
[1-2 sentences explaining why]

## NOTABLE_QUOTES:
- "[Exact quote from a highly-upvoted Reddit comment or viral X post]" -- source
- "[Another notable quote]" -- source
---END RESEARCH REPORT---

IMPORTANT: Always return the structured report above. Do not skip sections.
If a section has no data (e.g., no X posts found), write "None found" rather than omitting.
```

Launch all Task agents in a SINGLE message with `run_in_background: true`:

- `subagent_type: "general-purpose"`
- `model: "haiku"` (these agents run a CLI command, do 2-3 WebSearches, and fill a structured template -- Haiku is fast, cheap, and reliable for this workload)
- `run_in_background: true`
- `description: "Research: {TOPIC}"`
- Each agent gets the prompt template above with its specific topic substituted

### Collect Results

Collect results using `TaskOutput` with `block: true`. Launch all TaskOutput calls in a SINGLE message so they resolve as each agent finishes:

- For each agent, call `TaskOutput` with the agent's `task_id`, `block: true`, `timeout: 300000` (5 min per agent -- deep mode with external APIs can exceed 2 min)

**Error handling:** If an agent fails, times out, or returns empty output:
- Note the failure: `"Topic '{TOPIC}': Research agent failed or returned no data"`
- Continue with remaining topics -- don't abort the whole run

### Cross-Topic Synthesis

With all reports collected, perform cross-topic analysis:

**Per-topic summaries:** For each topic, write a 2-3 sentence synthesis grounded in the actual report data.

**Cross-topic patterns:** Identify themes across 2+ topics -- shared technologies, common pain points, convergent trends.

**Unique insights per topic:** What is discussed in one topic but NOT others.

**Contradictions:** Where do the topics' communities disagree.

### Display Multi-Topic Report

```
---

## Topic 1: "{TOPIC_1}"

[2-3 sentence synthesis grounded in the actual research findings]

- Reddit: {n} threads | {sum} upvotes | {sum} comments
- X: {n} posts | {sum} likes | {sum} reposts
- Web: {n} pages
- Top voices: r/{sub1}, r/{sub2} | @{handle1}, @{handle2} | {author} on {domain}
- Sentiment: {positive/negative/mixed/neutral}

## Topic 2: "{TOPIC_2}"

[2-3 sentence synthesis]

- Reddit: ...
- X: ...
- Web: ...
- Top voices: ...
- Sentiment: ...

[...repeat for each topic...]

---

## Cross-Topic Patterns

1. **{Pattern name}** -- {1-2 sentence explanation with evidence from specific topics}
2. **{Pattern name}** -- {explanation}
3. **{Pattern name}** -- {explanation}

## Unique to Each Topic

- **{Topic 1} only:** {insight not found in other topics}
- **{Topic 2} only:** {insight not found in other topics}

## Contradictions

[Where topics' communities disagree -- skip if no contradictions found]

- **{Topic A} vs {Topic B}:** {what they disagree about and why}

---

All agents reported back!
- Topics researched: {N}
- Total Reddit threads: {sum across all topics} | {sum upvotes} upvotes
- Total X posts: {sum across all topics} | {sum likes} likes
- Total Web pages: {sum across all topics}
```

### Multi-Topic Follow-Up

After displaying the report, offer next steps:

```
What would you like to do next?

1. Deep dive into one topic -- I'll do detailed single-topic research with prompt writing
2. Compare specific aspects -- Ask me about patterns across these topics
3. Export this report -- I'll save it to a file
```

Do NOT automatically start writing prompts in multi-topic mode.

---

## Error Handling

**All agents/searches failed:**
```
Research failed. This may be due to:
- Network issues
- API rate limiting
- CLI tool not installed (run: bun add -g @side-quest/last-30-days)

Try again or check your connection.
```

---

## Context Memory

For the rest of this conversation, remember:
- **TOPIC(S)**: {topics}
- **TARGET_TOOL**: {tool, if single-topic}
- **KEY PATTERNS**: {top 3-5 patterns learned}
- **RESEARCH FINDINGS**: Key facts and insights from the research

**After research is complete, you are now an EXPERT on this topic.**

When the user asks follow-up questions:
- **DO NOT run new WebSearches** - you already have the research
- **Answer from what you learned** - cite the Reddit threads, X posts, and web sources
- **If they ask for a prompt** - write one using your expertise
- **If they ask a question** - answer it from your research findings

Only do new research if the user explicitly asks about a DIFFERENT topic.
