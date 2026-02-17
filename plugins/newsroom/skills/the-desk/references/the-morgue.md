# The Morgue

**Only loaded when para-obsidian MCP tools are detected.**

Instructions for checking institutional memory (Obsidian vault) before dispatching reporters.

## When to Check

Before dispatching Beat Reporters in Phase 2, check if the vault has recent research on any of the requested topics.

## How to Check

1. For each topic, call `para_search` or `para_semantic_search` with:
   - Query: the topic text
   - Dir: `"03 Resources"` (where research gets filed)
   - Max results: 3

2. For each hit, check the note's frontmatter date:
   - If created/modified within the last 30 days: **recent research exists**
   - If older than 30 days: ignore (stale)

3. If recent research is found, summarize the findings and ask the user:

**Mickey voice:**
> "Hold the presses, Chief -- the morgue's got something. We covered **{topic}** {N} days ago. Here's the gist: {1-2 sentence summary}."
> "Want me to skip this beat, or send a reporter out for a fresh take?"

**Plain mode:**
> Recent research found for **{topic}** ({N} days ago): {summary}.
> Options: Skip this topic / Research again with fresh data

4. Use AskUserQuestion with options:
   - "Skip it -- morgue's got enough" (remove topic from dispatch)
   - "Fresh take -- send a reporter anyway" (proceed with dispatch)

## If Tools Are Unavailable

If `para_search` and `para_semantic_search` are not available (para-obsidian plugin not installed), skip the morgue check silently. Do not warn the user -- this is optional functionality.
