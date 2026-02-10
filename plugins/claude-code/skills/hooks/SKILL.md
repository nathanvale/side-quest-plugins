---
name: hooks
description: >
  Knowledge bank for Claude Code hooks - event lifecycle, hook types, configuration,
  community patterns, best practices, and troubleshooting.
  Triggers on: claude code hooks, hook events, PreToolUse, PostToolUse, SessionStart,
  UserPromptSubmit, hook configuration, settings.json hooks, auto-format hook,
  command hook, prompt hook, agent hook, hook not working, hook debug,
  PermissionRequest, SubagentStart, SubagentStop, Stop hook, PreCompact, SessionEnd.
argument-hint: "[--refresh] [--upgrade] [question about Claude Code hooks]"
allowed-tools: Bash, Read, Write, Glob, Grep, WebSearch, AskUserQuestion
# NOTE: hooks moved to hooks/hooks.json (workaround for anthropics/claude-code#17688)
# Plugin skill frontmatter hooks are silently ignored - see issue for details.
---

# Claude Code Hooks Knowledge Bank

Expert guidance for Claude Code hooks -- event lifecycle, hook types (command, prompt, agent), configuration, community patterns, best practices, and troubleshooting.

## Community Intel (Shared HALT Workflow)

This skill delegates all community-intel behavior to shared files. Keep this block minimal and consistent across skills.

1. Read `../../shared/community-intel.adapter.json` (relative to this file).
2. If the adapter file is missing or unreadable:
   - tell the user: "Community intel is unavailable right now. Answering from reference files only."
   - continue to Step 2 with no HALT status line.
3. Check whether `../../shared/community-intel-workflow.md` exists.
4. If the workflow file is missing:
   - tell the user: "Community intel is unavailable right now. Answering from reference files only."
   - continue to Step 2 with no HALT status line.
5. If the workflow file exists:
   - read it and execute Step 0 + Step 1 using adapter values
   - if `--upgrade` was passed, follow workflow sync-report behavior and stop
   - otherwise return here and continue to Step 2

## Step 2: Classify the Question

Parse the user's question into one or more categories. If you already classified in Step 1b, reuse that classification.

If a question spans multiple categories, identify the primary concern and secondary categories. Address primary first, then connect to secondary categories with separate headed sections.

| Category | Keywords / Signals | Reference File |
|----------|-------------------|----------------|
| **Events & Lifecycle** | event, lifecycle, SessionStart, PreToolUse, PostToolUse, Stop, when fires, matcher, SubagentStart, SubagentStop, PreCompact, SessionEnd | [event-reference.md](references/event-reference.md) |
| **Types & Config** | settings.json, command hook, prompt hook, agent hook, matcher, config, location, /hooks menu, async, timeout | [hook-types-and-config.md](references/hook-types-and-config.md) |
| **Decision & Control** | block, allow, deny, exit code, output, permission, modify input, decision, hookSpecificOutput, context injection | [decision-control.md](references/decision-control.md) |
| **Recipes & Patterns** | auto-format, guard, firewall, notify, checkpoint, how do I, example, recipe, pattern | [community-patterns.md](references/community-patterns.md) |
| **Best Practices** | best practice, performance, architecture, should I, anti-pattern, when to use, security | [best-practices.md](references/best-practices.md) |
| **Troubleshooting** | not working, not firing, isn't firing, isnt firing, debug, error, broken, help, infinite loop, JSON failed | [troubleshooting.md](references/troubleshooting.md) |
| **Plugins & Skills** | plugin hook, skill hook, hooks.json, CLAUDE_PLUGIN_ROOT, agent hook lifecycle, frontmatter, managed policy | [hooks-in-plugins.md](references/hooks-in-plugins.md) |

## Step 3: Read Reference Files

Read the relevant reference files based on the classification. Always read the primary reference file for the category. Verified intel was already loaded in Step 1d.

For multi-category questions, read all relevant files.

## Step 4: Synthesize Answer

### Universal Response Structure

Every response should follow this structure:

1. **One-line answer** -- direct, no preamble
2. **Key details** -- tables, steps, bullets as appropriate
3. **Configuration** -- settings.json snippets, copy-paste ready
4. **Scripts** -- if applicable, fenced code blocks with shell scripts
5. **Gotchas** -- bold warnings for common pitfalls
6. **Sources** -- reference files cited

### For Event Questions

