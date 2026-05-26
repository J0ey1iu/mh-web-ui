# Theme Developer Guide

This guide explains how themes work in the MH Agent frontend and how to add new ones.

## How It Works

Themes use CSS custom properties (variables) defined on `[data-theme]` attribute selectors. Switching themes sets `data-theme` on `<html>` via `localStorage`-persisted state in `MainLayout.vue`.

All component styles reference these variables — no hardcoded colors anywhere.

## Available Themes

| Theme | `data-theme` | Vibe |
|---|---|---|
| Midnight | `"dark"` | True dark (default), high-contrast blue accent |
| Light | `"light"` | Clean off-white |
| Sepia | `"sepia"` | Warm paper-like light |
| Slate | `"forest"` | Cool gray dark, purple accent |
| Eclipse | `"eclipse"` | Warm dark, peach accent |
| Lemonade | `"lemonade"` | Crisp light, lemon-yellow accent |

## CSS Variable Reference

Every theme must define all of the following variables in a `[data-theme="<name>"]` block in `src/style.css`:

### Page & Surface Colors

| Variable | Purpose |
|---|---|
| `--page-bg` | Main page / chat background |
| `--surface-bg` | Elevated surface (top-bar, drawer, input-bar) |
| `--surface-alt` | Alternative surface (assistant bubbles, tool cards) |
| `--surface-raised` | Hover/raised surface (reasoning block, dropdown hover) |

### Border Colors

| Variable | Purpose |
|---|---|
| `--border` | Default borders |
| `--border-hover` | Hover state borders (scrollbar, + button) |

### Text Colors

| Variable | Purpose |
|---|---|
| `--text-primary` | Primary body text |
| `--text-secondary` | Secondary/meta text |
| `--text-tertiary` | Tertiary text (reasoning body, labels) |
| `--text-muted` | Muted text (placeholders, hints) |
| `--text-strong` | Strong/heading text (titles, bold) |

### Accent & Status Colors

| Variable | Purpose |
|---|---|
| `--accent` | Primary accent (focus ring, links, running indicator) |
| `--accent-hover` | Accent hover state (button hover) |
| `--accent-dim` | Accent dim/background (user bubbles, active session, button bg) |
| `--success` | Success color (assistant avatar, tool success) |
| `--error` | Error color (tool error status) |

### Danger / Destructive Colors

| Variable | Purpose |
|---|---|
| `--danger` | Danger background (cancel button, offline banner) |
| `--danger-hover` | Danger hover state |
| `--danger-text` | Danger text color |
| `--delete-hover-bg` | Delete button hover background |

### Transition

A single `:root` variable controls all transition durations, making theme-switching feel consistent:

| Variable | Default | Purpose |
|---|---|---|
| `--transition-duration` | `0.15s` | Used by every `transition:` across all components |

### Code Block Colors

| Variable | Purpose |
|---|---|
| `--code-bg` | Inline code background |
| `--pre-bg` | Block code (pre) background |

**Important:** Use `var(--transition-duration)` in all `transition:` declarations instead of hardcoded lengths, so all components animate at the same speed.

## Adding a New Theme

1. Open `src/style.css`
2. Add a new block:

```css
[data-theme="your-theme"] {
  --page-bg: ...;
  --surface-bg: ...;
  /* ... all 20 variables ... */
  --pre-bg: ...;
}
```

3. Open `src/components/MainLayout.vue`
4. Add a dropdown item in the template:

```vue
<button class="dropdown-item" :class="{ active: theme === 'your-theme' }" @click="setTheme('your-theme')">
  Your Theme
  <span v-if="theme === 'your-theme'" class="check">✓</span>
</button>
```

4. Open `src/stores/i18n.ts` and add zh/en translations for the theme name under keys `theme_your-theme`.

That's it. The `data-theme` attribute is synced automatically to `<html>` and persisted to `localStorage`.

## Tips

- Aim for sufficient contrast ratio between text and surface colors (at least 4.5:1 for body text)
- Test your theme against all major UI regions: top-bar, chat bubbles, input bar, code blocks, tool cards, session drawer, reasoning block, toast messages
- `--accent-dim` should be a muted/tinted version of `--accent` for backgrounds
- For dark themes, `--page-bg` should be the darkest shade; for light themes, the lightest
