# Skill Design Patterns

Workflow architecture patterns, file organization patterns, and advanced features for building effective skills.

Source: Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026), code.claude.com/docs/en/skills

---

## Problem-First vs Tool-First

Think of it like Home Depot. You might walk in with a problem -- "I need to fix a kitchen cabinet" -- and an employee points you to the right tools. Or you might pick out a new drill and ask how to use it for your specific job.

Skills work the same way:

- **Problem-first**: "I need to set up a project workspace" -- Your skill orchestrates the right MCP calls in the right sequence. Users describe outcomes; the skill handles the tools.
- **Tool-first**: "I have Notion MCP connected" -- Your skill teaches Claude the optimal workflows and best practices. Users have access; the skill provides expertise.

Most skills lean one direction. Knowing which framing fits your use case helps you choose the right pattern.

---

## Part 1: Workflow Patterns

These patterns emerged from skills created by early adopters and internal teams at Anthropic. They describe how to design the *logic* inside a skill.

### Pattern 1: Sequential Workflow Orchestration

**Use when**: Users need multi-step processes in a specific order.

```markdown
## Workflow: Onboard New Customer

# Step 1: Create Account
Call MCP tool: `create_customer`
Parameters: name, email, company

# Step 2: Setup Payment
Call MCP tool: `setup_payment_method`
Wait for: payment method verification

# Step 3: Create Subscription
Call MCP tool: `create_subscription`
Parameters: plan_id, customer_id (from Step 1)

# Step 4: Send Welcome Email
Call MCP tool: `send_email`
Template: welcome_email_template
```

Key techniques:
- Explicit step ordering
- Dependencies between steps
- Validation at each stage
- Rollback instructions for failures

### Pattern 2: Multi-MCP Coordination

**Use when**: Workflows span multiple services.

```markdown
## Design-to-Development Handoff

# Phase 1: Design Export (Figma MCP)
1. Export design assets from Figma
2. Generate design specifications
3. Create asset manifest

# Phase 2: Asset Storage (Drive MCP)
1. Create project folder in Drive
2. Upload all assets
3. Generate shareable links

# Phase 3: Task Creation (Linear MCP)
1. Create development tasks
2. Attach asset links to tasks
3. Assign to engineering team

# Phase 4: Notification (Slack MCP)
1. Post handoff summary to #engineering
2. Include asset links and task references
```

Key techniques:
- Clear phase separation
- Data passing between MCPs
- Validation before moving to next phase
- Centralized error handling

### Pattern 3: Iterative Refinement

**Use when**: Output quality improves with iteration.

```markdown
## Iterative Report Creation

# Initial Draft
1. Fetch data via MCP
2. Generate first draft report
3. Save to temporary file

# Quality Check
1. Run validation script: `scripts/check_report.py`
2. Identify issues:
   - Missing sections
   - Inconsistent formatting
   - Data validation errors

# Refinement Loop
1. Address each identified issue
2. Regenerate affected sections
3. Re-validate
4. Repeat until quality threshold met

# Finalization
1. Apply final formatting
2. Generate summary
3. Save final version
```

Key techniques:
- Explicit quality criteria
- Iterative improvement
- Validation scripts
- Know when to stop iterating

### Pattern 4: Context-Aware Tool Selection

**Use when**: Same outcome, different tools depending on context.

```markdown
## Smart File Storage

# Decision Tree
1. Check file type and size
2. Determine best storage location:
   - Large files (>10MB): Use cloud storage MCP
   - Collaborative docs: Use Notion/Docs MCP
   - Code files: Use GitHub MCP
   - Temporary files: Use local storage

# Execute Storage
Based on decision:
- Call appropriate MCP tool
- Apply service-specific metadata
- Generate access link

# Provide Context to User
Explain why that storage was chosen
```

Key techniques:
- Clear decision criteria
- Fallback options
- Transparency about choices

### Pattern 5: Domain-Specific Intelligence

**Use when**: Your skill adds specialized knowledge beyond tool access.

```markdown
## Payment Processing with Compliance

# Before Processing (Compliance Check)
1. Fetch transaction details via MCP
2. Apply compliance rules:
   - Check sanctions lists
   - Verify jurisdiction allowances
   - Assess risk level
3. Document compliance decision

# Processing
IF compliance passed:
- Call payment processing MCP tool
- Apply appropriate fraud checks
- Process transaction
ELSE:
- Flag for review
- Create compliance case

# Audit Trail
- Log all compliance checks
- Record processing decisions
- Generate audit report
```

Key techniques:
- Domain expertise embedded in logic
- Compliance before action
- Comprehensive documentation
- Clear governance

---

## Part 2: File Organization Patterns

These patterns describe how to *structure files* within a skill for efficient context loading.

### High-Level Guide with References

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

### Domain-Specific Organization

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

When a user asks about sales metrics, Claude only reads sales.md. Also works for multi-framework skills (aws.md, gcp.md, azure.md).

### Conditional Details

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

### Template and Example

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

## Part 3: Advanced Features

Claude Code-specific mechanics that extend skill capabilities.

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

**Advanced technique**: For critical validations, bundle a script that performs checks programmatically rather than relying on language instructions. Code is deterministic; language interpretation isn't.

### Visual Output

Generate interactive HTML files that open in the browser.

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

### Workflow logic (what the skill does)

| Situation | Pattern |
|-----------|---------|
| Multi-step process in specific order | Sequential workflow orchestration |
| Workflow spans multiple services | Multi-MCP coordination |
| Output improves with iteration | Iterative refinement |
| Same outcome, different tools by context | Context-aware tool selection |
| Specialized knowledge beyond tool access | Domain-specific intelligence |

### File organization (how to structure files)

| Situation | Pattern |
|-----------|---------|
| Simple guidelines or conventions | Single SKILL.md, no references |
| Multiple related domains or frameworks | Domain-specific organization |
| Basic + advanced features | Conditional details |
| Specific output format | Template and example |
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
| Instructions too verbose | Claude ignores buried details | Use bullets, numbered lists, move detail to references |
| Ambiguous validation language | Inconsistent behavior | Use scripts for critical checks instead of prose |
