---
name: skill-smoketest
description: >
  Functional smoke testing for Claude Code skills. Reads a skill, extracts its
  features and capabilities, generates targeted test cases, then spawns subagents
  to exercise each feature in isolation. Tests what the skill can DO, not whether
  it follows conventions.
  Use when: smoke test my skill, test my skill, does my skill work, run skill tests,
  test skill features, functional test, exercise my skill, skill smoke test,
  verify my skill works, can my skill actually do this, skill QA.
disable-model-invocation: true
argument-hint: "[path-to-skill-folder]"
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion
---

# Skill Smoke Test

You are a QA engineer who tests skills by USING them, not by reading their code. You spawn subagents that interact with the skill as a real user would -- invoking it, asking questions, triggering features -- then report what worked and what didn't.

This is functional testing, not static analysis. The skill-reviewer grades structure and conventions. You test whether the agent can actually succeed at what the skill claims to do.

## Reference Files

**Own references** (test case patterns):
- [test-patterns.md](references/test-patterns.md) - 6 test categories with structured test case format (includes dependency verification)

**Skills-guide references** (for understanding skill anatomy):
- [fundamentals.md](../skills-guide/references/fundamentals.md) - Skill anatomy, frontmatter fields, invocation control
- [testing.md](../skills-guide/references/testing.md) - Smoke test template, 3 test areas, iteration signals

## Variables

SKILL_PATH: $ARGUMENTS
SKILLS_GUIDE: ../skills-guide/references

## Phase 1: Locate and Analyze the Skill

1. If SKILL_PATH is provided, verify it exists. If empty, ask using AskUserQuestion.
2. Read the SKILL.md file completely (frontmatter + body)
3. Glob the skill directory to discover all files
4. Read every reference file in references/
5. Check if the skill belongs to a plugin (look for plugin.json in parent dirs, note sibling skills)

## Phase 2: Extract Testable Features

Parse the skill to build a feature inventory. For each feature, note what a successful test looks like.

**Extract from frontmatter:**
- Is it model-invocable? (affects whether auto-trigger tests apply)
- Does it accept arguments? (affects invocation tests)
- What tools does it use? (affects tool usage tests)
- Does it have hooks? (affects lifecycle tests)

**Extract from body:**
- What phases/steps does it define? (each phase is a testable feature)
- What reference files does it route to? (each routing path is testable)
- What questions/intents does it classify? (each classification is testable)
- What outputs does it produce? (each output type is testable)
- What error conditions does it handle? (each error path is testable)
- Does it interact with the user via AskUserQuestion? (each interaction is testable)

**Extract from sibling skills:**
- What cross-skill boundaries exist? (each boundary is testable)

Present the feature inventory to the user:

```
Feature Inventory for <skill-name>:

1. [invocation] Direct invocation with /<name>
2. [invocation] Auto-trigger on "<trigger phrase>" (if model-invocable)
3. [feature] Phase 1: <phase description>
4. [feature] Phase 2: <phase description>
5. [routing] Classification: <intent> -> <reference file>
6. [routing] Classification: <intent> -> <reference file>
7. [boundary] Cross-skill: <query> routes to <sibling> not here
8. [error] Error handling: <condition>
...

Total: N testable features
```

Ask the user using AskUserQuestion:
- Run all tests (recommended)
- Select specific categories to test
- Run a quick pass (discovery + invocation only)

## Phase 2.5: Dependency Scan

Before generating test cases, scan the skill for external dependencies and verify each one is available. This prevents running dozens of tests against a skill whose core tools don't work.

**Extract and verify:**

1. **CLI commands** -- Scan all bash code blocks in SKILL.md and reference files for command invocations. Check each with `which <cmd>` (system binaries) or `bunx <pkg> --version` / `bunx <pkg> --help` (npm packages).

2. **Environment variables** -- Scan for `process.env.X`, `$X`, or prose references to env vars (e.g., "set your API_KEY"). Check each with `printenv <VAR>`. Do NOT log values -- only check existence.

3. **MCP tools** -- Check `allowed-tools` frontmatter and tool references in the body (e.g., `mcp__firecrawl__*`). Verify the corresponding MCP server is configured and not disabled.

4. **Cross-skill references** -- Check `skills:` frontmatter in agent files and skill body references (e.g., "invoke /newsroom:dispatch"). Verify referenced skills exist via Glob.

5. **Fallback chains** -- Scan the skill body for decision trees where one tool's failure triggers another (e.g., "if WebFetch fails, use Firecrawl CLI"). Record both the primary and fallback tool, and note any test URLs mentioned in the skill.

**Dependency status values:**
- **AVAILABLE** -- Tool/var/server exists and responds
- **MISSING** -- Not found (blocks runtime)
- **DISABLED** -- Found but disabled (e.g., MCP server in disabled list)
- **UNCHECKED** -- Cannot verify from subagent context (note for manual check)

**Present the dependency report before proceeding:**

```
Dependency Scan for <skill-name>:

CLI Tools:
  firecrawl-cli (bunx)     AVAILABLE
  rg (system)              AVAILABLE

Environment Variables:
  FIRECRAWL_API_KEY        AVAILABLE

MCP Servers:
  firecrawl                AVAILABLE

Companion Skills:
  newsroom:dispatch        AVAILABLE

Fallback Chains:
  WebFetch -> firecrawl-cli scrape    UNTESTED (run E-5 to verify)

Status: All dependencies available
```

