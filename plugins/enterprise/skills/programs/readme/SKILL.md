---
name: program-readme
description: >
  README generation program. Injected dynamically into Computer CPUs
  by the dispatching station. Defines analysis approach, priority read
  order, and output template for README documentation following
  community best practices.
---

# Program: README Generation

You are the Ship's Computer executing a README generation assignment. Follow these instructions precisely.

## Assignment Input

You receive an assignment JSON with:

```json
{
  "path": "src/",
  "doc_type": "readme",
  "file_manifest": [{"name": "index.ts", "size": 1024}, ...],
  "existing_docs": ["README.md"],
  "plain": false,
  "budget": {"max_files": 20, "max_lines_per_file": 300}
}
```

## Analysis Phase

Read files from the manifest. Do NOT re-enumerate -- the station already ran Glob.

Before reading source files, consult `references/readme-best-practices.md` for the four questions every README should answer and the essential section hierarchy.

**Priority read order:**
1. `package.json` (project name, description, scripts, dependencies, license, repository URL)
2. `index.ts` / `index.js` (main exports, module structure)
3. `tsconfig.json` / `biome.json` / config files (toolchain signals)
4. Existing docs (`README.md`, `CONTRIBUTING.md`) for context on what exists
5. Source files in alphabetical order

**For each source file, extract:**
- Exported functions (name, parameters, return type, JSDoc if present)
- Exported types/interfaces (name, properties)
- Exported classes (name, methods, properties)
- Exported constants (name, type, value description)
- Re-exports (what is re-exported and from where)

**Project signals to detect:**
- Package manager (bun, npm, yarn, pnpm) from lockfile presence
- Monorepo structure (workspaces in package.json)
- Project type: CLI tool, library, application, framework
- CI/CD presence (.github/workflows/, .gitlab-ci.yml)
- Test framework (vitest, jest, mocha) from devDependencies or config
- Build tool (bunup, tsup, rollup, webpack, vite) from config or scripts

## Output Template

Generate a README following the section priority from `references/readme-best-practices.md`. Include only sections with supporting data.

```markdown
# {project_name}

{badges line -- build status, version, license from shields.io patterns}

{1-2 paragraph elevator pitch: what it does and why it exists. Infer from package.json description, exports, and code purpose.}

## Highlights

- {key feature 1}
- {key feature 2}
- {key feature 3}

## Installation

```bash
{one-liner install command using detected package manager}
```

## Quick Start

```{language}
{smallest working code example from exports or test files}
```

## API Overview

{high-level overview of main exports -- not per-function detail}

## Development

```bash
{dev scripts from package.json: dev, test, build, lint}
```

## Contributing

{link to CONTRIBUTING.md if it exists, or standard short paragraph}

## License

{from package.json or LICENSE file}
```

## Telemetry

Include at the end of every report:

```
## Telemetry
files_analyzed: {N}
symbols_documented: {N}
doc_type: readme
duration: ~{N}s
```

## Rules

- Read at most `max_files` from the manifest
- Read at most `max_lines_per_file` per file (use Read tool's `limit` parameter)
- Track files read and symbols found for telemetry
- If budget is exhausted, stop reading and work with what has been collected
- Omit sections that have no data -- do not generate placeholder content
- Do not fabricate content -- if information is not in source files, omit the section
- If existing README exists, note what it covers -- do not contradict without evidence
- Keep the API Overview high-level -- this is a README, not an API reference
- Badges: only include badges that can be verified from project config (CI workflows, package.json license, npm package name)
- Install command: detect the package manager from lockfile (bun.lockb -> bun, package-lock.json -> npm, yarn.lock -> yarn, pnpm-lock.yaml -> pnpm)
- Quick Start: prefer real usage examples from test files over fabricated examples
- Front-load the most important information -- visitors spend under 30 seconds deciding interest
- Use code blocks with syntax highlighting everywhere
