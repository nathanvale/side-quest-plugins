# Patterns and Best Practices

When to use sub-agents, common patterns, decision matrices, and official guidance.

Source: code.claude.com/docs/en/sub-agents, code.claude.com/docs/en/best-practices, code.claude.com/docs/en/features-overview

---

## Decision Matrix: When to Use What

### Main Conversation

Use when:
- Frequent back-and-forth or iterative refinement
- Multiple phases share significant context (planning -> implementation -> testing)
- Quick, targeted changes
- Latency matters (sub-agents start fresh and may need time to gather context)

### Sub-agents

Use when:
- Task produces verbose output you don't need in main context (tests, logs, docs)
- You want to enforce specific tool restrictions or permissions
- Work is self-contained and can return a summary
- You need parallel research on independent topics

### Agent Teams

Use when:
- Research/review needing parallel exploration from different angles
- New modules where workers won't step on each other's files
- Debugging with competing hypotheses
- Cross-layer coordination (frontend + backend + tests)

### Skills

Use when:
- Reusable prompts that run in main conversation context
- Reference knowledge (conventions, patterns, style guides)
- You don't need context isolation
- Quick workflows that benefit from conversation history

---

## Sub-agent vs Skill Comparison

| | Sub-agent | Skill |
|---|---------|-------|
| **Context** | Isolated 200k window | Main conversation (or forked) |
| **Output** | Summary returned to parent | Full output inline |
| **Best for** | Verbose, self-contained tasks | Reference knowledge, quick workflows |
| **Cost** | Higher (separate context) | Lower (shared context) |
| **Conversation history** | No access | Full access (unless context: fork) |
| **Tool restrictions** | Per-agent configuration | allowed-tools in frontmatter |

---

## Common Patterns

### 1. Isolate High-Volume Operations

The most effective use. Delegate operations that produce large output:

```
Use a subagent to run the test suite and report only the failing tests
with their error messages
```

Verbose output stays in the sub-agent's context. Only the relevant summary returns.

### 2. Parallel Research

Spawn multiple sub-agents for independent investigations:

```
Research the authentication, database, and API modules in parallel
using separate subagents
```

Each explores independently, then Claude synthesizes findings. Works best when research paths don't depend on each other.

**Warning**: Many sub-agents returning detailed results can consume significant main context.

### 3. Chain Sub-agents

For multi-step workflows, use sub-agents in sequence:

```
Use the code-reviewer subagent to find performance issues, then use
the optimizer subagent to fix them
```

Each completes its task and returns results. Claude passes relevant context to the next.

### 4. Permission Scoping

Create read-only reviewers or restricted database readers:

```yaml
---
name: db-reader
description: Execute read-only database queries
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---
```

The hook validates each Bash command, blocking write operations via exit code 2.

### 5. Foreground for Interactive, Background for Independent

- **Foreground**: tasks needing user input, permission prompts, or iterative work
- **Background**: independent tasks that can run while you continue working

Press **Ctrl+B** to background a running task. Ask Claude to "run this in the background."

### 6. Resume for Continuity

When a sub-agent completes, Claude receives its agent ID. Ask Claude to continue:

```
Continue that code review and now analyze the authorization logic
```

Claude resumes with full context from the previous conversation.

### 7. Cost-Optimized Model Selection

```yaml
---
name: quick-scanner
model: haiku
tools: Read, Grep, Glob
---
```

Use haiku for exploration and simple analysis. Use sonnet for implementation. Reserve opus for complex reasoning.

---

## Example Sub-agents

### Code Reviewer (Read-Only)

```markdown
---
name: code-reviewer
description: Expert code review specialist. Proactively reviews code for quality,
  security, and maintainability. Use immediately after writing or modifying code.
tools: Read, Grep, Glob, Bash
model: inherit
---

You are a senior code reviewer ensuring high standards.

When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:
- Code clarity and readability
- Proper error handling
- No exposed secrets
- Input validation
- Test coverage

Provide feedback by priority:
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)
```

### Debugger (Read + Write)

```markdown
---
name: debugger
description: Debugging specialist for errors, test failures, and unexpected behavior.
  Use proactively when encountering any issues.
tools: Read, Edit, Bash, Grep, Glob
---

You are an expert debugger specializing in root cause analysis.

When invoked:
1. Capture error message and stack trace
2. Identify reproduction steps
3. Isolate the failure location
4. Implement minimal fix
5. Verify solution works
```

### Security Reviewer (Opus for Deep Analysis)

```markdown
---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools: Read, Grep, Glob, Bash
model: opus
---

You are a senior security engineer. Review code for:
- Injection vulnerabilities (SQL, XSS, command injection)
- Authentication and authorization flaws
- Secrets or credentials in code
- Insecure data handling

Provide specific line references and suggested fixes.
```

---

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|-------------|-------------|-----|
| Spawning sub-agents for 1-3 file reads | 20k+ token overhead per invocation | Read directly in main conversation |
| Many sub-agents returning full output | Consumes main context rapidly | Ask for summaries, not full output |
| Using sub-agents for iterative work | No conversation history, fresh each time | Use main conversation or resume |
| Background agents needing MCP | MCP unavailable in background | Run in foreground or pre-fetch data |
| Omitting description | Claude can't auto-delegate | Write clear description with trigger phrases |
| `context: fork` without a task | Sub-agent has no actionable prompt | Only fork for explicit instructions |
