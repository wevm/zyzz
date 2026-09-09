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

| Group       | Supported Properties                                                                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout      | `display`, `position`, `boxSizing`, `flexDirection`, `flexWrap`, `alignItems`, `justifyContent`, `gap`, `rowGap`, `columnGap`, `flexGrow`, `flexShrink`, `flexBasis`, `order`, `alignSelf`, `alignContent`             |
| Spacing     | `padding`, `margin`, and their physical top/right/bottom/left and logical block/inline start/end longhands                                                                                                             |
| Sizing      | `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`, plus `inlineSize`, `blockSize`, and their `min`/`max` forms                                                                                       |
| Colors      | `color`, `backgroundColor`, `borderColor`                                                                                                                                                                              |
| Borders     | `borderWidth`, `borderStyle`, `borderColor`, their physical/logical side forms, and physical/logical corner radii                                                                                                      |
| Decorations | `textDecorationColor`, `textDecorationLine`, `textDecorationSkipInk`, `textDecorationStyle`, `textDecorationThickness`, `textUnderlineOffset`                                                                          |
| Typography  | `fontSize`, `fontWeight`, `fontStyle`, `lineHeight`, `textAlign`, `textAlignLast`, `textIndent`, `letterSpacing`, `wordSpacing`, `hyphens`, `overflowWrap`, `wordBreak`, `whiteSpace`, `textTransform`, `textOverflow` |
| Positioning | `inset`, `insetBlock`, `insetInline`, their start/end longhands, and `top`, `right`, `bottom`, `left`                                                                                                                  |
| Writing     | `direction` (`ltr`, `rtl`), `writingMode` (`horizontal-tb`, `vertical-lr`, `vertical-rl`)                                                                                                                              |
| Outlines    | `outlineColor`, `outlineWidth`, `outlineStyle`, `outlineOffset`                                                                                                                                                        |
| Overflow    | `overflow`, `overflowX`, `overflowY`                                                                                                                                                                                   |
| Scrolling   | `scrollMargin`/`scrollPadding` and physical/logical longhands, `scrollBehavior`, `scrollSnapType`/`scrollSnapAlign`/`scrollSnapStop`, `overscrollBehavior`/`overscrollBehaviorX`/`overscrollBehaviorY`                 |
| Tables      | `borderCollapse`, `borderSpacing`, `captionSide`, `emptyCells`, `tableLayout`                                                                                                                                          |
| Other       | `opacity`                                                                                                                                                                                                              |

- **Lengths:** finite absolute, font-relative, viewport-relative, and container-relative lengths, percentages, or numeric zero. Border and outline widths, outline offsets, and scroll margins exclude percentages.
- **Margins:** allow negative lengths. Margins, inset offsets, and width/height/inlineSize/blockSize also accept `auto`. Offsets accept negative lengths.
- **Shorthands:** scalar values only; no multi-value strings yet.
- **Units:** preserve spelling without implicit pixel conversion.

- **Colors:** 3/4/6/8-digit hex, `transparent`, `currentColor`, `black`, or `white`.
- **CSS-wide values:** every property accepts `inherit`, `initial`, `revert`, `revert-layer`, and `unset`.
- **Numbers:** finite values only; opacity 0–1, font weight 1–1000, line height/flex factors nonnegative.

Inferred authoring values reject hexadecimal, binary, octal, and whitespace-separated numeric lengths. Valid token names remain usable even when their spelling resembles an invalid CSS value. Types check units and token names; runtime validation checks numeric bounds and hex digits.

This boundary rejects:

- Arbitrary variable objects and explicit `undefined`.
- Callbacks, selectors, and queries.
- CSS functions and nested fallback arrays.
- Unsupported properties and other named colors.

## Length Units

