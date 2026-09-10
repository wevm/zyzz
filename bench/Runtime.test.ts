/**
 * Checks compiled runtime applications against browser styles and caller inputs.
 * @module
 */
import { describe, expect, test } from 'vite-plus/test'
import * as Runtime from './Runtime.js'

describe('create', () => {
  for (const kind of Runtime.cases)
    for (const library of Runtime.libraries)
      test(`${library} / ${kind} preserves styling through production compilation`, async () => {
        const options = { count: 10, kind, library }
        const output = await Runtime.create(options)
        await Runtime.verify(output, options)
        const input = { className: 'external', style: { color: '#123456', paddingLeft: '2px' } }
        const before = JSON.stringify(input)
        for (let index = 0; index < options.count; index++) {
          const props = output.apply(index, input)
          expect(typeof props.className).toMatchInlineSnapshot(`"string"`)
          if (kind === 'overrides') {
            expect(props.className.endsWith(' external')).toMatchInlineSnapshot(`true`)
            expect(props.style).toMatchInlineSnapshot(`
              {
                "color": "#123456",
                "paddingLeft": "2px",
              }
            `)
          }
        }
        expect(JSON.stringify(input) === before).toMatchInlineSnapshot(`true`)
      }, 30_000)
})
