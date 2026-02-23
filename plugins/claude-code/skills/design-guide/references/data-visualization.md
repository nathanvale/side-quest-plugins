# Data Visualization Libraries for Vue 3 Dashboards

Chart library comparison for Tailwind dark-mode dashboards. Covers bundle size, dark mode integration, real-time updates, sparklines, and large dataset rendering.

---

## Library Comparison

| Library | Bundle (gzipped) | Dark mode approach | Real-time | Vue 3 support | Best for |
|---------|------------------|--------------------|-----------|---------------|----------|
| **Unovis** | ~25kb | CSS variables (automatic) | Manual prop updates | `@unovis/vue` | shadcn-vue native, lightest option |
| **ApexCharts** | ~150kb gzipped (~5MB raw) | Imperative: `theme: { mode: 'dark' }` | Built-in reactive series prop | `vue3-apexcharts` | Best DX for real-time line/area charts |
| **Chart.js** | ~65kb gzipped | Plugin-based color config | Manual `update()` calls | `vue-chartjs` | Largest ecosystem, moderate complexity |
| **ECharts** | 57.6MB raw (must tree-shake!) | `echarts.registerTheme()` imperative | Reactive `option` prop via vue-echarts | `vue-echarts` | 100k+ data points, Canvas/WebGL switching |

---

## Decision Tree

```
Is the dashboard already using shadcn-vue?
  YES -> Unovis (native integration, CSS variable theming)
  NO  -> Continue

Do you need >10,000 data points per chart?
  YES -> ECharts (Canvas/WebGL, incremental rendering)
  NO  -> Continue

Do you need real-time updating charts (WebSocket-fed)?
  YES -> ApexCharts (reactive series prop, built-in animation)
  NO  -> Continue

Do you want the smallest bundle?
  YES -> Unovis (~25kb) or Chart.js (~65kb)
  NO  -> ApexCharts (richest out-of-box features)
```

---

## Unovis (shadcn-vue Default)

