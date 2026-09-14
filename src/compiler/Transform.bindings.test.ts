/** Exercises explicit variable declarations through compilation and runtime assignments. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const source = [
  `import {css, variable} from 'zyzz';`,
  `const vars = ({amount:variable("percentage"),count:variable("number"),gap:variable("length")});`,
  'export const bar = css({width:vars.amount, marginLeft:`calc(${vars.gap} + 2px)`})();',
  `export const assignments = ({...vars["amount"].set("50%"),...vars["count"].set(2),...vars["gap"].set("8px")});`,
  `export const update = () => ({...vars["amount"].set("75%")});`,
  'export const assign = (values: any) => vars.amount.set(values.amount);',
].join('\n')

describe('compile', () => {
  test('identifies explicit variables in template diagnostics', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'bad-template.ts',
        source: `import {css, variable} from 'zyzz'; const vars=({size:variable("length")}); css({color:\`calc(\${vars.size})\`})`,
      }),
    ).toThrow('Variable domain is incompatible with this property.')
  })
  test('keeps contracts distinct with shadowed globals and assertion types', async () => {
    const output = Transform.compile({
      moduleId: 'hygiene.ts',
      source: `
      import {variable} from 'zyzz';
      const Object = {}; const __zyzzVariable = 0;
      const ab = ({c:variable('length')});
      const a = ({bc:variable('length')});
      export const first = ab as { c: variable.Reference<'length'> };
      export const second = a satisfies { bc: variable.Reference<'length'> };
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
    ).toMatchInlineSnapshot(`false`)
  })

  test('preserves asserted reads and compatible border length templates', () => {
    expect(
      Transform.compile({
        moduleId: 'border.ts',
        source: `import {css, variable} from 'zyzz'; const border=({size:variable("length")}); css({borderWidth:\`calc(\${border.size})\`,width:(border.size satisfies unknown)})`,
      }).css,
    ).toMatchInlineSnapshot(
      `
      ".z-border-width-iturna{border-width:calc(var(--z-v1h19mkqtvuh7e-56));}
      .z-w-vT1mKV{width:var(--z-v1h19mkqtvuh7e-56);}"
    `,
    )
  })
  test('rejects incompatible direct binding domains', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {css, variable} from 'zyzz'; const vars=({color:variable("color")}); css({width:vars.color})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:87: Variable domain is incompatible with this property.]`,
    )
  })

  test('emits fixed slots and executes typed assignments without generating rules', async () => {
    const output = Transform.compile({ moduleId: 'slots.ts', source })

    expect(output.css).toMatchInlineSnapshot(
      `
      ".z-w-zlK4zG{width:var(--z-v161esph179x895-58);}
      .z-ml-EEVgLL{margin-left:calc(var(--z-v161esph179x895-110) + 2px);}"
    `,
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
        "--z-v161esph179x895-110": "8px",
        "--z-v161esph179x895-58": "50%",
        "--z-v161esph179x895-87": 2,
      }
    `)
    expect(module.update()).toMatchInlineSnapshot(`
      {
        "--z-v161esph179x895-58": "75%",
      }
    `)
    expect(Object.values(module.assign({ amount: '60%' }))).toEqual(['60%'])
    expect(output.code.includes('variable(')).toMatchInlineSnapshot(`false`)
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
        source: `import {variable, css} from 'zyzz'; const a = ({x:variable("number")}); const b = ({x:variable("number")}); css({opacity:a.x})(); css({opacity:b.x})()`,
      }).css,
    ).toMatchInlineSnapshot(`
      ".z-opacity-nGeW2o-0{opacity:var(--z-vb2d2s91jn7xin-50);}
      .z-opacity-6TwmkZ-0{opacity:var(--z-vb2d2s91jn7xin-86);}"
    `)
  })

  test('rejects unknown schema domains without evaluating calls', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {variable} from 'zyzz'; const a = ({x:variable(arbitrary())});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:45: variable requires a scalar domain and optional literal registration options.]`,
    )
  })
})
