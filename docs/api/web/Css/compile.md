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

- `composition`: `ordered` by default; `independent` deduplicates complete applications whose composition is already resolved.
- `styles`: ordered `Style.Definition` data.
- `themes`: optional named definitions for inherited scopes.

## Returns

Frozen `classes`, `css`, and `themes`. Authored style and theme keys remain inferred. Class values may contain several identifiers.

## Errors

`Css.CompileError` aggregates invalid declarations, names, themes, or identity collisions without returning partial CSS.

Independent class lists must not be composed with each other. Distribute class maps and matching CSS together. Types live under `Css.compile.Options`, `ReturnType`, and `ErrorType`.

See [Css](README.md) for related methods and types.
