# Test Patterns

Structured test case patterns for agent-level skill testing. Each pattern targets a different aspect of how Claude interacts with a skill.

Source: Derived from Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026)

---

## Test Case Format

Every test case follows this structure:

```
ID:       <category>-<number>
Test:     <what we're testing>
Input:    <exact prompt to send to Claude>
Expect:   <what should happen>
Pass if:  <specific observable criteria>
Fail if:  <specific observable criteria>
```

---

## Category 1: Discovery Tests

Verify the skill is visible and its metadata is correct.

### D-1: Skill Appears in List

Test that `/` autocomplete includes the skill.

- Input: Type `/` and check autocomplete suggestions
- Pass if: Skill name appears with description
- Fail if: Skill not listed or description is empty

### D-2: Description Reads Clearly

Test that the description communicates what + when.

- Input: "What skills are available? Describe what each one does."
- Pass if: Claude articulates both what the skill does AND when to use it
- Fail if: Description is vague, missing triggers, or confusing

### D-3: Argument Hint Visible

Test that argument-hint shows during autocomplete (if applicable).

- Input: Type `/<skill-name> ` (with trailing space)
- Pass if: Autocomplete shows the hint text
- Fail if: No hint shown for a skill that has argument-hint

---

## Category 2: Invocation Tests

Verify the skill loads and executes correctly.

### I-1: Direct Invocation

Test that `/<skill-name>` loads the skill.

- Input: `/<skill-name>` with a simple, obvious request
- Pass if: Skill loads, reads correct files, produces relevant output
- Fail if: Skill doesn't load, reads wrong files, or produces irrelevant output

### I-2: Direct Invocation with Arguments

Test that arguments are passed correctly (if applicable).

- Input: `/<skill-name> <test-argument>`
- Pass if: Skill receives and uses the argument in its workflow
- Fail if: Argument is ignored or causes an error

### I-3: Auto-Trigger (model-invocable skills only)

Test that Claude loads the skill when the user's question matches the description.

- Input: A natural language question that matches the skill's triggers
- Pass if: Skill auto-loads without explicit `/` invocation
- Fail if: Skill doesn't trigger, user must invoke manually

### I-4: Negative Trigger

Test that unrelated queries do NOT trigger the skill.

- Input: A question completely outside the skill's domain
- Pass if: Skill stays inactive
- Fail if: Skill loads for an unrelated query

### I-5: Boundary Trigger

Test ambiguous queries on the edge of the skill's domain.

- Input: A question that's plausibly related but not clearly in scope
- Pass if: Claude either triggers appropriately or stays inactive with clear reasoning
- Fail if: Inconsistent behavior across attempts

---

## Category 3: Feature Tests

Verify specific capabilities the skill claims to support.

### F-1: Reference File Loading

Test that reference files load when their topic is queried.

- Input: A question that requires knowledge from a specific reference file
- Pass if: Correct reference file is read, answer draws from it
- Fail if: Wrong file read, or answer doesn't reflect file content

### F-2: Multi-Reference Routing

Test that multi-intent queries load the right combination of references.

- Input: A question spanning two reference file domains
- Pass if: Both relevant files are read, answer synthesizes from both
- Fail if: Only one file read, or answer is incomplete

### F-3: Phase/Step Execution (task skills)

Test that each phase of a multi-phase skill executes correctly.

- Input: Trigger the skill and walk through each phase
- Pass if: All phases execute in order, each produces expected output
- Fail if: Phase skipped, wrong order, or output doesn't match phase purpose

### F-4: Tool Usage

Test that the skill uses its declared tools correctly.

- Input: A request that requires the skill to call specific tools
- Pass if: Correct tools called with appropriate parameters
- Fail if: Wrong tools called, tools called unnecessarily, or tool calls fail

### F-5: Error Handling

Test that the skill handles expected error conditions.

- Input: Deliberately trigger a known error condition (invalid input, missing file, etc.)
- Pass if: Skill reports error clearly and suggests a fix
- Fail if: Skill crashes, gives misleading output, or silently fails

### F-6: AskUserQuestion Interaction (interactive skills)

Test that user interaction points work correctly.

- Input: Trigger the skill, then respond to each AskUserQuestion prompt
- Pass if: Questions are clear, options are appropriate, selections are handled correctly
- Fail if: Questions are confusing, options are missing, or selections are ignored

---

## Category 4: Cross-Skill Tests

Verify boundary behavior with sibling skills.

### X-1: Correct Routing

Test that queries are routed to the right skill when siblings exist.

