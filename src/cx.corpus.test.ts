/** Verifies benchmark composition projects against independent native styles. @module */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Corpus from '../bench/Corpus.js'
import * as Fixture from '../test/fixtures/composition.js'

describe('cx', () => {
  for (const workload of Fixture.cases) {
    test(`matches native ${workload.name} corpus styles`, async () => {
      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox'],
      })
      try {
        for (const output of ['react', 'html'] as const) {
          for (const conditional of [false, true]) {
            const page = await browser.newPage()
            for (const binding of [false, true]) {
              const compiled = Transform.compile({
                moduleId: `composition-${workload.name}.ts`,
                source: Fixture.source({
                  binding,
                  conditional,
                  output,
                  workload,
                }),
              })
              const bundled = await Esbuild.build({
                alias: {
                  'zyzz/runtime': `${process.cwd()}/src/runtime/index.ts`,
                },
                bundle: true,
                format: 'iife',
                globalName: 'App',
                stdin: {
                  contents: compiled.code,
                  loader: 'ts',
                  resolveDir: process.cwd(),
                },
                write: false,
              })
              await page.setContent(`<style>${compiled.css}</style>`)
              await page.addScriptTag({
                content: bundled.outputFiles![0]!.text,
              })
              for (const width of [450, 900]) {
                await page.setViewportSize({ height: 800, width })
                for (const enabled of [false, true]) {
                  const mismatches = await page.evaluate(
                    ({ conditional, enabled, styles, width }) => {
                      const apply = (
                        globalThis as unknown as {
                          App: {
                            apply: (
                              enabled: boolean,
                            ) => Record<string, unknown>[]
                          }
                        }
                      ).App.apply
                      const props = apply(enabled)
                      const container = document.createElement('main')
                      document.body.append(container)
                      const mismatches: string[] = []
                      for (const [index, style] of styles.entries()) {
                        const actual = document.createElement('div')
                        const native = document.createElement('div')
                        const value = props[index]!
                        actual.className = String(
                          value.className ?? value.class,
                        )
                        if (typeof value.style === 'string')
                          actual.setAttribute('style', value.style)
                        else Object.assign(actual.style, value.style)
                        Object.assign(native.style, style)
                        if (!conditional || enabled) {
                          native.style.paddingLeft = '3px'
                          native.style.color = 'rebeccapurple'
                          if (width >= 600) native.style.paddingRight = '5px'
                        }
                        container.append(actual, native)
                        const observed = getComputedStyle(actual)
                        const control = getComputedStyle(native)
                        for (const property of [
                          'backgroundColor',
                          'borderRadius',
                          'color',
                          'display',
                          'fontSize',
                          'paddingTop',
                          'paddingRight',
                          'paddingBottom',
                          'paddingLeft',
                        ] as const)
                          if (observed[property] !== control[property])
                            mismatches.push(
                              `${index}:${property}:${observed[property]} != ${control[property]}`,
                            )
                      }
                      container.remove()
                      return mismatches
                    },
                    {
                      conditional,
                      enabled,
                      styles: Corpus.styles(workload),
                      width,
                    },
                  )
                  expect(mismatches).toMatchInlineSnapshot('[]')
                }
              }
            }
            await page.close()
          }
        }
      } finally {
        await browser.close()
      }
    }, 120_000)
  }
})
