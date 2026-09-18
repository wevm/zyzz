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
| `NativeStyle`         | Readonly static native property output.                        |
| `Tables`              | Immutable tables indexed by theme, scheme, and style name.     |
| `CompileError`        | Capability/conversion diagnostics with structured paths.       |
| `SelectionError`      | Unknown theme or scheme selection.                             |

Native interoperability also exports [compose](compose.md), [flatten](flatten.md), [absoluteFill](absoluteFill.md), and the recursive `StyleProp` type. These consume already-native values and retain caller-owned objects. Universal source application and native variants remain pending.

## Capabilities

| Area    | Supported subset                                                                                                                                                                                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout  | Aspect ratio, box sizing, direction, width/height and min/max sizes, physical offsets, explicit flex direction/grow/shrink/basis/wrap, alignment, flex/none/contents display, absolute/relative/static positioning, hidden/visible overflow.                      |
| Spacing | Physical margin/padding, one-to-four-value margin/padding shorthands, scalar gap/rowGap/columnGap.                                                                                                                                                                |
| Borders | Physical widths/colors and corner radii, scalar borderWidth/borderColor/borderRadius expansion, solid/dotted/dashed style.                                                                                                                                        |
| Colors  | CSS named colors, hex RGB/RGBA, and absolute rgb/hsl/hwb functions. Functional colors normalize to RGBA hex.                                                                                                                                                      |
| Text    | Explicit font-family mappings, font size/style, numeric 100–900 weights or normal/bold, native-compatible font variants, letter spacing, line height, left/right/center/start/end/justify alignment, decoration color/line/style, case conversion, and selection. |
| Images  | objectFit and backface visibility.                                                                                                                                                                                                                                |
| Scalars | Opacity in 0–1 and integer zIndex.                                                                                                                                                                                                                                |

Decimal px/rem lengths convert to native logical units. Only zero is accepted as a unitless length. Dimensions, flex basis, and physical offsets also accept percentages. Width, height, and flex basis accept auto. Negative lengths are limited to margins, offsets, and letter spacing.

Authored shorthand order is preserved by expanding to physical longhands. No browser defaults or inherited font size are synthesized. Numeric CSS line height multiplies the explicit fontSize in the same style. Native text inheritance and layout defaults still belong to the consuming renderer.

Selectors, queries, logical properties, importance, fallback arrays, unresolved CSS expressions, custom properties, web variable references, and dynamic bindings produce errors. The CSS `flex` shorthand is rejected because its native semantics differ. Use explicit flexGrow, flexShrink, and flexBasis.

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
> These contracts have pure compiler, package, and embedded-engine coverage. Native variants and explicit host adapters are implemented. Real iOS/Android rendering remains a separate acceptance gate.

Aspect ratios accept positive numbers or a positive `width / height` ratio and emit a native number. Automatic intrinsic ratios are rejected. These additions retain explicit native version requirements and do not establish renderer parity.

Bare numeric strings and `userSelect: contain` are outside shared portable authoring. The equivalent `line-through underline` decoration spelling normalizes to native `underline line-through`.

### Transforms

Static `transform` lists compile into deeply frozen, ordered native transform objects. Supported functions are `translate`, `translateX/Y`, `scale`, `scaleX/Y`, `rotate`, `rotateX/Y/Z`, `skewX/Y`, and `perspective`. `none` emits an empty list. Duplicate functions retain their order.

Translation accepts signed px/rem lengths and percentages. Scale accepts finite numbers. Angles accept deg/rad and convert grad/turn to degrees. Nonnegative perspective lengths use the configured unit conversion and CSS's minimum one-pixel distance. Matrices accept six (`matrix`) or sixteen (`matrix3d`) finite numbers. Translation and projective terms use the explicit pixel scale. Other unsupported functions, calculations, and malformed arguments produce diagnostics.

Mixed transform lists that contain a matrix compile to one composed native matrix. Percentage translations in those lists require layout information and produce a diagnostic. Native matrix arrays require nine or sixteen numbers.

