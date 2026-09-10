/**
 * Verifies compound scalar grammar, reset ordering, and native border-image painting.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as Tuples from '../../test/fixtures/Tuples.js'

describe('compile', () => {
  test('scalar tuples preserve units, markers, and shorthand overrides', () => {
    const lexer = Conformance.lexer()
    for (const declarations of Object.values(Tuples.styles)) {
      for (const [property, value] of Object.entries(declarations)) {
        const name = Conformance.name(property)
        const output = Transform.compile({
          moduleId: 'tuples.ts',
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
    const output = Transform.compile({
      moduleId: 'tuples.ts',
      source: Tuples.source,
    })
    expect(
      output.css.match(/contain-intrinsic-size:80px 40px;/g)?.length,
    ).toMatchInlineSnapshot(`2`)
    expect(
      output.css.match(/interest-delay:100ms 200ms;/g)?.length,
    ).toMatchInlineSnapshot(`2`)
  })
  test('border-image tuples match native painting and scrollbar colors', async () => {
    const output = Transform.compile({
      moduleId: 'tuples.ts',
      source: Tuples.source,
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
        `<style>.frame{display:inline-block;vertical-align:top;width:160px;height:160px;background:white}.box{width:60px;height:60px;margin:30px;border:10px solid transparent;border-image-source:linear-gradient(90deg,red,blue)}${output.css}</style><div id="actual" class="frame"><div class="box ${module.border.className}"></div></div><div id="control" class="frame"><div class="box" style="${Tuples.control}"></div></div><div id="intrinsic" class="${module.intrinsic.className}"></div><div id="intrinsic-control" style="contain:size;contain-intrinsic-size:auto 80px auto 40px;display:inline-block"></div><div id="text" class="${module.text.className}"></div>`,
      )
      const size = await page
        .locator('#intrinsic')
        .evaluate((element) => [
          element.getBoundingClientRect().width,
          element.getBoundingClientRect().height,
        ])
      expect(size).toMatchInlineSnapshot(`
        [
          80,
          40,
        ]
      `)
      expect(
        await page
          .locator('#intrinsic-control')
          .evaluate((element) => [
            element.getBoundingClientRect().width,
            element.getBoundingClientRect().height,
          ]),
      ).toMatchInlineSnapshot(`
        [
          80,
          40,
        ]
      `)
      const computed = await page
        .locator('#actual .box')
        .evaluate((element) => {
          const style = getComputedStyle(element)
          return [
            style.borderImageSource,
            style.borderImageSlice,
            style.borderImageWidth,
            style.borderImageOutset,
            style.borderImageRepeat,
          ]
        })
      const native = await page.locator('#control .box').evaluate((element) => {
        const style = getComputedStyle(element)
        return [
          style.borderImageSource,
          style.borderImageSlice,
          style.borderImageWidth,
          style.borderImageOutset,
          style.borderImageRepeat,
        ]
      })
      expect(
        JSON.stringify(computed) === JSON.stringify(native),
      ).toMatchInlineSnapshot(`true`)
      // Paint both controls at the same device coordinates to avoid gradient dithering differences.
      await page.addStyleTag({
        content:
          '#actual,#control{position:absolute;left:0;top:0}#control{visibility:hidden}',
      })
      const actual = await page.locator('#actual').screenshot()
      await page.addStyleTag({
        content: '#actual{visibility:hidden}#control{visibility:visible}',
      })
      const control = await page.locator('#control').screenshot()
      expect(actual.equals(control)).toMatchInlineSnapshot(`true`)
      expect(
        await page
          .locator('#actual .box')
          .evaluate((element) => getComputedStyle(element).borderImageSlice),
      ).toMatchInlineSnapshot(`"25% fill"`)
      expect(
        await page
          .locator('#actual .box')
          .evaluate((element) => getComputedStyle(element).borderImageOutset),
      ).toMatchInlineSnapshot(`"2px 4px 6px 8px"`)
      expect(
        await page
          .locator('#text')
          .evaluate((element) => getComputedStyle(element).scrollbarColor),
      ).toMatchInlineSnapshot(`"rgb(255, 0, 0) rgb(0, 0, 255)"`)
    } finally {
      await browser.close()
    }
  })
})
