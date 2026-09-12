/** Verifies grouping grammar, nesting, packed output, and source attribution. @module */
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source, Transform } from 'zyzz/compiler'
import * as GroupingRules from '../../test/fixtures/GroupingRules.js'
import * as Trace from '@jridgewell/trace-mapping'

describe('compile', () => {
  test('rejects malformed grouping productions at their source boundary', () => {
    const failures = [
      '@media ???',
      '@supports display:grid',
      '@container card',
      '@scope .root',
      '@layer a,b',
      '@starting-style invalid',
    ]
      .flatMap((header) => [
        `import {global} from 'zyzz/web';global({${JSON.stringify(header)}:{body:{color:'red'}}});`,
        `import {css} from 'zyzz';export const text=css({${JSON.stringify(header)}:{color:'red'}});`,
      ])
      .map((source) => {
        try {
          Transform.compile({
            moduleId: 'invalid.ts',
            source,
          })
          return 'accepted'
        } catch (error) {
          if (!(error instanceof Source.ExtractError)) throw error
          return error.diagnostics.map((diagnostic) => diagnostic.message)
        }
      })
    expect(failures).toMatchInlineSnapshot(`
      [
        [
          "Unexpected token Delim('?')",
        ],
        [
          "Unknown query threshold.",
        ],
        [
          "Unexpected token Ident("display")",
        ],
        [
          "Invalid selector or condition: Unexpected token Ident("display")",
        ],
        [
          "Container rules require a query after the optional name.",
        ],
        [
          "Unknown query threshold.",
        ],
        [
          "Unexpected token Delim('.')",
        ],
        [
          "Invalid selector or condition: Unexpected token Delim('.')",
        ],
        [
          "Invalid @ rule body",
        ],
        [
          "Invalid selector or condition: Invalid @ rule body",
        ],
        [
          "Expected a selector or supported grouping rule.",
        ],
        [
          "Expected a literal string or number; expressions are not evaluated.",
        ],
      ]
    `)
  })

  for (const [family, headers] of Object.entries(GroupingRules.rules)) {
    test(`preserves ${family} grammar in global and nested packed output with maps`, () => {
      for (const header of headers) {
        const source = GroupingRules.source(header)
        const direct = Transform.compile({ moduleId: 'groups.ts', source })
        const library = Graph.compile({ modules: { 'groups.ts': source } })
        const packed = Graph.compile({
          contracts: { 'lib/groups.js': library.contracts['groups.ts']! },
          imports: { 'app.ts': { lib: 'lib/groups.js' } },
          modules: { 'app.ts': `export {styles} from 'lib';` },
        })
        expect(direct.css.includes(header)).toMatchInlineSnapshot('true')
        expect(direct.css.includes('body{color:red;}')).toMatchInlineSnapshot(
          'true',
        )
        expect(
          packed.sharedCss?.includes('body{color:red;}'),
        ).toMatchInlineSnapshot('true')
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
            "source": "lib/groups.ts",
          }
        `)
      }
    })
  }
})
