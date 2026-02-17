# The Dojo: An Agentic Orchestration Framework for Learning & Preparation

## The Metaphor

A traditional martial arts dojo is a structured environment for deliberate practice. You don't walk in and start fighting — you learn fundamentals, drill kata, spar with partners, and gradually take on harder challenges under the guidance of a sensei who sees your blind spots before you do. The dojo doesn't find information (that's the Newsroom) and it doesn't build products (that's the Enterprise). The dojo builds *you*.

The Newsroom finds the stories. The Enterprise executes the mission. The Dojo sharpens the captain.

---

## The Dojo

### The Dojo Master (You)

You own the dojo. You decide what to train, when to train it, and what belt you're aiming for. You set the training goals — "I have a second-round interview on Thursday and I need to be able to explain every decision in my codebase" or "I want to understand GraphQL well enough to architect a service with it."

**You step in for:**

- Setting training goals ("I need to prepare for this interview")
- Choosing what to study ("teach me how this authentication pattern works")
- Deciding when you're ready ("quiz me, I think I've got this")
- Calling the training session done ("good enough, let's move on")

### The Sensei (Top-Level Orchestrator Agent)

Reads your training goals, assesses your current level, designs the training programme, and assigns the right training partners and drills. Knows when to push harder and when to slow down.

**In practice:** Your primary Claude Code agent for learning contexts. It decomposes a learning goal into a structured programme, sequences the training, adapts based on your performance, and tells you honestly when you're not ready yet.

**Key responsibilities:**

- Assessing your current skill level against your goal
- Designing a training programme with the right progression
- Assigning drills, sparring sessions, and study to specialist agents
- Tracking progress and adapting the programme
- Being honest: "You're not ready for that yet — let's drill this fundamental first"
- Knowing when to bow and end the session: "You've got this. Go fight."

---

## The Training Floor

### The Kata Master (Structured Practice Agent)

Kata are pre-arranged sequences of movements practised until they become muscle memory. The kata master designs and runs structured exercises.

**In practice:** Generates practice problems, coding exercises, and drills tailored to what you're learning. Not random LeetCode — exercises specifically designed to reinforce the concepts you need.

**Example kata:**

- "Build a REST endpoint from scratch without looking at your project code"
- "Implement this state management pattern three different ways"
- "Write the SQL query for this scenario, then optimise it"
- "Recreate this React component from memory"

**Operating model:** Repetition with variation. The same fundamental concept approached from different angles until it's instinct, not recall.

### The Sparring Partner (Mock Interview / Challenge Agent)

You don't get better at fighting by hitting a bag. You get better by sparring with someone who hits back. The sparring partner role-plays as an interviewer, a skeptical stakeholder, or a challenging audience member.

**In practice:** Conducts mock interviews, asks follow-up questions, challenges your answers, pokes holes in your reasoning. Gives feedback after each round.

**Sparring modes:**

- **Technical interview:** "Walk me through your authentication approach. Why not JWT? What are the tradeoffs?"
- **Behavioural interview:** "Tell me about a time you had to make a hard technical decision under pressure."
- **Code review:** "I'm looking at your submission. Explain this function to me. Why is this O(n²)?"
- **Stakeholder challenge:** "The client wants to know why this took three sprints instead of one."
- **Presentation dry run:** "You've got five minutes to demo this. Go."

**After each round:** The sparring partner drops character and gives honest feedback. "Your explanation of the data flow was clear, but you hesitated when asked about error handling — let's drill that."

### The Examiner (Quiz & Assessment Agent)

Tests your knowledge formally. Multiple choice, short answer, explain-this-code, what's-wrong-with-this, fill-in-the-blank. Works from defined criteria and gives you a score.

**In practice:** Generates quizzes based on your training goals, a job description, a codebase, or a technology you're studying. Tells you what you got right, explains what you got wrong, and tracks which areas need more work.

**Quiz types:**

- **Concept check:** "What's the difference between authentication and authorisation? Explain it like I'm a junior dev."
- **Code comprehension:** "What does this function return when passed null? Why?"
- **Multiple choice:** "Which of these is NOT a valid HTTP status code for a successful creation?"
- **Spot the bug:** "There's a race condition in this code. Where is it?"
- **Architecture reasoning:** "Given these requirements, which database would you choose and why?"
- **Codebase-specific:** "In the project you submitted, what happens if the API returns a 429? Walk me through the error handling chain."

**Scoring and feedback:** The examiner doesn't just mark right/wrong — it explains the correct answer and links it back to the underlying concept. "You said X, but the answer is Y, because..."

### The Philosopher (Concept Explainer Agent)

In traditional dojos, training isn't just physical. The philosophy behind the art matters — understanding *why* a technique works, not just *how* to perform it.

**In practice:** Explains concepts at your level. Doesn't dump the docs on you — builds understanding from what you already know, uses analogies that resonate with your experience, and checks comprehension before moving on.

**Example sessions:**

- "Explain event-driven architecture to me using the Enterprise metaphor"
- "I keep hearing about the actor model — what is it and when would I use it?"
- "Walk me through how OAuth2 actually works, step by step"
- "What's the difference between these three state management approaches in practical terms?"

**Key skill:** Knowing what you already understand and building from there, not starting from scratch every time. The philosopher reads your codebase and existing knowledge before explaining.

### The Mirror (Self-Assessment & Reflection Agent)

In a dojo, mirrors line the walls so you can see your own form. The mirror agent helps you see yourself clearly — your strengths, your gaps, your habits.

**In practice:** Analyses your codebase, your answers, your interview performance, and reflects back an honest assessment. Not to judge — to show you what you can't see yourself.

**Mirror sessions:**

- **Skill gap analysis:** "The job description asks for X, Y, Z. You're strong on X, solid on Y, and Z needs work. Here's where to focus."
- **Codebase review:** "Your submission is strong on component architecture but the error handling is inconsistent. Here are the three places an interviewer will probe."
- **Answer analysis:** "When you explain your backend decisions, you lead with implementation details instead of business reasoning. Try flipping the order."
- **Pattern recognition:** "You keep reaching for useEffect when useCallback would be cleaner. Let's drill that distinction."
- **Confidence calibration:** "You rated yourself 3/5 on TypeScript but your code shows you're stronger than you think. You rated yourself 4/5 on testing but your coverage has gaps."

### The Scribe (Study Material & Flashcard Agent)

Every dojo keeps a training manual. The scribe generates study materials, reference sheets, and flashcards from whatever you're learning.

**In practice:** Creates spaced-repetition flashcards, cheat sheets, concept maps, and study guides tailored to your training goals.

**Outputs:**

- Flashcards for API methods, design patterns, keyboard shortcuts
- Concept maps linking related ideas
- "Explain it in one sentence" reference sheets
- Interview prep cheat sheets ("your project in 30 seconds, 2 minutes, and 5 minutes")
- Key talking points for specific topics

### The Commentator (Code Walkthrough Agent)

In martial arts competitions, commentators break down what's happening move by move. The commentator walks through your code with you, asking questions at every decision point.

**In practice:** Opens your codebase and walks through it like a guided tour, but *you're* the guide. The commentator asks "why did you do this?" at every turn, helping you practice articulating your decisions.

**Walkthrough style:**

```
Commentator: "Let's start at the entry point. Talk me through what happens 
             when a request hits this endpoint."
You:         [explains]
Commentator: "Good. Now why did you choose to validate here instead of in 
             the middleware?"
You:         [explains]
Commentator: "An interviewer might push back on that — what's your defence?"
You:         [explains]
Commentator: "Strong. Let's move to the data layer..."
```

**Key distinction from the sparring partner:** The commentator is collaborative, not adversarial. They're helping you rehearse, not testing you. The sparring partner comes later when you're ready to be challenged.

---

## Belt System: Training Progression

### White Belt (Awareness)

You know the topic exists but can't explain it or apply it. The philosopher explains, the scribe creates study materials, the examiner runs basic concept checks.

**Goal:** "I understand what this is and why it matters."

### Yellow Belt (Comprehension)

You can explain the concept but haven't applied it. The kata master assigns basic drills, the examiner tests understanding, the commentator walks through examples.

**Goal:** "I can explain this to someone else and work through simple examples."

### Green Belt (Application)

You can apply the concept in straightforward situations. The kata master assigns progressively harder drills, the sparring partner runs friendly rounds, the mirror checks for gaps.

**Goal:** "I can use this in practice and handle standard scenarios."

### Brown Belt (Analysis)

You can evaluate tradeoffs, debug issues, and make architectural decisions. The sparring partner runs challenging rounds, the examiner asks "why not" questions, the philosopher explores edge cases.

**Goal:** "I can defend my decisions, evaluate alternatives, and handle curveballs."

### Black Belt (Mastery)

You can teach it. The sparring partner goes full intensity, the examiner runs comprehensive assessments, and the mirror confirms there are no blind spots.

**Goal:** "I can explain this under pressure, handle any follow-up, and teach it to someone else."

---

## Training Programmes

### The Fight Camp (Interview Preparation)

Preparing for a specific interview. Structured, time-boxed, focused on the known criteria.

```
Sensei assesses the terrain (reads job description, criteria, your codebase)
    → Mirror identifies strengths and gaps
        → Sensei designs the camp
            → Philosopher fills knowledge gaps
                → Kata master drills weak areas
                    → Commentator rehearses codebase walkthrough
                        → Sparring partner runs mock interviews
                            → Examiner runs final assessment
                                → Sensei gives the honest verdict: ready or not
```

### The Open Mat (Exploratory Learning)

No specific goal — just getting better. You pick a topic, the dojo teaches it.

```
You pick a topic
    → Philosopher explains the fundamentals
        → Kata master assigns introductory drills
            → Examiner checks comprehension
                → Kata master assigns harder drills
                    → You decide: go deeper or move on
```

### The Grading (Certification Prep)

Preparing for a formal assessment — Azure cert, AWS cert, any structured exam.

```
Sensei reviews the exam syllabus
    → Mirror maps your current knowledge against the syllabus
        → Philosopher covers gap areas
            → Examiner generates practice exams
                → Scribe creates flashcards for weak areas
                    → Examiner runs timed mock exams
                        → Sensei tracks progress toward pass threshold
```

### The Demo Day (Presentation Preparation)

Preparing to present, demo, or pitch something.

```
Sensei reviews what you're presenting
    → Commentator helps structure the narrative
        → Sparring partner role-plays as the audience
            → Mirror gives feedback on clarity and flow
                → Sparring partner asks hostile questions
                    → You refine and rehearse
                        → Final dress rehearsal with full Q&A
```

### The Fundamentals Class (Skill Building)

Methodically building competence in a technology or discipline over time.

```
Sensei assesses your current belt level
    → Philosopher teaches the next concept
        → Kata master drills it
            → Examiner tests it
                → Mirror checks form
                    → Sensei promotes to next level or repeats
```

### The Tape Review (Post-Mortem Learning)

After a real interview, presentation, or project — reviewing what happened and learning from it.

```
You debrief what happened
    → Mirror analyses your performance
        → Philosopher explains concepts you stumbled on
            → Kata master drills the weak spots
                → Scribe updates your study materials
                    → Sensei adjusts your training programme
```

---

## The Dojo Is a Private Room

The Dojo has no wire connection to the Newsroom or the Enterprise. It doesn't need one.

The Newsroom may surface intel that makes you decide to train — a stakeout reveals a trending technology, a street reporter finds out what a company's interview process looks like. But that intel reaches the Dojo through *you*. You read the story, you decide "I need to train on this," you walk into the Dojo and set the goal.

The Enterprise's codebases become training material -- but again, through you. You say "I built this, help me explain it." The Dojo reads the code directly. It doesn't need to coordinate with Spock.

The Dojo produces nothing that flows back to either room. No stories, no code, no wire messages. What it produces is a sharper *you* — and you're already the owner of both other rooms. The improvement flows back through your better decisions, better specs, and better architectural judgment. Not through a protocol.

**The Newsroom and Enterprise talk to each other through the Wire Service. The Dojo talks only to you.**

---

## Operating Principles

1. **The dojo builds you, not the product.** If you're writing production code, you're on the Enterprise. If you're learning, practising, or preparing, you're in the Dojo.

2. **Honest feedback is respect.** The sensei doesn't tell you you're ready when you're not. A dojo that flatters you is a dojo that gets you hurt in a real fight.

3. **Drill the fundamentals.** Fancy techniques fail under pressure. Strong fundamentals don't. When in doubt, go back to basics.

4. **Sparring is not fighting.** Mock interviews are practice, not performance. The goal is to find your weaknesses in training, not in the real thing.

5. **The mirror doesn't lie.** Self-assessment is the hardest skill. The mirror agent exists because you can't see your own blind spots.

6. **Belt levels are honest.** Don't skip to brown belt drills when you're still shaky on green belt fundamentals. Progression is earned, not declared.

7. **The scribe compounds knowledge.** Every training session should leave behind study material for future reference. The dojo gets richer with every session.

8. **Train for the fight you have.** Interview prep is different from certification prep is different from skill building. The sensei designs the programme for your actual goal, not a generic curriculum.

9. **Tape review is mandatory.** After every real performance — interview, presentation, demo — come back to the dojo and review the tape. That's where the deepest learning happens.

10. **Know when to bow out.** Training has diminishing returns. At some point, the sensei says "you're ready" and you go fight. Over-preparation is its own form of avoidance.
