/** Verifies static composition order against native CSS controls in Chromium. @module */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

describe('cx', () => {
  test('compiles repeated groups, partial shorthands, fallbacks, importance, and matching conditions', async () => {
    const source = `import {css,cx} from 'zyzz';
      namespace styles {
        export const a=css({padding:'8px',color:'red',display:['block','grid'],'@media (width >= 600px)':{color:'green'},opacity:'0.5!'});
        export const b=css({paddingLeft:'12px',color:'blue','@media (width >= 600px)':{color:'purple'},opacity:1});
      }
      export const ab=cx(styles.a(),false,null,undefined,styles.b());
      export const aba=cx(styles.a(),styles.b(),styles.a());
      export const inline=cx(css({color:'red'})(),css({color:'blue'})());`
    const output = Transform.compile({ moduleId: 'app.ts', source })
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
      await page.setContent(`<style>${output.css}
        .a{padding:8px;color:red;display:block;display:grid;opacity:.5!important}
        .b{padding-left:12px;color:blue;opacity:1}
        .again{padding:8px;color:red;display:block;display:grid;opacity:.5!important}
        @media(width >= 600px){.a{color:green}.b{color:purple}.again{color:green}}
        </style><div id="ab"></div><div id="aba"></div><div id="inline"></div><div id="control-ab" class="a b"></div><div id="control-aba" class="a b again"></div>`)
      await page.addScriptTag({ content: bundled.outputFiles![0]!.text })
      await page.evaluate(`for(const name of ['ab','aba','inline']) document.getElementById(name).className=App[name].className;
        window.read=(name)=>{const style=getComputedStyle(document.getElementById(name));return [style.padding,style.color,style.display,style.opacity]}`)
      for (const width of [500, 800]) {
        await page.setViewportSize({ width, height: 800 })
        for (const name of ['ab', 'aba'])
          expect(await page.evaluate(`read('${name}')`)).toEqual(
            await page.evaluate(`read('control-${name}')`),
          )
      }
      expect(
        await page.evaluate(
          "getComputedStyle(document.getElementById('inline')).color",
        ),
      ).toBe('rgb(0, 0, 255)')
    } finally {
      await browser.close()
    }
  })

  test('preserves initialization failures after bundling and original declaration maps', async () => {
    const source = `import {css,cx as compose} from 'zyzz';export const props=compose(a());const a=css({color:'red'});`
    const output = Transform.compile({ moduleId: 'early.ts', source })
    const bundled = await Esbuild.build({
      stdin: { contents: output.code, loader: 'ts', resolveDir: process.cwd() },
      alias: { 'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts` },
      bundle: true,
      format: 'esm',
      write: false,
    })
    await expect(
      import(
        `data:text/javascript;base64,${Buffer.from(bundled.outputFiles![0]!.text).toString('base64')}`
      ),
    ).rejects.toThrow()

    const mapped = Transform.compile({
      moduleId: 'mapped.ts',
      source: `import {css,cx} from 'zyzz';const a=css({color:'red'});const b=css({padding:'8px'});export const props=cx(a(),b());`,
    })
    const start = mapped.css.lastIndexOf('color:red')
    const prefix = mapped.css.slice(0, start).split('\n')
    const position = Trace.originalPositionFor(
      new Trace.TraceMap(mapped.cssMap),
      { line: prefix.length, column: prefix.at(-1)!.length },
    )
    expect(position.source).toBe('mapped.ts')
    expect(position.line).toBe(1)
    expect(position.column).toBe(
      `import {css,cx} from 'zyzz';const a=css({`.length,
    )
  })

  test('rejects unresolved runtime selections before emitting misleading composition', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'app.ts',
        source: `import {css,cx} from 'zyzz';const a=css({color:'red'});export const compose=(enabled:boolean)=>cx(enabled && a());`,
      }),
    ).toThrow('static local style applications')
  })
})
