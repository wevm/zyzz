/**
 * Checks combined line values and their shorthand cascade in real browser layouts.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Transform } from 'zyzz/compiler'
import { Css } from 'zyzz/web'
import * as BorderShorthand from '../../test/fixtures/BorderShorthand.js'

describe('compile', () => {
  test('line shorthands retain A/B/A longhand conflicts', () => {
    const a = {
      border: '2px solid red',
      outline: '1px dotted black',
      columnRule: '3px dashed blue',
    } as const

    const output = Css.compile({
      styles: Style.define({
        a,
        b: {
          borderTopColor: 'green',
          outlineWidth: '5px',
          columnRuleStyle: 'solid',
        },
        c: a,
      }),
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-a{border:2px solid red;outline:1px dotted black;column-rule:3px dashed blue;}
      .z-b{border-top-color:green;outline-width:5px;column-rule-style:solid;}
      .z-c{border:2px solid red;outline:1px dotted black;column-rule:3px dashed blue;}"
    `)
  })
  test('combined borders match native declarations across writing modes', async () => {
    const output = Transform.compile({
      moduleId: 'border-shorthand.ts',
      source: BorderShorthand.source,
    })
    const js = await Esbuild.transform(output.code, {
      format: 'esm',
      loader: 'ts',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )

    const a = {
      border: '2px solid red',
      outline: '1px dotted black',
      columnRule: '3px dashed blue',
    } as const

    const cascade = Css.compile({
      styles: Style.define({
        a,
        b: {
          borderTopColor: 'green',
          outlineWidth: '5px',
          columnRuleStyle: 'solid',
        },
        c: a,
      }),
    })

    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>.z-a{border-image-source:linear-gradient(red,blue)}${output.css}${cascade.css}</style><div id="parent"><div id="actual" class="${module.box.className}"></div><div id="control" style="${BorderShorthand.control}"></div></div><div id="cascade" class="z-a z-b z-c"></div>`,
      )

      for (const writingMode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'])
        for (const direction of ['ltr', 'rtl']) {
          await page.locator('#parent').evaluate(
            (element, values) => {
              element.style.writingMode = values.writingMode
              element.style.direction = values.direction
            },
            { writingMode, direction },
          )

          expect(
            await page.evaluate(() => {
              const a = getComputedStyle(document.getElementById('actual')!)
              const b = getComputedStyle(document.getElementById('control')!)

              return [
                'border-top-width',
                'border-top-style',
                'border-top-color',
                'border-right-width',
                'border-right-style',
                'border-right-color',
                'border-bottom-width',
                'border-bottom-style',
                'border-bottom-color',
                'border-left-width',
                'border-left-style',
                'border-left-color',
                'outline-width',
                'outline-style',
                'outline-color',
                'column-rule-width',
                'column-rule-style',
                'column-rule-color',
              ].filter(
                (property) =>
                  a.getPropertyValue(property) !== b.getPropertyValue(property),
              )
            }),
          ).toMatchInlineSnapshot(`[]`)
        }

      expect(
        await page
          .locator('#cascade')
          .evaluate((element) => getComputedStyle(element).borderImageSource),
      ).toMatchInlineSnapshot(`"none"`)
      expect(
        await page
          .locator('#cascade')
          .evaluate((element) => getComputedStyle(element).borderTopColor),
      ).toMatchInlineSnapshot(`"rgb(255, 0, 0)"`)
      expect(
        await page
          .locator('#cascade')
          .evaluate((element) => getComputedStyle(element).outlineWidth),
      ).toMatchInlineSnapshot(`"1px"`)
      expect(
        await page
          .locator('#cascade')
          .evaluate((element) => getComputedStyle(element).columnRuleStyle),
      ).toMatchInlineSnapshot(`"dashed"`)
    } finally {
      await browser.close()
    }
  })
})
