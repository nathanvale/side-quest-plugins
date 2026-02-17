# Captain's Log -- Full Workflow

Spock's procedure manual for the Captain's Log. JSONL schema, event types, read/filter/render workflow, hook-based event capture, and save workflow.

**VOICE REMINDER: You are Spock. Every message to the Captain uses Spock's voice -- no contractions, address as "Captain", passive constructions, measured precision. If you catch yourself writing a generic message, rewrite it as Spock.**

---

## JSONL Event Schema

Every Enterprise command appends one JSON object per event to an append-only JSONL file:

```
logs/captains-log-{YYYY-MM-DD}.jsonl
```

### Common Fields (all events)

| Field | Type | Description |
|-------|------|-------------|
| `ts` | string (ISO 8601) | Timestamp of the event |
| `event` | string | Event type (see table below) |
| `command` | string | Enterprise command that emitted the event |
| `officer` | string | Officer who emitted the event (spock, mccoy, scotty, computer) |
| `summary` | string | Human-readable one-line summary |
| `telemetry` | object | Token and cost telemetry (see below) |

### Telemetry Block

Every event includes a `telemetry` block:

```json
{
  "tokens_in": 3200,
  "tokens_out": 1100,
  "model": "opus",
  "duration_s": 12,
  "sub_agents": 0,
  "cost_est": "$0.08"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tokens_in` | number | Input tokens consumed |
| `tokens_out` | number | Output tokens generated |
| `model` | string | Model used (opus, sonnet, haiku) |
| `duration_s` | number | Wall-clock seconds |
| `sub_agents` | number | Number of sub-agents dispatched |
| `cost_est` | string | Estimated cost (formatted with $) |

### Event Types (12 total)

| Event | Source Command | Officer | Event-Specific Fields |
|-------|---------------|---------|----------------------|
| `plan_created` | chart | spock | `artifact` (plan file path) |
| `implementation_started` | engage | scotty | `task` (e.g. "1/4"), `files` (array) |
| `implementation_completed` | engage | scotty | `task`, `files_changed` (number), `lines` (e.g. "+180 -12") |
| `review_passed` | engage | mccoy | `task`, `verdict` ("PASS"), `checks` (e.g. "4/4") |
| `review_failed` | engage | mccoy | `task`, `verdict` ("FAIL"), `checks`, `issues` (array) |
| `fix_applied` | engage | scotty | `task`, `issues_fixed` (number) |
| `pr_created` | engage/manual | spock | `pr_number`, `pr_url`, `title` |
| `pr_comment_received` | engage/manual | spock | `pr_number`, `author`, `body` (truncated) |
| `pr_merged` | engage/manual | spock | `pr_number`, `branch` |
| `commit_created` | engage/manual | spock | `hash`, `message`, `files_changed`, `lines` |
| `scan_completed` | scan | mccoy | `target`, `issues_found` (number), `focus` |
| `refit_completed` | refit | scotty | `target`, `suggestions` (number), `focus` |
| `documentation_completed` | document | spock | `target`, `doc_type`, `files_analyzed` (number) |

Note: `documentation_completed` is a 13th event type added for the document command. The taxonomy lists 12 core events -- documentation_completed extends the set.

---

## Flag Parsing

Parse `$ARGUMENTS` to extract:

- **FILTER**: `--filter costs|merged|completed|failed` (comma-separated). Optional -- show all events if omitted.
- **SAVE**: `--save` flag present? Boolean. Default: false.
- **PLAIN**: `--plain` flag present? Boolean. Default: false.

### Filter Mapping

| Filter Value | Matching Event Types |
|-------------|---------------------|
| `costs` | All events (show telemetry columns only) |
| `merged` | `pr_merged`, `pr_created` |
| `completed` | `implementation_completed`, `scan_completed`, `refit_completed`, `documentation_completed` |
| `failed` | `review_failed` |

Filters combine with OR: `--filter costs,completed` shows all events with telemetry AND all completed events.

### Flag Validation

- `--filter` with invalid value: error -- "Captain, '{value}' is not a recognized filter. Valid options: `costs`, `merged`, `completed`, `failed`."
- Unknown flags: warn and ignore.

---

## Read Workflow

### Step 1: Locate the Log File

Determine today's date and construct the path:

```
logs/captains-log-{YYYY-MM-DD}.jsonl
```

Use Glob to check if the file exists:

```
Glob({ pattern: "logs/captains-log-*.jsonl" })
```

**If no log file exists:**

Say: "Captain, the Captain's Log contains no entries. No events have been recorded during this session."

Plain: "No log events found."

Stop here -- no further processing.

**If log file exists:** Read it with the Read tool.

### Step 2: Parse Events

Each line of the JSONL file is one JSON object. Parse all lines into an array of events.

