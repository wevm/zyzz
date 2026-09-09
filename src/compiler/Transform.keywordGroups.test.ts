/**
 * Verifies compatible keyword groups through public authoring and native CSS.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as KeywordGroups from '../../test/fixtures/KeywordGroups.js'

describe('compile', () => {
  test('keyword groups agree with independent grammar in authored orders', () => {
    const lexer = Conformance.lexer()
    for (const [property, value] of [
      ['contain', 'layout style paint'],
      ['fontSynthesis', 'style weight small-caps'],
      ['fontVariantEastAsian', 'jis78 full-width ruby'],
      ['fontVariantLigatures', 'no-common-ligatures contextual'],
      ['fontVariantNumeric', 'oldstyle-nums tabular-nums slashed-zero'],
    ] as const) {
      for (const words of [value, value.split(' ').reverse().join(' ')]) {
        const output = Transform.compile({
          moduleId: 'groups.ts',
          source: `import { css } from 'zyzz'; css({${property}:${JSON.stringify(words)}})`,
        })
        expect(
          output.css.includes(`${Conformance.name(property)}:${words}`),
        ).toMatchInlineSnapshot(`true`)
        expect(
          lexer.matchProperty(Conformance.name(property), words).error,
        ).toMatchInlineSnapshot(`null`)
      }
    }
  })
  test('keyword groups match native browser declarations and priority', async () => {
    const output = Transform.compile({
      moduleId: 'groups.ts',
      source: KeywordGroups.source,
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
        `<style>${output.css}</style><div id="actual" class="${module.text.className}" style="font-variant-numeric:lining-nums">123</div><div id="control" style="${KeywordGroups.control}">123</div>`,
      )
      expect(
        await page.evaluate(() => {
          const a = getComputedStyle(document.getElementById('actual')!)
          const b = getComputedStyle(document.getElementById('control')!)
          return [
            'contain',
            'font-synthesis',
            'font-variant-east-asian',
            'font-variant-ligatures',
            'font-variant-numeric',
          ].filter((key) => a.getPropertyValue(key) !== b.getPropertyValue(key))
        }),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).fontVariantNumeric),
      ).toMatchInlineSnapshot(`"oldstyle-nums tabular-nums slashed-zero"`)
    } finally {
      await browser.close()
    }
  })
})
