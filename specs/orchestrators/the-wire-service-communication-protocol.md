# The Wire Service: Communication Protocol Between the Newsroom and the Enterprise

## The Metaphor

In the real world, wire services like the Associated Press and Reuters sit between newsrooms. They're a shared communication layer — any newsroom can publish to the wire, any newsroom can subscribe. The wire carries information, not orders. Editors still decide what makes their paper.

This framework defines the communication protocol between the Newsroom (research & intelligence) and the Enterprise (software engineering). The Wire Service is the message bus that connects them, with clear rules about what flows freely between rooms and what requires the owner's sign-off.

**The core principle: Information flows freely. Decisions flow through you.**

---

## The Ownership Structure

### You: Owner of Both Establishments

You own the newspaper and the starship. They're separate operations, but they share a captain who sees the full picture.

```
                    ┌─────────────┐
                    │     You     │
                    │  (Owner)    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────┴──────┐    │    ┌───────┴──────┐
       │  Newsroom   │    │    │  Enterprise  │
       │    EIC      │    │    │    Spock     │
       └──────┬──────┘    │    └───────┬──────┘
              │            │            │
              │     ┌──────┴──────┐     │
              └─────┤ Wire Service├─────┘
                    └─────────────┘
```

**The EIC and Spock are peers.** Neither has authority over the other. They coordinate through the wire and escalate through you.

---

## The Wire Service (Shared Message Bus)

### What the Wire Carries

The wire carries structured messages between rooms. Every message has a type, and the type determines whether it flows freely or requires your approval.

### Message Types

#### Green Wire: Flows Freely (No Owner Approval)

These are informational exchanges that don't change scope, priority, or resource allocation. The EICs handle them autonomously.

**Enterprise → Newsroom**

| Message | Example | Purpose |
|---------|---------|---------|
| Context Request | "What do we know about the Dynamics 365 batch API?" | Enterprise needs background intel for active work. Newsroom checks the morgue or sends a quick street reporter. |
| Shipped Notification | "The PDF upload feature is live in staging." | Newsroom can assign a street reporter to monitor community reaction or check for reported issues. |
| Supply Query | "Is there a well-regarded npm package for PDF parsing?" | Enterprise wants the Newsroom's review desk to do a quick evaluation before the Enterprise commits to a dependency. |
| Pattern Check | "How are other projects handling SharePoint throttling?" | Newsroom's source network checks community patterns and reports back. |

**Newsroom → Enterprise**

| Message | Example | Purpose |
|---------|---------|---------|
| Vulnerability Alert | "Critical CVE published for a package you're using." | Time-sensitive. Enterprise needs to know immediately. Spock triages and decides response. |
| Deprecation Notice | "Azure announced this API endpoint is deprecated in 90 days." | Enterprise adds it to their planning board. Not urgent but needs tracking. |
| Community Bug Report | "Multiple Reddit posts reporting the same error after the latest deploy." | Enterprise's red alert desk may need to spin up. Spock decides severity. |
| Context Delivery | Response to an Enterprise context request. | Raw intel or morgue clippings delivered back to the requesting station. |

**Bidirectional**

| Message | Example | Purpose |
|---------|---------|---------|
| Status Query | "What's the current state of [topic]?" | Either room can ask the other for a status update on active work or watched topics. |
| Handoff Acknowledgment | "Received the ticket, it's in the queue." | Confirms that a handoff from one room to the other has been received and understood. |

#### Red Wire: Requires Owner Approval

These messages involve decisions that change what gets built, what gets prioritised, or how resources are allocated. They must route through you.

**Newsroom → Owner → Enterprise**

| Message | Example | Why It Needs You |
|---------|---------|-----------------|
| New Feature Suggestion | "Community is requesting dark mode -- strong signal across Reddit and GitHub." | Changes scope. Only you decide what makes the mission briefing. |
| Priority Change Request | "This API deprecation timeline is shorter than expected — the migration should move up." | Changes sequencing. You decide what's urgent. |
| Strategic Intel | "Competitor just shipped a feature that directly overlaps with your roadmap." | May change direction. You decide the response. |
| Technology Recommendation | "The investigative desk found a framework that could replace your current approach." | Changes architecture. You decide whether to pivot. |

**Enterprise → Owner → Newsroom**

| Message | Example | Why It Needs You |
|---------|---------|-----------------|
| Research Commission | "We need a deep investigation into authentication patterns before we architect this module." | Allocates newsroom resources to a significant investigation. You approve the editorial spend. |
| Stakeout Request | "Can we get ongoing monitoring on [third-party service] health?" | Creates a recurring obligation for the newsroom. You approve the commitment. |
| Story Kill | "That research the newsroom did on [topic] — we've decided to go a different direction, they can stop digging." | Redirects newsroom resources. You confirm. |

**Either Room → Owner**

| Message | Example | Why It Needs You |
|---------|---------|-----------------|
| Scope Dispute | "The Newsroom is saying X, but the Enterprise's experience suggests Y." | Conflicting intel. You make the judgment call. |
| Resource Conflict | "Both rooms need attention on the same topic but with different priorities." | You allocate your attention and decide sequencing. |
| 86 Request | "This story/dish isn't working — recommend we kill it." | You confirm the kill. |

---

## Communication Protocols

### The Morning Brief

Before the day begins, both EICs can file a brief to you. The Newsroom EIC reports on overnight stakeout dispatches, breaking stories, and the day's editorial plan. Spock reports on the Enterprise's mission plan for the day -- what's in progress, what's at the bridge for review, what's blocked.

**You read both briefs, then issue your directives for the day.** This is the primary synchronisation point.

