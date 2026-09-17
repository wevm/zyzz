# Native source compilation

`Native.compile` from `zyzz/compiler` rewrites local shared `style`, `variants`, and `cx` authoring into native callables. Runtime calls select precompiled objects, bind dynamic scalar values, and compose ordinary native style props. They do not parse authoring source, generate CSS, or inspect the device.

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

`colorScheme` is required. `platform` is required when platform branches exist. `themes`, `units`, and `fonts` follow `StyleSheet.compile`; `theme` selects a supplied theme label and otherwise defaults to `default`. Local configured tokens retain their fallback values. Compile the required contexts ahead of time and select prepared callables with [Host.bind](../react-native/Host.md). Platform changes require compatible compiled output and another host.

The result includes rewritten `code`, a version-three `map` with original source content, and theme/scheme `recipes` tables for static definitions. The generated module imports `Native` or `NativeDynamic` from `zyzz/runtime`. The runtime helper can also bind a table selected with `StyleSheet.select`, without loading the compiler.

Recipes have at most 256 selections per theme and scheme, including null choices. Compilation rejects named conditions, CSS selectors, standalone variables, contributions, and web theme controls. CLI/bundler routing and device acceptance remain outside this source path.

## Dynamic values

Typed scalar callbacks and scoped variant payloads compile to ordered binding instructions. Dynamic values use the same portable unit, keyword, numeric, font, and color conversion rules as static declarations. Defaults, null suppression, compounds, and native overrides retain authored precedence. Missing fields and unsupported runtime values throw before returning props.

```ts
import { style, variants } from 'zyzz'

export const bar = style((values: { alpha: number }) => ({
  opacity: values.alpha,
}))
export const card = variants({
  variants: {
    spacing: {
      custom: (values: { gap: `${number}px` }) => ({ padding: values.gap }),
    },
  },
})

bar({ alpha: 0.5 })
card({ spacing: { custom: { gap: '8px' } } })
```

Callbacks are extracted without execution. Bindings consume declared inputs and return only native style props. Runtime payloads never multiply the finite selection space. Dynamic transforms, shadows, font variants, token expressions, and CSS calculations remain unsupported. Native target branches still require static literal data.

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

Named, default, and namespace imports retain finite choices and defaults, including nested style namespaces. Named, star, and namespace re-exports preserve those contracts. Namespace imports preserve ordinary exports and their live bindings. Nested namespace re-exports use version 22 contracts; older contracts remain readable. Theme and configuration factories still require named imports. Version 23 retains scalar callback slots and variant payloads for dynamic native consumers. Older dynamic contracts without this metadata fail explicitly. Ordinary package side effects remain imported.

Generate declarations from the transformed native TypeScript output. Contracts contain compiler data, not runtime implementations. Package resolution and declaration emission remain host responsibilities. Native tables do not establish iOS or Android rendering acceptance.
