# Animation bindings

Read Provider-selected variables and applied styles in Reanimated worklets. Import animation hooks from `zyzz/react-native/reanimated` and compile application modules with `zyzz/metro`.

This optional entrypoint requires Reanimated 4.5.3 or later within version 4, plus a compatible Worklets installation. Follow Reanimated's [installation guide](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/getting-started/) and [compatibility table](https://docs.swmansion.com/react-native-reanimated/docs/guides/compatibility/) before using the hooks. Other Zyzz entrypoints do not import Reanimated.

| API                                             | Result                                                 |
| ----------------------------------------------- | ------------------------------------------------------ |
| `useAnimatedVars(vars, selector?)`              | A shared value containing selected native variables.   |
| `useAnimatedStyleValue(appliedStyle, property)` | A shared value containing a numeric or color property. |

## useAnimatedVars

`useAnimatedVars(vars)` publishes the readonly native variable tree selected by the nearest Provider. Pass the `vars` helper returned by `defineConfig`, or a statically linked `Vars.define` definition. Native lengths become numbers and colors become strings, following [`useVars`](react.md#usevars).

```tsx
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { useAnimatedVars } from 'zyzz/react-native/reanimated'
import { vars } from './zyzz.config.js'

function Tile() {
  const background = useAnimatedVars(vars, (values) => values.color.background)
  const animated = useAnimatedStyle(() => ({
    backgroundColor: withTiming(background.get()),
  }))
  return <Animated.View style={animated} />
}
```

The optional selector runs on JavaScript and must be pure. Selections can contain finite numbers, strings, booleans, `null`, `undefined`, plain objects, and arrays. Functions, class instances, symbols, cycles, and nonfinite numbers throw. Reading an unsupported native field also throws. Use a selector to avoid reading unrelated unsupported fields.

Selected results use `Object.is` equality. Unchanged values avoid shared-value writes. A selector that allocates a new object produces a new selection. Replacing the selector or input updates the existing shared value after React commits.

## useAnimatedStyleValue

`useAnimatedStyleValue(appliedStyle, property)` resolves an applied native style using the nearest Provider, flattens style arrays in order, and publishes one finite numeric or color value. Pass the result's `.style` field. Variant selections, responsive alternatives, dynamic scalar inputs, and caller overrides are resolved before the property is read.

```tsx
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { useAnimatedStyleValue } from 'zyzz/react-native/reanimated'
import { button } from './styles.js'

function Button(props: Button.Props) {
  const color = useAnimatedStyleValue(
    button({ active: props.active }).style,
    'backgroundColor',
  )
  const animated = useAnimatedStyle(() => ({
    backgroundColor: withTiming(color.get()),
  }))
  return <Animated.View style={animated} />
}

namespace Button {
  export type Props = { readonly active: boolean }
}
```

Numeric properties return `SharedValue<number>`; color properties return `SharedValue<string>`. Missing properties, percentage or `auto` layout values, invalid colors, and nonfinite numbers throw. Structured properties such as `transform`, `filter`, and shadows do not have scalar bindings. A plain native style works without a Provider; compiled context-dependent bindings require one.

## Updates and ownership

Both hooks preserve shared-value identity across component renders. Provider scheme, variable-set, and viewport changes publish selected targets without requesting a React render of the hook consumer. Local state, parent updates, and other subscriptions can still render the component. Subscriptions are removed on unmount.

The hooks publish targets. Read those targets in `useAnimatedStyle` and choose transitions with `withTiming`, `withSpring`, or other Reanimated APIs. Keep the shared values owned by the hooks as inputs to your animations. Application code owns transition duration and reduced-motion preferences.

Combine ordinary `react-native` `StyleSheet` objects with the animated style. Reanimated owns those view props. To include compiled Zyzz styles in the same style array, use [`withStyles(Animated.View)`](react.md#withstyles). That wrapper resolves the compiled bindings through React and forwards Reanimated's style objects unchanged.

```tsx
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { withStyles } from 'zyzz/react-native'
import { panel } from './styles.js'

const AnimatedView = withStyles(Animated.View)

function Panel() {
  const animated = useAnimatedStyle(() => ({ opacity: 0.8 }))
  return <AnimatedView style={[panel().style, animated]} />
}
```
