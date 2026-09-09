/**
 * Verifies mask rendering and conflict-safe scalar background positioning.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Masks from '../../test/fixtures/Masks.js'

describe('compile', () => {
  test('masks preserve fallback sizes, background axis precedence, and maps', () => {
    const output = Transform.compile({
      moduleId: 'masks.ts',
      source: Masks.source,
    })
    expect(output.css.match(/background-position(?:-x)?:[^;}]+/g))
      .toMatchInlineSnapshot(`
      [
        "background-position-x:10px",
        "background-position:right",
        "background-position-x:20px",
      ]
    `)
    expect(output.css.match(/mask-size:[^;}]+/g)).toMatchInlineSnapshot(`
      [
        "mask-size:auto",
        "mask-size:50%!important",
      ]
    `)
    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('mask-size:50%!important'),
    )
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('mask-size:50%!important'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 249,
        "line": 2,
        "name": "maskSize",
        "source": "masks.ts",
      }
    `)
  })

  test('masks match independent browser pixels and background precedence', async () => {
    const output = Transform.compile({
      moduleId: 'masks.ts',
      source: Masks.source,
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
      const page = await browser.newPage()
      await page.setContent(
        `<style>.box{width:80px;height:80px;padding:8px;border:8px solid #06c;background:#06c;mask-image:linear-gradient(black,black)}${output.css}</style><div id="actual" class="box ${module.mask.className}"></div><div id="control" class="box" style="${Masks.control}"></div><div id="unmasked" class="box" style="mask-image:none"></div>`,
      )
      expect(
        await page.evaluate(() => {
          const a = getComputedStyle(document.getElementById('actual')!)
          const b = getComputedStyle(document.getElementById('control')!)
          return [
            'background-position',
            'image-rendering',
            'mask-clip',
            'mask-composite',
            'mask-mode',
            'mask-origin',
            'mask-position',
            'mask-repeat',
            'mask-size',
            'mask-type',
            'object-position',
            'perspective',
            'perspective-origin',
            'shape-margin',
            'transform-box',
            'transform-origin',
          ].filter((key) => a.getPropertyValue(key) !== b.getPropertyValue(key))
        }),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).backgroundPosition),
      ).toMatchInlineSnapshot(`"100% 50%"`)
      const actual = await page.locator('#actual').screenshot()
      const control = await page.locator('#control').screenshot()
      const unmasked = await page.locator('#unmasked').screenshot()
      expect(actual.equals(control)).toMatchInlineSnapshot(`true`)
      expect(actual.equals(unmasked)).toMatchInlineSnapshot(`false`)
    } finally {
      await browser.close()
    }
  })
})
