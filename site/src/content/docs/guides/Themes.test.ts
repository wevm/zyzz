/** Verifies the themes guide examples through source compilation and browser scopes. @module */
import * as Fs from 'node:fs/promises'
import * as Vm from 'node:vm'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import * as Packed from '../../../../../test/fixtures/Packed.js'

const document = await Fs.readFile(
  new URL('./themes.mdx', import.meta.url),
  'utf8',
)
const examples = Object.fromEntries(
  [...document.matchAll(/```tsx? title="([^"]+)"\n([\s\S]*?)```/g)].map(
    (match) => [match[1]!, match[2]!],
  ),
)

describe('themes guide', () => {
  test('compiles every configured source example', async () => {
    const defaults = Graph.compile({
      modules: {
        'default.ts': await Fs.readFile(
          new URL('../../../../../src/default.ts', import.meta.url),
          'utf8',
        ),
      },
    })

    const result = Graph.compile({
      contracts: { 'default.ts': defaults.contracts['default.ts']! },
      imports: Object.fromEntries(
        Object.entries(examples).map((entry) => [
          entry[0],
          Object.fromEntries(
            [...entry[1].matchAll(/from '([^']+)'/g)].map((match) => {
              const specifier = match[1]!
              if (specifier === 'zyzz/default') return [specifier, 'default.ts']
              if (!specifier.startsWith('./')) return [specifier, null]

              const extension = specifier === './Card.js' ? '.tsx' : '.ts'
              return [specifier, specifier.slice(2).replace(/\.js$/, extension)]
            }),
          ),
        ]),
      ),
      modules: Object.fromEntries(
        Object.entries(examples).filter((entry) => entry[0] !== 'compile.ts'),
      ),
    })

    expect(Object.keys(result.modules).length).toMatchInlineSnapshot('11')
    expect(
      result.modules['Card.tsx']!.css.includes('var(--'),
    ).toMatchInlineSnapshot('true')
    expect(
      (
        (result.sharedCss ?? '') + result.modules['responsive.config.ts']!.css
      ).includes('72rem'),
    ).toMatchInlineSnapshot('true')
    expect(
      result.modules['DefaultCard.tsx']!.css.includes('font-size:var('),
    ).toMatchInlineSnapshot('true')
  })

  test('resolves documented nested scopes and schemes in a browser', async () => {
    const result = Graph.compile({
      modules: {
        'zyzz.config.ts': examples['zyzz.config.ts']!,
        'app.ts': `import { style, vars } from './zyzz.config.js'
          export const base = vars({ colorScheme: 'light' })
          export const alternate = vars({ set: 'alternate' })
          export const nested = vars({ set: 'base' })
          export const dark = vars({ set: 'alternate', colorScheme: 'dark' })
          export const defaultSet = vars()
          export const card = style({ backgroundColor: 'surface', color: 'foreground', padding: 'page' })
          export const title = style({ color: 'accent' })`,
      },
    })
    const code = await Packed.bundle({
      entry: 'app.ts',
      modules: Object.fromEntries(
        Object.entries(result.modules).map((entry) => [
          entry[0],
          entry[1].code,
        ]),
      ),
    })
    const fixture = Vm.runInNewContext(`${code};Fixture;`)
    const css =
      (result.sharedCss ?? '') +
      Object.values(result.modules)
        .map((module) => module.css)
        .join('')
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()
      const card = `<article data-example class="${fixture.card().className}"><h2 class="${fixture.title().className}">Account</h2></article>`

      await page.setContent(`<style>${css}</style>
        <main class="${fixture.base.className}">${card}
          <section class="${fixture.alternate.className}">${card}
            <section class="${fixture.nested.className}">${card}</section>
            <section class="${fixture.defaultSet.className}">${card}</section>
          </section>
          <section class="${fixture.dark.className}">${card}</section>
        </main>`)

      expect(
        await page.locator('[data-example]').evaluateAll((nodes) =>
          nodes.map((node) => {
            const style = getComputedStyle(node)
            return [
              style.color,
              style.backgroundColor,
              style.padding,
              getComputedStyle(node.querySelector('h2')!).color,
            ]
          }),
        ),
      ).toMatchInlineSnapshot(`
        [
          [
            "rgb(23, 23, 23)",
            "rgb(255, 255, 255)",
            "24px",
            "rgb(37, 99, 235)",
          ],
          [
            "rgb(23, 23, 23)",
            "rgb(255, 255, 255)",
            "32px",
            "rgb(147, 51, 234)",
          ],
          [
            "rgb(23, 23, 23)",
            "rgb(255, 255, 255)",
            "24px",
            "rgb(37, 99, 235)",
          ],
          [
            "rgb(23, 23, 23)",
            "rgb(255, 255, 255)",
            "24px",
            "rgb(37, 99, 235)",
          ],
          [
            "rgb(250, 250, 250)",
            "rgb(23, 23, 23)",
            "32px",
            "rgb(147, 51, 234)",
          ],
        ]
      `)
    } finally {
      await browser.close()
    }
  })
})
