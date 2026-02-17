# Tailwind v4 Design Token Architecture

Complete setup guide for the two-tier CSS variable token system in Tailwind CSS v4 with dark mode. Covers @theme, @theme inline, @custom-variant dark, hsl vs oklch, migration gotchas, and file structure.

---

## The Two-Tier Architecture

```
Tier 1: Primitives        -- WHAT the color is (raw palette values)
Tier 2: Semantic tokens    -- WHY/WHERE the color is used (purpose-driven aliases)
Tailwind bridge: @theme    -- Maps semantic tokens to utility classes
```

### Complete globals.css Setup

```css
@import "tailwindcss";

/* --- Dark mode variant (replaces v3 darkMode: 'class') --- */
@custom-variant dark (&:is(.dark *));

/* --- Tier 1: Primitives (raw palette) --- */
/* These never appear in component code. Only referenced by Tier 2. */
:root {
  --primitive-zinc-50:   oklch(0.985 0 0);
  --primitive-zinc-100:  oklch(0.967 0.001 286.375);
  --primitive-zinc-800:  oklch(0.274 0.006 286.033);
  --primitive-zinc-900:  oklch(0.21 0.006 285.885);
  --primitive-zinc-950:  oklch(0.145 0.005 286.067);

  --primitive-emerald-400: oklch(0.765 0.177 163.223);
  --primitive-amber-400:   oklch(0.828 0.156 84.429);
  --primitive-red-400:     oklch(0.704 0.191 22.216);
  --primitive-sky-400:     oklch(0.746 0.16 232.661);
  --primitive-violet-400:  oklch(0.672 0.186 292.052);
}

/* --- Tier 2: Semantic tokens (light theme) --- */
:root {
  --background:          var(--primitive-zinc-50);
  --foreground:          var(--primitive-zinc-900);
  --card:                oklch(1 0 0);
  --card-foreground:     var(--primitive-zinc-900);
  --primary:             var(--primitive-zinc-900);
  --primary-foreground:  var(--primitive-zinc-50);
  --muted:               var(--primitive-zinc-100);
  --muted-foreground:    oklch(0.553 0.013 285.938);
  --border:              oklch(0.905 0.013 285.938);
  --ring:                var(--primitive-zinc-900);

  /* Status colors */
  --status-success:      var(--primitive-emerald-400);
  --status-warning:      var(--primitive-amber-400);
  --status-error:        var(--primitive-red-400);
  --status-info:         var(--primitive-sky-400);
}

/* --- Tier 2: Semantic tokens (dark theme override) --- */
.dark {
  --background:          var(--primitive-zinc-950);
  --foreground:          var(--primitive-zinc-50);
  --card:                var(--primitive-zinc-900);
  --card-foreground:     var(--primitive-zinc-50);
  --primary:             var(--primitive-zinc-50);
  --primary-foreground:  var(--primitive-zinc-900);
  --muted:               var(--primitive-zinc-800);
  --muted-foreground:    oklch(0.553 0.013 285.938);
  --border:              var(--primitive-zinc-800);
  --ring:                oklch(0.871 0.006 286.286);
}

/* --- Tailwind bridge: @theme inline --- */
@theme inline {
  --color-background:         var(--background);
  --color-foreground:         var(--foreground);
  --color-card:               var(--card);
  --color-card-foreground:    var(--card-foreground);
  --color-primary:            var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted:              var(--muted);
  --color-muted-foreground:   var(--muted-foreground);
  --color-border:             var(--border);
  --color-ring:               var(--ring);
  --color-status-success:     var(--status-success);
  --color-status-warning:     var(--status-warning);
  --color-status-error:       var(--status-error);
  --color-status-info:        var(--status-info);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
}
```

**Result:** `bg-background`, `text-foreground`, `bg-card`, `text-status-error` etc. all work as native Tailwind utilities. Dark mode is a single `.dark` class toggle on `<html>`.

---

## @theme vs @theme inline

| Feature | `@theme` | `@theme inline` |
|---------|---------|-----------------|
| Generates CSS custom properties at `:root` | Yes | No |
| Generates utility classes | Yes | Yes |
| Utility classes reference | `var(--color-*)` | The raw value directly |
| Best for | Simple values, no variable chaining | Semantic tokens that reference other variables |

**Use `@theme inline` when your theme variables reference other CSS variables** (which they always do in the two-tier pattern). Without `inline`, CSS variable chaining can resolve to unexpected values because Tailwind generates `var(--color-background)` which points to `var(--background)` -- two levels of indirection that can break in edge cases.

