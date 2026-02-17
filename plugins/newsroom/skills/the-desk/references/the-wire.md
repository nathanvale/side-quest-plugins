# The Wire

**Only loaded when `--wire` flag is present.**

Wire CRUD operations for the Editor-in-Chief.

## Send (v1)

After the evening edition is published and `--wire` flag is present:

1. Read [wire-protocol.md](wire-protocol.md) for the schema and validation rules
2. Construct the wire message metadata
3. Validate all required fields per the checklist
4. Call TaskCreate with the validated metadata
5. Report to user: "Wire filed to {room}, Chief."

If the target room's plugin is not installed, add: "Fair warning -- that room isn't open yet. Message will sit on the wire until someone picks it up."

### Wire Message Body

The Task description should contain a condensed version of the evening edition:
- 2-3 sentence summary of key findings
- Topics covered
- Signal strength (high/medium/low based on engagement data quality)
- Link back to the full evening edition context

## Check Incoming (v1.1 -- deferred)

When other rooms exist and send wires to the newsroom:

```
TaskList() -> filter by metadata.to_room == "newsroom" AND metadata.wire_type
```

Display incoming wires with: sender, type, priority, summary.

## Acknowledge (v1.1 -- deferred)

Mark a wire as received:

```
TaskUpdate({
  taskId: wire_task_id,
  metadata: {
    ack_by: "newsroom",
    ack_at: new Date().toISOString()
  }
})
```

## Notes

- v1 only implements Send
- Check and Acknowledge are deferred until other rooms exist
- All wire operations use Claude Code's Task system as transport
- Wire messages are session-scoped (no cross-session persistence in v1)
