/** Exercises explicit CSS representations through the public compiler. @module */
import { describe, expect, test } from 'vite-plus/test'
import { chromium } from 'playwright'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

describe('compile', () => {
  test('keeps mounted classes valid across development value edits', async () => {
    const browser = await chromium.launch({ headless: true })

    try {
      const page = await browser.newPage()

      for (const [cssOutput, composition] of [
        ['atomic', 'ordered'],
        ['atomic', 'independent'],
        ['grouped', 'ordered'],
        ['grouped', 'independent'],
      ] as const) {
        const before = Css.compile({
          composition,
          cssOutput,
          development: true,
          styles: Style.define({
            card: { color: 'red', padding: '8px' },
            label: { color: 'red', padding: '8px' },
          }),
        })
        const after = Css.compile({
          composition,
          cssOutput,
          development: true,
          styles: Style.define({
            card: { color: 'blue', padding: '12px' },
            label: { color: 'red', padding: '8px' },
          }),
        })

        await page.setContent(
          `<style>${before.css}</style><div class="${before.classes.card}">Card</div><div class="${before.classes.label}">Label</div>`,
        )
        await page.locator('style').evaluate((element, css) => {
          element.textContent = css
        }, after.css)

        expect(
          await page
            .locator('div')
            .first()
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
        expect(
          await page
            .locator('div')
            .first()
            .evaluate((element) => getComputedStyle(element).paddingLeft),
        ).toMatchInlineSnapshot('"12px"')
        expect(
          await page
            .locator('div')
            .nth(1)
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
        expect(
          await page
            .locator('div')
            .nth(1)
            .evaluate((element) => getComputedStyle(element).paddingLeft),
        ).toMatchInlineSnapshot('"8px"')
      }
    } finally {
      await browser.close()
    }
  })

  test('defaults to atomic declarations and shares repeated properties', () => {
    const styles = Style.define({
      card: { color: 'red', padding: '8px' },
      label: { color: 'red' },
    })

    const output = Css.compile({ styles })
    const atomic = Css.compile({ cssOutput: 'atomic', styles })
    const grouped = Css.compile({ cssOutput: 'grouped', styles })

    expect(output).toEqual(atomic)
    expect(output.classes.card.split(' ')).toHaveLength(2)
    expect(output.classes.card.split(' ')).toContain(output.classes.label)
    expect(output.css.match(/color:red;/g)).toHaveLength(1)
    expect(grouped.classes.card.split(' ')).toHaveLength(1)
    expect(grouped.css).toContain('{color:red;padding:8px;}')
    expect(grouped.css.match(/color:red;/g)).toHaveLength(2)
    expect(Css.compile({ styles })).toEqual(output)
  })

  test('retains fallback sequences, importance, and stylesheet contributions', () => {
    const styles = Style.define({
      card: { display: ['block', 'grid!'], color: 'red' },
    })
    const contributions: readonly Css.Contribution[] = [
      {
        kind: 'rule',
        selector: 'body',
        style: Style.define({ body: { margin: 0 } }).styles[0]!,
      },
    ]

    for (const cssOutput of ['atomic', 'grouped'] as const) {
      const output = Css.compile({ contributions, cssOutput, styles })

      expect(output.css).toContain('display:block;display:grid!important;')
      expect(output.contributionCss).toContain('body{margin:0;}')
      expect(output.css).toContain('color:red;')
    }
  })
})
