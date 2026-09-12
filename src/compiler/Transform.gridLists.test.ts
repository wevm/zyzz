/**
 * Verifies track-list grammar, source compilation, and responsive grid geometry.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as GridLists from '../../test/fixtures/GridLists.js'

describe('compile', () => {
  test('structured grid values agree with the independent track grammar', () => {
    const lexer = Conformance.lexer()

    for (const value of GridLists.valid) {
      const output = Transform.compile({
        moduleId: 'grid-list.ts',
        source: `import { css } from 'zyzz'; css({gridTemplateColumns:${JSON.stringify(value)}});`,
      })

      expect(
        output.css.includes(`grid-template-columns:${value}`),
      ).toMatchInlineSnapshot(`true`)
      expect(
        lexer.matchProperty('grid-template-columns', value).error,
      ).toMatchInlineSnapshot(`null`)
    }

    const output = Transform.compile({
      moduleId: 'grid-list.ts',
      source: GridLists.source,
    })

    expect(
      output.css.includes(
        'grid-template-columns:1fr 2fr;grid-template-columns:repeat(auto-fit, minmax(80px, 1fr))!important',
      ),
    ).toMatchInlineSnapshot(`true`)
  })

  test('repeat and auto-fit tracks match responsive native browser geometry', async () => {
    const output = Transform.compile({
      moduleId: 'grid-list.ts',
      source: GridLists.source,
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
      const cells = '<i></i>'.repeat(6)

      await page.setContent(
        `<style>${output.css}i{height:10px}</style><div id="fixed" class="${module.fixed.className}">${cells}</div><div id="fixed-control" style="display:grid;width:300px;grid-template-columns:[start] repeat(3,minmax(0,1fr)) [end];grid-auto-rows:20px 30px">${cells}</div><div id="fluid" class="${module.fluid.className}">${cells}</div><div id="fluid-control" style="display:grid;width:300px;grid-template-columns:repeat(auto-fit,minmax(80px,1fr))">${cells}</div>`,
      )

      expect(
        await page
          .locator('#fixed')
          .evaluate((element) => getComputedStyle(element).gridTemplateColumns),
      ).toMatchInlineSnapshot(`"[start] 100px 100px 100px [end]"`)
      expect(
        await page
          .locator('#fixed')
          .evaluate((element) => getComputedStyle(element).gridTemplateRows),
      ).toMatchInlineSnapshot(`"20px 30px"`)

      for (const width of ['300px', '150px']) {
        await page.evaluate((width) => {
          for (const id of ['fluid', 'fluid-control'])
            document.getElementById(id)!.style.width = width
        }, width)

        expect(
          await page.evaluate(() =>
            ['fixed', 'fluid'].flatMap((id) => {
              const a = getComputedStyle(document.getElementById(id)!)
              const b = getComputedStyle(
                document.getElementById(`${id}-control`)!,
              )

              return ['grid-template-columns', 'grid-template-rows'].filter(
                (key) => a.getPropertyValue(key) !== b.getPropertyValue(key),
              )
            }),
          ),
        ).toMatchInlineSnapshot(`[]`)
      }

      expect(
        await page
          .locator('#fluid')
          .evaluate((element) => getComputedStyle(element).gridTemplateColumns),
      ).toMatchInlineSnapshot(`"150px"`)
    } finally {
      await browser.close()
    }
  })
})
