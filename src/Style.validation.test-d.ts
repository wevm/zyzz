/** Checks static declaration constraints through public authoring APIs. @module */
import { describe, test } from 'vite-plus/test'
import { css, Style, Theme } from 'zyzz'

describe('define', () => {
  test('checks hex digits and lengths through fallbacks and importance', () => {
    Style.define({
      card: { color: ['#AbC', '#abcd', '#123456', '#12345678!'] },
    })
    css({ color: '#abc !important' })
    // @ts-expect-error Hex colors require 3, 4, 6, or 8 digits.
    css({ color: '#12' })
    // @ts-expect-error Hex colors cannot contain non-hex digits.
    Style.define({ card: { color: '#12g456' } })
    // @ts-expect-error Importance retains hex constraints.
    css({ color: ['red', '#12345!'] })
    // @ts-expect-error Hex colors cannot exceed eight digits.
    css({ color: '#123456789' })
  })

  test('checks integer and nonnegative literals without restricting clamped alpha', () => {
    css({ opacity: -1, order: -2, padding: 0, transitionDelay: '-1s' })
    css({ padding: '-0px', transitionDuration: '-0s' })
    // @ts-expect-error Percentages preserve nonnegative property bounds.
    css({ fontWidth: '-1%' })
    // @ts-expect-error Order is an integer.
    css({ order: 0.5 })
    // @ts-expect-error Importance retains integer constraints.
    css({ order: '1.5!' })
    // @ts-expect-error Padding does not accept a negative literal.
    Style.define({ card: { padding: '-1px' } })
    // @ts-expect-error Duration does not accept a negative literal.
    css({ animationDuration: ['1s', '-1s!'] })
    // @ts-expect-error Flex growth is nonnegative.
    css({ flexGrow: -1 })
    // @ts-expect-error Column count is positive.
    css({ columnCount: 0 })
  })
})

describe('define theme', () => {
  test('preserves named tokens and validates concrete token colors', () => {
    const theme = Theme.define({
      color: { brand: '#123456' },
      spacing: { 4: '1rem' },
    })

    theme.css({ color: 'brand', padding: 4 })
    // @ts-expect-error Concrete theme colors retain hex constraints.
    Theme.define({ color: { brand: '#12345' } })
    // @ts-expect-error Bound authoring retains integer constraints.
    theme.css({ order: 0.5 })
    // @ts-expect-error Explicit color tokens cannot be used as spacing.
    Style.define({ card: { padding: theme.tokens.color.brand } })
  })
})

describe('image declarations', () => {
  test('types image functions, URL-only markers, and fallback importance', () => {
    css({
      backgroundImage: ['url("image.png")', 'linear-gradient(red, blue)!'],
      markerEnd: 'url(#arrow)',
      maskImage: 'none, url(#mask)',
    })
    // @ts-expect-error Markers require a URL or none.
    css({ marker: 'linear-gradient(red, blue)' })
    // @ts-expect-error Image values cannot be a bare color.
    css({ backgroundImage: 'red' })
    // @ts-expect-error Image sources do not accept numeric lengths.
    Style.define({ card: { borderImageSource: 4 } })
  })
})