Source: [GitHub Discussion #18560](https://github.com/tailwindlabs/tailwindcss/discussions/18560)

---

## @custom-variant dark

Replaces the v3 `darkMode: 'class'` config option.

```css
/* Class-based (shadcn-vue default) */
@custom-variant dark (&:is(.dark *));

/* Data-attribute based (more flexible, supports multiple themes) */
@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));

/* System preference only (default if you don't add @custom-variant) */
/* Uses prefers-color-scheme media query automatically */
```

**Specificity note:** shadcn-vue uses `:is()` not `:where()`. The difference: `:is()` takes the specificity of its most specific argument, `:where()` has zero specificity. For dark mode, `:is()` is safer because it ensures `dark:` variants override base styles.

---

## hsl() vs oklch() -- The Active Debate

**shadcn/ui switched to OKLCH on March 12, 2025.** All new projects get OKLCH values.

| Aspect | HSL | OKLCH |
|--------|-----|-------|
| Perceptual uniformity | No -- "10% lighter" doesn't look uniform | Yes -- perceptually linear |
| `color-mix()` behavior | Unpredictable | Correct |
| Wider gamut (P3 displays) | No | Yes |
| Design tool support | Full (Figma, Sketch, Adobe) | Limited -- requires conversion tools |
| Browser support | Universal | Safari 16.4+, Chrome 111+, Firefox 113+ |

**Practical decision:**
- New project with modern browser targets -> **OKLCH** (better color math, future-proof)
- Legacy browser requirements (older iOS) -> **HSL** (one developer reported invisible buttons on older iOS with OKLCH)
- Migrating from v3 -> Start with **HSL** (mechanical migration), convert to OKLCH later

**Gotcha:** Tailwind v4's `@property` and `color-mix()` features require the same browser baseline as OKLCH. If you're on v4, you already need modern browsers.

Source: [andy-cinquin.com/blog/migration-oklch-tailwind-css-4-0](https://andy-cinquin.com/blog/migration-oklch-tailwind-css-4-0)

---

## Migration from v3 to v4

### Automated first step

```bash
npx @tailwindcss/upgrade
```

This codemod handles the mechanical migration: moves config values into CSS `@theme`, updates import syntax.

### Breaking changes to know

| v3 Pattern | v4 Replacement |
|-----------|----------------|
| `tailwind.config.js` / `tailwind.config.ts` | `@theme` in CSS -- delete the config file |
| `darkMode: 'class'` | `@custom-variant dark (&:is(.dark *));` |
| `@layer utilities { .foo { ... } }` | `@utility foo { ... }` (custom utilities must use `@utility` to support variants) |
| `@apply` | Still works but discouraged -- use explicit CSS with `var(--color-*)` |
| `tailwindcss-animate` plugin | Replace with `tw-animate-css` |
| PostCSS config with `tailwindcss` | `@import "tailwindcss"` in CSS directly |

### Common gotchas

1. **`@theme inline` vs `@theme` confusion** -- the most common source of broken dark mode in migrations
2. **AI assistants generating v3 code** -- big enough problem that @PaulRBerg built a dedicated agent skill to prevent it
3. **ECharts dark theme defeats tree-shaking** -- `echarts/theme/dark` imports the entire package (see `data-visualization.md`)
4. **CSS nesting** -- v4 generates CSS nesting syntax, requires Safari 16.4+

---

## File Structure for Large Projects

For projects with multiple themes or complex token systems:

```
css/
├── main.css              -- @import "tailwindcss" + @custom-variant + @theme inline
├── primitives/
│   ├── colors.css        -- Raw palette (Tier 1)
│   ├── typography.css    -- Font scales, weights
│   └── spacing.css       -- Spacing scale overrides
└── themes/
    ├── light.css         -- :root semantic tokens
    ├── dark.css          -- .dark semantic tokens
    └── brand-accent.css  -- Brand-specific overrides (e.g., LCARS orange)
```

For simpler projects, a single `globals.css` with all tiers is fine. The split only matters when you have multiple themes or a team working on different parts of the token system.

---

## shadcn-vue Integration

shadcn-vue's theming is the reference implementation for this pattern. Their manual install guide documents:

1. CSS variables in `:root` and `.dark` (background/foreground pairs)
2. `@theme inline` mapping to Tailwind utilities
3. `@custom-variant dark (&:is(.dark *));`
4. OKLCH values (as of March 2025)

**To integrate with a custom token system:** Remap shadcn's variable names to your semantic tokens in `globals.css`. See `shadcn-vue.md` for the mapping table.

Source: [shadcn-vue manual install](https://www.shadcn-vue.com/docs/installation/manual.html), [ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4)

---

## Common Mistakes

1. **Using raw Tailwind color classes** -- `bg-zinc-950 dark:bg-zinc-50` instead of `bg-background`. The semantic token approach means zero `dark:` prefixes on colors
2. **Putting `:root`/`.dark` inside `@layer base`** -- shadcn's migration docs explicitly say move them OUT of `@layer base`
3. **Using `@theme` instead of `@theme inline`** for variable-referencing tokens -- causes double-indirection bugs
4. **Generating `tailwind.config.ts`** -- doesn't exist in v4. If your AI generates one, it's using v3 patterns
5. **Using `@apply` for everything** -- v4 discourages it. Use `var(--color-*)` in explicit CSS properties instead
