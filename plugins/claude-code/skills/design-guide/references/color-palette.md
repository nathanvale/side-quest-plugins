# Color Palette for Dark-Mode Dashboards

Community consensus from dashboard builders (Feb 2026). Covers status colors, background depth layers, opacity modifiers, and how to structure a two-tier token system.

---

## Status Colors on Dark Backgrounds

Use `-400` variants, not `-500`. One stop lighter for legibility on dark backgrounds. The `-500` variants are too saturated and cause visual fatigue in monitoring contexts.

```
Success/healthy:    emerald-400 (#34d399) or green-400 (#4ade80)
Warning/degraded:   amber-400   (#fbbf24) or yellow-400 (#facc15)
Error/critical:     red-400     (#f87171) or rose-400   (#fb7185)
Info/neutral:       blue-400    (#60a5fa) or sky-400    (#38bdf8)
```

Source: @_heyrico "Dashboard design cheatsheet" (472 likes), community consensus across TailAdmin/Cleopatra/OpenClaw.

---

## Background Depth Layers

Three-layer depth system for dark dashboards. Each layer is slightly lighter than the one below, creating subtle depth without borders.

### Zinc Scale (cooler, modern undertone -- 2026 trend)

```
App background:     zinc-950 (#09090b)
Surface/panels:     zinc-900 (#18181b)
Cards:              zinc-850 (custom -- interpolate between 900 and 800)
Hover:              zinc-800 (#27272a)
Active/borders:     zinc-700 (#3f3f46)
```

### Neutral Scale (warmer, more neutral)

```
App background:     neutral-950 (#0a0a0a)
Surface/panels:     neutral-900 (#171717)
Cards:              neutral-850 (custom)
Hover:              neutral-800 (#262626)
Active/borders:     neutral-700 (#404040)
```

### Gray Scale (Tailwind default -- what most projects start with)

```
App background:     gray-950 (#030712)
Surface/panels:     gray-900 (#111827)
Cards:              gray-850 (#1a2332) (custom)
Hover:              gray-800 (#1f2937)
Active/borders:     gray-700 (#374151)
```

**Recommendation:** Zinc has the most modern feel in 2026. Gray works fine but has a slightly blue undertone. Neutral is the safest choice for brand-tinted themes (like LCARS orange) because it doesn't compete.

---

## Two-Tier Design Token Architecture

Structure tokens in two tiers within Tailwind v4 `@theme`:

### Tier 1: Primitives (What)

Raw values. Never used directly in components.

```css
@theme {
  --color-gray-950: #030712;
  --color-gray-900: #111827;
  --color-orange-500: #f97316;
  --color-green-400: #4ade80;
  --color-red-400: #f87171;
}
```

### Tier 2: Semantic (Why/Where)

Purpose-driven aliases. These are what components reference.

```css
@theme {
  /* Surfaces */
  --color-bg-app: var(--color-gray-950);
  --color-bg-surface: var(--color-gray-900);
  --color-bg-card: var(--color-gray-850);
  --color-bg-hover: var(--color-gray-800);

  /* Status */
  --color-status-success: var(--color-green-400);
  --color-status-error: var(--color-red-400);
  --color-status-warning: var(--color-amber-400);

  /* Component-specific */
  --color-card-bg: var(--color-bg-card);
  --color-card-border: var(--color-border-default);
  --color-header-bg: var(--color-bg-surface);
}
```

### How components consume tokens

```html
<!-- Always use semantic tokens, never primitives -->
<div class="bg-[var(--color-card-bg)] text-[var(--color-text-primary)] border-[var(--color-card-border)]">
```

Source: Entain ADR-050 two-tier token system, validated by Cleopatra's semantic token approach (`bg-card`, `text-foreground`, `border-border`).

---

## Opacity Modifier Pattern for Badges

Use Tailwind's `/N` opacity modifier on status tokens to create tinted badge backgrounds from a single color definition. Eliminates the need for separate badge-specific tokens.

```html
<!-- Full color for dots/indicators -->
<span class="w-2 h-2 rounded-full bg-[var(--color-status-success)]"></span>

<!-- 10% opacity for badge backgrounds -->
<span class="bg-[var(--color-status-success)]/10 text-[var(--color-status-success)]">OK</span>

<!-- 5% opacity for row highlights -->
<div class="bg-[var(--color-status-error)]/5 border-l-2 border-[var(--color-status-error)]">
```

Scale: `/5` for subtle row tints, `/10` for badge backgrounds, `/15` for emphasized backgrounds, `/30` for borders.

---

## Event Type Color Mapping

For dashboards displaying typed events (logs, hooks, API calls), map event categories to distinct colors via semantic tokens:

```css
@theme {
  --color-event-session: var(--color-blue-400);
  --color-event-tool: var(--color-orange-500);
  --color-event-error: var(--color-red-400);
  --color-event-notification: var(--color-amber-400);
  --color-event-user: var(--color-cyan-400);
  --color-event-system: var(--color-gray-500);
}
```

Applied as left-border accents on event cards: `style="border-left-color: var(--color-event-tool)"`.

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `-500` status colors on dark backgrounds | Use `-400` -- one stop lighter |
| Raw Tailwind classes (`bg-gray-850`) in components | Use semantic tokens (`bg-[var(--color-card-bg)]`) |
| Pure black (`#000000`) as app background | Use `gray-950` / `zinc-950` -- subtle warmth reduces eye strain |
| Separate token for every badge variant | Use `/10` opacity modifier on existing status tokens |
| Same color for border and background | Background should be 1-2 steps lighter than borders for depth |
