/**
 * Verifies container query responses and content-sized fields through compilation.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as ContainerSizing from '../../test/fixtures/ContainerSizing.js'

describe('compile', () => {
  test('container sizing preserves fallbacks and field policies', () => {
    const output = Transform.compile({
      moduleId: 'sizing.ts',
      source: ContainerSizing.source,
    })
    expect(output.css.match(/container-type:[^;}]+/g)).toMatchInlineSnapshot(`
      [
        "container-type:normal",
        "container-type:inline-size!important",
      ]
    `)
    expect(output.css.includes('field-sizing:content')).toMatchInlineSnapshot(
      `true`,
    )
    expect(
      output.css.includes('interpolate-size:allow-keywords'),
    ).toMatchInlineSnapshot(`true`)
  })

  test('container queries and field growth match native browser controls', async () => {
    const output = Transform.compile({
      moduleId: 'sizing.ts',
      source: ContainerSizing.source,
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
        `<style>${output.css}input{font:16px monospace}.child{height:10px;width:10px}@container(min-width:150px){.child{width:100px}}</style><div id="container" class="${module.container.className}"><div class="child"></div></div><div id="control" style="container-type:inline-size;width:200px"><div class="child"></div></div><input id="field" class="${module.field.className}" value="a"><input id="field-control" style="field-sizing:content;interpolate-size:allow-keywords" value="a"><input id="fixed" style="field-sizing:fixed" value="a">`,
      )
      expect(
        await page
          .locator('#container .child')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"100px"`)
      await page.evaluate(() => {
        for (const id of ['container', 'control'])
          document.getElementById(id)!.style.width = '100px'
      })
      expect(
        await page
          .locator('#container .child')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"10px"`)
      expect(
        await page.evaluate(
          () =>
            document.querySelector('#container .child')!.getBoundingClientRect()
              .width ===
            document.querySelector('#control .child')!.getBoundingClientRect()
              .width,
        ),
      ).toMatchInlineSnapshot(`true`)
      const initial = await page
        .locator('#field')
        .evaluate((element) => element.getBoundingClientRect().width)
      const fixed = await page
        .locator('#fixed')
        .evaluate((element) => element.getBoundingClientRect().width)
      for (const id of ['field', 'field-control', 'fixed'])
        await page.locator(`#${id}`).fill('a much longer input value')
      expect(
        await page
          .locator('#field')
          .evaluate(
            (element, width) => element.getBoundingClientRect().width > width,
            initial,
          ),
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page
          .locator('#fixed')
          .evaluate(
            (element, width) => element.getBoundingClientRect().width === width,
            fixed,
          ),
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page.evaluate(
          () =>
            document.getElementById('field')!.getBoundingClientRect().width ===
            document.getElementById('field-control')!.getBoundingClientRect()
              .width,
        ),
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page
          .locator('#field')
          .evaluate((element) =>
            getComputedStyle(element).getPropertyValue('interpolate-size'),
          ),
      ).toMatchInlineSnapshot(`"allow-keywords"`)
    } finally {
      await browser.close()
    }
  })
})
