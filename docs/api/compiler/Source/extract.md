# Source.extract

Extract supported root literal definitions without evaluating source.

```ts
import { Source } from 'zyzz/compiler'

const output = Source.extract({
  moduleId: 'app/card.ts',
  source:
    "import { style } from 'zyzz'; export const card = style({ padding: 0 })",
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
  source:
    "import { style } from 'zyzz'; export const card = style({ padding: 0 })",
})
```

### options.source

- Type: `string`
- Required: Yes.

Complete module text parsed as TypeScript with JSX. No source execution or filesystem reads occur.

```ts
Source.extract({
  moduleId: 'app/card.ts',
  source:
    "import { style } from 'zyzz'; export const card = style({ padding: 0 })",
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

Bound `style` supports local const member aliases, destructuring/renaming, and alias chains. Destructuring accepts only `style`, without defaults or rest properties. Aliases must precede their references and support direct calls only. Export compiled styles and scope strings; use [Graph.compile](../Graph/compile.md) for imported/exported theme contracts, authoring aliases, and re-exports.

Explicit `theme.tokens` paths are supported as scalar property values or fallback entries in bound style calls, including aliases. Dot access, literal string/numeric brackets, and transparent TypeScript assertions retain token identity and defining fallbacks. Paths must exist and match the property domain; optional/dynamic access, token-object escapes, and root style token values produce diagnostics.

Pass both `styles` and `themes` to `Css.compile` when using extraction without rewriting. Scope-map keys derive from module/binding identity.

## Configuration Source

`Config.create` accepts literal options with preceding reusable themes or inline token data. Config-bound `style`, static `theme`/`themes.<name>` token and class reads, and immutable aliases share the theme compiler. `defaultTheme` selects shorthand fallbacks; each configuration retains an isolated identity.

Use the source graph for named config imports and re-exports. Dynamic access, object escapes, mutation, layer bodies, and variants produce diagnostics. Source is never evaluated.

## Errors

`Source.ExtractError` aggregates located source failures without a partial result.

See [Source](README.md) for related methods and types.

## Declaration Values

Direct literal fallback arrays expand into repeated declarations without reordering. Each entry retains its own source-map position and diagnostics. Trailing `!` and `!important` apply to that entry before literal/token resolution. Sparse arrays, spreads, nested arrays, and arbitrary expressions are rejected without evaluation.
