# API Reference

See [Usage](usage.md) for examples and [Concepts](concepts.md) for authoring patterns. Notes identify APIs that are not yet implemented.

## Entry Points

> [!NOTE]
> `Config`, `cx`, `variants`, `Vars`, `zyzz/react-native`, `zyzz/themes/default`, and web authoring helpers are previews. The `Css` compiler is implemented.

| Import                | Purpose                                                                             |
| --------------------- | ----------------------------------------------------------------------------------- |
| `zyzz`                | Token-free `css`, `Style`, and `Theme`                                              |
| `zyzz`                | `Config`, `cx`, `variants`, and `Vars`                                              |
| `zyzz/compiler`       | `Source` and `Transform`                                                            |
| `zyzz/node`           | Filesystem `Host`                                                                   |
| `zyzz/react-native`   | `StyleSheet`                                                                        |
| `zyzz/themes/default` | Bound authoring, theme, and raw tokens                                              |
| `zyzz/web`            | `Css` compiler namespace                                                            |
| `zyzz/web`            | Direct `fontFace`, `global`, and `keyframes`; relational and layer helpers on `Css` |

## Config.create

> [!NOTE]
> Preview API; not yet implemented.

```ts
import { Config } from 'zyzz'

const { css, theme, variants } = Config.create({
  layers: ['base', 'components'],
  theme: { spacing: { md: '1rem' } },
})
```

- **Contracts:** alternatives share the default's paths, domains, and variable identity; standalone definitions stay unchanged.
- **Filename:** `zyzz.config.ts` is encouraged.
- **Inputs:** optional ordered `layers`; either `theme` or named `themes`, accepting tokens or definitions.
- **Layers:** infer exact `@layer <name>` keys; undeclared names fail.
- **Named themes:** require an inferred `defaultTheme`; return normalized `themes`.
- **Outputs:** bound `css` and `variants`, plus `theme` in single-theme mode.
- **Tokens:** absent unless a theme is supplied.

## css

`css(style)` returns a callable producing web styling props. Compile literal root authoring through `Transform.compile`. Static direct no-argument applications can fold to constants. Other applications use the small props runtime. Untransformed authoring throws `css.MissingTransformError`.

> [!NOTE]
> Config-bound extraction, broad values, conditions, and callbacks are previews. `css((values: Values) => style)` binds inputs to fixed CSS variables and accepts styling overrides. Other props stay on the component.

## cx

> [!NOTE]
> Preview API; not yet implemented.

`cx(...appliedStyles)` composes generated props and conditional false/null/undefined entries. Later conflicting generated declarations win within matching conditions, subject to CSS importance. Preserve owned variables and recipe attributes; reject conflicting recipe attribute ownership. Bare class strings and unapplied definitions are invalid inputs.

## fontFace

> [!NOTE]
> Preview API; not yet implemented.

```ts
import { fontFace } from 'zyzz/web'

fontFace({
  fontDisplay: 'swap',
  fontFamily: 'App Sans',
  src: 'url("./app.woff2") format("woff2")',
})
```

Emits `@font-face` from validated descriptors. Use the declared family in styles.

- **Assets:** retain source-relative URL ownership.
- **Bundling:** preserves stylesheet effects.
- **Native:** font loading uses platform APIs.
- **Return value:** generated/private family references remain undecided.

## global

> [!NOTE]
> Preview API; not yet implemented.

```ts
import { global } from 'zyzz/web'

global({
  '@layer base': { body: { margin: 0 } },
})
```

Emits global selectors and supported nested at-rules from static module-level data.

- **Discovery:** includes configured, unimported project modules.
- **Effects:** eager and independent of JavaScript export usage.
- **Layers:** unwrapped rules remain unlayered; config inference is not ambient.
- **Watching:** updates or removes contributions with their sources.

## keyframes

> [!NOTE]
> Preview API; not yet implemented.

```ts
import { keyframes } from 'zyzz/web'

const enter = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
})
```

