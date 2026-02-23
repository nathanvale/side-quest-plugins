# Vue 3 + Tailwind Dashboard Patterns

Vue-specific patterns that differ from the React-heavy examples in other reference files. Covers component libraries, dark mode, CSS variable binding, and Vue dashboard templates.

---

## shadcn-vue (The Vue Port of shadcn/ui)

9.4k stars, 70+ components, built on Reka UI (successor to Radix Vue). Community-led but "blessed by the original project." Same copy-into-project philosophy as the React version.

- Latest: v2.4.3 (Dec 2025)
- 201 contributors, 609 forks
- VeeValidate + TanStack Form for form handling
- Tailwind v4 support in progress

Install: `npx shadcn-vue@latest init`

**Gooey** extends shadcn-vue further -- ships components as an installable dependency (not copied files), supports Tailwind 3 and 4, adds theming layer.

Source: [github.com/unovue/shadcn-vue](https://github.com/unovue/shadcn-vue)

---

## Dark Mode: `useDark` from VueUse

The canonical Vue dark mode utility. Cleaner than React's `next-themes` because it wraps persistence, system preference detection, and DOM manipulation in one composable.

```typescript
import { useDark, useToggle } from '@vueuse/core'

const isDark = useDark()         // Reactive, auto-persists to localStorage
const toggleDark = useToggle(isDark)
```

What it does:
- Wraps `usePreferredDark` (system preference) + `useStorage` (localStorage persistence)
- Applies `dark` class to `<html>` element (matches Tailwind's `darkMode: 'class'`)
- Reacts to system preference changes automatically

**For Tailwind v4 with CSS variables:** `useDark` still works for toggling the `dark` class, but the actual color switching happens at the CSS variable level via `@theme`. The class toggle is the mechanism; the variables are the implementation.

Source: [vueuse.org/core/usedark](https://vueuse.org/core/usedark/)

---

## `v-bind()` in Scoped Styles (Vue-Only Feature)

Vue SFCs can bind reactive JavaScript values directly to CSS custom properties. No React equivalent -- React requires inline styles or CSS-in-JS.

```vue
<script setup>
import { ref } from 'vue'
const accentColor = ref('var(--color-brand-primary)')
</script>

<template>
  <div class="accent-border">Content</div>
</template>

<style scoped>
.accent-border {
  border-left: 4px solid v-bind(accentColor);
}
</style>
```

**Caveat:** `v-bind()` CSS vars are component-scoped (injected via inline style on the component root), not on `:root`. They don't propagate to child components. For global theme tokens, use the `@theme` system in `globals.css` instead. Use `v-bind()` only for dynamic per-component values like event type colors.

**Good use case:** Dynamic event card border colors based on event type.
**Bad use case:** Global theme switching (use CSS variables in `globals.css` instead).

---

## Vuetify v4 + CSS Layers (New in 2026)

Vuetify v4 ships with CSS cascade layers by default. Because Tailwind v4 also uses `@layer`, the two systems now coexist without specificity conflicts. This is the big Vue-specific story right now -- no React equivalent exists.

What this means:
- Vuetify components can be styled with Tailwind utilities without `!important` hacks
- Dark mode, breakpoints, and theme colors can be shared between Vuetify and Tailwind
- Integration guide from the Vuetify team is imminent

**Relevance to our dashboard:** If we ever need Vuetify's data table or date picker components alongside our Tailwind token system, the CSS layer architecture prevents conflicts.

Source: @zeroskillz (31 likes, Feb 2026)

---

## Dark Mode Debate: Class vs CSS Variables

Active community debate (Feb 2026, @Mike_Andreuzza poll with 8 replies):

**Old approach (Tailwind v3):**
```html
<div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
```
Requires `dark:` prefix on every color utility. Verbose, error-prone.

**New approach (Tailwind v4 + CSS variables):**
```html
<div class="bg-[var(--color-bg-card)] text-[var(--color-text-primary)]">
```
Dark mode is handled at the CSS variable level. No `dark:` prefixes. Theme switching is a single variable swap.

**Community consensus:** The CSS variable approach is winning. @julianmwagnertw advocates a semantic class rule: ban raw Tailwind color classes (`bg-white`, `dark:bg-gray-800`), force semantic tokens (`surface-primary`). Dark mode becomes automatic.

**Our position:** We already use the CSS variable approach via two-tier semantic tokens. This is confirmed as the correct direction by the community shift.

---

## Vue Dashboard Templates

| Template | Stack | Stars | Notes |
|----------|-------|-------|-------|
| **admin-one-vue-tailwind** | Vue 3 + Tailwind 4 + Pinia + Vite | 2.5k | Free starter, ~38kb CSS bundle, dark mode, Nuxt 3 + Laravel integrations |
| **TailAdmin Vue** | Vue 3 + TypeScript + Tailwind + Vite | -- | 500+ components, 7 variants (analytics, CRM, SaaS), feature-parity with React version |
| **Yummy Admin** | Vue + NaiveUI + Tailwind | -- | eCommerce-focused, open-source |
| **CoreUI for Vue** | Vue 3 + CoreUI components | -- | Open-source + premium, pre-built charts/forms |

**Component library landscape:**
- **PrimeVue** -- 280k weekly npm downloads, 11k stars. Ships "Volt" -- a Tailwind-only component variant.
- **Radix Vue / Reka UI** -- 130k weekly downloads. Headless, unstyled. Powers shadcn-vue.
- **Vueless** -- 65+ components, Storybook-first, Tailwind v4, fully styleless with override architecture. Design system framework, not just a component kit.

Source: [admin-one-vue-tailwind](https://github.com/justboil/admin-one-vue-tailwind), [tailadmin.com/vue](https://tailadmin.com/vue)

---

## Vue Transition vs Motion Library

Vue has built-in `<Transition>` and `<TransitionGroup>` components. When to use which:

| Need | Use |
|------|-----|
| Simple enter/leave animations on single elements | `<Transition>` (built-in) |
| List item enter/leave/reorder | `<TransitionGroup>` (built-in) |
| Spring physics, scroll-triggered, layout animations | Motion for Vue (~4KB) |
| Complex orchestrated sequences | Motion for Vue |
| High-frequency updates (>5 events/sec) | Disable all animation (Operator I1 fix) |

Motion for Vue is feature-complete parity with the React version (springs, scroll, layout, variants). Animations run on the compositor thread via WAAPI -- transforms/opacity animate off the main thread.

```vue
<script setup>
import { Motion } from 'motion/vue'
</script>

<template>
  <Motion
    :initial="{ opacity: 0, y: 20 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.3 }"
  >
    <EventCard :event="event" />
  </Motion>
</template>
```

Source: [motion.dev/blog/introducing-motion-for-vue](https://motion.dev/blog/introducing-motion-for-vue)
