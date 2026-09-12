/** Verifies complete keyframe selector transport and reference ownership. @module */
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'
import * as Trace from '@jridgewell/trace-mapping'

describe('compile', () => {
  test('retains escaped stops exponent offsets and unrestricted timeline percentages through packed references', () => {
    for (const stop of [
      'FROM',
      '\\66 rom',
      '+0%,1e2%',
      'contain -20%',
      'cover 150%',
      'entry 20%',
      'entry-crossing 50%',
      'exit 100%',
      'exit-crossing 120%',
    ]) {
      const library = Graph.compile({
        modules: {
          'frames.ts': `import {keyframes} from 'zyzz/web';\nexport const fade=keyframes({${JSON.stringify(stop)}:{opacity:0},to:{opacity:1}},{within:['@layer motion','@media screen']});`,
        },
      })
      const packed = Graph.compile({
        contracts: { 'lib/frames.js': library.contracts['frames.ts']! },
        imports: { 'app.ts': { lib: 'lib/frames.js', 'zyzz/web': null } },
        modules: {
          'app.ts': `import {fade} from 'lib';import {global} from 'zyzz/web';global({body:{animationName:fade}});`,
        },
      })
      expect(packed.sharedCss?.includes('@keyframes')).toMatchInlineSnapshot(
        'true',
      )
      expect(
        packed.sharedCss?.includes('animation-name:z-'),
      ).toMatchInlineSnapshot('true')
      expect(
        Trace.originalPositionFor(new Trace.TraceMap(packed.sharedCssMap!), {
          line: 1,
          column: 0,
        }),
      ).toMatchInlineSnapshot(`
        {
          "column": 18,
          "line": 2,
          "name": null,
          "source": "lib/frames.ts",
        }
      `)
    }
  })
  test('rejects malformed and out-of-range ordinary frame selectors', () => {
    for (const stop of [
      '-1%',
      '101%',
      '0x10%',
      'entry',
      'unknown 50%',
      'from,',
      'from}body{color:red;',
    ]) {
      expect(() =>
        Transform.compile({
          moduleId: 'invalid.ts',
          source: `import {keyframes} from 'zyzz/web';export const fade=keyframes({${JSON.stringify(stop)}:{opacity:0}});`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: invalid.ts:53: Keyframe stops require from, to, 0–100% offsets, or named timeline percentages.]`,
      )
    }
  })
})
