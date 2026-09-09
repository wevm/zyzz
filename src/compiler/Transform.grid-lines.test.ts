/**
 * Verifies grid placement through source compilation and native layout.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as GridLines from '../../test/fixtures/GridLines.js'

describe('compile', () => {
  test('grid placement preserves named lines and shorthand order', () => {
    const lexer = Conformance.lexer()
    for (const [property, value] of Object.entries(GridLines.styles)) {
      const name = Conformance.name(property)
      const output = Transform.compile({
        moduleId: 'grid.ts',
        source: `import { css } from 'zyzz'; css({${property}:${JSON.stringify(value)}});`,
      })
      expect(output.css.includes(`${name}:${value}`)).toMatchInlineSnapshot(
        `true`,
      )
      expect(lexer.matchProperty(name, value).error).toMatchInlineSnapshot(
        `null`,
      )
    }
    const output = Transform.compile({
      moduleId: 'grid.ts',
      source: GridLines.source,
    })
    expect(
      output.css.match(/grid-column:1 \/ 3;/g)?.length,
    ).toMatchInlineSnapshot(`2`)
  })
  test('grid placement rejects invalid indices and slash components', () => {
    const accepted: string[] = []
    for (const [property, value] of [
      ['gridColumn', '1 / 2 / 3'],
      ['gridArea', '1 / 2 / 3 / 4 / 5'],
      ['gridRow', '1 /'],
      ['gridArea', '/ 1'],
      ['gridRowStart', '0'],
      ['gridColumnStart', 'span'],
      ['gridColumnStart', 'span 0'],
      ['gridColumnStart', 'span -1'],
      ['gridColumnStart', 'span 1.5'],
      ['gridColumnEnd', 'auto header'],
      ['gridColumnEnd', 'header footer'],
      ['gridColumnEnd', '1 2'],
      ['gridColumnEnd', 'span span header'],
      ['gridRow', 'inherit / 2'],
      ['gridRowStart', '1px'],
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
  test('grid placement matches native named and numbered layout', async () => {
    const output = Transform.compile({
      moduleId: 'grid.ts',
      source: GridLines.source,
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
        `<style>.grid{display:grid;grid-template-columns:[start] 40px 40px [end] 40px;grid-template-rows:30px 30px;width:120px}${output.css}</style><div class="grid"><div id="actual" class="${module.placement.className}"></div></div><div class="grid"><div id="control" style="grid-area:1 / 2 / 3 / 4"></div></div><div class="grid"><div id="named" class="${module.named.className}"></div></div><div class="grid"><div id="named-control" style="grid-column:start / end;grid-row:1 / span 2"></div></div><div class="grid"><div id="override" class="${module.first.className} ${module.second.className} ${module.third.className}"></div></div>`,
      )
      for (const id of ['actual', 'control', 'named', 'named-control']) {
        expect(
          await page
            .locator(`#${id}`)
            .evaluate((element) => [
              element.getBoundingClientRect().width,
              element.getBoundingClientRect().height,
            ]),
        ).toMatchInlineSnapshot(`
          [
            80,
            60,
          ]
        `)
      }
      expect(
        await page
          .locator('#override')
          .evaluate((element) => getComputedStyle(element).gridColumnStart),
      ).toMatchInlineSnapshot(`"1"`)
    } finally {
      await browser.close()
    }
  })
})