The scalar grammar accepts these units from [CSS Values and Units](https://www.w3.org/TR/css-values-4/#lengths) and [CSS Containment](https://www.w3.org/TR/css-contain-3/#container-lengths).

| Family             | Units                                                                             |
| ------------------ | --------------------------------------------------------------------------------- |
| Absolute           | `px`, `cm`, `mm`, `q`/`Q`, `in`, `pc`, `pt`                                       |
| Font-relative      | `em`, `ex`, `cap`, `ch`, `ic`, `lh`, `rem`, `rex`, `rcap`, `rch`, `ric`, `rlh`    |
| Viewport-relative  | `vw`, `vh`, `vi`, `vb`, `vmin`, `vmax`, plus each with an `s`, `l`, or `d` prefix |
| Container-relative | `cqw`, `cqh`, `cqi`, `cqb`, `cqmin`, `cqmax`                                      |
| Percentage         | `%` where the property permits it                                                 |

Units use the listed spellings. Signed decimals and finite scientific notation are accepted where the property permits their value. Emission preserves units; the browser resolves font, viewport, and container metrics. Existing theme length tokens, fallbacks, and importance suffixes use the same grammar.

```ts
import { css } from 'zyzz'

const panel = css({
  width: ['80vw', '80cqi'],
  height: '100dvh',
  padding: '1lh!',
})
```

Container units can refer to containment established by ordinary CSS. Zyzz does not yet author containment declarations or container conditions. Browser support for newer units depends on the deployment target; ordered fallback declarations can retain an older unit. Native unit conversion remains unimplemented.

## Scroll Spacing

[Scroll margins and padding](https://www.w3.org/TR/css-scroll-snap-1/#scroll-padding) adjust scroll-into-view alignment without changing layout spacing. Physical sides, logical block/inline shorthands, and logical start/end longhands retain authored order.

| Properties                                                         | Values                                            |
| ------------------------------------------------------------------ | ------------------------------------------------- |
| `scrollMargin*`                                                    | Signed lengths or zero; no percentages or `auto`  |
| `scrollPadding*`                                                   | Nonnegative lengths, percentages, zero, or `auto` |
| `scrollBehavior`                                                   | `auto`, `smooth`                                  |
| `overscrollBehavior`, `overscrollBehaviorX`, `overscrollBehaviorY` | `auto`, `contain`, `none`                         |

```ts
import { Config, css } from 'zyzz'

const zyzz = Config.create({ theme: { spacing: { header: '4rem' } } })
const scroller = zyzz.css({
  overflow: 'auto',
  scrollPaddingBlockStart: 'header',
  overscrollBehavior: 'contain',
})
const section = css({ scrollMarginBlockStart: '1rem' })
```

Scroll padding accepts spacing tokens, explicit references, ordered fallbacks, and importance. Scroll margins remain literal-only because the shared spacing token contract permits percentages. Negative scroll padding fails validation. Shorthands accept one scalar per fallback entry.

[Scroll behavior](https://www.w3.org/TR/css-overflow-3/#scroll-behavior-property) controls navigation/API scrolling; [overscroll behavior](https://www.w3.org/TR/css-overscroll-1/#overscroll-behavior-properties) controls boundary actions. Smooth-scroll timing remains browser-owned. Logical overscroll axes, multi-value shorthands, and native scrolling conversion remain deferred.

## Scroll Snapping

[Scroll snap properties](https://www.w3.org/TR/css-scroll-snap-1/#scroll-snap-type) align items within a scroll container. Values use the listed lowercase keywords and single-space combinations; arrays remain ordered declaration fallbacks.

| Property          | Values                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `scrollSnapType`  | `none`; `x`, `y`, `block`, `inline`, or `both`, optionally followed by `mandatory` or `proximity` |
| `scrollSnapAlign` | One or two of `none`, `start`, `end`, `center`; paired values select block then inline alignment  |
| `scrollSnapStop`  | `normal`, `always`                                                                                |

```ts
import { css } from 'zyzz'

const carousel = css({
  display: 'flex',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
})
const slide = css({
  flexShrink: 0,
  scrollSnapAlign: 'start',
  scrollSnapStop: 'always',
})
```

Snap declarations accept CSS-wide keywords, fallback arrays, and importance in root, theme, and Config authoring. Theme tokens do not map to snap keywords. Scroll margins and padding adjust the alignment area. The browser owns proximity thresholds, motion, and gesture physics; native snapping remains deferred.

## Text Decorations

[Text decorations](https://www.w3.org/TR/css-text-decor-4/) use separate properties with ordered fallbacks and importance. Shared `color` tokens apply to decoration colors; `textColor` tokens remain specific to text color. Thickness and underline offset accept spacing tokens.

| Property                  | Supported Values                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `textDecorationColor`     | Supported colors and shared color tokens                                                     |
| `textDecorationLine`      | `none`, or any single-space ordering of distinct `underline`, `overline`, and `line-through` |
| `textDecorationSkipInk`   | `auto`, `none`                                                                               |
| `textDecorationStyle`     | `dashed`, `dotted`, `double`, `solid`, `wavy`                                                |
| `textDecorationThickness` | Nonnegative lengths, percentages, zero, `auto`, `from-font`                                  |
| `textUnderlineOffset`     | Signed lengths, percentages, zero, `auto`                                                    |

```ts
import { css } from 'zyzz'

const link = css({
  textDecorationLine: ['underline', 'underline overline!'],
  textDecorationStyle: 'wavy',
  textDecorationThickness: '2px',
  textUnderlineOffset: '.2em',
})
```

Thickness supports a bounded nonnegative subset of CSS. Percentages use font-relative browser semantics. Combined `textDecoration` shorthands, underline position, additional ink-skipping values, emphasis, shadows, and native conversion remain deferred. The browser owns line placement and painting.

## Text Flow

[Text spacing and line breaking](https://www.w3.org/TR/css-text-3/) use explicit scalar domains. Indentation accepts spacing tokens; letter and word spacing remain literal-only because the shared spacing token contract permits percentages.

| Properties                     | Supported Values                                                  |
| ------------------------------ | ----------------------------------------------------------------- |
| `letterSpacing`, `wordSpacing` | Signed lengths, zero, `normal`; percentages excluded              |
| `textIndent`                   | Signed lengths, percentages, zero, or spacing tokens              |
| `hyphens`                      | `auto`, `manual`, `none`                                          |
| `overflowWrap`                 | `anywhere`, `break-word`, `normal`                                |
| `wordBreak`                    | `break-all`, `keep-all`, `normal`                                 |
| `whiteSpace`                   | `break-spaces`, `normal`, `nowrap`, `pre`, `pre-line`, `pre-wrap` |
| `textAlignLast`                | `auto`, `center`, `end`, `justify`, `left`, `right`, `start`      |
| `textTransform`                | `capitalize`, `lowercase`, `none`, `uppercase`                    |
| `textOverflow`                 | `clip`, `ellipsis`                                                |

```ts
import { css } from 'zyzz'

const title = css({ letterSpacing: '-.02em', textTransform: 'uppercase' })
const excerpt = css({
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
})
const paragraph = css({ overflowWrap: 'anywhere', textIndent: '1em' })
```

[Text overflow](https://www.w3.org/TR/css-overflow-3/#text-overflow) does not create overflow by itself. Use a constrained container with hidden overflow and the appropriate wrapping behavior. All listed properties accept CSS-wide keywords, ordered fallback arrays, and importance.

Hyphenation dictionaries and language-sensitive casing remain browser-owned. Indentation modifiers, custom overflow strings, extended transformation keywords, whitespace longhands, font families, composite typography tokens, and native text conversion remain deferred.

## Intrinsic Sizing

```ts
css({
  inlineSize: 'fit-content',
  minInlineSize: 'min-content',
  maxInlineSize: 'none',
  flexBasis: 'content',
})
```

[Intrinsic sizing keywords](https://www.w3.org/TR/css-sizing-3/#sizing-values) apply to width/height, inline/block size, their minimum/maximum forms, and flex basis. Keywords retain CSS semantics and can appear in ordered fallback arrays or carry importance.

| Properties                       | Additional Values                                              |
| -------------------------------- | -------------------------------------------------------------- |
| Preferred and minimum dimensions | `auto`, `fit-content`, `min-content`, `max-content`            |
| Maximum dimensions               | `none`, `fit-content`, `min-content`, `max-content`            |
| `flexBasis`                      | `auto`, `content`, `fit-content`, `min-content`, `max-content` |

Valid CSS keywords precede same-named theme tokens. An explicit `theme.tokens.spacing['min-content']` reference still selects that token's length. Theme spacing values remain lengths; keywords are not accepted as padding or margin values. Function forms such as `fit-content(20rem)`, `stretch`, and native intrinsic sizing remain deferred.

## Borders and Outlines

```ts
zyzz.css({
  borderStyle: 'solid',
  borderWidth: '1px',
  borderInlineStartColor: 'brand',
  borderStartStartRadius: 'round',
  outlineStyle: 'dashed',
  outlineWidth: '2px',
  outlineOffset: '-1px',
})
```

[Border sides and corners](https://www.w3.org/TR/css-logical-1/#border-properties) retain authored order across physical and logical declarations. Color/style/width support all four physical sides, block/inline shorthands, and logical start/end sides.

Radius supports all four physical and logical corners. Scalar shorthands apply one value to their sides; arrays remain fallbacks.

`borderColor` tokens apply to every border color property before shared `color` tokens. `borderRadius` tokens apply to every corner radius. Outlines use shared `color` tokens. Widths accept nonnegative lengths or zero; radii additionally accept percentages. Outline offsets accept negative lengths. Named widths and combined border/outline strings remain deferred.

Border styles include `dashed`, `dotted`, `double`, `groove`, `hidden`, `inset`, `none`, `outset`, `ridge`, and `solid`. [Outline styles](https://www.w3.org/TR/css-ui-4/#outline-props) accept `auto` instead of `hidden`. Rendering details remain browser-owned; native border/outline conversion is not implemented.

## Flex and Overflow

```ts
const row = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignContent: 'space-between',
  overflow: 'hidden',
  overflowY: 'auto',
})
const item = css({ flexBasis: '12rem', alignSelf: 'center', order: -1 })
```

[Flex basis](https://www.w3.org/TR/css-flexbox-1/#flex-basis-property) accepts nonnegative lengths, percentages, zero, `auto`, `content`, or intrinsic sizing keywords, including spacing tokens in bound styles. `order` accepts safe integers; fractional values fail validation. Visual ordering does not change DOM or keyboard order. The multi-value `flex` shorthand remains deferred.

[Overflow](https://www.w3.org/TR/css-overflow-3/#overflow-properties) accepts `auto`, `clip`, `hidden`, `scroll`, or `visible`. The scalar shorthand sets both axes; later longhands retain precedence, including mixed importance. Arrays remain declaration fallbacks. The browser owns axis coupling and scrolling behavior; `clip` does not create a scroll container.

## Logical Boxes

```ts
const panel = css({
  inlineSize: '20rem',
  paddingInline: '1rem',
  marginBlockEnd: '0.5rem!',
  position: 'relative',
  insetInlineStart: '-2px',
})
```

[Logical dimensions, spacing, and offsets](https://www.w3.org/TR/css-logical-1/) follow the element's writing mode and direction. Emission retains logical property names and authored order relative to physical properties. Spacing tokens work in every new length property, including explicit references and fallback arrays.

Shorthands currently accept a single scalar, applied to both logical edges. Arrays remain ordered declaration fallbacks, not paired edge values. Minimum/maximum sizes support the intrinsic keywords above. Native mapping is not implemented.

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
- **Overlapping properties:** padding, margin, inset, overflow, and gap group with their supported longhands. Logical sizes group with both physical axes of the corresponding size/minimum/maximum family when present. Border color, style, width, and radius each group their overlapping physical/logical declarations.
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

## Tables

| Property         | Values                                                 |
| ---------------- | ------------------------------------------------------ |
| `borderCollapse` | `collapse`, `separate`                                 |
| `borderSpacing`  | One nonnegative length or numeric zero; no percentages |
| `captionSide`    | `bottom`, `top`                                        |
| `emptyCells`     | `hide`, `show`                                         |
| `tableLayout`    | `auto`, `fixed`                                        |

CSS-wide keywords, ordered fallbacks, and importance are supported. Border spacing applies to separated borders; caption placement and empty-cell visibility follow native table behavior. Two-length spacing and spacing tokens remain deferred because the current token domain permits percentages.

```ts
css({
  borderCollapse: 'separate',
  borderSpacing: '8px',
  captionSide: 'bottom',
  emptyCells: 'hide',
  tableLayout: 'fixed',
  width: '100%',
})
```

## Interaction

| Property        | Values                                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `cursor`        | Standard keywords including `auto`, `pointer`, `text`, `grab`, `grabbing`, resize directions, and zoom; no image URLs |
| `pointerEvents` | `auto`, `none`                                                                                                        |
| `resize`        | `block`, `both`, `horizontal`, `inline`, `none`, `vertical`                                                           |
| `userSelect`    | `all`, `auto`, `none`, `text`                                                                                         |
| `visibility`    | `collapse`, `hidden`, `visible`                                                                                       |

All five accept CSS-wide keywords, ordered fallbacks, and importance. Cursor images, SVG pointer targeting, and selection containment remain deferred. These keyword domains do not accept theme tokens. Resizing requires suitable native overflow behavior; hidden elements retain layout space. Pointer targeting does not disable keyboard interaction or establish disabled-control semantics.

```ts
css({
  cursor: 'text',
  overflow: 'auto',
  resize: 'inline',
  userSelect: 'text',
})
```

## Columns

`columnCount` accepts positive safe integers or `auto`; `columnWidth` accepts nonnegative lengths, zero, or `auto`. `columnFill` accepts `auto`/`balance`, `columnSpan` accepts `none`/`all`, and `columnGap` also accepts `normal`.

Column rule color/style/width follow scalar color, line-style, and nonnegative length domains; widths also accept thin/medium/thick. Shared color tokens apply to rule colors. Break-before/after/inside keywords control fragmentation; orphan/widow counts are positive safe integers. Percentages in column widths, shorthands, and regions remain deferred.

```ts
css({
  columnCount: 2,
  columnGap: '1rem',
  columnRuleStyle: 'solid',
  columnRuleWidth: 'thin',
  breakInside: 'avoid-column',
})
```
