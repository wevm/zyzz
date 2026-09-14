/** Verifies CSS output and source locations across optional compilation paths. @module */
import * as Trace from '@jridgewell/trace-mapping'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

describe('compile', () => {
  test.each(['atomic', 'grouped'] as const)(
    'maps %s declarations with either compiler setting',
    (cssOutput) => {
      const source = `import { Config } from 'zyzz';
const { css } = Config.create({ cssOutput: '${cssOutput}' });
export const card = css({
  color: 'red',
  padding: '8px',
});`
      for (const compiler of [false, true]) {
        const result = Transform.compile({
          compiler,
          moduleId: 'card.ts',
          source,
        })
        const map = new Trace.TraceMap(result.cssMap)

        for (const [property, line] of [
          ['color:red', 4],
          ['padding:8px', 5],
        ] as const) {
          const offset = result.css.indexOf(property)
          const prefix = result.css.slice(0, offset).split('\n')
          const original = Trace.originalPositionFor(map, {
            column: prefix.at(-1)!.length,
            line: prefix.length,
          })

          expect(original.source).toMatchInlineSnapshot('"card.ts"')
          expect(original.line === line).toMatchInlineSnapshot('true')
          expect(original.column).toMatchInlineSnapshot('2')
        }
      }
    },
  )

  test.each([false, true])(
    'invalidates imported output config with compiler=%s',
    (compiler) => {
      const graph = Graph.create()
      const source = `import { css } from './config.js'; export const card = css({ color: 'red', padding: '8px' });`
      const compile = (cssOutput: string) =>
        graph.compile({
          compiler,
          modules: {
            'card.ts': source,
            'config.ts': `import { Config } from 'zyzz'; export const { css } = Config.create({ cssOutput: '${cssOutput}' });`,
          },
        }).modules['card.ts']!
      const atomic = compile('atomic')
      const grouped = compile('grouped')
      const restored = compile('atomic')

      expect(
        atomic.css.includes('color:red;padding:8px;'),
      ).toMatchInlineSnapshot('false')
      expect(
        grouped.css.includes('color:red;padding:8px;'),
      ).toMatchInlineSnapshot('true')
      expect(restored.css === atomic.css).toMatchInlineSnapshot('true')
      expect(restored.code === atomic.code).toMatchInlineSnapshot('true')
      expect(() => compile('invalid')).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: config.ts:54: cssOutput must be atomic or grouped.]`,
      )
    },
  )
})
