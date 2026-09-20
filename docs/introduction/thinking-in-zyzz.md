# Thinking in Zyzz

Zyzz keeps styles in the component's source file, gives them names, and checks their inputs through TypeScript. These conventions guide how components, shared styles, and configuration fit together. For setup, start with [Getting Started](getting-started.md).

## Co-location over separate modules

Component-specific styles belong beside the component in a module-level `namespace styles`. Markup, behavior, and styling can change together without requiring a separate stylesheet or style module for every component.

```tsx
import { style } from 'zyzz'

namespace styles {
  export const card = style({ display: 'grid', gap: '1rem', padding: '1.5rem' })

  export const title = style({ fontSize: '1.25rem', margin: 0 })
}

export function Card() {
  return (
    <article {...styles.card()}>
      <h2 {...styles.title()}>Account</h2>
    </article>
  )
}
```

Extract a [shared style module](../guides/styling.md#share-styles) when several components need the same definitions. Co-location is the starting point, and reuse supplies the reason to move a definition.

## Composition over inline declarations

Named definitions keep styling decisions out of markup. Names such as `card`, `title`, and `focusRing` describe the element or treatment, while declarations remain in the local namespace. This separates definition from application within the same file.

```tsx
import { cx, style } from 'zyzz'

namespace styles {
  export const button = style({ borderRadius: '0.5rem', padding: '1rem' })

  export const focusRing = style({
    ':focus-visible': {
      outline: '2px solid currentColor',
      outlineOffset: '2px',
    },
  })
}

export function SaveButton() {
  return <button {...cx(styles.button(), styles.focusRing())}>Save</button>
}
```

The focus ring can compose with buttons, links, and other controls. Component choices such as compact or regular size belong in [variants](#variant-styling-over-class-concatenation).

`cx` composes generated styles and preserves their variable bindings and variant attributes. Later conflicting declarations win within matching conditions, subject to importance. Multiple JSX spreads replace props, so they cannot substitute for composition. See [Override Styles](../guides/styling.md#override-styles) for supported inputs and overrides.

## Feedback while authoring over CLI-only checks

Types put feedback at the definition and application sites. Property names, supported values, configured token paths, variant choices, and declared runtime inputs carry constraints into editor completions and diagnostics. A renamed variant or removed token can produce an error at its callers before a Zyzz CLI run.

```ts
import { style } from 'zyzz'

namespace styles {
  export const stack = style((values: { gap: `${number}px` }) => ({
    display: 'flex',
    gap: values.gap,
  }))
}

styles.stack({ gap: '8px' })
styles.stack({ gap: 8 }) // Type error: gap requires a pixel length string.
```

Type checking is static analysis, even when the editor updates diagnostics as code changes. It complements compilation. Selector grammar, extraction constraints, and target capabilities still need compiler checks, and types cannot prove DOM structure or rendered appearance. See [Editor and Agents](editor-agents.md) and [Compatibility](compatibility.md).

## Standard names over shorthand conventions

Styles use CSS property names in camelCase, such as `padding`, `backgroundColor`, and `borderRadius`. Values retain CSS units and syntax. Conditions use names such as `:hover` and `@media (min-width: 48rem)`. There is no separate utility-class vocabulary to learn for these declarations.

```ts
import { style } from 'zyzz'

namespace styles {
  export const panel = style({
    backgroundColor: 'white',
    padding: '1rem',
    '@media (min-width: 48rem)': { padding: '2rem' },
  })
}
```

CSS knowledge still applies to selectors, inheritance, specificity, and the cascade. Configured token names add a project's design vocabulary. See [Conditions](../guides/conditions.md) for queries and relationships.

## Explicit configuration over ambient settings

Importing `style` from `zyzz` gives token-free authoring. Importing it from a project's `zyzz.config.ts` gives the tokens and layers declared by that config. The import identifies the contract, and another config does not silently change it.

In `zyzz.config.ts`, export the configured helpers:

```ts
import { Config } from 'zyzz'

export const { style, theme } = Config.create({
  theme: {
    color: { surface: '#fff' },
    spacing: { comfortable: '1.5rem' },
  },
})
```

In `Card.tsx`, import the configured `style` to use those tokens:

```tsx
import { style } from './zyzz.config.js'

namespace styles {
  export const card = style({
    backgroundColor: 'surface',
    padding: 'comfortable',
  })
}

export function Card() {
  return <article {...styles.card()}>Account</article>
}
```

Shared colors, spacing, and typography belong in a [theme](../guides/themes.md). Named exports from `Config.create` carry those constraints to consumers. The bundled theme is an opt-in import from `zyzz/default`.

## Variant styling over class concatenation

Component choices such as size or tone belong in `variants`. Callers select typed values such as `{ size: 'compact' }` rather than conditionally concatenating class names. The definition owns the available choices, defaults, and compound rules, so each call site does not need to reconstruct that logic.

```tsx
import { variants } from 'zyzz'

namespace styles {
  export const button = variants({
    base: { display: 'inline-flex' },
    defaultVariants: { size: 'regular' },
    variants: {
      size: {
        compact: { padding: '0.5rem' },
        regular: { padding: '1rem' },
      },
    },
  })
}

export function SaveButton() {
  return <button {...styles.button({ size: 'compact' })}>Save</button>
}
```

Browser states such as hover and focus belong in CSS conditions. Application state stays in component props and ordinary data or ARIA attributes. See [Variants](../guides/variants.md) and [Style States](../guides/conditions.md#style-states).

## Static rules with runtime values

Rules compile ahead of time. Runtime calls select existing styles or bind values to precompiled CSS variables. A progress bar can accept a different width for every instance without generating a new CSS rule for each width.

```tsx
import { style } from 'zyzz'

namespace styles {
  export const bar = style((values: { width: `${number}%` }) => ({
    width: values.width,
  }))
}

export function Bar({ width }: { width: `${number}%` }) {
  return <div {...styles.bar({ width })} />
}
```

Finite visual choices fit variants. Per-instance values fit typed callbacks or variables. Rule structure must remain statically analyzable. See [Dynamic Values](../guides/styling.md#dynamic-values) for supported callback forms and [Build & Delivery](../guides/compilation.md) for compilation.
