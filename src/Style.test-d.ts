/**
 * Checks consumer inference and rejected inputs through the public Style API.
 * @module
 */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, css, Style, Theme } from 'zyzz'
import * as Borders from '../test/fixtures/Borders.js'
import * as Interaction from '../test/fixtures/Interaction.js'
import * as Logical from '../test/fixtures/Logical.js'
import * as Scrolling from '../test/fixtures/Scrolling.js'
import * as Snapping from '../test/fixtures/Snapping.js'
import * as Tables from '../test/fixtures/Tables.js'
import * as TextDecoration from '../test/fixtures/TextDecoration.js'
import * as TextFlow from '../test/fixtures/TextFlow.js'
import { components } from '../test/fixtures/components.js'

describe('css', () => {
  test('interaction properties', () => {
    Style.define(Interaction.styles)
    css({
      cursor: ['grab', 'grabbing!'],
      pointerEvents: 'none',
      userSelect: 'all',
    })
    css({ resize: 'vertical', visibility: 'revert-layer' })
    Config.create().css({ cursor: 'zoom-in', pointerEvents: 'auto' })
    Theme.define({}).css({ userSelect: 'text', resize: 'both' })
    // @ts-expect-error Cursor URL lists remain deferred.
    css({ cursor: 'url(cursor.png), pointer' })
    // @ts-expect-error Pointer-events SVG keywords remain deferred.
    css({ pointerEvents: 'visiblePainted' })
    // @ts-expect-error Resize axes cannot be combined.
    css({ resize: 'horizontal vertical' })
    // @ts-expect-error Selection containment remains deferred.
    css({ userSelect: 'contain' })
    // @ts-expect-error Visibility is not opacity.
    css({ visibility: 0 })
    // @ts-expect-error Display keywords do not name visibility states.
    css({ visibility: 'none' })
    const interactionTheme = Theme.define({ spacing: { control: '8px' } })
    // @ts-expect-error Interaction keywords do not accept theme tokens.
    interactionTheme.css({ cursor: interactionTheme.tokens.spacing.control })
  })

  test('table properties', () => {
    Style.define(Tables.styles)
    css({ borderSpacing: [0, '1em!'], tableLayout: 'fixed' })
    css({
      borderCollapse: 'revert-layer',
      captionSide: 'inherit',
      emptyCells: 'unset',
    })
    Config.create().css({ borderSpacing: '2px', tableLayout: 'auto' })
    Theme.define({}).css({ borderSpacing: '1rem', captionSide: 'bottom' })
    // @ts-expect-error Border spacing does not accept percentages.
    css({ borderSpacing: '10%' })
    // @ts-expect-error Paired border spacing remains deferred.
    css({ borderSpacing: '1px 2px' })
    // @ts-expect-error Table layout has a finite keyword domain.
    css({ tableLayout: 'flex' })
    // @ts-expect-error Empty cells use hide/show, not visibility keywords.
    css({ emptyCells: 'hidden' })
    // @ts-expect-error Caption alignment is not caption placement.
    css({ captionSide: 'center' })
    // @ts-expect-error Border collapse is not a border style.
    css({ borderCollapse: 'solid' })
    const tableTheme = Theme.define({ spacing: { gutter: '8px' } })
    // @ts-expect-error Unconstrained spacing tokens can contain percentages.
    tableTheme.css({ borderSpacing: tableTheme.tokens.spacing.gutter })
    // @ts-expect-error Named spacing tokens are not supported for border spacing.
    tableTheme.css({ borderSpacing: 'gutter' })
  })

  test('text decoration', () => {
    Style.define(TextDecoration.styles)
    css({
      textDecorationLine: ['overline underline', 'line-through!'],
      textDecorationThickness: '10%',
      textUnderlineOffset: '-.2em',
    })
    const decorationTheme = Theme.define({
      color: { ink: '#06c' },
      textColor: { ink: '#f00' },
      spacing: { stroke: '2px' },
    })
    decorationTheme.css({
      textDecorationColor: 'ink',
      textDecorationThickness: 'stroke',
    })
    Config.create({ theme: decorationTheme }).css({
      textUnderlineOffset: decorationTheme.tokens.spacing.stroke,
    })
    Style.define({
      link: { textDecorationColor: decorationTheme.tokens.color.ink },
    })
    decorationTheme.css({
      // @ts-expect-error Text-only color groups do not map to decoration colors.
      textDecorationColor: decorationTheme.tokens.textColor.ink,
    })
    // @ts-expect-error Root decoration lengths remain token-free.
    css({ textDecorationThickness: 'stroke' })
    // @ts-expect-error None cannot be combined with line flags.
    css({ textDecorationLine: 'none underline' })
    // @ts-expect-error Line flags cannot be repeated.
    css({ textDecorationLine: 'underline underline' })
    // @ts-expect-error Decoration style is not a border style.
    css({ textDecorationStyle: 'groove' })
    // @ts-expect-error From-font is a thickness keyword, not an underline offset.
    css({ textUnderlineOffset: 'from-font' })
    // @ts-expect-error Combined decoration shorthand remains deferred.
    css({ textDecoration: 'underline solid' })
    // @ts-expect-error Invalid numeric spellings remain checked in importance strings.
    css({ textDecorationThickness: '0x10px!' })
  })

  test('text flow', () => {
    Style.define(TextFlow.styles)
    css({
      letterSpacing: ['normal', '-1px!'],
      wordSpacing: '-.2em',
      textIndent: '10%',
    })
    const textTheme = Theme.define({
      spacing: { indent: '12px', portion: '10%' },
    })
    textTheme.css({ textIndent: 'indent', whiteSpace: 'pre-wrap' })
    Config.create({ theme: textTheme }).css({
      textIndent: textTheme.tokens.spacing.portion,
    })
    Style.define({ paragraph: { textIndent: textTheme.tokens.spacing.indent } })
    // @ts-expect-error Letter spacing excludes percentages.
    css({ letterSpacing: '10%' })
    // @ts-expect-error Word spacing excludes percentages in the supported grammar.
    css({ wordSpacing: '10%!' })
    // @ts-expect-error Indentation does not accept auto.
    css({ textIndent: 'auto' })
    // @ts-expect-error Length-only text spacing cannot use unconstrained spacing tokens.
    textTheme.css({ letterSpacing: textTheme.tokens.spacing.portion })
    // @ts-expect-error Text keyword domains cannot use spacing tokens.
    textTheme.css({ whiteSpace: textTheme.tokens.spacing.indent })
    // @ts-expect-error Root indentation remains token-free.
    css({ textIndent: 'indent' })
    // @ts-expect-error Indentation modifiers remain deferred.
    css({ textIndent: '2em hanging' })
    // @ts-expect-error Unknown wrapping values do not widen the finite domain.
    css({ overflowWrap: 'all' })
    // @ts-expect-error Custom text-overflow strings remain deferred.
    css({ textOverflow: '"..."' })
    // @ts-expect-error New whitespace longhands are not part of this surface.
    css({ whiteSpaceCollapse: 'preserve' })
    // @ts-expect-error Numeric spellings remain checked through fallback importance.
    css({ letterSpacing: ['normal', '0x10px!'] })
  })

  test('scroll snapping', () => {
    Style.define(Snapping.styles)
    css({
      scrollSnapType: ['both proximity', 'both mandatory!'],
      scrollSnapAlign: 'center end',
      scrollSnapStop: 'normal',
    })
    const snapTheme = Theme.define({ spacing: { edge: '10px' } })
    snapTheme.css({ scrollPadding: 'edge', scrollSnapType: 'inline mandatory' })
    Config.create({ theme: snapTheme }).css({
      scrollSnapType: 'block proximity',
      scrollSnapAlign: 'none start',
    })
    // @ts-expect-error Strictness needs an axis.
    css({ scrollSnapType: 'mandatory' })
    // @ts-expect-error None cannot be combined with strictness.
    css({ scrollSnapType: 'none mandatory' })
    // @ts-expect-error Snap axes are finite.
    css({ scrollSnapType: 'horizontal mandatory' })
    // @ts-expect-error Alignment accepts at most two keywords.
    css({ scrollSnapAlign: 'start center end' })
    // @ts-expect-error CSS-wide keywords apply to the whole value.
    css({ scrollSnapAlign: 'inherit center' })
    // @ts-expect-error Stop values are not snap strictness values.
    css({ scrollSnapStop: 'mandatory' })
    // @ts-expect-error Token groups do not map to snap keyword domains.
    snapTheme.css({ scrollSnapType: snapTheme.tokens.spacing.edge })
    // @ts-expect-error Invalid entries remain invalid inside fallbacks.
    css({ scrollSnapType: ['x', 'mandatory!'] })
  })

  test('scrolling properties', () => {
    Style.define(Scrolling.styles)
    css({ scrollMargin: '-2px!', scrollPaddingInline: ['auto', '10%'] })
    const scrollTheme = Theme.define({
      spacing: { offset: '20px', portion: '10%' },
    })
    scrollTheme.css({ scrollPaddingTop: 'offset!' })
    Config.create({ theme: scrollTheme }).css({
      scrollPaddingBlock: ['auto', scrollTheme.tokens.spacing.portion],
    })
    Style.define({ box: { scrollPadding: scrollTheme.tokens.spacing.offset } })
    // @ts-expect-error Scroll margin excludes percentages.
    css({ scrollMarginTop: '10%!' })
    // @ts-expect-error Scroll margin does not accept auto.
    css({ scrollMarginInline: 'auto' })
    // @ts-expect-error Scroll padding is not an intrinsic size.
    css({ scrollPadding: 'min-content' })
    // @ts-expect-error Root scroll padding remains token-free.
    css({ scrollPadding: 'offset' })
    // @ts-expect-error Unconstrained spacing tokens can contain percentages.
    scrollTheme.css({ scrollMargin: scrollTheme.tokens.spacing.portion })
    // @ts-expect-error Scroll margin token mapping awaits a length-only token domain.
    scrollTheme.css({ scrollMargin: 'offset' })
    // @ts-expect-error Overflow keywords are not overscroll behavior.
    css({ overscrollBehavior: 'hidden' })
    // @ts-expect-error Instant is a scrolling API option, not a CSS scroll-behavior value.
    css({ scrollBehavior: 'instant' })
    // @ts-expect-error Multi-value shorthands remain unsupported.
    css({ overscrollBehavior: 'none contain' })
    // @ts-expect-error Numeric spellings are checked inside fallback arrays.
    css({ scrollPadding: ['auto', '0x10px!'] })
  })

  test('borders and outlines', () => {
    Style.define({ box: Borders.styles })
    const borderTheme = Theme.define({
      color: { brand: '#fff' },
      borderColor: { brand: '#06c' },
      borderRadius: { round: '50%' },
    })
    borderTheme.css({
      borderInlineStartColor: 'brand!',
      borderTopLeftRadius: 'round',
      outlineColor: 'brand',
    })
    Config.create({ theme: borderTheme }).css({
      borderBlockColor: ['#000', borderTheme.tokens.borderColor.brand],
    })
    // @ts-expect-error Border widths exclude percentages on physical sides.
    css({ borderTopWidth: '10%' })
    // @ts-expect-error Border widths exclude percentages on logical shorthands.
    css({ borderInlineWidth: '10%!' })
    // @ts-expect-error Outline widths exclude percentages.
    css({ outlineWidth: '10%' })
    // @ts-expect-error Outline offsets exclude percentages.
    css({ outlineOffset: '10%' })
    // @ts-expect-error Border color tokens do not apply to outlines.
    borderTheme.css({ outlineColor: borderTheme.tokens.borderColor.brand })
    // @ts-expect-error Radius tokens cannot become stroke widths.
    borderTheme.css({ borderLeftWidth: borderTheme.tokens.borderRadius.round })
    // @ts-expect-error Hidden is a border style, not an outline style.
    css({ outlineStyle: 'hidden' })
    // @ts-expect-error Auto is an outline style, not a border style.
    css({ borderBlockStyle: 'auto' })
  })

  test('logical properties', () => {
    Style.define(Logical.styles)
    css({
      direction: 'rtl',
      writingMode: 'vertical-rl',
      inset: 'auto',
      inlineSize: 'auto',
    })
    const logicalTheme = Theme.define({
      spacing: { md: '12px' },
      color: { brand: '#fff' },
    })
    logicalTheme.css({
      inlineSize: 'md',
      insetBlock: 'md!',
      paddingInline: ['1px', 'md'],
    })
    Style.define({
      card: {
        minInlineSize: logicalTheme.tokens.spacing.md,
        top: logicalTheme.tokens.spacing.md,
      },
    })
    Config.create({ theme: logicalTheme }).css({
      blockSize: 'md',
      maxBlockSize: 'md',
      left: 'md',
      marginBlockEnd: 'md!',
    })
    // @ts-expect-error Root logical dimensions remain token-free.
    css({ inlineSize: 'md' })
    // @ts-expect-error Padding cannot accept auto.
    css({ paddingInline: 'auto' })
    // @ts-expect-error None is exclusive to maximum dimensions.
    css({ minBlockSize: 'none' })
    // @ts-expect-error Color tokens cannot become dimensions.
    logicalTheme.css({ blockSize: logicalTheme.tokens.color.brand })
    // @ts-expect-error Invalid numeric spellings remain rejected on logical lengths.
    css({ insetInlineStart: '0x10px!' })
    // @ts-expect-error Shorthands accept one scalar per fallback, not multi-value strings.
    css({ marginInline: '1px 2px' })
    // @ts-expect-error Unknown writing modes cannot widen the enum.
    css({ writingMode: 'diagonal' })
  })

  test('intrinsic sizing', () => {
    css({
      width: 'min-content',
      height: 'max-content',
      inlineSize: 'fit-content!',
      blockSize: 'max-content',
      minWidth: 'auto',
      minHeight: 'fit-content',
      minInlineSize: 'min-content',
      minBlockSize: 'auto',
      maxWidth: 'none',
      maxHeight: 'max-content',
      maxInlineSize: 'none',
      maxBlockSize: 'fit-content',
      flexBasis: 'content',
    })
    const sizingTheme = Theme.define({ spacing: { 'min-content': '24px' } })
    Config.create({ theme: sizingTheme }).css({
      width: ['min-content', sizingTheme.tokens.spacing['min-content']],
    })
    // @ts-expect-error None is not a preferred dimension.
    css({ width: 'none' })
    // @ts-expect-error Maximum dimensions do not accept auto.
    css({ maxWidth: 'auto' })
    // @ts-expect-error Content is exclusive to flex basis.
    css({ inlineSize: 'content' })
    // @ts-expect-error Intrinsic keywords do not become spacing values.
    css({ padding: 'min-content' })
    // @ts-expect-error Function parsing remains a separate capability.
    css({ width: 'fit-content(10px)' })
    // @ts-expect-error Theme spacing remains a literal length domain.
    Theme.define({ spacing: { small: 'min-content' } })
  })

  test('flex and overflow', () => {
    css({
      alignContent: 'space-between',
      alignSelf: 'auto',
      flexBasis: '25%',
      order: -2,
      overflow: ['hidden', 'clip!'],
      overflowX: 'auto',
      overflowY: 'scroll',
    })
    const flexTheme = Theme.define({
      spacing: { basis: '60px' },
      color: { brand: '#fff' },
    })
    flexTheme.css({ flexBasis: 'basis!' })
    Style.define({ item: { flexBasis: flexTheme.tokens.spacing.basis } })
    Config.create({ theme: flexTheme }).css({ flexBasis: ['auto', 'basis'] })
    // @ts-expect-error Root sizing has no token names.
    css({ flexBasis: 'basis' })
    // @ts-expect-error Flex basis cannot use color tokens.
    flexTheme.css({ flexBasis: flexTheme.tokens.color.brand })
    // @ts-expect-error Item alignment does not accept line-distribution keywords.
    css({ alignSelf: 'space-between' })
    // @ts-expect-error Overflow accepts only its standard scalar keywords.
    css({ overflow: 'none' })
    // @ts-expect-error Order is numeric, including its importance-string form.
    css({ order: '2' })
    // @ts-expect-error Sizing spellings remain checked through importance.
    css({ flexBasis: '0x10px!' })
  })
})

