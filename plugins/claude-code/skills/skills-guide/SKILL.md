---
name: skills-guide
description: >
  Knowledge bank for building Claude Code skills -- skill anatomy, SKILL.md authoring,
  frontmatter fields, progressive disclosure, design patterns, distribution, and troubleshooting.
  Triggers on: build a skill, create a skill, write a skill, SKILL.md, skill frontmatter,
  what goes in SKILL.md, skill not loading, my skill isn't working, skill not triggering,
  get started with skills, how do skills work, skill structure, skill folder,
  skill description, skill name, allowed-tools, disable-model-invocation, user-invocable,
  argument-hint, context fork, skill subagent, progressive disclosure, reference files,
  bundled resources, skill patterns, distribute skill, share skill, publish skill,
  install skill, personal skill, project skill, plugin skill, enterprise skill,
  skill-creator, skill conventions, skill best practices, what is a skill,
  local vs project skill, skill testing, skill debugging.
allowed-tools: Read, Glob, Grep, Skill(last-30-days *)
---

# Claude Code Skills Guide -- Knowledge Bank

Authoritative guidance for building Claude Code skills, extracted from Anthropic's official documentation. This skill covers skill anatomy, authoring, design patterns, distribution, and troubleshooting.

## Source Authority

This skill draws from:
- Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026)
- Official Claude Code documentation at code.claude.com/docs/en/skills
- Agent Skills open standard at agentskills.io

Reference files are the primary source. Community intel is opt-in via `/research:last-30-days` -- see Community Perspective below.

## Community Perspective (Opt-In)

This skill does NOT maintain a community intel cache. Instead, it can hand off to `/research:last-30-days` for live community signal when the user wants inspiration or real-world examples.

**Auto-detect these signals** -- if the user's question contains any of these, offer to run community research:
- "what are people building", "what are people doing with skills"
- "has anyone", "examples in the wild", "inspiration"
- "community", "Reddit", "what's trending"
- "real-world examples", "how are others using"
- "best skills", "popular skills", "cool skills"

**When detected**:
1. Answer from reference files first (the official answer)
2. Then invoke `/research:last-30-days` with a tailored query like: `"Claude Code skills" OR "SKILL.md" OR "claude skills examples"`
3. Present both: "Here's what the docs say" followed by "Here's what the community is doing"

**Do NOT auto-invoke research** for standard doc questions like "what goes in SKILL.md" or "how do I distribute a skill." Only when the user is explicitly asking for community perspective or inspiration.

## Cross-Skill Boundaries

Questions may overlap with sibling skills. Apply these precedence rules:

| Query Signal | Routes To | NOT To |
|-------------|-----------|--------|
| "hooks in my skill", "skill hook lifecycle" | **hooks** (hook mechanics are hooks domain) | skills-guide |
| "what goes in SKILL.md", "skill frontmatter" | **skills-guide** (skill authoring is skills-guide domain) | hooks |
| "how do I add hooks to my skill?" | **hooks** first, then link to skills-guide for `hooks:` frontmatter field | skills-guide |
| "hooks.json in a plugin" | **hooks** (plugin hook registration) | skills-guide |
| "skill folder structure", "where to put files" | **skills-guide** (skill anatomy) | hooks |
| "plugin structure", "plugin.json" | **skills-guide** (distribution) | hooks |

**Rule**: If the question is about hook behavior/configuration, route to hooks. If it's about skill structure/authoring/distribution, route here. When ambiguous, answer the skills-guide portion and explicitly link to `/hooks` for the hook-specific part.

## Step 1: Classify the Question

Parse the user's question into one or more intent categories. If a question spans multiple categories, identify the primary intent and address it first, then connect to secondary categories.

| Intent | Trigger Signals | Reference File |
|--------|----------------|----------------|
| **Getting Started** | get started, what is a skill, how do skills work, first skill, simplest skill, new to skills, skill basics | [fundamentals.md](references/fundamentals.md) |
| **Skill Structure** | SKILL.md, frontmatter, folder structure, anatomy, progressive disclosure, reference files, bundled resources, scripts directory, what goes in | [fundamentals.md](references/fundamentals.md) |
| **Authoring** | write a skill, create a skill, build a skill, skill description, skill name, naming rules, writing guidelines, degrees of freedom, how to write, content strategy | [authoring.md](references/authoring.md) |
| **Design Patterns** | pattern, advanced, dynamic context, subagent, context fork, code execution, visual output, multiple frameworks, domain-specific, conditional | [patterns.md](references/patterns.md) |
| **Distribution** | share, distribute, publish, install, personal vs project, where to put, plugin skill, enterprise, managed settings, local skill, monorepo | [distribution.md](references/distribution.md) |
| **Testing** | test skill, smoke test, validate skill, triggering test, does it trigger, iteration, undertriggering, overtriggering, skill-creator review | [testing.md](references/testing.md) |
| **Troubleshooting** | not loading, not triggering, isn't working, broken, debug, error, triggers too often, too many skills, context budget, skill not found | [troubleshooting.md](references/troubleshooting.md) |
| **MCP Builders** | MCP server, MCP skill, connector, integration, skill on top of MCP, MCP workflow, MCP enhancement, tool access | [mcp-builders.md](references/mcp-builders.md) |

## Step 2: Read Reference Files

Read the relevant reference file(s) based on the classification. For multi-intent questions, read all relevant files.

## Step 3: Synthesize Answer

### Response Structure

Every response should follow this structure:

1. **Direct answer** -- one-line answer, no preamble
2. **Minimal template or example** -- copy-paste ready SKILL.md snippet, folder structure, or config
3. **Why it works** -- brief explanation of the design decision
4. **Verify step** -- how to test that it's working ("invoke with /name", "ask Claude about X")
5. **Common failure** -- what goes wrong and how to fix it
6. **Source** -- reference file cited

