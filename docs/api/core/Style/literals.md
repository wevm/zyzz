# Literal Values

The current pinned inventory covers all 670 property mappings with zero partial or deferred entries under the static authoring and emission contract. CSS value validation is static-only. `Style.define` retains ordered definitions; `Css.compile` emits them. Coverage does not promise every browser implements every property. The maintained counts and evidence live in [the conformance inventory](../../../../test/conformance/README.md).

The feature notes below record historical implementation checkpoints, including validators and partial counts that were superseded by the complete static contract. They describe the scope of those fixtures, not the current completion status.

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

- **Colors:** 3/4/6/8-digit hex, `transparent`, `currentColor`, any of the 148 canonical lowercase CSS named colors, or the 19 canonical system-color keywords.
- **CSS-wide values:** every property accepts `inherit`, `initial`, `revert`, `revert-layer`, and `unset`.
- **Numbers:** finite values only; opacity numbers/percentages (browser-clamped), font weight 1–1000, line height/flex factors nonnegative.

Inferred authoring values reject hexadecimal, binary, octal, and whitespace-separated numeric lengths. Valid token names remain usable even when their spelling resembles an invalid CSS value. Types check units, token names, concrete hex digits, integer literals, and nonnegative scalar literals. Runtime CSS value validation is not performed. Broad numeric values and complex function arguments remain subject to browser CSS parsing.

This boundary rejects:

- Arbitrary variable objects and explicit `undefined`.
- Callbacks, selectors, and queries.
- CSS functions and nested fallback arrays.
- Unsupported properties and noncanonical color spellings.

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

const styles = {
  panel: css({
    width: ['80vw', '80cqi'],
    height: '100dvh',
    padding: '1lh!',
  }),
}
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
import { Config } from 'zyzz'

const { css } = Config.create({ theme: { spacing: { header: '4rem' } } })
const styles = {
  scroller: css({
    overflow: 'auto',
    scrollPaddingBlockStart: 'header',
    overscrollBehavior: 'contain',
  }),
  section: css({ scrollMarginBlockStart: '1rem' }),
}
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

const styles = {
  carousel: css({
    display: 'flex',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
  }),
  slide: css({
    flexShrink: 0,
    scrollSnapAlign: 'start',
    scrollSnapStop: 'always',
  }),
}
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

const styles = {
  link: css({
    textDecorationLine: ['underline', 'underline overline!'],
    textDecorationStyle: 'wavy',
    textDecorationThickness: '2px',
    textUnderlineOffset: '.2em',
  }),
}
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

