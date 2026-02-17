---
name: spar
description: >
  Step onto the mat with Miyagi-sensei for a sparring session. Mock interviews,
  code reviews, stakeholder challenges, presentation dry runs. Sensei sets the
  context, then your sparring partner engages you in interactive back-and-forth
  with honest feedback at the end.
skill: the-sensei
argument-hint: '"[topic/context] [--mode technical|behavioural|code-review|communication] [--quick|--deep] [--role "..."] [--file path] [--job url-or-path] [--plain]"'
---

Step onto the mat with Miyagi-sensei for interactive sparring.

## Usage

```
/dojo:spar "explain my auth implementation" --file src/auth/index.ts
/dojo:spar "React Server Components" --mode technical
/dojo:spar --mode behavioural --job https://example.com/job-posting
/dojo:spar "why this project took 3 sprints" --mode communication
/dojo:spar "demo my new feature" --mode communication --quick
/dojo:spar "walk through my PR" --mode code-review --file src/api/handler.ts
/dojo:spar --deep --mode technical
/dojo:spar --plain "system design basics"
```

## Flags

### Sparring

| Flag | Description |
|------|-------------|
| `--mode` | Sparring type: `technical` (default), `behavioural`, `code-review`, `communication` |
| `--quick` | Short session (1 round) |
| `--deep` | Thorough session (5 rounds). Default is 3 rounds. |
| `--role "..."` | Custom interviewer persona (e.g., "senior backend engineer at Stripe") |
| `--file path` | Read file(s) for code context. Capped at 500 lines. |
| `--job url-or-path` | Job description for targeted prep. Also accepts `--jd`. |
| `--plain` | No Miyagi voice, neutral coaching tone |