shadcn-vue chose Unovis deliberately. Maintainer rationale (issue #652): "The base components weren't very helpful as the charts needed to expose finer control to the developer."

**Why it wins for Tailwind dark mode:**
- Styles via CSS variables -- dark mode switching happens without re-rendering the chart
- No imperative color reconfiguration needed
- Claimed ~20x lighter than Recharts (488kb)
- Tree-shakeable -- import only the chart types you use

```vue
<script setup>
import { VisXYContainer, VisLine, VisAxis, VisTooltip } from '@unovis/vue'

const data = ref([{ x: 0, y: 42 }, { x: 1, y: 67 }, { x: 2, y: 53 }])
</script>

<template>
  <VisXYContainer :data="data" class="h-64">
    <VisLine
      :x="(d: any) => d.x"
      :y="(d: any) => d.y"
      color="var(--color-brand-primary)"
    />
    <VisAxis type="x" />
    <VisAxis type="y" />
    <VisTooltip />
  </VisXYContainer>
</template>
```

**Supported chart types:** Line, Area, Bar (stacked/grouped), Scatter, Donut, Sankey, Graph/Network, Timeline, Sparkline, Bullet Legend.

**Limitation:** Smaller community than Chart.js/ECharts. Fewer Stack Overflow answers. Documentation is adequate but not extensive.

Source: [unovis.dev](https://unovis.dev/), [shadcn-vue issue #652](https://github.com/unovue/shadcn-vue/issues/652)

---

## ApexCharts (Best Real-Time DX)

The most-cited library for real-time Vue 3 charts. Reactive `series` prop triggers automatic re-render.

```vue
<script setup>
import VueApexCharts from 'vue3-apexcharts'

const options = ref({
  chart: {
    type: 'line',
    background: 'transparent',
    foreColor: 'var(--color-text-secondary)',
    animations: { enabled: true, dynamicAnimation: { speed: 350 } }
  },
  theme: { mode: 'dark' },
  colors: ['var(--color-brand-primary)', 'var(--color-status-error)'],
  grid: { borderColor: 'var(--color-card-border)' },
  xaxis: { type: 'datetime' }
})

const series = ref([{ name: 'Events/sec', data: [] }])

// WebSocket update -- just push to series, chart re-renders
function onMessage(event: EventEnvelope) {
  series.value[0].data.push({ x: event.timestamp, y: event.rate })
}
</script>

<template>
  <VueApexCharts type="line" :options="options" :series="series" height="300" />
</template>
```

**Dark mode caveat:** ApexCharts requires explicit `theme: { mode: 'dark' }` and manual color array configuration. It does NOT read CSS variables natively for all properties -- `foreColor` and `grid.borderColor` accept CSS var references, but palette colors may need explicit hex values depending on the chart type.

**Sparkline mode:**
```javascript
chart: { sparkline: { enabled: true } }  // Hides axes, grid, labels
```

Source: [apexcharts.com/vue-chart-demos](https://apexcharts.com/vue-chart-demos/line-charts/realtime/)

---

## ECharts (Large Dataset Champion)

For datasets exceeding 10,000 points. Three rendering modes:

| Mode | When | Performance |
|------|------|-------------|
| Canvas (default) | 1k-100k points | Sub-100ms render |
| SVG | <1k points, print/export | Crisp scaling, slower at volume |
| WebGL (`echarts-gl`) | 100k+ points | Millions of points progressively |

**Critical tree-shaking warning:** The ECharts dark theme module (`echarts/theme/dark`) imports the ENTIRE `echarts` package, defeating tree-shaking. Import individual chart types from `echarts/lib/*` instead:

```typescript
// GOOD -- tree-shakeable
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

// BAD -- pulls in everything (57.6MB)
import * as echarts from 'echarts'
```

**Dark mode:** Define a custom theme with your semantic tokens rather than using the built-in dark theme:

```typescript
echarts.registerTheme('dashboard-dark', {
  backgroundColor: 'transparent',
  textStyle: { color: 'var(--color-text-primary)' },
  // ... map all colors to semantic tokens
})
```

Source: [vue-echarts issue #345](https://github.com/ecomfe/vue-echarts/issues/345), [echarts.apache.org](https://echarts.apache.org/en/feature.html)

---

## Sparklines for Metric Cards

Four options ranked by weight:

| Solution | Bundle impact | Dependency | Best for |
|----------|--------------|------------|----------|
| **sparkline-vue** | ~5kb | Zero deps | Lightest, purpose-built |
| **Unovis Sparkline** | Already loaded if using Unovis | @unovis/vue | Consistency with other charts |
| **Vuetify `<v-sparkline>`** | Free if using Vuetify | Vuetify v4 | Already in Vuetify stack |
| **ApexCharts sparkline mode** | ~150kb | vue3-apexcharts | Already in ApexCharts stack |

**For metric cards in an observability dashboard:** If using Unovis for other charts, use Unovis Sparkline. If no chart library is loaded yet and you only need sparklines, use `sparkline-vue`.

```vue
<!-- Unovis sparkline in a metric card -->
<div class="rounded-2xl border border-[var(--color-card-border)]
            bg-[var(--color-card-bg)] p-5">
  <div class="flex items-center justify-between">
    <span class="text-sm text-[var(--color-text-secondary)]">Events/sec</span>
    <VisXYContainer :data="sparkData" class="h-10 w-24">
      <VisLine
        :x="(d: any) => d.x"
        :y="(d: any) => d.y"
        color="var(--color-brand-primary)"
      />
    </VisXYContainer>
  </div>
  <span class="mt-2 text-2xl font-bold font-mono tabular-nums
               text-[var(--color-text-primary)]">
    1,247
  </span>
</div>
```

---

## Emerging: Bklit UI

New project from @uixmat (471 likes, Jan 2026). shadcn/ui-compatible chart components built on **visx** (Airbnb's D3-based primitives). No Vue-specific support confirmed yet -- React-first. Worth monitoring for cross-pollination patterns if/when a Vue port appears.

Source: [x.com/uixmat](https://x.com/uixmat/status/2013271851133284763)

---

## Common Mistakes

1. **Importing full ECharts** -- 57.6MB uncompressed. Always tree-shake via `echarts/core` + individual chart imports
2. **Using ApexCharts' `theme.mode: 'dark'` alone** -- still need to manually set `foreColor`, `grid.borderColor`, and palette colors to match your tokens
3. **Adding a chart library just for sparklines** -- use `sparkline-vue` (5kb) or native SVG if that's all you need
4. **Using Canvas for <500 points** -- DOM/SVG is simpler and debuggable. Canvas only wins above 3,000+ elements (see `performance.md`)
5. **Recharts in Vue** -- Recharts is React-only. The npm download count (11.76M) is misleading for Vue projects
