/** Exercises property aliases and dedicated spacing tokens through packed compilation and browser rendering. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

const config = `import {Config} from 'zyzz';export const {css,theme}=Config.create({shorthands:{px:['paddingLeft','paddingRight'],paddingX:['paddingLeft','paddingRight'],space:['marginLeft','paddingLeft']},theme:{spacing:{sm:'4px'},margin:{sm:'-8px'},padding:{sm:'12px'}}});`
const source = `import {css,theme} from 'library';export const styles={card:css({px:'sm',paddingLeft:'2px',':hover':{paddingX:'sm!'}}),mixed:css({space:'sm'}),handle:theme.css({px:'sm'}),dynamic:css((values:{width:'10px'|'20px'})=>({px:values.width}))};`
function compile() {
  const library = Graph.compile({
    modules: {
      'config.ts': config,
      'index.ts': `export {css,theme} from './config.js';`,
    },
  })
  const app = Graph.compile({
    contracts: { 'library/index.js': library.contracts['index.ts']! },
    imports: { 'app.ts': { library: 'library/index.js' } },
    modules: { 'app.ts': source },
  })
  return { app, library }
}
describe('create', () => {
  test('rejects conflicting packed mappings before reusing theme identities', () => {
    const { library } = compile()
    const original = library.contracts['config.ts']!
    const changed = JSON.parse(original)
    expect(changed.version).toMatchInlineSnapshot('5')
    for (const value of Object.values(changed.themes) as {
      shorthands: Record<string, string[]>
    }[])
      value.shorthands.px = ['marginLeft', 'marginRight']
    expect(() =>
      Graph.compile({
        contracts: { 'a.js': original, 'b.js': JSON.stringify(changed) },
        imports: { 'app.ts': { a: 'a.js', b: 'b.js' } },
        modules: {
          'app.ts': `import {css as a} from 'a';import {css as b} from 'b';export const styles={a:a({px:'sm'}),b:b({px:'sm'})}`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: b.js:0: Invalid library contract: Conflicting packed shorthand mappings for one theme identity.]`,
    )
  })
  test('accepts quoted aliases and independently validates numeric targets', () => {
    const graph = Graph.compile({
      modules: {
        'app.ts': `import {Config,Theme} from 'zyzz';const {css,theme}=Config.create({shorthands:{'padding-x':['paddingLeft','paddingRight'],mixed:['scale','order']},theme:{spacing:{sm:'4px'}}});const extended=Theme.extend(theme,{spacing:{sm:'8px'}});export const styles={card:extended.css({'padding-x':'sm'}),dynamic:css((values:{n:1|2})=>({mixed:values.n}))}`,
      },
    })
    expect(graph.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1e8a67z1uaws1j-css-theme{--z-t1e8a67z1uaws1j-css-spacing_2e_sm:4px;}
      .z_theme-1e8a67z1uaws1j-extended{--z-t1e8a67z1uaws1j-css-spacing_2e_sm:8px;}
      .z-1e8a67z1uaws1j-base0{padding-left:var(--z-t1e8a67z1uaws1j-css-spacing_2e_sm,8px);padding-right:var(--z-t1e8a67z1uaws1j-css-spacing_2e_sm,8px);}
      .z-1e8a67z1uaws1j-base1{scale:var(--z-d1e8a67z1uaws1j-299-6e);order:var(--z-d1e8a67z1uaws1j-299-6e);}"
    `)
  })
  test('preserves ordered targets and spacing precedence across packed imports', () => {
    const { app } = compile()
    expect(app.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-u8smm21l81sow-css-theme{--z-tu8smm21l81sow-css-padding_2e_sm:12px;--z-tu8smm21l81sow-css-margin_2e_sm:-8px;--z-tu8smm21l81sow-css-spacing_2e_sm:4px;}
      .z-style-1e8a67z1uaws1j-60{padding-left:var(--z-tu8smm21l81sow-css-padding_2e_sm,12px);padding-right:var(--z-tu8smm21l81sow-css-padding_2e_sm,12px);padding-left:2px;&:hover{padding-left:var(--z-tu8smm21l81sow-css-padding_2e_sm,12px)!important;padding-right:var(--z-tu8smm21l81sow-css-padding_2e_sm,12px)!important;}}
      .z-style-1e8a67z1uaws1j-125{margin-left:var(--z-tu8smm21l81sow-css-margin_2e_sm,-8px);padding-left:var(--z-tu8smm21l81sow-css-padding_2e_sm,12px);}
      .z-style-1e8a67z1uaws1j-150{padding-left:var(--z-tu8smm21l81sow-css-padding_2e_sm,12px);padding-right:var(--z-tu8smm21l81sow-css-padding_2e_sm,12px);}
      .z-style-1e8a67z1uaws1j-179{padding-left:var(--z-d1e8a67z1uaws1j-179-77-69-64-74-68);padding-right:var(--z-d1e8a67z1uaws1j-179-77-69-64-74-68);}"
    `)
    expect(app.modules['app.ts']!.code.includes('px:')).toMatchInlineSnapshot(
      'false',
    )
  })
  test('rebuilds consumers after a mapping edit', () => {
    const graph = Graph.create()
    const modules = {
      'config.ts': config,
      'app.ts': `import {css} from './config.js';export const card=css({px:'sm'});`,
    }
    const before = graph.compile({ modules })
    const after = graph.compile({
      modules: {
        ...modules,
        'config.ts': config.replace(
          "px:['paddingLeft','paddingRight']",
          "px:['paddingTop','paddingBottom']",
        ),
      },
    })
    expect(
      before.modules['app.ts']!.css.includes('padding-left:'),
    ).toMatchInlineSnapshot('true')
    expect(
      after.modules['app.ts']!.css.includes('padding-left:'),
    ).toMatchInlineSnapshot('false')
    expect(
      after.modules['app.ts']!.css.includes('padding-top:'),
    ).toMatchInlineSnapshot('true')
  })
  test('rejects invalid mappings', () => {
    const invalid = [
      '{px:[]}',
      "{px:['paddingLeft','paddingLeft']}",
      "{px:['notAProperty']}",
      "{padding:['paddingLeft']}",
      "{px:['paddingX'],paddingX:['paddingLeft']}",
    ]
    const errors = invalid.map((shorthands) => {
      try {
        Graph.compile({
          modules: {
            'config.ts': `import {Config} from 'zyzz';export const config=Config.create({shorthands:${shorthands}});`,
          },
        })
        return 'accepted'
      } catch (error) {
        return (error as Error).message
      }
    })
    expect(errors).toMatchInlineSnapshot(`
      [
        "config.ts:48: Shorthand px requires a nonempty property tuple.",
        "config.ts:48: Shorthand px requires unique standard properties.",
        "config.ts:48: Shorthand px requires unique standard properties.",
        "config.ts:48: Invalid shorthand name: padding",
        "config.ts:48: Shorthand px requires unique standard properties.",
      ]
    `)
  })
  test('renders alias order, nested importance, and dynamic slots in Chromium', async () => {
    const { app, library } = compile()
    const bundle = await Esbuild.build({
      stdin: {
        contents: app.modules['app.ts']!.code.replace(
          "from 'library'",
          "from './config.ts'",
        ),
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: 'iife',
      globalName: 'Fixture',
      write: false,
      alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
      plugins: [
        {
          name: 'config',
          setup(build) {
            build.onResolve({ filter: /^\.\/config\.ts$/ }, () => ({
              path: 'config.ts',
              namespace: 'fixture',
            }))
            build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
              contents: library.modules['config.ts']!.code,
              loader: 'ts',
              resolveDir: process.cwd(),
            }))
          },
        },
      ],
    })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${app.modules['app.ts']!.css}</style><div id="card">Card</div><div id="mixed"></div><div id="dynamic"></div>`,
      )
      await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
      await page.evaluate(
        `for(const id of ['card','mixed','dynamic']){const props=Fixture.styles[id](id==='dynamic'?{width:'20px'}:{});const el=document.getElementById(id);el.className=props.className;for(const [key,value]of Object.entries(props.style??{})){if(key.startsWith('--'))el.style.setProperty(key,String(value));else el.style[key]=value}}`,
      )
      expect(
        await page
          .locator('#card')
          .evaluate((el) => getComputedStyle(el).paddingLeft),
      ).toMatchInlineSnapshot('"2px"')
      expect(
        await page
          .locator('#card')
          .evaluate((el) => getComputedStyle(el).paddingRight),
      ).toMatchInlineSnapshot('"12px"')
      expect(
        await page
          .locator('#mixed')
          .evaluate((el) => getComputedStyle(el).marginLeft),
      ).toMatchInlineSnapshot('"-8px"')
      expect(
        await page
          .locator('#mixed')
          .evaluate((el) => getComputedStyle(el).paddingLeft),
      ).toMatchInlineSnapshot('"12px"')
      expect(
        await page
          .locator('#dynamic')
          .evaluate((el) => getComputedStyle(el).paddingRight),
      ).toMatchInlineSnapshot('"20px"')
      await page.locator('#card').hover()
      expect(
        await page
          .locator('#card')
          .evaluate((el) => getComputedStyle(el).paddingLeft),
      ).toMatchInlineSnapshot('"12px"')
    } finally {
      await browser.close()
    }
  })
})
