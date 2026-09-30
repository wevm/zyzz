# Vars

Define shared values independently of their CSS property mappings. Variable sets support nested categories, light/dark colors, ordered media overrides, and references to other sets.

```ts
import { defineConfig, defineVars, extendVars } from 'zyzz'

const palette = defineVars({
  gray: { 50: '#fafafa', 900: '#171717' },
})

const base = defineVars({
  color: {
    foreground: { light: palette.gray[900], dark: palette.gray[50] },
    accent: '#2563eb',
  },
  spacing: {
    page: { default: '1rem', '@media (min-width: 48rem)': '2rem' },
  },
})

const alternate = extendVars(base, {
  color: { accent: '#9333ea' },
})

export const { style, vars } = defineConfig({
  vars: { base, alternate },
  defaultVars: 'base',
})
```

`defineVars` and `extendVars` are root aliases for `Vars.define` and `Vars.extend`. Both namespace methods remain supported with the same types and behavior.

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

`Vars.define(values, derive, options?)` adds derived values through a callback receiving typed references to the base values. Categories merge recursively. Duplicate leaves and leaf/category conflicts throw `Vars.InvalidError`. The callback cannot reference derived values. Both forms accept `options.id`.

```ts
const base = defineVars(
  { color: { palette: { ink: '#171717', paper: '#fafafa' } } },
  (vars) => ({
    color: {
      foreground: {
        light: vars.color.palette.ink,
        dark: vars.color.palette.paper,
      },
    },
  }),
)

const alternate = extendVars(base, {
  color: { palette: { ink: '#2563eb' } },
})
```

The result includes `base.color.palette` and `base.color.foreground`. References remain live within the set, so the alternate palette also changes its derived foreground. Overrides that introduce reference cycles throw `Vars.InvalidError`.

Source compilation accepts an inline synchronous callback with one named parameter and a literal object result, either as an expression or a single `return` statement. The compiler reads the callback without executing application code.

`Vars.extend(base, overrides)` returns a compatible set. Overrides replace whole leaves, including conditional values and color pairs. Omitted paths retain their values. New paths and incompatible domains throw `Vars.InvalidError`.

References retain their source identity. Extending a set changes values within its scope without changing the paths used by consumers. Separate definitions retain independent identities.

## Composed values

`Vars.compose(group, parts)` combines CSS text, finite numbers, and variable references without resolving references to fixed values. `group` is `color` or `spacing` and determines the resulting reference domain. The returned `Vars.Composition` is immutable and can supply a leaf, conditional branch, color-scheme branch, or compatible override.

```ts
import { Vars } from 'zyzz'

const base = Vars.define(
  { color: { ink: '#171717' }, number: { opacity: 25, space: 16 } },
  (vars) => ({
    color: {
      faded: Vars.compose('color', [
        'color-mix(in srgb, ',
        vars.color.ink,
        ' calc(',
        vars.number.opacity,
        ' * 1%), transparent)',
      ]),
    },
    spacing: {
      page: Vars.compose('spacing', ['calc(', vars.number.space, ' * 1px)']),
    },
  }),
)
```

References remain live across set scopes, including references to another set. Extensions rebind references within the extended set. CSS is emitted ahead of time, and browsers evaluate the expressions. React Native rejects composed values with an unsupported-feature diagnostic.

Parts must form a nonempty CSS value. Declaration separators, braces, importance markers, nonfinite numbers, and arbitrary objects throw `Vars.InvalidError`. The domain describes the complete expression, so a color composition may contain a numeric opacity reference. The browser determines whether the resulting CSS expression is valid.

Source compilation accepts `Vars.compose` with a literal domain and dense literal parts array inside variable definitions and overrides. Expressions require compiler contract version 29 or later. Other variable sets retain version 28.

## Mappings

A single set needs only `Config.create({ vars: base })`. Inline variable records are also supported. Default category mappings follow Tailwind’s non-font namespaces and fallback order. Font scalar categories keep their matching properties.

