# Dashboard Layout Systems

Layout architecture for Vue 3 + Tailwind dashboards. Covers resizable panels, drag-to-rearrange grids, collapsible sidebars, responsive patterns, and container queries.

---

## Dashboard Shell Architecture

The dominant pattern: sidebar + header + CSS Grid content area.

```html
<div class="flex h-screen bg-[var(--color-bg-base)]">
  <!-- Sidebar (collapsible) -->
  <aside class="w-64 shrink-0 border-r border-[var(--color-card-border)]
                bg-[var(--color-bg-surface)]
                transition-[width] duration-200
                data-[collapsed]:w-16">
    <!-- Navigation -->
  </aside>

  <!-- Main content area -->
  <div class="flex flex-1 flex-col overflow-hidden">
    <!-- Sticky header -->
    <header class="sticky top-0 z-30 border-b border-[var(--color-card-border)]
                   bg-[var(--color-bg-surface)]/80 backdrop-blur-xl px-6 py-3">
      <!-- Breadcrumbs, search, user menu -->
    </header>

    <!-- Scrollable content -->
    <main class="flex-1 overflow-y-auto p-6">
      <!-- Dashboard grid -->
    </main>
  </div>
</div>
```

**Reference templates:**
- **admin-one-vue-tailwind** -- Vue 3 + Tailwind 4, ~38kb CSS after purge, Nuxt 3 + Laravel integrations
- **v-dashboard** -- Minimal Vite + Vue 3 + Tailwind + TypeScript shell
- **Tailwind UI** -- Official [sidebar layouts](https://tailwindcss.com/plus/ui-blocks/application-ui/application-shells/sidebar) and [stacked layouts](https://tailwindcss.com/plus/ui-blocks/application-ui/application-shells/stacked)

---

## Collapsible Sidebar: shadcn-vue Sidebar

The most complete Vue 3 sidebar solution. 30+ pre-built block configurations.

**Key features:**
- `SidebarProvider` owns collapse state, persists via `storageKey`
- Keyboard shortcut: `cmd+b` / `ctrl+b` toggle out of the box
- `collapsible="icon"` -- collapses to icon rail (like VS Code)
- `collapsible="offcanvas"` -- slides off screen entirely
- `SidebarRail` -- hover-to-expand pattern
- `useSidebar()` hook -- mobile detection + programmatic control
- CSS variable `--sidebar-width` drives layout offset automatically

```vue
<script setup>
import {
  SidebarProvider, Sidebar, SidebarContent,
  SidebarGroup, SidebarGroupLabel, SidebarMenu,
  SidebarMenuItem, SidebarMenuButton, SidebarRail
} from '@/components/ui/sidebar'
</script>

<template>
  <SidebarProvider>
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Monitoring</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton as-child>
                <RouterLink to="/events">
                  <ActivityIcon class="h-4 w-4" />
                  <span>Event Feed</span>
                </RouterLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>

    <!-- Page content -->
    <main class="flex-1">
      <slot />
    </main>
  </SidebarProvider>
</template>
```

Source: [shadcn-vue.com/docs/components/sidebar](https://www.shadcn-vue.com/docs/components/sidebar)

---

## Resizable Panels: Splitpanes

The community's default for resizable split-pane layouts in Vue 3.

- Zero dependencies beyond Vue
- Nested layouts (horizontal inside vertical)
- Touch device support
- Double-click splitter to maximize a pane
- Programmatic pane add/remove

```vue
<script setup>
import { Splitpanes, Pane } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'
</script>

<template>
  <Splitpanes class="default-theme h-full">
    <!-- Left panel: event list -->
    <Pane min-size="20" size="30">
      <EventFeed />
    </Pane>

    <!-- Right panel: detail + chart (nested vertical split) -->
    <Pane>
      <Splitpanes horizontal>
        <Pane min-size="30">
          <EventDetail />
        </Pane>
        <Pane>
          <TimelineChart />
        </Pane>
      </Splitpanes>
    </Pane>
  </Splitpanes>
</template>
```

**Tailwind integration:** Override Splitpanes' default theme CSS with your semantic tokens:

```css
.splitpanes--vertical > .splitpanes__splitter {
  width: 1px;
  background-color: var(--color-card-border);
}
.splitpanes__splitter:hover {
  background-color: var(--color-brand-primary);
}
```

**Alternatives:**
- `@marsio/vue-split-pane` -- explicit `direction` prop, min/max constraints
- `vue-multipane` -- flexbox-based, older but stable

Source: [antoniandre.github.io/splitpanes](https://antoniandre.github.io/splitpanes/)

---

## Drag-to-Rearrange Widgets: Gridstack.js

For Datadog/Grafana-style dashboards where users can rearrange and resize widget panels.

- Framework-agnostic TypeScript library
- Draggable + resizable items
- Save/restore layout (JSON serialization)
- Collision detection and auto-placement

```vue
<script setup>
import { onMounted, ref } from 'vue'
import { GridStack } from 'gridstack'
import 'gridstack/dist/gridstack.min.css'

const grid = ref<GridStack>()

onMounted(() => {
  grid.value = GridStack.init({
    column: 12,
    cellHeight: 80,
    minRow: 1,
    float: true,
    animate: true,
  })
})

function saveLayout() {
  const items = grid.value?.save()
  localStorage.setItem('dashboard-layout', JSON.stringify(items))
}

function restoreLayout() {
  const saved = localStorage.getItem('dashboard-layout')
  if (saved) grid.value?.load(JSON.parse(saved))
}
</script>

<template>
  <div class="grid-stack">
    <div class="grid-stack-item" gs-w="4" gs-h="2">
      <div class="grid-stack-item-content">
        <MetricCard title="Events/sec" />
      </div>
    </div>
    <div class="grid-stack-item" gs-w="8" gs-h="4">
      <div class="grid-stack-item-content">
        <TimelineChart />
      </div>
    </div>
  </div>
</template>
```

**Tailwind integration:** Override Gridstack's CSS to use semantic tokens for borders, shadows, and drag handles.

**Alternatives:**
- `vue-grid-layout-v3` -- unofficial Vue 3 fork of vue-grid-layout
- Custom CSS Grid with `order` property for simple reordering

Source: [gridstackjs.com](https://gridstackjs.com/)

---

## Responsive Dashboard Grid

The standard Tailwind responsive grid pattern. Progressive column stacking:

```html
<!-- Stat cards row -->
<div class="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
  <MetricCard title="Total Events" />
  <MetricCard title="Error Rate" />
  <MetricCard title="Avg Latency" />
  <MetricCard title="Active Sessions" />
</div>

<!-- Two-column content area -->
<div class="mt-6 grid gap-6 grid-cols-1 lg:grid-cols-3">
  <!-- Event feed takes 2/3 -->
  <div class="lg:col-span-2">
    <EventFeed />
  </div>
  <!-- Sidebar panel takes 1/3 -->
  <div>
    <QuickStats />
    <RecentAlerts />
  </div>
</div>
```

**Breakpoint strategy:**
| Screen | Tailwind prefix | Columns | Notes |
|--------|----------------|---------|-------|
| Mobile (<768px) | (default) | 1 | Single column stack |
| Tablet (768px+) | `md:` | 2 | Two-column for cards |
| Desktop (1024px+) | `lg:` | 3-4 | Full grid, sidebar visible |
| Wide (1280px+) | `xl:` | 4-6 | Extra columns for data-dense views |

**Data tables on mobile:** Horizontal scroll with `overflow-x-auto`, or conditionally render a simplified card view below `md`:

```html
<!-- Desktop: full table -->
<div class="hidden md:block overflow-x-auto">
  <DataTable :columns="columns" :data="events" />
</div>

<!-- Mobile: card list -->
<div class="md:hidden space-y-3">
  <EventCard v-for="event in events" :key="event.id" :event="event" />
</div>
```

---

## Container Queries for Widget-Level Responsiveness

Container queries let individual widgets adapt to their container size, not the viewport. This is critical for dashboards where the same widget might appear in a full-width panel or a narrow sidebar.

**Browser support:** Baseline-supported in all major browsers (Chrome 105+, Firefox 110+, Safari 16+). ~41% actual usage as of Feb 2026.

**Setup with Tailwind:**

```bash
# Install the plugin (Tailwind v3/v4)
bun add @tailwindcss/container-queries
```

```html
<!-- Widget wrapper: mark as container -->
<div class="@container rounded-2xl border border-[var(--color-card-border)]
            bg-[var(--color-card-bg)] p-5">
  <!-- Content adapts to container width, not viewport -->
  <div class="flex flex-col @md:flex-row @md:items-center gap-4">
    <div class="flex-1">
      <h3 class="text-sm @lg:text-base">Events/sec</h3>
      <span class="text-2xl @lg:text-3xl font-bold font-mono tabular-nums">1,247</span>
    </div>
    <!-- Sparkline only shows when container is wide enough -->
    <div class="hidden @sm:block h-10 w-24">
      <Sparkline :data="sparkData" />
    </div>
  </div>
</div>
```

**Gotchas:**
1. Containers cannot query themselves -- must measure an ancestor element
2. Grid items should NOT be direct containers -- wrap the content inside the grid item
3. Custom CSS properties don't work inside `@container` queries
4. Use media queries for macro layout (sidebar collapse, page columns)
5. Use container queries for micro layout (individual widget adaptation)

```html
<!-- CORRECT: wrapper inside grid item -->
<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div><!-- grid item -->
    <div class="@container"><!-- container wrapper -->
      <MetricCard />
    </div>
  </div>
</div>

<!-- WRONG: grid item as container -->
<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div class="@container"><!-- grid item AND container -- problematic -->
    <MetricCard />
  </div>
</div>
```

Source: [logrocket.com/container-queries-2026](https://blog.logrocket.com/container-queries-2026/)

---

## Community Sentiment: Tailwind vs Component Libraries for Dashboards

Active debate (Feb 2026). The community splits by use case:

- **"shadcn + tailwind is goated rn, material is good for dashboard apps"** (@todorovskiognxn)
- **"Tailwind for landing pages, AntD for dashboards"** (@aminnnn_09)
- **"Tailwind of course. For dashboard material ui (vuetify)"** (@MoYazanx)

**Translation:** Use Tailwind for the shell, layout, and custom components. Use a component library (Vuetify, shadcn-vue) for complex data widgets (data tables, date pickers, select menus) where building from scratch is wasteful.

**Our position:** shadcn-vue gives us the best of both -- copy-into-project components styled with Tailwind utilities, full control over the markup, no external CSS to fight.
