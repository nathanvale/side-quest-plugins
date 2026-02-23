---
description: Orchestrate a complex task using Builder/Validator dispatch
argument-hint: Describe the feature or changes you want implemented (add --team <name> for non-default team)
model: opus
skill: orchestrator
---

Orchestrate the following task:

$ARGUMENTS

## Usage Examples

```
/orchestrate "add a REST API with GET /users and POST /users"
```

Uses the default engineering team (builder + validator).

```
/orchestrate "research top 5 TS testing frameworks" --team research
```

Uses the research team (research-builder + research-validator) with web search capabilities.

## Available Teams

- **engineering** (default) -- code implementation and modification
- **research** -- web research, synthesis, and information gathering
