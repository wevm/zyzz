# Transform.compile

Rewrite authoring calls and emit matching module and stylesheet artifacts.

```ts
import { Transform } from 'zyzz/compiler'

const output = Transform.compile({
  moduleId: 'app/card.ts',
  source: "import { css } from 'zyzz'; export const card = css({ padding: 0 })",
})
```

## Signature

`Transform.compile(options)`

## Parameters

- `moduleId`: stable package-relative identity.
- `source`: source text accepted by `Source.extract`. No filesystem reads occur.

## Returns

`classes`, `code`, `css`, `cssMap`, and `map`. TypeScript/JSX lowering belongs to the consuming build; retained callables use the runtime entrypoint.

## Errors

`Source.ExtractError` or `Css.CompileError`; errors precede publication.

Source maps trace generated artifacts back to original authoring. See [Publish Libraries](../../../guides/compilation.md).

See [Transform](README.md) for related methods and types.
