/**
 * Verifies layout keywords and stacking through public compilation and browser rendering.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Layout from '../../test/fixtures/Layout.js'

describe('compile', () => {
  test('layout preserves stacking importance and rejects noninteger indices', () => {
    const output = Transform.compile({
      moduleId: 'layout.ts',
      source: Layout.source,
    })
    expect(output.css.match(/z-index:[^;}]+/g)).toMatchInlineSnapshot(`
      [
        "z-index:auto",
        "z-index:2!important",
        "z-index:1",
      ]
    `)
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import { css } from 'zyzz'; css({zIndex:1.5});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:40: Expected a finite integer from -9007199254740991 to 9007199254740991.]`,
    )
  })

  test('layout matches browser float clearance, containment, and stacking', async () => {
    const output = Transform.compile({
      moduleId: 'layout.ts',
      source: Layout.source,
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
      const attributes = (
        name: keyof typeof Layout.controls,
        control: boolean,
      ) =>
        control
          ? `id="${name}-control" style="${Layout.controls[name]}"`
          : `id="${name}" class="${module[name].className}"`
      const markup = (control: boolean) =>
        `<main><div ${attributes('floatBox', control)}>Float</div><div ${attributes('cleared', control)}>Clear</div><section ${attributes('context', control)}><div ${attributes('front', control)}>Front</div><div ${attributes('back', control)}>Back</div></section><img ${attributes('image', control)} width="20" height="20" alt=""></main>`
      await page.setContent(
        `<style>${output.css}</style>${markup(false)}${markup(true)}`,
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
                'backface-visibility',
                'box-decoration-break',
                'clear',
                'contain',
                'content-visibility',
                'display',
                'float',
                'isolation',
                'object-fit',
                'transform-style',
                'z-index',
              ].some(
                (property) =>
                  a.getPropertyValue(property) !== b.getPropertyValue(property),
              )
            }),
          Object.keys(Layout.controls),
        ),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page
          .locator('#cleared')
          .evaluate(
            (element) =>
              element.getBoundingClientRect().top >=
              document.getElementById('floatBox')!.getBoundingClientRect()
                .bottom,
          ),
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page.locator('#context').evaluate((element) => {
          const box = element.getBoundingClientRect()
          return document.elementFromPoint(box.x + 10, box.y + 10)?.id
        }),
      ).toMatchInlineSnapshot(`"front"`)
      expect(
        await page.locator('#context-control').evaluate((element) => {
          const box = element.getBoundingClientRect()
          return document.elementFromPoint(box.x + 10, box.y + 10)?.id
        }),
      ).toMatchInlineSnapshot(`"front-control"`)
    } finally {
      await browser.close()
    }
  })
})
