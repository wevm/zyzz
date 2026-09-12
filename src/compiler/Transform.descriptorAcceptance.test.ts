/** Verifies descriptor grammars, source maps, and packed name references. @module */
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source, Transform } from 'zyzz/compiler'
import * as NamedDescriptors from '../../test/fixtures/NamedDescriptors.js'
import * as Trace from '@jridgewell/trace-mapping'

describe('compile', () => {
  for (const family of Object.keys(
    NamedDescriptors.definitions,
  ) as (keyof typeof NamedDescriptors.definitions)[]) {
    test(`retains every ${family} descriptor across packed publication with maps`, () => {
      const source = NamedDescriptors.source(family)
      const direct = Transform.compile({ moduleId: 'names.ts', source })
      const library = Graph.compile({ modules: { 'names.ts': source } })
      const packed = Graph.compile({
        contracts: { 'lib/names.js': library.contracts['names.ts']! },
        imports: { 'app.ts': { lib: 'lib/names.js' } },
        modules: {
          'app.ts':
            family === 'font' ? `import 'lib';` : `export {name} from 'lib';`,
        },
      })
      for (const key of NamedDescriptors.keys[family]) {
        expect(direct.css.includes(`${key}:`)).toMatchInlineSnapshot('true')
        expect(packed.sharedCss?.includes(`${key}:`)).toMatchInlineSnapshot(
          'true',
        )
      }
      expect(direct.css.includes('@layer names')).toMatchInlineSnapshot('true')
      expect(packed.sharedCss?.includes('@media print')).toMatchInlineSnapshot(
        'true',
      )
      expect(
        packed.sharedCss?.includes('body{color:red;}'),
      ).toMatchInlineSnapshot('true')
      expect(
        Trace.originalPositionFor(new Trace.TraceMap(packed.sharedCssMap!), {
          line: 1,
          column: 0,
        }).source,
      ).toMatchInlineSnapshot('"lib/names.ts"')
      expect(
        Trace.originalPositionFor(new Trace.TraceMap(packed.sharedCssMap!), {
          line: 1,
          column: 0,
        }).line,
      ).toMatchInlineSnapshot('2')
    })
  }
  test('rejects invalid font counter and palette descriptor grammar before output', () => {
    const failures = [
      `export const x=counterStyle({system:'numeric',symbols:'"0"'});`,
      `export const x=counterStyle({system:'additive',additiveSymbols:'1 "I",10 "X"'});`,
      `export const x=counterStyle({symbols:'"x"',range:'5 1'});`,
      `export const x=counterStyle({symbols:'"x"',pad:'nope'});`,
      `fontFace({fontFamily:'Body',src:'url(/a)',fontWeight:'garbage'});`,
      `fontFace({fontFamily:'Body',src:'url(/a)',sizeAdjust:'-10%'});`,
      `export const x=fontPaletteValues({fontFamily:'Body',overrideColors:'0 currentColor'});`,
      `export const x=fontPaletteValues({fontFamily:'Body',overrideColors:'0 color-mix(in srgb,red,currentColor)'});`,
      `export const x=fontPaletteValues({fontFamily:'Body',overrideColors:'-1 red'});`,
    ].map((source) => {
      try {
        Transform.compile({
          moduleId: 'invalid.ts',
          source: `import {counterStyle,fontFace,fontPaletteValues} from 'zyzz/web';${source}`,
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
          "Numeric and alphabetic counters require at least two symbols.",
        ],
        [
          "Additive symbol weights must strictly descend.",
        ],
        [
          "Counter ranges must have increasing bounds.",
        ],
        [
          "Invalid @counter-style pad: Mismatch
        syntax: <integer [0,∞]> && <symbol>
         value: nope
        --------^",
        ],
        [
          "Invalid @font-face font-weight: Mismatch
        syntax: <font-weight-absolute>{1,2}
         value: garbage
        --------^",
        ],
        [
          "@font-face size-adjust cannot be negative.",
        ],
        [
          "Palette overrides require absolute colors.",
        ],
        [
          "Palette overrides require absolute colors.",
        ],
        [
          "Invalid @font-palette-values override-colors: Mismatch
        syntax: [ <integer [0,∞]> <color> ]#
         value: -1 red
        --------^",
        ],
      ]
    `)
  })
})
