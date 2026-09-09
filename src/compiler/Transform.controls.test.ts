/**
 * Verifies list and input properties through compilation and native rendering.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Controls from '../../test/fixtures/Controls.js'

describe('compile', () => {
  test('input controls preserve numeric tab fallbacks, touch combinations, and maps', () => {
    const output = Transform.compile({
      moduleId: 'controls.ts',
      source: Controls.source,
    })
    expect(output.css.match(/tab-size:[^;}]+/g)).toMatchInlineSnapshot(`
      [
        "tab-size:4",
        "tab-size:8!important",
      ]
    `)
    expect(
      output.css.includes('touch-action:pinch-zoom pan-left pan-up'),
    ).toMatchInlineSnapshot(`true`)
    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('tab-size:8!important'),
    )
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('tab-size:8!important'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 163,
        "line": 3,
        "name": "tabSize",
        "source": "controls.ts",
      }
    `)
  })

  test('list markers match native pixels and input controls match independent CSS', async () => {
    const output = Transform.compile({
      moduleId: 'controls.ts',
      source: Controls.source,
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
        `<style>ol{margin:0;padding:10px;width:180px;font:16px monospace;background:white}pre{display:inline-block;font:16px monospace}${output.css}</style><ol id="list" class="${module.list.className}"><li>First</li><li>Second</li></ol><ol id="list-control" style="${Controls.controls.list}"><li>First</li><li>Second</li></ol><ol id="unmarked" style="list-style-type:none"><li>First</li><li>Second</li></ol><pre id="input" class="${module.input.className}">a\tb</pre><pre id="input-control" style="${Controls.controls.input}">a\tb</pre>`,
      )
      expect(
        await page.evaluate(() => {
          const properties = {
            input: [
              'appearance',
              'overflow-anchor',
              'overscroll-behavior-block',
              'overscroll-behavior-inline',
              'scrollbar-width',
              'tab-size',
              'text-size-adjust',
              'touch-action',
            ],
            list: [
              'line-break',
              'list-style-position',
              'list-style-type',
              'text-spacing-trim',
              'unicode-bidi',
            ],
          }
          return Object.entries(properties).flatMap(([name, keys]) => {
            const a = getComputedStyle(document.getElementById(name)!)
            const b = getComputedStyle(
              document.getElementById(`${name}-control`)!,
            )
            return keys.filter(
              (key) => a.getPropertyValue(key) !== b.getPropertyValue(key),
            )
          })
        }),
      ).toMatchInlineSnapshot(`[]`)
      const actual = await page.locator('#list').screenshot()
      const control = await page.locator('#list-control').screenshot()
      const unmarked = await page.locator('#unmarked').screenshot()
      expect(actual.equals(control)).toMatchInlineSnapshot(`true`)
      expect(actual.equals(unmarked)).toMatchInlineSnapshot(`false`)
      expect(
        await page.evaluate(
          () =>
            document.getElementById('input')!.getBoundingClientRect().width ===
            document.getElementById('input-control')!.getBoundingClientRect()
              .width,
        ),
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page
          .locator('#input')
          .evaluate((element) => getComputedStyle(element).tabSize),
      ).toMatchInlineSnapshot(`"8"`)
    } finally {
      await browser.close()
    }
  })
})
