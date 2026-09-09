/**
 * Verifies dimensional math, nested lists, and native computed expressions.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as MathExpressions from '../../test/fixtures/MathExpressions.js'

describe('compile', () => {
  test('dimensional expressions agree with independent CSS grammar', () => {
    const lexer = Conformance.lexer()
    for (const [property, value] of [
      ['width', 'clamp(20px, calc(50% - 10px), 200px)'],
      ['padding', 'calc(2px * 3) min(20px, 5%)'],
      ['borderRadius', 'calc(20px / 2) / max(10px, 5%)'],
      ['opacity', 'calc(1 / 2)'],
      ['order', 'calc(1.5)'],
      ['transitionDuration', 'calc(1s + 250ms), min(2s, 500ms)'],
      [
        'gridTemplateColumns',
        'minmax(calc(10px + 2px), 1fr) clamp(20px, 10%, 50px)',
      ],
    ] as const) {
      const output = Transform.compile({
        moduleId: 'math.ts',
        source: `import { css } from 'zyzz'; css({${property}:${JSON.stringify(value)}})`,
      })
      expect(
        output.css.includes(`${Conformance.name(property)}:${value}`),
      ).toMatchInlineSnapshot(`true`)
      expect(
        lexer.matchProperty(Conformance.name(property), value).error,
      ).toMatchInlineSnapshot(`null`)
    }
  })
  test('nested math matches browser layout, integer rounding, and duration values', async () => {
    const output = Transform.compile({
      moduleId: 'math.ts',
      source: MathExpressions.source,
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
      const page = await browser.newPage({
        viewport: { width: 800, height: 600 },
      })
      await page.setContent(
        `<style>${output.css}.parent{width:400px}.grid{width:300px}</style><div class="parent"><div id="actual" class="${module.box.className}"></div><div id="control" style="${MathExpressions.control}"></div></div><div id="grid" class="grid ${module.grid.className}"></div><div id="grid-control" class="grid" style="display:grid;grid-template-columns:minmax(calc(10px + 2px),1fr) clamp(20px,10%,50px)"></div>`,
      )
      expect(
        await page.evaluate(() => {
          const a = getComputedStyle(document.getElementById('actual')!)
          const b = getComputedStyle(document.getElementById('control')!)
          return [
            'width',
            'height',
            'padding-top',
            'padding-right',
            'border-top-left-radius',
            'opacity',
            'order',
            'transition-duration',
          ].filter((key) => a.getPropertyValue(key) !== b.getPropertyValue(key))
        }),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"190px"`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).order),
      ).toMatchInlineSnapshot(`"2"`)
      expect(
        await page.evaluate(
          () =>
            getComputedStyle(document.getElementById('grid')!)
              .gridTemplateColumns ===
            getComputedStyle(document.getElementById('grid-control')!)
              .gridTemplateColumns,
        ),
      ).toMatchInlineSnapshot(`true`)
    } finally {
      await browser.close()
    }
  })
})
