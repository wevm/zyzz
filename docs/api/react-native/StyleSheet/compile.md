# StyleSheet.compile

> [!NOTE]
> Preview API; not yet implemented.

Compile shared definitions into static native tables.

```ts
import { Style, Theme } from 'zyzz'
import { StyleSheet } from 'zyzz/react-native'

const theme = Theme.define({ color: { text: '#111' } })
const styles = Style.define({ text: { color: theme.tokens.color.text } })
const output = StyleSheet.compile({ styles, themes: { base: theme } })
```

## Signature

`StyleSheet.compile(options)`

## Parameters

- `styles`: shared definitions.
- `themes`: named compatible definitions.
- Unit and font conversion options must be explicit when required; their full shape remains a design gate.

## Returns

`{ styles }`: tables indexed by theme label, scheme, and style name.

## Errors

`StyleSheet.CompileError` for unsupported properties, units, or web semantics.

See [StyleSheet](README.md) for related methods and types.