The same definition remains valid for web CSS. Native arrays belong in explicit target branches. Animated values and real device rendering remain separate work. Output follows the pinned [React Native transform contract](https://reactnative.dev/docs/0.87/transforms).

### Transform Origins

`transformOrigin` accepts one, two, or three shared CSS values. Horizontal/vertical keywords, signed px/rem lengths, and percentages resolve to an `[x, y, z]` tuple. Missing axes use CSS defaults. The third value must be a length. Calculations and edge-offset syntax remain unsupported.

Compiler-owned tuples are frozen. Their type matches React Native's three-element tuple declaration for direct component assignment. Tuples avoid the [pinned string parser's](https://github.com/facebook/react-native/blob/4bc2473f5d0233ea5384c1ef24f6a55615de2220/packages/react-native/Libraries/StyleSheet/processTransformOrigin.js) loss of signed decimal offsets. This conversion does not establish device rendering parity.

```ts
const styles = Style.define({ card: { transformOrigin: '-1.25rem 25% -2px' } })
const output = StyleSheet.compile({ styles, units: { rem: 16 } })
// output.styles.default.light.card.transformOrigin is [-20, '25%', -2].
```

## Target Branches

`Style.define`, root `style`, and config-bound `style` accept `targets.web`, `targets.native`, `targets.ios`, and `targets.android`. Shared declarations retain CSS semantics. Native branches use the pinned React Native static property domains, including structured transforms, filters, shadows, font variants, and experimental properties.

```ts
const styles = Style.define({
  label: {
    fontSize: '16px',
    targets: {
      web: { display: 'grid' },
      native: { lineHeight: 24, fontVariant: ['tabular-nums'] },
      ios: { fontFamily: 'System' },
      android: { includeFontPadding: false },
    },
  },
})
const output = StyleSheet.compile({ styles, platform: 'ios' })
```

Native compilation applies shared declarations, then `native`, then the selected platform. Platform branches require an explicit `platform`. Native properties replace previous properties shallowly, including complete transform/filter/shadow arrays. Native shorthand properties retain React Native precedence against existing longhands. Prefer matching longhands when overriding shared shorthand expansions.

Native numbers are logical units, including absolute `lineHeight`. Native strings and arrays are destination values without CSS unit conversion or font mapping. A shared numeric line height multiplies the final font size unless a native branch overrides line height.

The static projection covers all 157 distinct native properties across the legacy and published declarations. Published domains include numeric/null colors, combined translations, and exact origin tuples. It excludes animated and opaque host objects without removing them from the full inventory. Compilation validates native branches against generated domains, copies and freezes compiler-owned data, and rejects accessors, sparse arrays, functions, and non-plain objects.

Web compilation applies `web` after shared declarations and excludes native/platform branches. Web branches retain selectors, queries, tokens, and CSS value validation. Target branches cannot contain another target container. Native compilation still diagnoses unsupported shared declarations even when a target branch replaces the corresponding property.

Source imports must resolve to immutable literal data. Re-exports and packed style contracts preserve target data. Contract version 20 prevents older readers from silently dropping branches. This metadata support does not implement native callable application or establish platform availability and rendered behavior.

### Shadows and Fonts

Shared `boxShadow` lists convert px/rem offsets, blur radii, and spreads into native shadow objects. Shared `textShadow` converts one shadow into native offset, radius, and color fields. Both require an explicit absolute color. Negative blur, text-shadow spreads/inset, multiple text shadows, and unresolved expressions produce diagnostics. `none` clears shadows.

Shared font families still require explicit installed-family mappings. `fontVariant` converts supported CSS keywords to a native array, and `normal` resets that array. Native target branches retain destination family names, weight aliases, font-variant strings/arrays, font padding, and platform-specific text fields without CSS conversion.

`Style.define` retains inferred overflow domains through `compile` and `select`, including platform overrides. This preserves Image compatibility, whose published overflow type excludes `scroll`. Annotating definitions as a broad `Style.Definition` discards that per-style inference.
