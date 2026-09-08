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

## Theme Source

Theme factories require literal token data in module-level `const` bindings. Extensions reference preceding local themes. Literal keys, nested palettes, numeric keys, and transparent `as` / `satisfies` wrappers are supported; expressions, spreads, mutation, namespace imports, and dynamic factories produce diagnostics without executing application code.

Bound `css` supports local const member aliases, destructuring/renaming, and alias chains. Destructuring accepts only `css`, without defaults or rest properties. Aliases must precede their references and support direct calls only. Export compiled styles and scope strings; importing/exporting theme contracts or authoring aliases, re-exports, and explicit source token paths still require graph linking.

Pass both `styles` and `themes` to `Css.compile` when using extraction without rewriting. Scope-map keys derive from module/binding identity.

## Errors

`Source.ExtractError` aggregates located source failures without a partial result.

See [Source](README.md) for related methods and types.
