/** Exercises custom-property spelling, data, fallbacks, and browser inheritance. @module */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'
import { Transform } from 'zyzz/compiler'

const source = `import { css } from 'zyzz';
export const parent = css({'--Accent':'red', '--accent':'blue', '--data':'"a;b:c"', '--count':2})();
export const child = css({all:'initial', color:'var(--Accent)', backgroundColor:'var(--accent)', '--choice':['red','blue!']})();`

describe('compile', () => {
  test('preserves case-sensitive names and custom declaration data', () => {
    const output = Transform.compile({ moduleId: 'custom.ts', source })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-_5f_2d_5f__5f_2d_5f_Accent-red-laDu-r{--Accent:red;}
      .z-_5f_2d_5f__5f_2d_5f_accent-blue-laDu-r{--accent:blue;}
      .z-_5f_2d_5f__5f_2d_5f_data-KaMmas{--data:"a;b:c";}
      .z-_5f_2d_5f__5f_2d_5f_count-2-laDu-r{--count:2;}
      .z-all-initial-N2sItM-0{all:initial;}
      .z-text-UlwebV-1{color:var(--Accent);}
      .z-bg-x-R_B0-2{background-color:var(--accent);}
      .z-_5f_2d_5f__5f_2d_5f_choice-8VmRzn{--choice:red;--choice:blue!important;}"
    `)
  })

  test('escaped punctuation retains custom-property data and importance', () => {
    const styles = Style.define({
      punctuation: {
        '--escaped': 'hello\\!',
        '--escapedWord': 'hello\\!important',
        '--even': 'hello\\\\!',
        '--space': 'hello\\ !',
      },
    })

    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(
      `
      ".z-_5f_2d_5f__5f_2d_5f_escaped-tMe2BH{--escaped:hello\\!;}
      .z-_5f_2d_5f__5f_2d_5f_escapedWord-l-_WbH{--escapedWord:hello\\!important;}
      .z-_5f_2d_5f__5f_2d_5f_even-p0VvrW{--even:hello\\\\!important;}
      .z-_5f_2d_5f__5f_2d_5f_space-U35CMT{--space:hello\\ !important;}"
    `,
    )
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
