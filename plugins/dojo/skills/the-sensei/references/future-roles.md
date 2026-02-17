# Future Roles - V2 Roadmap

**This file is never loaded at runtime.** It documents the full Dojo vision for planning and reference only.

---

## V2 Workers

Workers that will join the Sparring Partner on the training floor:

- **Kata Master** - Generates practice problems, coding exercises, and drills. Repetition with variation. Same concept from different angles until it's instinct.
- **Examiner** - Formal quizzes and assessments. Multiple choice, short answer, spot-the-bug, explain-this-code. Scores results and explains correct answers.
- **Philosopher** - Concept explainer. Builds from what you already know, uses analogies, checks comprehension before moving on. Reads your codebase first.
- **Mirror** - Self-assessment agent. Skill gap analysis against job descriptions, confidence calibration, pattern recognition in your code and answers.
- **Scribe** - Study material generator. Flashcards, cheat sheets, concept maps, interview prep summaries. Compounds knowledge across sessions.
- **Commentator** - Collaborative code walkthrough. You guide the tour, Commentator asks "why?" at every decision point. Rehearsal, not adversarial.

## V2 Training Programmes

Structured sequences that chain multiple workers:

- **Fight Camp** - Interview preparation: Mirror -> Philosopher -> Kata Master -> Sparring Partner -> Examiner
- **Open Mat** - Exploratory learning: Philosopher -> Kata Master -> Examiner
- **Grading** - Certification prep: Examiner + Scribe, timed mock exams
- **Demo Day** - Presentation prep: Commentator + Sparring Partner
- **Fundamentals Class** - Methodical skill building with belt progression
- **Tape Review** - Post-mortem learning after real performance

## V2 Belt System

Progress tracking across sessions:

- **White** (awareness) - Knows the topic exists, can't explain or apply
- **Yellow** (comprehension) - Can explain to others, works through examples
- **Green** (application) - Applies in practice, handles standard scenarios
- **Brown** (analysis) - Evaluates tradeoffs, defends decisions, handles curveballs
- **Black** (mastery) - Can teach it, handles pressure, no blind spots

Sensei assesses belt level, assigns appropriate difficulty. Progress tracked via para-obsidian vault integration.

## V2 Sensei Evolution

- `/dojo:train` command becomes multi-worker entry point
- Mode routing table Executor column changes from "inline" to "agent" for Task-dispatched workers
- Conversational workers (Sparring Partner, Commentator) remain inline role shifts
- Artifact-producing workers (Examiner, Scribe) dispatched as background sub-agents via Task tool
- Belt assessment happens at session start, difficulty calibrated accordingly
