# Static native variants

`Variants.compile` from `zyzz/react-native` compiles `Source.extract(...).calls[index].staticRecipe` into native tables. The same root `variants` authoring supplies web and native declarations.

```ts
import { Source } from 'zyzz/compiler'
import { Variants } from 'zyzz/react-native'

const extracted = Source.extract({
  moduleId: 'button.ts',
  source: `import { variants } from 'zyzz';
export const button = variants({
  base: { padding: '8px' },
  variants: { tone: { quiet: { opacity: 0.5 }, loud: { opacity: 1 } } },
  defaultVariants: { tone: 'quiet' },
});`,
})
const recipe = extracted.calls[0]!.staticRecipe!
const compiled = Variants.compile({ recipe, platform: 'ios' })
```

Compilation applies the base, selected axes in declaration order, and matching compounds in declaration order. Each group applies shared declarations, then native and platform overrides. Structured values replace earlier values. Numeric shared line height uses the final selected font size.

Every axis includes a null choice that suppresses its default. Tables use mixed-radix indices with the first axis varying fastest and null following its declared choices. Compilation rejects more than 256 selections per theme and scheme before allocating tables. Identical outputs share immutable objects.

`vars`, `units`, `fonts`, and `platform` follow `StyleSheet.compile`. Dynamic payloads and named conditions do not produce `staticRecipe` data. Selectors, queries, unsupported values, and missing platform inputs remain errors. Device rendering and host interoperability remain separate acceptance work.

Literal recipe axes, choices, defaults, and named theme keys are preserved in the compiled type. Omitting `vars` infers a single `default` table. Source-extracted recipes retain their broader metadata types.

## API

| API                | Description                                                   |
| ------------------ | ------------------------------------------------------------- |
| `compile(options)` | Compile finite recipes into immutable native tables.          |
| `CompileError`     | Report invalid recipe metadata or excessive selection counts. |

## Signature

```ts
declare function compile<
  const recipe extends Variants.compile.Options['recipe'],
  const themeName extends string = 'default',
>(
  options: Variants.compile.Options<recipe, themeName>,
): Variants.compile.ReturnType<recipe, themeName>
```

`recipe` must satisfy the static recipe shape below. `Variants.Definition<recipe, themeName>` and `Variants.compile.ReturnType<recipe, themeName>` describe the same result.

## Parameters

### options.recipe

Type: static recipe data. Required, with no default.

```ts
{
  readonly axes: Readonly<Record<string, readonly string[]>>
  readonly defaults: Readonly<Record<string, string | null>>
  readonly rules: readonly {
    readonly matches: readonly (readonly [string, readonly string[]])[]
    readonly value: Style.Definition
  }[]
}
```

Axes require nonempty names and nonempty, dense arrays of unique string choices. Defaults must name declared axes and choices, or `null`. Rule matches must name declared axes and nonempty lists of declared choices. An empty `matches` list always applies. Rules retain application order.

The selection count is the product of each axis's choice count plus one for omission. The maximum is 256 per theme and scheme. An empty axes object produces one selection.

```ts
Variants.compile({ recipe: extracted.calls[0]!.staticRecipe! })
```

### options.vars

Type: `Readonly<Record<themeName, Vars.Definition>>`. Optional.

Omission creates a `default` table using token fallbacks. Supplied theme labels become output keys. An empty map is invalid. Compatible theme definitions replace token values for each scheme. Unrelated token contracts retain their own fallbacks.

```ts
Variants.compile({
  recipe,
  vars: { base: theme, alternate: Vars.extend(theme, {}) },
})
```

### options.fonts

Type: `Readonly<Record<string, string>>`. Optional, with no implicit mappings.

Map exact authored font-family strings to installed native family names. Every authored family requires a mapping. Compilation neither loads fonts nor chooses platform fallbacks.

```ts
Variants.compile({ recipe, fonts: { 'Inter, sans-serif': 'Inter-Regular' } })
```

### options.platform

Type: `'android' | 'ios'`. Optional unless selected declarations contain platform branches. No default.

Select the platform override after shared and common native declarations. Compilation never reads device state.

```ts
Variants.compile({ recipe, platform: 'android' })
```

### options.units

Type: `{ readonly px?: number; readonly rem?: number }`. Optional.

Scales must be positive finite logical-unit values. `px` defaults to `1`. `rem` has no default and requires an explicit scale when used. Compilation never reads pixel ratio or root font size.

```ts
Variants.compile({ recipe, units: { px: 1, rem: 16 } })
```

## Returns

The result is a frozen `Variants.Definition`. Compilation copies metadata and does not mutate the input recipe. All three properties are always present.

### axes

Type: `{ readonly [axis in keyof recipe['axes']]: Readonly<recipe['axes'][axis]> }`.

Copied, frozen choice lists in declaration order. Literal axis names and tuples remain inferred. Omitted selections are represented by an additional table index, not an entry in these lists.

```ts
compiled.axes.tone // ['quiet', 'loud'] for the introductory recipe
```

### defaults

Type: `Readonly<recipe['defaults']>`.

A frozen copy of declared defaults. `null` suppresses an axis. Compilation retains defaults as metadata and emits all combinations, including omitted choices, without applying defaults to every entry.

```ts
compiled.defaults.tone // 'quiet' for the introductory recipe
```

### styles

Type: `StyleSheet.compile.ReturnType<string, themeName>['styles']`.

Frozen tables indexed by theme, then `'dark' | 'light'`, then a stringified mixed-radix index. Both schemes always exist. The first axis varies fastest, with omission after its choices. Unknown numeric indices may return `undefined`. Identical native styles share object identity within one compilation.

```ts
compiled.styles.default.light['0'] // tone: quiet
compiled.styles.default.light['1'] // tone: loud
compiled.styles.default.light['2'] // tone omitted
```

## Errors

`Variants.CompileError` rejects invalid axis lists, undeclared defaults or compound choices, and selection counts above 256. Its `name` is `'Variants.CompileError'` and `message` describes the invalid metadata or budget. Selection growth is checked before table allocation.

`StyleSheet.CompileError` reports unsupported native declarations and invalid theme, font, platform, or unit inputs. Its immutable `diagnostics` include `code`, `message`, and `path`. See [native compilation errors](StyleSheet/compile.md#errors) and [capabilities](StyleSheet/README.md#capabilities).

```ts
try {
  Variants.compile({ recipe })
} catch (error) {
  if (error instanceof Variants.CompileError) console.error(error.message)
  else throw error
}
```
