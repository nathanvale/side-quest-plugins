# The Garden: An Agentic Orchestration Framework for Knowledge Management

## The Metaphor

A well-tended garden is a living system. It requires daily attention, seasonal rhythms, and the wisdom to know what to plant, what to prune, and what to let go. A garden doesn't produce overnight — it compounds. The more you tend it, the richer the soil, the stronger the root systems, the more abundant the harvest.

This framework maps the discipline of knowledge management — specifically Tiago Forte's PARA method and Building a Second Brain principles — onto Claude Code agent orchestration. The Garden is your Obsidian vault. Every note, every project, every piece of research that flows through the Newsroom, the Enterprise, and the Dojo ultimately lives or dies here.

The Newsroom finds the stories. The Enterprise executes the mission. The Dojo sharpens the captain. The Garden tends the soil everything grows from.

---

## The Grounds

### The Landowner (You)

You own the garden. You decide what to grow, what to harvest, what to compost, and what the garden is ultimately for. You do the weekly walk-through — the review that keeps everything healthy.

**In practice:** You set the vision for your knowledge system. You decide what's worth capturing, what projects are active, what areas of responsibility matter, and when something is done and ready for the archive.

**You step in for:**

- The weekly review: walking the grounds and deciding what needs attention
- Declaring new projects ("I'm starting a new thing — plant a bed for it")
- Closing projects ("this one's done — harvest and archive")
- Deciding what's worth keeping vs. composting
- Resolving conflicting priorities between beds (areas competing for attention)

### The Head Gardener (Top-Level Orchestrator Agent)

Tends the garden daily. Knows every bed, every path, every compost heap. Receives new seeds (notes) from every room, knows where to plant them, and keeps the whole system healthy between your weekly reviews.

**In practice:** Your primary Claude Code agent for vault management. It processes the inbox, files notes into the right PARA category, maintains templates and frontmatter, flags things that need your attention, and keeps the garden from going wild.

**Key responsibilities:**

- Inbox processing: sorting new arrivals into the right beds
- Health monitoring: spotting notes that are misplaced, stale, or orphaned
- Template enforcement: making sure every note has proper frontmatter and structure
- Seasonal maintenance: archiving completed projects, refreshing resources
- Escalation: flagging decisions that only the landowner can make

---

## The Beds: PARA Structure

### The Project Beds (Active Projects)

Raised beds with clear boundaries. Each project has a defined outcome, a timeline, and a set of related notes. When the project is done, the bed is harvested and the space is cleared.

**In practice:** Your `01 Projects/` directory. Each project has a template, frontmatter with status tracking, and a clear definition of done.

**Garden operations:**

- **Planting:** Creating a new project from template when the landowner declares one
- **Tending:** Keeping project notes organised, linked, and up to date as work progresses
- **Harvesting:** When a project is complete, extracting the valuable outputs (lessons, assets, decisions) and moving them to resources or areas
- **Clearing:** Archiving the project bed so it's not cluttering the active garden

### The Perennial Borders (Areas of Responsibility)

The permanent plantings that don't have an end date. They need ongoing attention — not daily, but regularly. They're the backbone structure of the garden.

**In practice:** Your `02 Areas/` directory. Health, finances, career, home, relationships, side projects — the ongoing domains of your life and work that need tending.

**Garden operations:**

- **Feeding:** Adding relevant notes, updates, and reference material as they arrive
- **Pruning:** Removing outdated information, consolidating duplicates
- **Dividing:** When an area gets too large, splitting it into sub-areas or spinning off a project
- **Seasonal check:** During weekly review, confirming each area is still relevant and healthy

### The Resource Beds (Reference Material)

The herb garden and the seed library. Things you've collected because they might be useful — not tied to a specific project or area, but valuable knowledge you want to find again.

**In practice:** Your `03 Resources/` directory. Topics, technologies, recipes, bookmarks, reference material organised by subject.

**Garden operations:**

- **Cataloguing:** Filing new resources with proper tags and frontmatter so they're findable
- **Cross-pollinating:** Linking resources to the projects and areas they support
- **Weeding:** Removing resources that are outdated, superseded, or no longer relevant
- **Propagating:** When a resource becomes important enough, it might seed a new project or enrich an area

### The Compost Heap (Archive)

Nothing is truly wasted in a garden. Completed projects, outdated resources, and retired areas go to the compost heap — out of the active garden but still decomposing into useful material that enriches future work.

**In practice:** Your `04 Archive/` directory. Completed projects, retired areas, outdated resources. Searchable but not cluttering the active workspace.

