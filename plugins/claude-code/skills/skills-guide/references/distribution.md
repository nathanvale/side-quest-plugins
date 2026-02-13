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

When working with files in subdirectories, Claude Code automatically discovers skills from nested `.claude/skills/` directories.

Example: editing a file in `packages/frontend/` causes Claude Code to also look for skills in `packages/frontend/.claude/skills/`.

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

## Security

Skills provide Claude with new capabilities through instructions and code. Malicious skills may introduce vulnerabilities.

**Recommendations**:
- Install skills only from trusted sources
- Audit untrusted skills before use
- Review all bundled files, code dependencies, and resources
- Check for instructions directing Claude to untrusted external network sources
