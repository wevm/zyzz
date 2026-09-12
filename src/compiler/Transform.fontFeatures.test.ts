/** Verifies the complete feature alias corpus across source and packed boundaries. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as FontFeatures from '../../test/fixtures/FontFeatures.js'
import { Graph, Transform } from 'zyzz/compiler'
import * as Trace from '@jridgewell/trace-mapping'

describe('compile', () => {
  test('retains every feature alias block and display keyword with packed maps', () => {
    for (const display of [
      'auto',
      'block',
      'fallback',
      'optional',
      'swap',
      ' SWAP ',
      '\\73 wap',
    ]) {
      const source = FontFeatures.source(1, display)
      const direct = Transform.compile({ moduleId: 'fonts.ts', source })
      const library = Graph.compile({ modules: { 'fonts.ts': source } })
      const packed = Graph.compile({
        contracts: { 'lib/fonts.js': library.contracts['fonts.ts']! },
        imports: { 'app.ts': { lib: 'lib/fonts.js' } },
        modules: { 'app.ts': `import 'lib';` },
      })
      for (const [index, block] of FontFeatures.blocks.entries()) {
        expect(
          direct.css.includes(`${block}{alias${index}:`),
        ).toMatchInlineSnapshot('true')
        expect(
          packed.sharedCss?.includes(`${block}{alias${index}:`),
        ).toMatchInlineSnapshot('true')
      }
      expect(packed.sharedCss?.includes('font-display:')).toMatchInlineSnapshot(
        'true',
      )
      expect(
        Trace.originalPositionFor(new Trace.TraceMap(packed.sharedCssMap!), {
          line: 1,
          column: 0,
        }),
      ).toMatchInlineSnapshot(`
        {
          "column": 0,
          "line": 2,
          "name": null,
          "source": "lib/fonts.ts",
        }
      `)
    }
  })
  test('rejects invalid alias indices across every nested feature block', () => {
    for (const block of FontFeatures.blocks) {
      for (const value of [
        -1,
        1.5,
        [],
        [1, 2, 3, 4].filter(() => block !== '@styleset'),
      ]) {
        expect(() =>
          Transform.compile({
            moduleId: 'invalid.ts',
            source: `import {fontFeatureValues} from 'zyzz/web';fontFeatureValues({families:'Body',features:{${JSON.stringify(block)}:{alias:${JSON.stringify(value)}}}});`,
          }),
        ).toThrowErrorMatchingInlineSnapshot(
          `[Source.ExtractError: invalid.ts:43: Expected feature aliases with nonnegative integer indices.]`,
        )
      }
    }
  })
})
