/** Verifies every page-margin context through source, packed dependencies, and source maps. @module */
import * as Trace from '@jridgewell/trace-mapping'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'
import * as Margins from '../../test/fixtures/PageMargins.js'

describe('compile', () => {
  test('retains every margin box and its source call through a packed library dependency', () => {
    const source = Margins.source('before')
    const direct = Transform.compile({ moduleId: 'pages.ts', source })
    const library = Graph.compile({
      imports: {
        'index.ts': { './pages.js': 'pages.ts' },
        'pages.ts': { 'zyzz/web': null },
      },
      modules: {
        'index.ts': `import './pages.js';`,
        'pages.ts': source,
      },
    })
    const packed = Graph.compile({
      contracts: {
        'lib/index.js': library.contracts['index.ts']!,
        'lib/pages.js': library.contracts['pages.ts']!,
      },
      imports: {
        'app.ts': { lib: 'lib/index.js' },
        'lib/index.js': { './pages.js': 'lib/pages.js' },
      },
      modules: { 'app.ts': `import 'lib';` },
    })

    for (const [css, map, owner] of [
      [direct.css, direct.cssMap, 'pages.ts'],
      [packed.sharedCss!, packed.sharedCssMap!, 'lib/pages.ts'],
    ] as const) {
      const trace = new Trace.TraceMap(map)
      for (const [index, box] of Margins.boxes.entries()) {
        const offset = css.indexOf(`${box}{`)
        expect(offset >= 0).toMatchInlineSnapshot('true')
        expect(
          css
            .slice(offset)
            .startsWith(`${box}{content:"before-${index}";color:red;}`),
        ).toMatchInlineSnapshot('true')

        const prefix = css.slice(0, offset).split('\n')
        const origin = Trace.originalPositionFor(trace, {
          column: prefix.at(-1)!.length,
          line: prefix.length,
        })
        expect(origin.source === owner).toMatchInlineSnapshot('true')
        expect(origin.line === index + 2).toMatchInlineSnapshot('true')
        expect(origin.column).toMatchInlineSnapshot('0')
      }
    }
  })
})
