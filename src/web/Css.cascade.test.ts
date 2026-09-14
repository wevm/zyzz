/** Compares isolated emitter paths with independent browser cascade controls. @module */
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

describe('compile', () => {
  test('retains sharing, resets, logical overlap, and active or inactive conditions', async () => {
    const first = Style.define({ card: { color: 'red', display: 'block' } })
      .styles[0]!
    const middle = Style.define({ card: { color: 'blue', opacity: 0.4 } })
      .styles[0]!
    const cases = [
      {
        control:
          '.card{color:red;display:block;color:blue;opacity:0.4;color:red;display:block}',
        styles: {
          styles: [
            {
              name: 'card',
              declarations: [
                ...first.declarations,
                ...middle.declarations,
                ...first.declarations,
              ],
            },
          ],
        },
      },
      {
        control: '.card{padding:8px;all:initial;padding-left:2px;color:red}',
        styles: Style.define({
          card: {
            padding: '8px',
            all: 'initial',
            paddingLeft: '2px',
            color: 'red',
          },
        }),
      },
      {
        control: '.card{padding:8px;padding-inline-start:3px;padding-left:5px}',
        styles: Style.define({
          card: {
            padding: '8px',
            paddingInlineStart: '3px',
            paddingLeft: '5px',
          },
        }),
      },
      {
        control:
          '.card{color:red;@media(min-width:100px){color:blue;padding:8px}@supports(display:grid){padding-left:2px}@supports(display:zyzz-unsupported){color:orange}}',
        styles: Style.define({
          card: {
            color: 'red',
            '@media (min-width: 100px)': { color: 'blue', padding: '8px' },
            '@supports (display: grid)': { paddingLeft: '2px' },
            '@supports (display: zyzz-unsupported)': { color: 'orange' },
          },
        }),
      },
      {
        control: '.a{color:red}.b{color:blue}.c{color:red}',
        styles: Style.define({
          a: { color: 'red' },
          b: { color: 'blue' },
          c: { color: 'red' },
        }),
      },
      {
        control: '.a{color:red;padding:1px}.b{color:red;margin:2px}',
        styles: Style.define({
          a: { color: 'red', padding: '1px' },
          b: { color: 'red', margin: '2px' },
        }),
      },
      {
        control: '.card{@layer base{color:red}@layer override{color:blue}}',
        styles: Style.define({
          card: {
            '@layer base': { color: 'red' },
            '@layer override': { color: 'blue' },
          },
        }),
      },
      {
        control:
          '.card{color:red!important;color:blue;display:grid;display:block}',
        styles: Style.define({
          card: {
            color: ['red!', 'blue'],
            display: ['grid', 'block'],
          },
        } as never),
      },
    ]
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      for (const cssOutput of ['atomic', 'grouped'] as const)
        for (const composition of ['ordered', 'independent'] as const)
          for (const fixture of cases) {
            const output = Css.compile({
              composition,
              cssOutput,
              styles: fixture.styles,
            })
            for (const width of [80, 200]) {
              await page.setViewportSize({ height: 500, width })
              await page.setContent(
                `<style>${fixture.control}\n${output.css}</style>`,
              )
              for (const direction of ['ltr', 'rtl'])
                for (const writingMode of [
                  'horizontal-tb',
                  'vertical-rl',
                  'vertical-lr',
                ]) {
                  const differences = await page.evaluate(
                    ({ classes, composition, direction, writingMode }) => {
                      document.body.style.direction = direction
                      document.body.style.writingMode = writingMode
                      const names = Object.keys(classes)
                      const groups = names.map((name) => [name])
                      if (composition === 'ordered' && names.length > 1)
                        groups.push(names)
                      return groups.flatMap((names) => {
                        const values = [
                          names.join(' '),
                          names
                            .flatMap((name) => classes[name]!.split(' '))
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
                            style.paddingTop,
                            style.paddingBottom,
                            style.opacity,
                            style.marginLeft,
                            style.display,
                          ]
                          element.remove()
                          return result
                        })
                        return JSON.stringify(values[0]) ===
                          JSON.stringify(values[1])
                          ? []
                          : [{ names, values }]
                      })
                    },
                    {
                      classes: output.classes,
                      composition,
                      direction,
                      writingMode,
                    },
                  )
                  expect(differences).toMatchInlineSnapshot(`[]`)
                }
            }
          }
    } finally {
      await browser.close()
    }
  }, 30000)

  test('retains selector specificity against a later matching competitor', async () => {
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      for (const cssOutput of ['atomic', 'grouped'] as const) {
        const output = Css.compile({
          cssOutput,
          styles: Style.define({ card: { '&:hover': { color: 'purple' } } }),
        })
        for (const competing of [false, true]) {
          await page.setContent(
            `<style>.native:hover{color:purple}${output.css}${competing ? '.competitor:hover{color:orange}' : ''}</style><div class="native competitor">native</div><div class="${output.classes.card} competitor">compiled</div>`,
          )
          for (const index of [0, 1]) {
            const element = page.locator('div').nth(index)
            await element.hover()
            expect(
              (await element.evaluate(
                (element) => getComputedStyle(element).color,
              )) === (competing ? 'rgb(255, 165, 0)' : 'rgb(128, 0, 128)'),
            ).toMatchInlineSnapshot('true')
          }
        }
      }
    } finally {
      await browser.close()
    }
  })
})
