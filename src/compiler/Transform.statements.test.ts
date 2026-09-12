/** Verifies statement ordering, query/function references, and isolated namespaces through public compilers. @module */
import * as Esbuild from 'esbuild'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

describe('compile', () => {
  test('rejects fractional CSS integer parameters', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'integer.ts',
        source: `import {css} from 'zyzz';import {cssFunction} from 'zyzz/web';const fn=cssFunction({parameters:[{name:'--n',syntax:'<integer>'}],body:{result:1}});export const style=css({zIndex:fn(1.5)});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: integer.ts:178: CSS integer parameters require integer tokens.]`,
    )
  })
  test('rejects custom media as a declaration value', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'query.ts',
        source: `import {css} from 'zyzz';import {customMedia} from 'zyzz/web';const query=customMedia('(width>1px)');export const style=css({color:query});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: query.ts:131: Named stylesheet reference is incompatible with this property.]`,
    )
  })
  test('rejects a context on a custom media statement', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'query.ts',
        source: `import {customMedia} from 'zyzz/web';export const query=customMedia('(width>1px)',{within:['@layer queries']});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: query.ts:56: Stylesheet contributions require direct module-level calls and constant named stylesheet bindings.]`,
    )
  })
  test('rejects conflicting packed customMedia identities', () => {
    const helper = 'customMedia'
    const expression = `customMedia('(width>1px)')`
    const library = Graph.compile({
      modules: {
        'library.ts': `import {${helper}} from 'zyzz/web';export const rule=${expression};`,
      },
    })
    const first = JSON.parse(library.contracts['library.ts']!)
    const second = JSON.parse(library.contracts['library.ts']!)
    second.stylesheets[0].key = 'other'
    second.stylesheets[0].css = second.stylesheets[0].css
      .replace('1px', '2px')
      .replace('result:1', 'result:2')
    expect(() =>
      Graph.compile({
        contracts: {
          'first.js': JSON.stringify(first),
          'second.js': JSON.stringify(second),
        },
        imports: { 'app.ts': { first: 'first.js', second: 'second.js' } },
        modules: { 'app.ts': `import 'first';import 'second'` },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: second.js:0: Conflicting stylesheet identity: --z-custommediaggnaaj17b3mnh-72-75-6c-65; compile libraries with package-qualified module IDs.]`,
    )
  })
  test('rejects conflicting packed cssFunction identities', () => {
    const helper = 'cssFunction'
    const expression = `cssFunction({parameters:[],body:{result:1}})`
    const library = Graph.compile({
      modules: {
        'library.ts': `import {${helper}} from 'zyzz/web';export const rule=${expression};`,
      },
    })
    const first = JSON.parse(library.contracts['library.ts']!)
    const second = JSON.parse(library.contracts['library.ts']!)
    second.stylesheets[0].key = 'other'
    second.stylesheets[0].css = second.stylesheets[0].css
      .replace('1px', '2px')
      .replace('result:1', 'result:2')
    expect(() =>
      Graph.compile({
        contracts: {
          'first.js': JSON.stringify(first),
          'second.js': JSON.stringify(second),
        },
        imports: { 'app.ts': { first: 'first.js', second: 'second.js' } },
        modules: { 'app.ts': `import 'first';import 'second'` },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: second.js:0: Conflicting stylesheet identity: --z-cssfunctionggnaaj17b3mnh-72-75-6c-65; compile libraries with package-qualified module IDs.]`,
    )
  })
  test('prunes unused named statements and emits JavaScript function formatters', async () => {
    const output = Transform.compile({
      moduleId: 'functions.js',
      source: `import {css} from 'zyzz';import {cssFunction,customMedia} from 'zyzz/web';const unused=customMedia(false);const dead=cssFunction({parameters:[],body:{result:1}});const twice=cssFunction({parameters:[{name:'--x',syntax:'<number>'}],returns:'<number>',body:{result:'calc(var(--x)*2)'}});export const styles={box:css({opacity:twice(+1)})};`,
    })
    expect(
      (await Esbuild.transform(output.code, { loader: 'js' })).warnings,
    ).toMatchInlineSnapshot('[]')
    expect(output.css).toMatchInlineSnapshot(`
      "@function --z-cssfunction172pj15vy9qt-74-77-69-63-65(--x <number>) returns <number>{result:calc(var(--x)*2);}
      .z-172pj15vy9qt-base0{opacity:--z-cssfunction172pj15vy9qt-74-77-69-63-65(1);}"
    `)
  })
  test('rejects unsupported CSS function arguments without emitting a bare identity', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {css} from 'zyzz';import {cssFunction} from 'zyzz/web';const amount=2;const twice=cssFunction({parameters:[{name:'--x',syntax:'<number>'}],body:{result:2}});export const styles={box:css({opacity:twice(amount)})};`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:202: Expected a literal string or number; expressions are not evaluated.]`,
    )
  })
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
