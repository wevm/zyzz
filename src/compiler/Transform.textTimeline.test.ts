/**
 * Checks text and timeline declaration grammar, cascade, and native output.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Transform } from 'zyzz/compiler'
import { Css } from 'zyzz/web'
import * as TextTimeline from '../../test/fixtures/TextTimeline.js'

describe('compile', () => {
  test('text and flex shorthands preserve A/B/A overrides and page aliases', () => {
    const a = {
      flexFlow: 'row nowrap',
      textWrap: 'wrap balance',
      pageBreakBefore: 'avoid',
    } as const

    const output = Css.compile({
      styles: Style.define({
        a,
        b: {
          flexDirection: 'column',
          textWrapStyle: 'pretty',
          breakBefore: 'page',
        },
        c: a,
      }),
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-a{flex-flow:row nowrap;text-wrap:wrap balance;page-break-before:avoid;}
      .z-b{flex-direction:column;text-wrap-style:pretty;break-before:page;}
      .z-c{flex-flow:row nowrap;text-wrap:wrap balance;page-break-before:avoid;}"
    `)
  })
  test('text and flex values match native browser controls', async () => {
    const output = Transform.compile({
      moduleId: 'text-timeline.ts',
      source: TextTimeline.source,
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

      const a = {
        flexFlow: 'row nowrap',
        textWrap: 'wrap balance',
        pageBreakBefore: 'avoid',
      } as const

      const cascade = Css.compile({
        styles: Style.define({
          a,
          b: {
            flexDirection: 'column',
            textWrapStyle: 'pretty',
            breakBefore: 'page',
          },
          c: a,
        }),
      })

      await page.setContent(
        `<style>${output.css}${cascade.css}</style><div id="cascade" class="z-a z-b z-c"></div><div id="flow" class="${module.flow.className}"><span>one</span><span>two</span></div><div id="flow-control" style="${TextTimeline.controls.flow}"><span>one</span><span>two</span></div><span id="text" class="${module.text.className}">text</span><span id="text-control" style="${TextTimeline.controls.text}">text</span>`,
      )

      expect(
        await page.evaluate(() => {
          const differences: string[] = []

          for (const [id, properties] of [
            [
              'flow',
              [
                'flex-direction',
                'flex-wrap',
                'text-wrap-mode',
                'text-wrap-style',
              ],
            ],
            [
              'text',
              [
                'text-underline-position',
                'vertical-align',
                'border-image-repeat',
                'view-timeline-axis',
                'interest-delay-start',
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
        await page
          .locator('#cascade')
          .evaluate((element) => getComputedStyle(element).flexDirection),
      ).toMatchInlineSnapshot(`"row"`)
      expect(
        await page
          .locator('#cascade')
          .evaluate((element) => getComputedStyle(element).textWrapStyle),
      ).toMatchInlineSnapshot(`"balance"`)
      expect(
        await page
          .locator('#cascade')
          .evaluate((element) => getComputedStyle(element).breakBefore),
      ).toMatchInlineSnapshot(`"avoid"`)
      expect(
        await page
          .locator('#flow')
          .evaluate((element) => getComputedStyle(element).flexDirection),
      ).toMatchInlineSnapshot(`"row"`)
      expect(
        await page
          .locator('#flow')
          .evaluate((element) => getComputedStyle(element).flexWrap),
      ).toMatchInlineSnapshot(`"wrap"`)
    } finally {
      await browser.close()
    }
  })
})
