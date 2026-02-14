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

## Planning: Start with Use Cases

Before writing any code, identify 2-3 concrete use cases. Use this format:

```
Use Case: Project Sprint Planning
Trigger: User says "help me plan this sprint" or "create sprint tasks"
Steps:
1. Fetch current project status from Linear (via MCP)
2. Analyze team velocity and capacity
3. Suggest task prioritization
4. Create tasks in Linear with proper labels and estimates
Result: Fully planned sprint with tasks created
```

Ask yourself:
- What does a user want to accomplish?
- What multi-step workflows does this require?
- Which tools are needed (built-in or MCP)?
- What domain knowledge or best practices should be embedded?

### Three Common Skill Categories

Observed by Anthropic across real-world usage:

**Category 1: Document & Asset Creation** -- Creating consistent, high-quality output (documents, presentations, apps, designs, code). Key techniques: embedded style guides, template structures, quality checklists. No external tools required -- uses Claude's built-in capabilities.

**Category 2: Workflow Automation** -- Multi-step processes that benefit from consistent methodology, including coordination across multiple MCP servers. Key techniques: step-by-step workflow with validation gates, templates for common structures, iterative refinement loops.

**Category 3: MCP Enhancement** -- Workflow guidance to enhance the tool access an MCP server provides. Key techniques: coordinates multiple MCP calls in sequence, embeds domain expertise, provides context users would otherwise need to specify, error handling for common MCP issues.

### Define Success Criteria

These are aspirational targets -- rough benchmarks rather than precise thresholds.

**Quantitative**:
- Skill triggers on ~90% of relevant queries (test with 10-20 queries that should trigger it)
- Completes workflow in expected tool call count (compare with and without skill)
- Zero failed API calls per workflow (monitor MCP server logs during test runs)

**Qualitative**:
- Users don't need to prompt Claude about next steps
- Workflows complete without user correction
- Consistent results across sessions (new user can accomplish task on first try)

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

Use imperative/infinitive form. Adapt this recommended structure for your skill:

````markdown
---
name: your-skill
description: [What + When]
---

# Your Skill Name

## Instructions
[Core instructions]

# Step 1: [First Major Step]
Clear explanation of what happens.

Example:
```bash
python scripts/fetch_data.py --project-id PROJECT_ID
```

Expected output: [describe what success looks like]

(Add more steps as needed)

## Examples

### Example 1: [common scenario]
User says: "Set up a new marketing campaign"
Actions:
1. Fetch existing campaigns via MCP
2. Create new campaign with provided parameters
Result: Campaign created with confirmation link

(Add more examples as needed)

## Troubleshooting

### Error: [Common error message]
Cause: [Why it happens]
Solution: [How to fix]

(Add more error cases as needed)
````

### Step 5: Test the Skill

Choose the approach that matches your quality requirements:

| Approach | When to Use |
|----------|------------|
| **Manual testing in Claude.ai** | Fast iteration, no setup required. Run queries and observe |
| **Scripted testing in Claude Code** | Repeatable validation across changes |
| **Programmatic testing via skills API** | Systematic evaluation suites against defined test sets |

**Pro tip**: Iterate on a single challenging task until Claude succeeds, then extract the winning approach into a skill. This leverages Claude's in-context learning and provides faster signal than broad testing. Once you have a working foundation, expand to multiple test cases.

#### 1. Triggering Tests

Goal: Ensure your skill loads at the right times.

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

Test: run 10-20 queries that should trigger your skill. Track how many times it loads automatically vs requires explicit /invocation.

#### 2. Functional Tests

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

Cover: valid outputs generated, API calls succeed, error handling works, edge cases.

#### 3. Performance Comparison

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

### Step 6: Iterate

Skills are living documents. Plan to iterate based on feedback signals:

**Undertriggering signals** (skill doesn't load when it should):
- Users manually invoking with /name instead of auto-trigger
- Support questions about when to use it
- Fix: Add more trigger phrases and keywords to the description

**Overtriggering signals** (skill loads when it shouldn't):
- Skill loads for irrelevant queries
- Users disabling it
- Fix: Make description more specific, add `disable-model-invocation: true`

**Execution issues** (skill loads but doesn't perform well):
- Inconsistent results across sessions
- API call failures
- Users needing to correct or redirect
- Fix: Improve instructions, add error handling, tighten degrees of freedom

### Using skill-creator for Iteration

The `skill-creator` skill (available in Claude.ai plugin directory or for Claude Code) helps build and iterate:

- **Creating**: Generate skills from natural language descriptions with proper frontmatter
- **Reviewing**: Flag vague descriptions, missing triggers, structural problems
- **Iterating**: Bring edge cases and failures back to skill-creator to improve handling

```
"Use the skill-creator skill to help me build a skill for [your use case]"
```

---

## Best Practices for Instructions

### Reference Bundled Resources Clearly

```markdown
Before writing queries, consult `references/api-patterns.md` for:
- Rate limiting guidance
- Pagination patterns
- Error codes and handling
```

### Be Specific and Actionable

Good:
```markdown
Run `python scripts/validate.py --input {filename}` to check data format.
If validation fails, common issues include:
- Missing required fields (add them to the CSV)
- Invalid date formats (use YYYY-MM-DD)
```

Bad:
```markdown
Validate the data before proceeding.
```

### Use Progressive Disclosure

Keep SKILL.md focused on core instructions. Move detailed documentation to `references/` and link to it. See fundamentals.md for how the three-level loading system works.

### Include Error Handling

```markdown
## Common Issues

### MCP Connection Failed
If you see "Connection refused":
1. Verify MCP server is running: Check Settings > Extensions
2. Confirm API key is valid
3. Try reconnecting: Settings > Extensions > [Your Service] > Reconnect
```

---

## Writing Guidelines

### Description Rules

The description is the most important part of the entire skill. Structure: `[What it does] + [When to use it] + [Key capabilities]`

- Under 1024 characters, no XML tags (`<` `>`)
- Include what the skill does AND specific triggers/contexts for when to use it
- Put all "when to use" information in the description, NOT the body
- Include specific tasks users might say
- Mention file types if relevant

**Good descriptions**:
```yaml
# Specific and actionable
description: Analyzes Figma design files and generates developer handoff
  documentation. Use when user uploads .fig files, asks for "design specs",
  "component documentation", or "design-to-code handoff".

# Includes trigger phrases
description: Manages Linear project workflows including sprint planning,
  task creation, and status tracking. Use when user mentions "sprint",
  "Linear tasks", "project planning", or asks to "create tickets".

# Clear value proposition
description: End-to-end customer onboarding workflow for PayFlow. Handles
  account creation, payment setup, and subscription management. Use when
  user says "onboard new customer", "set up subscription", or "create
  PayFlow account".
```

**Bad descriptions**:
```yaml
# Too vague
description: Helps with projects.

# Missing triggers
description: Creates sophisticated multi-page documentation systems.

# Too technical, no user triggers
description: Implements the Project entity model with hierarchical relationships.
```

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
