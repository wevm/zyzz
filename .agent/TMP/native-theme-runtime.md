# Native Theme Runtime

This proposal gives Zyzz contributors a review contract for resolved native theme values, updates, and React consumers. It is stacked on [shared native style packages](https://github.com/wevm/zyzz/pull/352), with source checked at `c3da6b4d32029315a7e7e02520d5286a355ca148`.

> [!NOTE]
> These APIs are proposed and unimplemented. This draft changes documentation only. Examples describe the intended contract and have not passed consumer type checks or native execution. The backend and appearance fallback decisions remain open.

## Current Gaps

- `Config.create` exposes symbolic `vars`, rather than a resolved native value tree, and rejects a `data` option. See [configuration](../../src/internal/Configuration.ts) and [variable references](../../src/Vars.ts).
- Passing the authoring config to a runtime currently fails compiler extraction. Native lowering retains static set/scheme tables, without the dependency graph required for mutable values. See [config extraction](../../src/compiler/internal/Themes.ts) and [native lowering](../../src/compiler/Native.ts).
- The [native host](../../src/react-native/Host.ts) accepts explicit device inputs. The [React adapter](../../src/react-native/react.ts) selects static styles through a Provider. Neither exposes the proposed raw-value hooks or instance-owned theme updates.

Tempro already reads raw theme values for [typography][t-type] and [form-sheet options][t-form]. Its [theme assembly][t-theme] also contains ordinary metadata. Compiler delivery alone does not replace these consumers.

## Configuration

Keep the existing authoring helpers and additionally export the complete config. The following module adapts the [DS configuration][d-config]. The DS export change belongs to DS, while Zyzz owns config inference and compiler delivery.

```ts
import { Config } from 'zyzz'
import { inverse, variables } from './vars.js'

export const config = Config.create({
  cssOutput: 'atomic',
  data: {
    base: { text: { includeFontPadding: false } },
    inverse: { text: { includeFontPadding: false } },
  },
  defaultVars: 'base',
  id: 'tds/platform',
  vars: { base: variables, inverse },
})

export const { style, variants, vars } = config
```

`vars` remains the authoritative styling-token tree. Optional `data` contains readonly portable metadata: objects, arrays, booleans, numbers, strings, and null. Functions and opaque native objects remain outside this contract. Native factories will handle those cases separately.

For named sets, `data` must have the same set keys as `vars`. For a single set, `data` is the metadata object itself. Resolved values merge the selected metadata with resolved variables. Overlapping top-level keys are errors. Supplying metadata exposes `config.data`, while omitting it preserves the existing result shape.

The Unistyles equivalent registers ordinary native-valued theme objects globally. Styling values and metadata share an object, and application declaration merging supplies theme inference. The comparison module below defines numeric native lengths and registered font names.

```ts
import { StyleSheet } from 'react-native-unistyles'
import {
  baseDarkValues,
  baseLightValues,
  inverseDarkValues,
  inverseLightValues,
} from './native-themes.js'

const themes = {
  dark: { ...baseDarkValues, text: { includeFontPadding: false } },
  inverseDark: { ...inverseDarkValues, text: { includeFontPadding: false } },
  inverseLight: { ...inverseLightValues, text: { includeFontPadding: false } },
  light: { ...baseLightValues, text: { includeFontPadding: false } },
}

type AppThemes = typeof themes

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  settings: { adaptiveThemes: true, nativeBreakpointsMode: 'points' },
  themes,
})
```

Unistyles adaptive mode selects the names `light` and `dark`. The inverse profiles require explicit selection or application coordination. Tempro currently registers only light/dark with `initialTheme: AppConfig.colorScheme`. That initial-theme setting and adaptive mode are mutually exclusive. See [configuration][u-config] and [Tempro setup][t-theme].

## Runtime

Add a native adapter entrypoint, `zyzz/react-native/runtime`, without adding device or framework dependencies to the pure core. Construction occurs at the application boundary and installs no listeners.

The snapshot's `colorScheme` is resolved to light/dark, while `systemColorScheme` preserves the device's unspecified result. The proposed automatic fallback is light, subject to review below.

```ts
import { Runtime } from 'zyzz/react-native/runtime'
import { config } from './zyzz.config.js'

export function createAppRuntime() {
  return Runtime.create({
    colorScheme: 'light dark',
    config,
    set: 'base',
  })
}

export type AppRuntime = ReturnType<typeof createAppRuntime>
```

| API                             | Contract                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Runtime.create(options)`       | Require `config`. Default set to `defaultVars`, or `default` for a single set. Default appearance to automatic `light dark`.                           |
| `runtime.getValues(options?)`   | Return a readonly native value tree. Optional set/resolved scheme reads leave root appearance unchanged.                                               |
| `runtime.updateValues(options)` | Require a pure `update` callback. Optional set/resolved scheme selects one profile, defaulting to the current profile. Validate and commit atomically. |
| `runtime.appearance.get()`      | Return requested set and scheme mode.                                                                                                                  |
| `runtime.appearance.set(patch)` | Change only supplied fields atomically. Reject unknown sets or invalid modes.                                                                          |
| `runtime.getSnapshot()`         | Return a stable immutable snapshot of values, appearance, and supported host inputs. Identity changes only after a committed change.                   |
| `runtime.subscribe(listener)`   | Notify after committed changes. Return an idempotent unsubscribe function.                                                                             |
| `runtime.connect()`             | Attach adapter listeners. Return a reference-counted cleanup function.                                                                                 |
| `runtime.dispose()`             | Release connections/subscriptions and reject subsequent writes or applications. Repeated disposal is harmless.                                         |

Resolved lengths use native logical units. Typography line height is absolute, and font families use the compiler mapping. Arbitrary metadata strings keep their authored content. Public types such as `Runtime.Handle<typeof config>` and `Runtime.Values<typeof config>` preserve field/set names while widening mutable scalar values within their domains.

```ts
const runtime = createAppRuntime()
const background = runtime.getValues().color.background.secondary

runtime.appearance.set({ colorScheme: 'dark', set: 'inverse' })

runtime.updateValues({
  colorScheme: 'dark',
  set: 'base',
  update: (current) => ({
    ...current,
    color: {
      ...current.color,
      content: { ...current.color.content, primary: '#eeeeee' },
    },
  }),
})
```

Updates preserve shape and store changed-path overlays per runtime/profile. Recompute aliases and calculations before committing. Returning the full tree must not freeze unchanged derived values. Invalid domain values, unsupported native values, or nonportable metadata leave the snapshot and all subscribers unchanged.

Define `Runtime.InvalidError` for invalid inputs, `Runtime.CapabilityError` for unsupported target behavior, and `Runtime.LifecycleError` for operations after disposal. The implementation must distinguish these observable errors through public imports.

The Unistyles equivalent selects or updates globally registered named themes. Adaptive mode must be disabled before manual selection. Its theme objects do not provide Zyzz's proposed instance-local token-overlay contract. See the [public runtime][u-runtime] and [native implementation][u-native].

```ts
import { UnistylesRuntime } from 'react-native-unistyles'

const background = UnistylesRuntime.getTheme().color.background.secondary

UnistylesRuntime.setAdaptiveThemes(false)
UnistylesRuntime.setTheme('inverseDark')

UnistylesRuntime.updateTheme('dark', (current) => ({
  ...current,
  color: {
    ...current.color,
    content: { ...current.color.content, primary: '#eeeeee' },
  },
}))
```

## React Consumers

Add `useValues(runtime, selector?)` and `useRuntime(runtime, selector?)` to `zyzz/react-native/react`. Compare selected results with `Object.is`. Omitting the selector subscribes to the whole value tree or snapshot. Newly allocated selector objects receive no shallow-equality guarantee.

```ts
import { useValues } from 'zyzz/react-native/react'
import type { AppRuntime } from './runtime.js'

export function useSheetBackground(runtime: AppRuntime) {
  return useValues(runtime, (values) => values.color.background.secondary)
}
```

The equivalent Unistyles hook returns a theme proxy and mini runtime. It accepts neither an instance nor a selector. Theme property reads track the theme dependency. See [hook entrypoint][u-hook] and [dependency tracking][u-proxy].

```ts
import { useUnistyles } from 'react-native-unistyles'

export function useSheetBackground() {
  const { theme } = useUnistyles()
  return theme.color.background.secondary
}
```

Add `<Provider runtime={runtime}>` for basic root integration and `useStyles(runtime)` for explicit ownership. Retain the legacy Provider and `useStyles()` contract. The Provider detaches its connection on cleanup without permanently disposing the runtime, allowing Strict Mode remounts.

Unistyles uses global configuration and needs no root Provider. Scoped themes, reset/inversion, complete provider-free bindings, and direct native view updates belong to later changes. This initial runtime must not claim zero React renders for style updates.

## Implementation Boundaries

1. Preserve config identity, native values, and dependency metadata through compilation and packed-library consumption. Define validation/versioning before changing the [packed contract](../../src/compiler/internal/Contract.ts). Published consumers must not require private compiler types.
2. Implement inference, instance-owned profile resolution, atomic overlays, appearance, and lifecycle using the existing host where appropriate. Core evaluation remains pure. Device reads and listeners live in the native adapter.
3. Add value/snapshot hooks and basic Provider integration through the existing React adapter. Export only APIs whose behavior and errors are implemented. Retain config ownership when applying compiled styles.
4. Prove consumer acceptance below before changing this draft to an implementation PR. If value/dependency packing and React integration exceed a concise reviewable change, revise the sequence before implementation.

The eventual implementation description and title should reflect its final code. The current draft is documentation only.

## Decisions For Review

| Decision                  | Recommendation                                                                                                                                   | Alternative                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend sequence          | Establish values and React consumers through the existing Host/React path. Choose the direct native update engine before selective view updates. | Prototype a Unistyles-backed runtime first. Its module-owned Nitro runtime and singleton native registry must demonstrate explicit instance/root isolation. |
| Unspecified device scheme | Preserve Zyzz's proposed light fallback for automatic mode.                                                                                      | Match the pinned Unistyles native adaptive path, which selects dark for an unspecified scheme.                                                              |
| Metadata                  | Keep portable `data` separate from styling tokens. Prove equivalent helper behavior through imported native factories later.                     | Broaden the portable contract only after concrete consumers demonstrate a missing capability.                                                               |

These decisions remain pending. No Unistyles dependency, runtime implementation, or compatibility wrapper is introduced by this draft. Compare [Unistyles runtime ownership][u-runtime] and [native registry][u-registry].

## Acceptance Cases

| Consumer               | Required evidence                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared DS package      | Packed config supplies typed native reads. Independent expected values include `spacing['24'] === 24` and existing color/font projections. Verify inferred set names without ambient declarations. |
| Tempro typography      | Preserve numeric font metrics, loaded-family mapping, theme colors, and ordinary metadata from [typography][t-type] and [theme assembly][t-theme]. Raw consumers update after selection changes.   |
| Tempro navigation      | Form-sheet options receive resolved colors and corner radii. Preserve the existing iOS version-specific radius rule in [the actual caller][t-form].                                                |
| Geometry               | Preserve Tempro's page gutter `10` and margin `20` from [attributes][t-dimensions]. DS defaults are not an implicit replacement for these values.                                                  |
| Independent roots      | Two runtimes from one config hold different selections and overlays. Updating or disposing one leaves the other runtime and authored config unchanged.                                             |
| Derived values         | Use an independently specified base/alias/calculation fixture. A base update changes dependent values, including a second update after returning a full tree.                                      |
| Atomic errors          | Unknown sets, changed shapes, invalid scalar domains, and nonportable metadata fail without a partial snapshot, notification, or binding update. Define namespaced runtime errors.                 |
| React and lifecycle    | Unchanged selector results avoid renders. Repeated connection cleanup/disposal is safe. Strict Mode remounts retain a usable runtime. Verify connection and subscription cleanup.                  |
| Delivery and rendering | Exercise direct source and packed-library consumers through public APIs. Record real iOS/Android typography and navigation evidence separately from compiler/host checks.                          |

Current preparation checks passed: repository build, TypeScript checks, and 158 existing Host/Graph tests. Probes reproduced symbolic reads, rejected `Config.data`, and rejected config-to-runtime extraction. These results establish the starting behavior. They do not verify the proposed APIs or native rendering.

## Sources

Source revisions: Unistyles `29f51324605270c63146f0722041faa561c625fd` (3.4.0), Tempro `40705e4654d2e7ad3699382db4ea46e5c40d8bdc`, and DS `8a03c7c85cfaa56377f224aa9f50d18c6a8e726e`. Tempro's audited dependency is Unistyles 3.3. The wider comparison targets 3.4. Discussion context: [Tempro and shared DS thread][slack-thread].

[d-config]: https://github.com/tempoxyz/ds/blob/8a03c7c85cfaa56377f224aa9f50d18c6a8e726e/src/platform/zyzz.config.ts
[slack-thread]: https://tempoxyz.slack.com/archives/C0A87C21805/p1790891272056049
[t-dimensions]: https://github.com/tempoxyz/tempro/blob/40705e4654d2e7ad3699382db4ea46e5c40d8bdc/apps/mobile/lib/attributes.ts
[t-form]: https://github.com/tempoxyz/tempro/blob/40705e4654d2e7ad3699382db4ea46e5c40d8bdc/apps/mobile/hooks/use-form-sheet-screen-options.ts
[t-theme]: https://github.com/tempoxyz/tempro/blob/40705e4654d2e7ad3699382db4ea46e5c40d8bdc/apps/mobile/lib/unistyles.ts
[t-type]: https://github.com/tempoxyz/tempro/blob/40705e4654d2e7ad3699382db4ea46e5c40d8bdc/apps/mobile/components/ui/typography.tsx
[u-config]: https://github.com/jpudysz/react-native-unistyles/blob/29f51324605270c63146f0722041faa561c625fd/packages/unistyles/src/specs/StyleSheet/index.ts
[u-hook]: https://github.com/jpudysz/react-native-unistyles/blob/29f51324605270c63146f0722041faa561c625fd/packages/unistyles/src/core/useUnistyles.ts
[u-native]: https://github.com/jpudysz/react-native-unistyles/blob/29f51324605270c63146f0722041faa561c625fd/packages/unistyles/cxx/hybridObjects/HybridUnistylesRuntime.cpp
[u-proxy]: https://github.com/jpudysz/react-native-unistyles/blob/29f51324605270c63146f0722041faa561c625fd/packages/unistyles/src/core/useProxifiedUnistyles/useProxifiedUnistyles.ts
[u-registry]: https://github.com/jpudysz/react-native-unistyles/blob/29f51324605270c63146f0722041faa561c625fd/packages/unistyles/cxx/core/UnistylesRegistry.h
[u-runtime]: https://github.com/jpudysz/react-native-unistyles/blob/29f51324605270c63146f0722041faa561c625fd/packages/unistyles/src/specs/UnistylesRuntime/index.ts
