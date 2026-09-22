# Config.create

Bind styles and recipes to shared variables, named sets, property groups, and CSS layers.

```ts
import { Config, Vars } from 'zyzz'

const base = Vars.define({
  color: { foreground: { light: '#171717', dark: '#fafafa' } },
  spacing: { page: '1rem' },
})
const alternate = Vars.extend(base, { spacing: { page: '2rem' } })

export const { appearance, script, style, vars, variants } = Config.create({
  vars: { base, alternate },
  defaultVars: 'base',
})
```

## Options

| Option           | Purpose                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `vars`           | One inline record or `Vars.define` result, or a catalog of compatible sets. Omit for token-free authoring.                                  |
| `defaultVars`    | Required catalog key when `vars` contains named sets.                                                                                       |
| `mappings`       | Category-to-property overrides. Each category replaces its default targets; `[]` disables its token names. `false` enables full paths.      |
| `propertyGroups` | Ordered token groups per CSS property. Each list replaces that property's defaults; `[]` disables token lookup. `false` enables full paths. |
| `shorthands`     | Local property aliases such as `{ px: ['paddingLeft', 'paddingRight'] }`. Each expanded property validates its value independently.         |
| `defaultLayer`   | Fallback layer for bound styles and recipes. Explicit `@layer` blocks override it. Omit to keep declarations unlayered.                     |
| `layers`         | Ordered CSS layer names used by bound styles and recipes.                                                                                   |
| `output`         | `'react'` by default; `'html'` returns `class` and serialized inline styles.                                                                |
| `cssOutput`      | `'atomic'` by default; `'grouped'` emits scoped declaration blocks.                                                                         |
| `storageKey`     | Preference storage key shared by `appearance` and `script()`. Defaults to `'zyzz'`.                                                         |
| `id`             | Stable identity required when using authoring without source rewriting.                                                                     |

All named sets must have matching paths and compatible value domains. Unknown options and incompatible sets throw `Config.InvalidError`. Invalid variable values throw `Vars.InvalidError`.

## Helpers

`style` and `variants` use the configured property groups. Explicit references through `vars` remain available independently of those property groups.

```ts
const card = style({ color: 'foreground', width: vars.spacing.page })
const scope = vars({ set: 'alternate', colorScheme: 'dark' })
```

`vars` is callable and exposes the reference tree. Calling `vars()` applies the default set. Omitting `set` preserves the configured default; omitting `colorScheme` inherits the surrounding scheme. Set selection emits no runtime CSS.

### Appearance

`appearance.get()` reads the document root's `{ set, colorScheme }`. `appearance.set(...)` applies and persists changes. Single-set and token-free configurations expose only color-scheme preferences.

```ts
appearance.set({ set: 'alternate', colorScheme: 'dark' })
```

`script()` returns HTML-safe JavaScript that restores saved root preferences before rendering. Generate it on the server or at build time and execute it before the page paints. See [script](script.md).

See [Vars](../Vars/README.md) for derived references, conditional values, query aliases, and scope inheritance.

## Category mappings

`mappings` selects the CSS properties that accept token names from each category. Each supplied category replaces its default targets; omitted categories retain their built-in targets.

```ts
const { style } = Config.create({
  vars: {
    space: { compact: '8px' },
    width: { compact: '120px' },
    ink: { brand: '#123456' },
  },
  mappings: { space: ['padding', 'gap'], ink: ['color'] },
  propertyGroups: { width: ['width', 'space'] },
})
style({ padding: 'compact', gap: 'compact', color: 'brand', width: 'compact' })
```

Here `padding` and `gap` use `space.compact`; `width` uses `width.compact` first and falls back to `space`. Explicit `propertyGroups` entries override category mappings for that property, including `[]`. Without an explicit property order, conflicting names introduced by category mappings are rejected.

## Property groups

Use `propertyGroups` to override the token groups searched for each CSS property:

```ts
const { style } = Config.create({
  vars: {
    width: { compact: '120px' },
    spacing: { compact: '16px', roomy: '32px' },
    container: { wide: '640px' },
  },
  propertyGroups: {
    width: ['width', 'spacing', 'container'],
    height: [],
  },
})
style({ width: 'compact' }) // 120px
style({ width: 'roomy' }) // 32px
style({ width: 'wide' }) // 640px
```

Every listed group contributes token names. The first group containing a name wins. An explicit list replaces the property's defaults, including their order. Omitted properties use `mappings` and built-in defaults; `[]` disables token name lookup for that property. Explicit references and CSS literals remain available.

## Full variable paths

Set `mappings: false` to reference variables by their full path in any compatible CSS property. Short names are disabled; CSS values with `!custom` and explicit references still work. Values must match the property's CSS syntax.

```ts
const { style, vars } = Config.create({
  vars: {
    surface: { foreground: '#123456' },
    spacing: { page: '16px' },
  },
  mappings: false,
})

const card = style({
  color: 'surface.foreground',
  width: 'spacing.page',
  padding: vars.spacing.page,
})
```

`mappings: false` applies to properties without an explicit `propertyGroups` entry. An explicit list still uses short names. `propertyGroups: false` retains global full-path lookup and takes precedence over category mappings.

## Token values

Properties with configured tokens require a token name or a compatible variable reference. Append ` !custom` to arbitrary CSS values to bypass token resolution. These rules apply to styles, variants, nested declarations, and each fallback entry.

```ts
const { style } = Config.create({
  vars: {
    color: { foreground: '#171717' },
    spacing: { md: '8px' },
  },
})

const button = style({
  padding: 'md',
  marginTop: '7px !custom',
  color: '#123456 !custom',
  width: 'calc(100% - 2rem) !custom',
})
```

The `!custom` suffix is removed from emitted CSS. Values retain ordinary CSS type checking. Use `'red !custom !important'` for importance and `['md', '7px !custom']` for fallbacks. Interpolated values can use a template string such as `` `${values.width} !custom` ``.

Dynamic callbacks cannot select token names from their inputs. Use variants for token choices, or templates with `!custom` for dynamic CSS values.

Properties without configured values accept either spelling: `'7px'` or `'7px !custom'`. An empty variable set leaves all properties unrestricted. No `strict` option is required or supported.

Configured names take precedence over CSS literals. A color token named `red` resolves to that variable, while `'red !custom'` always means the CSS color. Property groups and `mappings: false` retain their normal name and domain rules. Native-only target branches keep their separate platform value contracts.

## Default layer

`defaultLayer` places ordinary declarations, selectors, media queries, and recipe choices in a named layer. `layers` declares precedence independently. Explicit named or anonymous `@layer` blocks retain their authored placement, including inside selectors or media queries. Invalid layer names throw `Config.InvalidError`.

```ts
export const { style, variants } = Config.create({
  defaultLayer: 'components',
  layers: ['components', 'overrides'],
})

namespace styles {
  export const button = variants({
    base: { color: 'red' },
    variants: { size: { large: { padding: '16px' } } },
  })

  export const label = style({
    color: 'red',
    '@layer overrides': { color: 'blue' },
  })
}
```

Normal unlayered caller styles outrank layered component styles. Styles sharing one default layer still follow the normal cascade. The default does not change variable scopes or global stylesheet contributions. Packed configs using this option require compiler contract version 27 or later.
