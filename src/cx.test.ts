/** Verifies static composition order against native CSS controls in Chromium. @module */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Source, Transform } from 'zyzz/compiler'

describe('cx', () => {
  test('uses lexical references and expands each selected mapping', () => {
    const source = `import { Config, css, cx } from 'zyzz';
      const { css: bound } = Config.create({ shorthands: { px: ['paddingLeft', 'paddingRight'] } });
      const color = css({ color: 'red' });
      const mapped = bound({ px: '8px' });
      function unrelated(color: string) { return color }
      type Input = Parameters<typeof color>[0];
      export const props = cx(color(), mapped());`
    const output = Transform.compile({ moduleId: 'mapped.ts', source })
    expect(
      output.css.includes('padding-left:8px;padding-right:8px'),
    ).toMatchInlineSnapshot('true')
    const prefix = output.css
      .slice(0, output.css.lastIndexOf('padding-right:8px'))
      .split('\n')
    const position = Trace.originalPositionFor(
      new Trace.TraceMap(output.cssMap),
      { line: prefix.length, column: prefix.at(-1)!.length },
    )
    expect(position.source).toMatchInlineSnapshot('"mapped.ts"')
    expect(position.line).toMatchInlineSnapshot('4')
  })

  test('emits only reachable nested composition groups', () => {
    const output = Source.extract({
      moduleId: 'nested.ts',
      source: `import {css,cx} from 'zyzz'; const a=css({color:'red'}); export const props=cx(cx(a()),a());`,
    })
    expect(
      output.calls.filter((call) => call.composition).length,
    ).toMatchInlineSnapshot('1')
  })
  test('rejects extra style invocation', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {css,cx} from 'zyzz'; const a=css({}); cx(a()());`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:49: Composition requires statically known local style applications.]`,
    )
  })
  test('rejects extra inline invocation', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {css,cx} from 'zyzz'; cx(css({})()());`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:32: Composition requires statically known local style applications.]`,
    )
  })
  test('rejects extra nested invocation', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {css,cx} from 'zyzz'; const a=css({}); cx(cx(a())());`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:49: Composition requires statically known local style applications.]`,
    )
  })
  test('rejects namespace composition', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import * as Z from 'zyzz'; import {css} from 'zyzz'; Z.cx(css({})());`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:53: Import cx by name; namespace authoring calls are not supported yet.]`,
    )
  })

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
        window.read=(name,key)=>getComputedStyle(document.getElementById(name))[key]`)
      await page.setViewportSize({ width: 500, height: 800 })
      expect(await page.evaluate(`read('ab','padding')`)).toMatchInlineSnapshot(
        '"8px 8px 8px 12px"',
      )
      expect(
        await page.evaluate(`read('control-ab','padding')`),
      ).toMatchInlineSnapshot('"8px 8px 8px 12px"')
      expect(await page.evaluate(`read('ab','color')`)).toMatchInlineSnapshot(
        '"rgb(0, 0, 255)"',
      )
      expect(
        await page.evaluate(`read('control-ab','color')`),
      ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
      expect(await page.evaluate(`read('ab','display')`)).toMatchInlineSnapshot(
        '"grid"',
      )
      expect(
        await page.evaluate(`read('control-ab','display')`),
      ).toMatchInlineSnapshot('"grid"')
      expect(await page.evaluate(`read('ab','opacity')`)).toMatchInlineSnapshot(
        '"0.5"',
      )
      expect(
        await page.evaluate(`read('control-ab','opacity')`),
      ).toMatchInlineSnapshot('"0.5"')
      expect(
        await page.evaluate(`read('aba','padding')`),
      ).toMatchInlineSnapshot('"8px"')
      expect(
        await page.evaluate(`read('control-aba','padding')`),
      ).toMatchInlineSnapshot('"8px"')
      expect(await page.evaluate(`read('aba','color')`)).toMatchInlineSnapshot(
        '"rgb(255, 0, 0)"',
      )
      expect(
        await page.evaluate(`read('control-aba','color')`),
      ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
      expect(
        await page.evaluate(`read('aba','display')`),
      ).toMatchInlineSnapshot('"grid"')
      expect(
        await page.evaluate(`read('control-aba','display')`),
      ).toMatchInlineSnapshot('"grid"')
      expect(
        await page.evaluate(`read('aba','opacity')`),
      ).toMatchInlineSnapshot('"0.5"')
      expect(
        await page.evaluate(`read('control-aba','opacity')`),
      ).toMatchInlineSnapshot('"0.5"')
      await page.setViewportSize({ width: 800, height: 800 })
      expect(await page.evaluate(`read('ab','padding')`)).toMatchInlineSnapshot(
        '"8px 8px 8px 12px"',
      )
      expect(
        await page.evaluate(`read('control-ab','padding')`),
      ).toMatchInlineSnapshot('"8px 8px 8px 12px"')
      expect(await page.evaluate(`read('ab','color')`)).toMatchInlineSnapshot(
        '"rgb(128, 0, 128)"',
      )
      expect(
        await page.evaluate(`read('control-ab','color')`),
      ).toMatchInlineSnapshot('"rgb(128, 0, 128)"')
      expect(await page.evaluate(`read('ab','display')`)).toMatchInlineSnapshot(
        '"grid"',
      )
      expect(
        await page.evaluate(`read('control-ab','display')`),
      ).toMatchInlineSnapshot('"grid"')
      expect(await page.evaluate(`read('ab','opacity')`)).toMatchInlineSnapshot(
        '"0.5"',
      )
      expect(
        await page.evaluate(`read('control-ab','opacity')`),
      ).toMatchInlineSnapshot('"0.5"')
      expect(
        await page.evaluate(`read('aba','padding')`),
      ).toMatchInlineSnapshot('"8px"')
      expect(
        await page.evaluate(`read('control-aba','padding')`),
      ).toMatchInlineSnapshot('"8px"')
      expect(await page.evaluate(`read('aba','color')`)).toMatchInlineSnapshot(
        '"rgb(0, 128, 0)"',
      )
      expect(
        await page.evaluate(`read('control-aba','color')`),
      ).toMatchInlineSnapshot('"rgb(0, 128, 0)"')
      expect(
        await page.evaluate(`read('aba','display')`),
      ).toMatchInlineSnapshot('"grid"')
      expect(
        await page.evaluate(`read('control-aba','display')`),
      ).toMatchInlineSnapshot('"grid"')
      expect(
        await page.evaluate(`read('aba','opacity')`),
      ).toMatchInlineSnapshot('"0.5"')
      expect(
        await page.evaluate(`read('control-aba','opacity')`),
      ).toMatchInlineSnapshot('"0.5"')
      expect(
        await page.evaluate(
          "getComputedStyle(document.getElementById('inline')).color",
        ),
      ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
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
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[TypeError: a is not a function]`,
    )

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
    expect(position.source).toMatchInlineSnapshot('"mapped.ts"')
    expect(position.line).toMatchInlineSnapshot('1')
    expect(position.column).toMatchInlineSnapshot(`41`)
  })

  test('rejects unresolved runtime selections before emitting misleading composition', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'app.ts',
        source: `import {css,cx} from 'zyzz';const a=css({color:'red'});export const compose=(enabled:boolean)=>cx(enabled ? a() : undefined);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:98: Composition requires statically known local style applications.]`,
    )
  })
  test('returns extraction spans in source order', () => {
    const source = `import {css,cx} from 'zyzz';const a=css({color:'red'});const props=cx(a());const b=css({padding:'4px'});`
    const extracted = Source.extract({ moduleId: 'order.ts', source })
    expect(extracted.calls.map((call) => source.slice(call.start, call.end)))
      .toMatchInlineSnapshot(`
      [
        "css({color:'red'})",
        "cx(a())",
        "css({padding:'4px'})",
      ]
    `)
  })
})
