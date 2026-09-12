/**
 * Verifies named colors, explicit token references, and native scheme changes.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Colors from '../../test/fixtures/Colors.js'

describe('compile', () => {
  test('named colors preserve token disambiguation, fallbacks, and maps', () => {
    const output = Transform.compile({
      moduleId: 'colors.ts',
      source: Colors.source,
    })

    expect(output.css.includes('color:red;')).toMatchInlineSnapshot(`true`)
    expect(output.css.includes('color_2e_red,blue)')).toMatchInlineSnapshot(
      `true`,
    )
    expect(
      output.css.includes('color:navy;color:rebeccapurple!important'),
    ).toMatchInlineSnapshot(`true`)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('color:rebeccapurple!important'),
    )

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('color:rebeccapurple!important'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 41,
        "line": 5,
        "name": "color",
        "source": "colors.ts",
      }
    `)
  })

  test('named colors and token scheme changes match native browser colors', async () => {
    const output = Transform.compile({
      moduleId: 'colors.ts',
      source: Colors.source,
    })
    const js = await Esbuild.transform(output.code, {
      format: 'esm',
      loader: 'ts',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage({ colorScheme: 'light' })

      await page.setContent(
        `<style>:root{color-scheme:light dark}${output.css}#theme-control{color:coral}@media(prefers-color-scheme:dark){#theme-control{color:gold}}</style><div id="literal" class="${module.literal.className}">Literal</div><div id="theme" class="${module.theme.className}">Theme</div><div id="theme-control">Control</div><div id="fallback" class="${module.fallback.className}">Fallback</div><div id="system" class="${module.system.className}">System</div><div id="system-control" style="color:CanvasText;background-color:Canvas;color-scheme:light dark;forced-color-adjust:none">Control</div>`,
      )

      expect(
        await page
          .locator('#literal')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(255, 0, 0)"`)
      expect(
        await page
          .locator('#literal')
          .evaluate((element) => getComputedStyle(element).backgroundColor),
      ).toMatchInlineSnapshot(`"rgb(0, 0, 255)"`)
      expect(
        await page
          .locator('#fallback')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(102, 51, 153)"`)
      expect(
        await page
          .locator('#theme')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(255, 127, 80)"`)

      const lightSystem = await page
        .locator('#system')
        .evaluate((element) => getComputedStyle(element).color)

      await page.emulateMedia({ colorScheme: 'dark' })

      expect(
        await page
          .locator('#theme')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(255, 215, 0)"`)
      expect(
        await page.evaluate(
          () =>
            getComputedStyle(document.getElementById('theme')!).color ===
            getComputedStyle(document.getElementById('theme-control')!).color,
        ),
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page
          .locator('#system')
          .evaluate(
            (element, light) => getComputedStyle(element).color !== light,
            lightSystem,
          ),
      ).toMatchInlineSnapshot(`true`)

      await page.emulateMedia({ forcedColors: 'active' })

      expect(
        await page.evaluate(() => {
          const a = getComputedStyle(document.getElementById('system')!)
          const b = getComputedStyle(document.getElementById('system-control')!)

          return ['color', 'background-color'].filter(
            (key) => a.getPropertyValue(key) !== b.getPropertyValue(key),
          )
        }),
      ).toMatchInlineSnapshot(`[]`)
    } finally {
      await browser.close()
    }
  })
})
