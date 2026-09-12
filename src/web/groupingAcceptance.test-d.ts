/** Checks grouping-rule authoring contexts through public web entrypoints. @module */
import { css } from 'zyzz'
import { describe, test } from 'vite-plus/test'
import { global } from 'zyzz/web'

describe('grouping rules', () => {
  test('accepts standard grouping productions in global and style contexts', () => {
    global({ '@document domain("example.com")': { body: { color: 'red' } } })
    global({
      '@media only screen and (color)': { body: { color: 'red' } },
      '@supports selector(:has(.child))': { body: { color: 'red' } },
      '@container card style(--theme: dark)': { body: { color: 'red' } },
      '@container scroll-state(stuck: top)': { body: { color: 'red' } },
      '@scope (.root) to (.limit)': { body: { color: 'red' } },
      '@layer base.components': { body: { color: 'red' } },
      '@starting-style': { body: { opacity: 0 } },
    })
    css({
      '@media (1px < width < 1000px)': { color: 'red' },
      '@supports (display: grid) or (display: flex)': { display: 'grid' },
      '@container card (width > 1px)': { color: 'red' },
      '@scope to (.limit)': { color: 'red' },
      '@layer': { color: 'red' },
      '@starting-style': { opacity: 0 },
    })
    // @ts-expect-error descriptor rules are not global grouping contexts
    global({ '@font-face': { body: { color: 'red' } } })
    // @ts-expect-error page descriptor rules are not style grouping contexts
    css({ '@page': { color: 'red' } })
    // @ts-expect-error condition values are declaration objects
    css({ '@media (color)': 'red' })
    // @ts-expect-error starting-style does not have a prelude
    css({ '@starting-style invalid': { color: 'red' } })
  })
})