Returns a typed `animationName` reference; see [motion usage](usage.md#define-stylesheets).

- **Bodies:** declarations only; no importance or nested selectors/queries.
- **Emission:** reachable definitions preserve imported identity.
- **Order:** authored order wins at overlapping stops.
- **Stops:** `from`, `to`, 0–100% positions, or comma-separated stops.
- **Tokens:** use explicit theme references.

## Style.define

`Style.define(styles, options?)` validates named ordered definitions and returns frozen data. Options support source locations and an explicit theme for token-name resolution. It does not emit CSS or return component props. See [literal grammar](literal-styles.md).

## Theme

`Theme.define(tokens)` returns an immutable contract with portable `tokens` references and bound `css` types. `Theme.extend(theme, overrides)` changes existing paths only and preserves contract identity. Current groups are background/text/border/shared colors, spacing, and border radius. Color leaves accept strings or complete light/dark pairs.

Current in-memory scope selection uses `Css.compile(...).themes`. See [In-Memory Themes](themes.md).

> [!NOTE]
> Source-linked `theme.css`, `theme.className`, `theme.vars`, broader groups, and bound `variants` are previews. Bound `theme.css` currently supports inference and in-memory resolution.

## variants

> [!NOTE]
> Preview API; not yet implemented.

`variants(definition)`, `theme.variants(definition)`, and config-bound `variants` accept `base`, `variants`, `defaultVariants`, and `compoundVariants`. Each recipe styles one element and returns one callable. Applied output is one props object, with no slots map.

See the [recipe example](usage.md#define-variants).

- **Compounds:** match choice names; arrays match any listed choice.
- **Defaults:** apply to omitted selections; null suppresses both choice and default. False remains an explicit choice.
- **Dynamic choices:** callbacks bind scoped payloads to fixed rules.
- **Types:** infer with `NonNullable<Parameters<typeof recipe>[0]>`.

## Vars

> [!NOTE]
> Preview API; not yet implemented.

`Vars.define(schema)` creates shared references with `number`, `length`, `percentage`, or `color` domains. `Vars.set(definition, values)` produces assignments for existing compatible keys. Local runtime values usually use the `css` callback. Private compiler-owned variable names are not application override keys.

## Web Compiler and Relationships

> [!NOTE]
> Layer and relationship helpers below are previews. `Css.compile` is implemented.

| API                                              | Contract                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `Css.compile({ styles, themes?, composition? })` | Pure CSS, class map, and scope map emission; ordered composition by default           |
| `Css.layers(names)`                              | Standalone order contribution; config-bound keys derive directly from config `layers` |
| `Css.marker(schema?)`                            | Typed marker presence and finite data-state attributes                                |
| `Css.ancestor(marker, condition?)`               | Any matching ancestor, at any depth                                                   |
| `Css.descendant(marker, condition?)`             | Matching descendant, at any depth                                                     |
| `Css.siblingBefore(marker, condition?)`          | Marked sibling preceding the styled element                                           |
| `Css.siblingAfter(marker, condition?)`           | Marked sibling following the styled element                                           |
| `Css.anySibling(marker, condition?)`             | Either sibling direction                                                              |

See the [typed ancestor example](usage.md#match-ancestors).

- **Combinations:** predicates match the same marked element; unsupported nested `:has()` fails.
- **Conditions:** supported simple pseudos or typed data/pseudo/has predicates.
- **Depth:** `parent`/`child` are reserved for possible immediate-relationship helpers, not current aliases.

`fontFace`, `global`, and `keyframes` are direct named exports, not `Css` members. Web helpers reject unsupported native semantics.

## Source and Host

`Source.extract({ moduleId, source })` parses and validates the supported root literal authoring subset without evaluating source. It returns ordered style data and rewrite spans. `Transform.compile` consumes the same inputs and returns executable module source, CSS, class maps, and separate source maps.

`Host.create({ outDir, packageId, root })` from `zyzz/node` returns `build`, `close`, and `watch`. It owns filesystem scanning, cache state, output ownership, and recovery. Hosts write sidecars; they do not replace a TypeScript/JSX bundler or automatically load CSS.

## Native

> [!NOTE]
> Preview API; not yet implemented.

`StyleSheet.compile({ styles, themes, ... })` emits static native tables with explicit unit/property capabilities. `StyleSheet.select(styles, { colorScheme, theme })` selects a precompiled table. Device preference handling belongs to the application adapter. Web globals, DOM relationships, and CSS layer semantics are not emulated.

## Diagnostics

Public errors include `Style.InvalidError`, `Theme.InvalidError`, `Css.CompileError`, `Source.ExtractError`, and `css.MissingTransformError`. Preserve located public diagnostics and fail unsupported input before publishing partial artifacts. Future helpers require corresponding typed/source/target diagnostics; accepted example syntax is not proof of implementation.
