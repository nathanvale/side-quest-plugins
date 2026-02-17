# The Enterprise Taxonomy Review: What Three Judges Found

*Your blueprint for the USS Enterprise plugin went through three independent review passes. All three came back with the same verdict: REQUEST CHANGES. Here's what they found, why it matters, and what to do about it.*

---

## The Big Picture

You wrote a plan that does something ambitious: map every Star Trek TOS bridge officer to a composable skill system, define three types of skills (action, knowledge, program), and design a multi-station `engage` pipeline that orchestrates full implementation cycles.

The concept is strong. The taxonomy is clean. The TOS metaphors actually work (Sulu as frontend/helm is genuinely clever). But the plan has a gap between vision and buildability -- it describes the destination without enough detail about the road.

Think of it like this: you've drawn a beautiful schematic of a starship, but the engineering section doesn't have plumbing diagrams yet.

---

## The Three Lenses

Each review pass looked at the plan through a different lens:

| Pass | Focus | Analogy |
|------|-------|---------|
| **Architecture** | Does the structure hold together? | "Is the blueprint structurally sound?" |
| **Spec Quality** | Can someone implement from this? | "Can a builder read these blueprints?" |
| **Feasibility** | Will it actually work in Claude Code? | "Can we afford to build this ship?" |

---

## The Findings That Matter Most

### 1. The `engage` Pipeline Will Blow Up (Critical)

**The vision:** Spock reads a plan, then dispatches 5+ stations sequentially -- Rand scaffolds, implementers build, Chapel polishes, McCoy reviews, Kyle deploys.

**The problem:** In Claude Code, each station would be a separate sub-agent via the Task tool. Each sub-agent starts with a blank slate. Station 3 (Chapel) literally cannot see what Station 2 (Sulu) produced unless you re-read every modified file and paste it into the next prompt.

**The math:**
- Each sub-agent dispatch costs ~4,000-7,000 tokens overhead
- 5 stations = 20,000-35,000 tokens just in orchestration tax
- Plus each station needs to re-read the codebase context
- Estimated cost per `engage` run: **$2.00-3.50** (vs $0.43-0.50 for a single `scan`)

**What this means:** The full pipeline as designed is architecturally infeasible for v1. It's not a "hard" problem -- it's a "wrong abstraction" problem. You're trying to build a pipeline out of independent agents that need shared state.

**The fix:** Start with a 2-station `engage`: one agent implements, McCoy reviews. That's it. The other stations become optional follow-up commands the user invokes. Build the orchestra after proving the duet works.

---

### 2. Nobody Knows Where Skills Live on Disk (Critical)

**The plan says:** There are three skill types -- action, knowledge, program.

**The plan doesn't say:** Where any of them live in the filesystem, what files they consist of, or how they relate to the existing directory structure.

Your codebase already has a clear layout:

```
plugins/enterprise/skills/
  the-bridge/SKILL.md          # Spock's orchestrator
  stations/medical/SKILL.md    # McCoy
  stations/engineering/SKILL.md # Scotty (stub)
  ops/computer/SKILL.md        # Ship's Computer
  programs/readme/SKILL.md     # CPU instruction set
  programs/code-review/SKILL.md
```

But the plan introduces "action skills" and "knowledge skills" with zero mapping to directories. Is Sulu's `frontend-impl` at `skills/stations/helm/SKILL.md`? At `skills/actions/frontend-impl/SKILL.md`? Nobody knows.

**Why this matters:** A spec that doesn't tell you what files to create isn't a spec -- it's a wish list.

---

### 3. Action Skill vs Program -- Which Is It? (Critical)

Here's the confusion. The plan says:

- McCoy **owns** the `code-review` action skill
- Programs are "instructions for the Ship's Computer"
- The codebase has `programs/code-review/SKILL.md`

So is `code-review` an action skill (McCoy's) or a program (Computer's)? The answer is: it's both, but the plan never explains the relationship.

**The missing sentence:** "An action skill is a capability an officer OWNS. When executing it, the officer DISPATCHES one or more programs to the Ship's Computer. McCoy owns code-review; the Computer executes `program-code-review`."

That one clarification would resolve a lot of ambiguity.

---

### 4. The Composition Hierarchy Is Upside Down

The plan shows this tree:

```
Commands > Officers > Action Skills > Knowledge Skills > Programs
```

This implies Programs are nested inside Knowledge Skills. But that's backwards -- programs aren't a sub-type of knowledge. They're dispatched by officers alongside knowledge. The real relationship is a graph, not a tree:

```
Officer
  |-- dispatches --> Programs (to Ship's Computer)
  |-- reads ------> Knowledge Skills (for context)
  |-- executes ---> Action Skills (the work itself)
```

---

### 5. Kirk Can't Be Both the User AND a Crew Member

