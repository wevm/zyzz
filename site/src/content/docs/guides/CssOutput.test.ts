/** Compiles the CSS Output guide's examples and verifies its documented output. @module */
import * as Fs from 'node:fs'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

const source = Fs.readFileSync(
  new URL('./css-output.mdx', import.meta.url),
  'utf8',
)

// The independent `id` example compiles separately, since its theme scope would join the card's output.
const { 'admin.config.ts': admin, ...modules } = Object.fromEntries(
  [...source.matchAll(/```tsx? title="([^"\n]+)"\n([\s\S]*?)```/g)].map(
    (match) => [match[1]!, match[2]!],
  ),
)

/** Reads a titled CSS fence and lists its rules. */
function documented(title: string): readonly string[] {
  return rules(
    source.match(
      new RegExp('```css title="' + title + '"\\n([\\s\\S]*?)```'),
    )![1]!,
  )
}

/** Lists the rules in CSS without comments, whitespace, or final semicolons. */
function rules(css: string): readonly string[] {
  return (
    css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, '')
      .replaceAll(';}', '}')
      .match(/[^{};]+\{[^{}]*\}/g) ?? []
  )
}

describe('CSS Output examples', () => {
  test('compiles the documented output in both modes', () => {
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

      expect(rules(card.css), cssOutput).toEqual(documented(`${cssOutput}.css`))
      if (cssOutput === 'atomic')
        expect(Object.values(card.classes)).toEqual(
          Array.from(
            modules['Card.tsx']!.matchAll(/\/\/ Atomic classes: (.+)/g),
            (match) => match[1],
          ),
        )
      expect(
        output.modules['CompactCard.tsx']!.css.includes('padding:4px;'),
      ).toMatchInlineSnapshot('true')
      expect(
        output.modules['CompactCard.tsx']!.code.includes('zyzz/runtime'),
      ).toMatchInlineSnapshot('true')
    }

    expect(
      Object.keys(
        Graph.compile({ modules: { 'admin.config.ts': admin! } }).modules,
      ),
    ).toMatchInlineSnapshot(`
      [
        "admin.config.ts",
      ]
    `)
  })

  test('renders the authored card in both modes', async () => {
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
      }
    } finally {
      await browser.close()
    }
  })
})