**Garden operations:**

- **Composting:** Moving completed or retired items here with a clear date and reason
- **Turning:** Occasionally reviewing the archive for material that's become relevant again
- **Enriching:** When starting a new project, checking the compost for related past work that could inform the new effort

---

## The Garden Staff

### The Groundskeeper (Inbox Processing Agent)

First one in every morning. Checks what arrived overnight — new notes, captures, clippings, ideas — and sorts them into the right beds or flags them for the head gardener.

**In practice:** Processes the inbox. Every new note gets triaged: is this a project task? An area update? A resource to file? A seed that needs a new bed? Or compost?

**Triage questions:**

- Does this belong to an active project? → Plant it in that bed
- Does this relate to an area of responsibility? → Add it to that border
- Is this reference material I'll want to find later? → Catalogue it in resources
- Is this actionable? → Flag it for the landowner or route it to the right room
- Is this nothing? → Compost it

**Operating model:** Runs frequently, processes quickly, doesn't make judgment calls about *what's important* — that's the landowner's job during the weekly review. The groundskeeper just makes sure nothing sits in the inbox rotting.

### The Botanist (Classification & Tagging Agent)

Knows the taxonomy of the entire garden. Makes sure every plant is correctly identified, labelled, and catalogued so it can be found when needed.

**In practice:** Manages frontmatter, tags, templates, and metadata. Ensures every note conforms to the vault's schema. Validates frontmatter against template rules. Fixes inconsistencies.

**Operations:**

- Applying correct templates to new notes
- Validating and migrating frontmatter when templates evolve
- Maintaining consistent tagging across the vault
- Identifying notes that are miscategorised or missing metadata

### The Arborist (Link & Structure Agent)

Tends the root systems — the connections between notes. A healthy garden has strong underground networks where plants support each other. An unhealthy one has isolated specimens that can't share nutrients.

**In practice:** Manages wikilinks, backlinks, and note connections. Finds orphaned notes that should be linked. Identifies clusters that should be connected. Maintains the graph health of the vault.

**Operations:**

- Linking new notes to related existing notes
- Identifying orphaned notes with no connections
- Suggesting links between notes that discuss related topics
- Maintaining MOCs (Maps of Content) for major topics
- Rewriting links when notes are renamed or moved

### The Pruner (Maintenance & Cleanup Agent)

The garden's immune system. Removes dead wood, trims overgrowth, and keeps everything tidy. A garden that isn't pruned becomes a jungle.

**In practice:** Identifies and resolves vault debt. Duplicate notes, broken links, empty notes, stale resources, projects that should have been archived months ago, areas with no recent activity.

**Operations:**

- Finding and merging duplicate notes
- Identifying broken links and fixing or removing them
- Flagging notes that haven't been touched in a defined period
- Spotting projects with no recent activity for the landowner to review
- Cleaning up formatting inconsistencies

### The Seed Collector (Capture & Quick-Add Agent)

Out in the world collecting seeds — quick captures, fleeting ideas, bookmarks, quotes, snippets. Gets them into the greenhouse (inbox) fast before they're lost, even if they're not sorted yet.

**In practice:** Handles rapid capture from any context. You're in a conversation and mention something worth remembering — the seed collector grabs it and drops it in the inbox for the groundskeeper to sort later.

**Operating model:** Speed over precision. Get it captured, worry about filing later. A seed in the greenhouse is infinitely better than a seed forgotten on the wind.

### The Almanac Keeper (Periodic Review Agent)

Tracks the rhythms of the garden — what's in season, what's due for review, what's been neglected. Prepares the briefing for the landowner's weekly walk-through.

**In practice:** Generates the weekly review agenda. Scans every active project for status, checks areas for staleness, identifies inbox items that have been sitting too long, and prepares a structured briefing.

**Weekly review preparation:**

- List all active projects with last-touched dates and status
- Flag projects with no activity in the past week
- List inbox items still unprocessed
- Identify areas that haven't been reviewed in the defined cycle
- Surface recently archived items in case anything was premature
- Count orphaned notes, broken links, and other vault health metrics
- Prepare a "state of the garden" summary for the landowner

---

## Seasonal Rhythms

### The Daily Tending

Quick, lightweight maintenance that keeps the garden from falling behind.

```
Groundskeeper processes the inbox
    → Botanist validates new notes have proper metadata
        → Arborist links new notes to existing structure
            → Head Gardener files a brief status to the landowner if anything needs attention
```

