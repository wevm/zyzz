/** Verifies compound and custom-property authoring through the public API. @module */
import { describe, test } from 'vite-plus/test'
import { Config, css, Style, Theme } from 'zyzz'

describe('css', () => {
  test('accepts every compound fixture through public style definitions', () => {
    css({
      animation: 'fade 1s ease',
      background: 'url(image.png) center / cover no-repeat red',
      boxShadow: 'inset 0 0 2px red, 2px 3px 4px blue',
      fill: 'url(#gradient) red',
      font: 'italic 16px/1.5 sans-serif',
      grid: '100px / 1fr 2fr',
      maskSize: '10px 20px, contain',
      transition: 'opacity 200ms ease-in',
      shapeImageThreshold: [-1, 2, '50%'],
      strokeDashoffset: -2,
    })
  })

  test('preserves custom-property scalars, case, fallbacks, and importance', () => {
    css({
      '--Accent': '#arbitrary-text',
      '--accent': ['red', 'blue!'],
      '--count': 2,
      '--empty': '',
    })
    Style.define({ card: { '--data': '"a;b:c"', color: 'var(--Accent)' } })
    // @ts-expect-error Custom declarations are CSS scalars.
    css({ '--enabled': true })
    // @ts-expect-error Custom declarations cannot contain records.
    css({ '--data': { value: 'red' } })
    // @ts-expect-error Arbitrary non-custom properties remain rejected.
    css({ backgroundColour: 'red' })
    // @ts-expect-error Ordinary property validation is retained beside custom properties.
    css({ '--accent': 'red', padding: 'red' })
  })

  test('accepts case-insensitive literals while keeping tokens case-sensitive', () => {
    css({
      color: '  ReD\t',
      display: 'FlEx',
      padding: ' 2PX\n! ImPoRtAnT  ',
      transform: 'RoTaTe(45DEG)',
    })
    Style.define({
      card: { color: ['BLUE', 'ReD!', '#ABC!ImPoRtAnT'], margin: '1EM' },
    })
    const theme = Theme.define({
      color: { Brand: 'blue' },
      spacing: { Gap: '2px' },
    })
    theme.css({ color: 'ReD', padding: '2PX' })
    theme.css({ color: 'Brand', padding: 'Gap' })
    Config.create({ theme, layers: ['components'] }).css({
      '@layer components': { color: 'ReD', padding: '2PX' },
    })
    // @ts-expect-error Case folding cannot make an unknown keyword valid.
    css({ display: 'FleEx' })
    // @ts-expect-error Hex checks still apply to mixed-case authoring.
    css({ color: '#ABG' })
    // @ts-expect-error Unit case does not bypass nonnegative dimensions.
    css({ padding: '-1PX' })
    // @ts-expect-error Surrounding whitespace does not bypass nonnegative dimensions.
    css({ padding: ' -1PX ! important  ' })
    // @ts-expect-error Keyword case does not bypass integer grid spans.
    css({ gridColumnStart: 'SPAN 1.5' })
    // @ts-expect-error Named theme tokens retain their original case.
    theme.css({ color: 'brand' })
    // @ts-expect-error Case-insensitive literals do not change token domains.
    theme.css({ padding: 'Brand' })
  })

  test('accepts CSS whitespace separators and equivalent zero spellings', () => {
    css({
      display: 'BlOcK\tFlow',
      alignItems: 'FiRsT\nBaSeLiNe',
      overflow: 'hidden\tauto',
    })
    css({
      padding: ['0e3', '-.0', '+00', '00.00!', '0e3 1px'],
      borderRadius: '0e3/0',
    })
    // @ts-expect-error Whitespace cannot split a numeric token from its unit.
    css({ padding: '1\tpx' })
    // @ts-expect-error Whitespace normalization retains integer span constraints.
    css({ gridColumnStart: 'SPAN\t1.5' })
    // @ts-expect-error Numeric normalization cannot turn an exponent token into an integer token.
    css({ order: '0e3!' })
    // @ts-expect-error Time values still require units even for zero.
    css({ animationDelay: '0e3!' })
  })

  test('accepts CSS identifier escapes without changing numeric token boundaries', () => {
    css({ color: '\\72 ed', display: 'bl\\6f ck', padding: '1\\70 x' })
    css({ color: '#\\66 00', display: 'block/**/flow' })
    css({ color: 'red/**/!impor\\74 ant/**/' })
    // @ts-expect-error An escaped identifier cannot become a numeric dimension.
    css({ padding: '\\31 px' })
    // @ts-expect-error An escaped unit prefix cannot become a numeric exponent.
    css({ padding: '1\\65 2px' })
    // @ts-expect-error Escapes retain nonnegative dimension constraints.
    css({ padding: '-1\\70 x' })
    // @ts-expect-error Escaped punctuation does not create a hash token.
    css({ color: '\\23 abc' })
    // @ts-expect-error CSS keyword folding is ASCII-only.
    css({ color: 'blacK' })
  })

  test('preserves CSS numeric spelling and range constraints', () => {
    css({
      padding: ['01px', '+.5px', '1e2px', '-0px'],
      order: '+01!',
      opacity: '1e-1!',
    })
    // @ts-expect-error Leading zeroes do not bypass a nonnegative range.
    css({ padding: '-01px' })
    // @ts-expect-error CSS fractional syntax requires a digit after the dot.
    css({ padding: '1.px' })
    // @ts-expect-error JavaScript radix spellings do not become CSS dimensions with a sign.
    css({ padding: '+0x10px' })
    // @ts-expect-error Exponent number tokens are not integer tokens.
    css({ order: '1e0!' })
    // @ts-expect-error Positive integer properties cannot use a zero mantissa.
    css({ columnCount: '+00!' })
    // @ts-expect-error A trailing decimal point does not form a complete CSS number.
    css({ opacity: '1.!' })
  })

  test('retains CSS integer spelling in grid indexes and named spans', () => {
    css({
      gridColumnEnd: 'span +01',
      gridColumn: '-01 / span 02 content',
      gridRow: 'header 2 / footer -1',
    })
    css({ gridColumnStart: 'calc(1 + 2)', gridColumnEnd: 'span calc(1 + 2)' })
    // @ts-expect-error Grid indexes are nonzero integers.
    css({ gridRowStart: 0 })
    // @ts-expect-error Named spans retain integer constraints.
    css({ gridColumnEnd: 'span 1.5 content' })
    // @ts-expect-error Span counts must be positive even when a name comes first.
    css({ gridColumnEnd: 'content span -1' })
    // @ts-expect-error Every slash-separated index retains its constraints.
    css({ gridArea: '1 / 0 / 2 / 3' })
    // @ts-expect-error Placement longhands accept one line.
    css({ gridRowStart: '1 / 2' })
    // @ts-expect-error Row and column shorthands accept at most two lines.
    css({ gridColumn: '1 / 2 / 3' })
    // @ts-expect-error Area shorthands accept at most four lines.
    css({ gridArea: '1 / 2 / 3 / 4 / 5' })
    // @ts-expect-error Dimension tokens cannot be grid line indexes.
    css({ gridRowStart: '1px' })
    // @ts-expect-error Exponent tokens do not become CSS integer tokens.
    css({ gridColumnEnd: 'span 1e0 content' })
  })

  test('rejects wrong compound domains through fallbacks and importance', () => {
    // @ts-expect-error Shadows require dimensions or colors.
    css({ boxShadow: 'wobbly' })
    // @ts-expect-error Font feature settings require quoted tags.
    css({ fontFeatureSettings: 'kern' })
    // @ts-expect-error Filters require a recognized function or URL.
    css({ filter: 'red!' })
    // @ts-expect-error Path data requires a path function.
    css({ d: 'M0 0L20 20' })
    // @ts-expect-error Quotation strings are paired.
    css({ quotes: '"one"' })
    // @ts-expect-error Shape declarations do not accept arbitrary numbers.
    css({ clipPath: 12 })
    // @ts-expect-error Importance retains filter constraints inside fallbacks.
    css({ backdropFilter: ['blur(2px)', 'wobbly!'] })
    // @ts-expect-error Path lengths exclude percentages.
    css({ pathLength: '50%' })
  })
})