describe('define', () => {
  test('literal definitions and readonly output', () => {
    const definition = Style.define(components)
    expectTypeOf(definition.styles[0]!.name).toEqualTypeOf<
      'card' | 'hidden' | 'label'
    >()
    expectTypeOf(definition).toEqualTypeOf<
      Style.Definition<'card' | 'hidden' | 'label'>
    >()
    Style.define({
      valid: {
        color: '#fff',
        display: 'inherit',
        lineHeight: 1.5,
        margin: '-2rem',
        padding: 0,
      },
    })
    const typo = { card: { colour: '#fff', padding: '1rem' } } as const
    // @ts-expect-error Excess properties must also fail through aliased input.
    Style.define(typo)
    // @ts-expect-error Unknown CSS properties are rejected.
    Style.define({ card: { colour: '#fff' } })
    // @ts-expect-error Core has no numeric spacing tokens.
    Style.define({ card: { padding: 4 } })
    // @ts-expect-error Core has no named tokens.
    Style.define({ card: { color: 'blue.700' } })
    // @ts-expect-error Invalid enum values cannot widen the contract.
    Style.define({ card: { display: 'banana' } })
    // @ts-expect-error Selectors are outside the literal subset.
    Style.define({ card: { ':hover': { color: '#fff' } } })
    // @ts-expect-error Callbacks are outside the literal subset.
    Style.define({ card: () => ({ color: '#fff' }) })
    // @ts-expect-error Undefined is not an authored CSS value.
    Style.define({ card: { padding: undefined } })
    // @ts-expect-error Data cannot be mutated after validation.
    definition.styles.push({ declarations: [], name: 'card' })
    // @ts-expect-error Declaration values are readonly.
    definition.styles[0]!.declarations[0]!.value = '2px'
    // @ts-expect-error Percentages are not border-width values.
    Style.define({ card: { borderWidth: '10%' } })
  })

  test('numeric style names', () => {
    const numeric = Style.define({ 0: { color: '#fff' }, 1.5: { padding: 0 } })
    expectTypeOf(numeric).toEqualTypeOf<Style.Definition<'0' | '1.5'>>()
  })

  test('union inputs', () => {
    const invalidUnion = {} as { color: '#fff' } | { colour: '#fff' }
    // @ts-expect-error Every possible union branch must have supported keys.
    Style.define({ card: invalidUnion })
    const overlappingUnion = {} as
      | { padding: 0 }
      | { colour: '#fff'; padding: 0 }
    // @ts-expect-error Shared valid properties must not hide a branch's typo.
    Style.define({ card: overlappingUnion })
    const callbackUnion = {} as (() => { color: '#fff' }) | { color: '#fff' }
    // @ts-expect-error A union with an executable branch is not literal data.
    Style.define({ card: callbackUnion })
    const validUnion = {} as { color: '#fff' } | { padding: 0 }
    expectTypeOf(Style.define({ card: validUnion })).toEqualTypeOf<
      Style.Definition<'card'>
    >()
  })

  test('theme token domains and required options', () => {
    const theme = Theme.define({
      color: { brand: '#06c' },
      spacing: { 4: '1rem' },
    })
    const themed = Style.define(
      { card: { color: 'brand', padding: 4 } },
      { theme },
    )
    expectTypeOf(themed).toEqualTypeOf<Style.Definition<'card'>>()
    // @ts-expect-error Theme inference cannot widen to accept unknown tokens.
    Style.define({ card: { color: 'missing' } }, { theme })
    // @ts-expect-error Tokens remain property-specific.
    Style.define({ card: { padding: 'brand' } }, { theme })
    // @ts-expect-error Names require an explicitly supplied theme.
    Style.define({ card: { color: 'brand' } })

    type Tokens = { color: { brand: '#06c' }; spacing: { 4: '1rem' } }
    // @ts-expect-error A token-aware option bag requires a theme.
    const missingTheme: Style.define.Options<Tokens> = {}
    // @ts-expect-error A token-aware option bag cannot explicitly omit the theme.
    const undefinedTheme: Style.define.Options<Tokens> = { theme: undefined }
    void missingTheme
    void undefinedTheme
    const presentTheme: Style.define.Options<Tokens> = { theme }
    expectTypeOf(
      Style.define({ card: { color: 'brand' } }, presentTheme),
    ).toEqualTypeOf<Style.Definition<'card'>>()
    const optionalTheme = {} as { theme?: typeof theme | undefined }
    Style.define({ card: { color: '#fff' } }, optionalTheme)
    // @ts-expect-error A potentially absent theme cannot enable shorthand names.
    Style.define({ card: { color: 'brand' } }, optionalTheme)
    // @ts-expect-error Explicit generic arguments cannot omit the required options.
    Style.define<{ card: { color: 'brand' } }, Tokens>({
      card: { color: 'brand' },
    })
    if (optionalTheme.theme)
      Style.define({ card: { color: 'brand' } }, { theme: optionalTheme.theme })
  })
})