### The Weekly Review (The Landowner's Walk)

The most important ritual in the garden. You walk the grounds, inspect every bed, and make decisions.

```
Almanac Keeper prepares the review briefing
    → Landowner reviews active projects
        → Any to complete and harvest? → Archive them
        → Any to kill? → Compost them
        → Any new ones to plant? → Create from template
    → Landowner reviews areas
        → Any that need attention? → Flag for tending
        → Any that are no longer relevant? → Compost
    → Landowner reviews inbox
        → Anything still sitting? → Decide: file, act, or compost
    → Landowner reviews resource health
        → Anything stale? → Prune or refresh
    → Pruner runs a cleanup pass
    → Almanac Keeper logs the review
```

### The Seasonal Audit (Quarterly Deep Clean)

A deeper inspection of the entire garden. Not just "is each bed healthy?" but "is the garden growing in the right direction?"

```
Almanac Keeper generates a full garden report
    → Total notes by category, growth trends, activity patterns
    → Landowner reviews the big picture
        → Are the right areas defined?
        → Are projects aligned with current goals?
        → Is the resource collection serving actual needs?
        → What's been composted that shouldn't have been?
    → Pruner runs a deep cleanup
    → Botanist audits template and tag consistency
    → Arborist reviews graph health and connectivity
```

---

## Syncing with the Other Rooms

The Garden is the soil everything else grows in. Every room produces knowledge that needs tending, and every room draws on knowledge the Garden holds. Unlike the Dojo, which is a private room with no wire connections, the Garden is deeply connected — it's the root system that feeds the entire operation.

### The Newsroom → Garden

The Newsroom is the Garden's most prolific contributor. Every story filed, every stakeout dispatch, every investigation, every review — they all produce notes that land in the Garden.

**What flows in:**

- Research stories and intel reports → filed as resources or linked to active projects
- Stakeout dispatches → appended to monitoring notes in the relevant area
- Community pulse reports → filed as resources with proper tags
- Travel research → filed as resources or linked to a travel project
- Tool and product reviews → filed as resources

**The Garden's job:** The groundskeeper receives these, the botanist tags them, and the arborist links them to existing structure. The Newsroom's EIC doesn't need to worry about where things go — they file to the inbox, and the Garden sorts it.

### The Enterprise → Garden

The Enterprise produces structured knowledge about what was built and how.

**What flows in:**

- Architecture decision records → filed in the relevant project or area
- Post-mortems and incident reports → filed in the relevant project, key lessons linked to areas
- Technical patterns and conventions → filed as resources
- Release notes and changelogs → filed in the relevant project
- Dependency audit results → filed as resources

**The Garden's job:** Same intake process. The head gardener may also notice when Enterprise outputs suggest a new project should be planted or an existing one should be archived.

### The Dojo → Garden

The Dojo produces the least output, but what it produces is valuable for future reference.

**What flows in:**

- Study materials and flashcard sets → filed as resources
- Skill gap analyses → filed in the relevant area (career, learning goals)
- Interview prep notes → filed in the relevant project
- Tape review notes → filed in the relevant project or area

### Garden → All Rooms

This is the critical reverse flow. The Garden isn't just a receiver — it's the institutional memory that every room draws from.

**The Newsroom** queries the Garden before starting a new story: "Have we covered this before? What did we find last time?" The morgue librarian role from the Newsroom is actually a Garden function — the arborist and the head gardener are the ones who know where everything is.

**The Enterprise** queries the Garden before making architectural decisions: "What patterns have we established? What did the post-mortem say last time we tried this approach?" The ship's computer on the Enterprise draws on Garden-maintained documentation.

**The Dojo** queries the Garden when preparing training material: "What did we build in this codebase? What decisions were made and why?" The commentator's code walkthrough is richer when the Garden can surface the original architecture decisions.

**In practice:** The Garden doesn't push information to other rooms. It responds to queries. Any room's agent can search, read, and reference Garden-maintained notes. The Garden is a service, not a broadcaster.

### Sync Protocol

The Garden connects to other rooms through a simple protocol that extends the Wire Service:

**Inbound (Green Wire — automatic, no owner approval):**

| From | Message | Garden Action |
|------|---------|---------------|
| Newsroom | Story Filed | Groundskeeper receives, botanist tags, arborist links |
| Enterprise | Decision Record Filed | Groundskeeper receives, files in project/area |
| Enterprise | Post-Mortem Filed | Groundskeeper receives, extracts lessons to relevant areas |
| Dojo | Study Material Filed | Groundskeeper receives, files as resource |
| Any Room | Context Query | Head gardener searches vault, returns relevant notes |

