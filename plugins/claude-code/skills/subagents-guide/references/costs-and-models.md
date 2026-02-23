# Costs and Model Selection

Token usage, cost management, model selection for sub-agents, and environment variables.

Source: code.claude.com/docs/en/costs, code.claude.com/docs/en/model-config

---

## Cost Overview

| Metric | Value |
|--------|-------|
| Average daily cost | $6/dev/day |
| 90th percentile daily | < $12/dev/day |
| Monthly average (Sonnet) | ~$100-200/dev/month |
| Agent team multiplier | ~7x standard sessions |
| Background idle usage | ~$0.04/session |

Costs vary based on codebase size, query complexity, and conversation length.

---

## Model Selection for Sub-agents

### Model Aliases

| Alias | Model | Best For |
|-------|-------|----------|
| `haiku` | Fast, efficient | Simple tasks, codebase exploration, read-only research |
| `sonnet` | Balanced | Most coding tasks, code review, implementation |
| `opus` | Complex reasoning | Architecture decisions, multi-step reasoning |
| `inherit` | Same as parent | When you want consistency with the main conversation |

### Setting Sub-agent Models

**Per-agent** (in frontmatter):

```yaml
---
name: quick-search
model: haiku
---
```

**Global override** (all sub-agents):

```bash
export CLAUDE_CODE_SUBAGENT_MODEL=sonnet
```

### Cost Optimization Strategy

- **Explore agent** uses Haiku by default -- fast and cheap for searching
- **Plan agent** inherits from parent -- needs full reasoning capability
- **Custom agents**: use `model: haiku` for simple tasks, `model: sonnet` for most work
- Reserve `opus` for complex architectural decisions

---

## Prompt Caching

Claude Code automatically uses prompt caching to reduce costs for repeated content (system prompts, CLAUDE.md). Enabled by default.

Disable if needed:

| Variable | Scope |
|----------|-------|
| `DISABLE_PROMPT_CACHING=1` | All models |
| `DISABLE_PROMPT_CACHING_HAIKU=1` | Haiku only |
| `DISABLE_PROMPT_CACHING_SONNET=1` | Sonnet only |
| `DISABLE_PROMPT_CACHING_OPUS=1` | Opus only |

---

## Auto-compaction

Sub-agents support automatic compaction at ~95% context capacity. Override:

```bash
export CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50
```

Lower values compact earlier, preserving more headroom. Applies to both main conversations and sub-agents.

---

## Reducing Sub-agent Costs

1. **Use the right model** -- haiku for exploration, sonnet for most work, opus for complex reasoning
2. **Delegate verbose operations** -- tests, log processing, doc fetching. Summary returns to main context.
3. **Keep spawn prompts focused** -- everything in the prompt adds to context from the start
4. **Clean up teams when done** -- active teammates consume tokens even if idle
5. **Write specific prompts** -- vague requests trigger broad scanning

---

## Agent Team Token Costs

Agent teams use significantly more tokens because each teammate has its own context window.

Recommendations:
- Use Sonnet for teammates (balances capability and cost)
- Keep teams small (token usage proportional to team size)
- Keep spawn prompts focused
- Clean up teams when work is done
- Agent teams in plan mode use approximately 7x more tokens than standard sessions

---

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `CLAUDE_CODE_SUBAGENT_MODEL` | Override model for all sub-agents |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` | Disable background tasks, auto-backgrounding, Ctrl+B |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | Context % at which auto-compaction triggers (default: ~95) |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | Enable agent teams (experimental) |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | Max output tokens per request (default: 32,000, max: 64,000) |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Override which model the `haiku` alias maps to |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Override which model the `sonnet` alias maps to |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Override which model the `opus` alias maps to |
