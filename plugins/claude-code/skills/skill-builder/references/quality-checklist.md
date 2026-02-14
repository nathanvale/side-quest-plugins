# Skill Quality Checklist

Machine-readable validation criteria for generated skills. Run all checks in Phase 7 before declaring the skill ready.

Source: Anthropic's "Complete Guide to Building Skills for Claude" (Jan 2026), p30

---

## Before You Start (Pre-Flight)

- [ ] 2-3 concrete use cases identified
- [ ] Required tools identified (MCP servers, Bash, Read, etc.)
- [ ] Target folder location decided (personal, project, plugin)

## Structural Checks

- [ ] Folder name is kebab-case (lowercase, hyphens only)
- [ ] Entry file is exactly `SKILL.md` (case-sensitive)
- [ ] Frontmatter delimited by `---` markers
- [ ] YAML parses without errors
- [ ] `name` field is lowercase + hyphens, max 64 chars, matches folder name
- [ ] No nested directories without purpose (references/, scripts/, assets/ only when used)

## Content Checks

- [ ] `description` includes WHAT the skill does
- [ ] `description` includes WHEN to use it (trigger phrases)
- [ ] Body contains clear instructions (not just a description repeat)
- [ ] No XML tags in body (Claude Code strips them)
- [ ] No duplicate knowledge from referenced files
- [ ] Examples included where the workflow is non-obvious
- [ ] Error handling for expected failure modes

## Invocation Control

- [ ] `disable-model-invocation` set correctly (true for side-effect skills)
- [ ] `user-invocable` set correctly (false only for background skills)
- [ ] `allowed-tools` lists only tools actually needed
- [ ] `argument-hint` provided if skill accepts arguments

## Organization Checks

- [ ] Reference files linked with relative paths (not absolute)
- [ ] No reference file exceeds ~500 lines (split if larger)
- [ ] Scripts in scripts/ have shebang lines and are executable
- [ ] Assets in assets/ are referenced from SKILL.md or references

## Trigger Quality

- [ ] Triggers on obvious user phrasing for the use case
- [ ] Triggers on paraphrased/synonym phrasing
- [ ] Does NOT trigger on unrelated queries
- [ ] No overlap with existing skills in the same scope

## Plugin Packaging (if applicable)

- [ ] Registered in plugin.json `skills` array
- [ ] Path is relative to plugin root (e.g., `./skills/my-skill`)
- [ ] Plugin description updated if skill changes plugin scope
