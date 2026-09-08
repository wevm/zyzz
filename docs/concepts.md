# Concepts

The examples below preview accepted APIs. See [availability](README.md#availability) for implemented boundaries and [Usage](usage.md) for complete examples.

## Definitions and Applications

Definitions describe static rules. Calling a definition returns styling props; it never creates CSS rules. Authoring calls require compilation.

```tsx
import { css } from 'zyzz'

const card = css({ padding: '1rem' })
const example = <div {...card()}>Card</div>
```

## Configuration

`Config.create` binds authoring functions to explicit tokens and layers. Keep configuration in `zyzz.config.ts` and import its functions normally. The compiler reads static data without executing application code.

```ts
import { Config } from 'zyzz'

export const { css, theme, variants } = Config.create({
  layers: ['base', 'components'],
  theme: { spacing: { md: '1rem' } },
})
```

- **Layers:** infer keys such as `@layer components`; unknown names fail.
- **No theme:** authoring stays token-free.
- **One theme:** accepts inline tokens or a reusable `Theme.define` value.
- **Several themes:** use `themes` with a required `defaultTheme`.

Named alternatives share the default's token paths and domains. Config returns compatible handles without mutating independent definitions. Imports outside that config receive no ambient tokens or layer types.

## Themes and Color Schemes

Theme classes select inherited CSS variables. Components keep the same classes across compatible themes; nested scopes change a subtree. Defaults provide fallbacks outside a scope.

Use the returned handles from a [named-theme config](usage.md#configure-authoring--preview):

```tsx
import { themes } from './zyzz.config.js'

const example = (
  <section className={themes.mint.className} style={{ colorScheme: 'dark' }}>
    Content
  </section>
)
```

- **Color pairs:** `{ dark, light }` compiles to `light-dark()`.
- **Color scheme:** `light` or `dark` selects explicitly; `light dark` follows browser preference.
- **Extensions:** `Theme.extend` changes existing values while preserving the contract.
- **Theme selection:** changes tokens independently of color scheme.

## Tokens and Runtime Values

Token names infer by property. A text-color token cannot become a spacing token.

| Value                     | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| `theme.tokens.spacing.md` | Portable typed token reference                      |
| `theme.vars.spacing.md`   | CSS variable reference for web expressions          |
| Query threshold           | Compiled literal; unaffected by theme scope changes |

Callbacks bind per-instance values to precompiled custom properties. Their rule structure stays static.

```tsx
import { css } from 'zyzz'

const bar = css((values: { width: `${number}%` }) => ({
  width: values.width,
}))
const example = <div {...bar({ width: '50%' })} aria-hidden="true" />
```

Calls accept declared inputs plus `className`/`style` overrides. Keep other component props on the element.

## Conditions and Relationships

Nested conditions combine with AND and preserve property/token inference. CSS selectors and queries retain their standard semantics.

```ts
import { css } from 'zyzz'

const button = css({
  ':hover': {
    '@media (hover: hover)': { opacity: 0.8 },
  },
})
```

- **Ancestors and descendants:** match at any depth; see the [marker example](usage.md#match-ancestors--preview).
- **Containers:** queries select the nearest eligible container.
- **Markers:** declare typed identity and data states; retain real ARIA/control attributes separately.
- **Parents and children:** imply immediate relationships; reserved for possible future helpers.
- **Specificity:** relational helpers add zero condition specificity; raw selectors retain their own.

Repeated markers match any qualifying ancestor, not a nearest boundary. TypeScript checks marker states, not the DOM structure. The compiler validates raw selectors and queries.

## Variants and Composition

A recipe styles one element and returns one props object. Axes, defaults, and compounds select precompiled alternatives. Multipart components use separate definitions with shared inputs; there is no slots option.

```tsx
import { variants } from 'zyzz'

const button = variants({
  variants: { size: { md: { padding: '1rem' }, sm: { padding: '0.5rem' } } },
})
const example = <button {...button({ size: 'sm' })}>Save</button>
```

Use `cx` to compose generated styles with override rules. Multiple JSX spreads replace fields. External classes follow the CSS cascade; their class-string order does not establish precedence.

## Layers and Globals

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

See [stylesheet usage](usage.md#define-stylesheets--preview) for fonts and motion. Standalone globals do not widen a config's inferred layer names.

## Compilation and Platforms

| Boundary        | Responsibility                             |
| --------------- | ------------------------------------------ |
| Core            | Pure data, types, validation, and identity |
| Source adapters | Parse and rewrite modules                  |
| Target emitters | Produce CSS or native tables               |
| Hosts           | Files, discovery, watching, and delivery   |

CLI and build integrations share compiler semantics. Libraries distribute matching code, CSS, declarations, and required metadata. Standard downstream tooling handles minification.

Native selects precompiled styles and theme/scheme tables. Unsupported web selectors and stylesheet operations produce explicit errors.
