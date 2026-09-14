/** Verifies composite CSS signatures through direct and packed source compilation. @module */
import * as Esbuild from 'esbuild'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

describe('compile', () => {
  test('formats comma-list arguments identically in emitted JavaScript', async () => {
    const output = Transform.compile({
      moduleId: 'list.ts',
      source: `import {cssFunction} from 'zyzz/web';export const colors=cssFunction({parameters:[{name:'--colors',syntax:'<color>#'}],returns:'<color>#',body:{result:'var(--colors)'}});`,
    })
    const code = (
      await Esbuild.transform(output.code, { loader: 'ts', format: 'esm' })
    ).code
    const compiled = await import(
      'data:text/javascript,' + encodeURIComponent(code)
    )

    expect(compiled.colors('red, blue')).toMatchInlineSnapshot(
      `"--z-cssfunction13vvukoaiceek-63-6f-6c-6f-72-73({red, blue})"`,
    )
    expect(compiled.colors('{red, blue}')).toMatchInlineSnapshot(
      `"--z-cssfunction13vvukoaiceek-63-6f-6c-6f-72-73({red, blue})"`,
    )
  })
  test('preserves union, repetition, keyword, and universal signatures', () => {
    const output = Transform.compile({
      moduleId: 'functions.ts',
      source: `import {cssFunction} from 'zyzz/web';
export const scale=cssFunction({parameters:[{name:'--x',syntax:'type(<number> | <percentage>)',default:'50%'}],returns:'type(<number> | <percentage>)',body:{result:'var(--x)'}});
export const space=cssFunction({parameters:[{name:'--x',syntax:'<length>+'}],returns:'<length>+',body:{result:'var(--x)'}});
export const auto=cssFunction({parameters:[{name:'--x',syntax:'type(auto | <length>)'}],returns:'type(auto | <length>)',body:{result:'var(--x)'}});
export const any=cssFunction({parameters:[{name:'--x',syntax:'type(*)'}],returns:'type(*)',body:{result:'var(--x)'}});`,
    })

    expect(output.css).toMatchInlineSnapshot(`
      "@function --z-cssfunction270wt1ix0x4z-73-63-61-6c-65(--x type(<number> | <percentage>): 50%) returns type(<number> | <percentage>){result:var(--x);}
      @function --z-cssfunction270wt1ix0x4z-73-70-61-63-65(--x <length>+) returns <length>+{result:var(--x);}
      @function --z-cssfunction270wt1ix0x4z-61-75-74-6f(--x type(auto | <length>)) returns type(auto | <length>){result:var(--x);}
      @function --z-cssfunction270wt1ix0x4z-61-6e-79(--x type(*)) returns type(*){result:var(--x);}"
    `)
  })

  test('retains composite signatures and default invocation across packed re-exports', () => {
    const library = Graph.compile({
      modules: {
        'functions.ts': `import {cssFunction} from 'zyzz/web';export const size=cssFunction({parameters:[{name:'--size',syntax:'type(<length> | <percentage>)',default:'25%'}],returns:'type(<length> | <percentage>)',body:{result:'var(--size)'}});`,
      },
    })
    expect(
      JSON.parse(library.contracts['functions.ts']!).version,
    ).toMatchInlineSnapshot('11')
    const output = Graph.compile({
      contracts: { 'lib/functions.js': library.contracts['functions.ts']! },
      imports: { 'app.ts': { lib: 'lib/functions.js', zyzz: null } },
      modules: {
        'app.ts': `import {size as scale} from 'lib';import {css} from 'zyzz';export const styles={default:css({width:scale()}),fixed:css({width:scale('20px')})};`,
      },
    })

    expect(output.sharedCss).toMatchInlineSnapshot(
      `"@function --z-cssfunction270wt1ix0x4z-73-69-7a-65(--size type(<length> | <percentage>): 25%) returns type(<length> | <percentage>){result:var(--size);}"`,
    )
    expect(output.modules['app.ts']?.css).toMatchInlineSnapshot(`
      ".z-style-1e8a67z1uaws1j-88-atomic-width-0{width:--z-cssfunction270wt1ix0x4z-73-69-7a-65();}
      .z-style-1e8a67z1uaws1j-115-atomic-width-0{width:--z-cssfunction270wt1ix0x4z-73-69-7a-65(20px);}"
    `)
  })

  test.each(['1px', '1%', '1.5', '1e2', '-1turn', ' 1px '])(
    'rejects non-integer token %s in source and packed calls',
    (value) => {
      const source = `import {cssFunction} from 'zyzz/web';export const fn=cssFunction({parameters:[{name:'--n',syntax:'type(<integer> | auto)'}],returns:'<integer>',body:{result:'var(--n)'}});`
      const library = Graph.compile({ modules: { 'fn.ts': source } })

      expect(() =>
        Transform.compile({
          moduleId: 'invalid.ts',
          source: source + `fn(${JSON.stringify(value)});`,
        }),
      ).toThrowError(/CSS integer parameters require integer tokens/)
      expect(() =>
        Graph.compile({
          contracts: { 'lib.js': library.contracts['fn.ts']! },
          imports: { 'app.ts': { lib: 'lib.js' } },
          modules: {
            'app.ts': `import {fn} from 'lib';fn(${JSON.stringify(value)});`,
          },
        }),
      ).toThrowError(/CSS integer parameters require integer tokens/)
    },
  )

  test.each([
    '<custom-ident>',
    '<image>',
    '<resolution>',
    '<string>',
    '<transform-function>',
    '<transform-list>',
    '<url>',
  ])(
    'versions added scalar syntax %s separately from the legacy contract',
    (syntax) => {
      for (const returns of [syntax, '<color>']) {
        const library = Graph.compile({
          modules: {
            'fn.ts': `import {cssFunction} from 'zyzz/web';export const fn=cssFunction({parameters:[{name:'--x',syntax:${JSON.stringify(syntax)}}],returns:${JSON.stringify(returns)},body:{result:'var(--x)'}});`,
          },
        })
        expect(
          JSON.parse(library.contracts['fn.ts']!).version,
        ).toMatchInlineSnapshot('11')

        const packed = Graph.compile({
          contracts: { 'lib.js': library.contracts['fn.ts']! },
          imports: { 'app.ts': { lib: 'lib.js' } },
          modules: { 'app.ts': `import {fn} from 'lib';export {fn};` },
        })
        expect(
          JSON.parse(packed.contracts['app.ts']!).version,
        ).toMatchInlineSnapshot('11')
      }
    },
  )

  test.each(['+', '#'])(
    'accepts one-item numbers in repeated %s alternatives through packed calls',
    (repeat) => {
      const library = Graph.compile({
        modules: {
          'fn.ts': `import {cssFunction} from 'zyzz/web';export const fn=cssFunction({parameters:[{name:'--x',syntax:'type(<integer> | <number>${repeat})'}],body:{result:'var(--x)'}});`,
        },
      })
      const packed = Graph.compile({
        contracts: { 'lib.js': library.contracts['fn.ts']! },
        imports: { 'app.ts': { lib: 'lib.js' } },
        modules: {
          'app.ts': `import {fn} from 'lib';export const value=fn(1.5);`,
        },
      })
      expect(
        packed.modules['app.ts']!.code.includes('(1.5)'),
      ).toMatchInlineSnapshot('true')

      const output = Transform.compile({
        moduleId: 'lists.ts',
        source: `import {cssFunction} from 'zyzz/web';const fn=cssFunction({parameters:[{name:'--x',syntax:'<integer>${repeat}'}],body:{result:'var(--x)'}});fn('${repeat === '+' ? '1 2' : '1, 2'}');`,
      })
      expect(output.css.includes('@function')).toMatchInlineSnapshot('true')
    },
  )

  test('retains scalar contract compatibility and valid alternative arguments', () => {
    const source = `import {cssFunction} from 'zyzz/web';export const fn=cssFunction({parameters:[{name:'--n',syntax:'<integer>'}],returns:'<integer>',body:{result:'var(--n)'}});fn(2);`
    const library = Graph.compile({ modules: { 'fn.ts': source } })
    expect(
      JSON.parse(library.contracts['fn.ts']!).version,
    ).toMatchInlineSnapshot('10')

    const output = Transform.compile({
      moduleId: 'valid.ts',
      source: `import {cssFunction} from 'zyzz/web';const fn=cssFunction({parameters:[{name:'--n',syntax:'type(<integer> | <percentage> | auto)'}],body:{result:'var(--n)'}});fn('25%');fn('auto');fn(2);`,
    })
    expect(output.code.includes('25%')).toMatchInlineSnapshot('true')
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {cssFunction} from 'zyzz/web';const fn=cssFunction({parameters:[{name:'--n',syntax:'type(<integer> | <percentage>)'}],body:{result:'var(--n)'}});fn('1px');`,
      }),
    ).toThrowError(/CSS integer parameters require integer tokens/)
  })

  test.each([
    'type(<length> && <color>)',
    'type(<length> |)',
    '<length> | <percentage>',
    'type(<unknown>)',
    '<transform-list>+',
  ])('rejects invalid signature %s at its source', (syntax) => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {cssFunction} from 'zyzz/web';export const fn=cssFunction({parameters:[],returns:${JSON.stringify(syntax)},body:{result:0}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:53: Expected CSS function parameters, body, and optional return syntax.]`,
    )
  })
})
