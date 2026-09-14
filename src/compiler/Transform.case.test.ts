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
      `
      ".z-text-ReD{color:ReD;}
      .z-display-FlEx{display:FlEx;}
      .z-p-2PX{padding:2PX;}"
    `,
    )
  })

  test('whitespace and importance preserve authored literal data', () => {
    const styles = Style.define({
      card: { color: ' ReD\t! ImPoRtAnT  ', display: 'BlOcK\tFlow' },
    })

    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(
      `
      ".z-text-qE5SPZ{color: ReD!important;}
      .z-display-eWlMBL{display:BlOcK	Flow;}"
    `,
    )
  })

  test('escaped literals and commented importance retain native token semantics', async () => {
    const theme = Theme.define({ color: { '\\72 ed': 'blue' } })

    const styles = Style.define(
      {
        card: {
          color: '\\72 ed/**/!impor\\74 ant/**/',
          display: 'bl\\6f ck/**/flow',
          padding: '1\\70 x',
        },
      },
      { theme },
    )

    const output = Css.compile({ styles })

    expect(output.css).toMatchInlineSnapshot(
      `
      ".z-text-YkAuMI{color:\\72 ed/**/!important;}
      .z-display-gFmu41{display:bl\\6f ck/**/flow;}
      .z-p-m_OXFT{padding:1\\70 x;}"
    `,
    )

    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${output.css}</style><div id="actual" class="${output.classes.card}"></div><div id="control" style="color:red!important;display:block flow;padding:1px"></div>`,
      )

      expect(
        await page.evaluate(() => {
          const actual = getComputedStyle(document.getElementById('actual')!)
          const control = getComputedStyle(document.getElementById('control')!)

          return ['color', 'display', 'padding'].filter(
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

  test('mixed keyword, function, unit, numeric, and importance spellings match native CSS', async () => {
    const styles = Style.define({
      card: {
        color: ' #AbC\t! ImPoRtAnT  ',
        display: 'BlOcK\tFlow',
        gridColumnEnd: 'span +01',
        height: '+.5PX',
        margin: '-0px',
        order: '+01!',
        padding: ['2PX', '0e3!'],
        transform: 'RoTaTe(45DEG)',
        width: '1e2px',
      },
    })

    const output = Css.compile({ styles })
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${output.css}</style><div id="actual" class="${output.classes.card}"></div><div id="control" style="color:#abc!important;display:block flow;grid-column-end:span 1;height:.5px;margin:0;order:1!important;padding:0!important;transform:rotate(45deg);width:100px"></div>`,
      )

      expect(
        await page.evaluate(() => {
          const actual = getComputedStyle(document.getElementById('actual')!)
          const control = getComputedStyle(document.getElementById('control')!)

          return [
            'color',
            'display',
            'grid-column-end',
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
