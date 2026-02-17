# Dashboard Form Patterns

Form patterns for Vue 3 dashboard filter bars, command palettes, and settings panels. Covers shadcn-vue form components, VeeValidate + Zod validation, filter state management, and keyboard shortcuts.

---

## shadcn-vue Form Component Inventory

Components available for dashboard filter UIs:

| Component | Use case | Notes |
|-----------|----------|-------|
| **Form** | Validation wrapper | Built on VeeValidate, wraps FormField/FormItem/FormControl |
| **Select** | Single-value dropdown filters | Trigger + dropdown |
| **Combobox** | Searchable dropdown, multi-select | Select + Command composition |
| **DatePicker** | Single date selection | Popover + Calendar |
| **RangeCalendar** | Date range selection | For "last 7 days", "custom range" filters |
| **Command** | Command palette (cmdk) | Fuzzy search, keyboard nav, grouped results |
| **Input** | Text search, numeric filters | Wraps into FormField for validation |
| **Badge** | Active filter display | Show/dismiss active filters |
| **Popover** | Filter dropdown containers | Wraps Select, Calendar, Combobox |

**Date handling:** DatePicker and RangeCalendar depend on `@internationalized/date` for timezone-aware date math. No built-in preset patterns ("Last 7 days", "Last 30 days") -- compose a Select of presets that programmatically sets the CalendarDate range.

---

## VeeValidate + Zod: The Standard Stack

The canonical wiring pattern for shadcn-vue forms:

```vue
<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

const filterSchema = toTypedSchema(z.object({
  severity: z.enum(['all', 'info', 'warn', 'error', 'critical']).default('all'),
  search: z.string().optional(),
  dateRange: z.object({
    start: z.string(),
    end: z.string()
  }).optional()
}))

const { handleSubmit, values, resetForm } = useForm({
  validationSchema: filterSchema,
  initialValues: { severity: 'all', search: '' }
})
</script>

<template>
  <form class="flex items-center gap-3" @submit.prevent="handleSubmit(applyFilters)">
    <!-- Severity filter -->
    <FormField v-slot="{ componentField }" name="severity">
      <FormItem>
        <Select v-bind="componentField">
          <SelectTrigger class="w-36">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </FormItem>
    </FormField>

    <!-- Search input -->
    <FormField v-slot="{ componentField }" name="search">
      <FormItem>
        <FormControl>
          <Input v-bind="componentField" placeholder="Search events..." class="w-64" />
        </FormControl>
      </FormItem>
    </FormField>
  </form>
</template>
```

**Key DX win:** `@vee-validate/zod` auto-types `values` and `handleSubmit` arguments from the Zod schema. No manual type annotations needed.

**Validation mode for filters:** Use `validate-on-input` for live feedback without a submit button. Dashboard filters typically apply immediately -- no "Submit" step.

