# Literal Values

`Style.define` validates plain data and returns deeply frozen, ordered definitions. It does not emit CSS or create component props. This is the input boundary for target compilation.

```ts
import { Style } from 'zyzz'

const styles = Style.define({
  card: { display: 'flex', padding: '1rem', paddingLeft: 0 },
})

styles.styles[0]?.name // 'card'
styles.styles[0]?.declarations
// [{ property: 'display', value: 'flex' }, ...]
```

## Literal Subset

The property surface is intentionally finite. No catch-all string index permits misspelled properties. The exact enum members and property list live together in `src/internal/Literal.ts`; the public `Style.Properties` type derives from that list.

| Group      | Supported Properties                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout     | `display`, `position`, `boxSizing`, `flexDirection`, `flexWrap`, `alignItems`, `justifyContent`, `gap`, `rowGap`, `columnGap`, `flexGrow`, `flexShrink` |
| Spacing    | `padding`, `margin`, and their physical top/right/bottom/left longhands                                                                                 |
| Sizing     | `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`                                                                                     |
| Colors     | `color`, `backgroundColor`, `borderColor`                                                                                                               |
| Borders    | `borderWidth`, `borderStyle`, `borderRadius`                                                                                                            |
| Typography | `fontSize`, `fontWeight`, `fontStyle`, `lineHeight`, `textAlign`                                                                                        |
| Other      | `opacity`                                                                                                                                               |

- **Lengths:** finite `px`, `rem`, `em`, `vh`, `vw`, `%`, or numeric zero. Border width excludes percentages.
- **Margins:** allow negative lengths. Margins and width/height also accept `auto`.
- **Shorthands:** scalar values only; no multi-value strings yet.
- **Units:** preserve spelling without implicit pixel conversion.

- **Colors:** 3/4/6/8-digit hex, `transparent`, `currentColor`, `black`, or `white`.
- **CSS-wide values:** every property accepts `inherit`, `initial`, `revert`, `revert-layer`, and `unset`.
- **Numbers:** finite values only; opacity 0–1, font weight 1–1000, line height/flex factors nonnegative.

Types check units and token names; runtime validation checks numeric bounds and hex digits.

This boundary rejects:

- Arbitrary variable objects and explicit `undefined`.
- Callbacks, selectors, and queries.
- CSS functions and nested fallback arrays.
- Unsupported properties and other named colors.

## Fallbacks and Importance

```ts
Style.define({
  card: {
    display: ['block', 'flex'],
    color: ['#000!', '#fff'],
    opacity: '0.5 !important',
  },
})
```

Nonempty arrays emit repeated declarations in authored order. Each entry is independently validated and may use a trailing `!` or `!important`. Normal entries cannot override important entries; later important entries win. Token names resolve after suffix parsing, and explicit token references remain valid fallback entries.

Token keys cannot contain `!`, including nested palette keys. This reserves importance syntax and prevents a shorthand such as `md!` from naming both a token and an important `md` declaration. `Theme.define` and inline Config themes reject these keys in types and runtime validation.

Importance is stored separately on `Style.Declaration.important`. Numeric importance uses a string, such as `'0.5!'` or `'0!'`. Empty, sparse, nested, accessor-backed, and invalid arrays fail before emission. Quoted or escaped exclamation marks are not suffixes; unsupported string-content syntax still fails scalar validation.

## Ordering and Ownership

Definitions preserve JavaScript own enumerable string-key order, including its integer-key ordering. Property order preserves shorthand/longhand precedence for later emitters; validation never sorts declarations. Fallback entries expand in place and importance is separated from each scalar value. Empty maps and empty styles are valid; empty style names are not.

Plain and null-prototype objects are accepted. Accessors, symbols, non-enumerable properties, array-shaped style objects, and class instances are rejected. Input must be ordinary data, not proxies. Values are copied into frozen style, declaration, and array objects. Subsequent changes to input cannot change the result.

## Diagnostics

`Style.InvalidError` aggregates errors in traversal order. Each diagnostic has a stable code, component path array, and message. Codes are `invalid_structure`, `unsupported_property`, and `invalid_value`. Paths remain unambiguous when names contain dots.

`Style.define(input, { locations })` can attach caller-owned `{ path, source, start, end }` spans to errors at exactly matching paths. Source offsets are metadata supplied by a caller; this API does not parse source text. Locations are copied so input mutations do not alter emitted diagnostics.

The root imports pure local style and theme modules without target emitters, parsers, filesystem calls, or framework imports. Validated theme references extend literal declarations through the [in-memory theme contract](../../../guides/themes.md#compile-themes); arbitrary objects are not accepted as tokens.

Numeric style keys are returned and inferred as strings, matching JavaScript property enumeration. Plain data from other realms is accepted; class instances and accessor properties remain invalid. Every branch of a union-typed style must contain only supported properties.

## Web Compilation

```ts
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

const styles = Style.define({
  card: { padding: '1rem', paddingLeft: 0 },
})
const { classes, css, themes } = Css.compile({ styles })
// Write css to a stylesheet; apply classes.card to the element.
// themes is empty at the literal boundary.
```

Compilation is pure. Sharing follows property overlap:

- **Independent properties:** each forms its own domain.
- **Overlapping properties:** padding, margin, and gap group with their supported longhands.
- **Shared domains:** every participating style must have identical ordered declarations.

Conflicting domains retain distinct rules, including repeated A/B/A overrides.

CamelCase properties become kebab-case; units remain unchanged and numeric values stay unitless. Empty styles return an empty class list and no rule. The result and maps are frozen. Only the web entrypoint imports the compiler.

Each class-map value is a space-separated list:

- **Common declarations:** use sequential identifiers such as `z_base0` in ordered mode.
- **Conflicting bodies:** use encoded authored style names, such as `z-card`.
- **Identifiers:** punctuation encoding is injective; collisions fail explicitly.

No global registry or runtime helper is emitted.

Treat generated identifiers as opaque. Always consume the returned class map and distribute it with its matching stylesheet; do not derive class names from properties or values.

- **Adding or removing styles:** can change factoring and class lists.
- **Identical input:** produces identical output regardless of machine paths or clocks.
- **Reordering styles:** preserves class lists but changes cascade order.

`Css.CompileError` aggregates invalid declarations and empty or duplicate names without returning partial CSS. Pass ordered `Style.define` data to the compiler.

See [In-Memory Themes](../../../guides/themes.md#compile-themes) for token compilation. Nested conditions, callbacks, and source parsing are outside this API. Declaration and rule order control CSS precedence; class-attribute order does not.
