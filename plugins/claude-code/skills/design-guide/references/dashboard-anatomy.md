# Dashboard Component Anatomy

Component patterns extracted from TailAdmin (React/Next.js, 1.1k stars), Cleopatra (Vite/vanilla), OpenClaw Dashboard (agent monitoring, React 19 + Tailwind), and SigNoz (25.8k stars, open-source observability).

---

## Metric Card

The fundamental dashboard building block. Shows a single KPI with context.

```html
<div class="rounded-2xl border border-[var(--color-card-border)]
            bg-[var(--color-card-bg)] p-5 md:p-6">
  <!-- Icon badge -->
  <div class="flex items-center justify-center w-12 h-12
              bg-[var(--color-bg-hover)] rounded-xl">
    <IconComponent class="size-6 text-[var(--color-text-primary)]" />
  </div>

  <!-- Value + trend -->
  <div class="flex items-end justify-between mt-5">
    <div>
      <span class="text-sm text-[var(--color-text-secondary)]">Label</span>
      <h4 class="mt-2 font-bold text-2xl text-[var(--color-text-primary)]
                 font-mono tabular-nums">3,782</h4>
    </div>
    <!-- Trend badge -->
    <span class="bg-[var(--color-status-success)]/10 text-[var(--color-status-success)]
                 px-2 py-0.5 rounded-full text-xs font-semibold
                 inline-flex items-center gap-1">
      +11.01%
    </span>
  </div>
</div>
```

**Anatomy:**
1. Card shell: `rounded-2xl border bg-card p-5`
2. Icon container: `w-12 h-12 bg-hover rounded-xl`
3. Label: `text-sm text-secondary` (muted)
4. Value: `font-bold text-2xl font-mono tabular-nums`
5. Trend badge: semantic color with `/10` opacity background

Source: TailAdmin `EcommerceMetrics.tsx`.

---

## Status Indicator Dot

Three sizes for different contexts.

```html
<!-- Large: connection status in header -->
<span class="relative flex h-2 w-2">
  <span class="animate-ping absolute h-full w-full rounded-full opacity-75 bg-current"></span>
  <span class="relative rounded-full h-2 w-2 bg-current"></span>
</span>

<!-- Medium: inline with agent name -->
<span class="w-2 h-2 rounded-full bg-[var(--color-status-success)]"></span>

<!-- Small: in table rows -->
<span class="w-1.5 h-1.5 rounded-full bg-[var(--color-status-success)]"></span>
```

---

## Activity Feed / Status List

For lists of agents, services, or items with status indicators.

```html
<!-- Healthy item -->
<div class="flex items-center justify-between py-3">
  <div class="flex items-center gap-2">
    <span class="w-2 h-2 rounded-full bg-[var(--color-status-success)]"></span>
    <span class="text-sm font-medium text-[var(--color-text-primary)]">Agent Name</span>
  </div>
  <div class="text-right">
    <span class="text-xs font-mono text-[var(--color-text-secondary)] tabular-nums">
      42 tasks/min
    </span>
    <span class="text-[10px] text-[var(--color-status-success)] ml-1">+8%</span>
  </div>
</div>

<!-- Critical item -- full-bleed red highlight -->
<div class="flex items-center justify-between
            bg-[var(--color-status-error)]/5 -mx-4 px-4 py-3
            border-l-2 border-[var(--color-status-error)]">
  <div class="flex items-center gap-2">
    <span class="w-2 h-2 rounded-full bg-[var(--color-status-error)]"></span>
    <span class="text-sm font-medium text-[var(--color-text-primary)]">Agent Name</span>
  </div>
  <span class="text-[10px] text-[var(--color-status-error)] font-medium">FAILED</span>
</div>
<p class="text-[10px] text-[var(--color-status-error)] -mt-1 pl-4">
  Last error: connection timeout
</p>
```

Separate list items with `divide-y divide-[var(--color-border-subtle)]` on the container.

Source: Cleopatra `crisis-monitor.html`.

---

## Mini Stats Grid

Compact summary row inside a card. Numbers are color-semantic.

```html
<div class="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border-default)]">
  <div class="text-center">
    <p class="text-sm font-bold font-mono text-[var(--color-status-error)] tabular-nums">234K</p>
    <p class="text-[10px] text-[var(--color-text-secondary)]">Failed</p>
  </div>
  <div class="text-center">
    <p class="text-sm font-bold font-mono text-[var(--color-status-warning)] tabular-nums">12.4K</p>
    <p class="text-[10px] text-[var(--color-text-secondary)]">Retried</p>
  </div>
  <div class="text-center">
    <p class="text-sm font-bold font-mono text-[var(--color-brand-primary)] tabular-nums">892K</p>
    <p class="text-[10px] text-[var(--color-text-secondary)]">Completed</p>
  </div>
</div>
```

