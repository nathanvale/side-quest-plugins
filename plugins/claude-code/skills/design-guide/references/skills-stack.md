# Claude Code Skills Stack for Dashboard Development

Layered skills strategy for producing high-quality dashboard UIs. Based on community research (Feb 2026) -- 74.5K weekly installs of `frontend-design`, ecosystem analysis of 167+ skills, and practitioner interviews.

---

## The Layered Approach (Install in Order)

### Layer 1: `frontend-design` (Anthropic official)

The baseline aesthetic guard. ~400 tokens. Auto-activates when Claude detects frontend work. Forces a design direction before coding, bans generic choices (Inter, Roboto, purple gradients).

**What it solves:** Prevents "AI slop" -- generic, forgettable output.
**What it doesn't solve:** Design consistency across sessions. Every generation is independent.

Install: bundled as example skill in Claude Code.

Evidence: 4,620 likes on @asidorenko_'s demo, Vercel's official endorsement (2,577 likes), Anthropic cookbook companion.

Source: [SKILL.md](https://github.com/anthropics/claude-code/blob/main/plugins/frontend-design/skills/frontend-design/SKILL.md) | [Cookbook: Prompting for frontend aesthetics](https://platform.claude.com/cookbook/coding-prompting-for-frontend-aesthetics)

### Layer 2: Tailwind v4 Skill

Prevents v3 syntax regression -- the #1 pain point for Tailwind + AI agents. Ensures `@theme inline`, CSS-first config, no `tailwind.config.ts` generation, no PostCSS configs.

Install: `npx skills add jezweb/claude-skills/tailwind-v4-shadcn`

Why needed even with your own tokens: the skill prevents Claude from generating v3 patterns (`darkMode: 'class'`, `tailwind.config.ts`) that don't exist in Tailwind v4.

Source: [skills.sh](https://skills.sh/jezweb/claude-skills/tailwind-v4-shadcn) | @PaulRBerg's dedicated v4 skill

### Layer 3: Feed `globals.css` as Context

This is your consistency layer. The two-tier semantic token system IS the design system. When Claude has this in context, it grounds all Tailwind output in your actual tokens.

Pattern: ensure `globals.css` is read at the start of every dashboard implementation session.

Why it matters: paddo.dev documented the failure mode in "Agents Can't Do Design Systems" -- without explicit token grounding, LLMs produce "inline Tailwind copy-pasted across files, no shared tokens, eight shades of blue."

### Layer 4: Personal Dashboard Skill (Build After v1)

After shipping v1, point Claude at the shipped components and extract patterns into a reusable SKILL.md. The mager.co approach.

What it would encode:
- Specific token names and usage (`--color-card-bg`, not `bg-gray-850`)
- Component anatomy (EventCard, SessionHeader, EventFeed)
- The double-layer ping indicator pattern
- The opacity modifier badge pattern
- Critical row highlighting
- Naming conventions and prop patterns

"It's like having a design system that lives inside your AI tools instead of a Figma file nobody reads."

Source: [mager.co: I Turned My Design Taste Into a Claude Code Skill](https://www.mager.co/blog/2026-02-08-mager-frontend-design/)

### Layer 5: Design Book Skills (Optional Polish)

For polish passes where you want Claude to critique spacing, hierarchy, or interaction patterns.

Available skills:
- `refactoring-ui` -- visual design for developers (Steve Schoger)
- `ux-heuristics` -- Jakob Nielsen's usability heuristics
- `web-typography-skill` -- Bringhurst's typography rules (45-75 char lines, modular scales, vertical rhythm)
- `design-everyday-things` -- Don Norman's design principles

Source: @jaskol_ski (21 design books as skills), @yesthatjon (web-typography-skill)

---

## Community Sentiment (Three Camps)

**Camp 1: "Install it immediately"** (majority)
74.5K weekly installs. Before/after comparisons are consistently striking across English, Spanish, Portuguese, Chinese communities.

**Camp 2: "It's fine, not great"** (@SaidAitmbarek)
Prevents worst outputs but doesn't produce distinctive design without strong prompting. Tailwind specifically can be a liability (@pJacquelDesign: "React + Tailwind fails where Svelte + Panda CSS gives pixel-perfect results").

**Camp 3: "Good codebase negates the need"** (@melvynxdev, 180 likes)
If you have a proper design system in tokens and CLAUDE.md, the skill is redundant. The skill substitutes for design guidance you should have encoded yourself.

**Practical position:** Be camp 3 (strong design system) but install the skill anyway (camp 1) as a baseline guard. The layered approach gives you both.

---

## What NOT to Install

| Tool/Approach | Why skip |
|--------------|---------|
| Steve Jobs/Jony Ive prompt (@kloss_xyz, 4,363 likes) | Role-play, not constraints. Less reliable than token grounding. |
| Pencil.dev (design canvas + MCP) | Overkill without a dedicated designer. Revisit for v2. |
| secondsky/claude-skills (167 skills) | Too broad. Cherry-pick individual skills if needed. |
| HEXED / Specimen skills (@heathenft) | Image-to-color/typography. Useful from scratch, not with an existing palette. |
