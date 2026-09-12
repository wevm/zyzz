/**
 * Verifies scalar property expansion and interacting declaration families.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Transform } from 'zyzz/compiler'
import { Css } from 'zyzz/web'
import * as Scalars from '../../test/fixtures/Scalars.js'

describe('compile', () => {
  test('related scalar declarations retain A/B/A cascade order', () => {
    const a = {
      fontSynthesis: 'none',
      whiteSpace: 'normal',
      overflow: 'hidden',
      wordWrap: 'normal',
    } as const

    const output = Css.compile({
      styles: Style.define({
        a,
        b: {
          fontSynthesisWeight: 'auto',
          whiteSpaceCollapse: 'preserve',
          textWrapMode: 'nowrap',
          overflowBlock: 'scroll',
          overflowWrap: 'break-word',
        },
        c: a,
      }),
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-a{font-synthesis:none;white-space:normal;overflow:hidden;word-wrap:normal;}
      .z-b{font-synthesis-weight:auto;white-space-collapse:preserve;text-wrap-mode:nowrap;overflow-block:scroll;overflow-wrap:break-word;}
      .z-c{font-synthesis:none;white-space:normal;overflow:hidden;word-wrap:normal;}"
    `)
  })
  test('SVG geometry and text scalars match native browser output', async () => {
    const output = Transform.compile({
      moduleId: 'scalars.ts',
      source: Scalars.source,
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
        `<style>${output.css}</style><svg width="200" height="100"><circle id="circle" class="${module.circle.className}"/><circle id="circle-control" style="${Scalars.controls.circle}"/><rect id="rectangle" width="50" height="30" class="${module.rectangle.className}"/><rect id="rectangle-control" width="50" height="30" style="${Scalars.controls.rectangle}"/></svg><div id="text" class="${module.text.className}">a  b</div><div id="text-control" style="${Scalars.controls.text}">a  b</div>`,
      )

      expect(
        await page.evaluate(() => {
          const differences: string[] = []

          for (const [id, properties] of [
            ['circle', ['cx', 'cy', 'r']],
            ['rectangle', ['x', 'y', 'rx', 'ry']],
            [
              'text',
              [
                'baseline-shift',
                'text-anchor',
                'font-variant-emoji',
                'white-space-collapse',
                'text-wrap-mode',
                'word-wrap',
                'scrollbar-gutter',
              ],
            ],
          ] as const) {
            const a = getComputedStyle(document.getElementById(id)!)
            const b = getComputedStyle(
              document.getElementById(`${id}-control`)!,
            )

            for (const property of properties)
              if (a.getPropertyValue(property) !== b.getPropertyValue(property))
                differences.push(property)
          }

          return differences
        }),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page.locator('#circle').evaluate((element) => {
          const box = (element as SVGGraphicsElement).getBBox()

          return [box.x, box.y, box.width, box.height]
        }),
      ).toMatchInlineSnapshot(`
        [
          20,
          10,
          40,
          40,
        ]
      `)
    } finally {
      await browser.close()
    }
  })
})
