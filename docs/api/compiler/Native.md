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

Recipes have at most 256 selections per theme and scheme, including null choices. Compilation rejects dynamic callbacks, payloads, named conditions, CSS selectors, variables, contributions, and web theme controls. CLI/bundler routing and device acceptance remain outside this source path.

## Imported Definitions

`Graph.compile` and `Graph.create().compile` accept a `native` context for a complete source graph. Imports, re-exports, configured authoring helpers, and composition retain the graph compiler's resolution and dependency rules. Ordinary application imports remain in the output.

```ts
import { Graph } from 'zyzz/compiler'

const output = Graph.compile({
  modules: {
    'card.ts': `import { style } from 'zyzz'; export const card = style({ opacity: 0.5 });`,
    'index.ts': `export { card } from './card.js';`,
  },
  native: { colorScheme: 'light', platform: 'ios' },
})
```

Native graph output uses the existing `modules` and `dependencies` shape. Module `code` and `map` contain native callables, while CSS, class, and scope outputs are empty. Source rewriting is required. Exported static callables include target-neutral recipes in version 21 contracts.

## Packed Callables

Both web and native graph builds publish static recipes in `<entry>.zyzz.json` contracts. Native consumers supply those contracts and host-resolved `imports` edges. Compilation restores token references, applies the consumer's platform and scheme, and replaces imported callables with typed native table selectors.

```ts
const native = Graph.compile({
  contracts: { 'library/index.js': library.contracts['library/index.ts']! },
  imports: { 'app.ts': { library: 'library/index.js' } },
  modules: {
    'app.ts': `import { button } from 'library'; export const props = button();`,
  },
  native: { colorScheme: 'dark', platform: 'android' },
})
```

Named and default imports, named re-exports, and star re-exports retain finite choices and defaults. Exported style namespaces use named imports. Namespace imports and namespace re-exports from packed modules require named bindings. Dynamic and legacy callables without static recipes fail explicitly. Ordinary package side effects remain imported.

Generate declarations from the transformed native TypeScript output. Contracts contain compiler data, not runtime implementations. Package resolution and declaration emission remain host responsibilities. Native tables do not establish iOS or Android rendering acceptance.
