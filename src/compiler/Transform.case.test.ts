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

  test('whitespace and importance preserve authored literal data', () => {
    const styles = Style.define({
      card: { color: ' ReD\t! ImPoRtAnT  ', display: ' FlEx\t' },
    })
    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(
      `".z_base0{color: ReD!important;display: FlEx	;}"`,
    )
  })

  test('mixed keyword, function, unit, numeric, and importance spellings match native CSS', async () => {
    const styles = Style.define({
      card: {
        color: ' #AbC\t! ImPoRtAnT  ',
        display: ' FlEx\t',
        height: '+.5px',
        margin: '-0px',
        order: '+01!',
        padding: '2PX',
        transform: 'RoTaTe(45DEG)',
        width: '1e2px',
      },
    })
    const output = Css.compile({ styles })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><div id="actual" class="${output.classes.card}"></div><div id="control" style="color:#abc!important;display:flex;height:.5px;margin:0;order:1!important;padding:2px;transform:rotate(45deg);width:100px"></div>`,
      )
      expect(
        await page.evaluate(() => {
          const actual = getComputedStyle(document.getElementById('actual')!)
          const control = getComputedStyle(document.getElementById('control')!)
          return [
            'color',
            'display',
            'height',
            'margin',
            'order',
            'padding',
            'transform',
            'width',
          ].filter(
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
