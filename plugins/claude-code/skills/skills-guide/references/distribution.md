# Distribution & Installation

Where skills live, how to share them, plugin packaging, enterprise deployment, and precedence rules.

Source: Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026), code.claude.com/docs/en/skills

---

## Where Skills Live

Where you store a skill determines who can use it:

| Location | Path | Applies To |
|----------|------|-----------|
| **Enterprise** | Managed settings (admin-controlled) | All users in the organization |
| **Personal** | `~/.claude/skills/<skill-name>/SKILL.md` | All your projects |
| **Project** | `.claude/skills/<skill-name>/SKILL.md` | This project only |
| **Plugin** | `<plugin>/skills/<skill-name>/SKILL.md` | Where plugin is enabled |

### Precedence Rules

When skills share the same name across levels, higher-priority locations win:

**enterprise > personal > project**

Plugin skills use a `plugin-name:skill-name` namespace, so they cannot conflict with other levels.

If you have files in `.claude/commands/`, those work the same way, but if a skill and a command share the same name, the skill takes precedence.

---

## Personal Skills

Available across all your projects. Good for:
- Personal workflow automation
- Code conventions you use everywhere
- Developer tooling preferences

```bash
mkdir -p ~/.claude/skills/my-skill
# Create SKILL.md in that directory
```

---

## Project Skills

Committed to version control, shared with the team. Good for:
- Project-specific conventions
- Team workflow automation
- Codebase-specific knowledge

```bash
mkdir -p .claude/skills/my-skill
# Create SKILL.md, commit to git
```

---

## Plugin Skills

Packaged as part of a plugin for broader distribution. Skills live in the plugin's `skills/` directory:

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── my-skill/
        ├── SKILL.md
        └── references/
            └── detail.md
```

Register skills in `plugin.json`:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "skills": ["./skills/my-skill"]
}
```

Plugin skills are namespaced as `plugin-name:skill-name` to avoid conflicts. Users invoke them with `/plugin-name:skill-name` or the full namespace.

---

## Enterprise / Managed Skills

Deploy organization-wide through managed settings. Administrators control:
- Which skills are available
- Which users/groups have access
- Skill configuration

See Claude Code managed settings documentation for deployment details.

---

## Monorepo Support

When you work with files in subdirectories, Claude Code automatically discovers skills from nested `.claude/skills/` directories in those subdirectories.

Example: editing a file in `packages/frontend/` causes Claude Code to also look for skills in `packages/frontend/.claude/skills/`. This applies to subdirectories you're actively working in, not all nested directories in the repo.

This supports monorepo setups where packages have their own skills.

---

## Additional Directories

Skills defined in `.claude/skills/` within directories added via `--add-dir` are loaded automatically and picked up by live change detection. You can edit them during a session without restarting.

---

## Sharing Methods Summary

| Method | Audience | How |
|--------|---------|-----|
| **Project skills** | Your team | Commit `.claude/skills/` to version control |
| **Plugins** | Broader distribution | Create a plugin with `skills/` directory |
| **Managed settings** | Organization-wide | Deploy through enterprise admin |
| **Copy** | Individual sharing | Share the skill folder directly |

---

## Migration: Commands to Skills

Custom slash commands (`.claude/commands/`) have been merged into skills. Files at `.claude/commands/review.md` and `.claude/skills/review/SKILL.md` both create `/review` and work the same way.

Existing `.claude/commands/` files keep working. Skills add optional features:
- A directory for supporting files
- Frontmatter to control invocation
- Automatic loading when relevant

---

## How Users Install Skills Today (January 2026)

**Individual users**:
1. Download the skill folder
2. Zip the folder (if needed)
3. Upload to Claude.ai via Settings > Capabilities > Skills
4. Or place in Claude Code skills directory (`~/.claude/skills/` or `.claude/skills/`)

**Organization-level** (shipped December 2025):
- Admins deploy skills workspace-wide
- Automatic updates
- Centralized management

---

## Hosting on GitHub

Recommended approach for distributing skills today:

1. **Public repo** for open-source skills
2. **Clear README** with installation instructions (this is the repo-level README for humans -- separate from the skill folder, which should NOT contain a README.md)
3. **Example usage and screenshots**

```
your-skill-repo/
├── README.md              # For humans (installation, examples, screenshots)
├── LICENSE
└── your-skill/            # The actual skill folder
    ├── SKILL.md
    ├── references/
    └── scripts/
```

### Installation Guide Template

Include this in your repo README, adapted for your skill:

```markdown
## Installing the [Your Service] skill

1. Download the skill:
   - Clone repo: `git clone https://github.com/yourcompany/skills`
   - Or download ZIP from Releases

2. Install in Claude:
   - Open Claude.ai > Settings > Skills
   - Click "Upload skill"
   - Select the skill folder (zipped)

3. Enable the skill:
   - Toggle on the [Your Service] skill
   - Ensure your MCP server is connected (if applicable)

4. Test:
   - Ask Claude: "Set up a new project in [Your Service]"
```

### Document Alongside Your MCP Repo

If you have an MCP server, link to your skill from the MCP documentation:
- Explain why using both together is valuable
- Provide a quick-start guide
- Show the before/after difference

---

## API Distribution

For programmatic use cases -- applications, agents, or automated workflows:

| Capability | How |
|-----------|-----|
| List and manage skills | `/v1/skills` endpoint |
| Add skills to requests | `container.skills` parameter in Messages API |
| Version control | Claude Console |
| Custom agents | Claude Agent SDK |

**When to use API vs Claude.ai/Claude Code**:

| Use Case | Best Surface |
|----------|-------------|
| End users interacting with skills directly | Claude.ai / Claude Code |
| Manual testing and iteration | Claude.ai / Claude Code |
| Individual, ad-hoc workflows | Claude.ai / Claude Code |
| Applications using skills programmatically | API |
| Production deployments at scale | API |
| Automated pipelines and agent systems | API |

Note: Skills in the API require the Code Execution Tool beta.

---

## Positioning Your Skill

How you describe your skill determines whether users understand its value.

**Focus on outcomes, not features**:

Good:
> "The ProjectHub skill enables teams to set up complete project workspaces in seconds -- including pages, databases, and templates -- instead of spending 30 minutes on manual setup."

Bad:
> "The ProjectHub skill is a folder containing YAML frontmatter and Markdown instructions that calls our MCP server tools."

**Highlight the MCP + Skills story** (if applicable):
> "Our MCP server gives Claude access to your Linear projects. Our skills teach Claude your team's sprint planning workflow. Together, they enable AI-powered project management."

---

## Open Standard

Skills are published as an open standard (agentskills.io). Like MCP, skills are designed to be portable across tools and platforms -- the same skill should work whether you're using Claude or other AI platforms. Authors can note platform-specific requirements in the `compatibility` frontmatter field.

---

## Security

Skills provide Claude with new capabilities through instructions and code. Malicious skills may introduce vulnerabilities.

**Recommendations**:
- Install skills only from trusted sources
- Audit untrusted skills before use
- Review all bundled files, code dependencies, and resources
- Check for instructions directing Claude to untrusted external network sources
