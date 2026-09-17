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

`themes`, `units`, `fonts`, and `platform` follow `StyleSheet.compile`. Dynamic payloads and named conditions do not produce `staticRecipe` data. Selectors, queries, unsupported values, and missing platform inputs remain errors. Device rendering and host interoperability remain separate acceptance work.

Literal recipe axes, choices, defaults, and named theme keys are preserved in the compiled type. Omitting `themes` infers a single `default` table. Source-extracted recipes retain their broader metadata types.
