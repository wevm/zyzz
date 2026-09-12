/** Exercises eager document descriptor blocks through source and packed stylesheet compilation. @module */
import * as Trace from '@jridgewell/trace-mapping'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

describe('compile', () => {
  test('accepts selector lists, CSS identifiers, optional blocks, and authored descriptor order', () => {
    const output = Transform.compile({
      moduleId: 'document.ts',
      source: `import {page,fontFeatureValues,viewTransition} from 'zyzz/web';
page({selector:':first, :left',descriptors:{size:'landscape JIS-B4'}},undefined);
fontFeatureValues({families:'Body',features:{'@swash':undefined,'@styleset':{'--ornament':1,'café':[1,3],'𝒜lternate':2}},fontDisplay:' SWAP '},void 0);
viewTransition({navigation:' AUTO '});`,
    })
    expect(output.css).toMatchInlineSnapshot(`
      "@page :first, :left{size:landscape JIS-B4;}
      @font-feature-values Body{@styleset{--ornament:1;café:1 3;𝒜lternate:2;}font-display: SWAP ;}
      @view-transition{navigation: AUTO ;}"
    `)
  })
  test('rejects malformed feature values in packed contracts', () => {
    const library = Graph.compile({
      modules: {
        'library.ts': `import {fontFeatureValues} from 'zyzz/web';fontFeatureValues({families:'Body',features:{'@swash':{flow:1}}});`,
      },
    })
    const contract = JSON.parse(library.contracts['library.ts']!)
    contract.stylesheets[0].css = '@font-feature-values Body{@swash{flow:foo;}}'
    expect(() =>
      Graph.compile({
        contracts: { 'lib.js': JSON.stringify(contract) },
        imports: { 'app.ts': { lib: 'lib.js' } },
        modules: { 'app.ts': `import 'lib'` },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: lib.js:0: Invalid library contract: Invalid value]`,
    )
  })
  test('preserves CSS escapes in family arrays', () => {
    const output = Transform.compile({
      moduleId: 'family.ts',
      source: `import {fontFeatureValues} from 'zyzz/web';fontFeatureValues({families:['A\\tB'],features:{'@swash':{flow:1}}});`,
    })
    expect(output.css).toMatchInlineSnapshot(
      `"@font-feature-values "A\\9 B"{@swash{flow:1;}}"`,
    )
  })
  test('rejects feature indexes outside safe decimal integers', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'index.ts',
        source: `import {fontFeatureValues} from 'zyzz/web';fontFeatureValues({families:'Body',features:{'@swash':{flow:1e21}}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: index.ts:43: Expected feature aliases with nonnegative integer indices.]`,
    )
  })
  test('rejects reserved aliases, malformed families, and table-only page properties', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {fontFeatureValues} from 'zyzz/web';fontFeatureValues({families:'Body',fontDisplay:'blocK',features:{}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:43: Invalid font display descriptor.]`,
    )
    for (const name of [
      'initial',
      'inherit',
      'unset',
      'revert',
      'revert-layer',
      'default',
    ])
      expect(() =>
        Transform.compile({
          moduleId: 'bad.ts',
          source: `import {fontFeatureValues} from 'zyzz/web';fontFeatureValues({families:'Body',features:{'@styleset':{'${name}':1}}});`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: bad.ts:43: Expected feature aliases with nonnegative integer indices.]`,
      )
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {fontFeatureValues} from 'zyzz/web';fontFeatureValues({families:'123',features:{}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:43: Unexpected token Number { has_sign: false, value: 123.0, int_value: Some(123) }]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {page} from 'zyzz/web';page({descriptors:{borderCollapse:'collapse'}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:30: Unsupported page or page-margin declaration.]`,
    )
  })
  test('keeps declarations after feature blocks mapped to their source', () => {
    const output = Transform.compile({
      moduleId: 'maps.ts',
      source: `import {css} from 'zyzz';import {fontFeatureValues} from 'zyzz/web';
fontFeatureValues({families:'Body',features:{'@styleset':{'\\\\65 ditorial':[1,3]}}});
export namespace styles {
  export const text = css({color:'red'})
}`,
    })
    const line =
      output.css.split('\n').findIndex((line) => line.includes('color:red')) + 1
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line,
        column: 0,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 22,
        "line": 4,
        "name": "style-1mqnwyd110b1y9-202",
        "source": "maps.ts",
      }
    `)
  })
  test('preserves page descriptors and every margin box in authored order', () => {
    const margins = [
      'top-left-corner',
      'top-left',
      'top-center',
      'top-right',
      'top-right-corner',
      'bottom-left-corner',
      'bottom-left',
      'bottom-center',
      'bottom-right',
      'bottom-right-corner',
      'left-top',
      'left-middle',
      'left-bottom',
      'right-top',
      'right-middle',
      'right-bottom',
    ]
    const output = Transform.compile({
      moduleId: 'print.ts',
      source: `import {page} from 'zyzz/web';page({selector:':first',descriptors:{size:'A4 landscape',margin:'2cm',${margins.map((name, index) => JSON.stringify('@' + name) + ':{content:' + JSON.stringify('"' + index + '"') + '}').join(',')},pageOrientation:'upright',marks:'crop cross',bleed:'3mm'}},{within:['@media print']});`,
    })
    expect(output.css).toMatchInlineSnapshot(
      `"@media print{@page :first{size:A4 landscape;margin:2cm;@top-left-corner{content:"0";}@top-left{content:"1";}@top-center{content:"2";}@top-right{content:"3";}@top-right-corner{content:"4";}@bottom-left-corner{content:"5";}@bottom-left{content:"6";}@bottom-center{content:"7";}@bottom-right{content:"8";}@bottom-right-corner{content:"9";}@left-top{content:"10";}@left-middle{content:"11";}@left-bottom{content:"12";}@right-top{content:"13";}@right-middle{content:"14";}@right-bottom{content:"15";}page-orientation:upright;marks:crop cross;bleed:3mm;}}"`,
    )
    expect(output.code).toMatchInlineSnapshot(`"void 0;"`)
  })
  test('retains feature blocks and view-transition descriptors in packed libraries', () => {
    const library = Graph.compile({
      modules: {
        'document.ts': `import {fontFeatureValues,viewTransition} from 'zyzz/web';fontFeatureValues({families:['Body','Alternate'],fontDisplay:'swap',features:{'@annotation':{circled:1},'@character-variant':{alternate:[2,3]},'@ornaments':{fleuron:4},'@styleset':{editorial:[1,2]},'@stylistic':{round:3},'@swash':{flow:1}}});viewTransition({navigation:'auto',types:'slide forwards'},{within:['@layer transitions']});viewTransition({navigation:'none'},{within:['@media (prefers-reduced-motion: reduce)']});`,
      },
    })
    const output = Graph.compile({
      contracts: { 'lib/document.js': library.contracts['document.ts']! },
      imports: { 'app.ts': { lib: 'lib/document.js' } },
      modules: { 'app.ts': `import 'lib'` },
    })
    expect(output.sharedCss).toMatchInlineSnapshot(`
      "@font-feature-values "Body","Alternate"{font-display:swap;@annotation{circled:1;}@character-variant{alternate:2 3;}@ornaments{fleuron:4;}@styleset{editorial:1 2;}@stylistic{round:3;}@swash{flow:1;}}
      @layer transitions{@view-transition{navigation:auto;types:slide forwards;}}
      @media (prefers-reduced-motion: reduce){@view-transition{navigation:none;}}"
    `)
  })
  test('rejects descriptors in the wrong page context', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {page} from 'zyzz/web';page({descriptors:{'@top-center':{size:'A4'}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:30: Unsupported page or page-margin declaration.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {fontFeatureValues} from 'zyzz/web';fontFeatureValues({families:'Body',features:{'@swash':{flow:[1,2]}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:43: Expected feature aliases with nonnegative integer indices.]`,
    )
  })
})
