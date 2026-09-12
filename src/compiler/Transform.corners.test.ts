/**
 * Checks corner curvature grammar, clipped hit testing, and cascade-wide reset ordering.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as Corners from '../../test/fixtures/Corners.js'

describe('compile', () => {
  test('corner and layout values match independent grammar', () => {
    const lexer = Conformance.lexer()

    for (const declarations of Object.values(Corners.styles)) {
      for (const [property, value] of Object.entries(declarations)) {
        const output = Transform.compile({
          moduleId: 'corners.ts',
          source: `import { css } from 'zyzz'; css({${property}:${JSON.stringify(value)}});`,
        })
        const name = Conformance.name(property)

        expect(output.css.includes(`${name}:${value}`)).toMatchInlineSnapshot(
          `true`,
        )
        expect(
          lexer.matchProperty(name, String(value)).error,
        ).toMatchInlineSnapshot(`null`)
      }
    }
  })
  test('bevel clipping matches a native polygon and all preserves authored overrides', async () => {
    const output = Transform.compile({
      moduleId: 'corners.ts',
      source: Corners.source,
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
        `<style>${output.css}</style><div id="bevel" class="${module.bevel.className}" style="position:absolute;left:0;top:0"></div><div id="control" style="position:absolute;left:150px;top:0;width:100px;height:100px;background:blue;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)"></div><div id="reset" class="${module.first.className} ${module.reset.className} ${module.last.className}"></div><div id="grid" class="${module.grid.className}"></div>`,
      )

      expect(
        await page.evaluate(() => CSS.supports('corner-shape', 'bevel')),
      ).toMatchInlineSnapshot(`true`)

      for (const point of [
        { x: 20, y: 20, inside: false },
        { x: 30, y: 30, inside: true },
        { x: 50, y: 50, inside: true },
      ]) {
        expect(
          await page.evaluate(
            ({ x, y, inside }) =>
              (document.elementFromPoint(x, y)?.id === 'bevel') === inside,
            point,
          ),
        ).toMatchInlineSnapshot(`true`)
        expect(
          await page.evaluate(
            ({ x, y, inside }) =>
              (document.elementFromPoint(x + 150, y)?.id === 'control') ===
              inside,
            point,
          ),
        ).toMatchInlineSnapshot(`true`)
      }

      expect(
        await page
          .locator('#reset')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(255, 0, 0)"`)
      expect(
        await page
          .locator('#reset')
          .evaluate((element) => getComputedStyle(element).fontWeight),
      ).toMatchInlineSnapshot(`"700"`)
      expect(
        await page
          .locator('#grid')
          .evaluate((element) => getComputedStyle(element).rowGap),
      ).toMatchInlineSnapshot(`"10px"`)
      expect(
        await page
          .locator('#grid')
          .evaluate((element) => getComputedStyle(element).columnGap),
      ).toMatchInlineSnapshot(`"12px"`)
    } finally {
      await browser.close()
    }
  })
})