describe('css', () => {
  test('fallbacks and importance', () => {
    css({
      display: ['block', 'flex!'],
      opacity: '0.5 !important',
      padding: [0, '8px!'],
    })
    const configured = Config.create({
      theme: { color: { brand: '#06c' }, spacing: { md: '8px' } },
    })
    configured.css({
      color: ['#fff', 'brand!', configured.theme.tokens.color.brand],
      padding: ['md!', 0],
    })
    Style.define({ card: { padding: ['1px', '2px !important'] } })
    // @ts-expect-error Fallbacks are nonempty.
    css({ color: [] })
    // @ts-expect-error Fallback elements cannot be undefined.
    css({ padding: ['8px', undefined] })
    // @ts-expect-error Nested fallback arrays are unsupported.
    css({ color: [['#fff']] })
    // @ts-expect-error Importance does not widen the property domain.
    css({ display: 'banana!' })
    // @ts-expect-error Root styles remain token-free.
    css({ color: ['brand!'] })
    // @ts-expect-error Tokens retain their domain in fallback arrays.
    configured.css({ padding: [configured.theme.tokens.color.brand] })
  })

  test('length units and numeric spellings', () => {
    css({
      borderWidth: '1Q',
      height: ['100vh', '100dvh!'],
      marginLeft: '-2cqi',
      padding: '1lh',
      width: '80ch',
    })
    const lengthTheme = Theme.define({ spacing: { space: '2cqi' } })
    Style.define({ card: { padding: 'space!' } }, { theme: lengthTheme })
    // @ts-expect-error A time unit is not a CSS length.
    css({ width: '1ms' })
    // @ts-expect-error An unknown viewport suffix is not a CSS unit.
    css({ height: '1dvheight' })
    // @ts-expect-error Border widths still exclude percentages.
    css({ borderWidth: '1%!' })
    // @ts-expect-error Length tokens still retain their property domains.
    lengthTheme.css({ color: lengthTheme.tokens.spacing.space })

    const extendedLengths = Theme.extend(lengthTheme, {
      spacing: { space: '1dvh' },
    })
    expectTypeOf(extendedLengths).toEqualTypeOf<typeof lengthTheme>()
    // @ts-expect-error Overrides cannot introduce token paths.
    Theme.extend(lengthTheme, { spacing: { missing: '1lh' } })
    // @ts-expect-error Overrides cannot change length tokens to colors.
    Theme.extend(lengthTheme, { spacing: { space: '#fff' } })

    // @ts-expect-error CSS lengths exclude hexadecimal numbers.
    css({ width: '0x10dvh' })
    // @ts-expect-error CSS lengths exclude binary numbers.
    css({ width: '0b10lh!' })
    // @ts-expect-error CSS lengths exclude octal numbers.
    css({ padding: ['1px', '0o10cqi'] })
    // @ts-expect-error Theme lengths use the same decimal grammar.
    Theme.define({ spacing: { space: '0b10lh' } })
    css({
      width: '01dvh',
      height: '.5cqi',
      margin: '-1e-2lh',
      padding: '+0.5rem',
    })

    // @ts-expect-error CSS numbers cannot contain whitespace before the unit.
    css({ width: '10 dvh' })
    // @ts-expect-error Style.define checks the same numeric spellings.
    Style.define({ card: { padding: '0x10px' } })
    const configured = Config.create({
      theme: { color: { brand: '#06c' }, spacing: { md: '8px' } },
    })
    // @ts-expect-error Config-bound values use the same inferred checks.
    configured.css({ width: '0b10cqi!' })
    const numericNames = Theme.define({ spacing: { '0x10px': '8px' } })
    numericNames.css({ padding: '0x10px!' })

    // @ts-expect-error Binary values also fail for units with overlapping suffixes.
    css({ height: '0b10dvh' })
  })
})

