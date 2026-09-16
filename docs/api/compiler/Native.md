# Native source compilation

`Native.compile` from `zyzz/compiler` rewrites local shared `style`, `variants`, and `cx` authoring into native callables. Runtime calls select precompiled objects and compose ordinary native style props. They do not compile declarations, generate CSS, or inspect the device.

```ts
import { Native } from 'zyzz/compiler'

const output = Native.compile({
  colorScheme: 'light',
  moduleId: 'button.ts',
  platform: 'ios',
  source: `import { variants } from 'zyzz';
export const button = variants({
  base: { padding: '8px' },
  variants: { tone: { quiet: { opacity: 0.5 }, loud: { opacity: 1 } } },
  defaultVariants: { tone: 'quiet' },
});`,
})
```

The emitted module exports `button`. `button({ tone: 'loud' })` returns `{ style: ... }` for an ordinary native component. Omitted or undefined choices use defaults. Null suppresses the default. Boolean axes accept boolean inputs. Generated TypeScript retains the finite choice types and native styling overrides.

`cx` composes applied native props in argument order. Nested style arrays, falsy entries, and caller-owned override objects remain intact. Later native properties replace earlier properties, including complete structured values. Application never freezes caller overrides. Web class props are rejected.

`colorScheme` is required. `platform` is required when platform branches exist. `themes`, `units`, and `fonts` follow `StyleSheet.compile`; `theme` selects a supplied theme label and otherwise defaults to `default`. Local configured tokens retain their fallback values. Recompile for a different scheme or platform; automatic host updates remain separate work.

The result includes rewritten `code`, a version-three `map` with original source content, and complete theme/scheme `recipes` tables. The generated module imports `Native` from `zyzz/runtime`. The runtime helper can also bind a table selected with `StyleSheet.select`, without loading the compiler.

Recipes have at most 256 selections per theme and scheme, including null choices. Compilation rejects dynamic callbacks, payloads, named conditions, CSS selectors, variables, contributions, and web theme controls. Imported authoring graphs, packed native contracts, CLI/bundler routing, and device acceptance remain outside this local source path.
