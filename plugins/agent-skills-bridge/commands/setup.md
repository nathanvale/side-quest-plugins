---
description: Set up cross-tool skill sharing (detects tools, recommends approach, executes)
disable-model-invocation: true
allowed-tools: Bash, Read, Glob, AskUserQuestion
---

# agent-skills-bridge:setup

Interactive setup for cross-tool skill sharing across AI coding tools.

## Instructions

Walk the user through setting up cross-tool skill sharing. Be conversational and explain what you're doing at each step.

### Step 1: Detect Installed Tools

Check which AI coding tools are installed:

```bash
# Claude Code
which claude 2>/dev/null && claude --version 2>/dev/null

# Codex CLI
which codex 2>/dev/null && codex --version 2>/dev/null

# Cursor
ls /Applications/Cursor.app 2>/dev/null

# Gemini CLI
which gemini 2>/dev/null && gemini --version 2>/dev/null

# Windsurf
ls /Applications/Windsurf.app 2>/dev/null
```

Report what was found. If only one tool is installed, explain that cross-tool sharing is most useful with 2+ tools but they can still set up the shared convention for future use.

### Step 2: Check openskills

```bash
which openskills 2>/dev/null || npm list -g openskills 2>/dev/null
```

If openskills is NOT installed, use AskUserQuestion to ask:

> openskills is the recommended tool for cross-tool skill sharing. It handles installing skills to all detected tool directories with a single command.
>
> Would you like to install it?

Options:
- **Yes, install openskills** — Run `npm i -g openskills`
- **No, I'll use symlinks** — Guide them through manual symlink setup instead
- **Skip for now** — Continue with audit only

### Step 3: Scan Existing Skills

Scan all skill locations to find what's already available:

**Personal:**
- `~/.claude/skills/*/SKILL.md`
- `~/.codex/skills/*/SKILL.md`
- `~/.agents/skills/*/SKILL.md`

**Plugin cache:**
- `~/.claude/plugins/cache/` (search recursively for SKILL.md)

**Project-level:**
- `.claude/skills/*/SKILL.md`
- `.codex/skills/*/SKILL.md`
- `.agents/skills/*/SKILL.md`

Report what was found — skill names, locations, and which tools can see them.

### Step 4: Identify Sharing Gaps

Find skills that exist in one tool's directory but not others. For example:
- Skills in `~/.claude/skills/` that aren't in `~/.codex/skills/`
- Plugin cache skills that aren't available to non-Claude tools

### Step 5: Recommend and Execute

Based on what was found, recommend specific actions. Use AskUserQuestion to confirm before each action.

**If openskills is installed:**
- Use `openskills install` for each skill that needs to be shared
- Verify installation by checking target directories

**If using symlinks:**
- Create `~/.agents/skills/` directory if it doesn't exist
- For each skill to share, create symlinks from the source to each tool's directory
- Verify symlinks are valid

**If the shared convention (.agents/skills/) is not set up:**
- Create `~/.agents/skills/` directory
- Explain that this is the emerging standard directory
- Offer to symlink existing skills there

### Step 6: Verify

After setup, verify that skills are discoverable by each installed tool:

```bash
# List skills in each tool's directory
ls ~/.claude/skills/ 2>/dev/null
ls ~/.codex/skills/ 2>/dev/null
ls ~/.agents/skills/ 2>/dev/null
```

Confirm that shared skills have valid SKILL.md files in each location.

### Step 7: Summary

Present a summary of what was done:
1. Tools detected
2. Skills found
3. Actions taken (installs, symlinks created, directories created)
4. Current state (which skills are now shared across which tools)
5. Next steps (if any)