describe('css', () => {
  test('columns and fragmentation preserve property domains', () => {
    css({
      columnCount: ['auto', '2!'],
      columnWidth: '12rem',
      columnGap: 'normal',
      columnFill: 'balance',
    })
    css({
      breakAfter: 'page',
      breakBefore: 'column',
      breakInside: 'avoid',
      columnSpan: 'all',
      orphans: 2,
      widows: 3,
    })
    const theme = Theme.define({
      color: { rule: '#06c' },
      spacing: { gutter: '8px' },
    })
    theme.css({
      columnRuleColor: 'rule',
      columnRuleStyle: 'solid',
      columnRuleWidth: 'thin',
    })
    Config.create({ theme }).css({ columnRuleColor: theme.tokens.color.rule })
    // @ts-expect-error Column widths exclude percentages.
    css({ columnWidth: '10%' })
    // @ts-expect-error Counts cannot use arbitrary keywords.
    css({ columnCount: 'none' })
    // @ts-expect-error Rule widths exclude percentages.
    css({ columnRuleWidth: '5%' })
    // @ts-expect-error Inside breaks cannot force a new column.
    css({ breakInside: 'column' })
    // @ts-expect-error Column widths do not accept percentage-capable spacing tokens.
    theme.css({ columnWidth: theme.tokens.spacing.gutter })
    // @ts-expect-error Legacy regions remain deferred.
    css({ breakAfter: 'region' })
  })
})

