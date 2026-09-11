/** Verifies scalar parameter domains through the public CSS function helper. @module */
import { describe, test } from 'vite-plus/test'
import { cssFunction } from 'zyzz/web'
describe('cssFunction', () => {
  test('checks every supported scalar parameter syntax', () => {
    const fn = cssFunction({
      parameters: [
        { name: '--c', syntax: '<color>' },
        { name: '--l', syntax: '<length>' },
        { name: '--p', syntax: '<length-percentage>' },
        { name: '--a', syntax: '<angle>' },
        { name: '--t', syntax: '<time>' },
      ],
      body: { result: 1 },
    })
    fn('red', '1pc', '2%', '1turn', '20ms')
    // @ts-expect-error colors reject lengths
    fn('1px', '1pc', '2%', '1turn', '20ms')
    // @ts-expect-error lengths exclude percentages
    fn('red', '1%', '2%', '1turn', '20ms')
    // @ts-expect-error length-percentage rejects color keywords
    fn('red', '1pc', 'red', '1turn', '20ms')
    // @ts-expect-error angles require angular units
    fn('red', '1pc', '2%', '1px', '20ms')
    // @ts-expect-error times require time units
    fn('red', '1pc', '2%', '1turn', 'red')
  })
})
