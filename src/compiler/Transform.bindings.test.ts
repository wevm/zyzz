/** Exercises explicit variable declarations through compilation and runtime assignments. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const source = [
  'import { css, Vars } from "zyzz";',
  'const progress = Vars.define({ amount: "percentage", count: "number", gap: "length" });',
  'export const bar = css({width:progress.amount, marginLeft:`calc(${progress.gap} + 2px)`})();',
  'export const assignments = Vars.set(progress,{amount:"50%",count:2,gap:"8px"});',
  'export const update = () => Vars.set(progress,{amount:"75%"});',
  'export const assign = (values: any) => Vars.set(progress,values);',
].join('\n')

describe('compile', () => {
  test('keeps contracts distinct with shadowed globals and assertion types', async () => {
    const output = Transform.compile({
      moduleId: 'hygiene.ts',
      source: `
      import { Vars } from 'zyzz';
      const Object = {}; const __zyzzFreeze = 0;
      const ab = Vars.define({ c: 'length' });
      const a = Vars.define({ bc: 'length' });
      export const first = ab as Vars.Definition<{ c: 'length' }>;
      export const second = a satisfies Vars.Definition<{ bc: 'length' }>;
    `,
    })
    const built = await Esbuild.build({
      stdin: {
        contents: output.code,
        resolveDir: Path.resolve(import.meta.dirname, '../..'),
        loader: 'ts',
      },
      bundle: true,
      write: false,
      platform: 'node',
      conditions: ['src'],
      format: 'esm',
    })
    const result = await import(
      `data:text/javascript;base64,${Buffer.from(built.outputFiles[0]!.text).toString('base64')}`
    )
    expect(result.first.c.name === result.second.bc.name).toMatchInlineSnapshot(
      `false`,
    )
    expect(
      Object.isFrozen(result.first) && Object.isFrozen(result.first.c),
    ).toMatchInlineSnapshot(`true`)
  })

  test('preserves asserted reads and compatible border length templates', () => {
    expect(
      Transform.compile({
        moduleId: 'border.ts',
        source:
          'import { css, Vars } from "zyzz"; const border=Vars.define({size:"length"}); css({borderWidth:`calc(${border.size})`,width:(border.size satisfies unknown)})',
      }).css,
    ).toMatchInlineSnapshot(
      `".z-1h19mkqtvuh7e-base0{border-width:calc(var(--z-v1h19mkqtvuh7e-62-6f-72-64-65-72--73-69-7a-65));width:var(--z-v1h19mkqtvuh7e-62-6f-72-64-65-72--73-69-7a-65);}"`,
    )
  })
  test('rejects incompatible direct binding domains', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source:
          'import {css,Vars} from "zyzz"; const vars=Vars.define({color:"color"}); css({width:vars.color})',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:83: Variable domain is incompatible with this property.]`,
    )
  })

  test('emits fixed slots and executes typed assignments without generating rules', async () => {
    const output = Transform.compile({ moduleId: 'slots.ts', source })
    expect(output.css).toMatchInlineSnapshot(
      `".z-161esph179x895-base0{width:var(--z-v161esph179x895-70-72-6f-67-72-65-73-73--61-6d-6f-75-6e-74);margin-left:calc(var(--z-v161esph179x895-70-72-6f-67-72-65-73-73--67-61-70) + 2px);}"`,
    )
    const built = await Esbuild.build({
      stdin: {
        contents: output.code,
        resolveDir: Path.resolve(import.meta.dirname, '../..'),
        loader: 'ts',
      },
      bundle: true,
      write: false,
      platform: 'node',
      conditions: ['src'],
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(built.outputFiles[0]!.text).toString('base64')}`
    )
    expect(module.assignments).toMatchInlineSnapshot(`
      {
        "--z-v161esph179x895-70-72-6f-67-72-65-73-73--61-6d-6f-75-6e-74": "50%",
        "--z-v161esph179x895-70-72-6f-67-72-65-73-73--63-6f-75-6e-74": 2,
        "--z-v161esph179x895-70-72-6f-67-72-65-73-73--67-61-70": "8px",
      }
    `)
    expect(module.update()).toMatchInlineSnapshot(`
      {
        "--z-v161esph179x895-70-72-6f-67-72-65-73-73--61-6d-6f-75-6e-74": "75%",
      }
    `)
    expect(() =>
      module.assign({ [Symbol('unknown')]: 1 }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: Unknown variable or accessor assignment.]`,
    )
    expect(() =>
      module.assign(Object.defineProperty({}, 'hidden', { value: 1 })),
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: Unknown variable or accessor assignment.]`,
    )
    expect(output.code.includes('Vars.define')).toMatchInlineSnapshot(`false`)
  })

  test('updates native widths through fixed variable slots', async () => {
    const output = Transform.compile({ moduleId: 'slots.ts', source })
    const built = await Esbuild.build({
      stdin: {
        contents: output.code,
        resolveDir: Path.resolve(import.meta.dirname, '../..'),
        loader: 'ts',
      },
      bundle: true,
      write: false,
      platform: 'node',
      conditions: ['src'],
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(built.outputFiles[0]!.text).toString('base64')}`
    )
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><div style="width:200px"><div id="bar" class="${module.bar.className}"></div></div>`,
      )
      await page.locator('#bar').evaluate((element, values) => {
        for (const [key, value] of Object.entries(values))
          (element as HTMLElement).style.setProperty(key, String(value))
      }, module.assignments)
      expect(
        await page
          .locator('#bar')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"100px"`)
      await page.locator('#bar').evaluate((element, values) => {
        for (const [key, value] of Object.entries(values))
          (element as HTMLElement).style.setProperty(key, String(value))
      }, module.update())
      expect(
        await page
          .locator('#bar')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"150px"`)
    } finally {
      await browser.close()
    }
  })

  test('keeps matching schemas in different definitions isolated', () => {
    expect(
      Transform.compile({
        moduleId: 'isolated.ts',
        source:
          'import { Vars, css } from "zyzz"; const a = Vars.define({x:"number"}); const b = Vars.define({x:"number"}); css({opacity:a.x})(); css({opacity:b.x})()',
      }).css,
    ).toMatchInlineSnapshot(`
      ".z-style-b2d2s91jn7xin-108{opacity:var(--z-vb2d2s91jn7xin-61--78);}
      .z-style-b2d2s91jn7xin-130{opacity:var(--z-vb2d2s91jn7xin-62--78);}"
    `)
  })

  test('rejects unknown schema domains without evaluating calls', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source:
          'import { Vars } from "zyzz"; const a = Vars.define({x: arbitrary()});',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:52: Variable schemas require unique names and supported scalar domains.]`,
    )
  })
})
