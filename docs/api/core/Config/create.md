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

| Option        | Purpose                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `vars`        | One inline record or `Vars.define` result, or a catalog of compatible sets. Omit for token-free authoring.                          |
| `defaultVars` | Required catalog key when `vars` contains named sets.                                                                               |
| `mappings`    | Category-to-property mappings. Each supplied category replaces its default mapping; `[]` disables shorthand lookup.                 |
| `shorthands`  | Local property aliases such as `{ px: ['paddingLeft', 'paddingRight'] }`. Each expanded property validates its value independently. |
| `layers`      | Ordered CSS layer names used by bound styles and recipes.                                                                           |
| `output`      | `'react'` by default; `'html'` returns `class` and serialized inline styles.                                                        |
| `cssOutput`   | `'atomic'` by default; `'grouped'` emits scoped declaration blocks.                                                                 |
| `storageKey`  | Preference storage key shared by `appearance` and `script()`. Defaults to `'zyzz'`.                                                 |
| `id`          | Stable identity required when using authoring without source rewriting.                                                             |

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
