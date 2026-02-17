# Tailwind CSS Patterns for Dashboards

Community-sourced patterns from TailAdmin, Cleopatra, and the broader Tailwind dashboard ecosystem (Feb 2026). All patterns are Tailwind v4 compatible.

---

## 1. Tabular Numbers for Real-Time Values

All numeric values that update in real-time must use `font-mono tabular-nums` to prevent layout jitter when digits change width. This is the single most common pattern across TailAdmin's metric cards and Cleopatra's CEO Pulse Bar.

```html
<span class="font-mono tabular-nums">{{ eventsPerMinute }}</span>
```

Apply to: event counts, events/min, timestamps, percentages, token counts, latency values.

---

## 2. Double-Layer Pulsing Live Indicator

Two nested spans -- outer `animate-ping` for the pulse ring, inner solid dot. The solid dot remains visible during the ping animation.

```html
<span class="relative flex h-2 w-2">
  <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75
               bg-[var(--color-connected)]"></span>
  <span class="relative inline-flex rounded-full h-2 w-2
               bg-[var(--color-connected)]"></span>
</span>
```

For disconnected state, swap to `bg-[var(--color-disconnected)]`. Can also be used for "LIVE" badges:

```html
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
             bg-[var(--color-status-success)]/10 text-[var(--color-status-success)]">
  <span class="relative flex h-1.5 w-1.5">
    <span class="animate-ping absolute h-full w-full rounded-full bg-current opacity-75"></span>
    <span class="relative rounded-full h-1.5 w-1.5 bg-current"></span>
  </span>
  LIVE
</span>
```

Source: Cleopatra `mission-control-header.html`, TailAdmin metric cards.

---

## 3. Status Badge Severity via Opacity Modifier

Instead of separate badge tokens per status, use Tailwind's `/10` opacity modifier on the status color. Creates subtle tinted backgrounds from a single color.

```html
<!-- Success -->
<span class="bg-[var(--color-status-success)]/10 text-[var(--color-status-success)]
             px-2 py-0.5 rounded-full text-xs font-semibold">CONNECTED</span>

<!-- Error -->
<span class="bg-[var(--color-status-error)]/10 text-[var(--color-status-error)]
             px-2 py-0.5 rounded-full text-xs font-semibold">FAILED</span>

<!-- Warning -->
<span class="bg-[var(--color-status-warning)]/10 text-[var(--color-status-warning)]
             px-2 py-0.5 rounded-full text-xs font-semibold">DEGRADED</span>

<!-- Brand/default (for event type pills) -->
<span class="bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]
             px-2 py-0.5 rounded-full text-xs font-semibold">PreToolUse</span>
```

Source: TailAdmin `RecentOrders.tsx`, Cleopatra `crisis-monitor.html`.

---

## 4. Critical Row Highlighting with Negative Margin Bleed

For error events, the highlight should bleed to card edges while keeping text aligned. The `-mx` + `px` trick achieves this.

```html
<!-- Normal row -->
<div class="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] px-4 py-3">

<!-- Error row -- red tint bleeds to card edges -->
<div class="bg-[var(--color-status-error)]/5 border-l-2 border-[var(--color-status-error)]
            -mx-4 px-4 py-3">
```

The negative margin pulls the background past the parent's padding, creating a full-bleed effect. The matching positive padding keeps text aligned with non-error rows.

Source: Cleopatra `crisis-monitor.html` advertiser list.

---

## 5. Sticky Header with Backdrop Blur

Frosted glass effect for headers that content scrolls underneath.

```html
<header class="sticky top-0 z-40 backdrop-blur-xl
               bg-[var(--color-header-bg)]/80 border-b border-[var(--color-header-border)]">
```

The `/80` opacity on the background is critical -- a fully opaque background hides the blur effect. The `backdrop-blur-xl` creates the frosted glass when scrolled content is visible beneath.

Source: Cleopatra CEO Pulse Bar, common across all modern dashboard templates.

---

## 6. Progress Bar with Threshold Color Progression

Track + fill bar where color shifts based on capacity.

```html
<div class="space-y-1.5">
  <div class="flex items-center justify-between text-xs">
    <span class="text-[var(--color-text-secondary)]">Queue Depth</span>
    <span class="font-mono font-medium text-[var(--color-text-primary)] tabular-nums">
      1.24M / 5M
    </span>
  </div>
  <div class="h-2 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
    <div class="h-full rounded-full transition-all duration-500"
         :class="percentage > 90 ? 'bg-[var(--color-status-error)]'
               : percentage > 75 ? 'bg-[var(--color-status-warning)]'
               : 'bg-[var(--color-brand-primary)]'"
         :style="{ width: percentage + '%' }">
    </div>
  </div>
</div>
```

The `transition-all duration-500` enables smooth width animation on real-time updates. Color shifts at 75% (warning) and 90% (error).

Source: Cleopatra `crisis-monitor.html`.

---

## 7. Responsive Dashboard Grid

Breakpoint strategy from TailAdmin and Cleopatra:

```html
<!-- Full-width page container -->
<div class="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">

  <!-- Full-width header widget -->
  <SessionHeader />

  <!-- 2/3 + 1/3 split at xl -->
  <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
    <div class="xl:col-span-2"><!-- Main content --></div>
    <div class="xl:col-span-1"><!-- Sidebar panel --></div>
  </div>

  <!-- 50/50 split at lg -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
    <div><!-- Left panel --></div>
    <div><!-- Right panel --></div>
  </div>
</div>
```

Breakpoints: 1 column on mobile, `lg:grid-cols-2` splits 50/50 at 1024px, `xl:grid-cols-3` with `col-span-2`/`col-span-1` creates 2/3+1/3 at 1280px.

Source: Cleopatra `index-mission-control.html`, TailAdmin dashboard layouts.

---

## 8. Data Table with Divided Rows

Clean table separation without explicit borders on each cell.

```html
<div class="overflow-hidden rounded-2xl border border-[var(--color-card-border)]
            bg-[var(--color-card-bg)] px-4 pb-3 pt-4 sm:px-6">
  <div class="max-w-full overflow-x-auto">
    <table class="w-full">
      <thead>
        <tr class="border-y border-[var(--color-border-default)]">
          <th class="py-3 font-medium text-[var(--color-text-secondary)] text-start text-xs">
            Status
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-[var(--color-border-subtle)]">
        <tr>
          <td class="py-3 text-[var(--color-text-secondary)] text-sm">
            <!-- content -->
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

Key: `divide-y` on `<tbody>` eliminates per-row border declarations. `overflow-x-auto max-w-full` ensures horizontal scroll on mobile.

Source: TailAdmin `RecentOrders.tsx`.
