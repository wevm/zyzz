/** Verifies statement ordering, query/function references, and isolated namespaces through public compilers. @module */
import * as Esbuild from 'esbuild'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

describe('compile', () => {
  test('hoists conditioned imports before namespace and ordinary rules', () => {
    const output = Graph.compile({
      modules: {
        'statements.ts': `import {global,importCss,namespace} from 'zyzz/web';global({'s|circle':{fill:'red'}});namespace({prefix:'s',uri:'http://www.w3.org/2000/svg'});importCss({url:'./base.css',layer:'base',supports:'display: grid',media:'screen'});`,
      },
    })
    expect(output.sharedCss).toMatchInlineSnapshot(`
      "@import "zyzz-asset:base.css" layer(base) supports(display: grid) screen;
      @namespace z-n17dmz821ctten8-2e "http://www.w3.org/2000/svg";
      z-n17dmz821ctten8-2e|circle {
        fill: red;
      }"
    `)
    expect(Object.values(output.sharedAssets ?? {})).toMatchInlineSnapshot(`
      [
        "base.css",
      ]
    `)
  })
  test('preserves anonymous import layers while relocating assets', () => {
    const output = Graph.compile({
      modules: {
        'app.ts': `import {importCss} from 'zyzz/web';importCss({url:'./a.css',layer:true});importCss({url:'./b.css'});`,
      },
    })
    expect(output.sharedCss).toMatchInlineSnapshot(`
      "@import "zyzz-asset:a.css" layer;
      @import "zyzz-asset:b.css";"
    `)
  })
  test('retains computed custom-media keys across packed imports', () => {
    const library = Graph.compile({
      modules: {
        'query.ts': `import {customMedia} from 'zyzz/web';export const compact=customMedia('(width < 40rem)');`,
      },
    })
    const output = Graph.compile({
      contracts: { 'lib/query.js': library.contracts['query.ts']! },
      imports: { 'app.ts': { lib: 'lib/query.js', zyzz: null } },
      modules: {
        'app.ts': `import {css} from 'zyzz';import {compact} from 'lib';export const styles={box:css({[compact]:{color:'red'}})};`,
      },
    })
    expect(output.sharedCss).toMatchInlineSnapshot(
      `"@custom-media --z-custommedia658bb2ype01s-63-6f-6d-70-61-63-74 (width < 40rem);"`,
    )
    expect(output.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-style-1e8a67z1uaws1j-78{@media (--z-custommedia658bb2ype01s-63-6f-6d-70-61-63-74){color:red;}}"`,
    )
  })
  test('emits native functions and callable fixed expressions', async () => {
    const output = Transform.compile({
      moduleId: 'function.ts',
      source: `import {cssFunction} from 'zyzz/web';export const twice=cssFunction({parameters:[{name:'--amount',syntax:'<length>',default:'1px'}],returns:'<length>',body:{result:'calc(var(--amount) * 2)','@media (width > 40rem)':{result:'calc(var(--amount) * 3)'}}});`,
    })
    expect(output.css).toMatchInlineSnapshot(
      `"@function --z-cssfunction1sp21u81389mcs-74-77-69-63-65(--amount <length>: 1px) returns <length>{result:calc(var(--amount) * 2);@media (width > 40rem){result:calc(var(--amount) * 3);}}"`,
    )
    const code = (
      await Esbuild.transform(output.code, { loader: 'ts', format: 'esm' })
    ).code
    const compiled = await import(
      'data:text/javascript,' + encodeURIComponent(code)
    )
    expect(compiled.twice('2px')).toMatchInlineSnapshot(
      `"--z-cssfunction1sp21u81389mcs-74-77-69-63-65(2px)"`,
    )
  })
  test('isolates reused and default namespace prefixes across modules and packed output', () => {
    const library = Graph.compile({
      modules: {
        'svg.ts': `import {namespace,global} from 'zyzz/web';namespace({uri:'http://www.w3.org/2000/svg'});global({'.icon':{fill:'red'}});`,
      },
    })
    const output = Graph.compile({
      contracts: { 'lib/svg.js': library.contracts['svg.ts']! },
      imports: { 'app.ts': { lib: 'lib/svg.js', 'zyzz/web': null } },
      modules: {
        'app.ts': `import 'lib';import {namespace,global} from 'zyzz/web';namespace({prefix:'s',uri:'urn:application'});global({'s|item':{color:'blue'},'.icon':{color:'green'}});`,
      },
    })
    expect(output.sharedCss).toMatchInlineSnapshot(`
      "@namespace z-n1eqhovc1o4c8ak-16 "http://www.w3.org/2000/svg";
      @namespace z-n1e8a67z1uaws1j-1j "urn:application";
      z-n1eqhovc1o4c8ak-16|*.icon {
        fill: red;
      }
      z-n1e8a67z1uaws1j-1j|item {
        color: #00f;
      }
      .icon {
        color: green;
      }"
    `)
  })
  test('uses imported native function calls as declaration values', () => {
    const library = Graph.compile({
      modules: {
        'function.ts': `import {cssFunction} from 'zyzz/web';export const twice=cssFunction({parameters:[{name:'--amount',syntax:'<length>'}],returns:'<length>',body:{result:'calc(var(--amount) * 2)'}});`,
      },
    })
    const output = Graph.compile({
      contracts: { 'lib/function.js': library.contracts['function.ts']! },
      imports: { 'app.ts': { lib: 'lib/function.js', zyzz: null } },
      modules: {
        'app.ts': `import {css} from 'zyzz';import {twice} from 'lib';export const styles={box:css({width:twice('2px')})};`,
      },
    })
    expect(output.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-1e8a67z1uaws1j-base0{width:--z-cssfunction1sp21u81389mcs-74-77-69-63-65(2px);}"`,
    )
  })
  test('rejects duplicate namespaces and malformed function parameter data', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {namespace} from 'zyzz/web';namespace({uri:'urn:a'});namespace({uri:'urn:b'});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:60: Duplicate namespace prefix in one module.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {cssFunction} from 'zyzz/web';export const fn=cssFunction({parameters:[{name:'--x'},{name:'--x'}],body:{result:1}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:53: Expected unique CSS parameters with supported syntaxes and scalar defaults.]`,
    )
  })
})
