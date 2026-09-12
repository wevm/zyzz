/**
 * Verifies geometric grammar and actual transformed bounds against native CSS.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as Geometry from '../../test/fixtures/Geometry.js'

describe('compile', () => {
  test('all canonical transform functions match independent grammar', () => {
    const lexer = Conformance.lexer()

    for (const transform of Geometry.functions) {
      const output = Transform.compile({
        moduleId: 'geometry.ts',
        source: `import { css } from 'zyzz'; css({transform:${JSON.stringify(transform)}});`,
      })

      expect(
        output.css.includes(`transform:${transform}`),
      ).toMatchInlineSnapshot(`true`)
      expect(
        lexer.matchProperty('transform', transform).error,
      ).toMatchInlineSnapshot(`null`)
    }
  })
  test('ratios and ordered transforms match native rendered bounds', async () => {
    const output = Transform.compile({
      moduleId: 'geometry.ts',
      source: Geometry.source,
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
        `<style>${output.css}.positioned{position:absolute;left:100px;top:100px;transform-origin:0 0}</style><div id="aspect" class="${module.aspect.className}"></div><div id="individual" class="positioned ${module.individual.className}"></div><div id="list" class="positioned ${module.list.className}"></div><div id="control" class="positioned" style="${Geometry.controls.list}"></div><div id="spatial" class="${module.spatial.className}"></div><div id="spatial-control" style="${Geometry.controls.spatial}"></div>`,
      )

      expect(
        await page
          .locator('#aspect')
          .evaluate((element) => element.getBoundingClientRect().height),
      ).toMatchInlineSnapshot(`90`)
      expect(
        await page
          .locator('#individual')
          .evaluate((element) => element.getBoundingClientRect().toJSON()),
      ).toMatchInlineSnapshot(`
        {
          "bottom": 220,
          "height": 80,
          "left": 70,
          "right": 130,
          "top": 140,
          "width": 60,
          "x": 70,
          "y": 140,
        }
      `)
      expect(
        await page.evaluate(() => {
          const control = JSON.stringify(
            document
              .getElementById('control')!
              .getBoundingClientRect()
              .toJSON(),
          )

          return ['individual', 'list'].filter(
            (id) =>
              JSON.stringify(
                document.getElementById(id)!.getBoundingClientRect().toJSON(),
              ) !== control,
          )
        }),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page.evaluate(
          () =>
            getComputedStyle(document.getElementById('spatial')!).transform ===
            getComputedStyle(document.getElementById('spatial-control')!)
              .transform,
        ),
      ).toMatchInlineSnapshot(`true`)
    } finally {
      await browser.close()
    }
  })
})
