/** Exercises custom-property spelling, data, fallbacks, and browser inheritance. @module */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const source = `import { css } from 'zyzz';
export const parent = css({'--Accent':'red', '--accent':'blue', '--data':'"a;b:c"', '--count':2})();
export const child = css({all:'initial', color:'var(--Accent)', backgroundColor:'var(--accent)', '--choice':['red','blue!']})();`

describe('compile', () => {
  test('preserves case-sensitive names and custom declaration data', () => {
    const output = Transform.compile({ moduleId: 'custom.ts', source })
    expect(output.css).toMatchInlineSnapshot(`
      ".z-nhoi651v8vyx9-base0{--Accent:red;--accent:blue;--data:"a;b:c";--count:2;}
      .z-nhoi651v8vyx9-base1{all:initial;color:var(--Accent);background-color:var(--accent);--choice:red;--choice:blue!important;}"
    `)
  })

  test('all preserves inherited custom properties and direction', async () => {
    const output = Transform.compile({ moduleId: 'custom.ts', source })
    const javascript = await Esbuild.transform(output.code, {
      format: 'esm',
      loader: 'ts',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(javascript.code).toString('base64')}`
    )
    const classes = ['parent', 'child'].map(
      (name) => module[name].className as string,
    )
    expect(classes.length).toMatchInlineSnapshot(`2`)
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><div class="${classes[0]}" dir="rtl"><div id="child" class="${classes[1]}"></div></div>`,
      )
      const result = await page.locator('#child').evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          accent: style.getPropertyValue('--Accent'),
          background: style.backgroundColor,
          choice: style.getPropertyValue('--choice'),
          color: style.color,
          direction: style.direction,
        }
      })
      expect(result).toMatchInlineSnapshot(`
        {
          "accent": "red",
          "background": "rgb(0, 0, 255)",
          "choice": "blue",
          "color": "rgb(255, 0, 0)",
          "direction": "rtl",
        }
      `)
    } finally {
      await browser.close()
    }
  })
})
