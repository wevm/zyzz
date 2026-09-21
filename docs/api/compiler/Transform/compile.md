# Transform.compile

Rewrite authoring calls and emit matching module and stylesheet artifacts.

```ts
import { Transform } from 'zyzz/compiler'

const output = Transform.compile({
  moduleId: 'app/card.ts',
  source:
    "import { style } from 'zyzz'; export namespace styles {\n  export const card = style({ padding: 0 })\n}",
})
```

## Signature

`Transform.compile(options)`

## Parameters

### options.development

- Type: `boolean`
- Default: `false`

Use stable atomic declaration names for CSS-only development updates. Production output uses readable literal values with module ownership hashes. Vite selects development naming automatically.

```ts
Transform.compile({ development: true, moduleId: 'app/card.ts', source })
```

### options.moduleId

- Type: `string`
- Required: Yes.

Stable portable package-relative module identity.

```ts
Transform.compile({
  moduleId: 'app/card.ts',
  source:
    "import { style } from 'zyzz'; export namespace styles {\n  export const card = style({ padding: 0 })\n}",
})
```

### options.source

- Type: `string`
- Required: Yes.

Complete module text parsed as TypeScript with JSX. No source execution or filesystem reads occur.

```ts
Transform.compile({
  moduleId: 'app/card.ts',
  source:
    "import { style } from 'zyzz'; export namespace styles {\n  export const card = style({ padding: 0 })\n}",
})
```

## Returns

### classes

- Type: `Readonly<Record<string, string>>`

Compiled class lists keyed by extracted style identity.

```ts
output.classes
```

### code

- Type: `string`

Rewritten source module. TypeScript/JSX lowering belongs to the consuming build; retained callables use the runtime entrypoint.

```ts
output.code
```

### css

- Type: `string`

Matching stylesheet. Distribute this with the rewritten code.

```ts
output.css
```

### cssMap

- Type: `Transform.compile.ReturnType["cssMap"]`

Encoded source map tracing CSS back to authoring source.

```ts
output.cssMap
```

### map

- Type: `Transform.compile.ReturnType["map"]`

Encoded source map tracing rewritten code back to authoring source.

```ts
output.map
```

## Theme Rewriting

Local theme factories and scope reads become constants. Bound style calls compile through the token resolver; retained callables use the small props runtime, while direct no-argument applications can fold into props constants. Generated JavaScript neither imports theme authoring code nor generates CSS rules. TypeScript retains literal theme types for type queries; JavaScript inputs receive no TypeScript syntax.

Theme variable and scope identities derive from the stable package/module ID and defining binding. Token-value edits and unrelated source insertions preserve those identities; renaming the binding or module changes them. Scope rules trace to their factory and element declarations to their authored properties. The file host uses this transform and rebuilds CSS after edits.

Untransformed `config.style` calls and `config.vars()` selections throw the missing-transform error. In-memory compilation reads scope classes from `Css.compile(...).vars` instead.

## Errors

`Source.ExtractError` or `Css.CompileError`; errors precede publication.

Source maps trace generated artifacts back to original authoring. See [Publish Libraries](../../../guides/compilation.md#publish-libraries).

See [Transform](README.md) for related methods and types.

Relative URLs in stylesheet contributions require `Graph.compile` and a relocation host. A standalone transform rejects them; absolute, data, fragment, query-only, and empty URLs retain their authored resolution.

## CSS reset

Set `reset: true` to include the bundled reset in the returned `css`. The default is `false`. CSS source maps remain available. Each call includes its own reset; use `Graph.compile` when combining modules into one stylesheet.

```ts
const output = Transform.compile({ moduleId: 'app.ts', reset: true, source })
```
