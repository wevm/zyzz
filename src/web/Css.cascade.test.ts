/** Compares both CSS representations with independent browser cascade controls. @module */
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

describe('compile', () => {
  test('retains reset sequences, conditions, and raw composition in both modes', async () => {
    const first = Style.define({ first: { padding: '8px', color: 'red' } })
      .styles[0]!
    const middle = Style.define({
      middle: { paddingLeft: '2px', all: 'initial' },
    }).styles[0]!
    const styles: Style.Definition = {
      styles: [
        {
          name: 'repeated',
          declarations: [
            ...first.declarations,
            ...middle.declarations,
            ...first.declarations,
          ],
        },
        ...Style.define({
          logical: {
            padding: '8px',
            paddingInlineStart: '3px',
            paddingLeft: '5px',
          },
          condition: {
            color: 'red',
            '@media (min-width: 100px)': { color: 'blue', padding: '8px' },
            '@supports (display: grid)': { color: 'green', paddingLeft: '2px' },
            '&:hover': { color: 'purple' },
          },
          a: { color: 'red' },
          b: { color: 'blue' },
          c: { color: 'red' },
        }).styles,
      ],
    }
    const controls =
      '.repeated{padding:8px;color:red;padding-left:2px;all:initial;padding:8px;color:red}.logical{padding:8px;padding-inline-start:3px;padding-left:5px}.condition{color:red;@media(min-width:100px){color:blue;padding:8px}@supports(display:grid){color:green;padding-left:2px}&:hover{color:purple}}.a{color:red}.b{color:blue}.c{color:red}'
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()
      for (const cssOutput of ['atomic', 'grouped'] as const) {
        for (const composition of ['ordered', 'independent'] as const) {
          const output = Css.compile({ composition, cssOutput, styles })
          await page.setContent(`<style>${controls}\n${output.css}</style>`)
          for (const direction of ['ltr', 'rtl']) {
            const differences = await page.evaluate(
              ({ classes, composition, direction }) => {
                document.body.style.direction = direction
                const groups = [
                  ['repeated'],
                  ['logical'],
                  ['condition'],
                  ...(composition === 'ordered' ? [['a', 'b', 'c']] : []),
                ]
                return groups.flatMap((names) => {
                  const values = [
                    names.join(' '),
                    names
                      .map((name) => classes[name])
                      .reverse()
                      .join(' '),
                  ].map((className) => {
                    const element = document.createElement('div')
                    element.className = className
                    document.body.append(element)
                    const style = getComputedStyle(element)
                    const result = [
                      style.color,
                      style.paddingLeft,
                      style.paddingRight,
                      style.display,
                    ]
                    element.remove()
                    return result
                  })
                  return JSON.stringify(values[0]) === JSON.stringify(values[1])
                    ? []
                    : [{ names, values }]
                })
              },
              { classes: output.classes, composition, direction },
            )
            expect(differences).toEqual([])
          }
          await page.setContent(
            `<style>${controls}\n${output.css}</style><div class="condition">native</div><div class="${output.classes.condition}">compiled</div>`,
          )
          const native = page.locator('div').nth(0)
          const compiled = page.locator('div').nth(1)
          await native.hover()
          const color = await native.evaluate(
            (element) => getComputedStyle(element).color,
          )
          await compiled.hover()
          expect(
            await compiled.evaluate(
              (element) => getComputedStyle(element).color,
            ),
          ).toBe(color)
        }
      }
    } finally {
      await browser.close()
    }
  })
})
