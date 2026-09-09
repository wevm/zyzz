/**
 * Verifies functional color grammar, themed compilation, and browser computed values.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as FunctionalColors from '../../test/fixtures/FunctionalColors.js'

describe('compile', () => {
  test('functional colors agree with independent CSS grammar', () => {
    const lexer = Conformance.lexer()
    for (const color of FunctionalColors.valid) {
      const output = Transform.compile({
        moduleId: 'color.ts',
        source: `import { css } from 'zyzz'; css({color:${JSON.stringify(color)}})`,
      })
      expect(output.css.includes(`color:${color}`)).toMatchInlineSnapshot(
        `true`,
      )
      expect(lexer.matchProperty('color', color).error).toMatchInlineSnapshot(
        `null`,
      )
    }
    const output = Transform.compile({
      moduleId: 'color.ts',
      source: FunctionalColors.source,
    })
    expect(output.css.match(/background-color:[^;}]+/g)).toMatchInlineSnapshot(`
      [
        "background-color:rgb(255, 0, 0)",
        "background-color:hsl(120deg 50% 50% / .5)!important",
      ]
    `)
  })
  test('functional colors match native theme inheritance and SVG output', async () => {
    const output = Transform.compile({
      moduleId: 'color.ts',
      source: FunctionalColors.source,
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
        `<style>${output.css}</style><div class="${module.scope}"><div id="actual" class="${module.box.className}"><span id="child">child</span></div><svg><rect id="shape" class="${module.svg.className}" /></svg></div><div id="control" style="${FunctionalColors.control}"><span id="control-child">child</span></div><svg><rect id="shape-control" style="fill:lab(50% 20 -30);stroke:oklab(.5 .1 -.1)" /></svg>`,
      )
      expect(
        await page.evaluate(() => {
          return [
            [
              'actual',
              'control',
              [
                'color',
                'background-color',
                'border-top-color',
                'outline-color',
              ],
            ],
            ['child', 'control-child', ['color']],
            ['shape', 'shape-control', ['fill', 'stroke']],
          ].flatMap(([actual, control, keys]) => {
            const a = getComputedStyle(
              document.getElementById(actual as string)!,
            )
            const b = getComputedStyle(
              document.getElementById(control as string)!,
            )
            return (keys as string[]).filter(
              (key) => a.getPropertyValue(key) !== b.getPropertyValue(key),
            )
          })
        }),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).backgroundColor),
      ).toMatchInlineSnapshot(`"rgba(64, 191, 64, 0.5)"`)
      for (const color of FunctionalColors.valid) {
        expect(
          await page.evaluate((color) => CSS.supports('color', color), color),
        ).toMatchInlineSnapshot(`true`)
      }
    } finally {
      await browser.close()
    }
  })
})

describe('define', () => {
  test('rejects malformed functional colors through public authoring', () => {
    for (const color of FunctionalColors.invalid)
      expect(() =>
        // @ts-expect-error Exercise invalid JavaScript inputs through the public API.
        Style.define({ box: { color } }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Style.InvalidError: ["box","color"]: Expected a named color, system color, hex color, transparent, or currentColor.]`,
      )
  })
})