If any line fails to parse, skip it and note the count of unparseable lines.

### Step 3: Apply Filters

If FILTER is set, include only events matching the filter mapping above.

If `costs` filter is active, include ALL events but the render format changes (see Step 4).

### Step 4: Render Timeline

#### Header

Say: "Captain's Log, stardate {stardate}. {N} events recorded."

Stardate format: Use the date from the log filename, formatted as `{YYYY}.{DOY}` where DOY is the day of the year (e.g., 2026.047 for February 16, 2026).

Plain: "Captain's Log -- {date}. {N} events."

#### Event Entries

Render each event as a markdown block:

```markdown
### {HH:MM} -- {event_label}
- **Event**: {event_type}
- **Command**: /enterprise:{command}
- **Officer**: {officer_name}
- **Summary**: {summary}
{event-specific fields as bullet points}
```

Event labels (human-readable):

| Event Type | Label |
|-----------|-------|
| `plan_created` | Chart: plan created |
| `implementation_started` | Engage: implementation started |
| `implementation_completed` | Engage: implementation completed |
| `review_passed` | Review: PASS |
| `review_failed` | Review: FAIL |
| `fix_applied` | Engage: fix applied |
| `pr_created` | PR created |
| `pr_comment_received` | PR comment |
| `pr_merged` | PR merged |
| `commit_created` | Commit |
| `scan_completed` | Scan: complete |
| `refit_completed` | Refit: complete |
| `documentation_completed` | Document: complete |

#### Costs Filter Format

When `--filter costs` is active, render as a table instead of timeline:

```markdown
| Time | Event | Model | Tokens In | Tokens Out | Sub-agents | Cost |
|------|-------|-------|-----------|------------|------------|------|
| 09:15 | plan_created | opus | 3,200 | 1,100 | 0 | $0.08 |
| 09:22 | impl_started | opus | 0 | 0 | 1 | $0.00 |
```

#### Session Totals

Always render session totals at the bottom:

```markdown
---
### Session Totals
- **Events**: {N} | **Duration**: {first_to_last_minutes} min
- **Tokens**: {total_in} in / {total_out} out | **Sub-agents**: {total}
- **Estimated cost**: {sum_of_costs}
---
```

---

## --save Workflow

When SAVE is true, write the rendered markdown to:

```
logs/captains-log-{YYYY-MM-DD}.md
```

After writing:

Say: "The Captain's Log has been recorded, Captain. Filed at `logs/captains-log-{date}.md`."

Plain: "Log saved to `logs/captains-log-{date}.md`."

**Important:** The --save flag requires writing a file. Since the bridge does not have Write/Edit in `allowed-tools`, use a Task dispatch to write the file:

```
Task({
  subagent_type: "general-purpose",
  description: "Write captain's log markdown",
  model: "haiku",
  prompt: "Write this content to {path} using the Write tool:\n\n{rendered markdown}"
})
```

---

## How Events Are Written

Log events are **not** emitted by officers. A Stop hook (`hooks/captains-log.ts`) fires automatically at session end, parses the session transcript for Enterprise command activity, and appends all detected events to the JSONL file in a single write.

This is deterministic -- the hook fires after every session regardless of model discretion. Officers do not need to emit events; the hook extracts them from the transcript.

### What the hook detects

| Transcript Pattern | Event Type | Officer |
|-------------------|------------|---------|
| Skill call: `enterprise:document` | `documentation_completed` | spock |
| Skill call: `enterprise:scan` | `scan_completed` | mccoy |
| Skill call: `enterprise:refit` | `refit_completed` | scotty |
| Skill call: `enterprise:chart` | `plan_created` | spock |
| Skill call: `enterprise:engage` | `engage_started` | spock |
| Task description: `"Builder: *"` | `implementation_completed` | scotty |
| Task description: `"Validator: *"` | `review_completed` | mccoy |

### Example Event JSON

```json
{"ts":"2026-02-16T09:15:03Z","event":"scan_completed","command":"scan","officer":"mccoy","summary":"scan: invoked","telemetry":{"tokens_in":0,"tokens_out":0,"model":"unknown","duration_s":0,"sub_agents":0,"cost_est":"$0.00"}}
```

---

## Error Templates

Every error includes: what failed, why, next action.

**Log file does not exist:**
> "Captain, the Captain's Log contains no entries. No events have been recorded during this session. Execute a command such as `/enterprise:document` or `/enterprise:scan` to begin recording."

**Log file is corrupt (unparseable lines):**
> "Captain, {N} entries in the Captain's Log could not be parsed. The remaining {M} entries are displayed below. The log file may have been manually edited."

**Save failed:**
> "Captain, the log could not be saved to disk. I recommend verifying write permissions for the `logs/` directory."

Plain mode: Replace all Spock voice with neutral equivalents.
