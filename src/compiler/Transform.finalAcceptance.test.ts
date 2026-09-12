/** Verifies full page and registration grammar through source and packed boundaries. @module */
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source, Transform } from 'zyzz/compiler'
import * as Pages from '../../test/fixtures/Pages.js'
import * as Registrations from '../../test/fixtures/Registrations.js'
import * as Trace from '@jridgewell/trace-mapping'

describe('compile', () => {
  test('rejects invalid page property and function grammar from packed stylesheets', () => {
    const library = Graph.compile({ modules: { 'lib.ts': Pages.source() } })
    for (const css of [
      '@page{bleed:10%}',
      '@page{size:calc(1deg)}',
      '@property --x{syntax:"<length>";inherits:false;initial-value:1em}',
      '@property --x{syntax:"<length>";inherits:false}',
      '@property --x{syntax:"<length>";inherits:no;initial-value:1px}',
      '@function --x(--a <length>+: 1px red){result:1}',
      '@function --x(--a,--a){result:1}',
      '@function --x(){@page{result:1}}',
      '@function --x() returns invalid syntax{result:1}',
    ]) {
      const contract = JSON.parse(library.contracts['lib.ts']!)
      contract.stylesheets[0].css = css
      expect(
        () =>
          Graph.compile({
            contracts: { 'lib.js': JSON.stringify(contract) },
            imports: { 'app.ts': { lib: 'lib.js' } },
            modules: { 'app.ts': `import 'lib';` },
          }),
        css,
      ).toThrow()
    }
  })
  test('rejects forbidden enclosing and element contexts for final descriptor families', () => {
    for (const call of [
      "page({descriptors:{size:'A4'}}",
      "property({name:'--x',syntax:'*',inherits:false}",
      'cssFunction({parameters:[],body:{result:1}}',
    ])
      for (const within of ['body', '@page', '@starting-style', '@keyframes x'])
        expect(() =>
          Transform.compile({
            moduleId: 'invalid.ts',
            source: `import {page,property,cssFunction} from 'zyzz/web';${call},{within:[${JSON.stringify(within)}]});`,
          }),
        ).toThrow(Source.ExtractError)
  })

  for (const [family, source, rule] of [
    ['page', Pages.source(), '@page'],
    ['property', Registrations.source(), '@property'],
  ] as const) {
    test(`retains ${family} grammar and contexts in packed output with source maps`, () => {
      const direct = Transform.compile({ moduleId: 'library.ts', source })
      const library = Graph.compile({ modules: { 'library.ts': source } })
      const packed = Graph.compile({
        contracts: { 'lib/index.js': library.contracts['library.ts']! },
        imports: { 'app.ts': { lib: 'lib/index.js' } },
        modules: { 'app.ts': `import 'lib';` },
      })
      expect(direct.css.includes(rule)).toMatchInlineSnapshot('true')
      expect(packed.sharedCss?.includes(rule)).toMatchInlineSnapshot('true')
      expect(
        direct.css.replaceAll(/\s+/g, '') ===
          packed.sharedCss?.replaceAll(/\s+/g, ''),
      ).toMatchInlineSnapshot('true')
      expect(
        Trace.originalPositionFor(new Trace.TraceMap(packed.sharedCssMap!), {
          line: 1,
          column: 0,
        }).source,
      ).toMatchInlineSnapshot('"lib/library.ts"')
      expect(
        Trace.originalPositionFor(new Trace.TraceMap(packed.sharedCssMap!), {
          line: 1,
          column: 0,
        }).line,
      ).toMatchInlineSnapshot('2')
    })
  }
  test('rejects invalid page lengths descriptors and selectors', () => {
    for (const options of [
      { descriptors: { bleed: '10%' } },
      { descriptors: { bleed: 'calc(1deg)' } },
      { descriptors: { size: '-1px' } },
      { descriptors: { size: '1px 2px 3px' } },
      { descriptors: { marks: 'crop crop' } },
      { descriptors: { pageOrientation: 'landscape' } },
      { descriptors: { bleed: '1px;color:red' } },
      { selector: ':hover', descriptors: { size: 'A4' } },
    ])
      expect(() =>
        Transform.compile({
          moduleId: 'invalid.ts',
          source: `import {page} from 'zyzz/web';page(${JSON.stringify(options)});`,
        }),
      ).toThrow(Source.ExtractError)
  })
  test('rejects invalid registrations and computational dependencies', () => {
    for (const options of [
      { syntax: '<length>', initialValue: '1em' },
      { syntax: '<length>', initialValue: 'calc(1px + 2em)' },
      { syntax: '<length>', initialValue: 'calc(1deg)' },
      { syntax: '<length>', initialValue: 'red' },
      { syntax: '<color>', initialValue: 'currentColor' },
      { syntax: '<length>', initialValue: 'var(--other)' },
      { syntax: '<length>' },
      { syntax: '<length> || <number>', initialValue: '1px' },
      { syntax: '<transform-list>+', initialValue: 'rotate(1deg)' },
      { syntax: '<string>', initialValue: '"no"' },
      { syntax: '<length>', initialValue: '1px;inherits:true' },
      { syntax: '<length>', initialValue: '1px', inherits: 'false' },
    ])
      expect(
        () =>
          Transform.compile({
            moduleId: 'invalid.ts',
            source: `import {property} from 'zyzz/web';property(${JSON.stringify({ name: '--invalid', inherits: false, ...options })});`,
          }),
        JSON.stringify(options),
      ).toThrow(Source.ExtractError)
  })
})
