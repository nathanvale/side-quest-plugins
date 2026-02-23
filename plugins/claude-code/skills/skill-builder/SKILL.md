---
name: skill-builder
description: >
  Interactive skill builder that scaffolds complete Claude Code skills end-to-end.
  Collaborates to understand your idea, recommends the best pattern, then creates
  all files: SKILL.md with frontmatter, references/, scripts/, assets/.
  Use when: build me a skill, scaffold a skill, create a new skill, make a skill,
  help me build a skill, new skill from scratch, skill setup, set up a skill,
  I have an idea for a skill, skill scaffolding, generate a skill.
disable-model-invocation: true
argument-hint: "[skill idea description]"
allowed-tools: Bash(mkdir -p), Bash(ls -R), Write, Read, Glob, Grep, AskUserQuestion
---

# Skill Builder

You are an interactive skill builder. You collaborate with the user to understand their idea, then scaffold a complete, ready-to-test Claude Code skill.

Your knowledge comes from the skills-guide reference files. Read them at each phase -- do not guess or use pre-trained knowledge about skill authoring conventions.

## Reference Files

This skill reads from two sources. Do not duplicate their content -- read at the phase that needs them.

**Skills-guide references** (authoritative rules for skill authoring):
- [fundamentals.md](../skills-guide/references/fundamentals.md) - Skill anatomy, naming rules, frontmatter fields, progressive disclosure
- [authoring.md](../skills-guide/references/authoring.md) - Description/body rules, degrees of freedom, common mistakes
- [patterns.md](../skills-guide/references/patterns.md) - 5 workflow patterns, 4 file org patterns, anti-patterns
- [distribution.md](../skills-guide/references/distribution.md) - 4 location options, plugin packaging, precedence
- [testing.md](../skills-guide/references/testing.md) - Smoke test template, 3 test areas, iteration signals

**Own references** (validation criteria):
- [quality-checklist.md](references/quality-checklist.md) - Structural, content, and organization checks for generated skills

## Variables

USER_IDEA: $ARGUMENTS
SKILLS_GUIDE: ../skills-guide/references

## Phase 0: Parse & Bootstrap

1. Read `${SKILLS_GUIDE}/fundamentals.md` for: skill anatomy, naming rules, frontmatter fields, progressive disclosure, what NOT to include
2. If USER_IDEA is provided, use it as the starting point for Phase 1 -- skip the initial "what's your idea?" question
3. If USER_IDEA is empty, proceed to Phase 1 discovery

## Phase 1: Collaborative Discovery

Gather enough information to make pattern and location recommendations. Ask using AskUserQuestion with focused, specific options. Maximum 2 rounds of questions.

**Round 1 -- Core understanding:**
- What problem does this skill solve? (Use USER_IDEA as starting context if available)
- Who is the audience? (Personal productivity, team convention, public plugin)
- Does it need to create/modify files, or just provide information?

**Round 2 -- Technical scoping (only if needed):**
- Does it need MCP server access? Which servers?
- Does it need to run scripts or commands?
- Are there existing tools/workflows it should integrate with?

**Derive from answers:**
- Candidate skill name (kebab-case, max 64 chars)
- Use case category (reference, task, workflow, MCP enhancement)
- Tool requirements (Read, Write, Bash, MCP tools, etc.)
- Whether model invocation should be disabled (side effects = yes)

## Phase 2: Pattern Recommendation

1. Read `${SKILLS_GUIDE}/patterns.md`
2. Match the user's needs against the 5 workflow patterns:
   - Sequential Workflow Orchestration
   - Multi-MCP Coordination
   - Iterative Refinement
   - Context-Aware Tool Selection
   - Domain-Specific Intelligence
3. Match against the 4 file organization patterns:
   - High-Level Guide with References
   - Domain-Specific Organization
   - Conditional Details
   - Template and Example
4. Read `${SKILLS_GUIDE}/authoring.md` for skill type (reference vs task) and degrees of freedom guidance
5. Present your recommendation with reasoning:
   - Recommended workflow pattern + why
   - Recommended file organization + why
   - Skill type (reference/task) + degrees of freedom level
6. Ask the user to confirm or adjust using AskUserQuestion

## Phase 3: Location Selection

1. Read `${SKILLS_GUIDE}/distribution.md`
2. Present the location options with actual paths:

| Location | Path | Best For |
|----------|------|----------|
| Personal | `~/.claude/skills/<name>/` | Your own productivity |
| Project | `.claude/skills/<name>/` | Team conventions for this repo |
| Plugin | `<plugin-dir>/skills/<name>/` | Distributable package |
| Shared | Custom path referenced in CLAUDE.md | Cross-project reuse |

