# The Newsroom: An Agentic Orchestration Framework for Research & Intelligence

## The Metaphor

A 1920s newsroom was one of the first truly parallel, deadline-driven knowledge work environments. Reporters hit the streets, worked their sources, chased leads, and filed stories. Editors shaped raw intel into something readable and actionable. The newsroom didn't build anything — it found things out and told you about them.

This framework maps that structure onto Claude Code agent orchestration for research, reconnaissance, community intelligence, and story generation. The Newsroom finds the stories. The Enterprise executes the mission.

---

## The Masthead

### The Publisher (You)

You own the paper. You decide what stories matter, what corners need watching, and what's worth a deeper investigation. You read the morning edition, scan the headlines, and decide what makes it onto the Enterprise's mission board for the day.

**You step in for:**

- Assigning stories ("go find out what's happening with Home Assistant voice integrations")
- Deciding which intel is actionable ("that's interesting -- put it on the Enterprise's mission board")
- Killing stories that aren't going anywhere ("drop it, not worth the column inches")
- Approving features and long-form pieces before they publish

### The Editor-in-Chief (Orchestrator Agent)

Runs the newsroom floor. Takes your editorial direction, assigns reporters to beats and corners, manages the editorial calendar, decides what goes above the fold.

**Key responsibilities:**

- Assigning reporters to stories based on your direction
- Prioritising which stories get resources
- Shaping raw intel from reporters into readable briefings
- Deciding what's worth escalating to the publisher
- Coordinating multi-reporter stories that span beats

---

## The Reporting Desks

### Street Reporters (Reconnaissance Agents)

The pavement pounders. You send them to a specific corner with a specific question, they come back with raw intel — headlines, links, key points, sentiment. You scan it in 30 seconds and decide what's worth a deeper story.

**Example assignments:**

- "What shipped in the latest macOS update?"
- "What are people saying about local LLM deployment on Apple Silicon?"
- "What's the current state of play with MCP server protocols?"
- "Find me a holiday spot in Tasmania with good hiking and decent food"
- "What's new in the Home Assistant February release?"

**Operating model:** Low context, high frequency. Give them a topic and a corner, they bring back raw material fast.

### The Stakeout (Monitoring Agents)

A street reporter variant that watches a specific corner over time. Parks on a topic and checks back periodically, filing dispatches with just the deltas — just what changed since last check.

**Example stakeouts:**

- Claude Code GitHub discussions for MCP server changes
- SEEK and LinkedIn for AI/ML engineering roles in Melbourne
- Azure service health for Dynamics 365 and SharePoint
- npm/PyPI for dependency updates on active projects
- Home Assistant release notes and integration changelogs
- Apple developer news and OS beta releases

**Output:** Regular dispatches. "Nothing new on your stakeout this week" is a valid and valuable report.

### The Source Network (Community Intelligence Agents)

Agents that canvas specific communities. They know their patch, their regulars, the local chatter. Not searching broadly — they're embedded in a scene.

**Patches:**

- Reddit (specific subreddits like r/homeassistant, r/localllama, r/reactjs)
- Hacker News (tech discourse, launches, community sentiment)
- GitHub Discussions (project-specific conversations)
- Twitter/X (industry voices, announcements, hot takes)
- Stack Overflow (emerging patterns in questions and answers)
- Discord servers (niche community channels)

**Output:** Pulse reports. "The vibe on r/localllama this week is that Whisper.cpp on M4 is production-ready" or "Three separate HN threads about MCP this week — it's gaining momentum."

### The Tipster Handler (Lead Verification Agent)

Takes vague leads and goes to verify. You say "I heard something about a new MCP file system protocol" and the handler confirms or denies, finds the source, assesses credibility, and brings back a brief.

**Operating model:** You provide the rumour, the handler provides the facts. Saves you the 20 minutes of digging yourself.

### The Foreign Bureau (External Landscape Agent)

Agents that monitor the broader landscape beyond your immediate concerns. Industry trends, competitor moves, technology shifts, regulatory changes.

**Example beats:**

- AI/ML industry developments (new models, new tools, new paradigms)
- Azure and Microsoft ecosystem changes
- React and frontend ecosystem evolution
- Australian tech job market trends
- Smart home and IoT industry movement

**Output:** Weekly or fortnightly landscape briefings. The big picture stuff that's easy to miss when you're heads-down on the Enterprise.

---

## The Editorial Desks

### The Investigative Desk (Deep Research Agents)

Go looking for stories you didn't assign. They dig deeper than the street reporters, follow threads, cross-reference sources, and produce substantial pieces.

**Example investigations:**

- "Compare the top five local LLM serving frameworks for M4 Pro hardware — benchmarks, community health, documentation quality"
- "What are the real-world experiences of people migrating from HomeKit to Home Assistant?"
- "Map the current AI/ML engineering job market in Melbourne — who's hiring, what they want, what they're paying"
- "Deep dive on Azure Dynamics 365 API changes in the last quarter — what broke, what improved, what's coming"

