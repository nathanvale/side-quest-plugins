# Collection Rules

How to collect Beat Reporter results and handle failures. Read during the Collect phase.

Use 120s timeout per reporter. If a reporter times out, note the gap and continue with results from others. Collect all reporter results before moving to synthesis.

## Error Handling Matrix

| Scenario | Action |
|----------|--------|
| All reporters succeed | Full synthesis (best case) |
| Some reporters succeed | Synthesize available, note gaps |
| CLI failed within a reporter but web succeeded | Report web findings, note "engagement data unavailable" |
| Reporter times out | Note gap, continue with others |
| Everything fails | Report failure honestly, suggest retry or check API keys |
