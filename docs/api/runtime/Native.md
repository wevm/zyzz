# Native runtime

`Native` from `zyzz/runtime` applies compiler-owned native tables without importing parsers, React Native, or device APIs.

- `create({ axes, defaults, styles })` returns a callable selecting one finite native style. Supply a theme/scheme table from `StyleSheet.select(compiled.styles, context)`. Omitted and undefined inputs use defaults; null suppresses them. The callable accepts a native `style` override after the selected object.
- `compose(...props)` returns native style props in argument order. Falsy entries are ignored. A single entry preserves its style reference. Nested arrays and structured override values remain caller-owned.
- `Callable<Axes, Style>` and `Props<Style>` preserve selected table types and caller-owned overrides. Undeclared axes, choices, missing table entries, and web props raise `Native.SelectionError`.

`create` freezes compiler-owned style objects at initialization. Application only selects existing data and allocates props or composition arrays. It does not mutate or freeze override values.

## Host-owned values

Native `style` overrides accept the caller's object types, including `Animated.Value`, interpolation nodes, and opaque colors. The destination React Native component validates its style contract. `create` retains the inferred table values, and `compose` retains the union of each input style type.

```ts
import { Animated, PlatformColor } from 'react-native'
import { Native } from 'zyzz/runtime'

const card = Native.create({
  axes: {},
  defaults: {},
  styles: { 0: { padding: 8 } },
})
const opacity = new Animated.Value(0.5)
const props = card({
  style: { opacity, backgroundColor: PlatformColor('labelColor') },
})
```

Apply these props to `Animated.View`. Calls preserve override references, nested arrays, and falsy entries. Composition preserves order for React Native's shallow override semantics. Replacing an override affects the new application only. Mutation and animation subscription lifetimes remain application-owned.

Host-owned objects enter through `style`, including on `NativeDynamic` callables. Portable callback payloads remain scalar strings and numbers. Static authoring and packed metadata still reject host objects. The compiler neither serializes those objects nor registers native preprocessors.
