# Source.extract

Extract supported root literal definitions without evaluating source.

```ts
import { Source } from 'zyzz/compiler'

const output = Source.extract({
  moduleId: 'app/card.ts',
  source: "import { css } from 'zyzz'; export const card = css({ padding: 0 })",
})
```

## Signature

`Source.extract(options)`

## Parameters

- `moduleId`: portable package/module identity.
- `source`: complete module text parsed as TypeScript with JSX.

## Returns

Ordered `calls` with rewrite spans and validated `styles` for `Css.compile`. Source extraction alone does not rewrite executable calls.

## Errors

`Source.ExtractError` aggregates located source failures without a partial result.

See [Source](README.md) for related methods and types.
