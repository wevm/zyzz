# React Native

Compile shared definitions and select native theme tables. Begin with [Getting Started](../introduction/getting-started.md) to connect compilation.

## Recipes

### Native Styles

Compile shared definitions into native tables, then select a theme and color scheme before rendering.

```ts
import { Style, Vars } from 'zyzz'
import { StyleSheet } from 'zyzz/react-native'

const theme = Vars.define({ color: { text: { dark: '#eee', light: '#111' } } })
const styles = Style.define({ text: { color: theme.color.text } })
const output = StyleSheet.compile({ styles, vars: { base: theme } })
const selected = StyleSheet.select(output.styles, {
  colorScheme: 'dark',
  set: 'base',
})
```

Use `selected.text` as the native text style. Compilation belongs outside render; selection is a table lookup. Device preference handling belongs to the application adapter. Web layers, globals, and DOM relationships are rejected.
