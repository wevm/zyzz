/**
 * Checks percentage grammar, dimensional rejection, and browser alpha clamping.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as Percentage from '../../test/fixtures/Percentage.js'

describe('compile', () => {
  test('percentages preserve units and match independent grammar', () => {
    const lexer = Conformance.lexer()

    for (const declarations of Object.values(Percentage.styles)) {
      for (const [property, value] of Object.entries(declarations)) {
        const name = property.replace(
          /[A-Z]/g,
          (letter) => `-${letter.toLowerCase()}`,
        )
        const output = Transform.compile({
          moduleId: 'percentage.ts',
          source: `import { css } from 'zyzz'; css({${property}:${JSON.stringify(value)}});`,
        })

        expect(output.css.includes(`${name}:${value}`)).toMatchInlineSnapshot(
          `true`,
        )
        expect(
          lexer.matchProperty(name, String(value)).error,
        ).toMatchInlineSnapshot(`null`)
      }
    }
  })
  test('alpha values clamp in the browser and preserve important fallbacks', async () => {
    const output = Transform.compile({
      moduleId: 'percentage.ts',
      source: Percentage.source,
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
        `<style>${output.css}</style><svg><rect id="high" class="${module.high.className}"/><rect id="low" class="${module.low.className}"/></svg><div id="text" class="${module.text.className}"></div><div id="text-control" style="font-stretch:120%;font-width:125%;zoom:125%"></div>`,
      )

      expect(
        await page
          .locator('#high')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot(`"1"`)
      expect(
        await page
          .locator('#high')
          .evaluate((element) => getComputedStyle(element).fillOpacity),
      ).toMatchInlineSnapshot(`"1"`)
      expect(
        await page
          .locator('#high')
          .evaluate((element) => getComputedStyle(element).strokeOpacity),
      ).toMatchInlineSnapshot(`"1"`)
      expect(
        await page
          .locator('#low')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot(`"0"`)
      expect(
        await page
          .locator('#low')
          .evaluate((element) => getComputedStyle(element).floodOpacity),
      ).toMatchInlineSnapshot(`"0"`)
      expect(
        await page
          .locator('#low')
          .evaluate((element) => getComputedStyle(element).stopOpacity),
      ).toMatchInlineSnapshot(`"1"`)
      expect(
        await page
          .locator('#text')
          .evaluate((element) => getComputedStyle(element).fontStretch),
      ).toMatchInlineSnapshot(`"120%"`)
      expect(
        await page
          .locator('#text-control')
          .evaluate((element) => getComputedStyle(element).fontStretch),
      ).toMatchInlineSnapshot(`"120%"`)
      expect(
        await page.evaluate(() => CSS.supports('font-width', '125%')),
      ).toMatchInlineSnapshot(`false`)
      expect(
        await page
          .locator('#text')
          .evaluate((element) => getComputedStyle(element).zoom),
      ).toMatchInlineSnapshot(`"1.25"`)
    } finally {
      await browser.close()
    }
  })
})
