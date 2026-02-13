# Skill Design Patterns

Progressive disclosure patterns, advanced features, and architectural approaches for building effective skills.

Source: Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026), code.claude.com/docs/en/skills

---

## Progressive Disclosure Patterns

These patterns manage context efficiently by keeping SKILL.md focused and loading detail on demand.

### Pattern 1: High-Level Guide with References

Core workflow in SKILL.md, detailed content in separate files.

```markdown
# PDF Processing

## Quick start
Extract text with pdfplumber:
[code example]

## Advanced features
- **Form filling**: See [FORMS.md](FORMS.md) for complete guide
- **API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
- **Examples**: See [EXAMPLES.md](EXAMPLES.md) for common patterns
```

Claude loads FORMS.md, REFERENCE.md, or EXAMPLES.md only when needed.

### Pattern 2: Domain-Specific Organization

For skills with multiple domains, organize by domain to avoid loading irrelevant context:

```
bigquery-skill/
├── SKILL.md (overview and navigation)
└── references/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    ├── product.md (API usage, features)
    └── marketing.md (campaigns, attribution)
```

When a user asks about sales metrics, Claude only reads sales.md.

Also works for multi-framework skills:

```
cloud-deploy/
├── SKILL.md (workflow + provider selection)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

### Pattern 3: Conditional Details

Show basic content, link to advanced content:

```markdown
# DOCX Processing

## Creating documents
Use docx-js for new documents. See [DOCX-JS.md](DOCX-JS.md).

## Editing documents
For simple edits, modify the XML directly.

**For tracked changes**: See [REDLINING.md](REDLINING.md)
**For OOXML details**: See [OOXML.md](OOXML.md)
```

Claude reads REDLINING.md or OOXML.md only when the user needs those features.

### Pattern 4: Workflow with Steps (from Anthropic references)

Multi-step processes with sequential workflows and conditional logic:

```markdown
# Deploy Skill

## Workflow
1. Run tests: `bun test`
2. Build: `bun run build`
3. If staging: deploy to staging first
4. If production: require approval, then deploy
5. Verify deployment health
```

### Pattern 5: Template and Example Pattern (from Anthropic references)

For skills that produce specific output formats or quality standards:

```
report-generator/
├── SKILL.md (generation workflow)
├── references/
│   └── output-patterns.md (format specs)
└── assets/
    └── template.html (output template)
```

---

## Advanced Features

### Dynamic Context Injection

The `` !`command` `` syntax runs shell commands BEFORE skill content is sent to Claude. Output replaces the placeholder.

```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---

## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`
- Changed files: !`gh pr diff --name-only`

## Your task
Summarize this pull request...
```

When the skill runs:
1. Each `` !`command` `` executes immediately (before Claude sees anything)
2. Output replaces the placeholder
3. Claude receives the fully-rendered prompt with actual data

This is preprocessing, not something Claude executes.

### Subagent Execution (context: fork)

Add `context: fork` to run a skill in isolation. The skill content becomes the prompt driving the subagent. It won't have access to conversation history.

```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly:
1. Find relevant files using Glob and Grep
2. Read and analyze the code
3. Summarize findings with specific file references
```

When this runs:
1. A new isolated context is created
2. The subagent receives skill content as its prompt
3. The `agent` field determines execution environment (model, tools, permissions)
4. Results are summarized and returned to main conversation

**Warning**: `context: fork` only makes sense for skills with explicit instructions. If your skill contains guidelines without a task, the subagent receives guidelines but no actionable prompt and returns without meaningful output.

### How Skills and Subagents Relate

| Approach | System Prompt | Task | Also Loads |
|----------|--------------|------|------------|
| Skill with `context: fork` | From agent type (Explore, Plan, etc.) | SKILL.md content | CLAUDE.md |
| Subagent with `skills` field | Subagent's markdown body | Claude's delegation message | Preloaded skills + CLAUDE.md |

### Code Execution

Skills can include executable scripts that Claude runs as tools:
- Deterministic operations (sorting, parsing)
- Efficient execution vs token-based alternatives
- Consistent, repeatable workflows
- Dual-purpose: executable tool AND reference documentation

### Visual Output Pattern

Generate interactive HTML files that open in the browser. Example: codebase explorer with collapsible tree, file sizes, color-coded types.

```
codebase-visualizer/
├── SKILL.md (orchestration instructions)
└── scripts/
    └── visualize.py (generates HTML output)
```

The bundled script does heavy lifting, Claude handles orchestration. Works for: dependency graphs, test coverage reports, API documentation, database schema visualizations.

### Extended Thinking

Include "ultrathink" anywhere in skill content to enable extended thinking mode.

---

## Choosing the Right Pattern

| Situation | Recommended Pattern |
|-----------|-------------------|
| Simple guidelines or conventions | Single SKILL.md, no references needed |
| Multiple related domains | Pattern 2: Domain-specific organization |
| Basic + advanced features | Pattern 3: Conditional details |
| Multi-step workflow | Pattern 4: Workflow with steps |
| Specific output format | Pattern 5: Template and example |
| External data needed at invoke time | Dynamic context injection |
| Heavy computation or visual output | Code execution with scripts/ |
| Need isolation from conversation | Subagent execution (context: fork) |

---

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|-------------|-------------|-----|
| Overlong SKILL.md (>500 lines) | Wastes context window on every invocation | Split into reference files |
| Vague descriptions | Claude can't trigger correctly | Include what + when + trigger phrases |
| Reference files referencing other references | Creates confusion, hard to navigate | Keep one level deep |
| Scripts without testing | Silent failures in production | Test scripts by running them |
| Loading all references unconditionally | Wastes context | Load only what's needed per query |
| context: fork without a task | Subagent has no actionable prompt | Only use fork for explicit instructions |
