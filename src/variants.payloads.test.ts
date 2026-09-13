/** Exercises dynamic recipe compilation, browser updates, and conditional slot isolation. @module */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source } from 'zyzz/compiler'

describe('variants', () => {
  test('reads payload getters once and accepts static template defaults', async () => {
    const source =
      "import { variants } from 'zyzz'; export const button = variants({ variants: { size: { custom: (values: { padding: `${number}px` }) => ({ padding: values.padding }) } }, defaultVariants: { size: { custom: { padding: `${12}px` } } } });"
    const output = Graph.compile({ modules: { 'getter.ts': source } }).modules[
      'getter.ts'
    ]!
    const bundled = await Esbuild.build({
      stdin: { contents: output.code, loader: 'ts', resolveDir: process.cwd() },
      alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
      bundle: true,
      format: 'cjs',
      write: false,
    })
    const module = {
      exports: {} as { button: (input?: object) => { style: object } },
    }
    new Function('module', 'exports', bundled.outputFiles![0]!.text)(
      module,
      module.exports,
    )
    let reads = 0
    const props = module.exports.button({
      size: {
        custom: {
          get padding() {
            reads++
            return '18px'
          },
        },
      },
    })
    expect(reads).toMatchInlineSnapshot('1')
    expect(Object.values(props.style)).toMatchInlineSnapshot(`
      [
        "18px",
      ]
    `)
    expect(Object.values(module.exports.button().style)).toMatchInlineSnapshot(`
      [
        "12px",
      ]
    `)
  })

  test('rejects magic condition and dynamic choice names', () => {
    expect(() =>
      Source.extract({
        moduleId: 'reserved.ts',
        source:
          "import {variants} from 'zyzz'; variants({conditions:{__proto__:'@media screen'}})",
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: reserved.ts:53: Static object prototypes are unsupported.]`,
    )
    expect(() =>
      Source.extract({
        moduleId: 'reserved.ts',
        source:
          "import {variants} from 'zyzz'; variants({variants:{size:{__proto__:(values:{padding:string})=>({padding:values.padding})}}})",
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: reserved.ts:57: Static object prototypes are unsupported.]`,
    )
  })

  test('rejects malformed callback authoring and incomplete defaults', () => {
    for (const body of [
      'variants:{size:{custom:(values)=>({padding:values.padding})}}',
      'variants:{size:{custom:(values:{padding?:string})=>({padding:values.padding})}}',
      "variants:{size:{custom:(values:{padding:string})=>({padding:values.padding})}},defaultVariants:{size:'custom'}",
      'variants:{size:{custom:(values:{padding:string})=>({padding:values.padding})}},defaultVariants:{size:{custom:{}}}',
      "variants:{size:{custom:(values:{padding:string})=>({padding:values.padding})}},defaultVariants:{size:{custom:{padding:'4px',extra:1}}}",
      'variants:{size:{custom:(values:{padding:string})=>({padding:values.missing})}}',
      'variants:{size:{custom:(values:{count:number})=>({zIndex:values.count})}}',
    ])
      expect(() =>
        Source.extract({
          moduleId: 'bad.ts',
          source: `import {variants} from 'zyzz';variants({${body}})`,
        }),
      ).toThrow()
  })

  test('retains bound shorthands and same-named payload fields through packed contracts', async () => {
    const config = `import {Config} from 'zyzz';export const {variants}=Config.create({output:'html',theme:{color:{brand:'black'}},shorthands:{px:['paddingLeft','paddingRight']}});`
    const source = `import {variants as recipe} from './config.js';export const button=recipe({base:{borderColor:'brand'},variants:{size:{custom:(values:{value:\`\${number}px\`})=>({px:values.value,paddingLeft:'3px'})},tone:{custom:(values:{value:'red'|'blue'})=>({color:values.value})},constructor:{normal:{}}},defaultVariants:{size:{custom:{value:'12px'}},tone:{custom:{value:'red'}}}});`
    const publisher = Graph.compile({ modules: { 'config.ts': config } })
    const packed = Graph.compile({
      modules: { 'app.ts': source },
      contracts: publisher.contracts,
      imports: { 'app.ts': { './config.js': 'config.ts' } },
    }).modules['app.ts']!
    const direct = Graph.compile({
      modules: { 'config.ts': config, 'app.ts': source },
    }).modules['app.ts']!
    expect(packed.css).toBe(direct.css)
    const bundled = await Esbuild.build({
      stdin: { contents: packed.code, loader: 'ts', resolveDir: process.cwd() },
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
        `<style>${packed.css}</style><button>Button</button>`,
      )
      await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
      expect(
        await page.evaluate(`{
        const props=App.button({size:{custom:{value:'18px'}},tone:{custom:{value:'blue'}}});
        const element=document.querySelector('button');
        for(const [name,value] of Object.entries(props)) element.setAttribute(name,value);
        const style=getComputedStyle(element);
        [style.paddingLeft,style.paddingRight,style.color,element.hasAttribute('data-constructor'),typeof props.style];
      }`),
      ).toEqual(['3px', '18px', 'rgb(0, 0, 255)', false, 'string'])
    } finally {
      await browser.close()
    }
  })

  test('binds independent base and conditional payloads and removes stale styles', async () => {
    const source = `import {variants} from 'zyzz';
      export const button=variants({
        base:{padding:'2px'},
        conditions:{wide:'@media (width >= 600px)'},
        variants:{size:{sm:{padding:'4px'},custom:(values:{padding:\`\${number}px\`})=>({padding:values.padding})}},
        defaultVariants:{size:{custom:{padding:'12px'}}},
        compoundVariants:[{when:{size:'custom'},style:{color:'red'}}]
      });`
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
      const page = await browser.newPage({
        viewport: { width: 500, height: 800 },
      })
      await page.setContent(
        `<style>${output.css}</style><button>Button</button>`,
      )
      await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
      await page.evaluate(`window.apply=(input)=>{
        const element=document.querySelector('button');
        for(const name of element.getAttributeNames()) element.removeAttribute(name);
        const props=App.button(input);
        element.className=props.className;
        for(const [key,value] of Object.entries(props)) {
          if(key.startsWith('data-')) element.setAttribute(key,value);
          if(key==='style') for(const [name,bound] of Object.entries(value)) element.style.setProperty(name,String(bound));
        }
        const style=getComputedStyle(element);
        return {padding:style.padding,color:style.color,slots:Object.keys(props.style??{}).length};
      }`)
      expect(await page.evaluate('apply()')).toEqual({
        padding: '12px',
        color: 'rgb(255, 0, 0)',
        slots: 1,
      })
      expect(
        await page.evaluate(
          "apply({size:{custom:{padding:'16px'}},conditions:{wide:{size:{custom:{padding:'24px'}}}}})",
        ),
      ).toEqual({ padding: '16px', color: 'rgb(255, 0, 0)', slots: 2 })
      await page.setViewportSize({ width: 800, height: 800 })
      expect(
        await page.evaluate(
          "getComputedStyle(document.querySelector('button')).padding",
        ),
      ).toBe('24px')
      expect(await page.evaluate("apply({size:'sm'})")).toEqual({
        padding: '4px',
        color: 'rgb(0, 0, 0)',
        slots: 0,
      })
      expect(await page.evaluate('apply({size:null})')).toEqual({
        padding: '2px',
        color: 'rgb(0, 0, 0)',
        slots: 0,
      })
    } finally {
      await browser.close()
    }
  })
})
