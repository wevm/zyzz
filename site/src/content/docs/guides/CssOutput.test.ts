/** Compiles the CSS Output guide's examples and renders both representations. @module */
import * as Fs from 'node:fs'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

const source = Fs.readFileSync(
  new URL('./css-output.mdx', import.meta.url),
  'utf8',
)

const modules = Object.fromEntries(
  [...source.matchAll(/```tsx? title="([^"\n]+)"\n([\s\S]*?)```/g)].map(
    (match) => [match[1]!, match[2]!],
  ),
)

describe('CSS Output examples', () => {
  test('compiles and renders the authored card in both modes', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      for (const cssOutput of ['atomic', 'grouped']) {
        const output = Graph.compile({
          modules: {
            ...modules,
            'zyzz.config.ts': modules['zyzz.config.ts']!.replace(
              "'grouped'",
              `'${cssOutput}'`,
            ),
          },
        })
        const card = output.modules['Card.tsx']!
        const classes = Object.values(card.classes)

        await page.setContent(
          `<style>${card.css}</style><article class="${classes[0]}"><span class="${classes[1]}">Account</span></article>`,
        )

        expect(
          await page
            .locator('article')
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
        expect(
          await page
            .locator('article')
            .evaluate((element) => getComputedStyle(element).padding),
        ).toMatchInlineSnapshot('"8px"')
        expect(
          await page
            .locator('span')
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
        expect(
          output.modules['CompactCard.tsx']!.css.includes('padding:4px;'),
        ).toMatchInlineSnapshot('true')
        expect(
          output.modules['CompactCard.tsx']!.code.includes('zyzz/runtime'),
        ).toMatchInlineSnapshot('true')
      }
    } finally {
      await browser.close()
    }
  })
})
