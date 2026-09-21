# Config.create

Bind styles and recipes to shared variables, named sets, property mappings, and CSS layers.

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

| Option         | Purpose                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `vars`         | One inline record or `Vars.define` result, or a catalog of compatible sets. Omit for token-free authoring.                          |
| `defaultVars`  | Required catalog key when `vars` contains named sets.                                                                               |
| `mappings`     | Category-to-property mappings. Each category replaces its default; `[]` disables its shortcuts. `false` enables full paths.         |
| `shorthands`   | Local property aliases such as `{ px: ['paddingLeft', 'paddingRight'] }`. Each expanded property validates its value independently. |
| `defaultLayer` | Fallback layer for bound styles and recipes. Explicit `@layer` blocks override it. Omit to keep declarations unlayered.             |
| `layers`       | Ordered CSS layer names used by bound styles and recipes.                                                                           |
| `output`       | `'react'` by default; `'html'` returns `class` and serialized inline styles.                                                        |
| `cssOutput`    | `'atomic'` by default; `'grouped'` emits scoped declaration blocks.                                                                 |
| `storageKey`   | Preference storage key shared by `appearance` and `script()`. Defaults to `'zyzz'`.                                                 |
| `id`           | Stable identity required when using authoring without source rewriting.                                                             |

All named sets must have matching paths and compatible value domains. Unknown options and incompatible sets throw `Config.InvalidError`. Invalid variable values throw `Vars.InvalidError`.

## Helpers

`style` and `variants` use the configured mappings. Explicit references through `vars` remain available independently of those mappings.

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

## Full variable paths

Set `mappings: false` to reference variables by their full path in any compatible CSS property. Short names are disabled; bracketed CSS values and explicit references still work. Values must match the property's CSS syntax.

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

## Token values

Properties with configured tokens require a token name or a compatible variable reference. Wrap arbitrary CSS values in brackets to bypass token resolution. These rules apply to styles, variants, nested declarations, and each fallback entry.

```ts
const { style } = Config.create({
  vars: {
    color: { foreground: '#171717' },
    spacing: { md: '8px' },
  },
})

const button = style({
  padding: 'md',
  marginTop: '[7px]',
  color: '[#123456]',
  width: '[calc(100% - 2rem)]',
})
```

Brackets are removed from emitted CSS. Their contents retain ordinary CSS type checking, and spaces remain spaces. Use `'[red] !important'` for importance and `['md', '[7px]']` for fallbacks. Interpolated values can use a template string such as `` `[${values.width}]` ``.

Properties without configured values accept either spelling: `'7px'` or `'[7px]'`. An empty variable set leaves all properties unrestricted. No `strict` option is required or supported.

Configured names take precedence over CSS literals. A color token named `red` resolves to that variable, while `'[red]'` always means the CSS color. Property mappings and `mappings: false` retain their normal name and domain rules. Native-only target branches keep their separate platform value contracts.

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