- Input: A query that's clearly in this skill's domain (not a sibling's)
- Pass if: This skill handles it, sibling stays inactive
- Fail if: Sibling handles it instead, or both compete

### X-2: Boundary Handoff

Test that the skill correctly defers to siblings for out-of-scope queries.

- Input: A query that belongs to a sibling skill
- Pass if: Skill either stays inactive or explicitly redirects to the sibling
- Fail if: Skill attempts to answer a sibling's domain question

### X-3: Overlap Handling

Test ambiguous queries that could belong to either skill.

- Input: A query on the boundary between this skill and a sibling
- Pass if: One skill handles it cleanly, or the handling skill links to the sibling for the other part
- Fail if: Both skills load and produce conflicting guidance

---

## Category 5: Content Quality Tests

Verify output quality and consistency.

### C-1: Response Structure

Test that responses follow the skill's prescribed structure.

- Input: A standard query the skill is designed to handle
- Pass if: Response follows the structure defined in the SKILL.md body (e.g., "direct answer, example, verify step, common failure, source")
- Fail if: Unstructured response, missing required sections

### C-2: Source Citations

Test that responses cite their reference files.

- Input: A question that draws from a reference file
- Pass if: Response includes "Source: <filename>" or equivalent citation
- Fail if: No source cited, or wrong source cited

### C-3: Consistency Across Sessions

Test that the same query produces consistent results.

- Input: Run the same test prompt in 2-3 separate sessions
- Pass if: Responses are structurally consistent (same sections, same level of detail)
- Fail if: Wildly different responses, missing sections in some sessions

---

## Category 6: Dependency Tests

Verify that external dependencies referenced by the skill actually exist and are available. These are **live** tests -- they execute real commands and check system state, not just documentation consistency.

Without dependency verification, a skill can score 100% on static tests while being completely broken at runtime because a CLI tool isn't installed, an env var isn't set, or an MCP server is disabled.

### E-1: CLI Tools Available

For each CLI command referenced in the skill's bash code blocks or prose instructions, verify the binary exists.

- Input: Extract CLI commands from SKILL.md and reference files. For each, run `which <cmd>` or `bunx <pkg> --help`.
- Pass if: Command is found and responds (exit code 0)
- Fail if: Command not found (`which` returns non-zero, `bunx` errors)
- Note: For `bunx`-invoked packages, test with `bunx <pkg> --help` or `bunx <pkg> --version`. For system binaries, use `which`.

### E-2: Environment Variables Set

For each environment variable referenced in the skill (via `process.env.X`, `$X`, or prose like "set your FIRECRAWL_API_KEY"), verify it is defined.

- Input: Extract env var names. For each, check `printenv <VAR>`.
- Pass if: Variable is set (value is non-empty)
- Fail if: Variable is unset or empty
- Note: Do NOT log the value -- only check existence. Env vars may contain secrets.

### E-3: MCP Servers Available

For each MCP tool referenced in `allowed-tools` frontmatter or in the skill body (e.g., `mcp__firecrawl__firecrawl_scrape`), verify the MCP server is configured and enabled.

- Input: Extract MCP tool references. Check if the corresponding MCP server is configured (appears in settings) and not disabled.
- Pass if: MCP server is configured and enabled
- Fail if: MCP server is not configured or is disabled
- Note: Use `mcp-manager:list` or equivalent to check server status. If the subagent cannot access MCP config, mark as UNCHECKED.

### E-4: Companion Skills Installed

For skills that cross-reference other skills (e.g., `skills: [web-scraping]` in agent frontmatter, or prose like "invoke /newsroom:dispatch"), verify the referenced skill exists.

- Input: Extract skill references from frontmatter and body. Glob for each referenced skill's SKILL.md.
- Pass if: Referenced skill directory and SKILL.md exist
- Fail if: Referenced skill not found
- Note: Only checks existence, not correctness. The referenced skill may have its own issues.

### E-5: Fallback Chain Integration

For skills that define a fallback chain (tool A fails -> use tool B), verify the chain works end-to-end with a real URL.

- Input: Identify the fallback chain from the skill body. Find or use a known URL that triggers the fallback (e.g., a URL that 403s on WebFetch but succeeds on Firecrawl). Execute both steps:
  1. Attempt the primary tool and confirm it fails as expected
  2. Attempt the fallback tool and confirm it succeeds
- Pass if: Primary tool fails on the test URL AND fallback tool returns non-empty content
- Fail if: Fallback tool also fails, returns empty content, or returns an error blob instead of markdown
- Note: The test URL should be documented in the skill or chosen by the subagent. For web-scraping skills, `https://www.producthunt.com/` is a reliable anti-bot test target. This test consumes one Firecrawl API credit.
