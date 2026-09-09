/** Verifies compound and custom-property authoring through the public API. @module */
import { describe, test } from 'vite-plus/test'
import { css, Style } from 'zyzz'

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