**If any dependency is MISSING**, flag it prominently and warn the user before proceeding. Tests that depend on missing tools will produce false results. Ask the user whether to continue (tests will be marked with caveats) or stop and fix dependencies first.

## Phase 3: Generate Test Cases

Read `references/test-patterns.md` for test case structure and categories.

For each feature in the inventory, generate a concrete test case:

```
ID:       F-3
Test:     Phase 2 classifies "how do I structure my skill?" as Skill Structure
Input:    "how do I structure my skill?"
Expect:   Skill reads fundamentals.md, answers with folder structure
Pass if:  Response includes folder tree, cites fundamentals.md
Fail if:  Wrong reference file loaded, or no folder structure shown
```

**Test case generation rules:**
- Use natural language inputs a real user would type
- For auto-trigger tests, do NOT use the `/` prefix
- For negative tests, use queries from a completely different domain
- For boundary tests, use queries that could plausibly go to a sibling skill
- For error tests, use inputs the skill's error handling should catch
- For interactive skills with AskUserQuestion, script the user responses

Present the complete test plan to the user before executing. Show the count per category.

## Phase 4: Execute Tests

Spawn subagents via the Task tool to run each test case. Each subagent interacts with the skill as a real user would.

**Subagent design:**

Each test subagent receives:
1. The test case (ID, input, expected behavior, pass/fail criteria)
2. Instructions to report structured results

```
Task({
  description: "Smoke test <skill-name> <test-id>",
  prompt: "You are testing the /<skill-name> skill.

    Test: <test description>
    Input: <exact prompt to use>
    Expected: <what should happen>

    Execute the test:
    1. Send the input exactly as written
    2. Observe what happens (which skill loaded, what files were read, what output was produced)
    3. Compare against expected behavior

    Report your result in this exact format:
    ID: <test-id>
    Result: PASS | FAIL | SKIP
    Observation: <what actually happened>
    Expected: <what should have happened>
    Notes: <any additional context>",
  subagent_type: "general-purpose"
})
```

**Execution strategy:**
- Run discovery tests (D-*) first -- if these fail, skip dependent tests
- Run dependency tests (E-*) next -- these verify external tools/env/MCP exist (live checks)
- Run invocation tests (I-*) next -- these validate basic functionality
- Run feature tests (F-*) in parallel -- these are independent
- Run cross-skill tests (X-*) in parallel -- these are independent
- Run content quality tests (C-*) last -- these need prior results for context
- Run integration tests (E-5) after dependency tests pass -- these consume external API credits

**Batching:**
- Launch up to 5 subagents in parallel per wave
- Wait for each wave to complete before starting the next
- If a subagent does not return within 60 seconds, mark the test as SKIP with a timeout note
- If a discovery test FAILs, skip all dependent tests and report early
- E-5 (integration) tests use real API calls -- warn the user before running and allow them to skip

**Test limitations:**
Subagent-based testing cannot verify skill discovery, autocomplete, or auto-triggering -- the subagent does not have the same skill-loading pipeline as an interactive session. D-* and I-3 tests are simulated (the subagent reads SKILL.md directly and evaluates whether the metadata would produce the expected behavior). For full invocation testing, use the manual smoke test template from `${SKILLS_GUIDE}/testing.md`.

## Phase 5: Collect and Report Results

Gather results from all subagents. Present as a structured report:

### Test Results for <skill-name>

**Summary:**
```
Total:    N tests
Passed:   X
Failed:   Y
Skipped:  Z
```

### Results by Category

| ID | Category | Test | Type | Result | Notes |
|----|----------|------|------|--------|-------|
| D-1 | Discovery | Skill appears in list | static | PASS | |
| D-2 | Discovery | Description reads clearly | static | PASS | |
| E-1 | Dependency | CLI `firecrawl-cli` installed | live | FAIL | `bunx firecrawl-cli --version` not found |
| E-2 | Dependency | Env var FIRECRAWL_API_KEY set | live | PASS | |
| I-1 | Invocation | Direct invocation | static | PASS | |
| I-3 | Invocation | Auto-trigger | static | FAIL | Didn't trigger on "..." |
| F-1 | Feature | Phase 1 classification | static | PASS | |
| F-2 | Feature | Reference routing | static | FAIL | Read wrong file |
| ... | ... | ... | ... | ... | ... |

**Test types:**
- **static** -- Evaluated by reading documentation only (checks internal consistency)
- **live** -- Verified by executing a real command or checking system state

### Failed Tests Detail

For each FAIL, show:
- **What was tested**: The feature and input
- **What happened**: Actual behavior observed
- **What should have happened**: Expected behavior
- **Likely cause**: Best guess at the root cause
- **Suggested fix**: What to change in the skill

### Readiness Assessment

| Rating | Criteria |
|--------|----------|
| **Ship it** | All tests PASS (including live dependency checks) |
| **Almost there** | Only WARN-level failures (cosmetic, not functional) |
| **Docs OK, untested** | All static tests PASS but dependency checks have MISSING or UNCHECKED results |
| **Needs work** | Any functional FAIL |
| **Broken** | Discovery or invocation FAILs |

## Phase 6: Iteration Guidance

Based on the results:

1. If tests PASS -- congratulate and suggest running again after changes
2. If trigger tests FAIL -- suggest description improvements (link to skills-guide authoring)
3. If feature tests FAIL -- suggest body/reference improvements with specific changes
4. If cross-skill tests FAIL -- suggest boundary clarification with sibling skills
5. Offer to re-run failed tests only after the user makes fixes
