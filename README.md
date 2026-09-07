# typestyle

Type-safe styling with familiar CSS properties, inferred design tokens, and styles compiled ahead of time.

## Philosophy

- Agnostic core, independent of frameworks, build tools, and environments.
- Shared authoring across web and native, with explicit platform capabilities.
- Small, modular APIs and optional integrations.
- Standard CSS properties, selectors, queries, and cascade behavior.
- Compact compiled styles with readable class names.

## Usage

```tsx
import { Theme } from 'typestyle'

const { css } = Theme.define({
  color: { text: { light: '#111', dark: '#eee' } },
  backgroundColor: { surface: { light: '#fff', dark: '#111' } },
  spacing: { md: '1rem' },
})

const button = css({
  color: 'text',
  backgroundColor: 'surface',
  padding: 'md',
  ':hover': { opacity: 0.8 },
})

<button className={button}>Continue</button>
```

Use `import { css } from 'typestyle'` for built-in tokens. Styles can be inline, named, or exported.

## APIs

- `css(styles)` — typed styles, selectors, and queries; callbacks supply value helpers.
- `Theme.define(tokens)` / `Theme.extend(theme, overrides)` — inferred themes and scoped overrides.
- `Variant.define(theme, definition)` / `Variant.Props` — typed variants, defaults, and compound rules.
- `Var.define(schema)` / `Var.set(vars, values)` — typed runtime values for compiled styles.
- `cx(...classes)` — explicit style composition.
- `Style.define(styles)` — named, portable style definitions.
- `Css` — stylesheet compilation, global rules, keyframes, and fonts.
- `Native` — native compilation and style selection.
- `typestyle src --out-dir dist` — standalone compilation; `--watch` and `--minify` control delivery.
