# Host

`Host` from `zyzz/react-native` manages explicit native inputs, bound callables, and device subscription cleanup. Each instance has a fixed platform and capability map. It imports no React Native, React, compiler, or device APIs.

## Bind compiled definitions

Pass precompiled `Variants.Definition` data and resolved device inputs at the application boundary. Compilation and JSON loading happen outside the host.

```ts
import { Host, StyleSheet, type Variants } from 'zyzz/react-native'
import { Native } from 'zyzz/runtime'

export function attach(
  definition: Variants.Definition,
  inputs: Host.create.Options,
) {
  const host = Host.create(inputs)
  const card = host.bind((context) =>
    Native.create({
      axes: definition.axes,
      defaults: definition.defaults,
      styles: StyleSheet.select(definition.styles, context),
    }),
  )
  return { card, host }
}
```

`card(selection)` retains the native callable's inferred inputs and override types. The callable keeps its identity while its implementation changes after a host update. Bind once for the owning host lifecycle. Factories must be pure and return prepared callables. They run initially and once per changed snapshot.

Dynamic callables can use the same binding path. Prepare each required theme/scheme with `Native.compile` before application, then select the compiled callable in the factory. Scalar payloads remain application inputs. Animated values and opaque colors remain native `style` overrides.

A platform change requires another host and definitions compiled for that destination. CLI/Vite output still selects a fixed context per build. Host binding is explicit and does not rewrite existing application imports.

## Create

`Host.create(options)` requires every field below. The application resolves device preferences before construction.

| Input           | Type                 | Behavior                                                                      |
| --------------- | -------------------- | ----------------------------------------------------------------------------- |
| `platform`      | `'android' \| 'ios'` | Fixed compilation destination.                                                |
| `theme`         | `string`             | Nonempty compiled theme label. Binding factories validate catalog membership. |
| `colorScheme`   | `'dark' \| 'light'`  | Resolved appearance.                                                          |
| `density`       | `number`             | Positive finite physical pixels per logical unit.                             |
| `fontScale`     | `number`             | Positive finite system font scale.                                            |
| `highContrast`  | `boolean`            | Higher-contrast preference.                                                   |
| `reducedMotion` | `boolean`            | Reduced-motion preference.                                                    |
| `rtl`           | `boolean`            | Right-to-left layout input.                                                   |

Optional `capabilities` is a fixed map of boolean feature flags. Optional `preprocessors` is an instance-local property converter map. Both default to empty maps and are copied at construction. The capability copy is frozen. Functions and device-owned values are not frozen.

Optional `watch(update)` installs application-owned device listeners and returns their cleanup function. It may supply initial updates synchronously. The adapter owns cleanup if its setup throws before returning. Errors from adapter setup propagate to the caller.

```ts
import { Appearance } from 'react-native'
import type { Host } from 'zyzz/react-native'

export const watch: NonNullable<Host.create.Options['watch']> = (update) => {
  const subscription = Appearance.addChangeListener(({ colorScheme }) => {
    update({ colorScheme: colorScheme ?? 'light' })
  })
  return () => subscription.remove()
}
```

This adapter explicitly chooses light appearance when no device scheme exists. Other adapters can supply density, font scaling, accessibility, and layout changes through the same update callback.

## Snapshots and updates

`getSnapshot()` returns an immutable `Host.Snapshot`. Its identity stays stable until a changed input commits. A snapshot includes all inputs, fixed platform/capabilities, and `hairlineWidth`. The hairline follows the pinned React Native 0.87.0 rounding rule, including its zero-width fallback.

`update(patch)` accepts partial `Host.Inputs`. Platform and capabilities cannot change. Invalid fields, unresolved schemes, and nonpositive or nonfinite scales throw `Host.InputError`. Updates that cannot produce a finite positive hairline also fail. An unchanged patch does not rebind or notify.

An update prepares every binding before committing. If preparation throws, the previous snapshot and callables remain active. After commit, subscribers observe the new context and bindings. Subscriber errors are collected into an `AggregateError` after the other subscribers run. The committed state remains active.

Density, font scaling, and accessibility are available to binding factories and preprocessors. They do not implicitly rewrite compiled logical lengths, control animations, or apply font scaling a second time.

## Subscriptions and disposal

`subscribe(listener)` observes committed snapshots and returns an idempotent unsubscribe function. It does not invoke the listener initially. Subscribers added during notification start with the next update. Removed subscribers are skipped. Nested update, binding, or disposal attempts throw `Host.LifecycleError`.

A React adapter can use `useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot)` to rerender ordinary native components. The host itself has no React dependency or provider requirement.

`dispose()` removes subscribers and bindings, then runs device cleanup once. It is idempotent, including when cleanup throws. Bound calls, preprocessing, and further subscriptions or updates fail after disposal. The last snapshot remains readable. Queued device-adapter notifications are ignored after disposal. Caller-owned animations retain their application lifecycle.

## Preprocessing

`preprocess(style)` shallowly copies a plain style object and applies configured converters to matching own enumerable properties. Each converter receives the original value and one snapshot. Converted property types follow the converter's return type. Untouched nested values retain reference identity.

```ts
import { Host } from 'zyzz/react-native'

export function withHairlines(inputs: Host.create.Options) {
  return Host.create({
    ...inputs,
    preprocessors: {
      borderWidth: (_value, context) => context.hairlineWidth,
    },
  })
}
```

Call `host.preprocess({ borderWidth: 1 })` explicitly when applying the style. Processing does not register or replace React Native's global preprocessors. Existing device-owned preprocessors retain their registration lifetime. Caller-supplied converter errors propagate.

## Acceptance

[Host integration tests](../../../src/react-native/Host.test.ts) cover compiled theme/scheme and dynamic-callable switching, rollback, identity, preprocessing, density rounding, subscription ordering, and disposal. [Consumer types](../../../src/react-native/Host.test-d.ts) retain finite and dynamic inputs. Actual iOS/Android rendering and device preference delivery remain separate conformance gates.
