# Vars

Define shared values independently of their CSS property mappings. Variable sets support nested categories, light/dark colors, ordered media overrides, and references to other sets.

```ts
import { Config, Vars } from 'zyzz'

const palette = Vars.define({
  gray: { 50: '#fafafa', 900: '#171717' },
})

const base = Vars.define({
  color: {
    foreground: { light: palette.gray[900], dark: palette.gray[50] },
    accent: '#2563eb',
  },
  spacing: {
    page: { default: '1rem', '@media (min-width: 48rem)': '2rem' },
  },
})

const alternate = Vars.extend(base, {
  color: { accent: '#9333ea' },
})

export const { style, vars } = Config.create({
  vars: { base, alternate },
  defaultVars: 'base',
})
```

```tsx
import { style, vars } from './zyzz.config.js'

namespace styles {
  export const card = style({ color: 'foreground', padding: 'page' })
  export const rail = style({ width: vars.spacing.page })
}

const example = (
  <section {...vars({ set: 'alternate', colorScheme: 'dark' })}>
    <div {...styles.card()}>Content</div>
  </section>
)
```

## Definitions

`Vars.define(values, options?)` returns an immutable reference tree with the same paths. Leaves accept strings, finite numbers, references, complete `{ light, dark }` color pairs, or an object with `default` and `@media ...` keys. `options.id` supplies a stable identity without source rewriting.

`Vars.extend(base, overrides)` returns a compatible set. Overrides replace whole leaves, including conditional values and color pairs. Omitted paths retain their values. New paths and incompatible domains throw `Vars.InvalidError`.

References retain their source identity. Extending a set changes values within its scope without changing the paths used by consumers. Separate definitions retain independent identities.

## Mappings

A single set needs only `Config.create({ vars: base })`. Inline variable records are also supported. Default category mappings follow the existing token groups: `color` supplies color properties, `spacing` supplies spacing and sizing properties, and typography scalar categories supply their matching properties.

```ts
export const { style, vars } = Config.create({
  vars: base,
  mappings: {
    color: ['color', 'backgroundColor'],
    spacing: ['padding', 'gap'],
  },
})
```

Each supplied array replaces that category's mapping. Other defaults remain intact. `[]` disables shorthand lookup for that category. Custom categories require a mapping for shorthand lookup. All scalar paths remain available through `vars`, with value-domain checking independent of mappings.

Multiple categories cannot supply the same token name to the same property. CSS literals take precedence over shorthand token names. Use an explicit reference when a token name collides with a CSS literal.

## Conditions

Media overrides require a default and compatible value domains. Matching conditions apply in authored order, with the last matching declaration winning. A condition can contain a light/dark pair. A reference to another pair selects the active color scheme, including within a light/dark branch.

Web compilation emits custom properties and media rules ahead of time. Switching sets emits no new CSS. Media-conditioned variable values are rejected by the native target.

## Selection

Named sets require `defaultVars` and identical paths and domains. `vars({ set, colorScheme })` returns styling props for an enclosing element. Omitting `set` selects the configured default. `vars()` applies the default scope. Single-set configs accept only an optional color scheme.

Nested scopes select their own values. The nearest enclosing scope supplies variable values. `colorScheme` accepts `light`, `dark`, or `light dark`; omitting it preserves the inherited scheme.

Source linking and packed-library contracts retain variable definitions, references, mappings, and selection helpers. Variable-set libraries require compiler contract version 26 or later.

`config.vars` is both the reference tree and the scope selector. `Vars` replaces the removed `Theme` module; configuration uses `vars` and `defaultVars`. Appearance controls read and save `{ set, colorScheme }`.

## Typography and border widths

The `borderWidth` category maps to physical and logical border-width properties, excluding `borderImageWidth`. Named typography sets support ordered `@media` and `@container` blocks:

```ts
const base = Vars.define({
  borderWidth: { regular: '2px' },
  breakpoints: { tablet: '48rem' },
  typography: {
    heading: { fontSize: '24px', '@media >=tablet': { fontSize: '40px' } },
  },
})
const { style } = Config.create({ vars: base })
const heading = style({ typography: 'heading', borderWidth: 'regular' })
```

Explicit typography fields override matching base and conditional preset fields in the same style block. `Vars.extend` can override existing responsive fields. Native compilation rejects responsive typography queries.
