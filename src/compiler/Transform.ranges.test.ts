/**
 * Verifies range endpoint emission and native scroll-driven animation progress.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as Ranges from '../../test/fixtures/Ranges.js'

describe('compile', () => {
  test('timeline ranges preserve names, offsets, and list boundaries', () => {
    const lexer = Conformance.lexer()
    for (const [property, value] of Object.entries(Ranges.styles)) {
      const name = Conformance.name(property)
      const output = Transform.compile({
        moduleId: 'ranges.ts',
        source: `import { css } from 'zyzz'; css({${property}:${JSON.stringify(value)}});`,
      })
      expect(output.css.includes(`${name}:${value}`)).toMatchInlineSnapshot(
        `true`,
      )
      expect(lexer.matchProperty(name, value).error).toMatchInlineSnapshot(
        `null`,
      )
    }
  })
  test('timeline ranges match native view-animation progress', async () => {
    const output = Transform.compile({
      moduleId: 'ranges.ts',
      source: Ranges.source,
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
        `<style>@keyframes fade{from{opacity:0}to{opacity:1}}.scroller{width:100px;height:100px;overflow:auto}.spacer{height:100px}.subject{height:100px;background:blue;animation:fade 1s linear both;animation-timeline:view()}${output.css}</style><div class="scroller"><div class="spacer"></div><div id="actual" class="subject ${module.range.className}"></div><div class="spacer"></div></div><div class="scroller"><div class="spacer"></div><div id="control" class="subject" style="animation-range-start:entry 20%;animation-range-end:exit 80%"></div><div class="spacer"></div></div>`,
      )
      await page.evaluate(async () => {
        for (const element of document.querySelectorAll('.scroller'))
          element.scrollTop = 80
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        )
      })
      const actual = await page
        .locator('#actual')
        .evaluate((element) => Number(getComputedStyle(element).opacity))
      const control = await page
        .locator('#control')
        .evaluate((element) => Number(getComputedStyle(element).opacity))
      expect(actual === control).toMatchInlineSnapshot(`true`)
      expect(actual > 0 && actual < 1).toMatchInlineSnapshot(`true`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('animation-range-start'),
          ),
      ).toMatchInlineSnapshot(`"entry 20%"`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('animation-range-end'),
          ),
      ).toMatchInlineSnapshot(`"exit 80%"`)
    } finally {
      await browser.close()
    }
  })
})
