/** Exercises eager document descriptor blocks through source and packed stylesheet compilation. @module */
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

describe('compile', () => {
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
