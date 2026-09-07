# Literal Style Definitions

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

Lengths accept finite CSS numbers followed by `px`, `rem`, `em`, `vh`, `vw`, or `%`, plus numeric zero. Border width excludes percentages. Only margins accept negative lengths. Margins and width/height accept `auto`. Scalar spacing/border shorthands are supported; multi-value shorthand strings are not yet supported. Units and spelling are preserved; no implicit pixel conversion occurs.

Colors accept 3/4/6/8-digit hex, `transparent`, `currentColor`, `black`, and `white`. Other named colors and functional colors are outside this initial subset. Unitless numbers must be finite: opacity is 0–1, font weight 1–1000, and line height/flex factors are nonnegative. Every property accepts CSS-wide `inherit`, `initial`, `revert`, `revert-layer`, and `unset`.

Template types reject unsupported units and token names but cannot prove numeric bounds or hex digits; runtime validation enforces those constraints. Explicit `undefined`, callbacks, selectors, queries, themes, variables, importance suffixes, fallback arrays, CSS functions, and unsupported properties fail at this boundary. Later authoring phases expand the contract explicitly.

## Ordering and Ownership

Definitions preserve JavaScript own enumerable string-key order, including its integer-key ordering. Property order preserves shorthand/longhand precedence for later emitters; validation never sorts or normalizes declarations. Empty maps and empty styles are valid; empty style names are not.

Plain and null-prototype objects are accepted. Accessors, symbols, non-enumerable properties, arrays, and class instances are rejected. Input must be ordinary data, not proxies. Values are copied into frozen style, declaration, and array objects. Subsequent changes to input cannot change the result.

## Diagnostics

`Style.InvalidError` aggregates errors in traversal order. Each diagnostic has a stable code, component path array, and message. Codes are `invalid_structure`, `unsupported_property`, and `invalid_value`. Paths remain unambiguous when names contain dots.

`Style.define(input, { locations })` can attach caller-owned `{ path, source, start, end }` spans to errors at exactly matching paths. Source offsets are metadata supplied by a caller; this API does not parse source text. Locations are copied so input mutations do not alter emitted diagnostics.

The root imports only pure local style modules. There are no runtime dependencies, themes, target emitters, parsers, filesystem calls, or framework imports. Compiler reference types will extend this boundary in the theme phase; arbitrary objects are not accepted as future tokens today.

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

Compilation is pure. Declarations are partitioned into overlapping property domains: padding, margin, and gap include their supported longhands; other supported properties are independent. A domain is shared only when every style mentioning it has the exact same ordered declarations. Conflicting domains retain distinct authored rules, including repeated A/B/A overrides.

CamelCase properties become kebab-case; units remain unchanged and numeric values stay unitless. Empty styles return an empty class list and no rule. The result and maps are frozen. Only the web entrypoint imports the compiler.

Each class-map value is a space-separated list. Common declarations use a readable `z-base-<hash>` identifier. Conflicting bodies use encoded CSS property/value names, with the encoded authored name added when a body repeats. Punctuation encoding is injective, and identifier collisions fail explicitly. No global registry or runtime helper is emitted.

Artifacts belong to the complete compilation input. Reordering styles preserves class lists while changing cascade order; adding or removing styles can change factoring and class lists. Repeated independent compilations of identical data agree regardless of machine paths or clocks. Always distribute class maps with their matching stylesheet. Hashes are identifiers, not cryptographic integrity checks.

`Css.CompileError` aggregates invalid declarations and empty or duplicate names; no partial stylesheet is returned. Compiler input is the ordered data contract returned by `Style.define`, not arbitrary untrusted objects. Themes, nested conditions, callbacks, and source parsing remain outside this literal API. Declaration and rule ordering follow CSS cascade semantics; class-attribute order does not control overrides.
