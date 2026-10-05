# Native source compilation

`Native.compile` from `zyzz/compiler` rewrites local shared `style`, `variants`, and `cx` authoring into native callables. Runtime calls combine selected precompiled fragments, bind dynamic scalar values, and compose ordinary native style props. They do not parse authoring source, generate CSS, or inspect the device.

Native compilation also rewrites linked `useVars(vars, selector?)` arguments into readonly native profiles using the same font and unit mappings. The [React adapter](https://zyzz.sh/docs/api/react-native/useVars) selects those profiles through the nearest Provider.

Graph compilation emits each profile once, as an export of the module that defines the variables, and consumers import it. Packed definitions without source compile a local copy in each consumer.

`defineConfig` from `zyzz/react-native` retains an ordinary React `Provider` export alongside the linked authoring helpers. Configuration modules require a native target. Packed publishers supply the native context with `contextual: true` to `Graph.compile` for Provider selection, and consumers retain the Provider through normal package imports.

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

`colorScheme` is required. `platform` is required when platform branches exist. `vars`, `units`, and `fonts` follow `StyleSheet.compile`; `set` selects a supplied variable-set label and otherwise defaults to `default`. Local configured tokens retain their fallback values. Compile the required contexts ahead of time and select prepared callables with [Host.bind](https://zyzz.sh/docs/api/react-native/namespaces/Host). Platform changes require compatible compiled output and another host.

The result includes rewritten `code`, a version-three `map` with original source content, and theme/scheme `recipes` tables for definitions without variant or scalar programs. Variant and scalar definitions retain their compiled data in `code`. The generated module imports `Native` or `NativeDynamic` from `zyzz/runtime`.

Compiled recipes have no combination-count limit. Compilation retains base, variant, and compound fragments rather than expanding every combination. Static results are immutable, with at most 256 cached selections per compiled context. Evicted selections are recomputed. Scalar payloads produce fresh results, and caller overrides remain outside the cache.

The separate low-level [`Variants.compile`](https://zyzz.sh/docs/api/react-native/namespaces/Variants) API retains its bounded numeric table format. Source compilation rejects named conditions, CSS selectors, standalone variables, contributions, and web theme controls. CLI/bundler routing and device acceptance remain outside this source path.

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

Callbacks are extracted without execution. Bindings consume declared inputs and return only native style props. Runtime payloads never multiply the finite selection space. Dynamic transforms, shadows, and font variants remain unsupported. Native target branches still require static literal data.

### Calculated lengths

Use portable `calc(...)` expressions for lengths that combine theme variables and runtime scalar inputs. Native compilation resolves theme references for every configured selection and scheme. Application evaluates the calculation with the supplied input. The same definition emits CSS ahead of time for web consumers.

```ts
import { defineConfig } from 'zyzz'

const { style, vars } = defineConfig({
  vars: { spacing: { artwork: '180px', gutter: '80px' } },
})

const artwork = style((input: { aspectRatio: number }) => ({
  width: `calc(${vars.spacing.artwork} * 2 + ${vars.spacing.gutter}) !custom`,
  height: `calc((${vars.spacing.artwork} * 2 + ${vars.spacing.gutter}) / ${input.aspectRatio}) !custom`,
}))

artwork({ aspectRatio: 2 }) // Native width: 440, height: 220.
```

Calculations support finite numbers, px/rem lengths, parentheses, unary signs, addition, subtraction, multiplication, and division. Addition and subtraction require matching dimensions; multiplication permits one length operand, and division requires a nonzero number. `units.rem` is required for rem lengths. Calculated padding, margin, and inset shorthands preserve spaces within each expression.

Native application rejects percentages and relative units within calculations, unresolved CSS variables, nonfinite results, and negative lengths on unsigned properties. Expressions are limited to 512 tokens and 64 nested operations. Use variants for finite conditional choices; JavaScript arithmetic and conditional callback expressions remain unsupported.

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

Both web and native graph builds publish static recipes in `<entry>.zyzz.json` contracts. Native consumers supply those contracts, host-resolved `imports` edges, and any selected variable catalogs. Compilation restores token references, applies the consumer's context, and replaces imported callables with typed native selectors. Packed recipes also avoid combination expansion.

Version 33 retains the owning configuration's named catalogs for exported styles. Contextual consumers select every catalog through the nearest Provider, including when the package exports styles without its configuration. Catalog references and defaults are validated before compilation.

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

Responsive callables select query profiles at runtime and are omitted from the static `recipes` metadata.
