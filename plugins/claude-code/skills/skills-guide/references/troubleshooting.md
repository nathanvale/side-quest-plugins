# Troubleshooting

Symptom-driven troubleshooting for Claude Code skills. Find your error, follow the fix.

Source: Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026), code.claude.com/docs/en/skills

---

## Quick Reference

| Symptom | Jump To |
|---------|---------|
| Skill won't upload / "Could not find SKILL.md" | Upload Errors |
| Invalid frontmatter / Invalid skill name | Upload Errors |
| Skill never triggers automatically | Skill Doesn't Trigger |
| Skill triggers for unrelated queries | Skill Triggers Too Often |
| MCP calls fail when skill runs | MCP Connection Issues |
| Claude ignores skill instructions | Instructions Not Followed |
| Skill seems slow or responses degraded | Large Context Issues |
| Reference files not loading | Reference File Issues |
| context: fork returns nothing useful | Advanced Feature Issues |

---

## Upload Errors

### "Could not find SKILL.md in uploaded folder"

**Cause**: File not named exactly `SKILL.md` (case-sensitive).

**Fix**: Rename to `SKILL.md` -- verify with `ls -la` that it shows `SKILL.md`, not `skill.md` or `Skill.md`.

### "Invalid frontmatter"

**Cause**: YAML formatting issue.

```yaml
# Wrong - missing delimiters
name: my-skill
description: Does things

# Wrong - unclosed quotes
---
name: my-skill
description: "Does things
---

# Correct
---
name: my-skill
description: Does things
---
```

Common YAML mistakes:
- Tab characters instead of spaces
- Missing opening or closing `---` marker
- Unquoted special characters in values
- Incorrect indentation

### "Invalid skill name"

**Cause**: Name has spaces, capitals, or special characters.

```yaml
# Wrong
name: My Cool Skill

# Correct
name: my-cool-skill
```

Rules: lowercase letters, numbers, and hyphens only. Max 64 characters.

---

## Skill Doesn't Trigger

**Symptom**: Skill never loads automatically -- users must invoke with `/name`.

**Debug technique**: Ask Claude: "When would you use the [skill name] skill?" Claude will quote the description back. Adjust based on what's missing.