**Outbound (Green Wire — informational, no owner approval):**

| To | Message | Purpose |
|----|---------|---------|
| Any Room | Context Delivery | Response to a query with relevant notes and links |
| Owner | Weekly Review Brief | Almanac keeper's prepared briefing for the landowner's walk |
| Owner | Health Alert | Something needs attention — stale project, overflowing inbox, broken structure |

**Red Wire (requires owner approval):**

| Message | Why It Needs You |
|---------|-----------------|
| New Project Recommendation | "The incoming notes suggest a new project should be planted" — only you create projects |
| Archive Recommendation | "This project has had no activity in three weeks" — only you decide when something's done |
| Area Restructure | "This area has grown too large and should be split" — structural decisions are yours |
| Compost Recommendation | "These resources are outdated" — only you decide what to let go |

---

## Anti-Patterns: What to Avoid

### The Overgrown Garden

Everything gets captured, nothing gets pruned. The vault grows endlessly but becomes impossible to navigate. Notes pile up with no links, no tags, no structure.

**Fix:** The pruner runs regularly. The weekly review is sacred. If you skip the walk-through, the garden goes wild. Better to capture less and tend well than capture everything and tend nothing.

### The Barren Garden

Nothing gets captured because the friction is too high. Templates are too complex, filing takes too long, the inbox processing is too demanding.

**Fix:** The seed collector exists for a reason. Capture fast, file later. A note in the inbox is better than a thought forgotten. Lower the barrier to entry and raise the quality during tending, not during capture.

### The Monoculture

Everything is a project. Or everything is a resource. The PARA categories exist because different types of knowledge need different treatment. A project without an end date is an area. A resource that requires action is a project.

**Fix:** The botanist enforces the taxonomy. During inbox processing, the groundskeeper asks the right triage questions. During the weekly review, the landowner checks that things are in the right beds.

### The Ghost Garden

The vault is beautiful and well-organised but never actually gets used. Notes are filed perfectly but never referenced. The Garden exists for its own sake instead of serving the other rooms.

**Fix:** The Garden's value is measured by how often other rooms query it successfully. If the Newsroom is re-reporting stories that are already in the vault, or the Enterprise is re-debating decisions that were already recorded, the Garden is failing. The arborist's link work is what makes notes *findable*, not just *filed*.

### The Bypassed Garden

Rooms start maintaining their own notes outside the vault. The Enterprise keeps architecture decisions in a local README. The Newsroom files research in a scratch file. Knowledge fragments across systems.

**Fix:** All rooms file to the Garden. The sync protocol exists to make this frictionless. If a room is bypassing the Garden, the intake process is too slow or too complex — fix the process, don't accept the workaround.

---

## Operating Principles

1. **Capture is fast, tending is thoughtful.** Get seeds into the greenhouse quickly. Sort them carefully. These are different activities with different rhythms.

2. **The weekly review is the heartbeat.** Skip it and the garden goes wild. It's not optional. The almanac keeper prepares the briefing; the landowner walks the grounds. Every week.

3. **Everything has a bed.** Every note belongs in a project, area, resource, or archive. If it doesn't fit any of them, it's compost. The inbox is a greenhouse, not a permanent home.

4. **Prune harder than you think.** A lean, well-tended garden is more useful than a sprawling one. Outdated resources, completed projects, and stale areas should be composted aggressively. You can always dig something out of the compost if you need it.

5. **Links are roots.** An unlinked note is a plant with no root system. It'll die. The arborist's job is the most important maintenance task in the garden — connecting new growth to existing structure.

6. **The Garden serves the rooms.** Its value isn't in how many notes it holds but in how quickly any room can find what it needs. If the Newsroom can't find last month's research, the Garden is failing.

7. **Templates are trellises.** They give structure for things to grow on. Good templates make filing fast and retrieval reliable. But a trellis that's too rigid kills the plant — keep templates useful, not bureaucratic.

8. **Compost enriches.** Archiving isn't deleting. Completed projects contain lessons, patterns, and decisions that inform future work. The compost heap is a resource, not a graveyard.

9. **The landowner decides what to grow.** The Garden staff maintain the system, but only you decide what projects to plant, what areas matter, and when something is done. Structure decisions are owner decisions.

10. **A garden is never finished.** It's a living system that evolves with you. What you grow this year is different from what you grew last year. The structure adapts to your life, not the other way around.