Source: Cleopatra `crisis-monitor.html` bottom summary.

---

## Chart Container

Wrapper pattern for any charting library (ApexCharts, Recharts, etc.).

```html
<div class="rounded-2xl border border-[var(--color-card-border)]
            bg-[var(--color-card-bg)] px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
  <!-- Header -->
  <div class="flex flex-col gap-5 mb-6 sm:flex-row sm:justify-between">
    <div>
      <h3 class="text-lg font-semibold text-[var(--color-text-primary)]">Events/min</h3>
      <p class="mt-1 text-[var(--color-text-secondary)] text-sm">Last 24 hours</p>
    </div>
    <!-- Time range presets -->
    <div class="flex gap-2">
      <button class="px-3 py-1 text-xs rounded-md
                     bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]">
        1h
      </button>
    </div>
  </div>

  <!-- Chart with horizontal scroll for mobile -->
  <div class="max-w-full overflow-x-auto">
    <div class="min-w-[600px] xl:min-w-full">
      <!-- Chart component renders here -->
    </div>
  </div>
</div>
```

**Chart library config for monitoring dashboards:**
- `toolbar: { show: false }` -- hide download/zoom controls
- `stroke: { curve: "straight" }` -- monitoring data should use straight lines
- `dataLabels: { enabled: false }` -- clean lines without point labels
- `markers: { size: 0, hover: { size: 6 } }` -- dots only on hover
- Compact: `height: 180` for sparkline-style, `310` for full area charts

Source: TailAdmin `StatisticsChart.tsx`, `MonthlySalesChart.tsx`.

---

## Sidebar Navigation Shell

Fixed sidebar + fixed header + scrollable main content.

```html
<!-- Header: full-width, 64px, above everything -->
<header class="fixed top-0 left-0 right-0 h-16
               bg-[var(--color-bg-surface)] border-b border-[var(--color-border-default)] z-50">
</header>

<!-- Sidebar: below header, full remaining height -->
<aside class="fixed top-16 left-0 w-[260px] h-[calc(100vh-4rem)]
              bg-[var(--color-bg-surface)] border-r border-[var(--color-border-default)]
              z-40 transition-all duration-300 overflow-y-auto">
  <!-- Nav items -->
  <nav class="flex flex-col p-6">
    <p class="uppercase text-xs text-[var(--color-text-tertiary)] mb-4 tracking-wider">
      Category
    </p>
    <a class="mb-3 capitalize font-medium text-sm text-[var(--color-text-secondary)]
              hover:text-[var(--color-text-primary)] transition duration-150
              flex items-center">
      <span class="mr-2 w-4 text-center"><!-- icon --></span>
      Nav Item
    </a>
  </nav>
</aside>

<!-- Main content: offset by sidebar -->
<main class="lg:ml-[260px] pt-16 min-h-screen transition-all duration-300">
</main>
```

**Mobile sidebar:** `-translate-x-full` to `translate-x-0` toggle with `bg-black/50 backdrop-blur-sm` backdrop overlay.

Z-index layering: header `z-50`, sidebar `z-40`, content `z-auto`.

Source: Cleopatra `sidebar.html`, `start.html`.

---

## Event Card (Observability-Specific)

For event stream UIs showing typed events with expandable detail.

```html
<div class="bg-[var(--color-card-bg)] border border-[var(--color-card-border)]
            rounded-[var(--radius-card)] p-[var(--space-card-padding)]
            hover:bg-[var(--color-card-hover)] transition-colors duration-150
            cursor-pointer"
     :style="{ borderLeftWidth: '4px', borderLeftColor: getEventColor(event.type) }">

  <div class="flex items-center justify-between">
    <!-- Event type badge -->
    <span class="bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)]
                 px-2 py-0.5 rounded-full text-xs font-semibold">
      {{ formatEventType(event.type) }}
    </span>

    <!-- Timestamp -->
    <span class="text-[var(--color-text-tertiary)] font-mono text-xs tabular-nums">
      {{ formatTime(event.timestamp) }}
    </span>
  </div>

  <!-- Tool detail line -->
  <p class="mt-1 text-[var(--color-text-secondary)] text-sm truncate">
    {{ event.data.tool_name || event.data.command }}
  </p>

  <!-- Expandable JSON panel (v-show on click) -->
  <div v-show="expanded"
       class="mt-2 bg-[var(--color-json-bg)] border border-[var(--color-json-border)]
              rounded-md p-3 overflow-x-auto">
    <pre class="text-[var(--color-json-text)] text-xs font-mono">
      {{ JSON.stringify(event.data, null, 2) }}
    </pre>
  </div>
</div>
```

Source: Custom pattern derived from TailAdmin cards + Cleopatra crisis monitor + OpenClaw live feed.
