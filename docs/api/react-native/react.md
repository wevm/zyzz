# React integration

Select compiled native styles and readonly variable values through the `Provider` returned by `defineConfig`. Import native authoring and hooks from `zyzz/react-native` and compile application modules with `zyzz/metro`.

| API                        | Purpose                                                          |
| -------------------------- | ---------------------------------------------------------------- |
| `defineConfig(options)`    | Return existing authoring helpers and a typed `Provider`.        |
| `Provider`                 | Select configured variables and a resolved scheme for a subtree. |
| `useStyles()`              | Resolve compiled bindings for explicit style consumers.          |
| `useVars(vars, selector?)` | Read native values from the nearest Provider.                    |

Export the native configuration's helpers:

```ts
import { defineConfig } from 'zyzz/react-native/react'

export const { Provider, style, variants, vars } = defineConfig({
  defaultVars: 'base',
  vars: {
    base: {
      color: {
        background: { primary: { light: '#fff', dark: '#111' } },
        ink: { light: '#111', dark: '#eee' },
      },
    },
    alternate: {
      color: {
        background: { primary: { light: '#fff7f7', dark: '#311' } },
        ink: { light: '#900', dark: '#fcc' },
      },
    },
  },
})
```

Connect React Native appearance above the application:

```tsx
import { useColorScheme } from 'react-native'
import { Provider } from './zyzz.config.js'

export function Root() {
  const system = useColorScheme()
  return (
    <Provider colorScheme={system === 'dark' ? 'dark' : 'light'}>
      <App />
    </Provider>
  )
}
```

## defineConfig

The native `defineConfig` accepts the same [configuration options](../core/Config/create.md) as shared `defineConfig` from `zyzz`. It returns the same `style`, `variants`, and `vars` helpers, plus a `Provider` whose variable names are inferred from the configuration. Define configurations at module scope.

Native configuration modules require a native compilation target, including when publishing packed packages. `zyzz/metro` supplies this target and enables Provider selection. Explicit graph builds supply `Graph.compile({ native: { contextual: true, colorScheme: 'light', platform: 'ios' }, modules })`. Shared configuration from `zyzz` remains independent of React and usable across targets.

## Provider

`Provider` accepts `children`, a resolved `colorScheme`, and an optional `vars` name. Nested providers and separate React roots have independent selections. Application state supplies scheme and variable overrides. React Native's `useColorScheme` owns the device subscription.

### children

Type: `React.ReactNode`. Optional. Descendants consume the nearest Provider's selection.

### colorScheme

Type: `'dark' | 'light'`. Required. Resolve an absent device preference to an application fallback before passing the value.

### vars

Type: the configuration's catalog keys, or `undefined`. The example configuration accepts `'base' | 'alternate'`. Omission uses that configuration's `defaultVars`. A configuration with one unnamed definition accepts omission only. A single unnamed definition keeps its fixed values inside another config's named Provider.

```tsx
<Provider colorScheme="dark" vars="alternate">
  <App />
</Provider>
```

Unknown names fail in TypeScript and throw when the config-returned Provider mounts, even without a style or variable consumer. The former `set` prop was renamed to `vars`. Passing `set` or an unresolved scheme also throws.

## useVars

`useVars(vars)` returns a readonly tree of native values selected by the nearest Provider. The argument is the `vars` helper from `defineConfig`, or a standalone `Vars.define` definition. Catalog names and color scheme pairs resolve through the same Provider selection as compiled styles.

```tsx
import { useVars } from 'zyzz/react-native/react'
import { vars } from './zyzz.config.js'

export function useSheetOptions() {
  const background = useVars(vars, (values) => values.color.background.primary)
  return { contentStyle: { backgroundColor: background } }
}
```

### vars argument

Pass a statically linked definition directly. Named imports, re-exports, packed packages, aliased hook imports, and namespace hook imports are supported. The native compiler converts the values ahead of time. Uncompiled definitions and calls without a Provider throw.

The returned paths follow the authored variable tree. Native lengths are numbers in logical units, colors are native color strings, and font families use the compiler's `fonts` mapping. Numeric typography line heights become absolute lengths by multiplying the corresponding font size. Font assets still require application registration.

Web-only conditions and unsupported conversions throw when the affected field is read. Other native fields remain readable. Spreading or serializing a branch reads every field in that branch and can trigger the same error.

### selector

Type: `(values) => selected`. Optional. The result retains its inferred type. Without a selector, the hook returns the complete value tree.

```tsx
const values = useVars(vars)
const background = useVars(vars, (values) => values.color.background)
```

Selected results use `Object.is` equality. Equal compiled branches retain their identity across profiles, so selecting a branch can skip unchanged subscription updates. A selector that allocates a new object produces a different result on each selection change. Parent, local state, and other hook updates can still render the component.

## Style applications

Keep application code unchanged at the style boundary:

```tsx
import { Text } from 'react-native'
import { defineConfig } from 'zyzz/react-native/react'

const { style } = defineConfig({
  vars: {
    base: { color: { ink: { light: '#111', dark: '#eee' } } },
    alternate: { color: { ink: { light: '#900', dark: '#fcc' } } },
  },
  defaultVars: 'base',
})

function Label() {
  return <Text {...styles.label()}>Hello</Text>
}

namespace styles {
  export const label = style({ color: 'ink' })
}
```

Metro's Babel pass resolves native bindings in JSX `style` expressions and prop spreads. Arrays, scalar payloads, variant choices, and native style callbacks retain their application inputs. Applied props can be declared outside rendering; selection remains local to the consuming render.

This automatic path supports function components and custom hooks that render JSX, including `memo` and `forwardRef` declarations. Class render methods and JSX outside a component are rejected. Components preserve their state when selection changes.

## useStyles

`useStyles()` returns `style(value)` and `props(props)` resolvers for `React.createElement`, imperative native APIs, and third-party consumers that inspect style objects outside compiled JSX. Call the hook inside a function component and resolve bindings before handing values to those consumers.

```tsx
const current = useStyles()
const selected = current.style(styles.label().style)
```

`zyzz/react-native` requires React 19. It does not import React Native or subscribe to device state. The existing `zyzz/react-native/react` entrypoint remains available for `useStyles`, `useVars`, and the standalone `Provider`. That Provider accepts a generic string name and uses each consumed configuration's default when `vars` is omitted.
