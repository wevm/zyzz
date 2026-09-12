/** Verifies full statement condition products, query identity, and legacy matching syntax. @module */
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source } from 'zyzz/compiler'
import * as Statements from '../../test/fixtures/Statements.js'
import * as Trace from '@jridgewell/trace-mapping'

describe('compile', () => {
  test('retains import layer supports and media combinations with packed ordering and maps', () => {
    const library = Graph.compile({
      modules: { 'statements.ts': Statements.imports() },
    })
    const packed = Graph.compile({
      contracts: { 'lib/statements.js': library.contracts['statements.ts']! },
      imports: { 'app.ts': { lib: 'lib/statements.js' } },
      modules: { 'app.ts': `import 'lib';` },
    })
    expect(packed.sharedCss?.match(/@import/g)?.length).toMatchInlineSnapshot(
      '24',
    )
    expect(packed.sharedCss?.startsWith('@import')).toMatchInlineSnapshot(
      'true',
    )
    expect(packed.sharedCss?.includes('supports(')).toMatchInlineSnapshot(
      'true',
    )
    expect(packed.sharedCss?.includes('layer(')).toMatchInlineSnapshot('true')
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
        "source": "lib/statements.ts",
      }
    `)
  })
  test('retains custom-media query productions and imported computed references', () => {
    for (const query of Statements.queries) {
      const library = Graph.compile({
        modules: {
          'statements.ts': `import {customMedia} from 'zyzz/web';\nexport const query=customMedia(${JSON.stringify(query)});`,
        },
      })
      const packed = Graph.compile({
        contracts: { 'lib/statements.js': library.contracts['statements.ts']! },
        imports: { 'app.ts': { lib: 'lib/statements.js', 'zyzz/web': null } },
        modules: {
          'app.ts': `import {query} from 'lib';import {global} from 'zyzz/web';global({[query]:{body:{color:'red'}}});`,
        },
      })
      expect(
        packed.sharedCss?.includes('@custom-media --'),
      ).toMatchInlineSnapshot('true')
      expect(packed.sharedCss?.includes('@media (--')).toMatchInlineSnapshot(
        'true',
      )
      expect(
        Trace.originalPositionFor(new Trace.TraceMap(packed.sharedCssMap!), {
          line: 1,
          column: 0,
        }),
      ).toMatchInlineSnapshot(`
        {
          "column": 19,
          "line": 2,
          "name": null,
          "source": "lib/statements.ts",
        }
      `)
    }
  })
  test('retains legacy document matching functions across packed publication with maps', () => {
    for (const matching of Statements.documents) {
      const library = Graph.compile({
        modules: {
          'statements.ts': `import {global} from 'zyzz/web';\nglobal({'@document ${matching}':{body:{color:'red'}}});`,
        },
      })
      const packed = Graph.compile({
        contracts: { 'lib/statements.js': library.contracts['statements.ts']! },
        imports: { 'app.ts': { lib: 'lib/statements.js' } },
        modules: { 'app.ts': `import 'lib';` },
      })
      expect(packed.sharedCss?.includes('@document')).toMatchInlineSnapshot(
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
          "source": "lib/statements.ts",
        }
      `)
    }
  })
  test('rejects malformed queries and legacy matching functions before publication', () => {
    const failures = [
      `export const query=customMedia('???');`,
      `export const query=customMedia('(color); @import "bad.css"');`,
      `global({'@document garbage()':{body:{color:'red'}}});`,
      `global({'@document domain(123)':{body:{color:'red'}}});`,
      `importCss({url:'/a.css',supports:'???'});`,
    ].map((source) => {
      try {
        Graph.compile({
          modules: {
            'invalid.ts': `import {customMedia,global,importCss} from 'zyzz/web';${source}`,
          },
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
          "Invalid custom-media query: Mismatch
        syntax: <media-query-list>
         value: ???
        --------^",
        ],
        [
          "Invalid custom-media query: Mismatch
        syntax: <media-query-list>
         value: (color); @import "bad.css"
        ---------------^",
        ],
        [
          "Invalid document matching functions: Mismatch
        syntax: [ <url> | url-prefix( <string> ) | domain( <string> ) | media-document( <string> ) | regexp( <string> ) ]#
         value: garbage()
        --------^",
        ],
        [
          "Invalid document matching functions: Mismatch
        syntax: [ <url> | url-prefix( <string> ) | domain( <string> ) | media-document( <string> ) | regexp( <string> ) ]#
         value: domain(123)
        ---------------^",
        ],
        [
          "Unexpected token Delim('?')",
        ],
      ]
    `)
  })
})