describe('css', () => {
  test('layout and containment accept finite CSS domains', () => {
    css({
      backfaceVisibility: 'hidden',
      boxDecorationBreak: 'slice',
      clear: 'inline-end',
      contain: 'paint',
      contentVisibility: 'auto',
    })
    css({
      display: 'table-cell',
      float: 'inline-start',
      isolation: 'isolate',
      objectFit: 'scale-down',
      transformStyle: 'preserve-3d',
      zIndex: ['auto', '-1!'],
    })
    Config.create().css({ zIndex: 2, display: 'flow-root' })
    Theme.define({}).css({ contain: 'strict', objectFit: 'contain' })
    // @ts-expect-error Containment combinations are a later grammar expansion.
    css({ contain: 'layout paint' })
    // @ts-expect-error Floats are not centering controls.
    css({ float: 'center' })
    // @ts-expect-error Object fit has no auto keyword.
    css({ objectFit: 'auto' })
    // @ts-expect-error Stacking accepts unitless integers, not lengths.
    css({ zIndex: '2px' })
    // @ts-expect-error Isolation does not accept blend modes.
    css({ isolation: 'multiply' })
    // @ts-expect-error Multi-keyword display remains deferred.
    css({ display: 'inline flow-root' })
  })
})

describe('css', () => {
  test('background and color controls preserve token and keyword domains', () => {
    css({
      backgroundAttachment: 'fixed',
      backgroundBlendMode: 'multiply',
      backgroundClip: 'text',
      backgroundOrigin: 'content-box',
    })
    css({
      backgroundPositionX: '-2px',
      backgroundPositionY: '40%',
      backgroundRepeat: 'repeat-x',
      backgroundSize: ['auto', 'cover!'],
      mixBlendMode: 'plus-lighter',
    })
    const theme = Theme.define({
      color: { auto: '#06c' },
      spacing: { gap: '2px' },
    })
    theme.css({ accentColor: 'auto', caretColor: theme.tokens.color.auto })
    Config.create({ theme }).css({
      colorScheme: 'only dark',
      forcedColorAdjust: 'none',
      printColorAdjust: 'exact',
    })
    // @ts-expect-error Background position axes use different side keywords.
    css({ backgroundPositionX: 'top' })
    // @ts-expect-error Image lists remain deferred.
    css({ backgroundAttachment: 'scroll, fixed' })
    // @ts-expect-error Two-axis background sizes remain deferred.
    css({ backgroundSize: '10px 20px' })
    // @ts-expect-error Color controls do not accept length tokens.
    theme.css({ accentColor: theme.tokens.spacing.gap })
    // @ts-expect-error A blend mode is not a color value.
    css({ caretColor: 'multiply' })
    // @ts-expect-error Background geometry does not map spacing tokens.
    theme.css({ backgroundPositionX: theme.tokens.spacing.gap })
  })
})

