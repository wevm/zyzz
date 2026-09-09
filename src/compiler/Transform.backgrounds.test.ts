/**
 * Verifies scalar background declarations and native color controls.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Backgrounds from '../../test/fixtures/Backgrounds.js'

describe('compile', () => {
  test('backgrounds preserve fallback positions and color keyword precedence', () => {
    const output = Transform.compile({
      moduleId: 'backgrounds.ts',
      source: Backgrounds.source,
    })
    expect(output.css.match(/background-position-[xy]:[^;}]+/g))
      .toMatchInlineSnapshot(`
      [
        "background-position-x:left",
        "background-position-x:25%!important",
        "background-position-y:-4px",
      ]
    `)
    expect(output.css.match(/(?:accent|caret)-color:auto/g))
      .toMatchInlineSnapshot(`
      [
        "accent-color:auto",
        "caret-color:auto",
      ]
    `)
    expect(output.css.includes('color_2e_auto,#06c)')).toMatchInlineSnapshot(
      `true`,
    )
  })

  test('backgrounds and color controls match computed browser declarations', async () => {
    const output = Transform.compile({
      moduleId: 'backgrounds.ts',
      source: Backgrounds.source,
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
        `<style>input{width:100px;height:40px}${output.css}</style>${Object.entries(
          Backgrounds.controls,
        )
          .map(
            ([name, css]) =>
              `<input id="${name}" class="${module[name].className}" value="Color"><input id="${name}-control" style="${css}" value="Color">`,
          )
          .join('')}`,
      )
      expect(
        await page.evaluate(
          (names) =>
            names.filter((name) => {
              const a = getComputedStyle(document.getElementById(name)!)
              const b = getComputedStyle(
                document.getElementById(`${name}-control`)!,
              )
              return [
                'accent-color',
                'background-attachment',
                'background-blend-mode',
                'background-clip',
                'background-origin',
                'background-position-x',
                'background-position-y',
                'background-repeat',
                'background-size',
                'caret-color',
                'color-scheme',
                'forced-color-adjust',
                'mix-blend-mode',
                'print-color-adjust',
              ].some(
                (property) =>
                  a.getPropertyValue(property) !== b.getPropertyValue(property),
              )
            }),
          Object.keys(Backgrounds.controls),
        ),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page
          .locator('#control')
          .evaluate((element) => getComputedStyle(element).caretColor),
      ).toMatchInlineSnapshot(`"rgb(0, 102, 204)"`)
      expect(
        await page
          .locator('#background')
          .evaluate((element) => getComputedStyle(element).backgroundPositionX),
      ).toMatchInlineSnapshot(`"25%"`)
    } finally {
      await browser.close()
    }
  })
})
