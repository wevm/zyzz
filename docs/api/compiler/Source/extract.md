# Source.extract

Extract supported root literal definitions without evaluating source.

Declaration values accept ordinary strings and untagged template literals. Templates fold cooked text and literal string, finite number, boolean, null, and bigint substitutions; signed numbers, TypeScript assertions, and nested templates are supported. Fallback entries use the same rules.

```ts
css({ padding: `${8}px`, width: `calc(100% - ${16}px)` })
```

Immutable module-local bindings, record spreads, and canonical array/object property reads are expanded statically. Mutation, destructured escapes, object coercions, arithmetic expressions, arbitrary calls, and tagged templates remain unsupported. Direct theme variable paths are supported inside templates and retain their defining fallbacks. Nested templates are limited to 128 levels. CSS value checking remains static-only.

Bigint literals also support unary minus: `${-12n}px` folds to `-12px`. Unary plus on bigint remains rejected, matching JavaScript semantics.

```ts
import { Source } from 'zyzz/compiler'

const output = Source.extract({
  moduleId: 'app/card.ts',
  source:
    "import { css } from 'zyzz'; export namespace styles {\n  export const card = css({ padding: 0 })\n}",
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
    "import { css } from 'zyzz'; export namespace styles {\n  export const card = css({ padding: 0 })\n}",
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
    "import { css } from 'zyzz'; export namespace styles {\n  export const card = css({ padding: 0 })\n}",
})
```

## Returns

### variableCalls

- Type: Optional readonly array of `{ start: number; end: number; slots: Readonly<Record<string, Binding.Reference>> }`

Module-owned `Vars.define` calls with inclusive start and exclusive end offsets and immutable slot references. Each slot has a fixed custom-property `name`, scalar `type`, and `variable: true` marker. Hosts implementing rewriting must replace these spans with compiled contracts; `Transform.compile` does so automatically. The field is absent when no variable contracts are declared.

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

Bound `css` supports local const member aliases, destructuring/renaming, and alias chains. Destructuring accepts only `css`, without defaults or rest properties. Aliases must precede their references and support direct calls only. Export compiled styles and scope strings; use [Graph.compile](../Graph/compile.md) for imported/exported theme contracts, authoring aliases, and re-exports.

Explicit `theme.tokens` paths are supported as scalar property values or fallback entries in bound css calls, including aliases. Dot access, literal string/numeric brackets, and transparent TypeScript assertions retain token identity and defining fallbacks. Paths must exist and match the property domain; optional/dynamic access, token-object escapes, and root css token values produce diagnostics.

Pass both `styles` and `themes` to `Css.compile` when using extraction without rewriting. Scope-map keys derive from module/binding identity.

## Configuration Source

`Config.create` accepts literal options with preceding reusable themes or inline token data. Config-bound `css`, static `theme`/`themes.<name>` token and class reads, and immutable aliases share the theme compiler. `defaultTheme` selects shorthand fallbacks; each configuration retains an isolated identity.

Use the source graph for named config imports and re-exports. Dynamic access, object escapes, mutation, layer bodies, and variants produce diagnostics. Source is never evaluated.

## Errors

`Source.ExtractError` aggregates located source failures without a partial result.

See [Source](README.md) for related methods and types.

## Declaration Values

Direct literal fallback arrays expand into repeated declarations without reordering. Each entry retains its own source-map position and diagnostics. Trailing `!` and `!important` apply to that entry before literal/token resolution. Sparse arrays, spreads, nested arrays, and arbitrary expressions are rejected without evaluation.

### staticThemeReferences

Theme-token and variable reads consumed through immutable style records are returned with their source spans and serialized CSS-variable values. `Transform.compile` replaces those retained initializer reads, so the emitted module does not access an erased authoring factory. Imported arbitrary static records remain unsupported.

### markerCalls

Optional immutable rewrite spans for module-owned `Css.marker` calls. Each entry has inclusive `start`, exclusive `end`, and a `definition` containing the generated attribute `id` and finite `schema`. The field is absent when no marker factories are declared. Extraction-only hosts must replace these spans with compiled runtime handles; `Transform.compile` performs that replacement automatically.
