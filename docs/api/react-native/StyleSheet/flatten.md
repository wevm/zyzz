# StyleSheet.flatten

Flatten nested native style arrays using shallow, last-declaration-wins merging.

```ts
const style = StyleSheet.flatten([selected.card, [active && { opacity: 0.5 }]])
```

## Parameters

`styles` accepts a native object, nested arrays, or falsy entries. Falsy entries inside arrays are ignored. Enumerable inherited declarations are included, matching native flattening. Structured property values replace earlier values rather than deep-merging.

## Returns

A plain object input returns unchanged. An array returns a new object, including `{}` for an empty array. A falsy input returns `undefined`. The array overload returns a conservative partial property type because conditional entries can be absent.

Structured values retain their references and are not frozen. Existing native shorthand behavior remains native behavior. Compile shared declarations before composing their output with native objects.
