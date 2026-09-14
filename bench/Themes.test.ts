/**
 * Verifies real compiler artifacts and browser parity across theme scopes and schemes.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Vm from 'node:vm'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import * as Themes from './Themes.js'

describe('create', () => {
  test('token-name resolution retains identical CSS and JavaScript delivery', async () => {
    const fixture = await Themes.create(10)

    try {
      const explicit = await Themes.zyzz(fixture)
      const named = await Themes.zyzzTokens(fixture)

      expect(named.css === explicit.css).toMatchInlineSnapshot('true')
      expect(named.javascript === explicit.javascript).toMatchInlineSnapshot(
        'true',
      )
    } finally {
      await Fs.rm(fixture.directory, { force: true, recursive: true })
    }
  })

  test('real theme adapters emit executable exports and nonempty stylesheets', async () => {
    const fixture = await Themes.create(10)
    const other = await Themes.create(10)

    try {
      for (const [library, compile] of Object.entries(Themes.compilers)) {
        const bundle = await compile(fixture)
        const repeated = await compile(other)

        expect(repeated.css === bundle.css, library).toMatchInlineSnapshot(
          'true',
        )
        expect(
          repeated.javascript === bundle.javascript,
          library,
        ).toMatchInlineSnapshot('true')
        expect(bundle.css.length > 0, library).toMatchInlineSnapshot('true')

        const output = Vm.runInNewContext(`${bundle.javascript};fixture;`) as {
          classes: string[]
          themes: Record<string, Record<string, string>>
        }

        expect(output.classes.length, library).toMatchInlineSnapshot('10')
        expect(Object.keys(output.themes), library).toMatchInlineSnapshot(`
          [
            "alternate",
            "base",
          ]
        `)
      }
    } finally {
      await Fs.rm(fixture.directory, { force: true, recursive: true })
      await Fs.rm(other.directory, { force: true, recursive: true })
    }
  })

  test('a caller profile reaches every real compiler without changing their exports', async () => {
    const modern = await Themes.create(10, { targets: { chrome: 123 << 16 } })
    const baseline = await Themes.create(10)

    try {
      for (const [library, compile] of Object.entries(Themes.compilers)) {
        const current = await compile(modern)
        const original = await compile(baseline)

        expect(
          current.css.includes('light-dark('),
          library,
        ).toMatchInlineSnapshot('true')
        expect(
          original.css.includes('light-dark('),
          library,
        ).toMatchInlineSnapshot('true')
        expect(
          original.javascript === current.javascript,
          library,
        ).toMatchInlineSnapshot('true')
      }
    } finally {
      await Fs.rm(baseline.directory, { force: true, recursive: true })
      await Fs.rm(modern.directory, { force: true, recursive: true })
    }
  })

  test('targets that lower inherited scheme selection are rejected', async () => {
    await expect(
      Themes.create(10, { targets: { chrome: 120 << 16 } }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Theme benchmarks require targets with native light-dark() support.]`,
    )
  })

  for (const count of [10, 100]) {
    test(`theme scopes, nesting, and schemes agree in Chromium / ${count} styles`, async () => {
      const fixture = await Themes.create(count)
      const browser = await chromium.launch()

      try {
        for (const [library, compile] of Object.entries(Themes.compilers)) {
          const bundle = await compile(fixture)
          const page = await browser.newPage({ colorScheme: 'light' })

          try {
            await page.setContent(
              `<style>:root{color-scheme:light dark}${bundle.css}</style>`,
            )
            await page.addScriptTag({ content: bundle.javascript })
            await page.evaluate(() => {
              type Exports = {
                classes: string[]
                themes: Record<'alternate' | 'base', Record<string, string>>
              }

              const output = (window as unknown as { fixture: Exports }).fixture

              function scope(
                name: 'alternate' | 'base',
                parent: HTMLElement,
                id: string,
              ) {
                const element = document.createElement('section')

                element.id = id

                for (const [key, value] of Object.entries(output.themes[name]))
                  element.setAttribute(
                    key === 'className' ? 'class' : key,
                    value,
                  )

                parent.append(element)

                for (const className of output.classes) {
                  const card = document.createElement('div')

                  card.className = className
                  element.append(card)
                }

                return element
              }

              scope('base', document.body, 'base')

              const alternate = scope('alternate', document.body, 'alternate')

              scope('base', alternate, 'nested')
              scope('alternate', document.body, 'forced').style.colorScheme =
                'dark'
            })

            async function read(id: string) {
              return page
                .locator(`#${id} > div`)
                .first()
                .evaluate((element) => {
                  const style = getComputedStyle(element)

                  return {
                    backgroundColor: style.backgroundColor,
                    color: style.color,
                    padding: style.padding,
                  }
                })
            }

            expect(await read('base'), library).toMatchInlineSnapshot(`
              {
                "backgroundColor": "rgb(255, 255, 255)",
                "color": "rgb(17, 17, 17)",
                "padding": "8px",
              }
            `)
            expect(await read('alternate'), library).toMatchInlineSnapshot(`
              {
                "backgroundColor": "rgb(238, 238, 238)",
                "color": "rgb(0, 102, 204)",
                "padding": "16px",
              }
            `)
            expect(await read('nested'), library).toMatchInlineSnapshot(`
              {
                "backgroundColor": "rgb(255, 255, 255)",
                "color": "rgb(17, 17, 17)",
                "padding": "8px",
              }
            `)
            expect(await read('forced'), library).toMatchInlineSnapshot(`
              {
                "backgroundColor": "rgb(34, 34, 34)",
                "color": "rgb(153, 204, 255)",
                "padding": "16px",
              }
            `)
            expect(
              await page
                .locator('#base > div')
                .evaluateAll((elements) =>
                  elements.flatMap((element, index) =>
                    getComputedStyle(element).width === `${index}px`
                      ? []
                      : [index],
                  ),
                ),
              library,
            ).toMatchInlineSnapshot('[]')

            await page.emulateMedia({ colorScheme: 'dark' })

            expect(await read('base'), library).toMatchInlineSnapshot(`
              {
                "backgroundColor": "rgb(17, 17, 17)",
                "color": "rgb(255, 255, 255)",
                "padding": "8px",
              }
            `)
            expect(await read('alternate'), library).toMatchInlineSnapshot(`
              {
                "backgroundColor": "rgb(34, 34, 34)",
                "color": "rgb(153, 204, 255)",
                "padding": "16px",
              }
            `)

            // Selection changes attributes only. The same compiled component classes remain.
            await page.locator('#alternate').evaluate((element) => {
              const output = (
                window as unknown as {
                  fixture: { themes: { base: Record<string, string> } }
                }
              ).fixture

              element.removeAttribute('class')
              element.removeAttribute('data-panda-theme')

              for (const [key, value] of Object.entries(output.themes.base))
                element.setAttribute(key === 'className' ? 'class' : key, value)
            })

            expect(await read('alternate'), library).toMatchInlineSnapshot(`
              {
                "backgroundColor": "rgb(17, 17, 17)",
                "color": "rgb(255, 255, 255)",
                "padding": "8px",
              }
            `)
          } finally {
            await page.close()
          }
        }
      } finally {
        await browser.close()
        await Fs.rm(fixture.directory, { force: true, recursive: true })
      }
    }, 180_000)
  }
})
