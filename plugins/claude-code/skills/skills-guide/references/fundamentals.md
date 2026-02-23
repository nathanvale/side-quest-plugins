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
your-skill-name/
├── SKILL.md               # Required - main skill file
├── scripts/               # Optional - executable code
│   ├── process_data.py
│   └── validate.sh
├── references/            # Optional - documentation loaded into context as needed
│   ├── api-guide.md
│   └── examples/
└── assets/                # Optional - templates, files used in output
    └── report-template.md
```

### Critical File/Folder Naming Rules

**SKILL.md naming**:
- Must be exactly `SKILL.md` (case-sensitive)
- No variations accepted (`SKILL.MD`, `skill.md`, `Skill.md` -- all wrong)

**Skill folder naming**:
- Use kebab-case: `notion-project-setup`
- No spaces: `Notion Project Setup` -- wrong
- No underscores: `notion_project_setup` -- wrong
- No capitals: `NotionProjectSetup` -- wrong

### Required: SKILL.md

Every SKILL.md has two parts:
1. **YAML frontmatter** (between `---` markers) -- metadata that tells Claude when to use the skill
2. **Markdown body** -- instructions Claude follows when the skill is invoked

The minimal required format:

```yaml
---
name: your-skill-name
description: What it does. Use when user asks to [specific phrases].
---
```

That's all you need to start.

### Optional: Bundled Resources

**scripts/** -- Executable code (Python, Bash, etc.) for tasks needing deterministic reliability or that get rewritten repeatedly. Token-efficient, may be executed without loading into context.

**references/** -- Documentation loaded into context as needed. For database schemas, API docs, domain knowledge, company policies, detailed workflow guides. Keeps SKILL.md lean. If files are large (>10K words), include grep search patterns in SKILL.md.

**assets/** -- Files used in output, NOT loaded into context. Templates, images, icons, boilerplate code, fonts, sample documents that get copied or modified.

### What NOT to Include

Do not create extraneous documentation or auxiliary files:
- No README.md inside the skill folder (repo-level README for humans is fine -- see distribution.md)
- No INSTALLATION_GUIDE.md
- No QUICK_REFERENCE.md
- No CHANGELOG.md

All documentation goes in SKILL.md or references/. The skill should only contain information needed for an AI agent to do the job.

---

## SKILL.md Frontmatter Reference

The YAML frontmatter is how Claude decides whether to load your skill. Get this right.

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
license: MIT
compatibility: Requires Python 3.10+
metadata:
  author: Your Name
  version: 1.0.0
  mcp-server: your-service
hooks:
  PreToolUse:
    - matcher: "Edit"
      hooks:
        - type: command
          command: "echo 'hook fired'"
---
```

### Required Fields

| Field | Rules |
|-------|-------|
| `name` | kebab-case only. No spaces or capitals. Should match folder name. Max 64 characters. If omitted, uses directory name |
| `description` | MUST include BOTH what the skill does AND when to use it (trigger conditions). Under 1024 characters. No XML tags (`<` or `>`). Include specific tasks users might say. Mention file types if relevant |

### Optional Fields

| Field | Description | Default |
|-------|------------|---------|
| `argument-hint` | Hint shown during autocomplete. Example: `[filename] [format]` | -- |
| `disable-model-invocation` | `true` prevents Claude from auto-loading. Use for workflows you control timing on: /commit, /deploy | `false` |
| `user-invocable` | `false` hides from / menu. Use for background knowledge users shouldn't invoke directly | `true` |
| `allowed-tools` | Tools Claude can use without permission when skill active | -- |
| `model` | Model override when skill active | inherited |
| `context` | Set to `fork` to run in isolated subagent context | inline |
| `agent` | Subagent type when context: fork. Options: Explore, Plan, general-purpose, or custom agent name | general-purpose |
| `hooks` | Hooks scoped to skill lifecycle. Same format as settings.json hooks | -- |
| `license` | Use if making skill open source. Common: MIT, Apache-2.0 | -- |
| `compatibility` | Environment requirements (1-500 chars): intended product, required system packages, network access needs | -- |
| `metadata` | Custom key-value pairs. Suggested keys: author, version, mcp-server | -- |

### Security Restrictions

Forbidden in frontmatter:
- **XML angle brackets** (`<` `>`) -- frontmatter appears in Claude's system prompt; malicious content could inject instructions
- **"claude" or "anthropic" in the name** -- these are reserved names

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

Skill descriptions share a character budget that scales dynamically at **2% of the context window**, with a **16,000-character fallback** when the window size can't be determined. If you have many skills, some may be excluded. Run `/context` to check for warnings about excluded skills.

Override the limit:

```bash
export SLASH_COMMAND_TOOL_CHAR_BUDGET=32000
```

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

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Vague description ("helpful utility") | Skill never triggers | Be specific: what it does AND when to use it |
| Trigger phrases in body instead of description | Skill doesn't auto-load | Move all trigger language into the `description` field |
| Wrong SKILL.md casing (`skill.md`, `SKILL.MD`) | Skill not discovered | Must be exactly `SKILL.md` |
| Spaces or capitals in folder name | Skill not discovered | Use kebab-case: `my-skill-name` |
| Missing `---` YAML markers | Frontmatter silently ignored | Ensure exactly two `---` lines wrap the YAML block |
| XML angle brackets in frontmatter | Security rejection | Remove all `<` and `>` from frontmatter values |
| Description over 1024 characters | Truncation or exclusion | Shorten description; move detail to the body |
| Deeply nested references (`references/sub/sub/`) | Files not found | Keep references one level deep from SKILL.md |

---

## Avoid Duplication

Information should live in either SKILL.md or reference files, not both. Prefer reference files for detailed information -- this keeps SKILL.md lean while making information discoverable without consuming the context window. Keep only essential procedural instructions and workflow guidance in SKILL.md; move detailed reference material, schemas, and examples to reference files.
