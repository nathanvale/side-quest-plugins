**Verdict**
REQUEST CHANGES

**Strengths**
- No sub-agent fan-out keeps cost growth linear instead of multiplicative.
- Content is already modularized (`voice`, `modes`, `feedback`), so conditional loading is feasible.
- End-of-session feedback as a separate phase is compatible with deferred context loading.
- Preflight framing is a good place to add cost controls without redesigning the flow.

**Critical issues**
- No explicit token budget contract exists. `--file` + `--jd` + `context: fork` can create a very high first-turn context with no guardrails.
- Static load is too expensive for always-on use. `~7.25k–8.25k` is ~40–60% above newsroom’s `~5.1k` baseline for a simpler single-thread workflow.
- `context: fork` is a hidden unbounded tax. Prior coding chat can add `~5k–15k` tokens before sparring starts.
- Current estimates understate realistic sessions. For a 5-round code-review session with a 500-line file:
  - `~7.0k` (skill+voice+modes) + `~2.5k` file + `~4.0k` rounds + `~0.75k` feedback = `~14.25k`
  - + JD (`~2k–5k`) => `~16.25k–19.25k`
  - + forked prior history (`~5k–15k`) => `~21k–34k` realistic upper band.
- Raw ingestion is unbounded. JD and code are variable-size blobs with no summarize/cap policy, so both cost and quality are unstable.

**Important observations**
- Split Miyagi voice content: keep a short essential style spec always loaded; keep quote bank/no-topic bank on-demand. This is high ROI.
- Split `sparring-modes.md` per mode. `~1k` tokens is not huge, but it is a recurring fixed tax every session.
- Lazy-loading `feedback-patterns.md` is low impact for long sessions, but still useful for short/aborted sessions.
- Linear round growth (`~800`/round) means 10 rounds add `~8k`; relying on auto-compaction protects limits, not evaluation fidelity.
- Compared with newsroom: dojo avoids fan-out spikes, but its always-on baseline is materially higher and can dominate total spend at scale.

**Nice-to-haves**
- Add per-phase token telemetry (`setup`, each round, `feedback`) for real cost data.
- Add preflight cost estimate plus downgrade policy (summarize JD, summarize file, shorten responses).
- Set hard per-message output caps for interviewer/follow-up/coaching.
- Add rolling memory compression every N rounds to retain scoring-critical facts only.

**Questions for the author**
1. What is the hard per-session token ceiling before forced compression/refusal?
2. Why is `context: fork` default, instead of clean context with optional import?
3. What exact token/line caps will `--file` and `--jd` enforce?
4. Will mode guidance load only for the selected mode, or always load all modes?
5. What is the target assistant-token budget per round?
6. What daily session volume are you planning for, Nathan, so token ranges can be translated into operating cost?

**Synthesis**
The three reviews together have de-risked architecture and UX direction well; the remaining major risk is cost predictability under real usage. The plan still needs enforceable token governance: hard caps, conditional loading, bounded ingestion, and fork-history controls. Without that, sessions can routinely drift into `~20k–35k` context footprints, increasing spend and reducing feedback consistency as compaction kicks in. Once those controls are specified, implementation risk is substantially reduced.