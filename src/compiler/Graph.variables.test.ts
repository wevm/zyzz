/** Exercises registered variables, packed references, immutable styles, and finite dynamic aliases. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import * as Vm from 'node:vm'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
const librarySource = `import {Vars} from 'zyzz';export const vars=Vars.define({amount:{type:'percentage',inherits:false,initialValue:'25%'},gap:{type:'length',inherits:true,initialValue:'4px'}});`
function compile() {
  const library = Graph.compile({
    modules: {
      'vars.ts': librarySource,
      'index.ts': `export {vars as layout} from './vars.js';`,
    },
  })
  const app = Graph.compile({
    contracts: { 'lib/index.js': library.contracts['index.ts']! },
    imports: { 'app.ts': { lib: 'lib/index.js', zyzz: null } },
    modules: {
      'app.ts': `import {css} from 'zyzz';import {layout} from 'lib';export {layout};const base={height:'20px',padding:layout.gap} as const;type Width='10px'|'30px';interface Values {width:Width}export const styles={registered:css({...base,width:layout.amount}),dynamic:css((values:Values)=>({...base,width:values.width}))};`,
    },
  })
  return { library, app }
}
async function bundle() {
  const { library, app } = compile()
  const bundle = await Esbuild.build({
    stdin: {
      contents: app.modules['app.ts']!.code,
      loader: 'ts',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'Fixture',
    alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
    plugins: [
      {
        name: 'library',
        setup(build) {
          build.onResolve({ filter: /^lib$/ }, () => ({
            path: 'index',
            namespace: 'fixture',
          }))
          build.onResolve(
            { filter: /^\.\/vars\.js$/, namespace: 'fixture' },
            () => ({ path: 'vars', namespace: 'fixture' }),
          )
          build.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            contents: library.modules[args.path + '.ts']!.code,
            loader: 'ts',
            resolveDir: process.cwd(),
          }))
        },
      },
    ],
  })
  return {
    css: (app.sharedCss ?? '') + app.modules['app.ts']!.css,
    code: bundle.outputFiles[0]!.text,
  }
}
describe('compile', () => {
  test('links registered variable references and assignments through packed aliases', async () => {
    expect(
      JSON.parse(compile().library.contracts['vars.ts']!).version,
    ).toMatchInlineSnapshot('8')
    const { code, css } = await bundle()
    const value = Vm.runInNewContext(`${code};Fixture;`) as {
      layout: {
        set: (values: Record<string, string>) => Record<string, string>
      }
      styles: {
        dynamic: (values: { width: string }) => {
          style: Record<string, string>
        }
      }
    }
    expect(Object.values(value.layout.set({ amount: '50%', gap: '8px' })))
      .toMatchInlineSnapshot(`
      [
        "50%",
        "8px",
      ]
    `)
    expect(Object.values(value.styles.dynamic({ width: '30px' }).style))
      .toMatchInlineSnapshot(`
      [
        "30px",
      ]
    `)
    expect(css).toMatchInlineSnapshot(`
      "@property --z-v4t4nbe1og4cic-76-61-72-73--61-6d-6f-75-6e-74{syntax:"<percentage>";inherits:false;initial-value:25%;}
      @property --z-v4t4nbe1og4cic-76-61-72-73--67-61-70{syntax:"<length>";inherits:true;initial-value:4px;}.z-1e8a67z1uaws1j-base0{height:20px;padding:var(--z-v4t4nbe1og4cic-76-61-72-73--67-61-70);}
      .z-style-1e8a67z1uaws1j-210{width:var(--z-v4t4nbe1og4cic-76-61-72-73--61-6d-6f-75-6e-74);}
      .z-style-1e8a67z1uaws1j-253{width:var(--z-d1e8a67z1uaws1j-253-77-69-64-74-68);}"
    `)
  })
  test('expands immutable members and shorthand while retaining dynamic intersections', () => {
    const graph = Graph.compile({
      modules: {
        'static.ts': `import {css,Vars} from 'zyzz';const dimensions={width:'12px',padding:'4px'} as const;const width=dimensions.width;const base={width,padding:dimensions.padding};type Width='10px'|'30px';type Values={width:Width}&{opacity:0|1};export const count=Vars.define({n:{type:'number',inherits:false,initialValue:-1}});export const styles={card:css({...base,padding:'8px'}),dynamic:css((values:Values)=>({width:values.width,opacity:values.opacity}))};`,
      },
    })
    expect(graph.modules['static.ts']!.css).toMatchInlineSnapshot(`
      ".z-15wl7di1emu9we-base1{padding:8px;}
      .z-style-15wl7di1emu9we-334{width:12px;}
      .z-15wl7di1emu9we-base0{opacity:var(--z-d15wl7di1emu9we-371-6f-70-61-63-69-74-79);}
      .z-style-15wl7di1emu9we-371{width:var(--z-d15wl7di1emu9we-371-77-69-64-74-68);}"
    `)
    expect(graph.sharedCss).toMatchInlineSnapshot(
      `"@property --z-v15wl7di1emu9we-63-6f-75-6e-74--6e{syntax:"<number>";inherits:false;initial-value:-1;}"`,
    )
    expect(
      graph.modules['static.ts']!.code.includes('values:Values'),
    ).toMatchInlineSnapshot('false')
  })
  test('keeps module type aliases when unrelated nested declarations shadow their names', () => {
    const output = Graph.compile({
      modules: {
        'app.ts': `import {css,Vars} from 'zyzz';type Values={width:'10px'};function unrelated(){type Values={width:unknown}}export const vars=Vars.define({gap:{type:'length',inherits:true,initialValue:'4px',syntax:undefined}});export const style=css((values:Values)=>({width:values.width}));`,
      },
    })
    expect(
      output.modules['app.ts']!.css.includes('width:var('),
    ).toMatchInlineSnapshot('true')
    expect(output.sharedCss?.includes('@property')).toMatchInlineSnapshot(
      'true',
    )
  })
  test('rejects mutation through nested record aliases', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'app.ts': `import {css} from 'zyzz';const base={width:'10px'};const holder={nested:{base}};holder.nested.base.width='20px';export const style=css(base);`,
        },
      }),
    ).toThrow(/cannot be mutated/)
  })
  test('does not resolve a shadowed type alias using the outer declaration', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'shadow.ts': `import {css} from 'zyzz';type Values={width:'10px'};function render(){type Values={width:unknown};return css((values:Values)=>({width:values.width}))}`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: shadow.ts:83: Dynamic values require explicit string or number scalar types.]`,
    )
  })
  test('rejects mutated and escaping static records through aliases', () => {
    const mutations = [
      `base.width='30px';`,
      `const alias=base;alias.width='30px';`,
      `consume(base);`,
    ]
    expect(
      mutations.map((mutation) => {
        try {
          Graph.compile({
            modules: {
              'app.ts': `import {css} from 'zyzz';const base={width:'10px'};${mutation}export const card=css(base);`,
            },
          })
          return 'accepted'
        } catch (error) {
          return (error as Error).message
        }
      }),
    ).toMatchInlineSnapshot(`
      [
        "app.ts:51: Static data cannot be mutated or escape to runtime calls.",
        "app.ts:68: Static data cannot be mutated or escape to runtime calls.",
        "app.ts:51: Static data cannot be mutated or escape to runtime calls.",
      ]
    `)
  })
  test('rejects loop writes and noncanonical array member keys', () => {
    for (const write of [
      `for(base.width of ['20px']){}`,
      `for(base.width in {x:1}){}`,
    ])
      expect(() =>
        Graph.compile({
          modules: {
            'app.js': `import {css} from 'zyzz';const base={width:'10px'};${write}export const card=css(base)`,
          },
        }),
      ).toThrow(/cannot be mutated/)
    expect(() =>
      Graph.compile({
        modules: {
          'app.js': `import {css} from 'zyzz';const sizes=['10px','20px'];export const card=css({width:sizes['01']})`,
        },
      }),
    ).toThrow()
  })
  test('does not publish values through type-only variable exports', () => {
    const output = Graph.compile({
      modules: {
        'vars.ts': `import {Vars} from 'zyzz';const vars=Vars.define({gap:'length'});type vars=typeof vars;export type {vars};export {type vars as other}`,
      },
    })
    expect(output.contracts['vars.ts']).toMatchInlineSnapshot('undefined')
  })
  test('applies registered defaults, inheritance, and assignment in Chromium', async () => {
    const { code, css } = await bundle()
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${css}</style><main style="width:400px"><div id="card"></div></main>`,
      )
      await page.addScriptTag({ content: code })
      await page.evaluate(
        `document.getElementById('card').className=Fixture.styles.registered().className`,
      )
      expect(
        await page
          .locator('#card')
          .evaluate((el) => getComputedStyle(el).width),
      ).toMatchInlineSnapshot('"100px"')
      await page.evaluate(
        `for(const [key,value]of Object.entries(Fixture.layout.set({amount:'50%',gap:'8px'})))document.querySelector('main').style.setProperty(key,value)`,
      )
      expect(
        await page
          .locator('#card')
          .evaluate((el) => getComputedStyle(el).width),
      ).toMatchInlineSnapshot('"100px"')
      expect(
        await page
          .locator('#card')
          .evaluate((el) => getComputedStyle(el).paddingLeft),
      ).toMatchInlineSnapshot('"8px"')
      await page.evaluate(
        `for(const [key,value]of Object.entries(Fixture.layout.set({amount:'75%'})))document.getElementById('card').style.setProperty(key,value)`,
      )
      expect(
        await page
          .locator('#card')
          .evaluate((el) => getComputedStyle(el).width),
      ).toMatchInlineSnapshot('"300px"')
    } finally {
      await browser.close()
    }
  })
})
