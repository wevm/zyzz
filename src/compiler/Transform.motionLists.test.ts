/**
 * Verifies motion grammar, emitted ordering, and native animation output.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as MotionLists from '../../test/fixtures/MotionLists.js'

describe('compile', () => {
  test('motion functions agree with independent CSS grammar', () => {
    const lexer = Conformance.lexer()

    for (const value of MotionLists.easing) {
      const output = Transform.compile({
        moduleId: 'motion-lists.ts',
        source: `import { css } from 'zyzz'; css({animationTimingFunction:${JSON.stringify(value)}});`,
      })

      expect(
        output.css.includes(`animation-timing-function:${value}`),
      ).toMatchInlineSnapshot(`true`)
      expect(
        lexer.matchProperty('animation-timing-function', value).error,
      ).toMatchInlineSnapshot(`null`)
    }

    const output = Transform.compile({
      moduleId: 'motion-lists.ts',
      source: MotionLists.source,
    })

    expect(output.css.match(/transition-duration:[^;}]+/g))
      .toMatchInlineSnapshot(`
      [
        "transition-duration:1s, 2s",
        "transition-duration:250ms, 500ms!important",
      ]
    `)
  })

  test('motion lists match native computed styles and paused curve output', async () => {
    const output = Transform.compile({
      moduleId: 'motion-lists.ts',
      source: MotionLists.source,
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
        `<style>${output.css}@keyframes fade{from{opacity:0}to{opacity:1}}@keyframes move{from{left:0px}to{left:100px}}.animated{animation-name:fade,move;position:relative}</style><div id="actual" class="animated ${module.motion.className}"></div><div id="control" class="animated" style="${MotionLists.control}"></div>`,
      )

      expect(
        await page.evaluate(() => {
          const actual = getComputedStyle(document.getElementById('actual')!)
          const control = getComputedStyle(document.getElementById('control')!)

          return [
            'animation-delay',
            'animation-direction',
            'animation-duration',
            'animation-fill-mode',
            'animation-iteration-count',
            'animation-play-state',
            'animation-timing-function',
            'transition-behavior',
            'transition-delay',
            'transition-duration',
            'transition-timing-function',
            'opacity',
            'left',
          ].filter(
            (key) =>
              actual.getPropertyValue(key) !== control.getPropertyValue(key),
          )
        }),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot(`"0.25"`)
      // Seek real CSS animations to a fixed time; no wall-clock timing assumptions.
      expect(
        await page.evaluate(() => {
          for (const animation of document.getAnimations())
            animation.currentTime = 500

          const actual = getComputedStyle(document.getElementById('actual')!)
          const control = getComputedStyle(document.getElementById('control')!)

          return {
            left: actual.left,
            matches:
              actual.left === control.left &&
              actual.opacity === control.opacity,
            opacity: actual.opacity,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "left": "75px",
          "matches": true,
          "opacity": "0.75",
        }
      `)
    } finally {
      await browser.close()
    }
  })
})
