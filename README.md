# Side Quest Plugins

> A marketplace of 20 Claude Code plugins that turn "I wish Claude could..." into "Claude already does."

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.3-orange.svg)](https://bun.sh/)
[![Biome](https://img.shields.io/badge/Biome-2.3-green.svg)](https://biomejs.dev/)

A private monorepo of Claude Code plugins that encode expertise into reusable, composable units. Each plugin is self-contained -- its own directory with a `plugin.json` manifest, skills, commands, agents, and hooks. No hard dependencies between plugins.

## Why This Exists

Claude Code is powerful out of the box. But "out of the box" means generic. It doesn't know your git workflow, your monitor's DDC commands, or how to search Reddit for community sentiment. **Every Claude Code session starts from zero.** You explain the same things, set up the same guardrails, teach the same workflows.

Plugins fix this by encoding expertise into components that Claude loads automatically:

- **Skills** are knowledge banks (markdown files with instructions)
- **Commands** are slash-command entry points (`/git:commit`, `/newsroom:investigate`)
- **Agents** are sub-agent definitions for parallel work
- **Hooks** are lifecycle handlers (TypeScript files that run on events)
- **MCP Servers** are external tool connectors (Model Context Protocol)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/nathanvale/side-quest-plugins.git
cd side-quest-plugins

# Install dependencies
bun install

# Symlink plugins into Claude Code
ln -s $(pwd)/plugins/* ~/.claude/plugins/

# Verify installation
ls -la ~/.claude/plugins/
```

## Plugin Marketplace

### Research & Intelligence

| Plugin | Version | Description | Components |
|--------|---------|-------------|------------|
| **newsroom** | 1.0.0 | Multi-agent research orchestrator with 1920s journalism metaphor. Dispatches beat reporters in parallel across Reddit/X/web. | 2 commands, 2 skills, 1 agent |
| **research** | 1.1.0 | Single-topic research tool. Predecessor to newsroom. | 1 command, 2 skills |
| **x-api** | 1.0.0 | X/Twitter API MCP server for post creation, search, and engagement tracking. | MCP server only |

### Git & Version Control

| Plugin | Version | Description | Components |
|--------|---------|-------------|------------|
| **git** | 1.0.0 | Git intelligence with safety hooks, session memory, and auto-commit. 1,681 lines of TypeScript. | 10 commands, 1 skill, 5 hooks |

### Software Engineering

| Plugin | Version | Description | Components |
|--------|---------|-------------|------------|
| **enterprise** | 1.0.0 | Software engineering orchestrator with Star Trek metaphor. Spock coordinates the bridge crew. | 9 commands, 1 skill, 3 agents |
| **dojo** | 1.0.0 | Learning and interview prep with Miyagi-sensei. Mock interviews, sparring sessions. | 1 command, 1 skill |

### Code Quality & Testing

| Plugin | Version | Description | Components |
|--------|---------|-------------|------------|
| **kit** | 1.0.0 | Code search MCP server -- semantic search, callers, index find. 7 tools. | MCP server, 5 commands, 1 skill |
| **bun-runner** | 1.0.0 | Bun test runner MCP server with structured output. | MCP server, 1 command, 2 hooks |
| **biome-runner** | 1.0.0 | Biome linter/formatter MCP server with auto-fix hooks. | MCP server, 1 command, 2 hooks |
| **tsc-runner** | 1.0.0 | TypeScript type checker MCP server. | MCP server, 1 command, 2 hooks |

### Meta & Knowledge Banks

| Plugin | Version | Description | Components |
|--------|---------|-------------|------------|
| **claude-code** | 1.0.0 | Knowledge bank about Claude Code itself -- hooks, skills, MCP, sub-agents. | 6 skills (no commands) |
| **agentic-orchestration** | 1.0.0 | Multi-agent patterns -- Builder/Validator, Agent Teams, Task system. | 1 skill, 3 commands, hooks |

### Hardware & Environment

| Plugin | Version | Description | Components |
|--------|---------|-------------|------------|
| **dell-u4025qw** | 1.0.0 | Knowledge bank for Dell UltraSharp U4025QW 40" monitor -- KVM, DDC, firmware. | 1 skill, HALT cache |
| **macos-settings** | 1.0.0 | macOS CLI configuration guide (pmset, defaults, scutil). | 1 skill |
| **utm-testing** | 1.0.0 | UTM VM setup, SSH access, clone-based testing. | 1 skill |

### Web & Browser

| Plugin | Version | Description | Components |
|--------|---------|-------------|------------|
| **chrome-devtools** | 1.0.0 | Browser automation via Chrome DevTools MCP -- screenshots, element finding, auth. | MCP server, 3 commands, 1 skill |
| **firecrawl** | 0.1.0 | Firecrawl expertise layer -- API knowledge, cost optimization, integration. | 1 skill |

### Infrastructure & Debugging

| Plugin | Version | Description | Components |
|--------|---------|-------------|------------|
| **node-cert** | 1.0.0 | Fix Node.js certificate trust issues behind corporate SSL proxies. | 11 commands, 1 skill |
| **bun-typescript-starter** | 1.0.0 | Create, debug, and heal repos from nathanvale/bun-typescript-starter template. | 4 commands, 2 skills |
| **agent-skills-bridge** | 1.0.0 | Bridge between Agent ecosystem and Claude Code skills. | 3 commands, 1 skill |

## Highlighted Plugins

### Newsroom: Multi-Agent Research Orchestrator

The crown jewel. A 1920s journalism metaphor that dispatches beat reporters in parallel to research topics.

```bash
/newsroom:investigate "React 19 adoption" --quick --reddit
/newsroom:investigate "Bun vs Node" "Deno runtime" --deep --mode sentiment
```

**How it works:**

1. Mickey "The Desk" Malone (editor-in-chief skill) orchestrates
2. Beat reporters (sub-agents) dispatch in parallel via Task system
3. Each reporter runs `@side-quest/last-30-days` CLI for Reddit/X engagement data
4. Supplementary web research augments CLI results
5. Copy desk synthesizes, cross-references, deduplicates
6. Evening Edition published with engagement stats + source links

**Four research modes:**

- `recon` (default) -- Broad coverage
- `changes` -- Delta-focused, time-constrained
- `sentiment` -- Community sentiment analysis
- `verify "claim"` -- Evidence search with confidence rating

**Graceful degradation:**

- CLI success -> web research (supplementary)
- CLI failure -> web research (primary source)
- WebFetch 403 -> Firecrawl CLI fallback
- No para-obsidian vault -> morgue skips silently

### Git: Safety Net + Session Memory

1,681 lines of TypeScript hooks that prevent destructive operations and preserve context.

**Safety hook (git-safety.ts, 321 lines):**

- Blocks `git push --force`, `git reset --hard`, `git clean -f`
- Blocks commits to main/master (create a branch first)
- Blocks `git add .` (stage specific files)

**Session memory (session-summary.ts, 309 lines):**

- PreCompact hook extracts "cortex" summary before context compression
- Keyed by worktree root (shared across worktrees of same repo)

**Auto-commit (auto-commit-on-stop.ts, 178 lines):**

- Stop hook creates WIP commit on feature branches
- `chore(wip): session checkpoint` -- skips hooks
- Only fires on feature branches, never main

### Enterprise: Software Engineering Orchestrator

Star Trek metaphor. Spock (The Bridge skill) coordinates Scotty (Builder) and McCoy (Validator).

```bash
/enterprise:document ./src/api    # Document API with OpenAPI spec
/enterprise:scan ./src            # Scan for tech debt and generate refactor plan
/enterprise:engage plan.md        # Full implementation with validation
```

**Builder/Validator pattern:**

1. Scotty (builder-scotty agent) implements
2. McCoy (validator-mccoy agent) reviews
3. Iterative refinement via Task system
4. Bridge coordinates handoffs

## Architecture

### Plugin Structure

```
plugins/my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Manifest (name, version, components)
├── commands/
│   └── my-command.md        # Slash command entry point
├── skills/
│   └── my-skill/
│       ├── SKILL.md         # Main skill file (YAML frontmatter + instructions)
│       ├── references/      # Conditional loading (subdocs loaded on-demand)
│       └── cache/           # Auto-generated (HALT pattern)
├── agents/
│   └── my-agent.md          # Sub-agent definition (for Task system)
├── hooks/
│   ├── hooks.json           # Hook manifest
│   └── my-hook.ts           # TypeScript lifecycle handler
└── .mcp.json                # MCP server config (if applicable)
```

### Component Types

#### Skills (26 total)

Markdown files with YAML frontmatter. The body contains instructions, sometimes as a character persona.

```yaml
---
name: the-desk
display_name: Mickey "The Desk" Malone
context: fork
tools: [Task, WebSearch, WebFetch, Read, Bash]
references:
  - path: ./references/orchestration.md
  - path: ./references/mode-playbook.md
    condition: --mode flag
---

# Mickey "The Desk" Malone - Editor-in-Chief

*Gruff, efficient, 1920s newspaper energy*

Got an assignment, Chief? Let's get the story filed...
```

**Token budgeting:** Every skill documents its token costs. Default dispatch vs worst case.

**Progressive disclosure:** Main SKILL.md always loaded. References loaded conditionally.

#### Commands (54 total)

Thin wrappers that invoke skills with arguments.

```markdown
---
name: investigate
skill: the-desk
---

# /newsroom:investigate

Dispatch beat reporters to research topics.

**Usage:** `/newsroom:investigate "topic" [--quick|--deep] [--reddit|--x|--web]`
```

#### Agents (4 total)

Sub-agent definitions for the Task system.

```markdown
---
name: beat-reporter
model: claude-opus-4-6
tools: [Bash, WebSearch, WebFetch, Read]
---

# Beat Reporter

You're a reporter on assignment. Research your topic, file your story.
```

#### Hooks (16 TypeScript files)

Lifecycle handlers that run on specific events.

```typescript
// plugins/git/hooks/git-safety.ts
import type { PreToolUse } from '@claude/hooks'

export const onPreToolUse: PreToolUse = async ({ toolName, toolInput }) => {
  if (toolName !== 'Bash') return { allowed: true }

  const command = toolInput.command

  if (command.includes('git push --force') || command.includes('git push -f')) {
    return {
      allowed: false,
      reason: 'Force push blocked. Use regular push or create a new branch.'
    }
  }

  return { allowed: true }
}
```

**Supported events:** SessionStart, PreToolUse, PostToolUse, PreCompact, Stop

#### MCP Servers (5 total)

External tool connectors via Model Context Protocol.

```json
{
  "mcpServers": {
    "kit": {
      "command": "bunx",
      "args": ["--bun", "@side-quest/kit-mcp"],
      "env": {
        "KIT_CODEBASE_ROOT": "${cwd}"
      }
    }
  }
}
```

## Design Patterns

### HALT Workflow

**H**igh-signal visibility, **A**daptive lazy loading, **L**ifecycle clarity, **T**rust + telemetry

Auto-refreshing community intelligence cache:

```
skills/my-skill/cache/
├── staged-intel.md         # Pending findings (not yet verified)
├── community-intel.md      # Promoted verified intel
├── reviewed-hashes.json    # Deduplication
└── last-updated.json       # Freshness timestamps
```

SessionStart hook checks freshness, triggers refresh if stale. New findings go to `staged-intel.md`. After verification, promoted to `community-intel.md` + hash recorded.

**Used by:** dell-u4025qw, claude-code/hooks

### Builder/Validator Pattern

Two-agent iterative refinement:

1. Builder agent creates/implements
2. Validator agent reviews with specific criteria
3. Builder refines based on feedback
4. Repeat until validator approves
5. Orchestrator (skill) coordinates handoffs

**Used by:** enterprise (scotty + mccoy)

### Metaphor-Driven Design

Real-world metaphors reduce cognitive load (especially for ADHD):

- **Newsroom:** Editors, reporters, morgue (archive), wire service
- **Enterprise:** Star Trek bridge crew, stations, away missions
- **Dojo:** Martial arts training, sensei, sparring

"Reporter filed their story" vs "sub-agent task completed" -- same information, wildly different cognitive load.

## Development

### Prerequisites

- **Bun** 1.3+ (runtime for hooks and MCP servers)
- **TypeScript** 5.9+ (type checking)
- **Biome** 2.3+ (linting/formatting)
- **Git** with conventional commits

### Setup

```bash
git clone https://github.com/nathanvale/side-quest-plugins.git
cd side-quest-plugins
bun install
```

### Quality Commands

```bash
bun run check      # Biome lint + format (write mode)
bun run lint       # Biome lint only
bun run lint:fix   # Auto-fix linting issues
bun run typecheck  # TypeScript type check
bun run format     # Biome format (write mode)
```

### Git Workflow

**Branch naming:** `type/description` (e.g., `feat/newsroom-skill`, `fix/git-safety`)

**Commit format:** Conventional Commits (enforced by commitlint)

```
feat(newsroom): add investigate command
fix(git): prevent force push on main
chore(deps): update biome to 2.3.7
```

**Hooks:**

- `pre-commit` -- Runs lint-staged (Biome on changed files)
- `commit-msg` -- Validates conventional commit format
- `pre-push` -- Blocks direct pushes to main/master

## CI/CD

8 GitHub Actions workflows:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-quality.yml` | PR, push to main | Lint + typecheck + shell script lint |
| `commitlint.yml` | PR | Validate conventional commits |
| `pr-title.yml` | PR | Validate PR title format |
| `security.yml` | Schedule, PR | Trivy vulnerability scan |
| `codeql.yml` | Schedule, PR | CodeQL static analysis |
| `dependency-review.yml` | PR | Supply chain security |
| `dependabot-auto-merge.yml` | Dependabot PRs | Auto-merge patch updates |
| `workflow-lint.yml` | PR (workflow changes) | ActionLint validation |

## Key Learnings

### The Stringer Problem

**Symptom:** Newsroom dispatched Beat Reporter (CLI) and Stringer (web) in parallel. CLI sometimes returns "WEBSEARCH REQUIRED" with specific queries. But Stringer was already running with generic templates -- CLI intelligence wasted.

**Fix:** Merge Stringer into Beat Reporter. Sequential phases (CLI first, then CLI-informed web). Slower by ~30-60s, but web queries actually useful.

**Lesson:** Parallel isn't always better. When step B's quality depends on step A's output, sequential wins.

### The Context Fork Revelation

**Symptom:** Skills ran in main context. 5,000 tokens of reference material stayed in context the entire session.

**Fix:** `context: fork` in skill frontmatter. Skill runs in isolated context, discarded when done. Only output flows back.

**Lesson:** Context is finite. Treat it like memory allocation -- acquire, use, release.

## Rules & Conventions

### ALWAYS

1. Run quality checks before pushing (hooks enforce this)
2. Use conventional commits (enforced by commitlint)
3. Use named exports (no defaults)
4. Token budget every skill (document default + worst case)
5. Graceful degradation chains (never hard-fail on missing dependency)

### NEVER

1. Push directly to main/master (pre-push hook blocks)
2. Use destructive git commands (`reset --hard`, `push --force`, `clean -f`)
3. Create nested `biome.json` (monorepo uses single root config)
4. Export functions without JSDoc (document the "why")

### Code Style

| Area | Convention |
|------|------------|
| Files | kebab-case (`my-util.ts`) |
| Functions | camelCase (`doSomething`) |
| Types | PascalCase (`MyType`) |
| Exports | Named only (no defaults) |
| Formatting | Biome (tabs, single quotes, 80-char) |

## License

MIT License - Copyright (c) 2025 Nathan Vale

See [LICENSE](LICENSE) for full text.

## Credits

**Built by:** Nathan Vale (Melbourne, Australia)

**Inspired by:** IndyDevDan's claude-code-hooks-mastery, Anthropic's Agent Teams patterns, 1920s journalism workflows, Star Trek bridge operations.

---

*Built for a brain that works differently, by someone who stopped apologizing for it.*