Source: [shadcn-vue.com/docs/forms/vee-validate](https://www.shadcn-vue.com/docs/forms/vee-validate)

---

## Filter State Management

The community-standard architecture for dashboard filter state:

```
Pinia store (global filter state)
  -> Composable (debounce + orchestration)
    -> TanStack Query (data fetching)
      -> Component (display)
```

### Pinia Store for Filters

```typescript
// stores/filters.ts
import { defineStore } from 'pinia'

export const useFilterStore = defineStore('filters', () => {
  const severity = ref<string>('all')
  const search = ref<string>('')
  const dateRange = ref<{ start: string; end: string } | null>(null)
  const page = ref(1)

  function reset() {
    severity.value = 'all'
    search.value = ''
    dateRange.value = null
    page.value = 1
  }

  return { severity, search, dateRange, page, reset }
})
```

### Debounced Search with VueUse

```typescript
import { useDebounceFn } from '@vueuse/core'

const filterStore = useFilterStore()

const debouncedSearch = useDebounceFn((val: string) => {
  filterStore.search = val
  filterStore.page = 1  // Reset pagination on new search
}, 300)
```

`useDebounceFn` from `@vueuse/core` is the standard -- no separate debounce library needed.

### URL Query Param Sync

For shareable filter state, mirror Pinia store to router query params:

```typescript
import { useRouteQuery } from '@vueuse/router'

// Two-way sync: URL <-> store
const severityParam = useRouteQuery('severity', 'all')
watch(severityParam, (val) => { filterStore.severity = val })
watch(() => filterStore.severity, (val) => { severityParam.value = val })
```

---

## Command Palette (cmdk Pattern)

shadcn-vue's `Command` component for global dashboard navigation:

```vue
<script setup>
import { useMagicKeys } from '@vueuse/core'
import {
  CommandDialog, CommandInput, CommandList,
  CommandEmpty, CommandGroup, CommandItem, CommandShortcut
} from '@/components/ui/command'

const open = ref(false)
const { Meta_K } = useMagicKeys()
watch(Meta_K, (v) => { if (v) open.value = !open.value })
</script>

<template>
  <CommandDialog v-model:open="open">
    <CommandInput placeholder="Search events, views, settings..." />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>

      <CommandGroup heading="Navigation">
        <CommandItem @select="() => router.push('/events')">
          <ActivityIcon class="mr-2 h-4 w-4" />
          Event Feed
          <CommandShortcut>G E</CommandShortcut>
        </CommandItem>
        <CommandItem @select="() => router.push('/metrics')">
          <BarChartIcon class="mr-2 h-4 w-4" />
          Metrics
          <CommandShortcut>G M</CommandShortcut>
        </CommandItem>
      </CommandGroup>

      <CommandGroup heading="Quick Actions">
        <CommandItem @select="clearFilters">
          <XIcon class="mr-2 h-4 w-4" />
          Clear all filters
          <CommandShortcut>Esc Esc</CommandShortcut>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
```

**Limitation:** For database-backed search (Algolia, etc.), override the default fuzzy filtering via a custom `filter` prop. See [shadcn-vue issue #158](https://github.com/unovue/shadcn-vue/issues/158).

**For filter dropdowns:** Use `Combobox` (Command + Popover composition), not the full Command palette. Command is for global navigation; Combobox is for field-level selection.

---

## Combobox for Multi-Select Filters

The recommended pattern for filtering by event type, severity, or other multi-value fields:

```vue
<script setup>
import { Combobox, ComboboxAnchor, ComboboxInput, ComboboxContent,
         ComboboxItem, ComboboxEmpty } from '@/components/ui/combobox'
import { Badge } from '@/components/ui/badge'

const eventTypes = [
  { value: 'http', label: 'HTTP' },
  { value: 'grpc', label: 'gRPC' },
  { value: 'websocket', label: 'WebSocket' },
  { value: 'cron', label: 'Cron Job' },
]

const selected = ref<string[]>([])
</script>

<template>
  <Combobox v-model="selected" multiple>
    <ComboboxAnchor class="flex flex-wrap gap-1.5 rounded-md border
                           border-[var(--color-border)] bg-[var(--color-card)]
                           px-3 py-2">
      <!-- Active filter badges -->
      <Badge v-for="type in selected" :key="type" variant="secondary"
             class="gap-1" @click="selected = selected.filter(t => t !== type)">
        {{ eventTypes.find(e => e.value === type)?.label }}
        <XIcon class="h-3 w-3" />
      </Badge>
      <ComboboxInput placeholder="Filter event types..." class="flex-1 bg-transparent" />
    </ComboboxAnchor>

    <ComboboxContent>
      <ComboboxEmpty>No event types found.</ComboboxEmpty>
      <ComboboxItem v-for="type in eventTypes" :key="type.value" :value="type.value">
        {{ type.label }}
      </ComboboxItem>
    </ComboboxContent>
  </Combobox>
</template>
```

---

## Date Range Picker with Presets

Compose a Select (presets) + RangeCalendar (custom range):

```vue
<script setup>
import { CalendarDate, today, getLocalTimeZone } from '@internationalized/date'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { RangeCalendar } from '@/components/ui/range-calendar'

const tz = getLocalTimeZone()
const now = today(tz)

const presets = [
  { label: 'Last 15 min', value: 'last15m' },
  { label: 'Last 1 hour', value: 'last1h' },
  { label: 'Last 24 hours', value: 'last24h' },
  { label: 'Last 7 days', value: 'last7d' },
  { label: 'Last 30 days', value: 'last30d' },
  { label: 'Custom range', value: 'custom' },
]

const selectedPreset = ref('last24h')
const dateRange = ref({ start: now.subtract({ days: 1 }), end: now })

function applyPreset(preset: string) {
  selectedPreset.value = preset
  switch (preset) {
    case 'last15m': /* set range */ break
    case 'last1h':  /* set range */ break
    case 'last24h': dateRange.value = { start: now.subtract({ days: 1 }), end: now }; break
    case 'last7d':  dateRange.value = { start: now.subtract({ days: 7 }), end: now }; break
    case 'last30d': dateRange.value = { start: now.subtract({ days: 30 }), end: now }; break
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Preset select -->
    <Select v-model="selectedPreset" @update:model-value="applyPreset">
      <SelectTrigger class="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="preset in presets" :key="preset.value" :value="preset.value">
          {{ preset.label }}
        </SelectItem>
      </SelectContent>
    </Select>

    <!-- Custom range picker (shows when "Custom range" selected) -->
    <Popover v-if="selectedPreset === 'custom'">
      <PopoverTrigger as-child>
        <Button variant="outline">
          <CalendarIcon class="mr-2 h-4 w-4" />
          Pick dates
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0">
        <RangeCalendar v-model="dateRange" />
      </PopoverContent>
    </Popover>
  </div>
</template>
```

---

## Keyboard Shortcuts for Dashboard Forms

Standard shortcuts used in data-dense dashboards:

| Shortcut | Action | Implementation |
|----------|--------|----------------|
| `Cmd+K` / `Ctrl+K` | Open command palette | `useMagicKeys` from VueUse |
| `Escape` | Clear current filter / close popover | Native `@keydown.escape` |
| `/` | Focus search input | `useMagicKeys` + `inputRef.focus()` |
| `Cmd+Shift+F` | Focus filter bar | `useMagicKeys` |

```typescript
import { useMagicKeys, whenever } from '@vueuse/core'

const { slash, escape } = useMagicKeys()
const searchRef = ref<HTMLInputElement>()

// "/" focuses search (only when not already in an input)
whenever(slash, () => {
  if (document.activeElement?.tagName !== 'INPUT') {
    searchRef.value?.focus()
  }
})

// Escape clears search when focused
whenever(escape, () => {
  if (document.activeElement === searchRef.value) {
    filterStore.search = ''
    searchRef.value?.blur()
  }
})
```

---

## Validation Libraries: VeeValidate vs TanStack Form vs Regle

| Feature | VeeValidate + Zod | TanStack Form | Regle |
|---------|-------------------|---------------|-------|
| Community adoption | Dominant (shadcn-vue default) | Growing | Emerging |
| Zod integration | `@vee-validate/zod` adapter | Native | `@regle/zod` |
| Vue Composition API fit | Good | React-centric API patterns | Native Vue idioms |
| Pinia integration | Manual | Manual | Built-in |
| Array fields | FormField with v-for | `field.pushValue()` / `field.removeValue()` | Native |
| shadcn-vue integration | Official | Official | Community |

**Recommendation:** VeeValidate + Zod for dashboard filters. It's the community default, has the best shadcn-vue integration, and handles the typical filter-bar use case (5-10 fields, live validation) without friction. TanStack Form adds value for complex multi-step forms. Regle is worth watching for Pinia-heavy architectures.

---

## Enterprise Reference: ReUI Filter Patterns

[ReUI](https://reui.io/patterns/filters) ships a production-ready filter pattern system:
- Multiple filter types with logical operators (AND/OR)
- Integration with Data Grid (sorting, filtering, pagination)
- 31 input patterns, 33 select patterns, 20 combobox patterns, 4 date selector patterns
- Badge-based active filter display with dismiss

This is the closest thing to a reference implementation for data-dense dashboard filter UIs. Study it for patterns, but implement with shadcn-vue components for full Tailwind control.

Source: [reui.io/patterns/filters](https://reui.io/patterns/filters)
