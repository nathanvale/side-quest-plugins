# Skills Fundamentals

What skills are, how they work, folder structure, SKILL.md format, frontmatter fields, and progressive disclosure.

Source: Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026), code.claude.com/docs/en/skills

---

## What Skills Are

Skills are organized folders of instructions, scripts, and resources that Claude can discover and load dynamically. They transform Claude from a general-purpose agent into a specialized one through composable, reusable capabilities.

Skills work across Claude.ai, Claude Code, Claude Agent SDK, and the Claude Developer Platform. Claude Code extends the Agent Skills open standard (agentskills.io) with additional features: invocation control, subagent execution, and dynamic context injection.

**Key characteristic**: Selective loading. Claude only accesses a skill when it's relevant to the task at hand.

**Four defining attributes**:
1. **Composable** -- Multiple skills work together automatically
2. **Portable** -- Consistent format across all Claude products
3. **Efficient** -- Loads minimal necessary information
4. **Powerful** -- Includes executable code for reliable task execution

---

## Skill Anatomy

Every skill is a directory with SKILL.md as the entrypoint:

```
skill-name/
├── SKILL.md           # Main instructions (required)
├── references/        # Docs loaded into context as needed (optional)
│   ├── api-docs.md
│   └── schemas.md
├── scripts/           # Executable code (optional)
│   └── validate.sh
└── assets/            # Files used in output, not loaded into context (optional)
    └── template.html
```

### Required: SKILL.md

Every SKILL.md has two parts:
1. **YAML frontmatter** (between `---` markers) -- metadata that tells Claude when to use the skill
2. **Markdown body** -- instructions Claude follows when the skill is invoked

### Optional: Bundled Resources

**scripts/** -- Executable code (Python, Bash, etc.) for tasks needing deterministic reliability or that get rewritten repeatedly. Token-efficient, may be executed without loading into context.

**references/** -- Documentation loaded into context as needed. For database schemas, API docs, domain knowledge, company policies, detailed workflow guides. Keeps SKILL.md lean. If files are large (>10K words), include grep search patterns in SKILL.md.

**assets/** -- Files used in output, NOT loaded into context. Templates, images, icons, boilerplate code, fonts, sample documents that get copied or modified.

### What NOT to Include

Do not create extraneous documentation or auxiliary files:
- No README.md
- No INSTALLATION_GUIDE.md
- No QUICK_REFERENCE.md
- No CHANGELOG.md

A skill should only contain information needed for an AI agent to do the job.

---

## SKILL.md Frontmatter Reference

All fields are optional. Only `description` is recommended so Claude knows when to use the skill.

```yaml
---
name: my-skill
description: What this skill does and when to use it
argument-hint: "[issue-number]"
disable-model-invocation: true
user-invocable: false
allowed-tools: Read, Grep, Glob
model: sonnet
context: fork
agent: Explore
hooks:
  PreToolUse:
    - matcher: "Edit"
      hooks:
        - type: command
          command: "echo 'hook fired'"
---
```

### Field Reference

| Field | Description | Default |
|-------|------------|---------|
| `name` | Display name and /slash-command. Lowercase letters, numbers, hyphens only. Max 64 characters. If omitted, uses directory name | directory name |
| `description` | What the skill does AND when to use it. Claude's primary trigger signal. If omitted, uses first paragraph of body | -- |
| `argument-hint` | Hint shown during autocomplete. Example: `[filename] [format]` | -- |
| `disable-model-invocation` | `true` prevents Claude from auto-loading. Use for workflows you control timing on: /commit, /deploy | `false` |
| `user-invocable` | `false` hides from / menu. Use for background knowledge users shouldn't invoke directly | `true` |
| `allowed-tools` | Tools Claude can use without permission when skill active | -- |
| `model` | Model override when skill active | inherited |
| `context` | Set to `fork` to run in isolated subagent context | inline |
| `agent` | Subagent type when context: fork. Options: Explore, Plan, general-purpose, or custom agent name | general-purpose |
| `hooks` | Hooks scoped to skill lifecycle. Same format as settings.json hooks | -- |

### Invocation Control Matrix

| Frontmatter | You Can Invoke | Claude Can Invoke | When Loaded |
|-------------|---------------|-------------------|-------------|
| (default) | Yes | Yes | Description always in context; full skill on invoke |
| `disable-model-invocation: true` | Yes | No | Description NOT in context; loads when you invoke |
| `user-invocable: false` | No | Yes | Description always in context; loads when invoked |

### String Substitutions

Skills support dynamic values in content:

| Variable | Description |
|----------|------------|
| `$ARGUMENTS` | All arguments passed when invoking. If not present in content, appended as `ARGUMENTS: <value>` |
| `$ARGUMENTS[N]` or `$N` | Specific argument by 0-based index |
| `${CLAUDE_SESSION_ID}` | Current session ID |

---

## Progressive Disclosure

Skills use a three-level loading system to manage context efficiently:

1. **Level 1: Metadata** (name + description) -- Always in context (~100 words)
2. **Level 2: SKILL.md body** -- Loaded when skill triggers (keep under 5,000 words / 500 lines)
3. **Level 3: Bundled resources** -- Loaded as needed by Claude (unlimited -- scripts can execute without reading into context)

### Context Budget

Skill descriptions share a character budget: 2% of the context window, with a 16,000-character fallback. If you have many skills, some may be excluded. Run `/context` to check for warnings about excluded skills.

Override the limit with the `SLASH_COMMAND_TOOL_CHAR_BUDGET` environment variable.

### Key Principle

Keep SKILL.md body to the essentials and under 500 lines. When approaching this limit, split content into separate reference files. Always reference split-out files from SKILL.md with clear descriptions of when to read them.

Avoid deeply nested references -- keep all references one level deep from SKILL.md. For reference files over 100 lines, include a table of contents at the top.

---

## Description Writing Rules

The description is the most important field. It is the primary triggering mechanism.

**Include both what the skill does AND when to use it**:
- Good: "Comprehensive document creation and editing. Use when Claude needs to work with .docx files for creating, modifying, or extracting content."
- Bad: "Helpful document utility"

**Put all trigger information in the description, not the body**. The body only loads AFTER triggering, so "When to Use This Skill" sections in the body do not help Claude decide to invoke.

**Include failure-language triggers** for troubleshooting skills: "my skill isn't loading", "not triggering", "broken".

---

## Avoid Duplication

Information should live in either SKILL.md or reference files, not both. Prefer reference files for detailed information -- this keeps SKILL.md lean while making information discoverable without consuming the context window. Keep only essential procedural instructions and workflow guidance in SKILL.md; move detailed reference material, schemas, and examples to reference files.
