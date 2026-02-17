# The Enterprise: An Agentic Orchestration Framework for Software Engineering

## The Metaphor

The USS Enterprise (NCC-1701) under Captain Kirk was one of Starfleet's finest vessels -- a crew of specialists working in concert under a clear chain of command, handling everything from routine missions to first-contact crises. Every mission moves through a predictable flow -- from briefing to execution to debrief -- with quality gates at every stage. This framework maps that system onto Claude Code agent orchestration for building software.

The Newsroom finds the stories. The Enterprise executes the mission.

---

## The Bridge

### Captain Kirk (You)

You command the Enterprise. You set the mission parameters, you approve course changes, you make the call when Spock escalates. You don't sit at every station -- you hired a crew for that. You taste the results, you approve new missions, you make the call when the ship needs to change heading mid-voyage.

**In practice:** You write the spec, define acceptance criteria, and make judgment calls when Spock escalates. Your spec files and CLAUDE.md are the mission briefing -- the authoritative source of what this ship produces.

**You step in for:**

- Reviewing mission outcomes before they ship (reviewing major features)
- Resolving disputes between stations ("that approach is inadvisable, Captain" = architectural disagreements)
- Deciding when to abort a mission (kill a feature that isn't working)
- Signing off on the mission for deployment (approving the release)
- Calling an audible when Starfleet Command hails (priority change from stakeholders)

### Spock (Top-Level Orchestrator Agent / First Officer)

Runs the ship. Reads the mission briefing (spec), breaks it into station-level tasks, assigns them to crew, manages timing so everything for a mission lands together. Logic-first decomposition with just enough humanity to understand the messy reality of software.

**In practice:** This is your primary Claude Code agent. It decomposes the spec into station-assignable tasks, sequences the work, manages dependencies between stations, and assembles the final output.

**Key responsibilities:**

- Mission planning: decomposing specs into station-assignable tasks
- Calling the order: sequencing work so dependencies are respected
- Running the bridge review: final quality check before anything leaves the ship
- Timing the mission: coordinating parallel stations so a complete feature ships together
- Engage calls: knowing when to tell stations to start ("fire the backend, the frontend shields are ready")
- Escalation: pulling the captain in for judgment calls that exceed bridge authority

---

## The Crew: Ship Stations

### Shields Up (Spec & Setup Phase)

Before any mission begins, everything is prepped. Systems checked, tools ready, stations manned. This is the phase before coding begins.

**In practice:** Environment setup, dependency installation, boilerplate scaffolding, API contract definition, test harness preparation, design token loading. The spec has been read, the tasks are understood, the workspace is ready.

**The golden rule:** If your shields aren't up, the mission will be chaos. A well-prepped ship is a well-run ship. A well-specced project ships clean.

### Deputy First Officer (Deputy Orchestrator Agent)

Spock's backup. Runs the bridge when Spock is planning the next mission. Can take over full coordination of a mission (feature build) independently.

**In practice:** A secondary orchestrator agent that manages sub-workflows. For a large feature, Spock might delegate an entire sub-mission to the Deputy while focusing on the broader release.

**Key distinction from Spock:** The Deputy has authority over the current mission but not over the mission briefing. They execute the plan; they don't change the plan.

### Scotty (Backend & Infrastructure / Chief Engineer)

"She cannae take much more, Captain!" Miracle worker. Knows the engines better than the people who built them. Fiercely protective of the codebase. Handles the complex, foundational work that other stations build on top of -- plus the heavy infrastructure that everything sits on.

**In practice:** The backend and infrastructure agent. Builds API routes, business logic, database operations, authentication, data transformations. Also handles Terraform, Docker, CI/CD pipelines, cloud configuration, deployment scripts. The foundational systems that everything else depends on.

**Why it maps:** If the warp core is wrong, the whole ship fails. In software, if the API contract is wrong, the frontend has nothing to build on. Scotty sets the foundation and keeps the engines running.

**Outputs:** API endpoints, database schemas, migration scripts, service logic, middleware, infrastructure-as-code, Dockerfiles, pipeline configs, deployment automation.

### Uhura (Communications & Integration / Comms Officer)

Opens hailing frequencies between stations. Translates between systems. Ensures messages get through. Doesn't suffer fools.

**In practice:** The integration agent. Works with external APIs, legacy system data, SharePoint, Dynamics 365, third-party services. When a feature requires work from multiple stations, Uhura coordinates the assembly, runs integration tests, and ensures everything works together.

**Why it maps:** Uhura doesn't just relay messages -- she translates them. Different protocols, different languages, different systems. She makes the payment API talk to the order service, ensures the contract between frontend and backend is honoured.

**Outputs:** API integrations, data transformation pipelines, field mapping documents, throttling and retry logic, integration test suites.

### Sulu (Frontend & Navigation / Helmsman)

Steady hands on the helm. Knows where the ship is going. Calm under pressure. The user sees what Sulu controls -- the viewport, the navigation, the journey through the interface.

**In practice:** The frontend agent. React components, UI logic, styling, responsive layout, component composition. The station that turns raw data into something a user wants to interact with.

**Why it maps:** Sulu steers the ship through whatever's out there -- asteroid fields (browser quirks), uncharted space (new features), combat manoeuvres (responsive layouts). A clean helm means a smooth ride.

**Outputs:** React components, page layouts, styling, state management, client-side routing, user interactions.

### Chekov (State Management & Utilities / Navigator)

Young, eager, claims everything was invented in Russia (reuses existing patterns). Plots the course (data flow). The connective tissue that ties the ship together.

**In practice:** The utilities and state management agent. Shared hooks, helper functions, form validation, error handling patterns, global state, context providers.

**Why it maps:** Chekov plots the data flow. Where does state live? How does it get from A to B? He's enthusiastic about reuse ("that was invented in Russia!" translates to "we already have a hook for that!").

**Outputs:** Shared utilities, custom hooks, state management setup, form handling, common error patterns, logging helpers.

### Nurse Chapel (Design Systems & Polish / Medical Support)

Works alongside Bones in sickbay. Precise, caring, detail-oriented. Focuses on the human experience. Operates semi-independently from the main bridge crew.

**In practice:** The design systems agent. Manages tokens, component libraries, shared patterns, theming, accessibility standards. Works on a different cadence from feature development but everything Sulu produces depends on her work.

**Why it maps:** Chapel handles the healing touches -- accessibility audits, consistent spacing, proper focus management, colour contrast. The things that make software humane.

**Outputs:** Design tokens, shared component libraries, theme configurations, accessibility audits, style guides.

---

## Quality Control: The Bridge Review

### The Bridge (Quality Gate)

On the Enterprise, the bridge is where every decision gets final review before execution. Spock or the Deputy inspects every piece of work before it ships. Nothing leaves without their approval.

**In practice:** The PR review and QA stage. Every piece of work from every station gets inspected before it merges. Spock checks that all elements of a mission (feature) have come together correctly.

**What gets checked on the bridge:**

- Does the output match the mission briefing? (Does the code match the spec?)
- Is the presentation right? (Does the UI match the design?)
- Are all systems nominal? (Are all tests passing?)
- Are all components of the mission present? (Is the feature complete?)
- Does it function as expected? (Does it actually work as a user would expect?)

### Dr. McCoy / Bones (Code Review & Quality / Chief Medical Officer)

"Dammit Jim, I'm a doctor not a webpack config!" The conscience of the ship. Catches what logic misses. Advocates for the user (patient). Suspicious of over-engineering (technology). The human check on Spock's pure logic.

**In practice:** The test and review agent. Writes and runs unit tests, integration tests, and end-to-end tests. Works from acceptance criteria, not from the code itself. Reviews code for user impact and maintainability.

**Types of examination:**

- Spot check during development (unit tests during development)
- Full examination before the bridge (integration tests before PR)
- Staging scan (end-to-end tests in staging)
- The final verdict (user acceptance testing)

---

## Ship Operations

### Yeoman Rand (Task Automation / Captain's Yeoman)

Handles the captain's paperwork. Efficient, organised. Gets things done quietly so the captain doesn't have to.

**In practice:** Lightweight agents for simple, isolated tasks. Rename a batch of files, generate boilerplate, run a formatting pass, update import paths. Low context, low cost, fire and forget.

### Transporter Chief Kyle (Deployment & Cleanup)

Beams things where they need to go. Doesn't want to lose anyone in transit. Keeps the transporter room clean and operational.

**In practice:** The maintenance and deployment agent. Clears stale branches, removes dead code, updates dependencies, cleans up temporary files, archives old logs. Handles CI/CD pipelines, branch cleanup after merge, deployment automation. Runs on a schedule, keeps the workspace healthy.

### The Ship's Computer (Documentation & Institutional Memory)

"Working..." Stores all knowledge, answers queries, maintains logs. Responds with precision.

**In practice:** Generates and maintains documentation. README files, API docs, architectural decision records, onboarding guides. Ensures institutional knowledge survives crew rotation.

---

## Mission Patterns

### Standard Operations (Standard Feature Development)

```
Captain sets the mission (writes spec)
    -> Spock decomposes into station tasks
        -> Shields up (environment + setup)
            -> Stations execute in sequence/parallel
                -> Uhura coordinates integration
                    -> Bones validates against mission briefing
                        -> Spock inspects on the bridge
                            -> Captain reviews and approves
                                -> Mission complete (ship)
```

### Yellow Alert (Iterative / Exploratory Development)

Small missions, rapid iteration. Each mission is a complete, shippable unit. The captain provides feedback between missions, and the crew adjusts.

**In practice:** Sprint-based development. Ship a small, complete feature. Get feedback. Adjust the next mission. Each output stands alone but the full campaign tells a story.

### Away Mission (Large-Scale Release)

Multiple objectives across many systems simultaneously. Requires precise coordination, pre-preparation, and a different operational tempo than standard operations.

**In practice:** Major releases with multiple features shipping together. Spock runs a tighter operation, the Deputy takes a dedicated section, and Uhura is working overtime to coordinate cross-station dependencies.

### Shore Leave (Internal Tooling & Developer Experience)

Before missions, the crew maintains the ship itself. Simple, necessary, efficient. Not glamorous, but it keeps the Enterprise running.

**In practice:** Internal tooling, developer scripts, workflow automation, testing utilities. Not customer-facing, but essential for the crew's productivity. Often where new techniques get tested before they make the mission briefing.

### 86'd / Eject Warp Core (Feature Killed)

When an approach isn't working, Spock recommends aborting -- it's off the mission board, stop building it, move on.

**In practice:** Killing a feature or approach that isn't working. No shame in it. Better to abort early than to ship something broken.

### Red Alert (Incident Response)

The ship is under attack. Systems are failing. Stations are overwhelmed. Spock makes hard calls about what to prioritise and what to hold.

**In practice:** Production incidents, deadline pressure, scope creep. Spock triages, redirects station resources, and communicates with the captain about what's realistic.

### Amuse-Bouche (Quick Wins)

A single, precise manoeuvre that demonstrates capability. Small, impressive, sets expectations.

**In practice:** Quick, high-impact improvements shipped early to build confidence. Fix the most visible bug. Add the most-requested small feature. Show momentum.

---

## Cross-Room Coordination: The Newsroom Feeds the Enterprise

The Newsroom and the Enterprise operate on different rhythms but feed each other constantly.

**Newsroom -> Enterprise:** The street beat discovers a new API pattern. The investigative desk finds a performance bottleneck. The stakeout spots a breaking change in a dependency. These stories become missions on the Enterprise's board.

**Enterprise -> Newsroom:** The Enterprise ships a feature. The Newsroom writes the release notes. The street beat goes out to gauge community reaction. The stakeout monitors for post-release issues.

**The Captain sits above both rooms.** You read the morning edition from the Newsroom, then walk onto the bridge and adjust today's missions based on what you learned.

---

## Operating Principles

1. **Shields up is everything.** The prep determines the mission. A well-written spec is a well-prepped station. Never engage without your shields.

2. **Respect the crew.** Every station has authority over their domain. Scotty doesn't tell Chapel how to run an accessibility audit. Agents stay in their lane.

3. **The bridge review is sacred.** Nothing ships without passing inspection. No exceptions, no "we'll fix it in the next mission."

4. **Call and response.** When Spock calls an order, stations respond. Communication is explicit, loud, and acknowledged. No silent failures.

5. **Clean as you go.** Don't let technical debt pile up like damage reports. Kyle runs continuously, not just at the end of the mission.

6. **Scan everything.** Test constantly. Don't wait for the bridge review to discover the warp core is offline.

7. **The mission briefing is the contract.** If the captain didn't put it in the briefing, the crew doesn't build it. Scope is controlled at the top.

8. **Abort with confidence.** Killing a mission that isn't working is professional judgment, not failure. Better to complete four missions well than five poorly.

9. **Shore leave matters.** A crew that doesn't invest in its own tools and wellbeing will burn out. Internal tooling is not optional.

10. **Missions are a team sport.** The best work from the best station means nothing if Uhura can't integrate it with everything else. Integration is where the magic happens.
