---
name: research
description: Web research and synthesis team
builder: research-builder
validator: research-validator
---

# Research Team

A specialized team for research and information synthesis tasks. Research builders have WebSearch and WebFetch tools for accessing external sources. Research validators verify coverage, citation quality, and source recency.

## When to Use

Use `--team research` when the prompt requires gathering information from external sources rather than writing code. Examples:
- "Research top 5 testing frameworks for TypeScript"
- "Compare React vs Vue for enterprise applications"
- "Summarize recent changes to the Bun runtime"

## Agents

| Role | Agent | Model |
|------|-------|-------|
| Builder | `research-builder` | claude-sonnet-4-5 |
| Validator | `research-validator` | claude-haiku-4-5 |
