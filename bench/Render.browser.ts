/**
 * Measures equivalent production React mounts and updates in a real browser.
 * @module
 */
import { expect, test } from 'vite-plus/test'
import { server } from 'vite-plus/test/browser'
import type * as Render from './Render.js'
import type * as RenderFixture from './RenderFixture.js'

const commands = server.commands as typeof server.commands & {
  prepareRender: (options: Render.Options) => Promise<string>
  saveRender: (
    groups: readonly Render.Group[],
    userAgent: string,
  ) => Promise<void>
}

test('production React mount, update, and remount', async () => {
  const groups: Render.Group[] = []

  for (const components of [100, 1000])
    for (const kind of [
      'callable',
      'overrides',
      'dynamic',
      'variants',
    ] as const)
      for (const pass of [1, 2]) {
        const libraries =
          kind === 'dynamic'
            ? (['baseline', 'zyzz'] as const)
            : kind === 'variants'
              ? (['baseline', 'panda', 'stylex', 'zyzz'] as const)
              : ([
                  'baseline',
                  'panda',
                  'stylex',
                  'tailwind',
                  'vanilla-extract',
                  'zyzz',
                ] as const)

        for (const library of pass === 1
          ? libraries
          : [...libraries].reverse()) {
          const options = { components, count: components / 10, kind, library }
          const html = await commands.prepareRender(options)
          const iframe = document.createElement('iframe')

          iframe.style.cssText =
            'width:1200px;height:900px;border:0;display:block'

          const loaded = new Promise<void>((resolve, reject) => {
            iframe.onload = () => resolve()
            iframe.onerror = () => reject(new Error('Fixture load failed'))
          })

          iframe.srcdoc = html
          document.body.append(iframe)

          try {
            await loaded

            const fixture = (
              iframe.contentWindow as unknown as {
                renderFixture: ReturnType<typeof RenderFixture.create>
              }
            ).renderFixture

            for (let warmup = 0; warmup < 3; warmup++) await fixture.cycle()

            const samples: RenderFixture.Sample[] = []

            for (let sample = 0; sample < 20; sample++)
              samples.push(...(await fixture.cycle()))

            function count(rules: CSSRuleList): number {
              return [...rules].reduce(
                (total, rule) =>
                  total +
                  (rule.type === CSSRule.STYLE_RULE ? 1 : 0) +
                  ('cssRules' in rule
                    ? count((rule as CSSGroupingRule).cssRules)
                    : 0),
                0,
              )
            }
            const styleRules = [...iframe.contentDocument!.styleSheets].reduce(
              (total, sheet) => total + count(sheet.cssRules),
              0,
            )
            groups.push({ ...options, pass, samples, styleRules })
            fixture.dispose()
            await commands.saveRender(groups, navigator.userAgent)
          } finally {
            iframe.remove()
          }
        }
      }

  expect(groups.length).toMatchInlineSnapshot(`72`)
})