```
Morning:
    Newsroom EIC files morning brief → You
    Spock files mission plan → You
    You read both
    You issue directives to either/both rooms
    Rooms begin their day
```

### The Wire Check

Periodically during the day, the wire is checked for green messages. These don't interrupt your workflow — the EICs handle them autonomously. You can review the wire log at any time to stay informed, but you don't need to approve anything on the green wire.

```
During the day:
    Green wire messages flow between EICs
    Red wire messages queue for your review
    You check the red wire queue when ready
    You approve, modify, or reject red wire items
```

### The Evening Edition

At the end of the day, both rooms can file a summary. The Newsroom reports on stories filed, stakeout updates, and stories in progress. The Enterprise reports on missions completed, work in progress, and blockers.

**You read the evening edition and adjust tomorrow's directives accordingly.**

```
Evening:
    Newsroom EIC files evening summary → You
    Spock files end-of-mission report → You
    You review and plan tomorrow
```

### The Breaking Interrupt

Some things can't wait for the morning brief or the wire check. A production incident. A critical vulnerability. A time-sensitive opportunity. For these, either EIC can interrupt you directly.

**Rules for breaking interrupts:**

- Must be genuinely time-sensitive (hours matter, not days)
- The EIC must include a recommended action, not just the problem
- You respond with approve, modify, or "handle it" (delegating the decision back to the EIC)

---

## The Shared Morgue

Both rooms contribute to and read from a shared institutional memory — your Obsidian vault.

### What the Newsroom Files

- Research stories and intel reports
- Community sentiment summaries
- Tool and product reviews
- Travel research and itineraries
- Stakeout dispatch archives
- Source and link libraries

### What the Enterprise Files

- Architecture decision records
- Post-mortems and incident reports
- Technical patterns and conventions
- Dependency audit results
- Performance benchmarks
- Release notes and changelogs

### How It's Used

The morgue librarian in each room knows how to search the full archive. When the Enterprise needs context, it can check what the Newsroom has already reported. When the Newsroom is covering a topic, it can check what the Enterprise has already built or decided.

**The vault is the shared source of truth.** Both rooms read and write. Neither room edits the other's files.

---

## Escalation Patterns

### Simple Escalation

```
Agent encounters something outside their room's scope
    → Reports to their EIC
        → EIC posts to the wire
            → Green wire: other EIC handles it
            → Red wire: queued for owner
```

### Cross-Room Disagreement

```
Newsroom intel says X, Enterprise experience says Y
    → Both EICs post their position to the red wire
        → Owner reviews both positions
            → Owner makes the call
                → Decision filed to the shared morgue
```

### Emergency Coordination

```
Critical incident detected (by either room)
    → EIC triggers breaking interrupt to owner
        → Owner authorises emergency protocol
            → Both rooms coordinate under owner direction
                → Enterprise handles the fix
                → Newsroom monitors community impact
                    → Post-mortem filed to shared morgue
```

---

## Anti-Patterns: What to Avoid

### The Newsroom Engineering

The Newsroom starts suggesting implementation details. "You should use a queue-based architecture for this." That's the Enterprise's domain. The Newsroom reports what the community is doing; the Enterprise decides how to build.

**Fix:** Newsroom reports findings. Enterprise decides approach. If there's a conflict, it goes to you.

### The Enterprise Reporting

The Enterprise starts doing its own research instead of requesting it through the wire. A bridge officer googles a library instead of asking the Newsroom's review desk.

**Fix:** Quick lookups are fine (a commis checking docs). But any research that takes more than a few minutes should go through the wire to the Newsroom, where it'll be done properly and filed to the morgue for future reference.

### The Bypassed Owner

The EICs start making scope and priority decisions between themselves without routing through you. "The Newsroom found this, so the Enterprise is pivoting to build it."

**Fix:** Red wire exists for a reason. Information flows freely; decisions flow through you. Always.

### The Flooded Wire

Every trivial exchange goes through the wire, creating noise. "The Enterprise needs to know the hex code for the primary brand colour" doesn't need to be a wire message.

**Fix:** The wire is for cross-room coordination, not for things an agent can look up in the morgue or resolve within their own room.

### The Silent Enterprise

The Enterprise ships something and doesn't tell the Newsroom. The Newsroom finds out when a street reporter picks up community chatter about a feature they didn't know existed.

**Fix:** Shipped notifications are green wire — they cost nothing and they keep the Newsroom informed. Always file them.

---

## Operating Principles

1. **Information flows freely, decisions flow through you.** This is the whole protocol in one sentence.

2. **The wire is a bus, not a queue.** Messages are published and subscribed to, not assigned. Each EIC decides what's relevant to their room.

3. **Green wire is autonomous.** Trust your EICs to handle informational exchanges without your involvement. That's why you hired them.

4. **Red wire is sacred.** Never let scope, priority, or resource decisions bypass you. That's the owner's job.

5. **The morning brief is the heartbeat.** Even if nothing else works perfectly, a daily sync between both rooms through you keeps everything aligned.

6. **The shared morgue prevents drift.** When both rooms read from and write to the same vault, institutional knowledge compounds instead of fragmenting.

7. **Breaking interrupts are expensive.** Use them sparingly. If it can wait for the next wire check, it should.

8. **Neither room outranks the other.** The EIC and Spock are peers. Disputes go to you, not to each other.

9. **File everything.** Every wire message, every decision, every handoff gets logged. The morgue grows richer with every interaction, and future agents benefit from past coordination.

10. **The owner's attention is the scarcest resource.** The entire protocol is designed to minimise how often you need to be in the loop while ensuring you're always in the loop when it matters.
