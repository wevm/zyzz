import { chromium } from 'playwright'
import { expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'

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
        " ": "z-base-1abu38z19bto6x",
        "1 space:💪": "z-base-fiztp2mr0h1o",
        "_20_": "z-base-1abu38z19bto6x",
        "__proto__": "z-base-1abu38z19bto6x",
        "card": "z-base-1g83dj9f4y1q9",
        "empty": "",
      },
      "css": ".z-base-1g83dj9f4y1q9{padding:1rem;padding-left:0;opacity:0.5;}
    .z-base-fiztp2mr0h1o{margin-top:-2px;color:#fff;}
    .z-base-1abu38z19bto6x{display:block;}",
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
