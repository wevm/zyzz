# React integration

Use shared `Config.create`, `style`, `variants`, and token authoring with `zyzz/metro`. The compiler retains the configured themes and both color schemes. Theme selection happens during rendering, without recompilation or manual `Host.bind` calls.

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

`Provider` accepts a resolved `colorScheme` (`light` or `dark`), an optional `set` name, and `children`. Omit `set` to use each configuration's default. Supply application state for explicit scheme or theme overrides. Return to the device value to resume system appearance. Unknown names in a themed definition fail during selection.

The provider uses React context. Nested providers and separate roots are isolated. Compiled function components subscribe unconditionally, including memoized components, and preserve component state when selection changes. No process-wide theme state or device listener is installed by Zyzz; React Native's `useColorScheme` owns the appearance subscription.

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
const label = style({ color: 'ink' })

function Label() {
  return <Text {...label()}>Hello</Text>
}
```

Metro's Babel pass resolves native bindings in JSX `style` expressions and prop spreads. Arrays, scalar payloads, variant choices, and native style callbacks retain their application inputs. Applied props can be declared outside rendering; selection remains local to the consuming render.

This automatic path supports function components and custom hooks that render JSX, including `memo` and `forwardRef` declarations. Class render methods and JSX outside a component are rejected. `React.createElement`, imperative native APIs, and third-party consumers that inspect style objects outside compiled JSX need explicit resolution through `useStyles().style(value)` or `useStyles().props(props)` in a function component.

The React adapter is a separate optional entrypoint requiring React 19. The pure `Host`, `StyleSheet`, and `Variants` APIs remain available from `zyzz/react-native` without importing React or React Native.
