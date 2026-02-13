# Authoring Skills

Writing effective skills: creation process, design principles, degrees of freedom, writing guidelines, and what to avoid.

Source: Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026), code.claude.com/docs/en/skills

---

## Core Principles

### Concise is Key

The context window is a public good. Skills share it with the system prompt, conversation history, other skills' metadata, and the user request.

**Default assumption: Claude is already very smart.** Only add context Claude doesn't already have. Challenge each piece of information: "Does Claude really need this explanation?" and "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### Set Appropriate Degrees of Freedom

Match specificity to the task's fragility and variability:

| Freedom Level | When to Use | Format |
|--------------|-------------|--------|
| **High** (text instructions) | Multiple approaches valid, decisions depend on context, heuristics guide approach | Prose guidelines |
| **Medium** (pseudocode/parameterized scripts) | Preferred pattern exists, some variation acceptable, configuration affects behavior | Pseudocode or scripts with parameters |
| **Low** (specific scripts, few parameters) | Operations are fragile/error-prone, consistency is critical, specific sequence required | Exact scripts with minimal parameters |

Think of Claude as exploring a path: a narrow bridge with cliffs needs specific guardrails (low freedom), while an open field allows many routes (high freedom).

---

## Skill Types by Content

### Reference Skills

Add knowledge Claude applies to current work. Conventions, patterns, style guides, domain knowledge. Run inline alongside conversation context.

```yaml
---
name: api-conventions
description: API design patterns for this codebase
---

When writing API endpoints:
- Use RESTful naming conventions
- Return consistent error formats
- Include request validation
```

### Task Skills

Step-by-step instructions for specific actions. Often invoked directly with /skill-name rather than auto-triggered. Add `disable-model-invocation: true` for side-effect workflows.

```yaml
---
name: deploy
description: Deploy the application to production
context: fork
disable-model-invocation: true
---

Deploy the application:
1. Run the test suite
2. Build the application
3. Push to the deployment target
```

---

## Creation Process

### Step 1: Understand with Concrete Examples

Understand concrete examples of how the skill will be used. Relevant questions:
- What functionality should the skill support?
- Can you give examples of how it would be used?
- What would a user say that should trigger this skill?

Conclude when you have a clear sense of the functionality.

### Step 2: Plan Reusable Contents

For each concrete example, analyze:
1. How would you execute this from scratch?
2. What scripts, references, and assets would help when doing this repeatedly?

**Examples**:
- Rotating PDFs repeatedly -> `scripts/rotate_pdf.py`
- Building frontend apps with same boilerplate -> `assets/hello-world/`
- Querying BigQuery tables -> `references/schema.md`

### Step 3: Initialize the Skill

Create the directory structure:

```bash
mkdir -p ~/.claude/skills/my-skill
```

Or for project skills:

```bash
mkdir -p .claude/skills/my-skill
```

### Step 4: Write the Skill

Remember: the skill is being created for another instance of Claude to use. Include information that would be beneficial and non-obvious.

#### Write the Frontmatter

- `name`: The skill name (becomes /slash-command)
- `description`: Primary triggering mechanism. Include BOTH what + when. All "when to use" info goes here, not in body

**Description example**:
```yaml
description: >
  Comprehensive document creation, editing, and analysis with support for
  tracked changes, comments, and formatting. Use when Claude needs to work
  with .docx files for creating, modifying, or extracting content.
```

#### Write the Body

Use imperative/infinitive form. The body contains:
- Instructions and guidance for using the skill
- References to bundled resources with clear descriptions of when to read them
- Workflow steps if applicable

### Step 5: Test the Skill

Test the skill two ways:
1. **Auto-trigger**: Ask something matching the description
2. **Direct invoke**: Type /skill-name

For skills with scripts, test scripts by running them to ensure no bugs and that output matches expectations.

### Step 6: Iterate

1. Use the skill on real tasks
2. Notice struggles or inefficiencies
3. Update SKILL.md or bundled resources
4. Test again

---

## Writing Guidelines

### Description Rules

- Include what the skill does AND specific triggers/contexts for when to use it
- Put all "when to use" information in the description, NOT the body
- Be specific: "Creates and edits .docx files" not "document utility"
- Include failure-language if relevant: "skill not loading", "debug skill"

### Body Rules

- Use imperative/infinitive form
- Keep under 500 lines / 5,000 words
- Reference bundled files with clear descriptions of when to read them
- Don't duplicate content between SKILL.md and reference files
- Don't add "When to Use This Skill" sections -- that belongs in description

### Naming Rules

- Lowercase letters, numbers, and hyphens only
- Maximum 64 characters
- Name becomes the /slash-command
- If omitted, uses directory name
- Must match folder name for plugins

### What NOT to Create

- README.md, INSTALLATION_GUIDE.md, CHANGELOG.md, QUICK_REFERENCE.md
- Auxiliary context about the creation process
- Setup and testing procedures (for users)
- User-facing documentation

The skill should only contain what an AI agent needs to do the job.

---

## Common Authoring Mistakes

| Mistake | Fix |
|---------|-----|
| Vague description ("helpful utility") | Be specific: what + when |
| Trigger info in body instead of description | Move to description -- body loads AFTER trigger |
| SKILL.md over 500 lines | Split into reference files |
| Duplicate content in SKILL.md and references | Single source of truth in one place |
| Too much explanation Claude already knows | Only add what's non-obvious to Claude |
| Missing reference file links | Always reference files from SKILL.md with when-to-read guidance |
| Deeply nested references | Keep one level deep from SKILL.md |
