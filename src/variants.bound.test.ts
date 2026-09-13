/** Exercises bound recipe extraction, packed aliases, and native HTML rendering. @module */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

describe('variants', () => {
  test('retains mixed theme bindings through renamed exports and packed consumers', async () => {
    const modules = {
      'theme.ts': `import {Theme} from 'zyzz';
export const theme=Theme.define({color:{brand:'#06c'}});
const {css:style,variants:recipe}=theme;
const alias=recipe;
export {style,alias};`,
      'index.ts': `export {style as css,alias as variants,theme} from './theme.js';`,
    }
    const app = `import {css,variants,theme} from './index.js';
export const scope=theme.className;
export const base=css({color:'black',padding:'6px'});
export const button=variants({variants:{intent:{primary:{color:'brand'},quiet:{color:'red'}}},defaultVariants:{intent:'primary'}});`
    const publisher = Graph.compile({ modules })
    const packed = Graph.compile({
      modules: { 'app.ts': app },
      contracts: publisher.contracts,
      imports: { 'app.ts': { './index.js': 'index.ts' } },
    })
    const source = Graph.compile({ modules: { ...modules, 'app.ts': app } })

    expect(
      packed.modules['app.ts']!.css === source.modules['app.ts']!.css,
    ).toMatchInlineSnapshot('true')
    expect(
      publisher.modules['theme.ts']!.code.includes(
        '{css:undefined,variants:undefined}',
      ),
    ).toMatchInlineSnapshot('true')

    const bundled = await Esbuild.build({
      stdin: {
        contents: packed.modules['app.ts']!.code,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
      bundle: true,
      format: 'iife',
      globalName: 'App',
      write: false,
    })
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    })
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${publisher.sharedCss ?? ''}\n${packed.sharedCss ?? ''}\n${packed.modules['app.ts']!.css}</style><main><button>Button</button></main>`,
      )
      await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
      expect(
        await page.evaluate(`{
        document.querySelector('main').className=App.scope;
        const button=document.querySelector('button');
        const states=[];
        for(const intent of [undefined,'quiet',null,'primary']) {
          const props=App.button({intent});
          button.className=App.base().className+' '+props.className;
          button.removeAttribute('data-intent');
          if(props['data-intent']!==undefined) button.setAttribute('data-intent',props['data-intent']);
          const computed=getComputedStyle(button);
          states.push([computed.color,computed.paddingLeft]);
        }
        states;
      }`),
      ).toMatchInlineSnapshot(`
        [
          [
            "rgb(0, 102, 204)",
            "6px",
          ],
          [
            "rgb(255, 0, 0)",
            "6px",
          ],
          [
            "rgb(0, 0, 0)",
            "6px",
          ],
          [
            "rgb(0, 102, 204)",
            "6px",
          ],
        ]
      `)
    } finally {
      await browser.close()
    }
  })

  test('preserves configured aliases through source and packed contracts', async () => {
    const config = `import {Config} from 'zyzz'; export const {variants,theme}=Config.create({output:'html',theme:{color:{brand:'#06c'}},shorthands:{px:['paddingLeft','paddingRight']}})`
    const app = `import {variants as recipe,theme} from './config.js'; export const scope=theme.className; export const button=recipe({base:{px:'8px'},variants:{intent:{primary:{color:'brand'},quiet:{color:'black'}}},defaultVariants:{intent:'primary'}})`
    const publisher = Graph.compile({ modules: { 'config.ts': config } })
    const result = Graph.compile({
      modules: { 'app.ts': app },
      contracts: publisher.contracts,
      imports: { 'app.ts': { './config.js': 'config.ts' } },
    })
    const source = Graph.compile({
      modules: { 'config.ts': config, 'app.ts': app },
    })
    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(
      `
      ".z_theme-u8smm21l81sow-variants-theme{--z-tu8smm21l81sow-variants-color_2e_brand:#06c;}
      .z-style-1e8a67z1uaws1j-110{padding-left:8px;padding-right:8px;&:where([data-intent="primary"]){color:var(--z-tu8smm21l81sow-variants-color_2e_brand,#06c);}&:where([data-intent="quiet"]){color:black;}}"
    `,
    )
    expect(
      result.modules['app.ts']!.css === source.modules['app.ts']!.css,
    ).toMatchInlineSnapshot('true')
    expect(
      JSON.parse(publisher.contracts['config.ts']!).version,
    ).toMatchInlineSnapshot('15')
    const bundled = await Esbuild.build({
      stdin: {
        contents: result.modules['app.ts']!.code,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
      bundle: true,
      format: 'iife',
      globalName: 'App',
      write: false,
    })
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    })
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${publisher.sharedCss ?? ''}\n${result.sharedCss ?? ''}\n${result.modules['app.ts']!.css}</style><main><button>Button</button></main>`,
      )
      await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
      expect(
        await page.evaluate(`{
        document.querySelector('main').className=App.scope;
        const button=document.querySelector('button');
        const props=App.button();
        for(const [key,value] of Object.entries(props)) button.setAttribute(key,value);
        const computed=getComputedStyle(button);
        [computed.color,computed.paddingLeft,computed.paddingRight,props['data-intent'],Object.hasOwn(props,'className')];
      }`),
      ).toMatchInlineSnapshot(`
        [
          "rgb(0, 102, 204)",
          "8px",
          "8px",
          "primary",
          false,
        ]
      `)
    } finally {
      await browser.close()
    }
  })

  test('supports local theme recipes and destructured aliases', () => {
    const output = Graph.compile({
      modules: {
        'app.ts': `import {Theme} from 'zyzz'; const theme=Theme.define({color:{brand:'#06c'}}); const {variants}=theme; export const a=theme.variants({base:{color:'brand'}}); export const b=variants({base:{color:'brand'}});`,
      },
    })
    expect(
      output.modules['app.ts']!.code.includes('Recipe'),
    ).toMatchInlineSnapshot('true')
  })
})
