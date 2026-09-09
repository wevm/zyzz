/**
 * Verifies font controls through compilation, maps, and native text layout.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Fonts from '../../test/fixtures/Fonts.js'

describe('compile', () => {
  test('font controls preserve numeric variants, emphasis tokens, and maps', () => {
    const output = Transform.compile({
      moduleId: 'fonts.ts',
      source: Fonts.source,
    })
    expect(output.css.match(/font-variant-numeric:[^;}]+/g))
      .toMatchInlineSnapshot(`
      [
        "font-variant-numeric:normal",
        "font-variant-numeric:tabular-nums!important",
      ]
    `)
    expect(output.css.includes('color_2e_accent,#06c)')).toMatchInlineSnapshot(
      `true`,
    )
    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('font-variant-numeric:tabular-nums!important'),
    )
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf(
          'font-variant-numeric:tabular-nums!important',
        ),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 315,
        "line": 3,
        "name": "fontVariantNumeric",
        "source": "fonts.ts",
      }
    `)
  })

  test('font controls match independent CSS and native ruby placement', async () => {
    const output = Transform.compile({
      moduleId: 'fonts.ts',
      source: Fonts.source,
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
        `<style>body{font:20px monospace}ruby{margin:20px}span{display:inline-block}${output.css}</style><p id="font" class="${module.font.className}">Font 123</p><p id="font-control" style="${Fonts.controls.font}">Font 123</p><ruby id="ruby" class="${module.ruby.className}"><span>base</span><rt>annotation</rt></ruby><ruby id="ruby-control" style="${Fonts.controls.ruby}"><span>base</span><rt>annotation</rt></ruby><span id="vertical" class="${module.vertical.className}">AB</span><span id="vertical-control" style="${Fonts.controls.vertical}">AB</span>`,
      )
      expect(
        await page.evaluate(() => {
          const properties = {
            font: [
              'font-kerning',
              'font-optical-sizing',
              'font-stretch',
              'font-synthesis-small-caps',
              'font-synthesis-style',
              'font-synthesis-weight',
              'font-variant-caps',
              'font-variant-east-asian',
              'font-variant-ligatures',
              'font-variant-numeric',
              'font-variant-position',
              'text-emphasis-color',
              'text-emphasis-style',
              'text-emphasis-position',
              'text-justify',
            ],
            ruby: ['ruby-align', 'ruby-position'],
            vertical: [
              'writing-mode',
              'text-orientation',
              'text-combine-upright',
            ],
          }
          return Object.entries(properties).flatMap(([name, keys]) => {
            const a = getComputedStyle(document.getElementById(name)!)
            const b = getComputedStyle(
              document.getElementById(`${name}-control`)!,
            )
            return keys.filter(
              (key) => a.getPropertyValue(key) !== b.getPropertyValue(key),
            )
          })
        }),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page.locator('#ruby').evaluate((element) => {
          const base = element.querySelector('span')!.getBoundingClientRect()
          const annotation = element
            .querySelector('rt')!
            .getBoundingClientRect()
          return (
            annotation.top + annotation.height / 2 > base.top + base.height / 2
          )
        }),
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page.locator('#vertical').evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          return bounds.height > bounds.width
        }),
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page
          .locator('#font')
          .evaluate((element) => getComputedStyle(element).textEmphasisColor),
      ).toMatchInlineSnapshot(`"rgb(0, 102, 204)"`)
    } finally {
      await browser.close()
    }
  })
})
