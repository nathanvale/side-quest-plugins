# Dark Dashboard Accessibility Patterns

WCAG-compliant patterns for dark-mode observability dashboards. Covers contrast ratios, color-blind safety, screen reader support, reduced motion, and focus management.

---

## WCAG Contrast Ratios on Dark Backgrounds

All status colors from the color palette pass WCAG AA (4.5:1) on `zinc-950` (#09090b):

| Color | Hex | Contrast vs zinc-950 | WCAG AA | WCAG AAA |
|-------|-----|---------------------|---------|----------|
| `emerald-400` | #34d399 | 9.2:1 | PASS | PASS |
| `amber-400` | #fbbf24 | 11.3:1 | PASS | PASS |
| `red-400` | #f87171 | 5.8:1 | PASS | PASS |
| `sky-400` | #38bdf8 | 7.4:1 | PASS | PASS |
| `violet-400` | #a78bfa | 5.1:1 | PASS | PASS |

**This validates the "-400 not -500" rule** -- the -400 variants are not just more legible, they're WCAG compliant. The -500 variants would fail for several colors.

**Common mistake:** Using `-500` status colors on dark backgrounds. `red-500` (#ef4444) drops to ~4.2:1 on zinc-950 -- fails WCAG AA for normal text.

### Badge Background Contrast

The `/10` opacity modifier pattern for badge backgrounds:
```html
<span class="bg-[var(--color-status-error)]/10 text-[var(--color-status-error)]">
  Critical
</span>
```

The text color (red-400 at 5.8:1) carries the contrast. The background tint is decorative and doesn't need to meet contrast requirements on its own. This is correct per WCAG -- the text-to-background contrast is what matters.

---

## Color-Blind Safe Patterns

4.5% of the global population has some form of color vision deficiency. **Never rely on color alone** to convey status.

### Beyond-Color Cues

Every status indicator must have at least TWO signals:

| Status | Color | Shape/Icon | Text |
|--------|-------|------------|------|
| Success/healthy | `emerald-400` | Filled circle, checkmark | "Healthy", "OK" |
| Warning | `amber-400` | Triangle, exclamation | "Warning", "Degraded" |
| Error/critical | `red-400` | X mark, octagon | "Error", "Critical" |
| Info/neutral | `sky-400` | Info circle, dash | "Info", "Normal" |

```html
<!-- BAD: color only -->
<span class="text-red-400">Error</span>

<!-- GOOD: color + icon + text -->
<span class="inline-flex items-center gap-1.5 text-[var(--color-status-error)]">
  <svg class="h-4 w-4" aria-hidden="true"><!-- X icon --></svg>
  Error
</span>
```

### Status Dot Accessibility

The ping indicator dot pattern from `tailwind-patterns.md` needs an accessible label:

```html
<span class="relative flex h-3 w-3" role="status" aria-label="Connected">
  <span class="absolute inline-flex h-full w-full animate-ping rounded-full
               bg-[var(--color-status-success)] opacity-75"></span>
  <span class="relative inline-flex h-3 w-3 rounded-full
               bg-[var(--color-status-success)]"></span>
</span>
```

**Key:** `role="status"` + `aria-label` makes the dot meaningful to screen readers. Without these, it's invisible to assistive technology.

---

## Screen Reader Support for Event Feeds

### Live Regions

Event feeds that update in real time must announce new events to screen readers without stealing focus.

```html
<div
  role="log"
  aria-label="Event feed"
  aria-live="polite"
  aria-relevant="additions"
>
  <div v-for="event in events" :key="event.id">
    <!-- Event cards -->
  </div>
</div>
```

| Attribute | Value | Why |
|-----------|-------|-----|
| `role` | `log` | Semantic: sequential stream of events |
| `aria-live` | `polite` | Announces when user is idle (not during interaction) |
| `aria-relevant` | `additions` | Only announce new events, not removals |

**NEVER use `aria-live="assertive"`** for event feeds -- it interrupts the user's current action. Reserve `assertive` for critical alerts only (system down, data loss).

### High-Frequency Throttling

At >5 events/sec, screen reader announcements become noise. Throttle announcements:

```typescript
let lastAnnouncement = 0
const ANNOUNCE_INTERVAL = 5000 // 5 seconds

function announceNewEvents(count: number) {
  const now = Date.now()
  if (now - lastAnnouncement < ANNOUNCE_INTERVAL) return
  lastAnnouncement = now

  // Update a visually-hidden live region
  announcer.textContent = `${count} new events received`
}
```

Use a visually-hidden element for batch announcements:
```html
<div class="sr-only" aria-live="polite" aria-atomic="true" id="event-announcer">
  <!-- Updated by JavaScript -->
</div>
```

---

## Reduced Motion

### Tailwind Motion Utilities

Tailwind provides `motion-safe:` and `motion-reduce:` variants for users with `prefers-reduced-motion`:

```html
<!-- Pulse animation only for users who haven't requested reduced motion -->
<div class="motion-safe:animate-pulse bg-[var(--color-bg-hover)] rounded">
  <!-- Skeleton content -->
</div>

<!-- Static alternative for reduced motion -->
<div class="motion-reduce:opacity-60 bg-[var(--color-bg-hover)] rounded">
  <!-- Same skeleton, no animation -->
</div>
```

### Animation Decision Tree (Accessibility-Aware)

1. Does user prefer reduced motion? -> **No animation** (use `motion-safe:` prefix)
2. Is event rate >5/sec? -> **No animation** (performance, see `performance.md`)
3. Is virtual scrolling active? -> **No animation** (scroll recycling conflicts)
4. Otherwise -> **Animate** (enter/exit transitions, ping indicators)

### Ping Indicator with Reduced Motion

```html
<span class="relative flex h-3 w-3" role="status" aria-label="Connected">
  <!-- Ping only when motion is safe -->
  <span class="absolute inline-flex h-full w-full rounded-full
               bg-[var(--color-status-success)] opacity-75
               motion-safe:animate-ping
               motion-reduce:hidden"></span>
  <span class="relative inline-flex h-3 w-3 rounded-full
               bg-[var(--color-status-success)]"></span>
</span>
```

---

## Focus Management

### Skip Links

For keyboard-only users navigating complex dashboards:

```html
<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-50
                                focus:bg-[var(--color-brand-primary)]
                                focus:text-[var(--color-bg-base)]
                                focus:px-4 focus:py-2 focus:rounded">
  Skip to main content
</a>
```

### Focus Ring Pattern

Consistent focus indicators across all interactive elements:

```css
/* In globals.css */
@layer base {
  :focus-visible {
    outline: 2px solid var(--color-focus-ring);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
}
```

Or per-element with Tailwind:
```html
<button class="focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]
               focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]">
  Action
</button>
```

**Key:** Use `focus-visible` not `focus` -- this only shows the ring for keyboard navigation, not mouse clicks.

### Roving Tabindex for Data Tables

In data-dense tables, allow arrow key navigation between cells instead of forcing Tab through every cell:

```typescript
// Simplified roving tabindex pattern
function handleKeydown(event: KeyboardEvent, row: number, col: number) {
  switch (event.key) {
    case 'ArrowRight': focusCell(row, col + 1); break
    case 'ArrowLeft':  focusCell(row, col - 1); break
    case 'ArrowDown':  focusCell(row + 1, col); break
    case 'ArrowUp':    focusCell(row - 1, col); break
  }
}

function focusCell(row: number, col: number) {
  const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`)
  if (cell instanceof HTMLElement) {
    // Remove all cells from tab order
    document.querySelectorAll('[data-cell]').forEach(c =>
      (c as HTMLElement).tabIndex = -1
    )
    // Add only the target cell to tab order
    cell.tabIndex = 0
    cell.focus()
  }
}
```

---

## Accessible Data Visualization

### Chart Alternatives

Every chart must have a non-visual alternative:

| Chart type | Alternative |
|------------|-------------|
| Sparkline | `aria-label="Trend: increasing from 42 to 87 over 24h"` |
| Bar chart | Hidden data table with same values |
| Donut/pie | Percentage list below the chart |
| Heatmap | Sortable table with intensity column |

```html
<!-- Sparkline with accessible description -->
<div role="img" aria-label="Error rate: trending up from 0.2% to 1.4% over 6 hours">
  <canvas class="h-10 w-24"><!-- Sparkline rendered here --></canvas>
</div>

<!-- Data table hidden visually but available to screen readers -->
<table class="sr-only">
  <caption>Error rate over time</caption>
  <tr><th>Time</th><th>Rate</th></tr>
  <tr><td>6h ago</td><td>0.2%</td></tr>
  <tr><td>Now</td><td>1.4%</td></tr>
</table>
```

### Color-Blind Safe Chart Colors

When using multiple data series, ensure distinguishability beyond hue:

1. **Use patterns/textures** in addition to color (dashed lines, filled vs hollow dots)
2. **Use luminance variation** -- colors should be distinguishable in grayscale
3. **Limit to 5-7 series** per chart -- beyond this, any palette becomes confusing
4. **Label directly** -- put labels on the data, not in a separate legend

Source: WCAG 2.2 SC 1.4.1, 1.4.3, 1.4.11, 2.4.7 | axe-core rules | Tailwind accessibility docs
