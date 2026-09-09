/** Verifies CSS keyword case without changing emitted text or token identities. @module */
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'
import { Css } from 'zyzz/web'

describe('compile', () => {
  test('case-insensitive literals retain precedence over same-spelled tokens', () => {
    const theme = Theme.define({ color: { Brand: 'blue', ReD: 'blue' } })
    const styles = Style.define(
      { card: { color: 'ReD', display: 'FlEx', padding: '2PX' } },
      { theme },
    )
    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(
      `".z_base0{color:ReD;display:FlEx;padding:2PX;}"`,
    )
  })

  test('mixed keyword, function, unit, and importance case matches native CSS', async () => {
    const styles = Style.define({
      card: {
        color: '#AbC!ImPoRtAnT',
        display: 'FlEx',
        padding: '2PX',
        transform: 'RoTaTe(45DEG)',
      },
    })
    const output = Css.compile({ styles })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><div id="actual" class="${output.classes.card}"></div><div id="control" style="color:#abc!important;display:flex;padding:2px;transform:rotate(45deg)"></div>`,
      )
      expect(
        await page.evaluate(() => {
          const actual = getComputedStyle(document.getElementById('actual')!)
          const control = getComputedStyle(document.getElementById('control')!)
          return ['color', 'display', 'padding', 'transform'].filter(
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
