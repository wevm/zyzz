/** Verifies image and URL authoring through compilation and native CSS controls. @module */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Transform } from 'zyzz/compiler'
import { Css } from 'zyzz/web'
import * as Conformance from '../../test/fixtures/Conformance.js'

describe('compile', () => {
  test('preserves quoted image fallbacks and marker shorthand order', () => {
    const styles = Style.define({
      image: {
        backgroundImage: ['url("image.png")', 'linear-gradient(red, blue)!'],
      },
      first: { marker: 'url(#first)' },
      second: { markerStart: 'url(#second)' },
      third: { marker: 'url(#first)', opacity: 0.5 },
    })

    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(`
      ".z-background-image-1uqhlte1ehenji{background-image:url("image.png");background-image:linear-gradient(red, blue)!important;}
      .z-marker-k5oaqnkf68sf-0{marker:url(#first);}
      .z-marker-start-7g8g011fwopat-0{marker-start:url(#second);}
      .z-marker-s9akdk1oqrjza-0{marker:url(#first);}
      .z-opacity-1jngh5ibobng6{opacity:0.5;}"
    `)

    const lexer = Conformance.lexer()

    for (const value of [
      'url("image.png")',
      'linear-gradient(red, blue)',
      'url(#paint), none',
    ])
      expect(
        lexer.matchProperty('background-image', value).error,
      ).toMatchInlineSnapshot(`null`)
  })

  test('leaves CSS value validity to static authoring and the browser', () => {
    const styles = Reflect.apply(Style.define, undefined, [
      { card: { color: '#12', order: 0.5 } },
    ]) as Style.Definition

    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(
      `
      ".z-text-kah549xphy6x{color:#12;}
      .z-order-z47mr91b5cjgh{order:0.5;}"
    `,
    )

    const output = Transform.compile({
      moduleId: 'unchecked.ts',
      source: `import { css } from 'zyzz'; export const card = css({ color: '#12', order: 0.5 })();`,
    })

    expect(output.css.includes('color:#12;order:0.5;')).toMatchInlineSnapshot(
      `false`,
    )
  })

  test('image fallbacks and SVG markers match native browser declarations', async () => {
    const output = Transform.compile({
      moduleId: 'images.ts',
      source: `import { css } from 'zyzz'; export const image = css({ backgroundImage: ['url("missing.png")', 'linear-gradient(red, blue)!'], maskImage: 'linear-gradient(black, transparent)' })(); export const marker = css({marker:'url(#arrow)', markerStart:'none'})();`,
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
        `<style>${output.css}</style><div id="actual" class="${module.image.className}"></div><div id="control" style="background-image:linear-gradient(red, blue)!important;mask-image:linear-gradient(black, transparent)"></div><svg><defs><marker id="arrow" markerWidth="10" markerHeight="10"><path d="M0,0 L10,5 L0,10 Z"/></marker></defs><path id="actual-marker" class="${module.marker.className}" d="M10,10 L50,10"/><path id="control-marker" style="marker:url(#arrow);marker-start:none" d="M10,30 L50,30"/></svg>`,
      )

      expect(
        await page.evaluate(() => {
          const actual = getComputedStyle(document.getElementById('actual')!)
          const control = getComputedStyle(document.getElementById('control')!)
          const marker = getComputedStyle(
            document.getElementById('actual-marker')!,
          )
          const native = getComputedStyle(
            document.getElementById('control-marker')!,
          )

          return (
            actual.backgroundImage === control.backgroundImage &&
            actual.maskImage === control.maskImage &&
            marker.markerStart === native.markerStart &&
            marker.markerEnd === native.markerEnd
          )
        }),
      ).toMatchInlineSnapshot(`true`)
    } finally {
      await browser.close()
    }
  })
})
