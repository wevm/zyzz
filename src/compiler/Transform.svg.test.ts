/**
 * Verifies SVG paint compilation, source mapping, and native path geometry.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Svg from '../../test/fixtures/Svg.js'

describe('compile', () => {
  test('SVG paint preserves tokens, fallbacks, importance, and source maps', () => {
    const output = Transform.compile({ moduleId: 'svg.ts', source: Svg.source })
    expect(output.css.match(/fill-rule:[^;}]+/g)).toMatchInlineSnapshot(`
      [
        "fill-rule:nonzero",
        "fill-rule:evenodd!important",
      ]
    `)
    expect(output.css.includes('color_2e_ink,#06c)')).toMatchInlineSnapshot(
      `true`,
    )
    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('fill-rule:evenodd!important'),
    )
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('fill-rule:evenodd!important'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 78,
        "line": 3,
        "name": "fillRule",
        "source": "svg.ts",
      }
    `)
  })

  test('SVG paint matches browser declarations and evenodd geometry', async () => {
    const output = Transform.compile({ moduleId: 'svg.ts', source: Svg.source })
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
      const path = 'M0 0H100V100H0Z M25 25H75V75H25Z'
      await page.setContent(
        `<style>${output.css}</style><svg width="300" height="120"><path id="actual" d="${path}" class="${module.paint.className}"/><path id="control" d="${path}" style="${Svg.controls.paint}" transform="translate(120 0)"/><filter><feFlood id="flood" class="${module.filter.className}"/><feFlood id="flood-control" style="${Svg.controls.filter}"/></filter></svg>`,
      )
      expect(
        await page.evaluate(() => {
          const actual = getComputedStyle(document.getElementById('actual')!)
          const control = getComputedStyle(document.getElementById('control')!)
          return [
            'fill',
            'fill-opacity',
            'fill-rule',
            'stroke',
            'stroke-width',
            'stroke-opacity',
            'stroke-linecap',
            'stroke-linejoin',
            'stroke-miterlimit',
            'stroke-dashoffset',
            'clip-rule',
            'paint-order',
            'shape-rendering',
            'text-rendering',
            'vector-effect',
          ].filter(
            (property) =>
              actual.getPropertyValue(property) !==
              control.getPropertyValue(property),
          )
        }),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) =>
            (element as SVGGeometryElement).isPointInFill(new DOMPoint(50, 50)),
          ),
      ).toMatchInlineSnapshot(`false`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) =>
            (element as SVGGeometryElement).isPointInFill(new DOMPoint(10, 10)),
          ),
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).fill),
      ).toMatchInlineSnapshot(`"rgb(0, 102, 204)"`)
      expect(
        await page.evaluate(() => {
          const actual = getComputedStyle(document.getElementById('flood')!)
          const control = getComputedStyle(
            document.getElementById('flood-control')!,
          )
          return [
            'flood-color',
            'flood-opacity',
            'lighting-color',
            'color-interpolation-filters',
          ].filter(
            (property) =>
              actual.getPropertyValue(property) !==
              control.getPropertyValue(property),
          )
        }),
      ).toMatchInlineSnapshot(`[]`)
    } finally {
      await browser.close()
    }
  })
})