### For Getting Started Questions

1. Show the simplest possible skill (3-line frontmatter + 3-line body)
2. Show where to put it (`~/.claude/skills/` for personal)
3. Show how to test it (invoke directly, then test auto-trigger)
4. Link to authoring.md for next steps

### For Structure/Frontmatter Questions

1. Show the exact YAML field and its purpose
2. Show a minimal example with the field in context
3. Note any constraints (max 64 chars for name, description as primary trigger)
4. Cross-reference related fields

### For Authoring Questions

1. Provide the skill creation workflow steps
2. Show writing guidelines with examples
3. Explain degrees of freedom (high/medium/low)
4. Note what NOT to include (README, CHANGELOG, etc.)

### For Pattern Questions

1. Show the complete pattern with folder structure
2. Provide a working SKILL.md example
3. Explain when to use this pattern vs alternatives
4. Include any gotchas specific to the pattern

### For Distribution Questions

1. Show the location table (personal/project/plugin/enterprise)
2. Explain precedence rules
3. Provide the relevant folder structure
4. Note namespace behavior for plugin skills

### For Troubleshooting Questions

1. Match symptoms to the quick-reference table
2. Provide debug steps in order of likelihood
3. Include exact commands to verify state
4. Note context budget limits if relevant

## Response Guidelines

- **Always cite the reference file** you draw from
- **Provide copy-paste SKILL.md snippets** -- users should be able to use them immediately
- **Show folder structures** -- ASCII tree format for skill directories
- **Be direct** -- answer first, then context
- **Tables for comparisons** -- frontmatter fields, skill locations, invocation modes
- **Warn about common mistakes** -- overly broad descriptions, missing triggers, context bloat
- **Link to sibling skills** when the question crosses boundaries

## Examples

### Example 1: Getting Started

```text
User: How do I get started with skills?

Skill: [Reads fundamentals.md]

A skill is a folder with a SKILL.md file. Here's the simplest working skill:

1. Create the directory:
   mkdir -p ~/.claude/skills/my-skill

2. Create ~/.claude/skills/my-skill/SKILL.md:
   ---
   name: my-skill
   description: Does X when you ask about Y
   ---
   When the user asks about Y, do X.

3. Test it: open Claude Code and type /my-skill or ask about Y.

The description field is how Claude decides when to use your skill.
Put trigger phrases and use cases there, not in the body.

**Common mistake:** Writing a vague description like "helpful utility."
Be specific: what it does AND when to use it.

Source: fundamentals.md
```

### Example 2: Frontmatter Question

```text
User: What frontmatter fields can I use in SKILL.md?

Skill: [Reads fundamentals.md]

All fields are optional. Only description is recommended.

| Field | Purpose |
|-------|---------|
| name | Display name and /slash-command. Max 64 chars, lowercase + hyphens only |
| description | What + when. Claude's primary trigger signal |
| argument-hint | Autocomplete hint, e.g. [issue-number] |
| disable-model-invocation | true = only you can invoke via /name |
| user-invocable | false = hidden from / menu, only Claude invokes |
| allowed-tools | Tools permitted without approval when skill active |
| model | Model override when skill active |
| context | "fork" to run in isolated subagent |
| agent | Subagent type when context: fork (Explore, Plan, etc.) |
| hooks | Hooks scoped to skill lifecycle |

The description is the most important field. Include both what the
skill does and specific triggers for when to use it.

Source: fundamentals.md
```

### Example 3: Troubleshooting

```text
User: My skill isn't loading

Skill: [Reads troubleshooting.md]

Common causes in order of likelihood:

1. **Description doesn't match** -- Claude triggers skills by matching
   your question to skill descriptions. Check your description includes
   keywords users would naturally say.

2. **Wrong location** -- Verify the file is at one of:
   - ~/.claude/skills/<name>/SKILL.md (personal)
   - .claude/skills/<name>/SKILL.md (project)
   Check: ask "What skills are available?"

3. **Too many skills** -- Descriptions share a context budget
   (2% of window, ~16K chars fallback). Run /context to check
   for excluded skills.

4. **Syntax error in frontmatter** -- YAML must be between --- markers.
   Try invoking directly with /skill-name to isolate the issue.

Source: troubleshooting.md
```

### Example 4: Community Perspective

```text
User: What are people building with skills? Any cool examples?

Skill: [Detects community signal -> "what are people building"]
Skill: [Reads patterns.md for official patterns first]

Here's what the official docs cover for skill patterns:
[brief summary of the 5 patterns from patterns.md]

Let me check what the community is building...

Skill: [Invokes /research:last-30-days "Claude Code skills examples creative patterns"]

From the community (last 30 days):
[research results with engagement metrics]
```

### Example 5: Cross-Skill Boundary

```text
User: How do I add hooks to my skill?

Skill: [Detects cross-skill boundary -> hooks domain]

Hook configuration in skills is the /hooks domain. Here's the quick answer:

Add a hooks field to your SKILL.md frontmatter:
  ---
  name: my-skill
  hooks:
    PreToolUse:
      - matcher: "Edit"
        hooks:
          - type: command
            command: "echo 'hook fired'"
  ---

These hooks are scoped to the skill's lifecycle -- they only fire
while the skill is active.

For full hook configuration, event types, and decision control,
ask /hooks about hook types and configuration.

**Known issue:** Plugin skill frontmatter hooks are silently ignored
(claude-code#17688). For plugin skills, use hooks/hooks.json instead.

Sources: fundamentals.md (frontmatter field), hooks skill (hook mechanics)
```
