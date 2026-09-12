/**
 * Verifies box-list grammar and physical/logical cascade behavior in native layout.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as BoxLists from '../../test/fixtures/BoxLists.js'

describe('compile', () => {
  test('box lists preserve fallback ordering and importance', () => {
    const output = Transform.compile({
      moduleId: 'box-lists.ts',
      source: BoxLists.source,
    })

    expect(output.css.match(/padding:[^;}]+/g)).toMatchInlineSnapshot(`
      [
        "padding:1px 2px",
        "padding:4px 8px 12px 16px!important",
      ]
    `)
    expect(
      output.css.includes('margin-inline:20px 30px'),
    ).toMatchInlineSnapshot(`true`)
  })

  test('box list expansion and logical overrides match browser longhands', async () => {
    const output = Transform.compile({
      moduleId: 'box-lists.ts',
      source: BoxLists.source,
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
        `<style>${output.css}.box{width:100px;height:100px;position:relative}</style><div id="actual" class="box ${module.box.className}"></div><div id="control" class="box" style="${BoxLists.control}"></div>`,
      )

      for (const mode of ['horizontal-tb', 'vertical-rl']) {
        await page.evaluate((mode) => {
          for (const id of ['actual', 'control'])
            document.getElementById(id)!.style.writingMode = mode
        }, mode)

        expect(
          await page.evaluate(() => {
            const actual = getComputedStyle(document.getElementById('actual')!)
            const control = getComputedStyle(
              document.getElementById('control')!,
            )

            const keys = [
              'top',
              'right',
              'bottom',
              'left',
              ...['top', 'right', 'bottom', 'left'].flatMap((side) => [
                `margin-${side}`,
                `padding-${side}`,
                `border-${side}-width`,
                `scroll-margin-${side}`,
                `scroll-padding-${side}`,
              ]),
            ]

            return keys.filter(
              (key) =>
                actual.getPropertyValue(key) !== control.getPropertyValue(key),
            )
          }),
        ).toMatchInlineSnapshot(`[]`)
      }

      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).paddingLeft),
      ).toMatchInlineSnapshot(`"16px"`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).marginTop),
      ).toMatchInlineSnapshot(`"20px"`)
    } finally {
      await browser.close()
    }
  })
})