**Output:** Feature-length stories with sources, analysis, and recommendations. These take longer and cost more tokens but produce higher-value intel.

### The Travel Desk (Experience & Destination Agents)

Specialist reporters who research places, experiences, and logistics. Not just "where should I go" but the full story — getting there, staying there, what to do, what to eat, what to avoid.

**Example assignments:**

- "Plan a Boxing Day hiking trip to Tasmania — trails, accommodation, food, logistics"
- "Find me a long weekend getaway within two hours of Melbourne with good Japanese food"
- "Research family-friendly activities in [destination] for a trip with Levi"
- "What's the best way to spend three days in [city] if you love food and walking?"

**Output:** Travel stories with practical detail — itineraries, booking links, local tips, seasonal considerations.

### The Review Desk (Product & Tool Evaluation Agents)

Reporters who evaluate tools, products, and services. They don't just find information — they synthesise it into a recommendation.

**Example assignments:**

- "Review the current options for voice assistants on Home Assistant"
- "Compare Ghostty vs Kitty vs WezTerm — what's the community saying in 2026?"
- "Evaluate the top Obsidian plugins for task management"
- "What's the best approach to running Whisper locally on Apple Silicon right now?"

**Output:** Review pieces with pros, cons, community sentiment, and a recommendation tailored to your context.

### The Morgue Librarian (Institutional Memory Agent)

In old newsrooms, the "morgue" was the archive of clippings and past stories. This agent maintains the newsroom's institutional memory — what you've already researched, what stories have been filed, what decisions were made based on past intel.

**In practice:** Indexes past research in your Obsidian vault so the newsroom doesn't repeat itself. When a street reporter comes back with something, the librarian checks: "we covered this three weeks ago, here's what we found then."

**Outputs:** Context from past research, links to previous stories, "you looked into this before and decided X" reminders.

---

## Story Types

### The Wire Report (Quick Intel)

One reporter, one question, one fast answer. The macOS update check we just did. Firmware status. "Is this thing still in beta?" Low cost, high frequency.

### The Feature Story (Deep Research)

Multiple reporters or one investigative reporter, substantial digging, synthesised output. The kind of thing you'd want to save to your vault and reference later.

### The Column (Regular Beat Coverage)

A recurring assignment on a specific topic. "Every Monday, give me a pulse check on the AI/ML job market in Melbourne." Builds pattern recognition over time.

### The Special Edition (Comprehensive Report)

All hands on deck for a major research effort. "I'm evaluating whether to buy a Mac Mini M4 Pro as a home server — give me the full picture." Multiple reporters covering hardware, software, community experiences, use cases, alternatives.

### The Editorial (Opinion & Analysis)

The newsroom synthesises what it's found and offers perspective. "Based on everything we've seen about local LLM deployment, here's what makes sense for your hardware and use case." Goes beyond facts into recommendations.

### The Bulletin (Monitoring Digest)

Compiled from stakeout dispatches. A regular digest of everything that changed across your watched topics. "Here's your weekly bulletin: macOS 26.3 shipped, Home Assistant 2026.2 dropped, three new AI/ML roles posted in Melbourne, Claude Code got a new MCP feature."

---

## Orchestration Patterns

### Standard Story Assignment

```
Publisher assigns a story
    → EIC assigns to the right reporter(s)
        → Reporter(s) hit the street / sources / community
            → Raw intel filed back to EIC
                → EIC shapes into a readable briefing
                    → Publisher reads and decides: action, archive, or kill
```

### Multi-Source Investigation

```
Publisher asks a big question
    → EIC assigns street reporters to different corners simultaneously
        → Source network checks community sentiment
            → Foreign bureau provides landscape context
                → Investigative desk synthesises everything
                    → EIC assembles the feature story
                        → Publisher reads, decides what goes to the Enterprise
```

### Newsroom → Enterprise Handoff

```
Newsroom surfaces actionable intel
    → Publisher reads the story
        → Publisher decides it's worth building
            → Story becomes a mission on the Enterprise's board
                → Spock picks it up and starts planning the approach
```

---

## Operating Principles

1. **The newsroom finds, the Enterprise builds.** Research and construction are different muscles. Don't mix them.

2. **Street reporters are cheap.** Send them out liberally. A quick recon that comes back empty is still valuable — you now know there's nothing there.

3. **Stakeouts are compounding.** The longer a stakeout runs on a topic, the better the pattern recognition. Weekly dispatches get more insightful over time.

4. **The morgue prevents re-reporting.** Always check what you've already covered before assigning a new story. Institutional memory saves tokens and time.

5. **Not every story makes the paper.** Some intel is interesting but not actionable. The publisher decides what's worth column inches and what gets spiked.

6. **The bulletin is the heartbeat.** A regular digest of watched topics keeps you informed without requiring active attention. Scan it over your morning coffee.

7. **Community pulse beats official announcements.** What people are actually experiencing on Reddit and GitHub is often more useful than release notes. The source network is your most honest reporter.

8. **Every story needs a "so what."** Raw intel without analysis is just noise. The EIC's job is to shape facts into actionable briefings.