describe('css', () => {
  test('supports paint tokens and bounded SVG domains', () => {
    css({
      fill: 'none',
      stroke: '#06c',
      fillOpacity: 0.5,
      strokeWidth: '2px',
      strokeDashoffset: '-5%',
      strokeLinecap: 'round',
      strokeLinejoin: 'bevel',
      strokeMiterlimit: 2,
      fillRule: 'evenodd',
      clipRule: 'nonzero',
      paintOrder: 'stroke',
      shapeRendering: 'crispEdges',
      textRendering: 'optimizeLegibility',
      vectorEffect: 'non-scaling-stroke',
      colorInterpolationFilters: 'linearRGB',
      floodColor: 'black',
      floodOpacity: 0.2,
      lightingColor: 'white',
      strokeOpacity: 0.5,
    })
    const zyzz = Config.create({ theme: { color: { ink: '#06c' } } })
    zyzz.css({ fill: 'ink', stroke: zyzz.theme.tokens.color.ink })
    // @ts-expect-error Paint servers require URL syntax support.
    css({ fill: 'url(#gradient)' })
    // @ts-expect-error Multi-keyword paint order remains deferred.
    css({ paintOrder: 'stroke fill' })
    // @ts-expect-error Widths require units except for zero.
    css({ strokeWidth: 2 })
    // @ts-expect-error Scalar paint keywords do not apply to filter colors.
    css({ floodColor: 'none' })
  })
})

