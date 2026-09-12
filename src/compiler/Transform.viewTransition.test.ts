/** Verifies view-transition descriptor grammar and packed source ownership. @module */
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'
import * as Trace from '@jridgewell/trace-mapping'

describe('compile', () => {
  test('rejects invalid packed transition descriptors before parser recovery', () => {
    const library = Graph.compile({
      modules: {
        'transition.ts': `import {viewTransition} from 'zyzz/web';viewTransition({navigation:'auto',types:'slide'});`,
      },
    })
    {
      const contract = JSON.parse(library.contracts['transition.ts']!)
      contract.stylesheets[0].css = '@view-transition{types:slide,forwards}'
      expect(() =>
        Graph.compile({
          contracts: { 'lib.js': JSON.stringify(contract) },
          imports: { 'app.ts': { lib: 'lib.js' } },
          modules: { 'app.ts': `import 'lib';` },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: lib.js:0: Invalid library contract: Invalid view-transition descriptor.]`,
      )
    }
    {
      const contract = JSON.parse(library.contracts['transition.ts']!)
      contract.stylesheets[0].css = '@view-transition{types:none slide}'
      expect(() =>
        Graph.compile({
          contracts: { 'lib.js': JSON.stringify(contract) },
          imports: { 'app.ts': { lib: 'lib.js' } },
          modules: { 'app.ts': `import 'lib';` },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: lib.js:0: Invalid library contract: Invalid view-transition types.]`,
      )
    }
    {
      const contract = JSON.parse(library.contracts['transition.ts']!)
      contract.stylesheets[0].css = '@view-transition{navigation:always}'
      expect(() =>
        Graph.compile({
          contracts: { 'lib.js': JSON.stringify(contract) },
          imports: { 'app.ts': { lib: 'lib.js' } },
          modules: { 'app.ts': `import 'lib';` },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: lib.js:0: Invalid library contract: Invalid view-transition navigation.]`,
      )
    }
    {
      const contract = JSON.parse(library.contracts['transition.ts']!)
      contract.stylesheets[0].css = '@view-transition{unknown:auto}'
      expect(() =>
        Graph.compile({
          contracts: { 'lib.js': JSON.stringify(contract) },
          imports: { 'app.ts': { lib: 'lib.js' } },
          modules: { 'app.ts': `import 'lib';` },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: lib.js:0: Invalid library contract: Unknown view-transition descriptor.]`,
      )
    }
    {
      const contract = JSON.parse(library.contracts['transition.ts']!)
      contract.stylesheets[0].css = '@view-transition invalid{navigation:auto}'
      expect(() =>
        Graph.compile({
          contracts: { 'lib.js': JSON.stringify(contract) },
          imports: { 'app.ts': { lib: 'lib.js' } },
          modules: { 'app.ts': `import 'lib';` },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: lib.js:0: Invalid library contract: View-transition rules require a descriptor block and no prelude.]`,
      )
    }
  })
  test('validates transition identifiers and preserves conditional packed descriptors', () => {
    for (const types of [
      'none',
      'NONE',
      'slide forwards',
      '\\73 lide 图',
      'slide/**/forwards',
      'slide slide',
    ]) {
      const source = `import {viewTransition} from 'zyzz/web';\nviewTransition({navigation:${JSON.stringify('\\61 uto')},types:${JSON.stringify(types)}},{within:['@layer transitions','@media (width > 1px)','@supports (color: red)','@container (width > 1px)']});`
      const direct = Transform.compile({ moduleId: 'transition.ts', source })
      const library = Graph.compile({ modules: { 'transition.ts': source } })
      const packed = Graph.compile({
        contracts: { 'lib/transition.js': library.contracts['transition.ts']! },
        imports: { 'app.ts': { lib: 'lib/transition.js' } },
        modules: { 'app.ts': `import 'lib';` },
      })
      expect(direct.css.includes('types:')).toMatchInlineSnapshot('true')
      expect(packed.sharedCss?.includes('types:')).toMatchInlineSnapshot('true')
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
          "source": "lib/transition.ts",
        }
      `)
    }
  })

  test('rejects malformed transition types and forbidden enclosing contexts', () => {
    for (const types of [
      '',
      'none slide',
      'slide NONE',
      'inherit',
      'initial',
      'unset',
      'revert',
      'revert-layer',
      'default',
      'slide,forwards',
      '"slide"',
      '1slide',
      'slide;navigation:none',
      '\\6e one slide',
    ]) {
      expect(() =>
        Transform.compile({
          moduleId: 'invalid.ts',
          source: `import {viewTransition} from 'zyzz/web';viewTransition({types:${JSON.stringify(types)}});`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: invalid.ts:40: Expected none or a list of view-transition custom identifiers.]`,
      )
    }
    for (const within of [
      'body',
      '@page',
      '@font-face',
      '@starting-style',
      '@keyframes fade',
    ]) {
      expect(() =>
        Transform.compile({
          moduleId: 'invalid.ts',
          source: `import {viewTransition} from 'zyzz/web';viewTransition({navigation:'auto'},{within:[${JSON.stringify(within)}]});`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: invalid.ts:40: Expected enclosing conditional or layer headers.]`,
      )
    }
  })
})
