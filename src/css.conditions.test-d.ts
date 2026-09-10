/** Checks recursive declaration inference, exact query aliases, and nested error boundaries. @module */
import { describe, test } from 'vite-plus/test'
import { css, Theme } from 'zyzz'

describe('css', () => {
  test('retains recursive literal and bound contracts', () => {
    css({
      '--escaped\\&name': 'red',
      '@container style(--active: true)': { color: 'red' },
      '@container sidebar style(--active: true)': { color: 'red' },
    })
    Theme.define({ breakpoints: { 640: '40rem' } }).css({
      '@media 640': { color: 'red' },
    })
    // @ts-expect-error Concrete undefined conditions are rejected.
    css({ ':hover': undefined })
    css({
      ':hover': { color: 'red' },
      '&[data-active]': { opacity: 0.5 },
      '@media (width >= 800px)': { display: 'grid' },
    })
    const theme = Theme.define({
      breakpoints: { tablet: '48rem', desktop: '64rem' },
      containers: { card: '24rem' },
      containerNames: ['sidebar'],
      spacing: { gap: '4px' },
    })
    theme.css({
      '@media tablet..desktop': { ':hover': { padding: 'gap' } },
      '@container sidebar >=card': { display: 'grid' },
    })
    theme.css((values: { alpha: number }) => ({
      ':hover': { opacity: values.alpha },
    }))
    // @ts-expect-error Bare aliases must belong to this theme.
    theme.css({ '@media missing': { display: 'grid' } })
    // @ts-expect-error Root authoring has no aliases.
    css({ '@media tablet': { display: 'grid' } })
    // @ts-expect-error Nested property names remain exact.
    css({ ':hover': { colour: 'red' } })
    // @ts-expect-error Nested numeric lengths remain invalid.
    theme.css({ '@media tablet': { width: 10 } })
    // @ts-expect-error Nested token domains cannot cross properties.
    theme.css({ ':hover': { color: theme.tokens.spacing.gap } })
  })
})
