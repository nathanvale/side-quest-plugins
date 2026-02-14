# Review Dimensions

Structured grading criteria for skill reviews. Each dimension has specific checks, severity levels, and remediation guidance.

Source: Derived from Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026)

---

## Scoring

Each dimension is graded on a 3-point scale:

| Grade | Meaning |
|-------|---------|
| **PASS** | Meets or exceeds best practices |
| **WARN** | Functional but has uplift opportunities |
| **FAIL** | Violates a rule or missing something critical |

Overall readiness: **Ship it** (all PASS), **Needs work** (any WARN, no FAIL), **Broken** (any FAIL).

---

## Dimension 1: Structure

Is the skill organized correctly?

| Check | Severity | Rule |
|-------|----------|------|
| Folder name is kebab-case | FAIL | Lowercase, hyphens only, no spaces/underscores/capitals |
| Entry file is exactly `SKILL.md` | FAIL | Case-sensitive, no variations |
| Frontmatter delimited by `---` | FAIL | Opening and closing markers required |
| YAML parses without errors | FAIL | No tabs, correct indentation, valid syntax |
| `name` matches folder name | WARN | Should match for discoverability |
| `name` is max 64 chars, kebab-case | FAIL | Enforced constraint |
| No forbidden names (claude, anthropic) | FAIL | Reserved names |
| No extraneous files (README.md, CHANGELOG.md, etc.) | WARN | Only SKILL.md, references/, scripts/, assets/ |
| Subdirectories used only when needed | WARN | Empty dirs are noise |

---

## Dimension 2: Description Quality

Will the skill trigger correctly?

| Check | Severity | Rule |
|-------|----------|------|
| Description exists | FAIL | Required field |
| Under 1024 characters | FAIL | Hard limit |
| No XML tags (`<` `>`) | FAIL | Security restriction |
| Includes WHAT it does | FAIL | First part of description |
| Includes WHEN to use it (trigger phrases) | FAIL | Second part of description |
| Trigger phrases match natural user language | WARN | "help me X", "create a Y", not just technical terms |
| Mentions file types if relevant | WARN | .docx, .pdf, etc. |
| Includes synonyms/paraphrases | WARN | Multiple ways to say the same thing |
| Not too broad ("helps with projects") | WARN | Specificity prevents overtriggering |
| Not too narrow (only one exact phrase) | WARN | Coverage prevents undertriggering |

---

## Dimension 3: Body Quality

Are the instructions effective?

| Check | Severity | Rule |
|-------|----------|------|
| Body exists (not just frontmatter) | WARN | Minimal skills can be frontmatter-only, but most need a body |
| Under 500 lines / 5,000 words | WARN | Context budget, split to references if over |
| Uses imperative/infinitive form | WARN | "Run X", "Create Y", not "This skill runs X" |
| No "When to Use" section in body | WARN | Belongs in description, not body |
| Instructions are specific and actionable | WARN | "Run `script.py --flag`" not "Validate the data" |
| Includes examples for non-obvious workflows | WARN | Copy-paste scenarios |
| Includes error handling/troubleshooting | WARN | What to do when things fail |
| No duplicate content from reference files | WARN | Single source of truth |
| No XML tags in body | FAIL | Claude Code strips them |
| References bundled files with when-to-read guidance | WARN | "Read references/api.md for rate limiting patterns" |

---

## Dimension 4: Invocation Control

Is access configured correctly?

| Check | Severity | Rule |
|-------|----------|------|
| `disable-model-invocation` appropriate for skill type | WARN | true for side-effect skills (file creation, commands) |
| `user-invocable` appropriate for skill type | WARN | false only for pure background knowledge |
| `allowed-tools` lists only needed tools | WARN | Principle of least privilege |
| `allowed-tools` doesn't grant dangerous tools unnecessarily | WARN | Bash without constraints, Write for read-only skills |
| `argument-hint` provided if skill accepts args | WARN | Helps discoverability |
| `context: fork` used only when needed | WARN | Overhead of subagent only justified for isolation |

---

## Dimension 5: Progressive Disclosure

Is context budget used efficiently?

| Check | Severity | Rule |
|-------|----------|------|
| SKILL.md contains only essentials | WARN | Detailed docs go in references/ |
| Reference files linked from SKILL.md | WARN | With when-to-read descriptions |
| Reference files under ~500 lines each | WARN | Split if larger |
| References are one level deep | WARN | No references referencing other references |
| Large reference files have table of contents | WARN | Over 100 lines should have TOC |
| Assets not loaded into context | WARN | Assets are for output, not reading |
| Scripts designed for execution, not context loading | WARN | Token-efficient approach |

---

## Dimension 6: Trigger Coverage

Will it fire at the right times?

| Check | Severity | Rule |
|-------|----------|------|
| Obvious phrasing triggers the skill | WARN | "create a project" for a project skill |
| Paraphrased phrasing triggers | WARN | "set up a new project", "start a project" |
| Unrelated queries do NOT trigger | WARN | No false positives |
| No overlap with sibling skills | WARN | Clear boundaries |
| Description covers the main use cases (2-3 minimum) | WARN | Not just one narrow path |

---

## Dimension 7: Content Strategy

Is knowledge organized well?

| Check | Severity | Rule |
|-------|----------|------|
| Appropriate skill type (reference vs task) | WARN | Reference = knowledge, Task = actions |
| Degrees of freedom match task fragility | WARN | Low freedom for fragile ops, high for flexible |
| No unnecessary README/CHANGELOG/etc. files | WARN | Only what AI agent needs |
| Clear separation of concerns | WARN | Each file has one job |
| Appropriate pattern for the use case | WARN | Sequential, knowledge bank, dynamic context, etc. |

---

## Dimension 8: Plugin Integration (if applicable)

Is the skill properly packaged?

| Check | Severity | Rule |
|-------|----------|------|
| Registered in plugin.json `skills` array | FAIL | Required for discovery |
| Path is relative (`./skills/name`) | FAIL | Not absolute |
| Plugin description reflects skill's capabilities | WARN | Users see this when installing |
| Cross-skill boundaries documented | WARN | If sibling skills exist |
| No frontmatter hooks (use hooks.json instead) | WARN | Frontmatter hooks silently ignored in plugins |
