---
description: Checklist for adding a new plugin to the marketplace
globs: plugins/**/*
---

# Add a Plugin -- Step-by-Step Checklist

## 1. Create the plugin directory

```
plugins/<name>/
  .claude-plugin/
    plugin.json
  README.md
```

The directory name MUST be kebab-case and match the `name` field in plugin.json.

## 2. Write the plugin manifest

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "<name>",
  "description": "One sentence, present tense, no trailing period",
  "version": "1.0.0",
  "author": { "name": "Nathan Vale" },
  "keywords": ["relevant", "keywords"],
  "license": "MIT",
  "commands": [],
  "skills": []
}
```

Populate `commands`, `skills`, and `agents` arrays with relative paths as you add components.

## 3. Add plugin components

Add whichever components the plugin needs:

- **Commands:** `commands/<name>.md` with YAML frontmatter (description, model, allowed-tools, skill)
- **Skills:** `skills/<name>/SKILL.md` with YAML frontmatter (name, description, allowed-tools, use-when)
- **Agents:** `agents/<name>.md` with YAML frontmatter (model, tools) -- for multi-agent plugins
- **Hooks:** `hooks/hooks.json` + `hooks/<name>.ts` -- for lifecycle event handlers

Every path listed in plugin.json must resolve to a real file or directory.

## 4. Write the README

Follow the template in `docs/plugin-standards.md`. Minimum sections:

1. Title + one-paragraph description
2. Install (`/plugin install <name>@side-quest`)
3. Usage (show command examples)
4. Requirements (external deps)
5. Limitations

Multi-agent plugins also need: How It Works (coordination pattern, agent roles, compute multiplier, safety).

## 5. Register in marketplace.json

Add an entry to `.claude-plugin/marketplace.json` in the `plugins` array:

```json
{
  "name": "<name>",
  "source": "./plugins/<name>",
  "description": "Short description for marketplace listing",
  "category": "development|productivity|security|learning",
  "tags": ["tag1", "tag2"]
}
```

## 6. Bump the marketplace version

In `.claude-plugin/marketplace.json`, bump the root `version` field:

- Adding a plugin = **minor** bump (e.g., 1.1.0 -> 1.2.0)
- Removing a plugin = **major** bump
- Changing metadata only = **patch** bump

## 7. Validate

Run all three validation steps:

```bash
bun run validate                    # Biome + TypeScript + marketplace structure
cd plugins/<name> && claude plugin validate .   # Claude Code plugin validation
```

Both must pass with zero errors.

## 8. Test end-to-end

Install the plugin and verify at least one command or skill works:

```bash
/plugin install <name>@side-quest
/<name>:<command>
```

## 9. Commit and PR

- Branch: `feat/add-<name>-plugin` or `feat/<name>`
- Commit: `feat(marketplace): add <name> plugin`
- PR description: what the plugin does + which demo flow to run
