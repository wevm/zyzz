/** Exercises explicit CSS representations through the public compiler. @module */
import { describe, expect, test } from 'vite-plus/test'
import { chromium } from 'playwright'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

describe('compile', () => {
  test('keeps mounted classes valid across declaration value edits', async () => {
    const browser = await chromium.launch({ headless: true })

    try {
      const page = await browser.newPage()

      for (const cssOutput of ['atomic', 'grouped'] as const) {
        const before = Css.compile({
          cssOutput,
          styles: Style.define({ card: { color: 'red', padding: '8px' } }),
        })
        const after = Css.compile({
          cssOutput,
          styles: Style.define({ card: { color: 'blue', padding: '12px' } }),
        })

        await page.setContent(
          `<style>${before.css}</style><div class="${before.classes.card}">Card</div>`,
        )
        await page.locator('style').evaluate((element, css) => {
          element.textContent = css
        }, after.css)

        expect(
          await page
            .locator('div')
            .evaluate((element) => getComputedStyle(element).color),
        ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
        expect(
          await page
            .locator('div')
            .evaluate((element) => getComputedStyle(element).paddingLeft),
        ).toMatchInlineSnapshot('"12px"')
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

    expect(output).toMatchInlineSnapshot(`
      {
        "classes": {
          "card": "z_base-color-11hsk3q1tuqfr0 z_base-padding-11rs5sp1tuqfr1",
          "label": "z_base-color-11hsk3q1tuqfr0",
        },
        "css": ".z_base-color-11hsk3q1tuqfr0{color:red;}
      .z_base-padding-11rs5sp1tuqfr1{padding:8px;}",
        "themes": {},
      }
    `)
    expect(atomic).toMatchInlineSnapshot(`
      {
        "classes": {
          "card": "z_base-color-11hsk3q1tuqfr0 z_base-padding-11rs5sp1tuqfr1",
          "label": "z_base-color-11hsk3q1tuqfr0",
        },
        "css": ".z_base-color-11hsk3q1tuqfr0{color:red;}
      .z_base-padding-11rs5sp1tuqfr1{padding:8px;}",
        "themes": {},
      }
    `)
    expect(grouped).toMatchInlineSnapshot(`
      {
        "classes": {
          "card": "g-card",
          "label": "g-label",
        },
        "css": ".g-card{color:red;padding:8px;}
      .g-label{color:red;}",
        "themes": {},
      }
    `)
    expect(Css.compile({ styles })).toMatchInlineSnapshot(`
      {
        "classes": {
          "card": "z_base-color-11hsk3q1tuqfr0 z_base-padding-11rs5sp1tuqfr1",
          "label": "z_base-color-11hsk3q1tuqfr0",
        },
        "css": ".z_base-color-11hsk3q1tuqfr0{color:red;}
      .z_base-padding-11rs5sp1tuqfr1{padding:8px;}",
        "themes": {},
      }
    `)
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

      if (cssOutput === 'atomic')
        expect(output.css).toMatchInlineSnapshot(`
        "body{margin:0;}
        .z_base-display-11hsk3q1tuqfr0{display:block;display:grid!important;}
        .z_base-color-11rs5sp1tuqfr1{color:red;}"
      `)
      else
        expect(output.css).toMatchInlineSnapshot(`
        "body{margin:0;}
        .g-card{display:block;display:grid!important;color:red;}"
      `)
      expect(output.contributionCss).toMatchInlineSnapshot(`"body{margin:0;}"`)
    }
  })
})
