---
name: engineering
description: Code implementation and modification team
builder: builder
validator: validator
---

# Engineering Team

The default team for code implementation tasks. Builders write, modify, and refactor source code. Validators verify structural correctness, named exports, JSDoc, and file boundaries.

## When to Use

This is the default team. It is used when no `--team` flag is specified, or when `--team engineering` is explicitly passed.

## Agents

| Role | Agent | Model |
|------|-------|-------|
| Builder | `builder` | claude-sonnet-4-5 |
| Validator | `validator` | claude-haiku-4-5 |