Throughout the existing codebase, "the Captain" is the user. The bridge SKILL.md says it explicitly: "The Captain = The user."

But the plan lists Kirk as primary handler for `/enterprise:away-mission` -- "Kirk + landing party."

This is an identity collision. If Kirk IS the user, he can't also be an AI agent handling commands. The fix: `away-mission` is user-led, with Spock as AI advisor assembling a landing party. Kirk doesn't appear in the crew roster.

---

### 6. Seven New Characters With No Voice

The character voice spec (`enterprise-character-voices.md`) covers four characters: Spock, McCoy, Ship's Computer, and Scotty.

The plan introduces **seven more**: Sulu, Chekov, Uhura, Chapel, Rand, Kyle, and Kirk. None have voice definitions. None have station SKILL.md files. None have programs. They exist as one-line descriptions.

**The reviewers' take:** For MVP, collapse to 4 operational officers (Spock, McCoy, Scotty, Computer). The other six are expansion slots, not defined crew. Don't pretend to own something you haven't built yet.

---

### 7. The Plan Says "Four Sections" But Has Six

This one's simple. Line 14 says "The spec covers four sections" but there are actually six numbered sections (Skill Types, Command Map, Crew Roster, Knowledge Skills, Engage Pipeline, Implementation Priority). Probably sections 5 and 6 were added after the intro was written.

Fix: change "four" to "six."

---

### 8. Knowledge Skills Are the Best Idea With the Least Definition

The concept of knowledge skills is genuinely elegant. The same knowledge (`sidequest-core`) serves different purposes depending on who reads it:

- **Spock** reads it to know which utilities to reference in a plan
- **Scotty** reads it to know which imports to use
- **McCoy** reads it to flag cases where someone rolled their own

That's a real insight about prompt composition. But the plan defines zero implementation details:

- What format? (SKILL.md? Plain markdown? JSON?)
- Where do they live? (`skills/knowledge/`?)
- How does injection work? (Preloaded? Read at dispatch time?)
- Are they plugin-shipped or user-defined?

---

### 9. Prior Reviews Got Ignored

Three existing review passes (in `specs/reviews/`) all returned REQUEST CHANGES with specific findings:

- Token inefficiency (~6,500 static tokens per run)
- Boundary leaks (Spock both orchestrates AND executes)
- Sub-agent overhead not justified for v1

The taxonomy plan doesn't reference any of these. It actually makes some worse -- adding knowledge skills increases the prompt tax, and the engage pipeline multiplies the sub-agent overhead.

**The fix:** Add a section that cross-references each prior finding and states whether it's addressed, deferred, or deliberately rejected.

---

## What the Reviewers Liked

It wasn't all bad. Highlights:

- **The three-tier taxonomy is conceptually clean.** Action/knowledge/program maps to real concerns in prompt engineering: execution, context, and instructions.
- **TOS metaphors genuinely work.** Sulu as frontend (helm/navigation = UI), Chekov as state (navigator/coordinates), Uhura as integration (comms). Not forced.
- **Priority ordering is pragmatic.** Chart and refit as P1 is the right call -- they enable engage without requiring the full crew.
- **"Not every engagement needs every officer"** saves the pipeline from rigid over-orchestration.
- **The knowledge skill insight is real.** Same data, different purpose depending on the reader. That's a composability principle worth building around.

---

## The Recommended Path Forward

The reviewers converged on a clear action plan:

### Immediate Fixes (before implementation)

1. Fix section count ("four" -> "six")
2. Add filesystem layout section mapping every skill type to a path
3. Clarify action-vs-program relationship with one clear sentence
4. Fix the composition hierarchy (graph, not tree)
5. Resolve Kirk (user = Captain, Kirk is not a crew handler)
6. Define knowledge skill contract (format, location, injection)
7. Cross-reference the 3 prior review findings

### Scope Reduction

8. Collapse crew to 4 for MVP: Spock, McCoy, Scotty, Computer
9. Mark Sulu/Chekov/Uhura/Chapel/Rand/Kyle as P3 expansion slots
10. Redesign `engage` as 2-station max (implement + review)

### Meta

11. Label this as **Level 1 spec** (architecture/ownership)
12. Each command needs a **Level 2 spec** (implementation workflow) before building
13. Write Level 2 specs for `chart` and `refit` as the actual next step

---

## One Last Thing

The plan is good thinking wrapped in incomplete specification. The taxonomy, the crew metaphors, the knowledge skill concept -- these are the right ideas. The reviews aren't saying "start over." They're saying "finish the blueprints before you start welding."

The Enterprise is worth building. Just not all at once, and not without plumbing diagrams.

---

*-- Three review passes, one clear signal: tighten the spec, shrink the MVP, build incrementally.*
