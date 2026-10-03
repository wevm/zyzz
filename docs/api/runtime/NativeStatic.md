# Native static runtime

`NativeStatic` from `zyzz/runtime` selects finite native variants from compiler-generated fragments. Native compilation emits this helper for finite programs without scalar inputs or payloads. Generate metadata through `Native.compile` or a native `Graph.compile` build.

| API                    | Description                                                             |
| ---------------------- | ----------------------------------------------------------------------- |
| `create(options)`      | Bind ordered fragments to finite selections and native style overrides. |
| `create.Options<Axes>` | Describe compiler-owned axes, defaults, rules, and fragments.           |

## create

```ts
import { NativeStatic } from 'zyzz/runtime'

const card = NativeStatic.create({
  axes: { size: ['small', 'large'] },
  defaults: { size: 'small' },
  rules: [
    { matches: [], steps: ['base', 1.25] },
    { matches: [['size', ['large']]], steps: ['large'] },
  ],
  styles: {
    base: { fontSize: 16 },
    large: { fontSize: 20 },
  },
})

card({ size: 'large' }) // { style: { fontSize: 20, lineHeight: 25 } }
card({ size: null, style: { opacity: 0.5 } })
```

### options.axes

Type: `Readonly<Record<string, readonly string[]>>`

Ordered finite choices, such as `{ size: ['small', 'large'] }`. Literal axis names and choices flow into the returned callable. Metadata choices `'true'` and `'false'` become boolean application inputs.

### options.defaults

Type: `Readonly<Record<string, string | null>>`

Fallback selections, such as `{ size: 'small' }`. Omitted or `undefined` application inputs use these defaults. An explicit `null` suppresses the default for that axis. An axis without a default remains unselected.

### options.rules

Each rule contains `matches` and `steps`. Rules and steps retain compiler order. Every `[axis, choices]` tuple must match for a rule to apply. An empty `matches` array applies unconditionally.

String steps identify entries in `options.styles`. Numeric steps are unitless line-height multipliers, resolved against the final selected `fontSize`. For example, `steps: ['base', 1.25]` uses the base fragment and defers its line height. A later fragment with an absolute `lineHeight` replaces that multiplier.

### options.styles

Type: `Readonly<Record<string, StyleSheet.NativeStyle>>`

Converted native fragments indexed by the names used in rule steps, such as `{ base: { fontSize: 16 } }`. Referenced fragments are frozen recursively during creation. Matching fragments merge in order, with later properties taking precedence.

### Returns

Type: `Native.Callable<Axes>`

The callable returns `Native.Props` and accepts inferred selections plus a native `style` override. Overrides follow the compiled style in the returned array, retain their types and identity, and remain mutable. Compiled result objects are immutable.

Selections are computed on demand and cached per callable, up to 256 combinations. Eviction removes the earliest inserted selection. Cache hits do not refresh that order. Evicted selections can be recomputed without limiting the recipe's combinations.

### Errors

`Native.SelectionError` reports unknown axes or choices, payloads supplied to static choices, missing referenced fragments, and invalid line-height conversion. A multiplier requires a numeric final `fontSize` and must produce a finite, nonnegative line height.

This helper reads no device state and performs no scalar payload conversion. Theme, appearance, and viewport selection belong to the native adapter. Scalar callbacks and variant payloads use [NativeDynamic](NativeDynamic.md).
