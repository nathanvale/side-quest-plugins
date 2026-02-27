# Mode Playbook

**Only loaded when `--mode` is not `recon` (default).**

Translates the `--mode` flag into assignment variations for Beat Reporters. The Desk resolves all placeholders (like `{TOPIC}`) to actual values before dispatching. Mode `focus_fields` supplement (not replace) query-type fields from query-strategies.md.

## Mode Routing

| MODE value | Section | What it does |
|------------|---------|-------------|
| `changes` | [Stakeout](#mode-changes-stakeout) | Delta-focused -- what's new, not what's known |
| `sentiment` | [Source Network](#mode-sentiment-source-network) | Community mood, praise, complaints, debates |
| `verify "claim"` | [Tipster Handler](#mode-verify-claim-tipster-handler) | Evidence for/against a specific claim |

Read only the section matching the active MODE value.

## Mode: changes (Stakeout)

Delta-focused reporting. The reporter looks for what's NEW, not what's known.

**Assignment adjustments:**
- Always add `--refresh` to CLI flags (bypass cache to catch new results)
- Prefix web queries with "new" or "latest" or "this week"
- Add `--days 7` if DAYS was not explicitly set (shorter window = more focused deltas)
- `depth_instruction`: "Delta-focused -- report only what's new or changed. Skip established facts."
- `focus_fields`: add "release dates", "version numbers", "changelog entries"

**Preflight label:** "Mode: changes (delta-focused, refreshing sources)"

## Mode: sentiment (Source Network)

Community sentiment deep-dive. The reporter digs into what people FEEL, not just what they SAY.

**Assignment adjustments:**
- Force `--sources=both` on CLI flags (always check both Reddit and X)
- Add sentiment-focused web queries: "{TOPIC} community reaction", "{TOPIC} opinions controversy"
- `depth_instruction`: "Sentiment-focused -- report community mood, praise, complaints, debates. Quote directly."
- `focus_fields`: add "sentiment signals", "complaint patterns", "praise patterns", "community mood"

**Preflight label:** "Mode: sentiment (community sentiment deep-dive)"

## Mode: verify "claim" (Tipster Handler)

Fact-checking mode. The reporter searches for evidence FOR and AGAINST a specific claim.

**Prerequisite:** `--mode verify "the claim text"` MUST include the claim string. If missing, the Desk asks the user via AskUserQuestion before proceeding.

**Assignment adjustments:**
- The claim text is extracted from `--mode verify "the claim text"`
- Web queries split into pro and con:
  - "{claim} confirmed" / "{claim} true"
  - "{claim} debunked" / "{claim} false" / "{claim} myth"
- CLI topic is the claim itself
- `depth_instruction`: "Verification -- search for evidence both supporting and contradicting this claim. Rate confidence."
- `focus_fields`: add "supporting evidence", "contradicting evidence", "source credibility"

**Output addition:** Add a confidence rating at the end of the evening edition:
```
**Confidence: {HIGH|MEDIUM|LOW|UNVERIFIED}**
- Supporting: {n} sources
- Contradicting: {n} sources
- Assessment: [1-2 sentence summary]
```

**Preflight label:** "Mode: verify (fact-checking: {claim})"
