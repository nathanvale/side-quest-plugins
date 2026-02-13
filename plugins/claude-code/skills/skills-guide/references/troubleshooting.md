# Troubleshooting

Symptoms, debug steps, and common issues when building and using Claude Code skills.

Source: Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026), code.claude.com/docs/en/skills

---

## Quick Reference

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Skill not triggering | Description doesn't match user's words | Add specific trigger phrases to description |
| Skill triggers too often | Description too broad | Make description more specific or add `disable-model-invocation: true` |
| Skill not in / menu | `user-invocable: false` is set, or skill excluded by budget | Check frontmatter; run `/context` |
| Too many skills, some missing | Context budget exceeded | Run `/context` to check; set `SLASH_COMMAND_TOOL_CHAR_BUDGET` |
| Frontmatter syntax error | Invalid YAML between --- markers | Validate YAML syntax; check for tab characters |
| Skill invocation ignored by Claude | `disable-model-invocation: true` set | Remove the field or invoke manually with /name |
| Reference files not loading | Not linked from SKILL.md | Add explicit references with when-to-read guidance |
| context: fork returns nothing | Skill has guidelines but no task | Add explicit instructions/task to skill body |
| Hook in skill frontmatter not firing | Known issue (claude-code#17688) | Move hook to plugin `hooks/hooks.json` |
| Dynamic context (!`cmd`) fails | Command error or wrong syntax | Test command standalone; verify backtick syntax |
| Skill works locally but not in plugin | Name mismatch or path not registered | Check plugin.json paths; verify skill folder name matches |
| "What skills are available?" misses yours | Skill excluded from context budget | Run `/context`; check `SLASH_COMMAND_TOOL_CHAR_BUDGET` |

---

## Debug Steps

### 1. Verify Skill Exists

Ask Claude: "What skills are available?"

If your skill doesn't appear:
- Check file location is correct (see distribution.md for paths)
- Verify SKILL.md exists in the skill directory
- Check YAML frontmatter syntax

### 2. Test Direct Invocation

Try `/skill-name` directly. If this works but auto-triggering doesn't, the issue is in the description.

### 3. Check the Description

The description is the primary trigger signal. Common issues:
- **Too vague**: "A helpful utility" won't trigger on anything specific
- **Missing keywords**: Include words users would naturally say
- **Trigger info in body**: Body loads AFTER trigger -- move trigger info to description

### 4. Check Context Budget

Skill descriptions share a character budget (2% of context window, ~16K chars fallback). If you have many skills, some may be excluded.

Run `/context` to see if skills are being excluded. Override with:

```bash
export SLASH_COMMAND_TOOL_CHAR_BUDGET=32000
```

### 5. Validate YAML Frontmatter

Common YAML errors:
- Tab characters instead of spaces
- Missing closing `---` marker
- Unquoted special characters in values
- Incorrect indentation

Test by invoking directly with `/skill-name` -- if YAML is invalid, the skill won't load.

### 6. Check File References

If reference files aren't being loaded:
- Verify the file path in SKILL.md is relative and correct
- Verify the file actually exists at that path
- Add clearer descriptions of when Claude should read each file

---

## Common Issues by Category

### Triggering Issues

**Skill never triggers automatically**:
1. Check description includes natural trigger phrases
2. Verify `disable-model-invocation` is NOT set to true
3. Try rephrasing your request to match the description
4. Check if another skill is matching first

**Skill triggers when it shouldn't**:
1. Make description more specific
2. Add `disable-model-invocation: true` if you only want manual invocation
3. Remove overly broad keywords from description

### Structure Issues

**Skill works locally but not as a plugin**:
1. Verify skill folder name matches `name` field
2. Check `plugin.json` has correct path in `skills` array
3. Verify plugin is enabled in the project

**Reference files not found**:
1. Check relative paths from SKILL.md
2. Verify files exist in the skill directory
3. Ensure paths use forward slashes (not backslashes)

### Advanced Feature Issues

**context: fork returns empty/useless output**:
- Ensure SKILL.md has explicit task instructions, not just guidelines
- context: fork creates a new context without conversation history
- The skill content must contain a complete, actionable task

**Dynamic context (!`command`) produces errors**:
- Test the command in your terminal first
- Verify the command is available in the environment
- Check for quoting issues in the command

**Subagent can't find files**:
- Forked subagents load CLAUDE.md but may not have full project context
- Include file paths or search patterns in the skill

---

## Debugging Checklist

For any skill issue, work through this list:

1. Does SKILL.md exist at the correct path?
2. Is the YAML frontmatter valid?
3. Does `/skill-name` work when invoked directly?
4. Does the description include natural trigger phrases?
5. Is `disable-model-invocation` set when it shouldn't be?
6. Are there too many skills exceeding the context budget?
7. Are reference file paths correct and relative?
8. For plugins: is the skill registered in plugin.json?
