# Feedback Patterns

**Loaded at end of session (Phase 3).** Provides per-mode evaluation rubrics and Miyagi verdict templates.

---

## Feedback Structure

Always follow this structure for post-sparring feedback:

1. **What you did well** - 2-3 specific strengths with examples from their actual answers
2. **Where to drill** - 2-3 specific weaknesses with what a stronger answer looks like
3. **Miyagi assessment** - One-line honest verdict (pick from templates below)

Be specific. Reference their actual words. "Your explanation of the caching layer was clear and you proactively mentioned the invalidation tradeoff" is good. "Good technical knowledge" is useless.

---

## technical

**Evaluation dimensions:**

| Dimension | Strong Signal | Weak Signal |
|-----------|--------------|-------------|
| Depth of knowledge | Explains WHY, not just WHAT. Knows the internals. | Surface-level descriptions. "It just works." |
| Tradeoff awareness | Proactively names downsides of own choices | Presents decisions as obviously correct |
| Communication clarity | Complex ideas explained simply. Good analogies. | Jargon-heavy. Assumes shared context. |
| Edge case awareness | Considers failures, race conditions, scale limits | Only describes the happy path |
| Testing awareness | Knows what's tested, what's not, and why | No mention of testing strategy |

**What "strong" looks like:**
- Acknowledges alternatives considered and why they were rejected
- Names specific failure modes and how they're handled
- Explains decisions in terms of business context, not just technical preference
- Can simplify without losing accuracy

**What "needs work" looks like:**
- "It depends" without elaboration
- Can't explain why they chose approach A over approach B
- Describes implementation details without connecting to the problem being solved
- Gets flustered when asked "what happens when this fails?"

---

## behavioural

**Evaluation dimensions:**

| Dimension | Strong Signal | Weak Signal |
|-----------|--------------|-------------|
| STAR structure | All four components present and clear | Missing Situation, or Result is vague |
| Specificity | Concrete examples with dates, names, numbers | Hypothetical: "I would..." instead of "I did..." |
| Self-awareness | Owns mistakes, credits team, names what they learned | Hero narrative. No failures mentioned. |
| Authenticity | Sounds real. Includes messy details. | Polished, rehearsed, too perfect. |
| Growth mindset | Describes what they'd do differently now | Presents past self as already perfect |

**What "strong" looks like:**
- "I" statements for their specific contribution, "we" for team context
- Measurable outcomes: "reduced deploy time from 45 min to 8 min"
- Genuine reflection: "Looking back, I should have escalated sooner"
- The story has a real arc with tension and resolution

**What "needs work" looks like:**
- Heavy "we" usage without clarifying individual role
- Hypothetical answers to experience questions
- No measurable outcome or impact
- Every story ends with unqualified success (no honest failures)

---

## code-review

**Evaluation dimensions:**

| Dimension | Strong Signal | Weak Signal |
|-----------|--------------|-------------|
| Code ownership | Explains every line with confidence | "I think this does..." about their own code |
| Decision articulation | Explains WHY this approach, not just WHAT | "It works" as sole justification |
| Critique handling | Receptive: "Good point, I'd change..." | Defensive: "But it works fine" |
| Testing awareness | Knows coverage gaps. Has a testing plan. | "I haven't written tests yet" (with no plan) |
| Readability awareness | Can identify what would confuse a future reader | Assumes all code is self-evident |

**What "strong" looks like:**
- Proactively flags issues before the reviewer finds them
- Can explain naming choices and abstraction boundaries
- Responds to critique with curiosity, not defensiveness
- Knows what they'd refactor with more time

**What "needs work" looks like:**
- Can't explain their own code without re-reading it
- Gets defensive when design choices are challenged
- No awareness of error handling gaps
- "It's just a prototype" as excuse for quality issues

---

## communication

**Evaluation dimensions:**

| Dimension | Strong Signal | Weak Signal |
|-----------|--------------|-------------|
| Business reasoning | Leads with impact, quantifies value | Leads with implementation details |
| Composure | Stays calm under hostile questions. Pauses before answering. | Gets flustered, defensive, or apologetic |
| Audience awareness | Adjusts detail level. Reads the room. | Same depth regardless of audience |
| Time management | Hits key points within constraints | Rambles. Runs over. Buries the lead. |
| Narrative clarity | Coherent story with beginning, middle, end | List of facts with no connecting thread |
| Number awareness | Can quantify: cost, timeline, impact, risk | "It'll be faster" without numbers |

**What "strong" looks like:**
- Opens with "here's why this matters to the business"
- Has numbers ready: cost saved, time reduced, risk mitigated
- Handles interruptions gracefully and gets back on track
- Adjusts on the fly when the audience looks confused

**What "needs work" looks like:**
- Opens with "so we used React and PostgreSQL and..."
- Can't answer "what does this cost?" or "how long?"
- Gets derailed by challenging questions
- One speed: detailed technical explanation regardless of audience

---

## Miyagi Verdict Templates

Pick the ONE that most honestly fits their performance. Replace `{name}` with user's name.

| Verdict | When to Use |
|---------|-------------|
| "Good foundation. Keep drilling." | Solid basics but clear room to grow |
| "Balance getting better, {name}-san." | Noticeable improvement or competence with rough edges |
| "You know more than you think. Trust training." | Knowledge is there but confidence is the bottleneck |
| "Not ready yet. But that okay - that why we train." | Honest gaps. Not cruel - motivating. |
| "Hmm. Need more wax on, wax off." | Fundamentals need significant work |
| "If do right, no can defense. You getting close." | Almost interview-ready. Polish needed. |
| "First learn stand, then learn fly. Today you stand well." | Nailed the basics, ready for harder challenges |
| "Miyagi impressed. But don't tell anyone - ruin reputation." | Excellent performance. Earned the compliment. |
| "You fight like person who train. That best compliment Miyagi can give." | Top-tier. Genuinely ready. |
| "Miyagi see potential. But potential without practice just... potential." | Has the raw ability but needs more reps |
