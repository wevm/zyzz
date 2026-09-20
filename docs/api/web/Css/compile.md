# Css.compile

Compile ordered style data into CSS, class lists, and theme scopes.

```ts
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

const styles = Style.define({ card: { padding: '1rem' } })
const output = Css.compile({ styles })
```

## Signature

`Css.compile(options)`

## Parameters

### options.cssOutput

- Type: `'atomic' | 'grouped'`
- Default: `'atomic'`

Atomic output assigns classes to individual properties, retaining ordered same-property fallbacks. Grouped output retains each style's declarations in one scoped block. Both preserve selectors and stylesheet contributions; consume the returned class map with its matching CSS.

```ts
Css.compile({ cssOutput: 'grouped', styles })
```

### options.composition

- Type: `'independent' | 'ordered'`
- Default: `'ordered'`

Independent mode deduplicates complete applications whose composition is already resolved. CSS property/value validity relies on static authoring; emission preserves values without a CSS validator. Selector and at-rule grammar checks belong to the source compiler; direct in-memory emission does not parse CSS grammar.

Independent class lists must not be composed with each other.

```ts
Css.compile({ composition: 'independent', styles })
```

### options.development

- Type: `boolean`
- Default: `false`

Emit compact, value-independent atomic names for CSS-only development updates. Normal output uses readable literal values. Grouped names are unchanged. Vite selects this option automatically during development.

```ts
Css.compile({ development: true, styles })
```

### options.schemes

- Type: `boolean`
- Default: `false`

Emit the `color-scheme` selection classes applied by `vars()`, `appearance`, and `script()`. Source compilation sets this for modules that reference those helpers, so bundlers lowering `light-dark()` initialize their helpers from the same stylesheet.

```ts
Css.compile({ schemes: true, styles, vars: { base: theme } })
```

### options.scope

- Type: `string`
- Default: `undefined`

Include stylesheet ownership in atomic identities. Source compilation supplies the module identity so separately delivered stylesheets retain independent cascade positions.

```ts
Css.compile({ scope: 'app/card.ts', styles })
```

### options.styles

- Type: `Style.Definition`
- Required: Yes.

Validated ordered style data.

```ts
Css.compile({ styles })
```

### options.vars

- Type: `Readonly<Record<string, Vars.Definition>>` (keys inferred)
- Default: `undefined`

Named theme definitions for inherited scopes.

```ts
Css.compile({ styles, vars: { base: theme } })
```

### options.contributions

- Type: `readonly Css.Contribution[]`
- Default: `undefined`

Ordered static stylesheet data. Use `kind: 'layers'` with `names`, `kind: 'rule'` with a `selector` and `Style.NamedStyle`, `kind: 'font-face'` with descriptor `declarations`, or `kind: 'keyframes'` with a `name` and ordered `{ stop, style }` frames. Registered variables use `kind: 'property'`: `name` is a `--`-prefixed custom-property name, `syntax` is its CSS syntax descriptor, `inherits` controls inheritance, and `initialValue` is a computationally independent string or number. Source adapters construct this data from the direct web authoring functions and `variable()`.

```ts
Css.compile({
  styles,
  contributions: [{ kind: 'layers', names: ['reset', 'base'] }],
})
```

## Returns

Returns frozen `Css.compile.ReturnType` data. Authored style and theme keys remain inferred.

### classes

- Type: `Readonly<Record<name, string>>`

Frozen class map retaining authored style keys. Values may contain several class identifiers.

```ts
output.classes.card
```

### css

- Type: `string`

Emitted stylesheet. Distribute together with the matching class map.

```ts
output.css
```

### contributionCss and scopedCss

- Type: `string | undefined` for each field.

Present when contributions emit nonempty CSS. `contributionCss` contains eager stylesheet rules and `scopedCss` contains ordinary theme scopes and style rules. Load `contributionCss` before `scopedCss` and before other stylesheets that establish cascade layers. Replace both artifacts together when rebuilding. `style` already combines both in that order; consumers using `style` should not also load the split fields.

```ts
const shared = output.contributionCss
const moduleCss = output.scopedCss ?? output.css
```

### vars

- Type: `Readonly<Record<themeName, string>>`

Frozen scope class map retaining theme keys. Empty when no themes are supplied.

Anonymous themes use compact identifiers scoped to this compilation. Source-owned theme contracts retain stable identifiers for separately compiled components. Consume the returned scope map and distribute it with the matching CSS.

```ts
output.vars
```

## Errors

`Css.CompileError` aggregates invalid names, theme graphs, or identity collisions without returning partial CSS.

CSS property/value validity relies on static authoring; emission preserves values without a CSS validator. Selector and at-rule grammar checks belong to the source compiler; direct in-memory emission does not parse CSS grammar.

Independent class lists must not be composed with each other. Distribute class maps and matching CSS together. Types live under `Css.compile.Options`, `ReturnType`, and `ErrorType`.

See [Css](README.md) for related methods and types.

With explicit `composition: 'independent'`, complete applications are never combined. The emitter may factor a shared block from independent grouped styles while retaining each conflicting declaration domain intact. The default composition keeps a style’s declarations together.
