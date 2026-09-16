# StyleSheet.compile

Resolve shared definitions into deeply frozen native tables, indexed by theme label, color scheme, and style name.

```ts
import { Style, Theme } from 'zyzz'
import { StyleSheet } from 'zyzz/react-native'

const theme = Theme.define({ color: { text: { light: '#111', dark: '#fff' } } })
const styles = Style.define({ text: { color: theme.tokens.color.text } })
const output = StyleSheet.compile({ styles, themes: { base: theme } })
```

## Parameters

### options.styles

Type: `Style.Definition`. Required.

Immutable shared definitions, also accepted by `Css.compile`. Unsupported native semantics fail compilation.

```ts
StyleSheet.compile({ styles })
```

### options.themes

Type: `Readonly<Record<string, Theme.Definition>>`. Optional.

Explicit output labels. Omitting themes creates a `default` table using each token's own fallback. An empty theme map is invalid. Compatible `Theme.extend` and normalized config handles replace token values. Unrelated contracts keep their own fallbacks, even when token paths have matching names.

```ts
StyleSheet.compile({
  styles,
  themes: { base: theme, alternate: Theme.extend(theme, {}) },
})
```

### options.units

Type: `{ px?: number; rem?: number }`. Optional.

Positive finite native logical-unit scales. `px` defaults to `1`. `rem` has no default and must be supplied when used. No pixel ratio, viewport, or root font size is read.

```ts
StyleSheet.compile({ styles, units: { px: 1, rem: 16 } })
```

### options.fonts

Type: `Readonly<Record<string, string>>`. Optional.

Map exact authored font-family text to installed native family names. Every authored font family requires an explicit mapping. The compiler does not load fonts or choose a platform fallback.

```ts
StyleSheet.compile({ styles, fonts: { 'Inter, sans-serif': 'Inter-Regular' } })
```

## Returns

### styles

Type: `StyleSheet.Tables`. Includes both `light` and `dark` for every label.

Tables and style objects are frozen. Identical resolved styles share one object within a compilation. Growth is linear in supplied styles and themes, with two explicit schemes. Selection never compiles or clones the result.

```ts
output.styles.base.dark.text
```

## Errors

`StyleSheet.CompileError` contains immutable `diagnostics` with `code`, `message`, and `path`. Conversion paths identify theme, scheme, style, and property. Invalid options and unsupported definition features fail before table emission.

See [capabilities](README.md#capabilities) and [selection](select.md).
