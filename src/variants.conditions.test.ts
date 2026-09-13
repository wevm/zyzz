/** Verifies conditional recipes against independent browser controls and packed themes. @module */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source } from 'zyzz/compiler'

const config = `import {Config} from 'zyzz';
export const {variants,theme}=Config.create({output:'html',theme:{breakpoints:{md:'600px'},color:{brand:'black'}}});`
const source = `import {variants,theme} from './config.js';
export const scope=theme.className;
export const button=variants({
  base:{padding:'2px',borderWidth:'0px',borderStyle:'solid',color:'brand',opacity:1,fontWeight:400},
  conditions:{wide:'@media >=md',compact:'@media/**/(height < 500px), print',grid:'@supports(display: grid)'},
  variants:{size:{sm:{padding:'4px',borderWidth:'2px'},lg:{padding:'12px'}},loading:{true:{opacity:0.5},false:{}},constructor:{normal:{}}},
  defaultVariants:{size:'sm',loading:false,constructor:'normal'},
  compoundVariants:[
    {when:{size:['sm','lg'],loading:true},style:{fontWeight:600}},
    {when:{size:'lg',loading:true},style:{color:'blue'}},
    {when:{size:'lg',loading:true},style:{fontWeight:700}}
  ]
});`

describe('variants', () => {
  test('complements negated media types and false support queries', async () => {
    const queries = [
      '@media NOT screen',
      '@media ONLY screen and (width > 0px)',
      '@media not ((width < 0px) or (height < 0px))',
      '@supports not (display: made-up-value)',
      '@supports (display: made-up-value)',
    ]
    const source = `import {variants} from 'zyzz';${queries
      .map(
        (query, index) =>
          `export const r${index}=variants({base:{color:'black'},conditions:{when:${JSON.stringify(query)}},variants:{tone:{selected:{color:'red'}}}});`,
      )
      .join('')}`
    const output = Graph.compile({ modules: { 'app.ts': source } }).modules[
      'app.ts'
    ]!
    const bundled = await Esbuild.build({
      stdin: { contents: output.code, loader: 'ts', resolveDir: process.cwd() },
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
        `<style>${output.css}</style>${queries.map((_, index) => `<button id="r${index}">Button</button>`).join('')}`,
      )
      await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
      await page.evaluate(`{
        for(const el of document.querySelectorAll('button')) {
          const props=App[el.id]({conditions:{when:{tone:'selected'}}});
          el.className=props.className;
          for(const [key,value] of Object.entries(props)) if(key.startsWith('data-')) el.setAttribute(key,value);
        }
        window.readColors=()=>[...document.querySelectorAll('button')].map(el=>getComputedStyle(el).color);
      }`)
      expect(await page.evaluate('readColors()')).toMatchInlineSnapshot(`
        [
          "rgb(0, 0, 0)",
          "rgb(255, 0, 0)",
          "rgb(255, 0, 0)",
          "rgb(255, 0, 0)",
          "rgb(0, 0, 0)",
        ]
      `)
      await page.emulateMedia({ media: 'print' })
      expect(await page.evaluate('readColors()')).toMatchInlineSnapshot(`
        [
          "rgb(255, 0, 0)",
          "rgb(0, 0, 0)",
          "rgb(255, 0, 0)",
          "rgb(255, 0, 0)",
          "rgb(0, 0, 0)",
        ]
      `)
    } finally {
      await browser.close()
    }
  })

  test('selects effective choices and compounds through viewport and application changes', async () => {
    const publisher = Graph.compile({ modules: { 'config.ts': config } })
    const result = Graph.compile({
      modules: { 'app.ts': source },
      contracts: publisher.contracts,
      imports: { 'app.ts': { './config.js': 'config.ts' } },
    })
    const direct = Graph.compile({
      modules: { 'config.ts': config, 'app.ts': source },
    })
    const output = result.modules['app.ts']!
    expect(output.css === direct.modules['app.ts']!.css).toMatchInlineSnapshot(
      'true',
    )
    expect(
      output.code.includes(
        'conditions:{"wide":unknown;"compact":unknown;"grid":unknown}',
      ),
    ).toMatchInlineSnapshot('true')

    const bundled = await Esbuild.build({
      stdin: { contents: output.code, loader: 'ts', resolveDir: process.cwd() },
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
      const page = await browser.newPage({
        viewport: { width: 400, height: 800 },
      })
      await page.setContent(`<style>${publisher.sharedCss ?? ''}\n${result.sharedCss ?? ''}\n${output.css}</style>
        <style>
          #control{padding:2px;border:0 solid;color:black;opacity:1;font-weight:400}
          @supports (display:grid){#control{opacity:.5}}
          @media screen and (height >= 500px) and (width < 600px){#control{padding:4px;border-width:2px;font-weight:600}}
          @media screen and (height >= 500px) and (width >= 600px){#control{padding:12px;color:blue;font-weight:700}}
        </style><main><button id="button">Recipe</button><button id="control">Control</button></main>`)
      await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
      await page.evaluate(`{
        document.querySelector('main').className=App.scope;
        window.read = id => {
          const s=getComputedStyle(document.getElementById(id));
          return [s.paddingTop,s.borderTopWidth,s.color,s.opacity,s.fontWeight];
        };
        window.apply = input => {
          const el=document.getElementById('button');
          for(const attr of [...el.attributes]) if(attr.name!=='id') el.removeAttribute(attr.name);
          for(const [key,value] of Object.entries(App.button(input))) el.setAttribute(key,value);
          return read('button');
        };
        apply({conditions:{wide:{size:'lg'},compact:{size:null},grid:{loading:true}}});
        window.initialRules=document.styleSheets[0].cssRules.length;
      }`)

      expect(
        await page.evaluate(`App.button()['data-constructor']`),
      ).toMatchInlineSnapshot('"normal"')
      expect(
        await page.evaluate(
          `App.button({conditions:{wide:{}}})['data-zyzz-condition-0-constructor']`,
        ),
      ).toMatchInlineSnapshot('undefined')

      for (const viewport of [
        { width: 400, height: 800 },
        { width: 800, height: 800 },
        { width: 800, height: 400 },
        { width: 400, height: 400 },
        { width: 800, height: 800 },
      ]) {
        await page.setViewportSize(viewport)
        expect(
          await page.evaluate(
            `JSON.stringify(read('button'))===JSON.stringify(read('control'))`,
          ),
        ).toMatchInlineSnapshot('true')
      }
      expect(await page.evaluate(`read('button')`)).toMatchInlineSnapshot(`
        [
          "12px",
          "0px",
          "rgb(0, 0, 255)",
          "0.5",
          "700",
        ]
      `)
      await page.emulateMedia({ media: 'print' })
      expect(
        await page.evaluate(
          `JSON.stringify(read('button'))===JSON.stringify(read('control'))`,
        ),
      ).toMatchInlineSnapshot('true')
      await page.emulateMedia({ media: 'screen' })
      await page.setViewportSize({ width: 800, height: 400 })
      expect(
        await page.evaluate(
          `apply({conditions:{wide:{size:'lg',loading:true},compact:{size:undefined,loading:false},grid:undefined}})`,
        ),
      ).toMatchInlineSnapshot(`
        [
          "12px",
          "0px",
          "rgb(0, 0, 0)",
          "1",
          "400",
        ]
      `)
      expect(
        await page.evaluate(
          `apply({size:null,loading:null,conditions:{wide:{size:'lg'},compact:{size:undefined},grid:{loading:undefined}}})`,
        ),
      ).toMatchInlineSnapshot(`
        [
          "12px",
          "0px",
          "rgb(0, 0, 0)",
          "1",
          "400",
        ]
      `)
      await page.setViewportSize({ width: 400, height: 800 })
      expect(await page.evaluate(`read('button')`)).toMatchInlineSnapshot(`
        [
          "2px",
          "0px",
          "rgb(0, 0, 0)",
          "1",
          "400",
        ]
      `)
      expect(
        await page.evaluate(
          `document.styleSheets[0].cssRules.length===initialRules`,
        ),
      ).toMatchInlineSnapshot('true')
    } finally {
      await browser.close()
    }
  })

  test('rejects unsupported grouping rules at the authored condition', () => {
    expect(() =>
      Source.extract({
        moduleId: 'app.ts',
        source: `import {variants} from 'zyzz'; variants({conditions:{wide:'@container (width > 20px)'}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:58: Recipe conditions support only @media and @supports.]`,
    )
  })

  test('bounds condition expansion before generating region styles', () => {
    const conditions = Array.from(
      { length: 9 },
      (_, index) => `c${index}:'@media (width >= ${index}px)'`,
    ).join(',')
    expect(() =>
      Source.extract({
        moduleId: 'app.ts',
        source: `import {variants} from 'zyzz'; variants({conditions:{${conditions}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:272: Recipes support at most eight named conditions (256 CSS regions).]`,
    )
  })
})
