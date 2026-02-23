# shadcn-vue Practical Patterns

Deep dive into shadcn-vue theming, component patterns, and Tailwind v4 migration. Complements the broader Vue patterns in `vue-patterns.md`.

---

## Theming System: CSS Variable Pairs

shadcn-vue uses background/foreground CSS variable pairs. Every semantic slot has two values that travel together.

```css
/* globals.css -- dark theme */
:root {
  --background: 240 10% 3.9%;      /* Page background */
  --foreground: 0 0% 98%;           /* Default text on background */

  --card: 240 10% 3.9%;             /* Card surface */
  --card-foreground: 0 0% 98%;      /* Text on cards */

  --primary: 0 0% 98%;              /* Primary action */
  --primary-foreground: 240 5.9% 10%; /* Text on primary buttons */

  --muted: 240 3.7% 15.9%;          /* Subdued surfaces */
  --muted-foreground: 240 5% 64.9%; /* Subdued text */

  --destructive: 0 62.8% 30.6%;     /* Danger actions */
  --destructive-foreground: 0 0% 98%;

  --border: 240 3.7% 15.9%;
  --ring: 240 4.9% 83.9%;           /* Focus ring */
}
```

**Key insight:** Values are HSL channels without `hsl()` wrapper, allowing Tailwind opacity modifiers:
```html
<div class="bg-primary/10 text-primary">Tinted badge</div>
```

### Mapping to Two-Tier Tokens

When integrating shadcn-vue with a custom design token system, map shadcn's variables to your semantic tokens:

| shadcn-vue variable | Maps to semantic token | Purpose |
|---------------------|----------------------|---------|
| `--background` | `--color-bg-base` | Page background |
| `--card` | `--color-card-bg` | Card surface |
| `--muted` | `--color-bg-hover` | Hover/subdued surface |
| `--border` | `--color-card-border` | Borders |
| `--destructive` | `--color-status-error` | Error/danger |
| `--primary` | `--color-brand-primary` | Brand accent |
| `--ring` | `--color-focus-ring` | Focus indicators |

**Common mistake:** Using shadcn's raw variable names (`bg-card`) alongside custom semantic tokens (`bg-[var(--color-card-bg)]`). Pick one system. If using shadcn-vue components, remap their variables to your tokens in `globals.css`.

---

## DataTable with TanStack Table

shadcn-vue's DataTable is a thin wrapper around TanStack Table v8. It provides styled `<Table>`, `<TableHeader>`, `<TableRow>`, `<TableCell>` primitives but delegates all data logic to TanStack.

```vue
<script setup lang="ts">
import { DataTable } from '@/components/ui/data-table'
import type { ColumnDef } from '@tanstack/vue-table'

interface Event {
  id: string
  type: string
  timestamp: string
  severity: 'info' | 'warn' | 'error' | 'critical'
}

const columns: ColumnDef<Event>[] = [
  { accessorKey: 'type', header: 'Event Type' },
  {
    accessorKey: 'timestamp',
    header: 'Time',
    cell: ({ row }) => h('span', { class: 'font-mono tabular-nums' }, row.getValue('timestamp'))
  },
  {
    accessorKey: 'severity',
    header: 'Severity',
    cell: ({ row }) => {
      const severity = row.getValue<string>('severity')
      return h('span', {
        class: `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                 bg-[var(--color-status-${severity})]/10
                 text-[var(--color-status-${severity})]`
      }, severity)
    }
  }
]
</script>

<template>
  <DataTable :columns="columns" :data="events" />
</template>
```

**Features available out of the box:**
- Sorting (click headers)
- Filtering (column-level or global)
- Pagination
- Row selection (checkbox column)
- Column visibility toggle

**For virtual scrolling:** Replace the default `<TableBody>` with TanStack Virtual's row virtualizer when exceeding 500 rows. See `performance.md` for the virtual scrolling decision tree.

---

## Tailwind v4 Migration (5 Changes)

shadcn-vue was built for Tailwind v3. Migrating to v4 requires these specific changes:

### 1. No `tailwind.config.ts`

Tailwind v4 uses CSS-first configuration. Remove the config file entirely.

### 2. HSL values in CSS

shadcn-vue's default variables use space-separated HSL channels. In Tailwind v4, wrap them:

```css
/* Before (v3 -- space-separated channels) */
--primary: 0 0% 98%;

/* After (v4 -- full hsl() function) */
--primary: hsl(0 0% 98%);
```

### 3. `@theme inline` mapping

Register shadcn's CSS variables as Tailwind theme values:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
}
```

This enables `bg-card`, `text-primary`, etc. as native Tailwind utilities.

### 4. `@custom-variant dark`

Replace `darkMode: 'class'` config with:

```css
@custom-variant dark (&:is(.dark *));
```

### 5. Manual fixes

Some utilities changed between v3 and v4:
- `cursor-pointer` on buttons -- may need explicit addition
- `border-*` utilities -- check default border color behavior
- `ring-*` utilities -- focus ring syntax may differ

Source: Community migration guides (Feb 2026), shadcn-vue GitHub issues

---

## Charts: Unovis

shadcn-vue recommends **Unovis** as its chart library (not Recharts, which is React-only).

- Framework-agnostic with Vue bindings (`@unovis/vue`)
- Supports: line, bar, area, scatter, donut, stacked bar, tooltip
- Theming via CSS variables -- integrates with shadcn's token system
- Tree-shakeable -- only import the chart types you use

```vue
<script setup>
import { VisXYContainer, VisLine, VisAxis } from '@unovis/vue'
</script>

<template>
  <VisXYContainer :data="chartData">
    <VisLine :x="d => d.timestamp" :y="d => d.value" />
    <VisAxis type="x" />
    <VisAxis type="y" />
  </VisXYContainer>
</template>
```

**For sparklines in metric cards:** Unovis `VisLine` with axes hidden, fixed height (~40px), and the brand accent color.

---

## Community Position: shadcn-vue vs Alternatives

| Library | Strengths | Weaknesses |
|---------|-----------|------------|
| **shadcn-vue** | Full style control, copy-into-project, active community | Manual Tailwind v4 migration, no built-in charts |
| **PrimeVue (Volt)** | 280k weekly downloads, Tailwind-only variant, 100+ components | Heavier, opinionated styling harder to override |
| **Naive UI** | Tree-shakeable, TypeScript-first, 16k stars | Weaker Tailwind integration, own styling system |
| **Vueless** | Design system framework, Storybook-first, Tailwind v4 native | Newer, smaller community |

**For observability dashboards:** shadcn-vue wins on style control. The copy-into-project model means every component can be customized for the specific dashboard needs (critical row highlighting, custom severity badges, etc.) without fighting a component library's opinions.

**Caveat from @pJacquelDesign:** "React + Tailwind fails where Svelte + Panda CSS gives pixel-perfect results." The Tailwind-via-copy approach requires more manual work than a pre-styled library. This is the tradeoff for full control.
