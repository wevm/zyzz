import { chromium } from 'playwright'
import { expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

test('independent applications share complete rules and retain valid class identifiers', async () => {
  const styles = Style.define({
    '1': { color: '#000', display: 'block', padding: '8px' },
    '-1': { color: '#fff', display: 'block', padding: '3px' },
    _31_: { color: '#333', display: 'block', padding: '4px' },
    again: { color: '#000', display: 'block', padding: '8px' },
    base_0: { color: '#555', display: 'block', padding: '5px' },
    empty: {},
  })
  const output = Css.compile({ composition: 'independent', styles })
  expect(output).toMatchInlineSnapshot(`
      {
        "classes": {
          "-1": "base_0 _2d_1",
          "1": "base_0 _31_",
          "_31_": "base_0 _5f_31_5f_",
          "again": "base_0 _31_",
          "base_0": "base_0 base_5f_0",
          "empty": "",
        },
        "css": ".base_0{display:block;}
      ._31_{color:#000;padding:8px;}
      ._2d_1{color:#fff;padding:3px;}
      ._5f_31_5f_{color:#333;padding:4px;}
      .base_5f_0{color:#555;padding:5px;}",
        "themes": {},
      }
    `)
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent('<!doctype html><body></body>')
    await page.addStyleTag({ content: output.css })
    const rendered = await page.evaluate(
      (classes) =>
        Object.values(classes)
          .filter(Boolean)
          .map((className) => {
            const element = document.createElement('div')
            element.className = className
            document.body.append(element)
            const style = getComputedStyle(element)
            return { color: style.color, padding: style.padding }
          }),
      output.classes,
    )
    expect(rendered).toMatchInlineSnapshot(`
      [
        {
          "color": "rgb(0, 0, 0)",
          "padding": "8px",
        },
        {
          "color": "rgb(255, 255, 255)",
          "padding": "3px",
        },
        {
          "color": "rgb(51, 51, 51)",
          "padding": "4px",
        },
        {
          "color": "rgb(0, 0, 0)",
          "padding": "8px",
        },
        {
          "color": "rgb(85, 85, 85)",
          "padding": "5px",
        },
      ]
    `)
  } finally {
    await browser.close()
  }
})

test('definitions compile to stable classes and ordered literal CSS', () => {
  // Declaration and style order intentionally exercise shorthand precedence.
  const styles = Style.define({
    card: { padding: '1rem', paddingLeft: 0, opacity: 0.5 },
    empty: {},
    '1 space:💪': { marginTop: '-2px', color: '#fff' },
    _20_: { display: 'block' },
    ' ': { display: 'block' },
    ['__proto__']: { display: 'block' },
  })
  const result = Css.compile({ styles })
  expect(result).toMatchInlineSnapshot(`
    {
      "classes": {
        " ": "z_base0",
        "1 space:💪": "z_base1",
        "_20_": "z_base0",
        "__proto__": "z_base0",
        "card": "z_base2",
        "empty": "",
      },
      "css": ".z_base2{padding:1rem;padding-left:0;opacity:0.5;}
    .z_base1{margin-top:-2px;color:#fff;}
    .z_base0{display:block;}",
      "themes": {},
    }
  `)
  const reversed = Css.compile({
    styles: { styles: [...styles.styles].reverse() },
  })
  expect({
    frozen:
      Object.isFrozen(result) &&
      Object.isFrozen(result.classes) &&
      Object.isFrozen(result.themes),
    reordered: styles.styles.every(
      (style) => reversed.classes[style.name] === result.classes[style.name],
    ),
    repeated: Css.compile({ styles }).css === result.css,
    unique: new Set(Object.values(result.classes)).size,
  }).toMatchInlineSnapshot(`
    {
      "frozen": true,
      "reordered": true,
      "repeated": true,
      "unique": 4,
    }
  `)
  expect(Css.compile({ styles: Style.define({}) })).toMatchInlineSnapshot(`
    {
      "classes": {},
      "css": "",
      "themes": {},
    }
  `)
})

