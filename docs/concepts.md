# Concepts & Principles

How styles, tokens, and compilation behave. Use [Guides](guides/README.md) for complete tasks and [API](api/README.md) for contracts.

## Principles

- **Agnostic:** pure contracts do not depend on a framework, host, or bundler.
- **Compiled:** rules exist before rendering; runtime work selects or binds values.
- **Minimal:** core imports include no theme, reset, registry, or provider.
- **Modular:** explicit inputs and narrow adapters separate responsibilities.
- **Standard:** CSS properties, custom properties, selectors, and cascade retain their meaning.
- **Typed:** values carry constraints through definitions, imports, and applications.
- **Universal:** shared authoring targets explicit web/native capabilities.

```ts
import { style } from 'zyzz'

const styles = {
  card: style({ padding: '1rem' }),
}
```

The [compilation model](#compilation-and-platforms) explains which boundaries are shared and which belong to platform adapters.

## Typed Styles

Definitions describe static rules. Calling a definition returns styling props; it never creates CSS rules. Authoring calls require compilation.

```tsx
import { style } from 'zyzz'

const styles = {
  card: style({ padding: '1rem' }),
}
const example = <div style={styles.card}>Card</div>
```

## Configuration

> [!NOTE]
> Preview API; not yet implemented.

`Config.create` binds authoring functions to explicit tokens and layers. Create `const config = Config.create(...)` from `zyzz.config.ts` and export `const style = config.style` for named consumer imports. Integrations follow this binding to the originating config; no default export is required. The compiler reads static data without executing application code.

```ts
import { Config } from 'zyzz'

const config = Config.create({
  layers: ['base', 'components'],
  theme: { spacing: { md: '1rem' } },
})

export const style = config.style
export const theme = config.theme
```

- **Layers:** infer keys such as `@layer components`; unknown names fail.
- **No theme:** authoring stays token-free.
- **One theme:** accepts inline tokens or a reusable `Theme.define` value.
- **Several themes:** use `themes` with a required `defaultTheme`.

Named alternatives share the default's token paths and domains. Config returns compatible handles without mutating independent definitions. Imports outside that config receive no ambient tokens or layer types.

```ts
import { style } from './zyzz.config.js'

const styles = {
  card: style({ padding: 'md' }),
}
```

Named bound exports preserve the config's inferred contract. Access CSS references through `zyzz.theme.vars` or `zyzz.themes.<name>.vars`. These are CSS variable references, not runtime setters; compatible scopes change their inherited values.

## Themes & Tokens

A theme defines named values and their property domains. It contains token data, without a name or scheme metadata wrapper.

```ts
import { Theme } from 'zyzz'

const theme = Theme.define({
  color: { brand: { dark: '#8cf', light: '#06c' } },
  spacing: { md: '1rem' },
})
```

- **Contracts:** explicit references preserve their defining identity and domain.
- **Extensions:** change existing paths while retaining compatibility.
- **Names:** property-specific groups infer only where their domain is valid.
- **Schemes:** color leaves accept one shared string or a complete light/dark pair.

Use [Compile Themes](guides/themes.md#compile-themes) for the current pipeline.

> [!NOTE]
> Config normalization, bundled defaults, typography/query groups, and web expression references are previews. Config returns compatible handles without mutating independently defined themes.

### Theme Scopes

> [!NOTE]
> Preview API; not yet implemented.

Callable themes return generated scope classes and optional inline color-scheme props. Apply them to `<html>` for the whole document or an ancestor for a subtree. Theme classes select inherited CSS variables. Components keep the same classes across compatible themes; nested scopes change a subtree. Defaults provide fallbacks outside a scope.

Use the instance handles from a [named-theme config](guides/themes.md#selecting-a-theme):

```tsx
import { themes } from './zyzz.config.js'

const example = (
  <section {...themes.mint({ colorScheme: 'dark' })}>Content</section>
)
```

- **Color pairs:** `{ dark, light }` compiles to `light-dark()`.
- **Color scheme:** `light` or `dark` selects explicitly; `light dark` follows browser preference.
- **Extensions:** `Theme.extend` changes existing values while preserving the contract.
- **Theme selection:** changes tokens independently of color scheme.

## Composition and Overrides

> [!NOTE]
> Preview API; not yet implemented.

Use `cx` to compose generated styles with override rules. Multiple JSX spreads replace fields. External classes follow the CSS cascade; their class-string order does not establish precedence.

```tsx
import { style, cx } from 'zyzz'

const styles = {
  compact: style({ padding: '0.5rem' }),

  roomy: style({ padding: '1rem' }),
}
const example = <button style={cx(styles.compact, styles.roomy)}>Save</button>
```

Later generated conflicts win within matching conditions, subject to importance. Owned variable bindings and recipe attributes stay attached. See [Override Styles](guides/styling.md#override-styles).

## Variants

> [!NOTE]
> Preview API; not yet implemented.

A recipe styles one element; each call returns a value for its `style` prop. Axes, defaults, and compounds select precompiled alternatives. Multipart components use separate definitions with shared inputs; there is no slots option.

```tsx
import { variants } from 'zyzz'

const styles = {
  button: variants({
    variants: { size: { md: { padding: '1rem' }, sm: { padding: '0.5rem' } } },
  }),
}
const example = <button style={styles.button({ size: 'sm' })}>Save</button>
```

## Conditions

> [!NOTE]
> Preview API; not yet implemented.

Pseudo styles, media queries, container queries, and feature queries keep their CSS meaning. Nested conditions combine with AND while preserving property/token inference.

```ts
import { style } from 'zyzz'

const styles = {
  button: style({
    ':hover': { '@media (hover: hover)': { opacity: 0.8 } },
  }),
}
```

Query aliases resolve from theme metadata to literal conditions. Theme scope changes do not change query thresholds. Container queries select the nearest eligible container; raw queries still require compiler validation.

See [Responsive Styles](guides/conditions.md#responsive-styles) and [Style States](guides/conditions.md#style-states).

## Relationships

> [!NOTE]
> Preview API; not yet implemented.

Typed markers describe element identity and finite data states. Applying a marker emits attributes; another definition can reference that identity.

```ts
import { Css } from 'zyzz/web'

const card = Css.marker({ state: ['closed', 'open'] })
const condition = Css.ancestor(card, { data: { state: 'open' } })
```

- **Depth:** ancestor/descendant helpers match at any depth; immediate parent/child helpers remain undecided.
- **Matching:** repeated markers use any qualifying ancestor, not nearest-boundary behavior.
- **Predicates:** combined predicates must match the same marked element.
- **Specificity:** helpers add zero condition specificity; raw selectors retain their own.
- **Types:** constrain marker values, not DOM structure or accessibility semantics.

See [Style Relationships](guides/conditions.md#style-relationships) for application and [Css](api/web/Css/README.md) for sibling directions.

## Dynamic Values

> [!NOTE]
> Preview API; not yet implemented.

Token names infer by property. A text-color token cannot become a spacing token.

| Value                     | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| `theme.tokens.spacing.md` | Portable typed token reference                      |
| `theme.vars.spacing.md`   | CSS variable reference for web expressions          |
| Query threshold           | Compiled literal; unaffected by theme scope changes |

Callbacks bind per-instance values to precompiled custom properties. Their rule structure stays static.

```tsx
import { style } from 'zyzz'

const styles = {
  bar: style((values: { width: `${number}%` }) => ({
    width: values.width,
  })),
}
const example = <div style={styles.bar({ width: '50%' })} aria-hidden="true" />
```

Calls accept declared inputs plus `className`/`style` overrides. Keep other component props on the element.

## Layers and Stylesheets

> [!NOTE]
> Preview API; not yet implemented.

```ts
import { global } from 'zyzz/web'

// Layer order comes from config or Css.layers.
global({ '@layer base': { body: { margin: 0 } } })
```

- **Collection:** scans configured sources, including unimported modules; excludes tests, generated output, and dependencies by default.
- **Delivery:** globals are eager, including declarations beside lazy components. The initial stylesheet includes the shared layer prelude.
- **Helpers:** import `fontFace`, `global`, and `keyframes` directly. Keyframes have separate reachability rules.
- **Ordering:** constraints merge deterministically; cycles produce located errors. Preserve authored order, unlayered rules, and important reversal.
- **Watching:** edits and deletions replace or remove contributions; relative assets retain source ownership.

See [stylesheet usage](guides/stylesheets.md#global-styles) for fonts and motion. Standalone globals do not widen a config's inferred layer names.

## Compilation and Platforms

| Boundary        | Responsibility                             |
| --------------- | ------------------------------------------ |
| Core            | Pure data, types, validation, and identity |
| Source adapters | Parse and rewrite modules                  |
| Target emitters | Produce CSS or native tables               |
| Hosts           | Files, discovery, watching, and delivery   |

CLI and build integrations share compiler semantics. Libraries distribute matching code, CSS, declarations, and required metadata. Standard downstream tooling handles minification.

> [!NOTE]
> CLI/plugins and native output are previews. Native will select precompiled styles and theme/scheme tables, with explicit errors for unsupported web selectors and stylesheet operations.
