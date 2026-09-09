/**
 * Verifies border list validation and physical/logical browser expansion.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Transform } from 'zyzz/compiler'
import * as BorderLists from '../../test/fixtures/BorderLists.js'
import * as Conformance from '../../test/fixtures/Conformance.js'

describe('compile', () => {
  test('border shorthand lists agree with independent grammar and preserve importance', () => {
    const lexer = Conformance.lexer()
    for (const [property, value] of [
      ['border-color', 'red rgb(0 128 0) blue gold'],
      ['border-style', 'solid dashed dotted double'],
      ['border-width', 'thin medium thick 2px'],
      ['border-radius', '10px 20px 30px 40px / 20px 30px 40px 50px'],
      ['border-top-left-radius', '10px 20%'],
    ])
      expect(
        lexer.matchProperty(property!, value!).error,
      ).toMatchInlineSnapshot(`null`)
    const output = Transform.compile({
      moduleId: 'border-lists.ts',
      source: BorderLists.source,
    })
    expect(output.css.match(/border-radius:[^;}]+/g)).toMatchInlineSnapshot(`
      [
        "border-radius:1px/2px",
        "border-radius:10px 20px 30px 40px / 20px 30px 40px 50px!important",
      ]
    `)
  })
  test('border lists match browser longhands in both writing modes', async () => {
    const output = Transform.compile({
      moduleId: 'border-lists.ts',
      source: BorderLists.source,
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
        `<style>${output.css}.box{width:300px;height:300px}</style><div id="actual" class="box ${module.box.className}"></div><div id="control" class="box" style="${BorderLists.control}"></div>`,
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
              ...['top', 'right', 'bottom', 'left'].flatMap((side) =>
                ['color', 'style', 'width'].map(
                  (kind) => `border-${side}-${kind}`,
                ),
              ),
              ...['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(
                (corner) => `border-${corner}-radius`,
              ),
              'outline-width',
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
          .evaluate((element) => getComputedStyle(element).borderTopLeftRadius),
      ).toMatchInlineSnapshot(`"10px 20px"`)
    } finally {
      await browser.close()
    }
  })
})

describe('define', () => {
  test('rejects excess border components and invalid radius axes', () => {
    expect(() =>
      Style.define({ box: { borderColor: 'red green blue gold purple' } }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["box","borderColor"]: Expected one to 4 valid space-separated values.]`,
    )
    expect(() =>
      Style.define({ box: { borderBlockStyle: 'solid dashed dotted' } }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["box","borderBlockStyle"]: Expected one to 2 valid space-separated values.]`,
    )
    for (const borderRadius of [
      '1px / -2px',
      '1px / 2px / 3px',
      '1px / inherit',
      '1px / 1px 2px 3px 4px 5px',
    ])
      expect(() =>
        // @ts-expect-error Invalid JavaScript strings are checked at the public boundary.
        Style.define({ box: { borderRadius } }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Style.InvalidError: ["box","borderRadius"]: Expected one to four nonnegative radii on each side of a single slash.]`,
      )
    expect(() =>
      Style.define({ box: { borderColor: 'red inherit' } }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["box","borderColor"]: Expected one to 4 valid space-separated values.]`,
    )
  })
})
