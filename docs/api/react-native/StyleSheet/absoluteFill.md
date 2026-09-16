# StyleSheet.absoluteFill

A frozen native overlay style with absolute positioning and zero top, right, bottom, and left offsets.

```ts
const style = StyleSheet.compose(StyleSheet.absoluteFill, { top: 12 })
```

The constant is independent of device state. Later styles can override offsets through composition. Device-dependent `hairlineWidth` remains part of the native host-adapter work.
