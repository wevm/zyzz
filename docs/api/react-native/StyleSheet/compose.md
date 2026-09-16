# StyleSheet.compose

Combine existing native styles without flattening or mutation. Both present operands produce an ordered array. A falsy operand returns the other operand unchanged.

```ts
const style = StyleSheet.compose(selected.card, active && { opacity: 0.5 })
```

## Parameters

`first` and `second` accept native objects, nested readonly arrays, `false`, `null`, `undefined`, or an empty string. Later declarations win when the native renderer or `flatten` consumes the result.

## Returns

A `StyleProp` retaining the operand property types. This helper composes already-native values. It does not convert CSS lengths or expand shorthands, compile variants, or implement the planned universal `cx` source transformation.
