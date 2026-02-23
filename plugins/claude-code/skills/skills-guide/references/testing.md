# Testing & Iteration

How to test skills at varying levels of rigor, run smoke tests, and iterate based on feedback.

Source: Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026), code.claude.com/docs/en/skills

---

## Testing Approaches

Choose the approach that matches your quality requirements. A skill used internally by a small team has different testing needs than one deployed to thousands of enterprise users.

| Approach | When to Use | Setup |
|----------|------------|-------|
| **Manual testing in Claude.ai or Claude Code** | Fast iteration, exploring behavior | None -- just run queries and observe |
| **Scripted testing in Claude Code** | Repeatable validation across changes | Write test prompts in a file |
| **Programmatic testing via skills API** | Systematic evaluation suites | Build against defined test sets |

**Pro tip**: Iterate on a single challenging task until Claude succeeds, then extract the winning approach into a skill. This leverages Claude's in-context learning and provides faster signal than broad testing. Once you have a working foundation, expand to multiple test cases.

---

## Smoke Test Prompt

Use this prompt to get Claude to run a full smoke test on any skill. Copy this into a new Claude Code session (so the skill loads fresh) and replace `[skill-name]` with your skill's name:

```
I want you to smoke test the /[skill-name] skill. Do the following:

1. **Discovery check**: What skills are available? Confirm /[skill-name] appears
   and its description is clear.

2. **Direct invocation**: Run /[skill-name] with a simple, obvious request.
   Report whether it loaded, what files it read, and whether the output
   matches the skill's stated purpose.

3. **Auto-trigger test**: Without using /[skill-name] directly, ask a question
   that SHOULD trigger it based on the description. Did it load automatically?

4. **Negative trigger test**: Ask something unrelated that should NOT trigger
   the skill. Confirm it stays inactive.

5. **Edge case**: Ask something ambiguous that's on the boundary of the
   skill's domain. Report how it handled the ambiguity.

6. **Reference file check**: If the skill has reference files, ask a question
   that requires loading one. Confirm the right file was loaded and the
   answer drew from it.

7. **Report card**: Summarize results as a table:
   | Test | Pass/Fail | Notes |
   Rate the skill's overall readiness (ship it / needs work / broken).
```

Adapt this for your skill -- add MCP-specific tests if your skill uses MCP, or remove reference file checks if it's a simple single-file skill.

---

## Three Test Areas

### 1. Triggering Tests

Goal: Ensure your skill loads at the right times.

Write test cases for both positive and negative triggers:

```
Should trigger:
- "Help me set up a new ProjectHub workspace"
- "I need to create a project in ProjectHub"
- "Initialize a ProjectHub project for Q4 planning"

Should NOT trigger:
- "What's the weather in San Francisco?"
- "Help me write Python code"
- "Create a spreadsheet"
```

Run 10-20 queries that should trigger your skill. Track how many load automatically vs require explicit /invocation. Aim for ~90% auto-trigger rate on relevant queries.

### 2. Functional Tests

Goal: Verify the skill produces correct outputs.

```
Test: Create project with 5 tasks
Given: Project name "Q4 Planning", 5 task descriptions
When: Skill executes workflow
Then:
- Project created in ProjectHub
- 5 tasks created with correct properties
- All tasks linked to project
- No API errors
```

Cover: valid outputs generated, API calls succeed, error handling works, edge cases handled.

### 3. Performance Comparison

Goal: Prove the skill improves results vs baseline.

```
Without skill:
- User provides instructions each time
- 15 back-and-forth messages
- 3 failed API calls requiring retry
- 12,000 tokens consumed

With skill:
- Automatic workflow execution
- 2 clarifying questions only
- 0 failed API calls
- 6,000 tokens consumed
```

---

## Iteration Feedback Signals

Skills are living documents. Watch for these signals and respond:

### Undertriggering (skill doesn't load when it should)

Signals:
- Users manually invoking with /name instead of auto-trigger
- Support questions about when to use it
- Skill doesn't load on paraphrased requests

**Fix**: Add more trigger phrases and keywords to the description. Include technical terms, synonyms, and natural language variations.

### Overtriggering (skill loads when it shouldn't)

Signals:
- Skill loads for irrelevant queries
- Users disabling it
- Confusion about the skill's purpose

**Fix**: Make description more specific. Add `disable-model-invocation: true` if you only want manual invocation.

### Execution Issues (skill loads but doesn't perform well)

Signals:
- Inconsistent results across sessions
- API call failures
- Users needing to correct or redirect Claude

**Fix**: Improve instructions, add error handling, tighten degrees of freedom (see authoring.md for the freedom spectrum).

---

## Using skill-creator for Testing

The `skill-creator` skill (available in Claude.ai plugin directory or for Claude Code) helps review and iterate:

- **Reviewing**: Flag vague descriptions, missing triggers, structural problems
- **Suggesting tests**: Generate test cases based on the skill's stated purpose
- **Iterating**: Bring edge cases and failures back to improve handling

```
"Use the skill-creator skill to review my skill at [path] and suggest improvements"
```

Note: skill-creator helps design and refine skills but does not execute automated test suites or produce quantitative evaluation results.
