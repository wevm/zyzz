# StyleSheet

Pure native table compilation and identity-preserving selection.

```ts
import { StyleSheet } from 'zyzz/react-native'
```

| API                   | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| [compile](compile.md) | Resolve shared declarations into static theme/scheme tables.   |
| [select](select.md)   | Return an existing style-name table without allocation.        |
| `Properties`          | Optional `satisfies` constraint for portable native authoring. |
| `NativeStyle`         | Readonly scalar native output properties.                      |
| `Tables`              | Immutable tables indexed by theme, scheme, and style name.     |
| `CompileError`        | Capability/conversion diagnostics with structured paths.       |
| `SelectionError`      | Unknown theme or scheme selection.                             |

Native interoperability also exports [compose](compose.md), [flatten](flatten.md), [absoluteFill](absoluteFill.md), and the recursive `StyleProp` type. These consume already-native values and retain caller-owned objects. Universal source application and native variants remain pending.

## Capabilities

| Area    | Supported subset                                                                                                                                                                                                                             |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout  | Aspect ratio, box sizing, direction, width/height and min/max sizes, physical offsets, explicit flex direction/grow/shrink/basis/wrap, alignment, flex/none/contents display, absolute/relative/static positioning, hidden/visible overflow. |
| Spacing | Physical margin/padding, one-to-four-value margin/padding shorthands, scalar gap/rowGap/columnGap.                                                                                                                                           |
| Borders | Physical widths/colors and corner radii, scalar borderWidth/borderColor/borderRadius expansion, solid/dotted/dashed style.                                                                                                                   |
| Colors  | Hex RGB/RGBA forms and the classic 16 CSS color names plus transparent. Scheme pairs resolve at compilation.                                                                                                                                 |
| Text    | Explicit font-family mappings, font size/style, numeric 100–900 weights or normal/bold, letter spacing, line height, left/right/center/start/end/justify alignment, decoration color/line/style, case conversion, and selection.             |
| Images  | objectFit and backface visibility.                                                                                                                                                                                                           |
| Scalars | Opacity in 0–1 and integer zIndex.                                                                                                                                                                                                           |

Decimal px/rem lengths convert to native logical units. Only zero is accepted as a unitless length. Dimensions, flex basis, and physical offsets also accept percentages. Width, height, and flex basis accept auto. Negative lengths are limited to margins, offsets, and letter spacing.

Authored shorthand order is preserved by expanding to physical longhands. No browser defaults or inherited font size are synthesized. Numeric CSS line height multiplies the explicit fontSize in the same style. Native text inheritance and layout defaults still belong to the consuming renderer.

Selectors, queries, logical properties, importance, fallback arrays, CSS functions, custom properties, web variable references, and dynamic bindings produce errors. The CSS `flex` shorthand is rejected because its native semantics differ. Use explicit flexGrow, flexShrink, and flexBasis.

The subset follows the documented [React Native layout](https://reactnative.dev/docs/layout-props), [text](https://reactnative.dev/docs/text-style-props), and [color](https://reactnative.dev/docs/colors) contracts. Broader platform-specific capabilities require separate acceptance.

## Authoring Types

```ts
const declarations = {
  card: { padding: '1rem', display: 'flex' } satisfies StyleSheet.Properties,
  label: { color: '#111', fontSize: '16px' } satisfies StyleSheet.Properties,
}
const styles = Style.define(declarations)
```

`Style.define` retains style names but erases property literals in its result. Apply `satisfies StyleSheet.Properties` before that boundary for native property/unit checks. `compile` checks capabilities at runtime for all inputs, including token values, conversion scales, and font mappings.

> [!NOTE]
> These contracts have pure compiler, package, and embedded-engine coverage. Native variants, dynamic adapters, and real iOS/Android rendering remain separate implementation and acceptance work.

Aspect ratios accept positive numbers, decimal strings, or a positive `width / height` ratio and emit a native number. Automatic intrinsic ratios are rejected. These additions retain explicit native version requirements and do not establish renderer parity.
