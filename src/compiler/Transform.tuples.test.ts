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
      output.css.match(/interest-delay:100ms 200ms;/g)?.length,
    ).toMatchInlineSnapshot(`2`)
  })
  test('scalar tuples reject invalid arity, domains, and marker placement', () => {
    const accepted: string[] = []
    for (const [property, value] of [
      ['borderImageSlice', 'fill'],
      ['borderImageSlice', '1 fill fill'],
      ['borderImageSlice', '1px'],
      ['borderImageWidth', '-1'],
      ['borderImageWidth', '1 2 3 4 5'],
      ['borderImageOutset', '10%'],
      ['maskBorderSlice', 'fill 1 2'],
      ['maskBorderWidth', '1px red'],
      ['maskBorderOutset', '1deg'],
      ['scrollbarColor', 'red'],
      ['scrollbarColor', 'auto red'],
      ['scrollbarColor', 'red blue green'],
      ['MozBorderTopColors', 'none red'],
      ['MozBorderTopColors', 'red inherit'],
      ['hyphenateLimitChars', '2 3.5'],
      ['MsHyphenateLimitChars', 'auto 2'],
      ['interestDelay', '1px'],
      ['interestDelay', '1s 2s 3s'],
      ['interestDelay', '-1s'],
      ['viewTimelineInset', 'auto,'],
      ['viewTimelineInset', '1px 2px 3px'],
    ]) {
      try {
        Transform.compile({
          moduleId: 'invalid.ts',
          source: `import { css } from 'zyzz'; css({${property}:${JSON.stringify(value)}});`,
        })
        accepted.push(`${property}:${value}`)
      } catch (error) {
        if (!(error instanceof Error) || error.name !== 'Source.ExtractError')
          throw error
      }
    }
    expect(accepted).toMatchInlineSnapshot(`[]`)
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
        `<style>.frame{display:inline-block;vertical-align:top;width:160px;height:160px;background:white}.box{width:60px;height:60px;margin:30px;border:10px solid transparent;border-image-source:linear-gradient(90deg,red,blue)}${output.css}</style><div id="actual" class="frame"><div class="box ${module.border.className}"></div></div><div id="control" class="frame"><div class="box" style="${Tuples.control}"></div></div><div id="text" class="${module.text.className}"></div>`,
      )
      const actual = await page.locator('#actual').screenshot()
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
