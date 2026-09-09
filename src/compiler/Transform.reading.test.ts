/**
 * Verifies reading order through compiled styles and native keyboard navigation.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Reading from '../../test/fixtures/Reading.js'

describe('compile', () => {
  test('reading order preserves numeric and keyword fallbacks', () => {
    const output = Transform.compile({
      moduleId: 'reading.ts',
      source: Reading.source,
    })
    expect(output.css.match(/reading-order:[^;}]+/g)).toMatchInlineSnapshot(`
      [
        "reading-order:0",
        "reading-order:-1!important",
      ]
    `)
    expect(
      output.css.includes(
        'reading-flow:normal;reading-flow:flex-visual!important',
      ),
    ).toMatchInlineSnapshot(`true`)
  })

  test('reading flow and ordinal groups control browser keyboard navigation', async () => {
    const output = Transform.compile({
      moduleId: 'reading.ts',
      source: Reading.source,
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
        `<style>${output.css}</style><button id="start">Start</button><div class="${module.visual.className}"><button id="v1">One</button><button id="v2">Two</button><button id="v3">Three</button></div><div style="display:flex;flex-direction:row-reverse;reading-flow:flex-visual"><button id="c1">One</button><button id="c2">Two</button><button id="c3">Three</button></div><div class="${module.ordered.className}"><button id="o1">One</button><button id="o2">Two</button><button id="o3" class="${module.first.className}">Three</button></div><div style="display:flex;reading-flow:source-order"><button id="r1">One</button><button id="r2">Two</button><button id="r3" style="reading-order:-1">Three</button></div><div style="display:flex;flex-direction:row-reverse;reading-flow:normal"><button id="n1">One</button><button id="n2">Two</button><button id="n3">Three</button></div>`,
      )
      await page.locator('#start').focus()
      const sequence: string[] = []
      for (let index = 0; index < 15; index++) {
        await page.keyboard.press('Tab')
        sequence.push(await page.evaluate(() => document.activeElement!.id))
      }
      expect(sequence).toMatchInlineSnapshot(`
        [
          "v3",
          "v2",
          "v1",
          "c3",
          "c2",
          "c1",
          "o3",
          "o1",
          "o2",
          "r3",
          "r1",
          "r2",
          "n1",
          "n2",
          "n3",
        ]
      `)
      expect(
        await page
          .locator('#o3')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('reading-order'),
          ),
      ).toMatchInlineSnapshot(`"-1"`)
    } finally {
      await browser.close()
    }
  })
})