test('compiler diagnostics reject invalid ordered declarations without emitting CSS', () => {
  const valid = Style.define({ card: { padding: 0 } })
  // A source adapter can supply ordered data directly; invalid literal data still fails.
  const styles: Style.Definition = {
    styles: [
      ...valid.styles,
      {
        declarations: [{ property: 'padding', value: '0; color: red' }],
        name: 'injection',
      },
      {
        declarations: [{ property: 'opacity', value: Infinity }],
        name: 'numeric',
      },
      {
        declarations: [{ property: 'opacity', value: Infinity }],
        name: 'numericAgain',
      },
      ...valid.styles,
    ],
  }
  try {
    Css.compile({ styles })
    throw new Error('Expected compilation to fail')
  } catch (error) {
    if (!(error instanceof Css.CompileError)) throw error
    expect({ diagnostics: error.diagnostics, name: error.name })
      .toMatchInlineSnapshot(`
        {
          "diagnostics": [
            {
              "code": "invalid_declaration",
              "message": "Expected a nonnegative literal length or numeric zero.",
              "path": [
                "injection",
                "padding",
              ],
            },
            {
              "code": "invalid_declaration",
              "message": "Expected a finite number from 0 to 1.",
              "path": [
                "numeric",
                "opacity",
              ],
            },
            {
              "code": "invalid_declaration",
              "message": "Expected a finite number from 0 to 1.",
              "path": [
                "numericAgain",
                "opacity",
              ],
            },
            {
              "code": "invalid_name",
              "message": "Style names must be nonempty and unique.",
              "path": [
                "card",
              ],
            },
          ],
          "name": "Css.CompileError",
        }
      `)
  }
})

test('compiled CSS renders units, escaped names, and authored cascade order in Chromium', async () => {
  // Opposing shorthand orders and stylesheet order are the behavior under test.
  const styles = Style.define({
    '1 space:💪': {
      padding: '1rem',
      paddingLeft: 0,
      lineHeight: 1.5,
      marginTop: '-2px',
    },
    reverse: { paddingLeft: 0, padding: '1rem' },
    first: { color: '#000' },
    last: { color: '#fff' },
  })
  const output = Css.compile({ styles })
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent(
      '<!doctype html><html style="font-size:16px"><body></body></html>',
    )
    await page.addStyleTag({ content: output.css })
    const rendered = await page.evaluate((classes) => {
      return [
        classes['1 space:💪'],
        classes.reverse,
        `${classes.last} ${classes.first}`,
      ].map((className) => {
        const element = document.createElement('div')
        element.className = className
        document.body.append(element)
        const style = getComputedStyle(element)
        return {
          color: style.color,
          lineHeight: style.lineHeight,
          marginTop: style.marginTop,
          padding: style.padding,
        }
      })
    }, output.classes)
    expect(rendered).toMatchInlineSnapshot(`
      [
        {
          "color": "rgb(0, 0, 0)",
          "lineHeight": "24px",
          "marginTop": "-2px",
          "padding": "16px 16px 16px 0px",
        },
        {
          "color": "rgb(0, 0, 0)",
          "lineHeight": "normal",
          "marginTop": "0px",
          "padding": "16px",
        },
        {
          "color": "rgb(255, 255, 255)",
          "lineHeight": "normal",
          "marginTop": "0px",
          "padding": "0px",
        },
      ]
    `)
  } finally {
    await browser.close()
  }
})

test('factoring preserves repeated overrides and shorthand conflicts across combined classes', async () => {
  // Repeated A/B/A values must not collapse into a shared conflicting rule.
  const styles = Style.define({
    first: {
      color: '#000',
      gap: '10px',
      rowGap: '2px',
      padding: '8px',
      paddingLeft: 0,
    },
    middle: { color: '#fff', rowGap: '4px', paddingLeft: '3px' },
    last: {
      color: '#000',
      gap: '10px',
      rowGap: '2px',
      padding: '8px',
      paddingLeft: 0,
    },
  })
  const output = Css.compile({ styles })
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent('<!doctype html><body></body>')
    await page.addStyleTag({ content: output.css })
    const result = await page.evaluate(
      (classes) =>
        [
          `${classes.middle} ${classes.first}`,
          `${classes.last} ${classes.middle}`,
        ].map((className) => {
          const element = document.createElement('div')
          element.className = className
          document.body.append(element)
          const style = getComputedStyle(element)
          return {
            color: style.color,
            columnGap: style.columnGap,
            paddingLeft: style.paddingLeft,
            rowGap: style.rowGap,
          }
        }),
      output.classes,
    )
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "color": "rgb(255, 255, 255)",
          "columnGap": "10px",
          "paddingLeft": "3px",
          "rowGap": "4px",
        },
        {
          "color": "rgb(0, 0, 0)",
          "columnGap": "10px",
          "paddingLeft": "0px",
          "rowGap": "2px",
        },
      ]
    `)
  } finally {
    await browser.close()
  }
})
