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

### options.composition

- Type: `'independent' | 'ordered'`
- Default: `'ordered'`

Independent mode deduplicates complete applications whose composition is already resolved. Independent class lists must not be composed with each other.

```ts
Css.compile({ composition: 'independent', styles })
```

### options.styles

- Type: `Style.Definition`
- Required: Yes.

Validated ordered style data.

```ts
Css.compile({ styles })
```

### options.themes

- Type: `Readonly<Record<string, Theme.Definition>>` (keys inferred)
- Default: `undefined`

Named theme definitions for inherited scopes.

```ts
Css.compile({ styles, themes: { base: theme } })
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

### themes

- Type: `Readonly<Record<themeName, string>>`

Frozen scope class map retaining theme keys. Empty when no themes are supplied.

Anonymous themes use compact identifiers scoped to this compilation. Source-owned theme contracts retain stable identifiers for separately compiled components. Consume the returned scope map and distribute it with the matching CSS.

```ts
output.themes
```

## Errors

`Css.CompileError` aggregates invalid declarations, names, themes, or identity collisions without returning partial CSS.

Independent class lists must not be composed with each other. Distribute class maps and matching CSS together. Types live under `Css.compile.Options`, `ReturnType`, and `ErrorType`.

See [Css](README.md) for related methods and types.