```ts
export const { style, vars } = defineConfig({
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

Source linking and packed-library contracts retain variable definitions, references, mappings, and selection helpers. Variable-set libraries require compiler contract version 28 or later.

`config.vars` is both the reference tree and the scope selector. `Vars` replaces the removed `Theme` module; configuration uses `vars` and `defaultVars`. Appearance controls read and save `{ set, colorScheme }`.

## Typography and border widths

The `borderWidth` category maps to physical and logical border-width properties, excluding `borderImageWidth`. Named typography sets support ordered `@media` and `@container` blocks:

```ts
const base = defineVars({
  borderWidth: { regular: '2px' },
  breakpoint: { tablet: '48rem' },
  typography: {
    heading: { fontSize: '24px', '@media >=tablet': { fontSize: '40px' } },
  },
})
const { style } = defineConfig({ vars: base })
const heading = style({ typography: 'heading', borderWidth: 'regular' })
```

Explicit typography fields override matching base and conditional preset fields in the same style block. `Vars.extend` can override existing responsive fields. Native compilation rejects responsive typography queries.

## Category fallbacks

The first category containing the requested name wins. Custom `mappings` replace the targets of that category; `mappings: false` requires full paths. Explicit references bypass category lookup and retain CSS value validation.

| Properties                                                                           | Categories, in order                               |
| ------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `color`                                                                              | `textColor`, `color`                               |
| `backgroundColor`                                                                    | `backgroundColor`, `color`                         |
| Border colors                                                                        | `borderColor`, `color`                             |
| `accentColor`, `caretColor`, `outlineColor`, `textDecorationColor`, `fill`, `stroke` | Matching property category, `color`                |
| Other color properties                                                               | `color`                                            |
| Margin / padding / inset / gap                                                       | Matching category, `spacing`                       |
| `width`, `minWidth`, `maxWidth`                                                      | Matching property category, `spacing`, `container` |
| `height`                                                                             | `height`, `spacing`                                |
| `minHeight`, `maxHeight`                                                             | Matching property category, `height`, `spacing`    |
| Inline sizes                                                                         | `spacing`, `container`                             |
| Block sizes                                                                          | `spacing`                                          |
| `flexBasis`                                                                          | `flexBasis`, `spacing`, `container`                |
| `columns`                                                                            | `columns`, `container`                             |
| Scroll margin / padding, `borderSpacing`, `translate`, `textIndent`                  | Matching category, `spacing`                       |
| Border radii                                                                         | `radius`                                           |
| `boxShadow`, `textShadow`                                                            | `shadow`, `textShadow`, respectively               |
| `aspectRatio`, `perspective`                                                         | `aspect`, `perspective`, respectively              |
| `transitionTimingFunction`, `animation`                                              | `ease`, `animate`, respectively                    |
| Other mapped properties                                                              | Matching property category                         |

Other matching categories include `backgroundImage`, `backgroundPosition`, `backgroundSize`, `borderWidth`, `content`, `cursor`, grid row/column and template properties, `lineClamp`, `listStyleImage`, `listStyleType`, `objectPosition`, `opacity`, `order`, `outlineOffset`, `outlineWidth`, `perspectiveOrigin`, `rotate`, `scale`, `strokeWidth`, `textDecorationThickness`, `textUnderlineOffset`, `transformOrigin`, `transitionDelay`, `transitionDuration`, `transitionProperty`, and `zIndex`.

`fontFamily`, `fontSize`, `fontWeight`, `letterSpacing`, and `lineHeight` each use only their matching category. `typography` still expands named sets. Spacing does not supply line heights, decoration thickness, or underline offsets.

`blur`, `dropShadow`, and `insetShadow` values require explicit references in ordinary CSS properties. No effect-specific style fields are added. Query aliases use `breakpoint` and `container`; container values also supply sizing declarations.