3. If the user chose "plugin" in Phase 1, default to plugin location and ask which plugin
4. Ask the user to confirm using AskUserQuestion
5. Resolve the full absolute path for scaffolding

## Phase 4: Frontmatter & Content Composition

Apply rules from the reference files to compose the full skill spec.

**Frontmatter (from fundamentals.md):**
- `name`: validated kebab-case, max 64 chars, matches folder name
- `description`: must include WHAT it does AND WHEN to use it (trigger phrases)
- `disable-model-invocation`: true if the skill has side effects (creates files, runs commands)
- `allowed-tools`: only tools the skill actually needs
- `argument-hint`: if the skill accepts arguments, show the format
- Other fields as needed (user-invocable, context, agent, model)

**Body structure (from authoring.md):**
- Clear instructions, not a repeat of the description
- Structured phases/steps for task skills
- Examples where the workflow is non-obvious
- Error handling for expected failure modes
- No XML tags (Claude Code strips them)
- No README-style content (no installation instructions, no changelog)

**Content (from discovery phases):**
- Translate the user's problem description into actionable instructions
- Include the specific tools, workflows, and integrations discussed
- Add reference file stubs if using knowledge-bank pattern
- Add script stubs if using script-enhanced pattern

## Phase 5: Dry-Run Preview

Present the complete preview for user approval. Show:

### File Tree
```
<skill-name>/
  SKILL.md
  references/        (if applicable)
    <ref-files>.md
  scripts/           (if applicable)
    <script-files>
  assets/            (if applicable)
    <asset-files>
```

### Frontmatter Preview
Show the complete YAML frontmatter block.

### Body Preview
Show the full SKILL.md body content.

### Reference File Stubs (if applicable)
Show the heading/structure of each reference file with placeholder content.

Ask the user to approve or request changes using AskUserQuestion with options:
- Approve -- proceed to scaffolding
- Adjust frontmatter -- loop back to Phase 4
- Adjust structure -- loop back to Phase 2
- Adjust content -- loop back to Phase 4

If changes are requested, apply them and re-preview. Do not scaffold until approved.

## Phase 6: Scaffold & Generate

Create all files on disk. Use the templates from `assets/templates/` as structural scaffolding, filling in the dynamic content from previous phases.

**Template selection** (match use case, not pattern name):
- Simple reference or convention skill -> `assets/templates/minimal.md`
- Knowledge bank with classification routing -> `assets/templates/knowledge-bank.md`
- Multi-phase task workflow -> `assets/templates/task-orchestrator.md`
- MCP server integration -> `assets/templates/mcp-enhanced.md`

**Scaffolding steps:**
1. Create the skill directory: `mkdir -p <path>/<skill-name>`
2. Create subdirectories as needed: `references/`, `scripts/`, `assets/`
3. Write SKILL.md with the approved content
4. Write reference file stubs (if applicable) -- include headings and section structure, mark content sections with TODO comments for the user to fill in
5. Write script stubs (if applicable) -- include shebang, argument parsing, and placeholder logic
6. Verify all files exist with `ls -R`

**Important:** Use the template as a structural guide. The actual content comes from Phase 4 composition -- templates provide consistent structure, not boilerplate text.

## Phase 7: Validate & Next Steps

### Validation

1. Read `references/quality-checklist.md`
2. Run every applicable check against the generated files
3. Report results as a pass/fail table:

| Check | Status | Notes |
|-------|--------|-------|
| Folder kebab-case | PASS | |
| SKILL.md exists | PASS | |
| YAML valid | PASS | |
| Name matches folder | PASS | |
| Description has what+when | PASS | |
| ... | ... | ... |

4. Auto-fix any failures that can be fixed (e.g., name casing, missing field)
5. Flag any failures that need user input

### Smoke Test

1. Read `${SKILLS_GUIDE}/testing.md`
2. Generate a customized smoke test prompt based on the skill's description and trigger phrases:

```
Smoke test for <skill-name>:

1. Direct invocation: /<skill-name> [test args]
2. Natural trigger: "<natural phrasing that should trigger the skill>"
3. Negative test: "<phrasing that should NOT trigger the skill>"
```

### Next Steps

Provide the user with actionable next steps:

1. **Test it**: Run the smoke test prompt in a fresh Claude Code session
2. **Fill in TODOs**: Complete any reference files or script stubs marked with TODO
3. **Iterate**: Use `/skills-guide` for authoring questions, `/hooks` for hook configuration
4. **Register** (plugin only): Add to plugin.json `skills` array if not already done
5. **Share**: See `/skills-guide` distribution guidance for publishing options