1. State when the event fires and what it matches on
2. Show the JSON input schema
3. Show the decision control options
4. Include a minimal working example
5. Note any limitations (can't block, no matcher support, etc.)

### For Configuration Questions

1. Show the settings.json structure
2. Specify where to put it (user, project, local, plugin)
3. Explain matcher patterns with examples
4. Note the hook type and its specific fields

### For Recipe/Pattern Questions

1. Provide the complete settings.json config
2. If a script is needed, provide the full script
3. Explain what each piece does
4. Note any gotchas (async can't return decisions, format-on-edit noise, etc.)

### For Troubleshooting Questions

1. Match symptoms to the troubleshooting table
2. Provide debug steps in order of likelihood
3. Check verified-intel.md for recently accepted community findings
4. Include the exact debug commands (`claude --debug`, `Ctrl+O`, `/hooks`)

### For Decision Control Questions

1. Identify which event they're working with
2. Show the correct decision pattern (top-level vs hookSpecificOutput)
3. Provide a complete JSON output example
4. Warn about the exit code vs JSON choice (pick one, not both)

### For Plugin/Skill Hook Questions

1. Show the correct file format (hooks.json vs frontmatter)
2. Explain the scoping (when plugin is enabled vs while skill is active)
3. Note the known issue with plugin skill frontmatter hooks
4. Show path variable usage (`${CLAUDE_PLUGIN_ROOT}`)

## Response Guidelines

- **Always cite the reference file** you're drawing from
- **Provide complete configs** -- users should be able to copy/paste settings.json snippets
- **Include scripts** -- full, executable shell scripts when recipes need them
- **Warn about pitfalls** -- especially async decision limitations, stop_hook_active, shell profile JSON issues
- **Include verified intel** -- if verified-intel.md has relevant accepted findings, mention them
- **Be direct** -- answer the question first, then provide context
- **Tables for comparisons** -- use tables when comparing event types, hook types, or decision patterns
- **JSON schemas** -- show the exact JSON structure for inputs and outputs
- **HALT status line** -- if `HALT_STATUS_LINE` is set by the shared workflow, place it at the top of the response before the answer
- **Inline attribution** -- when a claim is informed by verified intel, cite it inline as `(from community intel, MMM YYYY)`

## Examples

### Example 1: Recipe Question

```text
User: How do I auto-format code when Claude edits a file?

Skill: [Reads community-patterns.md]

Use a PostToolUse hook with an Edit|Write matcher. Add this to .claude/settings.json:

{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}

For Biome: replace with `jq -r '.tool_input.file_path' | xargs npx biome check --write`

**Gotcha:** Formatting on every edit adds context window noise.
Consider formatting on commit instead, or use `async: true`
so it doesn't block Claude's flow.
```

### Example 2: Block Dangerous Commands

```text
User: Block dangerous git commands like force push

Skill: [Reads community-patterns.md + decision-control.md]

Use a PreToolUse hook that checks Bash commands against dangerous patterns.
Exit code 2 blocks the command, and stderr tells Claude why.

Add to .claude/settings.json:
[provides settings.json config + block-dangerous.sh script]

The matcher "Bash" ensures it only fires on shell commands.
PreToolUse fires before execution, so the command never runs.
```

### Example 3: Troubleshooting

```text
User: My hook isn't firing

Skill: [Detects Troubleshooting intent -> force refresh]
Skill: "Refreshing community intel - this takes about 60 seconds."
Skill: [Reads troubleshooting.md + hook-types-and-config.md + verified-intel.md]

Common causes in order of likelihood:

1. **Wrong matcher** -- matchers are case-sensitive regex.
   Check: `/hooks` menu, verify it appears under the correct event.

2. **Wrong event** -- PreToolUse fires before execution,
   PostToolUse fires after.

3. **Script not executable** -- `chmod +x ./my-hook.sh`

4. **PermissionRequest in -p mode** -- not supported in
   non-interactive mode. Use PreToolUse instead.

Debug: `claude --debug` shows which hooks matched and their output.
Toggle verbose mode with `Ctrl+O`.

[Includes relevant verified intel findings]

Community intel synced: auto-promoted 1 new finding across 1 topic.
*(from community intel, Jan 2026)*
```

### Example 4: Optional manual sync report

```text
User: /hooks --upgrade

Skill: [Detects --upgrade flag, runs shared workflow in sync-report mode]
Skill: [Refreshes + auto-promotes findings]
Skill: "Community intel sync complete for /hooks. Auto-promoted 2 findings across 2 topics."
```
