/**
 * Verifies custom name parsing and native case-sensitive animation/query lookup.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Identifiers from '../../test/fixtures/Identifiers.js'

describe('compile', () => {
  test('rejects malformed identifiers, reserved names, and invalid list boundaries', () => {
    const accepted: string[] = []
    for (const [property, value] of [
      ['anchorName', 'Anchor'],
      ['anchorName', '--'],
      ['anchorName', 'none, --Anchor'],
      ['animationName', '123name'],
      ['animationName', 'Default'],
      ['animationName', 'Fade, inherit'],
      ['containerName', 'Card NOT'],
      ['containerName', 'none Card'],
      ['containerName', 'Card, Secondary'],
      ['transitionProperty', 'none, opacity'],
      ['viewTransitionName', 'auto'],
      ['willChange', 'will-change'],
      ['willChange', 'all'],
      ['willChange', 'auto, opacity'],
      ['animationTimeline', '--scroll,'],
      ['page', 'a;b'],
      ['fontPalette', 'palette'],
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
  test('native names resolve case-sensitive keyframes and named container queries', async () => {
    const output = Transform.compile({
      moduleId: 'identifiers.ts',
      source: Identifiers.source,
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
        `<style>${Identifiers.native}${output.css}</style><div id="container" class="${module.container.className}"><span id="probe" class="probe">probe</span></div><div id="motion" class="${module.motion.className}"></div><div id="control" style="animation-name:Fade;animation-duration:1s;animation-delay:-250ms;animation-play-state:paused;animation-timing-function:linear;animation-fill-mode:both"></div><div id="names" class="${module.names.className}"></div>`,
      )
      expect(
        await page
          .locator('#motion')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot(`"0.25"`)
      expect(
        await page
          .locator('#control')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot(`"0.25"`)
      expect(
        await page
          .locator('#probe')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(0, 128, 0)"`)
      expect(
        await page
          .locator('#container')
          .evaluate((element) => getComputedStyle(element).containerName),
      ).toMatchInlineSnapshot(`"Card Secondary"`)
      expect(
        await page
          .locator('#names')
          .evaluate((element) => getComputedStyle(element).viewTransitionName),
      ).toMatchInlineSnapshot(`"Hero"`)
      expect(
        await page
          .locator('#names')
          .evaluate((element) => getComputedStyle(element).transitionProperty),
      ).toMatchInlineSnapshot(`"opacity, transform"`)
    } finally {
      await browser.close()
    }
  })
})
