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

### options.moduleId

- Type: `string`
- Required: Yes.

Stable portable package-relative module identity.

```ts
Source.extract({
  moduleId: 'app/card.ts',
  source: "import { css } from 'zyzz'; export const card = css({ padding: 0 })",
})
```

### options.source

- Type: `string`
- Required: Yes.

Complete module text parsed as TypeScript with JSX. No source execution or filesystem reads occur.

```ts
Source.extract({
  moduleId: 'app/card.ts',
  source: "import { css } from 'zyzz'; export const card = css({ padding: 0 })",
})
```

## Returns

### calls

- Type: `readonly Source.Call[]`

Ordered authoring calls with names and rewrite spans.

```ts
output.calls[0]?.start
```

### themeAliases

- Type: `Source.extract.ReturnType["themeAliases"]`

Local bound-authoring initializers, source spans, and token types used by the rewriter.

```ts
output.themeAliases[0]?.start
```

### styles

- Type: `Style.Definition`

Validated ordered styles accepted by `Css.compile`. Extraction alone does not rewrite executable calls.

```ts
output.styles
```

## Errors

`Source.ExtractError` aggregates located source failures without a partial result.

See [Source](README.md) for related methods and types.
