# StyleSheet.select

> [!NOTE]
> Preview API; not yet implemented.

Select a precompiled native theme and scheme.

```ts
import { StyleSheet } from 'zyzz/react-native'

const selected = StyleSheet.select(output.styles, {
  colorScheme: 'dark',
  theme: 'base',
})
```

## Signature

`StyleSheet.select(styles, options)`

## Parameters

- `styles`: table from `StyleSheet.compile`.
- `options.colorScheme`: `dark` or `light`.
- `options.theme`: inferred table label.

## Returns

The existing style-name table; selection does not compile or clone styles.

## Errors

`StyleSheet.SelectionError` for invalid untyped selections.

The example continues from [compile](compile.md). Device preferences belong to the application adapter.

See [StyleSheet](README.md) for related methods and types.
