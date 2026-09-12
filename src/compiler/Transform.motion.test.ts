/**
 * Verifies dimensioned times through compilation and native animation timing.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Motion from '../../test/fixtures/Motion.js'

describe('compile', () => {
  test('motion controls preserve units, importance, and source maps', () => {
    const output = Transform.compile({
      moduleId: 'motion.ts',
      source: Motion.source,
    })

    expect(output.css.match(/animation-duration:[^;}]+/g))
      .toMatchInlineSnapshot(`
      [
        "animation-duration:1s",
        "animation-duration:2s!important",
      ]
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('animation-duration:2s!important'),
    )

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('animation-duration:2s!important'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 73,
        "line": 2,
        "name": "animationDuration",
        "source": "motion.ts",
      }
    `)
  })

  test('motion controls drive native paused animation timing', async () => {
    const output = Transform.compile({
      moduleId: 'motion.ts',
      source: Motion.source,
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
        `<style>@keyframes fade{from{opacity:0}to{opacity:1}}#actual,#control{animation-name:fade}${output.css}</style><div id="actual" class="${module.motion.className}">Motion</div><div id="control" style="${Motion.controls.motion}">Control</div><div id="transition" class="${module.transition.className}">Transition</div><div id="transition-control" style="${Motion.controls.transition}">Control</div>`,
      )

      expect(
        await page.evaluate(() => {
          const a = getComputedStyle(document.getElementById('actual')!)
          const b = getComputedStyle(document.getElementById('control')!)

          return [
            'animation-delay',
            'animation-duration',
            'animation-direction',
            'animation-fill-mode',
            'animation-iteration-count',
            'animation-play-state',
            'animation-timing-function',
            'opacity',
          ].filter((key) => a.getPropertyValue(key) !== b.getPropertyValue(key))
        }),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot(`"0.25"`)
      expect(
        await page
          .locator('#actual')
          .evaluate(
            (element) =>
              element.getAnimations()[0]!.effect!.getTiming().duration,
          ),
      ).toMatchInlineSnapshot(`2000`)
      expect(
        await page
          .locator('#actual')
          .evaluate(
            (element) => element.getAnimations()[0]!.effect!.getTiming().delay,
          ),
      ).toMatchInlineSnapshot(`-500`)
      expect(
        await page.evaluate(() => {
          const a = getComputedStyle(document.getElementById('transition')!)
          const b = getComputedStyle(
            document.getElementById('transition-control')!,
          )

          return [
            'transition-delay',
            'transition-duration',
            'transition-timing-function',
            'transition-behavior',
          ].filter((key) => a.getPropertyValue(key) !== b.getPropertyValue(key))
        }),
      ).toMatchInlineSnapshot(`[]`)
    } finally {
      await browser.close()
    }
  })
})
