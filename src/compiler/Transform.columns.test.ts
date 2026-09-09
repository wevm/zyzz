/**
 * Verifies column declarations through source compilation and native browser layout.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as CssTree from 'css-tree'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Columns from '../../test/fixtures/Columns.js'

describe('compile', () => {
  test('columns preserve tokens, count keywords, priority, and maps', () => {
    const output = Transform.compile({
      moduleId: 'columns.ts',
      source: Columns.source,
    })
    const declarations: string[] = []
    CssTree.walk(CssTree.parse(output.css), (node) => {
      if (node.type === 'Declaration' && !node.property.startsWith('--'))
        declarations.push(
          `${node.property}:${CssTree.generate(node.value)}${node.important ? '!' : ''}`,
        )
    })
    expect(declarations).toMatchInlineSnapshot(`
      [
        "column-rule-color:var(--z-tpmo59r5ml4jf-zyzz-color_2e_rule,#06c)",
        "column-rule-style:solid",
        "column-rule-width:thin",
        "orphans:2",
        "widows:3",
        "column-count:2",
        "column-width:auto",
        "column-gap:12px",
        "column-fill:auto",
        "break-after:auto",
        "break-inside:avoid-column",
        "break-before:auto",
        "break-before:column!",
        "column-span:none",
        "column-span:all",
        "break-before:auto",
        "column-count:auto",
        "column-width:80px",
        "column-gap:normal",
        "column-fill:balance",
      ]
    `)
    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('break-before:column!important'),
    )
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        column: lines[line]!.indexOf('break-before:column!important'),
        line: line + 1,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 49,
        "line": 4,
        "name": "breakBefore",
        "source": "columns.ts",
      }
    `)
  })

  test('column counts reject fractional, zero, negative, and unsafe integers', () => {
    for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])
      expect(() =>
        Transform.compile({
          moduleId: 'invalid.ts',
          source: `import { css } from 'zyzz'; css({columnCount:${value}});`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: invalid.ts:45: Expected a finite integer from 1 to 9007199254740991.]`,
      )
  })

  test('columns match browser rules and forced fragmentation', async () => {
    const output = Transform.compile({
      moduleId: 'columns.ts',
      source: Columns.source,
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
        `<style>section{width:240px;height:100px}p{height:20px;margin:0}${output.css}</style><section id="actual" class="${module.columns.className}"><p>First</p><p class="${module.fragment.className}">Second</p></section><section id="control" style="${Columns.controls.columns}"><p>First</p><p style="${Columns.controls.fragment}">Second</p></section>`,
      )
      expect(
        await page.locator('#actual').evaluate((element) => {
          const children = element.querySelectorAll('p')
          return (
            children[1]!.getBoundingClientRect().left -
            children[0]!.getBoundingClientRect().left
          )
        }),
      ).toMatchInlineSnapshot(`126`)
      for (const direction of ['ltr', 'rtl']) {
        await page.locator('body').evaluate((element, direction) => {
          element.style.direction = direction
        }, direction)
        expect(
          await page.evaluate(() => {
            const a = document.getElementById('actual')!
            const b = document.getElementById('control')!
            const properties = [
              'column-count',
              'column-width',
              'column-gap',
              'column-fill',
              'column-rule-color',
              'column-rule-style',
              'column-rule-width',
              'column-span',
              'break-before',
              'break-after',
              'break-inside',
              'orphans',
              'widows',
            ]
            return ['', 'p', 'p:nth-child(2)'].filter((selector) => {
              const x = selector ? a.querySelector(selector)! : a
              const y = selector ? b.querySelector(selector)! : b
              const xx = getComputedStyle(x),
                yy = getComputedStyle(y)
              return (
                properties.some(
                  (property) =>
                    xx.getPropertyValue(property) !==
                    yy.getPropertyValue(property),
                ) ||
                x.getBoundingClientRect().left -
                  a.getBoundingClientRect().left !==
                  y.getBoundingClientRect().left -
                    b.getBoundingClientRect().left
              )
            })
          }),
        ).toMatchInlineSnapshot(`[]`)
      }
    } finally {
      await browser.close()
    }
  })
})
