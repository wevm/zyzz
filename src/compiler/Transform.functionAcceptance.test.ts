/** Verifies nested function references, complete arguments, maps, and packed transport. @module */
import { describe, expect, test } from 'vite-plus/test'
import * as Functions from '../../test/fixtures/Functions.js'
import { Graph, Source, Transform } from 'zyzz/compiler'
import * as Trace from '@jridgewell/trace-mapping'

describe('compile', () => {
  test('retains escaped syntax nested references and conditional results through packed publication', () => {
    const source = Functions.source()
    const direct = Transform.compile({ moduleId: 'functions.ts', source })
    const library = Graph.compile({ modules: { 'functions.ts': source } })
    expect(
      JSON.parse(library.contracts['functions.ts']!).version,
    ).toMatchInlineSnapshot('12')
    const packed = Graph.compile({
      contracts: { 'lib/index.js': library.contracts['functions.ts']! },
      imports: { 'app.ts': { lib: 'lib/index.js', 'zyzz/web': null } },
      modules: {
        'app.ts': `import {inner,outer,list,words} from 'lib';import {global} from 'zyzz/web';global({body:{width:outer(inner()),'--list':list('3px 5px'),'--word':words('日本語')}});`,
      },
    })
    expect(direct.css.includes('--日本語')).toMatchInlineSnapshot('true')
    expect(
      direct.css.includes('@container (width > 1px)'),
    ).toMatchInlineSnapshot('true')
    expect(
      packed.sharedCss?.includes('@supports (width: 1px)'),
    ).toMatchInlineSnapshot('true')
    expect(
      (packed.sharedCss + packed.modules['app.ts']!.css).includes('(3px 5px)'),
    ).toMatchInlineSnapshot('true')
    expect(
      (packed.sharedCss + packed.modules['app.ts']!.css).includes(
        '(--z-cssfunction',
      ),
    ).toMatchInlineSnapshot('true')
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(packed.sharedCssMap!), {
        line: 1,
        column: 0,
      }).source,
    ).toMatchInlineSnapshot('"lib/functions.ts"')
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(packed.sharedCssMap!), {
        line: 1,
        column: 0,
      }).line,
    ).toMatchInlineSnapshot('2')
  })
  test('rejects invalid list items arity escaped names and declaration injection', () => {
    const definition = `import {cssFunction} from 'zyzz/web';export const fn=cssFunction({parameters:[{name:'--x',syntax:'<integer>+'}],body:{result:'var(--x)'}});`
    for (const call of [
      "fn('1 2px')",
      "fn('1 2.5')",
      'fn()',
      'fn(1,2)',
      "fn('1;result:2')",
    ]) {
      expect(
        () =>
          Transform.compile({
            moduleId: 'invalid.ts',
            source: definition + call,
          }),
        call,
      ).toThrow(Source.ExtractError)
      const library = Graph.compile({ modules: { 'fn.ts': definition } })
      expect(
        () =>
          Graph.compile({
            contracts: { 'lib.js': library.contracts['fn.ts']! },
            imports: { 'app.ts': { lib: 'lib.js' } },
            modules: { 'app.ts': `import {fn} from 'lib';${call}` },
          }),
        call,
      ).toThrow()
    }
    for (const options of [
      {
        parameters: [{ name: '--x', syntax: 'type(\\69 nherit | auto)' }],
        body: { result: 'auto' },
      },
      {
        parameters: [{ name: '--x' }, { name: '--\\78' }],
        body: { result: '1' },
      },
      {
        parameters: [{ name: '--x', syntax: '<length>+', default: '1px red' }],
        body: { result: '1' },
      },
      { parameters: [], body: { result: '1;--injected:2' } },
      { parameters: [], body: { '@page': { result: '1' } } },
    ])
      expect(() =>
        Transform.compile({
          moduleId: 'invalid.ts',
          source: `import {cssFunction} from 'zyzz/web';export const fn=cssFunction(${JSON.stringify(options)});`,
        }),
      ).toThrow(Source.ExtractError)
  })
})
