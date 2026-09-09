/**
 * Verifies variable-bearing declarations through compilation and native resolution.
 * @module
 */
import * as CssTree from 'css-tree'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as Substitution from '../../test/fixtures/Substitution.js'

describe('compile', () => {
  test('variable expressions compile for every mapped property and parse independently', () => {
    for (const property of new Set(
      Conformance.cases().map((entry) => entry.property),
    )) {
      const output = Transform.compile({
        moduleId: 'variable.ts',
        source: `import { css } from 'zyzz'; css({${property}:'var(--probe)'});`,
      })
      expect(
        output.css.includes(`${Conformance.name(property)}:var(--probe)`),
      ).toMatchInlineSnapshot(`true`)
      const functions: string[] = []
      CssTree.walk(CssTree.parse(output.css), (node) => {
        if (node.type === 'Function') functions.push(node.name)
      })
      expect(functions).toMatchInlineSnapshot(`
        [
          "var",
        ]
      `)
    }
    for (const value of [
      'var(--name,)',
      'var(--name, var(--fallback, 1px))',
      'calc(1px + var(--gap))',
      'rgb(var(--channels) / .5)',
    ]) {
      const output = Transform.compile({
        moduleId: 'variable.ts',
        source: `import { css } from 'zyzz'; css({width:${JSON.stringify(value)}});`,
      })
      // Property grammar is intentionally deferred until the browser substitutes references.
      expect(output.css.includes(value)).toMatchInlineSnapshot(`true`)
    }
  })
  test('variables preserve inheritance, cycles, empty fallback, and computed-time invalidity', async () => {
    const output = Transform.compile({
      moduleId: 'variables.ts',
      source: Substitution.source,
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
        `<style>${output.css}</style><div id="parent" style="width:400px;--width:200px;--gap:20px;--fallback:blue;--pad:6px 8px"><div id="actual" class="${module.box.className}" style="color:red"></div><div id="control" style="${Substitution.control}"></div><div id="empty" class="${module.empty.className}"></div></div>`,
      )
      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"180px"`)
      expect(
        await page
          .locator('#empty')
          .evaluate((element) => getComputedStyle(element).paddingTop),
      ).toMatchInlineSnapshot(`"0px"`)
      for (const phase of ['initial', 'override', 'cycle', 'invalid']) {
        await page.evaluate((phase) => {
          const style = document.getElementById('parent')!.style
          if (phase === 'override') {
            style.setProperty('--ink', 'green')
            style.setProperty('--width', '300px')
          }
          if (phase === 'cycle') {
            style.setProperty('--ink', 'var(--loop)')
            style.setProperty('--loop', 'var(--ink)')
          }
          if (phase === 'invalid') style.setProperty('--width', 'nonsense')
        }, phase)
        expect(
          await page.evaluate(() => {
            const a = getComputedStyle(document.getElementById('actual')!)
            const b = getComputedStyle(document.getElementById('control')!)
            return [
              'color',
              'width',
              'padding-top',
              'padding-right',
              'opacity',
              'display',
            ].filter(
              (key) => a.getPropertyValue(key) !== b.getPropertyValue(key),
            )
          }),
        ).toMatchInlineSnapshot(`[]`)
      }
      expect(
        await page
          .locator('#actual')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(0, 0, 255)"`)
      const properties = [
        ...new Set(
          Conformance.cases().map((entry) => Conformance.name(entry.property)),
        ),
      ]
      expect(
        await page.evaluate(
          (properties) =>
            properties.filter(
              (property) =>
                CSS.supports(property, 'initial') !==
                CSS.supports(property, 'var(--probe)'),
            ),
          properties,
        ),
      ).toMatchInlineSnapshot(`[]`)
    } finally {
      await browser.close()
    }
  })
})
