/**
 * Verifies grid track and line domains through compilation and native layout.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Grid from '../../test/fixtures/Grid.js'

describe('compile', () => {
  test('grid tracks preserve flexible units, line fallback importance, and maps', () => {
    const output = Transform.compile({
      moduleId: 'grid.ts',
      source: Grid.source,
    })
    expect(output.css.match(/grid-column-start:[^;}]+/g))
      .toMatchInlineSnapshot(`
      [
        "grid-column-start:1",
        "grid-column-start:2!important",
      ]
    `)
    expect(output.css.includes('grid-auto-columns:1fr')).toMatchInlineSnapshot(
      `true`,
    )
    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('grid-column-start:2!important'),
    )
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('grid-column-start:2!important'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 42,
        "line": 3,
        "name": "gridColumnStart",
        "source": "grid.ts",
      }
    `)
  })

  test('grid placement rejects zero, fractional, unsafe, and invalid span counts', () => {
    for (const value of [
      0,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      'span 0',
      'span -2',
      'span 1.5',
      'span 9007199254740992',
    ])
      expect(() =>
        Transform.compile({
          moduleId: 'invalid.ts',
          source: `import { css } from 'zyzz'; css({gridColumnStart:${JSON.stringify(value)}});`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: invalid.ts:49: Expected valid named or numbered grid lines with nonzero indices, positive spans, and the required slash arity.]`,
      )
  })

  test('grid tracks and spans match independent browser geometry', async () => {
    const output = Transform.compile({
      moduleId: 'grid.ts',
      source: Grid.source,
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
        `<style>${output.css}</style><section id="actual" class="${module.grid.className}"><div class="${module.cell.className}">Span</div></section><section id="control" style="${Grid.controls.grid}"><div style="${Grid.controls.cell}">Span</div></section>`,
      )
      expect(
        await page.evaluate(() => {
          const a = getComputedStyle(document.getElementById('actual')!)
          const b = getComputedStyle(document.getElementById('control')!)
          return [
            'grid-auto-columns',
            'grid-auto-rows',
            'grid-auto-flow',
            'grid-template-columns',
            'grid-template-rows',
          ].filter((key) => a.getPropertyValue(key) !== b.getPropertyValue(key))
        }),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page
          .locator('#actual > div')
          .evaluate((element) => element.getBoundingClientRect().width),
      ).toMatchInlineSnapshot(`200`)
      expect(
        await page
          .locator('#actual > div')
          .evaluate((element) => element.getBoundingClientRect().height),
      ).toMatchInlineSnapshot(`40`)
      expect(
        await page
          .locator('#actual > div')
          .evaluate(
            (element) =>
              element.getBoundingClientRect().left -
              element.parentElement!.getBoundingClientRect().left,
          ),
      ).toMatchInlineSnapshot(`100`)
      expect(
        await page.evaluate(() => {
          const a = document
            .querySelector('#actual > div')!
            .getBoundingClientRect()
          const b = document
            .querySelector('#control > div')!
            .getBoundingClientRect()
          return a.width === b.width && a.height === b.height
        }),
      ).toMatchInlineSnapshot(`true`)
    } finally {
      await browser.close()
    }
  })
})
