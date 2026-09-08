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

### options.styles

- Type: `Style.Definition`
- Required: Yes.

Shared validated style definitions.

```ts
StyleSheet.compile({ styles, themes: { base: theme } })
```

### options.themes

- Type: Named theme definitions
- Default: Not yet specified by the preview contract.

Theme labels used by the compiled tables. Required unit/font conversion options remain a design gate.

```ts
StyleSheet.compile({ styles, themes: { base: theme } })
```

## Returns

### styles

- Type: Native tables indexed by theme, scheme, and style name

Precompiled data for selection outside the compiler.

```ts
StyleSheet.select(output.styles, { colorScheme: 'dark', theme: 'base' })
```

## Errors

`StyleSheet.CompileError` for unsupported properties, units, or web semantics.

See [StyleSheet](README.md) for related methods and types.
