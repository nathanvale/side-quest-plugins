# Wire Protocol

**Only loaded when `--wire` flag is present.**

Defines the wire message schema for inter-room communication using Claude Code's Task system.

## Wire Message Schema

Wire messages are TaskCreate calls with structured metadata. The EIC validates all required fields before sending.

### Required Fields

| Field | Type | Validation |
|-------|------|-----------|
| `wire_version` | string | Must be `"1"` |
| `wire_type` | string | Must be `"green"` or `"red"` |
| `from_room` | string | Must be `"newsroom"` |
| `to_room` | string | Must be one of: `"kitchen"`, `"garden"`, `"dojo"` |
| `message_type` | string | Must be from the defined list below |
| `wire_id` | string | Auto-generated: `"wire-newsroom-{timestamp}"` |

### Optional Fields

| Field | Type | Default |
|-------|------|---------|
| `priority` | string | `"normal"` (or `"urgent"`, `"low"`) |
| `signal_strength` | string | `"medium"` (or `"high"`, `"low"`) -- based on engagement data quality |
| `requires_ack` | boolean | `false` |
| `expires_at` | string | ISO 8601 timestamp (no default -- no expiry) |

### Valid Message Types

**Newsroom -> Kitchen (green wire):**
- `vulnerability_alert` -- critical CVE or security issue
- `deprecation_notice` -- API/dependency deprecation
- `community_bug_report` -- users reporting issues
- `context_delivery` -- response to a context request
- `research_findings` -- general research handoff

**Newsroom -> Any (green wire):**
- `intel_summary` -- evening edition digest
- `status_update` -- stakeout or monitoring update

## Validation Checklist

Before calling TaskCreate, the EIC must verify:

1. `wire_version` is exactly `"1"` (string, not number)
2. `wire_type` is `"green"` or `"red"` -- v1 only sends green wires
3. `from_room` is `"newsroom"`
4. `to_room` matches a valid room name
5. `message_type` is from the defined list above
6. `wire_id` is generated and unique
7. Task description starts with `[WIRE]` prefix for discoverability

If any field is invalid: warn the user with a specific error, do not send.

## TaskCreate Format

```
TaskCreate({
  subject: "[WIRE] {message_type}: {brief summary}",
  description: "{full wire message body -- evening edition summary or alert details}",
  metadata: {
    wire_version: "1",
    wire_type: "green",
    from_room: "newsroom",
    to_room: "{target}",
    message_type: "{type}",
    wire_id: "wire-newsroom-{Date.now()}",
    priority: "normal",
    topics: "{comma-separated topics}",
    signal_strength: "{high|medium|low}"
  }
})
```

## Notes

- Wire messages in v1 are **session-scoped** -- no cross-session persistence
- v1 only sends **green wires** (informational). Red wire (scope/priority changes requiring owner approval) is deferred.
