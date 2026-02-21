# Plugin Standards

Standards for plugins in the Side Quest marketplace. Every plugin must pass this checklist before being added to marketplace.json.

---

## Acceptance Checklist

### Agent-Verifiable (Automated)

These checks can be run by a CI pipeline or an agent without human judgment.

- [ ] `claude plugin validate .` exits with code 0
- [ ] `marketplace.json` entry has non-empty `description`, `category`, `tags`
- [ ] Plugin installs without error via `/plugin install <name>@side-quest`
- [ ] All paths in `plugin.json` (skills, commands, agents) resolve to real files
- [ ] No biome/tsc errors in TypeScript hooks (if plugin has hooks)

### Human-Verifiable (Judgment)

These checks require a maintainer to read, test, and exercise judgment.

- [ ] Category assignment aligns with the category decision criteria below
- [ ] Plugin description accurately represents what it does
- [ ] At least one working demo flow exists (can run a command/skill end-to-end)
- [ ] README exists with minimum viable content (see template below)

---

## Category System

Four categories matching the official Anthropic marketplace. Assign exactly one category per plugin.

| Category | Use When |
|----------|----------|
| `development` | Tools that help write, test, lint, search, or orchestrate code |
| `productivity` | Tools for research, information gathering, workflow automation |
| `security` | Tools focused on safety, auditing, or compliance |
| `learning` | Tools for education, practice, or skill development |

When a plugin spans multiple categories, assign the category that best describes the primary use case. Use `tags` in marketplace.json for finer-grained taxonomy (e.g., `"multi-agent"`, `"compound-engineering"`, `"builder-validator"`). Tags complement -- not replace -- the category.

### Category Decision Criteria

- A plugin that runs tests, checks types, or searches a codebase belongs in `development` even if it also produces a report.
- A plugin that searches the web, aggregates information, or automates a recurring workflow belongs in `productivity` unless its primary purpose is code.
- A plugin whose primary output is a security finding, audit trail, or compliance report belongs in `security`.
- A plugin designed to teach a concept or provide interactive practice belongs in `learning`.

---

## Multi-Agent Plugin Requirements

Plugins that coordinate multiple sub-agents carry additional cost and complexity that users must be able to reason about before installing. Any plugin that spawns, orchestrates, or delegates work to sub-agents must document the following in its README.

**Coordination pattern** -- describe which pattern the plugin uses:

- Hierarchical: an orchestrator dispatches work to worker agents that do not communicate with each other.
- Supervisor: a supervisor agent reviews worker output and can re-dispatch for corrections.
- Peer: agents operate concurrently at the same authority level and coordinate through shared state or a mediator.

**Agent roles and responsibilities** -- for each agent in the `agents` field of `plugin.json`, provide a brief description of what it does, what tools it has access to, and what its output is.

**Approximate compute multiplier** -- give users a realistic sense of cost relative to a single-agent invocation (e.g., "2-5x base cost" or "scales linearly with the number of files reviewed").

### Write-Access Agents

Every agent with write access to the filesystem, APIs, or external services must be paired with one of the following:

- A read-only validator agent that reviews the output before it is applied.
- `PostToolUse` hooks that enforce quality gates and can halt execution on failure.

This requirement exists to prevent multi-agent workflows from applying incorrect or destructive changes silently. The validator or hook must be documented in the README under a "Safety" or "Quality Gates" section.

---

## Minimum Viable README Template

Every plugin must include a README.md at the plugin root. The minimum viable content is:

```markdown
# Plugin Name

One paragraph: what it does, who it's for.

## Install

\`\`\`
/plugin install <name>@side-quest
\`\`\`

## Usage

\`\`\`
/<plugin>:<command> <args>
\`\`\`

## Requirements

List external dependencies (CLIs, MCP servers, API keys).

## Limitations

Known issues or scope constraints.
```

Multi-agent plugins must also include a "How It Works" section covering coordination pattern, agent roles, compute multiplier, and (if applicable) safety mechanisms.

---

## Plugin Manifest Schema

The plugin manifest lives at `.claude-plugin/plugin.json`. Required fields:

```json
{
  "name": "my-plugin",
  "description": "What this plugin does",
  "version": "1.0.0",
  "author": {
    "name": "Your Name"
  },
  "commands": ["./commands/my-command.md"],
  "skills": ["./skills/my-skill"]
}
```

**Field rules:**

- `name` -- kebab-case, matches the directory name under `plugins/`, must be unique across the marketplace.
- `description` -- one sentence, present tense, no trailing period. This surfaces directly in marketplace listings.
- `version` -- semver (major.minor.patch). Start at `1.0.0` for initial submissions.
- `author.name` -- your name or organization. An `author.url` field is optional.
- `commands` -- array of paths to command markdown files. Paths are relative to the plugin root. Can be an empty array if the plugin only exposes skills or agents.
- `skills` -- array of paths to skill directories. Can be an empty array if the plugin only exposes commands.

**Optional fields:**

- `keywords` -- additional search terms, separate from marketplace.json tags.
- `license` -- SPDX identifier (e.g., `"MIT"`).
- `repository` -- URL to the plugin's source repository if it is maintained separately from this monorepo.
- `agents` -- array of paths to agent definition files, required for multi-agent plugins.

All paths in the manifest are validated by `claude plugin validate .`. The command exits non-zero if any path does not resolve to an existing file or directory.

---

## Contribution Steps

1. Fork the repository.
2. Add your plugin to `plugins/<name>/` following the manifest schema and README template above. The directory name must match the `name` field in `plugin.json`.
3. Add an entry to `marketplace.json` with `name`, `description`, `category`, and `tags` populated.
4. Run the agent-verifiable checklist items locally: `claude plugin validate .` must exit 0, and the TypeScript hooks must pass biome and tsc checks.
5. Work through the human-verifiable checklist yourself -- confirm category assignment, verify the description is accurate, and confirm at least one end-to-end demo works.
6. Submit a PR. Include a short description of what the plugin does and which demo flow to run. A maintainer will review both tiers of the checklist and, once approved, add the plugin to marketplace.json on the main branch.

Plugins that fail the agent-verifiable checks will not be reviewed. Fix validation errors before opening a PR.