**Quick checklist**:
1. Is the description too generic? ("Helps with projects" won't match anything)
2. Does it include phrases users would actually say?
3. Does it mention relevant file types if applicable?
4. Is `disable-model-invocation: true` set? (This blocks auto-triggering)
5. Is trigger info in the body instead of the description? (Body loads AFTER trigger)
6. Is another skill matching first?

**Fix**: Revise the description. See authoring.md for good/bad description examples.

---

## Skill Triggers Too Often

**Symptom**: Skill loads for unrelated queries.

**Three fixes** (use in combination):

**1. Add negative triggers**:
```yaml
description: Advanced data analysis for CSV files. Use for
  statistical modeling, regression, clustering. Do NOT use for
  simple data exploration (use data-viz skill instead).
```

**2. Be more specific**:
```yaml
# Too broad
description: Processes documents

# Specific
description: Processes PDF legal documents for contract review
```

**3. Clarify scope**:
```yaml
description: PayFlow payment processing for e-commerce. Use
  specifically for online payment workflows, not for general
  financial queries.
```

If auto-triggering is never appropriate, add `disable-model-invocation: true`.

---

## MCP Connection Issues

**Symptom**: Skill loads but MCP tool calls fail.

**Checklist** (work through in order):

1. **Verify MCP server is connected**
   - Claude.ai: Settings > Extensions > [Your Service] -- should show "Connected"
   - Claude Code: check MCP server status in settings

2. **Check authentication**
   - API keys valid and not expired
   - Proper permissions/scopes granted
   - OAuth tokens refreshed

3. **Test MCP independently** (isolates whether issue is MCP or skill)
   - Ask Claude to call the MCP tool directly without the skill
   - "Use [Service] MCP to fetch my projects"
   - If this also fails, the issue is the MCP server, not the skill

4. **Verify tool names**
   - Skill references correct MCP tool names (case-sensitive)
   - Check MCP server documentation for exact names

---

## Instructions Not Followed

**Symptom**: Skill loads but Claude doesn't follow the instructions.

### Instructions too verbose

Keep instructions concise. Use bullet points and numbered lists. Move detailed reference material to `references/` files -- keep SKILL.md under 5,000 words.

### Critical instructions buried

Put critical instructions at the top. Use `## Important` or `## Critical` headers. Repeat key constraints if needed.

### Ambiguous language

```markdown
# Bad
Make sure to validate things properly

# Good
CRITICAL: Before calling create_project, verify:
- Project name is non-empty
- At least one team member assigned
- Start date is not in the past
```

### Advanced technique: scripts over prose

For critical validations, bundle a script that performs checks programmatically rather than relying on language instructions. Code is deterministic; language interpretation isn't.

```markdown
# Instead of prose validation rules:
Run `python scripts/validate_input.py --data {filename}` before proceeding.
If validation fails, show the error and ask the user to fix.
```

---

## Large Context Issues

**Symptom**: Skill seems slow, responses degraded, or skills silently dropped.

**Causes and fixes**:

1. **Skill content too large**
   - Move detailed docs to `references/` -- load only what's needed
   - Keep SKILL.md under 5,000 words
   - Use progressive disclosure (see fundamentals.md)

2. **Too many skills enabled simultaneously**
   - If you have 20-50+ skills enabled, some will be excluded from the context budget
   - Run `/context` to see which skills are being excluded
   - Override budget: `export SLASH_COMMAND_TOOL_CHAR_BUDGET=32000`
   - Consider selective enablement or skill "packs" for related capabilities

3. **All content loaded instead of progressive disclosure**
   - Don't inline everything in SKILL.md -- use `references/` with clear when-to-read guidance
   - Claude only reads reference files when the specific topic is relevant

---

## Reference File Issues

**Symptom**: Reference files not loading when they should.

**Checklist**:
1. File path in SKILL.md is relative and correct (e.g., `[detail.md](references/detail.md)`)
2. File actually exists at that path
3. SKILL.md includes when-to-read guidance ("See [detail.md](references/detail.md) for X")
4. Paths use forward slashes (not backslashes)

---

## Advanced Feature Issues

**context: fork returns empty/useless output**:
- `context: fork` creates a new isolated context without conversation history
- The skill content must contain a complete, actionable task -- not just guidelines
- If your skill is guidelines-only, don't use `context: fork`

**Dynamic context (`` !`command` ``) produces errors**:
- Test the command in your terminal first -- it runs as preprocessing before Claude sees anything
- Verify the command is available in the skill's execution environment
- Check for quoting issues in the command

**Subagent can't find files**:
- Forked subagents load CLAUDE.md but may not have full project context
- Include explicit file paths or search patterns in the skill instructions

**Skill works locally but not as a plugin**:
1. Verify skill folder name matches `name` field in frontmatter
2. Check `plugin.json` has the correct path in the `skills` array
3. Verify the plugin is enabled in the project

**Hook in skill frontmatter not firing**:
- Known issue (claude-code#17688): plugin skill frontmatter hooks are silently ignored
- Workaround: move hook to `hooks/hooks.json` in the plugin instead

---

## Universal Debug Checklist

For any skill issue, work through this list:

1. Does `SKILL.md` exist at the correct path? (case-sensitive)
2. Is the YAML frontmatter valid? (between `---` markers, no tabs)
3. Does `/skill-name` work when invoked directly?
4. Does the description include natural trigger phrases?
5. Ask Claude: "When would you use the [skill name] skill?"
6. Is `disable-model-invocation` set when it shouldn't be?
7. Are there too many skills exceeding the context budget? (`/context`)
8. Are reference file paths correct and relative?
9. For plugins: is the skill registered in `plugin.json`?
10. For MCP skills: does the MCP tool work without the skill?
