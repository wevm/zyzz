# React integration

Select compiled native styles and readonly variable values through `Provider`. Import the React adapter from `zyzz/react-native/react` and compile application modules with `zyzz/metro`.

| API                        | Purpose                                                         |
| -------------------------- | --------------------------------------------------------------- |
| `Provider`                 | Select a variable name and resolved color scheme for a subtree. |
| `useStyles()`              | Resolve compiled bindings for explicit style consumers.         |
| `useVars(vars, selector?)` | Read native values from the nearest Provider.                   |

Connect React Native appearance once above the application:

```tsx
import { useColorScheme } from 'react-native'
import { Provider } from 'zyzz/react-native/react'

export function Root() {
  const system = useColorScheme()
  return (
    <Provider colorScheme={system === 'dark' ? 'dark' : 'light'}>
      <App />
    </Provider>
  )
}
```

## Provider

`Provider` accepts `children`, a resolved `colorScheme`, and an optional `vars` name. Nested providers and separate React roots have independent selections. Application state supplies scheme and variable overrides. React Native's `useColorScheme` owns the device subscription.

### colorScheme

Type: `'dark' | 'light'`. Required. Resolve an absent device preference to an application fallback before passing the value.

### vars

Type: `string | undefined`. Omission uses each configuration's `defaultVars`. A single unnamed definition keeps its fixed values inside a named Provider. An unknown name in a named catalog fails when its styles or variables are read.

```tsx
<Provider colorScheme="dark" vars="blue">
  <App />
</Provider>
```

The former `set` prop was renamed to `vars`. Passing `set`, an unresolved scheme, or an empty variable name throws.

## useVars

`useVars(vars)` returns a readonly tree of native values selected by the nearest Provider. The argument is the `vars` helper from `Config.create`, or a standalone `Vars.define` definition. Catalog names and color scheme pairs resolve through the same Provider selection as compiled styles.

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
const typography = useVars(vars, (values) => values.typography.body)
```

Selected results use `Object.is` equality. Equal compiled branches retain their identity across profiles, so selecting a branch can skip unchanged subscription updates. A selector that allocates a new object produces a different result on each selection change. Parent, local state, and other hook updates can still render the component.

The equivalent Unistyles theme read is:

```tsx
import { useUnistyles } from 'react-native-unistyles'

const { theme } = useUnistyles()
const background = theme.color.background.primary
```

Unistyles registers themes globally. Zyzz receives the existing variable definition and selects values from the nearest Provider.

## Style applications

Keep application code unchanged at the style boundary:

```tsx
import { Text } from 'react-native'
import { Config } from 'zyzz'

const { style } = Config.create({
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

The React adapter is a separate optional entrypoint requiring React 19. The pure `Host`, `StyleSheet`, and `Variants` APIs remain available from `zyzz/react-native` without importing React or React Native.
