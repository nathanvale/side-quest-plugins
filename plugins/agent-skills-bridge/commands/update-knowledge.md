---
description: Fetch latest cross-tool skill compatibility info from GitHub issues and community
disable-model-invocation: true
allowed-tools: Bash, Read, Write, WebSearch, WebFetch, AskUserQuestion
---

# agent-skills-bridge:update-knowledge

Fetch the latest cross-tool skill compatibility information from tracked sources and update the plugin's reference files.

## Instructions

Check all tracked sources for updates, present findings, and offer to update reference files. Always confirm with the user before writing any changes.

### Step 1: Check GitHub Issues

Use the GitHub CLI to check tracked issue status:

```bash
# Claude Code .agents/skills/ support
gh issue view 6235 --repo anthropics/claude-code --json state,title,labels,updatedAt,comments 2>/dev/null

# Codex skill improvements
gh issue view 5321 --repo openai/codex --json state,title,labels,updatedAt,comments 2>/dev/null

# Search for new skill-related issues
gh search issues "SKILL.md OR .agents/skills" --repo anthropics/claude-code --state open --limit 5 --json title,number,url 2>/dev/null
gh search issues "skills" --repo openai/codex --state open --limit 5 --json title,number,url 2>/dev/null
```

Report the current status of each tracked issue.

### Step 2: Check Ecosystem Tools

```bash
# openskills latest version
npm view openskills version 2>/dev/null

# Check for new universal installers
npm search "agent skills installer" --json 2>/dev/null | head -20
```

Report version changes or new tools discovered.

### Step 3: Check Standards

Use WebSearch to check for updates to:

- **agentskills.io** — SKILL.md specification changes
- **agents.md** — AGENTS.md standard updates
- **New tool announcements** — Search for "SKILL.md support" + tool names

Search queries:
- `"SKILL.md" specification update 2025`
- `"agents.md" standard update 2025`
- `"SKILL.md" cursor support OR gemini support`

Report any changes to the standards or new tool adoption.

### Step 4: Check Community

Use WebSearch to surface recent community activity:

Search queries:
- `"SKILL.md" cross-tool sharing`
- `openskills AI skills`
- `".agents/skills" convention`

Report significant new voices, tools, or announcements.

### Step 5: Present Findings

Summarize all findings in a structured report:

1. **GitHub Issues** — status changes, new comments, new related issues
2. **Ecosystem Tools** — version updates, new tools
3. **Standards** — specification changes, new adoption
4. **Community** — notable discussions, new contributors

### Step 6: Propose Updates

For each reference file that needs updating, show the specific changes:

- `references/github-issues.md` — updated issue statuses and last-checked dates
- `references/ecosystem-tools.md` — new tools or version changes
- `references/compatibility-matrix.md` — new compatibility data
- `references/community-voices.md` — new notable voices
- `references/standards.md` — specification changes

Use AskUserQuestion to confirm before writing any changes:

> I found the following updates. Would you like me to apply them to the reference files?

Options:
- **Yes, update all** — Apply all changes
- **Let me review each** — Walk through changes one by one
- **No, just show me** — Display the findings without modifying files

### Step 7: Apply Updates

If confirmed, update the reference files using the Write tool. Update the "Last updated" date at the bottom of each modified file.

After updating, report what was changed and suggest running `/agent-skills-bridge:status` to verify the current state matches the updated knowledge.
