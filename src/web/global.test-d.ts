/** Checks global authoring contexts through the public API. @module */
import { describe, test } from 'vite-plus/test'
import { global } from 'zyzz/web'
describe('global', () => {
  test('checks grouping contexts', () => {
    global({
      '@scope': { body: { color: 'red' } },
      '@media\nscreen': { body: { color: 'red' } },
      '@supports(display:grid)': { body: { display: 'grid' } },
    })
    // @ts-expect-error descriptor rules are not grouping blocks
    global({ '@font-face': { body: { color: 'red' } } })
  })
})
