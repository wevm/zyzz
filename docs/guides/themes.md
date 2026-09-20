# Variables & Scopes

Define shared values with `Vars`, bind property mappings with `Config.create`, and select sets on enclosing elements. See [Getting Started](../introduction/getting-started.md) for compilation setup.

## Recipes

### Define Variables

```ts
import { Config, Vars } from 'zyzz'

const palette = Vars.define({ gray: { 50: '#fafafa', 900: '#171717' } })
const base = Vars.define({
  color: {
    foreground: { light: palette.gray[900], dark: palette.gray[50] },
    accent: '#2563eb',
  },
  spacing: { page: '1rem' },
})

export const { style, vars } = Config.create({ vars: base })
const card = style({ color: 'foreground', padding: 'page' })
const rail = style({ width: vars.spacing.page })
```

References keep their source identity. Changing a primitive through its own scope updates values that reference it. Explicit references retain their scalar domain regardless of category mappings.

### Property Mappings

Default mappings connect familiar categories to CSS properties. Dedicated categories such as `padding` take precedence over shared `spacing` for the same name. Custom mappings replace one category at a time; `[]` disables shorthand lookup for that category.

```ts
const { style, vars } = Config.create({
  vars: { surface: { panel: '#fff' }, spacing: { page: '1rem' } },
  mappings: { surface: ['backgroundColor'], spacing: ['padding', 'gap'] },
  shorthands: { px: ['paddingLeft', 'paddingRight'] },
})
const panel = style({ backgroundColor: 'panel', width: vars.spacing.page })
```

`mappings` assigns variable categories to properties. `shorthands` expands local property aliases; every expanded property validates the supplied value. Custom category mappings cannot introduce ambiguous names for one property.

### Selecting Sets

```ts
const alternate = Vars.extend(base, { color: { accent: '#9333ea' } })
export const { appearance, script, style, vars } = Config.create({
  vars: { base, alternate },
  defaultVars: 'base',
})
```

```tsx
<section {...vars({ set: 'alternate' })}>
  <div {...styles.card()}>Alternate set</div>
  <section {...vars({ set: 'base' })}>Nested base set</section>
</section>
```

Every set has matching paths and compatible domains. `Vars.extend` overrides existing leaves and retains omitted values. `vars()` selects the configured default. The nearest enclosing scope supplies the values, and switching scopes emits no new CSS.

### Color Schemes

A color can be shared or use a complete `{ light, dark }` pair. Select a scheme independently of the set:

```tsx
<section {...vars({ set: 'alternate', colorScheme: 'dark' })}>Content</section>
```

`colorScheme` accepts `light`, `dark`, or `light dark`. Omit it to inherit the surrounding scheme. `light dark` follows the browser's preferred scheme.

### Media Overrides

```ts
const responsive = Vars.define({
  spacing: {
    page: {
      default: '1rem',
      '@media (min-width: 48rem)': '2rem',
      '@media (min-width: 72rem)': '3rem',
    },
  },
})
```

Overrides require a default and compatible value domains. Conditions apply in authored order, with the last matching declaration winning. Each branch can also contain a color pair. Media-conditioned values require a web target.

### Save Preferences

For a named config, `appearance.get()` reads `{ set, colorScheme }`. Apply and persist a change with `appearance.set`:

```ts
appearance.set({ set: 'alternate', colorScheme: 'dark' })
```

Generate `script()` on the server or at build time and execute its returned JavaScript before rendering to restore the saved preference. Both helpers use the same configurable `storageKey`. Single-set configurations support color-scheme preferences without a set name.

### Named Queries

```ts
const { style } = Config.create({
  vars: {
    breakpoints: { tablet: '48rem' },
    containers: { card: '20rem' },
    containerNames: ['preview'],
  },
})
const card = style({
  '@media >=tablet': { padding: '2rem' },
  '@container preview card': { display: 'grid' },
})
```

Query aliases are compile-time metadata. They do not produce CSS custom properties or change when a runtime scope changes. Typography sets remain available under `typography`, including the bundled sets in `zyzz/default`.

### Compile In Memory

```ts
import { Style, Vars } from 'zyzz'
import { Css } from 'zyzz/web'

const base = Vars.define({ color: { foreground: '#171717' } })
const styles = Style.define({ card: { color: base.color.foreground } })
const output = Css.compile({ styles, vars: { base } })
```

Load `output.css`, apply `output.classes.card`, and use `output.vars.base` for its scope class. For library packaging and source linking, see [Graph.compile](../api/compiler/Graph/compile.md).
