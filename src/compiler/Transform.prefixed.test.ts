/**
 * Verifies prefixed property emission, independent grammar, and native alias behavior.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as Prefixed from '../../test/fixtures/Prefixed.js'

describe('compile', () => {
  test('prefixed declarations retain exact names and match independent grammar', () => {
    const lexer = Conformance.lexer()
    const output = Transform.compile({
      moduleId: 'prefixed.ts',
      source: Prefixed.source,
    })

    expect(
      output.css.includes('-ms-scrollbar-3dlight-color:red;'),
    ).toMatchInlineSnapshot(`true`)
    expect(
      output.css.includes('-webkit-mask-composite:source-over, xor;'),
    ).toMatchInlineSnapshot(`true`)
    expect(
      output.css.includes('-webkit-border-before:2px solid red;'),
    ).toMatchInlineSnapshot(`true`)

    for (const declarations of Object.values(Prefixed.styles)) {
      for (const [property, value] of Object.entries(declarations)) {
        expect(
          lexer.matchProperty(Conformance.name(property), String(value)).error,
        ).toMatchInlineSnapshot(`null`)
      }
    }
  })
  test('prefixed aliases match native borders and preserve repeated overrides', async () => {
    const output = Transform.compile({
      moduleId: 'prefixed.ts',
      source:
        Prefixed.source +
        `
export const first = css({WebkitUserSelect:'none'})();
export const second = css({userSelect:'text'})();
export const third = css({WebkitUserSelect:'none',opacity:.5})();`,
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
        `<style>${output.css}</style><div id="borders" class="${module.borders.className}"></div><div id="control" style="${Prefixed.control}"></div><div id="text" class="${module.text.className}"></div><div id="repeat" class="${module.first.className} ${module.second.className} ${module.third.className}"></div>`,
      )

      expect(
        await page.evaluate(() =>
          CSS.supports('-webkit-border-before', '2px solid red'),
        ),
      ).toMatchInlineSnapshot(`true`)

      for (const writingMode of [
        'horizontal-tb',
        'vertical-rl',
        'vertical-lr',
      ]) {
        for (const direction of ['ltr', 'rtl']) {
          await page.locator('#borders, #control').evaluateAll(
            (elements, options) => {
              for (const element of elements) {
                const style = (element as HTMLElement).style

                style.writingMode = options.writingMode
                style.direction = options.direction
              }
            },
            { direction, writingMode },
          )

          for (const property of [
            'border-top',
            'border-right',
            'border-bottom',
            'border-left',
          ]) {
            const actual = await page
              .locator('#borders')
              .evaluate(
                (element, property) =>
                  getComputedStyle(element).getPropertyValue(property),
                property,
              )

            const control = await page
              .locator('#control')
              .evaluate(
                (element, property) =>
                  getComputedStyle(element).getPropertyValue(property),
                property,
              )

            expect(actual === control).toMatchInlineSnapshot(`true`)
          }
        }
      }

      expect(
        await page
          .locator('#text')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue(
              '-webkit-text-fill-color',
            ),
          ),
      ).toMatchInlineSnapshot(`"rgb(10, 20, 30)"`)
      expect(
        await page
          .locator('#text')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue(
              '-webkit-text-stroke-width',
            ),
          ),
      ).toMatchInlineSnapshot(`"2px"`)
      expect(
        await page
          .locator('#text')
          .evaluate((element) => getComputedStyle(element).userSelect),
      ).toMatchInlineSnapshot(`"text"`)
      expect(
        await page
          .locator('#repeat')
          .evaluate((element) => getComputedStyle(element).userSelect),
      ).toMatchInlineSnapshot(`"none"`)
    } finally {
      await browser.close()
    }
  })
})
