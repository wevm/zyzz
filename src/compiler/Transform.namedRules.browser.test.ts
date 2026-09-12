/** Checks rendered named counters, color palettes, and anchor fallbacks. @module */
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Font from '../../test/fixtures/ColorFont.js'

describe('compile', () => {
  test('Chromium renders named descriptors and exact anchor fallback placement', async () => {
    const output = Transform.compile({
      moduleId: 'render.ts',
      source: `import {fontFace,fontPaletteValues,counterStyle,positionTry,global} from 'zyzz/web';
fontFace({fontFamily:'PaletteEvidence',src:${JSON.stringify(`url("${Font.url}")`)}});
const blue=fontPaletteValues({fontFamily:'PaletteEvidence',basePalette:1});
const dots=counterStyle({system:'cyclic',symbols:'"●"',suffix:'" "'});
const above=positionTry({positionArea:'top'});
global({'#compiled':{fontPalette:blue},'#counter':{listStyleType:dots},'#tooltip':{position:'absolute',positionAnchor:'--target',positionArea:'bottom',positionTryFallbacks:above,width:'50px',height:'30px'}});`,
    })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({
        viewport: { width: 300, height: 200 },
      })
      await page.setContent(
        '<div id="compiled" class="font">A</div><div id="native" class="font">A</div><div id="red" class="font">A</div><li id="counter">item</li><li id="control">item</li><div id="anchor"></div><div id="tooltip"></div>',
      )
      await page.addStyleTag({ content: output.css })
      await page.addStyleTag({
        content:
          '@font-palette-values --native {font-family:PaletteEvidence;base-palette:1} @counter-style reference {system:cyclic;symbols:"●";suffix:" "} .font{font:40px PaletteEvidence;width:60px;height:40px} #native{font-palette:--native} #red{font-palette:normal} li{list-style-position:inside;width:100px;height:24px;font:16px Arial} #control{list-style-type:reference} #anchor{anchor-name:--target;position:absolute;top:180px;left:100px;width:20px;height:10px}',
      })
      await page.evaluate(() => document.fonts.ready)
      expect(
        await page.evaluate(() => document.fonts.check('40px PaletteEvidence')),
      ).toMatchInlineSnapshot('true')
      expect(
        Buffer.compare(
          await page.locator('#compiled').screenshot(),
          await page.locator('#native').screenshot(),
        ),
      ).toMatchInlineSnapshot('0')
      expect(
        Buffer.compare(
          await page.locator('#compiled').screenshot(),
          await page.locator('#red').screenshot(),
        ) === 0,
      ).toMatchInlineSnapshot('false')
      expect(
        Buffer.compare(
          await page.locator('#counter').screenshot(),
          await page.locator('#control').screenshot(),
        ),
      ).toMatchInlineSnapshot('0')
      expect(
        await page.locator('#tooltip').evaluate((element) => {
          const box = element.getBoundingClientRect()
          return {
            bottom: box.bottom,
            height: box.height,
            left: box.left,
            width: box.width,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "bottom": 180,
          "height": 30,
          "left": 85,
          "width": 50,
        }
      `)
    } finally {
      await browser.close()
    }
  })
})
