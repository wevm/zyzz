# StyleSheet.select

Select a precompiled native theme and scheme.

```ts
import { StyleSheet } from 'zyzz/react-native'

const selected = StyleSheet.select(output.styles, {
  colorScheme: 'dark',
  theme: 'base',
})
```

Preview API; not yet implemented.

## Signature

`StyleSheet.select(styles, options)`

## Parameters

### styles

- Type: Table returned by `StyleSheet.compile`
- Required: Yes.

Precompiled native styles.

```ts
StyleSheet.select(output.styles, { colorScheme: 'dark', theme: 'base' })
```

### options.colorScheme

- Type: `'dark' | 'light'`
- Required: Yes.

Color scheme chosen by the application adapter.

```ts
StyleSheet.select(output.styles, { colorScheme: 'dark', theme: 'base' })
```

### options.theme

- Type: Inferred table label
- Required: Yes.

Selects a precompiled theme.

```ts
StyleSheet.select(output.styles, { colorScheme: 'light', theme: 'base' })
```

## Returns

### [name]

- Type: Native style object

Existing style-name table entry. Selection does not compile or clone styles.

```ts
selected.text
```

## Errors

`StyleSheet.SelectionError` for invalid untyped selections.

The example continues from [compile](compile.md). Device preferences belong to the application adapter.

See [StyleSheet](README.md) for related methods and types.