const styles = {
  title: css({ letterSpacing: '-.02em', textTransform: 'uppercase' }),
  excerpt: css({
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  }),
  paragraph: css({ overflowWrap: 'anywhere', textIndent: '1em' }),
}
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
css({
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

`borderColor` tokens apply to every border color property before shared `color` tokens. `borderRadius` tokens apply to every corner radius. Outlines use shared `color` tokens. Widths accept nonnegative lengths, zero, thin, medium, or thick; radii additionally accept percentages. Outline offsets accept negative lengths. Color/style lists accept up to four physical components or two logical components. Corners accept elliptical pairs; borderRadius accepts slash-separated axis lists. Combined border/outline strings remain deferred.

Border styles include `dashed`, `dotted`, `double`, `groove`, `hidden`, `inset`, `none`, `outset`, `ridge`, and `solid`. [Outline styles](https://www.w3.org/TR/css-ui-4/#outline-props) accept `auto` instead of `hidden`. Rendering details remain browser-owned; native border/outline conversion is not implemented.

## Flex and Overflow

```ts
const styles = {
  row: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignContent: 'space-between',
    overflow: 'hidden',
    overflowY: 'auto',
  }),
  item: css({ flexBasis: '12rem', alignSelf: 'center', order: -1 }),
}
```

[Flex basis](https://www.w3.org/TR/css-flexbox-1/#flex-basis-property) accepts nonnegative lengths, percentages, zero, `auto`, `content`, or intrinsic sizing keywords, including spacing tokens in bound styles. `order` accepts safe integers; fractional values fail validation. Visual ordering does not change DOM or keyboard order. The multi-value `flex` shorthand remains deferred.

[Overflow](https://www.w3.org/TR/css-overflow-3/#overflow-properties) accepts `auto`, `clip`, `hidden`, `scroll`, or `visible`. The scalar shorthand sets both axes; later longhands retain precedence, including mixed importance. Arrays remain declaration fallbacks. The browser owns axis coupling and scrolling behavior; `clip` does not create a scroll container.

## Logical Boxes

```ts
const styles = {
  panel: css({
    inlineSize: '20rem',
    paddingInline: '1rem',
    marginBlockEnd: '0.5rem!',
    position: 'relative',
    insetInlineStart: '-2px',
  }),
}
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

Importance is stored separately on `Style.Declaration.important`. Numeric importance uses a string, such as `'0.5!'` or `'0!'`. Empty, sparse, and accessor-backed fallbacks fail structurally. Value validity is checked statically. Quoted image URLs retain their contents when a trailing importance marker is separated.

## Ordering and Ownership

Definitions preserve JavaScript own enumerable string-key order, including its integer-key ordering. Property order preserves shorthand/longhand precedence for later emitters; validation never sorts declarations. Fallback entries expand in place and importance is separated from each scalar value. Empty maps and empty styles are valid; empty style names are not.

Plain and null-prototype objects are accepted. Accessors, symbols, non-enumerable properties, array-shaped style objects, and class instances are rejected. Input must be ordinary data, not proxies. Values are copied into frozen style, declaration, and array objects. Subsequent changes to input cannot change the result.

## Diagnostics

`Style.InvalidError` aggregates errors in traversal order. Each diagnostic has a stable code, component path array, and message. Structural errors use `invalid_structure`; empty fallback arrays use `invalid_value`. CSS property and value errors are static TypeScript diagnostics. Paths remain unambiguous when names contain dots.

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

## Layout and Containment

`display` includes `contents`, `flow-root`, `list-item`, `inline-table`, and table roles. `float` and `clear` accept physical and logical sides; clear also accepts `both`. `zIndex` accepts `auto` or safe integers, including negatives. `isolation` accepts `auto`/`isolate`.

`contain` accepts single `none`, `strict`, `content`, `size`, `inline-size`, `layout`, `style`, or `paint` keywords. `contentVisibility` accepts `auto`, `hidden`, or `visible`. Compatible containment keywords can be combined; size and inline-size remain mutually exclusive. Multi-keyword display values remain deferred.

`objectFit` accepts `fill`, `contain`, `cover`, `none`, or `scale-down`; `boxDecorationBreak` accepts `slice`/`clone`. `backfaceVisibility` accepts `hidden`/`visible` and `transformStyle` accepts `flat`/`preserve-3d`. Transform functions remain a separate capability. These keyword domains do not map theme tokens.

```ts
css({
  display: 'flow-root',
  contain: 'layout',
  isolation: 'isolate',
  zIndex: 2,
})
```

## Backgrounds and color controls

Background attachment, blend mode, clipping, origin, repeat, axis positions, and size accept bounded scalar values. Axis positions accept signed lengths/percentages and the corresponding axis keywords; size accepts nonnegative lengths/percentages, auto, contain, or cover. Lists, position pairs, size pairs, images, and gradients remain deferred.

Accent and caret colors accept the shared color domain, color tokens, and auto. Explicit token references disambiguate a color token named auto. Color schemes accept normal, light, dark, light dark, dark light, only light, and only dark. Forced-color adjustment, print-color adjustment, and mix blending use finite keywords. Grammar and type probes cover these domains; browser fixtures compare computed styles with independent CSS. Computed styles do not establish pixel-level blending, clipping, or forced-color rendering.

## SVG Paint

Nineteen properties cover fill/stroke paints, opacity, fill/clip rules, line caps/joins, stroke lengths and miter limits, filter colors, paint order, rendering hints, and non-scaling strokes. Fill and stroke accept scalar colors, shared color tokens, none, context-fill, and context-stroke. Opacities accept finite numbers and percentages, clamped by the browser; miter limits accept finite numbers at least one. Stroke widths use nonnegative lengths/percentages; dash offsets also allow negative values.

Paint order currently accepts normal or a single fill/stroke/markers keyword. Unitless nonzero SVG lengths, paint servers, dash arrays, multi-keyword paint order, and other vector effects remain deferred. Browser evidence compares independent computed styles and verifies evenodd path geometry; it does not prove filter pixels, hint quality, or vector-effect rendering.

## Font Controls

Nineteen properties add font kerning, optical sizing, stretch keywords, synthesis controls, caps/position/east-Asian/ligature/numeric variants, ruby placement/alignment, vertical orientation, text combination, justification, and emphasis. Emphasis colors accept shared color tokens; emphasis shapes support filled/open combinations in either order. Emphasis positioning and ruby positioning use finite keyword combinations.

Numeric, East Asian, and ligature variants accept compatible keyword combinations. Font synthesis accepts independent weight, style, small-caps, and position choices. Conflicting alternatives and repeated groups fail. Stretch percentages, custom emphasis strings, digit-combination counts, and font feature settings remain deferred. Browser fixtures compare independent computed styles and verify ruby annotation placement and upright vertical text geometry; they do not establish font-specific glyph selection or justification quality.

## Motion Controls

Eleven animation and transition properties support comma-separated durations/delays, easing functions, iteration counts, direction, fill mode, play state, and discrete transition behavior. Times use finite decimal or exponent values with s/ms units, including zero; negative delays are accepted, while negative durations are rejected. Animation duration also accepts auto. Iteration counts accept nonnegative numbers or infinite.

Literal cubic-bezier(), steps(), and linear() curves validate argument counts and numeric constraints. Math inside easing arguments, substitution, comments, escaped spellings, animation names, timeline syntax, and keyframe authoring remain deferred. Ordinary CSS can supply animation names and keyframes. A paused-animation fixture verifies computed declarations, native duration/delay, and the opacity produced by a negative delay. Transition interpolation and discrete-transition lifecycle behavior remain separate browser gates.

## Grid Tracks

Nine properties cover implicit tracks, scalar explicit tracks, auto-placement, and row/column start/end lines. Tracks accept nonnegative lengths, percentages, fr dimensions, auto, min-content, and max-content. Explicit tracks also accept none and subgrid. Auto flow accepts row/column with optional dense in either order.

Grid lines accept auto, nonzero safe integers, and span followed by a canonical positive safe integer. Important numeric fallbacks preserve their number domain. Track lists, repeat/minmax/fit-content functions, and track line-name groups are supported as described below. Named-line placement, areas, and grid shorthands remain deferred. Browser fixtures compare independent CSS and verify fractional implicit tracks and a two-column span; subgrid layout remains a separate gate.

## Masks and Positioning

Sixteen properties add mask geometry/mode/composition, scalar mask sizing and positioning, image rendering, object/background positioning, perspective, transform boxes/origins, and shape margins. Scalar positions accept signed lengths/percentages or one bottom/center/left/right/top keyword. Perspective accepts none or nonnegative lengths without percentages. Mask sizing accepts nonnegative lengths/percentages, auto, contain, or cover.

Background position and its X/Y longhands share a conflict domain to preserve authored precedence during CSS factoring. Mask images can be supplied by ordinary CSS; a Chromium fixture compares masked pixels with independent declarations and an unmasked control. Lists, image sources, paired positions/sizes, gradients, filter functions, and 3D transform rendering remain deferred.

## Lists and Input

Thirteen properties add common list marker styles and placement, appearance keywords, touch actions, scrollbar width, overflow anchoring, logical overscroll axes, integer tab sizes, bidi controls, line breaking, text autoscaling keywords, and spacing trim. Touch action enumerates all 94 combinations of the supported gesture keywords, preserving permutations without allowing conflicting directions.

Tab sizes are nonnegative safe integers. Custom counter styles/strings, length-based tab stops, text-size percentages, and broader appearance syntax remain deferred. Chromium fixtures compare native marker pixels, tab layout, and computed controls; touch gesture dispatch, rubber-banding, bidi visual ordering, and text autoscaling behavior remain separate gates.

## Color Keywords

All 148 canonical lowercase CSS named colors and 19 canonical system-color keywords are accepted by color properties and theme values, including paired schemes. Literal names take precedence over inferred token names; explicit theme.tokens references retain access to colliding tokens. The independent MDN corpus exhausts every named color across each color property and consumer type. Browser fixtures verify named RGB values, explicit references, importance, and light/dark scheme changes. Absolute rgb()/rgba(), hsl()/hsla(), hwb(), lab()/lch(), oklab()/oklch(), and predefined color() spaces accept finite literal channels, alpha, and modern none components. Legacy separators retain their restrictions. Relative colors, nested functions, comments, and escaped spellings remain deferred.

## Container and Field Sizing

`containerType` accepts `normal`, `size`, `inline-size`, `scroll-state`, and either size mode combined with `scroll-state` in either order. `fieldSizing` accepts `content` or `fixed`; `interpolateSize` accepts `allow-keywords` or `numeric-only`. Fallbacks and importance use the shared literal pipeline. That historical inventory tracked 301 partial mappings; container names, query authoring, and interpolation functions remain deferred. Browser evidence covers native container-query responses and content-sized inputs; scroll-state queries and animated intrinsic-size interpolation remain separate gates.

## Reading Order

`readingFlow` accepts the seven modes from the pinned CSS Display grammar. `readingOrder` accepts signed safe integers, including zero, with ordered fallbacks and importance. Runtime validation rejects fractions and unsafe integers; TypeScript's number domain cannot express these numeric bounds. Chromium keyboard fixtures compare reversed visual flex flow and explicit ordinal groups with independent native controls and source-order navigation. That historical inventory tracked 304 partial mappings. Grid traversal, writing-mode interactions, assistive-technology traversal, and cross-browser behavior remain separate gates. See [CSS Display Level 4](https://drafts.csswg.org/css-display-4/#reading-flow).

### Structured Grid Tracks

Explicit and implicit grid tracks accept size lists, `minmax()` and `fit-content()`. Explicit tracks also accept line-name groups and integer or automatic `repeat()`, including fixed-size restrictions for auto-repeat. Repetitions remain compact CSS rather than being expanded by the compiler. Consumer types constrain the outer value shape. Nested grammar and computed values are interpreted by the browser; compilation preserves the authored expression.

Independent MDN grammar probes and native responsive-grid fixtures cover these additions. Additional math functions, variable references, escaped identifiers, and subgrid name repetition remain incomplete; these historical grammar limits do not describe current mapping status.

### Box Value Lists

Margin, padding, inset, border-width, scroll-margin, and scroll-padding shorthands accept one to four space-separated scalar components. Their logical block/inline shorthands and gap accept pairs. Each component retains its property-specific auto, percentage, and sign rules; CSS-wide keywords must stand alone. Longhands remain scalar. Type shapes cover lists while the compiler validates arity and every component. Native browser fixtures compare physical longhands in horizontal and vertical writing modes, including importance and shorthand/longhand overrides. Functions, variable substitution, and broader component spellings remain incomplete.

Motion lists keep function commas separate from declaration-list commas:

```ts
css({
  transitionDuration: '250ms, 500ms',
  transitionTimingFunction: 'steps(4, end), cubic-bezier(0, -1, 1, 2)',
  animationIterationCount: '2.5, infinite',
})
```

Bézier x coordinates must fall within zero and one; y coordinates may overshoot. Step counts must be positive integers, and `jump-none` requires at least two. Linear stops support one or two percentage positions. CSS-wide keywords must stand alone. Nested functions remain unsupported.

### Math Expressions

Numeric, length, and time properties accept literal calc(), min(), max(), and clamp() expressions. Grid track sizes and length lists retain nested function arguments. Addition requires compatible dimensions; multiplication and division accept scalar factors. Length-percentage mixtures are restricted to properties accepting percentages. Browser evaluation owns range clamping, integer rounding, and unit resolution.

Function names and outer shapes are typed. Argument syntax, dimensions, substitutions, and calculation results are interpreted by the browser. Compilation does not impose a parser nesting limit. Browser comparisons cover responsive dimensions, radius axes, integer rounding, opacity, and durations.

### Custom-Property References

All mapped properties accept unquoted var() references, including nested and empty fallbacks and variables inside other expressions. Compilation validates balanced components and custom-property names. Property-value matching is deferred until browser substitution, including invalid-at-computed-value behavior. References preserve case and authored spelling; custom properties are supplied by ordinary CSS or native style APIs.

Quotes, escapes, comments, braces, URL tokens, and nesting beyond 128 levels remain outside this subset. Browser fixtures cover inheritance, overrides, cycles, empty fallbacks, importance, and invalid substitutions. These limitations belonged to the earlier validation subset; the current static mapping inventory has no partial entries.

SVG geometry, baseline, caret, emoji, font-synthesis-position, logical overflow, scrolling axes, text wrapping, and additional scalar keywords added 38 mappings at that checkpoint. Positions allow signed lengths; radii retain nonnegative bounds. Animation composition and scroll timeline axes accept comma lists. Related shorthand and alias domains preserve A/B/A declaration order.

Zoom accepts nonnegative numbers/percentages and normal/reset. Stop opacity accepts finite numbers/percentages with browser clamping. Experimental properties may lack browser implementation; grammar and type coverage do not imply browser support. New SVG geometry and text fixtures compare native computed values and rendered bounds.

Text wrapping, underline position, hanging punctuation, flex flow, position visibility, masonry flow, and speech keywords validate compatible groups. Border/mask image repetition accepts pairs. Timeline axes accept comma lists; interest delays remain scalar. Further baseline, offset, column, fragmentation, and legacy mappings added 44 mappings at that checkpoint. Shorthand and alias domains preserve authored cascade order.

Independent grammar and generated consumer probes cover the expanded map. Browser controls exercise text and flex output; obsolete and experimental declarations retain separate browser limitations. Complete range rules, lexical forms, and associated functional/shorthand grammars remain incomplete.

Eighteen named-value properties add unescaped custom identifiers, dashed names, and comma/space lists. Names preserve case; validation excludes CSS-wide and property-reserved words, enforces standalone keywords, and rejects malformed prefixes or list boundaries. Public string types defer lexical validation to compilation. Quoted names, escaping, comments, and timeline functions remain incomplete.

Browser fixtures resolve case-sensitive keyframes and named container queries. Name grammar follows [CSS Values](https://www.w3.org/TR/css-values-4/#custom-idents), [Containment](https://www.w3.org/TR/css-contain-3/#container-name), [Transitions](https://www.w3.org/TR/css-transitions-1/#transition-property-property), and [Will Change](https://www.w3.org/TR/css-will-change/#will-change). These mappings are covered by the current static inventory.

Combined border, physical/logical border sides, outline, and column-rule added thirteen mappings at that checkpoint. Values accept one width, style, and color in any order, preserving functional components. Duplicate domains, negative literal widths, and percentages are rejected. When a combined shorthand occurs, related declaration domains remain ordered to preserve longhand overrides.

Browser controls compare both text directions and three writing modes, A/B/A overrides, and the border-image reset performed by border. Independent grammar and consumer probes cover component permutations and functional values. Escaped spellings, broader color functions, and complete numeric forms remain incomplete.

Aspect ratios and transform/translate/rotate/scale added five mappings at that checkpoint. Transform functions validate arity and component dimensions while preserving authored order. Individual transforms accept their respective vector forms. Angle math extends calc/min/max/clamp dimensional checks; percentage depth translations and malformed matrices are rejected.

Browser fixtures compare individual transforms with equivalent function lists, native 3D matrices, rendered bounds, and aspect-ratio sizing. Constants, dimension cancellation, full escaping, and broader numeric spellings remain incomplete. See [CSS Transforms](https://www.w3.org/TR/css-transforms-2/) and [CSS Sizing](https://www.w3.org/TR/css-sizing-4/#aspect-ratio).

Percentage domains support fontWidth, its fontStretch alias, and textSizeAdjust, including nonnegative literals and dimensionally valid math. Zoom accepts percentages. Opacity, fillOpacity, strokeOpacity, floodOpacity, and stopOpacity preserve finite numbers and percentages outside 0–1 for browser clamping. Number/percentage addition remains invalid.

Public source, grammar, type, and browser fixtures cover percentage units, alpha clamping, aliases, importance, and rejection paths. Escaped numeric spellings, tokenization, and broader math were limitations of that historical validation subset; the current static inventory covers these properties. See [CSS Color](https://www.w3.org/TR/css-color-4/#transparency), [CSS Fonts](https://www.w3.org/TR/css-fonts-4/#font-width-prop), and [CSS Values](https://www.w3.org/TR/css-values-4/#percentages).

Eighty-two prefixed properties now cover finite keyword domains, lengths, colors, percentages, logical borders, outline radii, line clamping, and scalar mask lists. Public names preserve capitalized prefixes: MozAppearance, MsAccelerator, and WebkitUserSelect. MsScrollbar3dlightColor emits the exact historical -ms-scrollbar-3dlight-color spelling.

WebKit logical-border aliases share conflict domains with standard borders. Independent grammar and consumer probes cover all added mappings; native controls cover logical borders in three writing modes and both directions, text fill/stroke, selection, and repeated alias overrides. Legacy Microsoft/Mozilla platform behavior remains unverified; these entries are now covered by the static inventory.

The percentage browser fixture confirms alpha clamping. Current Chromium ignores font-width and retains the font-stretch fallback; the fixture records that capability and an independent native control. See [legacy logical borders](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/-webkit-border-before) and [text stroke width](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/-webkit-text-stroke-width).

Seventeen corner-shape properties accept canonical curvature keywords, finite superellipse numbers, infinity endpoints, numeric math, and their one/two/four-value shorthands. Additional mappings cover all, grid-gap aliases, font-smooth, justify-items/self, position-try-order, and text-box-edge. Corner aliases share conflict domains; all prevents declaration factoring across reset boundaries.

Source and type probes retain arity and dimension restrictions. Browser fixtures compare bevel hit testing with an independent polygon and verify A/B/A declarations around an all reset. These entries are covered by the current static inventory. Contracts follow [CSS Borders](https://www.w3.org/TR/css-borders-4/#corner-shaping).

Path-length remains deferred: the pinned grammar places its range outside the length production, while [the MDN examples](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/path-length) describe unitless numbers. The independent grammar oracle is unchanged pending clarification of that experimental property.

Fifteen compound-value properties add border/mask image slices, widths and outsets; two scrollbar colors; unbounded legacy Mozilla color lists; hyphenation limits; interest-delay pairs; and comma-separated view-timeline insets. Domains distinguish numeric factors, lengths, percentages, colors, integer counts, and times, with explicit arity and fill-marker placement.

Interest-delay shorthands share conflict domains with start/end longhands. Independent source and consumer probes cover repeated scalar grammar; native controls compare border-image painting and computed scrollbar colors. These entries are covered by the current static inventory. See [CSS Backgrounds](https://www.w3.org/TR/css-backgrounds-3/#border-images), [CSS Masking](https://www.w3.org/TR/css-masking-1/#mask-borders), and [CSS Scrollbars](https://www.w3.org/TR/css-scrollbars-1/#scrollbar-color).

Intrinsic size overrides accept lengths or none, each optionally prefixed by auto. Font-size-adjust accepts a nonnegative number or from-font, optionally prefixed by ex-height, cap-height, ch-width, ic-width, or ic-height. These contracts follow [CSS Sizing](https://www.w3.org/TR/css-sizing-4/#intrinsic-size-override) and [CSS Fonts](https://www.w3.org/TR/css-fonts-5/#font-size-adjust-prop).

Grid placement accepts named lines and integer indices, positive spans, and row/column/area shorthands. For example, gridColumn accepts `start / span 2` and gridArea accepts `1 / 2 / 3 / 4`. Escaped line names and complete integer math remain deferred. See [CSS Grid placement](https://www.w3.org/TR/css-grid-2/#line-placement).

Animation and timeline-trigger range endpoints accept cover, contain, entry, exit, entry-crossing, or exit-crossing with optional length/percentage offsets. Lists preserve boundaries; normal is standalone, and auto is limited to active-trigger endpoints. See [Scroll-driven Animations](https://www.w3.org/TR/scroll-animations-1/#animation-range).