describe('css', () => {
  test('supports bounded typography and emphasis tokens', () => {
    css({
      fontKerning: 'normal',
      fontOpticalSizing: 'auto',
      fontStretch: 'semi-expanded',
      fontSynthesisSmallCaps: 'none',
      fontSynthesisStyle: 'auto',
      fontSynthesisWeight: 'none',
      fontVariantCaps: 'all-small-caps',
      fontVariantEastAsian: 'jis04',
      fontVariantLigatures: 'no-common-ligatures',
      fontVariantNumeric: 'tabular-nums',
      fontVariantPosition: 'super',
      rubyAlign: 'space-around',
      rubyPosition: 'alternate over',
      textCombineUpright: 'all',
      textEmphasisColor: '#06c',
      textEmphasisPosition: 'over right',
      textEmphasisStyle: 'open sesame',
      textJustify: 'inter-character',
      textOrientation: 'upright',
    })
    const zyzz = Config.create({ theme: { color: { accent: '#06c' } } })
    zyzz.css({ textEmphasisColor: 'accent' })
    // @ts-expect-error Combined font variants remain deferred.
    css({ fontVariantNumeric: 'tabular-nums slashed-zero' })
    // @ts-expect-error Custom emphasis strings remain deferred.
    css({ textEmphasisStyle: '"*"' })
    // @ts-expect-error Font stretch percentages remain deferred.
    css({ fontStretch: '120%' })
    // @ts-expect-error Conflicting emphasis fill keywords are invalid.
    css({ textEmphasisStyle: 'open filled' })
  })
})

describe('css', () => {
  test('supports dimensioned times and finite motion keywords', () => {
    css({
      animationDelay: '-.5s',
      animationDuration: ['auto', '250ms!'],
      animationDirection: 'alternate',
      animationFillMode: 'both',
      animationIterationCount: [2.5, 'infinite'],
      animationPlayState: 'paused',
      animationTimingFunction: 'ease-in-out',
      transitionDelay: '-1e2ms',
      transitionDuration: '0s',
      transitionTimingFunction: 'linear',
      transitionBehavior: 'allow-discrete',
    })
    // @ts-expect-error Even zero times require a unit.
    css({ animationDuration: 0 })
    // @ts-expect-error Times cannot use length units.
    css({ transitionDelay: '2px' })
    // @ts-expect-error Nondecimal times are not CSS dimensions.
    css({ animationDelay: '0x10s' })
    // @ts-expect-error Multiple transitions require list support.
    css({ transitionDuration: '1s, 2s' })
    // @ts-expect-error Transition duration has no auto keyword.
    css({ transitionDuration: 'auto' })
  })
})

describe('grid tracks and placement', () => {
  test('supports flexible tracks and bounded line placement', () => {
    css({
      gridAutoColumns: '1fr',
      gridAutoRows: '40px',
      gridAutoFlow: 'column dense',
      gridTemplateColumns: 'min-content',
      gridTemplateRows: 'subgrid',
      gridColumnStart: [1, '2!'],
      gridColumnEnd: 'span 2',
      gridRowStart: -1,
      gridRowEnd: 'auto',
    })
    // @ts-expect-error Track lists require structural grammar support.
    css({ gridTemplateColumns: '1fr 2fr' })
    // @ts-expect-error Flexible units are limited to grid tracks.
    css({ width: '1fr' })
    // @ts-expect-error Spans cannot contain fractional counts.
    css({ gridColumnStart: 'span 1.5' })
    // @ts-expect-error Nondecimal fractional units are not CSS dimensions.
    css({ gridAutoColumns: '0x10fr' })
    // @ts-expect-error Named grid lines remain deferred.
    css({ gridRowStart: 'header' })
  })
})

