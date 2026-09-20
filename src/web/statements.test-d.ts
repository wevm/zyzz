/** Checks statement options and computed query/function authoring through public imports. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { style } from 'zyzz'

import { cssFunction, customMedia, importCss, namespace } from 'zyzz/web'

describe('statements', () => {
  test('preserves query keys and typed function parameters', () => {
    const compact = customMedia('(width < 40rem)')
    style({ [compact]: { color: 'red' } })
    const twice = cssFunction({
      parameters: [{ name: '--amount', syntax: '<number>' }],
      returns: '<number>',
      body: { result: 'calc(var(--amount) * 2)' },
    })
    expectTypeOf(twice(2)).toExtend<`--${string}(${string})`>()
    style({ opacity: twice(2) })
    const width = cssFunction({
      parameters: [],
      returns: '<length>',
      body: { result: '2px' },
    })
    style({ width: width() })
    // @ts-expect-error A length result cannot be used as a color.
    style({ color: width() })
    // @ts-expect-error Numeric parameters reject length strings.
    twice('2px')
    importCss({
      url: './base.css',
      layer: true,
      media: 'screen',
      supports: 'display: grid',
    })
    namespace({ prefix: 'svg', uri: 'http://www.w3.org/2000/svg' })
    // @ts-expect-error Import conditions cannot be arbitrary options.
    importCss({ url: './base.css', when: true })
    // @ts-expect-error Native function bodies do not contain element declarations.
    cssFunction({ parameters: [], body: { color: 'red' } })
  })
})