describe('mask and image properties', () => {
  test('supports bounded masks and scalar positioning', () => {
    css({
      backgroundPosition: 'right',
      imageRendering: 'pixelated',
      maskClip: 'padding-box',
      maskComposite: 'exclude',
      maskMode: 'alpha',
      maskOrigin: 'content-box',
      maskPosition: '50%',
      maskRepeat: 'no-repeat',
      maskSize: 'cover',
      maskType: 'luminance',
      objectPosition: 'bottom',
      perspective: '300px',
      perspectiveOrigin: 'center',
      shapeMargin: '5%',
      transformBox: 'border-box',
      transformOrigin: '-5px',
    })
    // @ts-expect-error Mask lists remain deferred.
    css({ maskMode: 'alpha, luminance' })
    // @ts-expect-error Perspective distances exclude percentages.
    css({ perspective: '50%' })
    // @ts-expect-error Paired mask sizes remain deferred.
    css({ maskSize: '50% 100%' })
    // @ts-expect-error Multi-axis origin positions remain deferred.
    css({ transformOrigin: 'left top' })
  })
})

describe('list and input controls', () => {
  test('supports list markers, logical overscroll, and touch combinations', () => {
    css({
      appearance: 'none',
      lineBreak: 'strict',
      listStylePosition: 'inside',
      listStyleType: 'upper-roman',
      overflowAnchor: 'none',
      overscrollBehaviorBlock: 'contain',
      overscrollBehaviorInline: 'none',
      scrollbarWidth: 'thin',
      tabSize: 4,
      textSizeAdjust: 'none',
      textSpacingTrim: 'space-all',
      touchAction: 'pinch-zoom pan-left pan-up',
      unicodeBidi: 'plaintext',
    })
    // @ts-expect-error Conflicting directions cannot share a touch-action group.
    css({ touchAction: 'pan-left pan-right' })
    // @ts-expect-error Auto does not combine with gestures.
    css({ touchAction: 'auto pinch-zoom' })
    // @ts-expect-error Custom counter styles remain deferred.
    css({ listStyleType: 'custom-counter' })
    // @ts-expect-error Length-based tab stops remain deferred.
    css({ tabSize: '20px' })
    // @ts-expect-error Text autoscaling percentages remain deferred.
    css({ textSizeAdjust: '100%' })
  })
})

describe('css', () => {
  test('accepts canonical named colors throughout color and token domains', () => {
    css({
      color: 'rebeccapurple',
      backgroundColor: 'aliceblue',
      borderColor: 'red',
      accentColor: 'coral',
      caretColor: 'tomato',
      fill: 'gold',
      stroke: 'navy',
      columnRuleColor: 'gray',
      textDecorationColor: 'grey',
      textEmphasisColor: 'papayawhip',
    })
    const zyzz = Config.create({
      theme: {
        color: { red: 'blue', accent: { dark: 'gold', light: 'navy' } },
      },
    })
    zyzz.css({
      color: 'red',
      backgroundColor: zyzz.theme.tokens.color.red,
      fill: 'accent',
    })
    // @ts-expect-error Unknown color names remain outside the domain.
    css({ color: 'not-a-color' })
    // @ts-expect-error Mixed-case keyword spellings remain deferred.
    css({ color: 'rEbEcCaPuRpLe' })
  })
})

describe('css', () => {
  test('accepts canonical system colors in literals and theme schemes', () => {
    css({
      color: 'CanvasText',
      backgroundColor: 'Canvas',
      borderColor: 'ButtonBorder',
      accentColor: 'AccentColor',
      caretColor: 'Highlight',
      fill: 'SelectedItem',
    })
    Config.create({
      theme: { color: { ink: { dark: 'CanvasText', light: 'FieldText' } } },
    })
  })
})

describe('css', () => {
  test('accepts container and intrinsic field sizing controls', () => {
    css({
      containerType: ['normal', 'inline-size scroll-state!'],
      fieldSizing: 'content',
      interpolateSize: 'allow-keywords',
    })
    css({
      containerType: 'scroll-state size',
      fieldSizing: 'fixed',
      interpolateSize: 'numeric-only',
    })
    // @ts-expect-error Size modes are mutually exclusive.
    css({ containerType: 'size inline-size' })
    // @ts-expect-error Normal cannot be combined with containment modes.
    css({ containerType: 'normal scroll-state' })
    // @ts-expect-error Field sizing has no auto keyword.
    css({ fieldSizing: 'auto' })
    // @ts-expect-error Interpolation is an explicit keyword policy.
    css({ interpolateSize: true })
  })
})
