/**
 * Exercises the public Css workflow through real collaborating modules.
 * @module
 */
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'
import * as Borders from '../../test/fixtures/Borders.js'
import * as Lengths from '../../test/fixtures/Lengths.js'
import * as Logical from '../../test/fixtures/Logical.js'
import * as Scrolling from '../../test/fixtures/Scrolling.js'

describe('compile', () => {
  test('scroll snap sharing retains A/B/A keyword and priority order', () => {
    const a = {
      scrollSnapAlign: 'start end',
      scrollSnapStop: 'normal',
      scrollSnapType: 'x proximity',
    } as const
    const output = Css.compile({
      styles: Style.define({
        a,
        b: {
          scrollSnapAlign: ['center', 'none start!'],
          scrollSnapStop: 'always',
          scrollSnapType: 'both mandatory',
        },
        c: a,
      }),
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".z-a{scroll-snap-align:start end;scroll-snap-stop:normal;scroll-snap-type:x proximity;}
      .z-b{scroll-snap-align:center;scroll-snap-align:none start!important;scroll-snap-stop:always;scroll-snap-type:both mandatory;}
      .z-c{scroll-snap-align:start end;scroll-snap-stop:normal;scroll-snap-type:x proximity;}"
    `)
  })

  test('scroll spacing sharing preserves shorthand and logical A/B/A order', () => {
    const a = {
      scrollMargin: '4px',
      scrollPadding: '8px',
      overscrollBehavior: 'contain',
    } as const
    const output = Css.compile({
      styles: Style.define({
        a,
        b: {
          scrollMarginInlineStart: '-2px',
          scrollPaddingBlockStart: '20px',
          overscrollBehaviorX: 'none',
        },
        c: a,
      }),
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".z-a{scroll-margin:4px;scroll-padding:8px;overscroll-behavior:contain;}
      .z-b{scroll-margin-inline-start:-2px;scroll-padding-block-start:20px;overscroll-behavior-x:none;}
      .z-c{scroll-margin:4px;scroll-padding:8px;overscroll-behavior:contain;}"
    `)
  })

  test('scroll spacing properties match native browser controls across writing modes', async () => {
    const cases = Object.entries(Scrolling.styles).flatMap(([family, styles]) =>
      Object.entries(styles).map(([property, value], index) => ({
        css: Scrolling.controls[
          family as keyof typeof Scrolling.controls
        ].split(';')[index]!,
        property,
        value,
      })),
    )
    const input = Object.fromEntries(
      cases.map(({ property, value }) => [property, { [property]: value }]),
    )
    const a = {
      scrollMargin: '4px',
      scrollPadding: '8px',
      overscrollBehavior: 'contain',
    } as const
    const styles: Record<string, Style.LiteralProperties> = {
      ...input,
      a,
      b: {
        scrollMarginInlineStart: '-2px',
        scrollPaddingBlockStart: '20px',
        overscrollBehaviorX: 'none',
      },
      c: a,
    }
    const output = Css.compile({ styles: Style.define(styles) })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>main>div{overflow:auto;height:100px;width:100px}${output.css}</style><main>${cases.map(({ property, css }) => `<div id="${property}" class="${output.classes[property]}"></div><div id="${property}-control" style="${css}"></div>`).join('')}<div id="combined" class="${output.classes.a} ${output.classes.b} ${output.classes.c}"></div><div id="combined-control" style="scroll-margin:4px;scroll-padding:8px;overscroll-behavior:contain"></div></main>`,
      )
      for (const writingMode of ['horizontal-tb', 'vertical-lr', 'vertical-rl'])
        for (const direction of ['ltr', 'rtl']) {
          await page.locator('main').evaluate(
            (element, mode) => {
              element.style.direction = mode.direction
              element.style.writingMode = mode.writingMode
            },
            { direction, writingMode },
          )
          expect(
            await page.evaluate((cases) => {
              const properties = [
                'overscroll-behavior-x',
                'overscroll-behavior-y',
                'scroll-behavior',
                'scroll-margin-top',
                'scroll-margin-right',
                'scroll-margin-bottom',
                'scroll-margin-left',
                'scroll-padding-top',
                'scroll-padding-right',
                'scroll-padding-bottom',
                'scroll-padding-left',
              ]
              const unsupported = cases
                .filter(
                  ({ css }) =>
                    !CSS.supports(css.split(':')[0]!, css.split(':')[1]!),
                )
                .map(({ property }) => property)
              const mismatches = [
                ...cases.map(({ property }) => property),
                'combined',
              ].filter((id) => {
                const actual = getComputedStyle(document.getElementById(id)!)
                const control = getComputedStyle(
                  document.getElementById(`${id}-control`)!,
                )
                return properties.some(
                  (property) =>
                    actual.getPropertyValue(property) !==
                    control.getPropertyValue(property),
                )
              })
              return { mismatches, unsupported }
            }, cases),
          ).toMatchInlineSnapshot(`
            {
              "mismatches": [],
              "unsupported": [],
            }
          `)
        }
    } finally {
      await browser.close()
    }
  })

  test('border and outline properties match native browser controls in every writing mode', async () => {
    const input: Record<string, Style.LiteralProperties> = {}
    for (const entry of Borders.cases)
      input[entry.property] = {
        borderStyle: 'solid',
        borderWidth: '10px',
        width: '100px',
        height: '100px',
        [entry.property]: entry.value,
      }
    const output = Css.compile({ styles: Style.define(input) })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><main>${Borders.cases.map((entry) => `<div id="${entry.property}" class="${output.classes[entry.property]}"></div><div id="${entry.property}-control" style="border-style:solid;border-width:10px;width:100px;height:100px;${entry.css}:${entry.value}"></div>`).join('')}</main>`,
      )
      for (const writingMode of ['horizontal-tb', 'vertical-lr', 'vertical-rl'])
        for (const direction of ['ltr', 'rtl']) {
          await page.locator('main').evaluate(
            (element, values) => {
              element.style.writingMode = values.writingMode
              element.style.direction = values.direction
            },
            { writingMode, direction },
          )
          expect(
            await page.evaluate(
              (names) =>
                names.flatMap((name) => {
                  const actual = getComputedStyle(
                    document.getElementById(name)!,
                  )
                  const expected = getComputedStyle(
                    document.getElementById(`${name}-control`)!,
                  )
                  const properties = [
                    'border-top-width',
                    'border-right-width',
                    'border-bottom-width',
                    'border-left-width',
                    'border-top-style',
                    'border-right-style',
                    'border-bottom-style',
                    'border-left-style',
                    'border-top-color',
                    'border-right-color',
                    'border-bottom-color',
                    'border-left-color',
                    'border-top-left-radius',
                    'border-top-right-radius',
                    'border-bottom-left-radius',
                    'border-bottom-right-radius',
                    'outline-color',
                    'outline-offset',
                    'outline-style',
                    'outline-width',
                  ]
                  return properties
                    .filter(
                      (property) =>
                        actual.getPropertyValue(property) !==
                        expected.getPropertyValue(property),
                    )
                    .map((property) => ({
                      name,
                      property,
                      actual: actual.getPropertyValue(property),
                      expected: expected.getPropertyValue(property),
                    }))
                }),
              Borders.cases.map((entry) => entry.property),
            ),
          ).toMatchInlineSnapshot(`[]`)
        }
    } finally {
      await browser.close()
    }
  })

  test('border sharing retains whole-border A/B/A overrides in the browser', async () => {
    const a = {
      borderColor: '#000',
      borderRadius: '4px',
      borderStyle: 'solid',
      borderWidth: '2px',
    } as const
    const output = Css.compile({
      styles: Style.define({
        a,
        b: {
          borderInlineStartColor: '#fff',
          borderStartStartRadius: '8px',
          borderInlineStartStyle: 'dashed',
          borderInlineStartWidth: '6px',
        },
        c: a,
      }),
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".z-a{border-color:#000;border-radius:4px;border-style:solid;border-width:2px;}
      .z-b{border-inline-start-color:#fff;border-start-start-radius:8px;border-inline-start-style:dashed;border-inline-start-width:6px;}
      .z-c{border-color:#000;border-radius:4px;border-style:solid;border-width:2px;}"
    `)
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><div class="${output.classes.a} ${output.classes.b} ${output.classes.c}"></div>`,
      )
      expect(
        await page.locator('div').evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            color: style.borderLeftColor,
            radius: style.borderTopLeftRadius,
            style: style.borderLeftStyle,
            width: style.borderLeftWidth,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "color": "rgb(0, 0, 0)",
          "radius": "4px",
          "style": "solid",
          "width": "2px",
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('overflow shorthand sharing retains repeated overrides in the browser', async () => {
    const output = Css.compile({
      styles: Style.define({
        a: { overflow: 'hidden' },
        b: { overflowX: 'scroll' },
        c: { overflow: 'hidden' },
      }),
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".z-a{overflow:hidden;}
      .z-b{overflow-x:scroll;}
      .z-c{overflow:hidden;}"
    `)
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><div class="${output.classes.a} ${output.classes.b} ${output.classes.c}"></div>`,
      )
      expect(
        await page
          .locator('div')
          .evaluate((element) => getComputedStyle(element).overflowX),
      ).toMatchInlineSnapshot(`"hidden"`)
    } finally {
      await browser.close()
    }
  })

  test('order rejects nonfinite values at the public declaration boundary', () => {
    expect(() =>
      Css.compile({
        styles: Style.define({
          item: { order: Infinity },
          unsafe: { order: 1e21 },
        }),
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `
      [Style.InvalidError: ["item","order"]: Expected a finite integer from -9007199254740991 to 9007199254740991.
      ["unsafe","order"]: Expected a finite integer from -9007199254740991 to 9007199254740991.]
    `,
    )
  })

  test('logical boxes match native controls across authored writing modes in the browser', async () => {
    const output = Css.compile({
      styles: Style.define({
        ...Logical.styles,
        horizontal: { writingMode: 'horizontal-tb', direction: 'ltr' },
        vertical: { writingMode: 'vertical-rl', direction: 'rtl' },
      }),
    })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      for (const mode of ['horizontal', 'vertical'] as const) {
        await page.setContent(
          `<style>${output.css}</style><main class="${output.classes[mode]}">${Object.entries(
            Logical.controls,
          )
            .map(
              ([name, css]) =>
                `<div id="${name}" class="${output.classes[name as keyof typeof Logical.controls]}"></div><div id="${name}-control" style="${css}"></div>`,
            )
            .join('')}</main>`,
        )
        expect(
          await page.evaluate(() => {
            return ['dimensions', 'offsets', 'spacing'].flatMap((name) => {
              const actual = getComputedStyle(document.getElementById(name)!)
              const expected = getComputedStyle(
                document.getElementById(`${name}-control`)!,
              )
              const properties = [
                'width',
                'height',
                'min-width',
                'min-height',
                'max-width',
                'max-height',
                'top',
                'right',
                'bottom',
                'left',
                'margin-top',
                'margin-right',
                'margin-bottom',
                'margin-left',
                'padding-top',
                'padding-right',
                'padding-bottom',
                'padding-left',
              ]
              return properties
                .filter(
                  (property) =>
                    actual.getPropertyValue(property) !==
                    expected.getPropertyValue(property),
                )
                .map((property) => ({
                  name,
                  property,
                  actual: actual.getPropertyValue(property),
                  expected: expected.getPropertyValue(property),
                }))
            })
          }),
        ).toMatchInlineSnapshot(`[]`)
      }
    } finally {
      await browser.close()
    }
  })

  test('logical boxes compile the complete scalar property vocabulary', () => {
    expect(Css.compile({ styles: Style.define(Logical.styles) }).css)
      .toMatchInlineSnapshot(`
      ".z_base0{block-size:40px;inline-size:80px;max-block-size:100px;max-inline-size:120px;min-block-size:10px;min-inline-size:20px;}
      .z_base2{position:relative;inset:1px;inset-block:2px;inset-block-start:-3px;inset-block-end:4px;inset-inline:5px;inset-inline-start:-6px;inset-inline-end:7px;top:8px;right:9px;bottom:10px;left:11px;}
      .z_base1{margin-block:-2px;margin-block-start:3px;margin-block-end:4px;margin-inline:5px;margin-inline-start:6px;margin-inline-end:7px;padding-block:8px;padding-block-start:9px;padding-block-end:10px;padding-inline:11px;padding-inline-start:12px;padding-inline-end:13px;}"
    `)
  })

  test('logical boxes retain conflicting A/B/A rules across physical axes in the browser', async () => {
    const a = {
      width: '80px',
      minWidth: '20px',
      maxWidth: '100px',
      top: '4px',
      marginLeft: '6px',
      paddingLeft: '8px',
    } as const
    const styles = Style.define({
      a,
      b: {
        inlineSize: '40px',
        minInlineSize: '30px',
        maxInlineSize: '60px',
        insetBlockStart: '12px',
        marginInlineStart: '14px',
        paddingInlineStart: '16px',
      },
      c: a,
    })
    const output = Css.compile({ styles })
    expect(output.css).toMatchInlineSnapshot(`
      ".z-a{width:80px;min-width:20px;max-width:100px;top:4px;margin-left:6px;padding-left:8px;}
      .z-b{inline-size:40px;min-inline-size:30px;max-inline-size:60px;inset-block-start:12px;margin-inline-start:14px;padding-inline-start:16px;}
      .z-c{width:80px;min-width:20px;max-width:100px;top:4px;margin-left:6px;padding-left:8px;}"
    `)
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>div{position:relative}${output.css}</style><div id="box" class="${output.classes.a} ${output.classes.b} ${output.classes.c}"></div>`,
      )
      expect(
        await page.locator('#box').evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            maxWidth: style.maxWidth,
            minWidth: style.minWidth,
            marginLeft: style.marginLeft,
            paddingLeft: style.paddingLeft,
            top: style.top,
            width: style.width,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "marginLeft": "6px",
          "maxWidth": "100px",
          "minWidth": "20px",
          "paddingLeft": "8px",
          "top": "4px",
          "width": "80px",
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('unsupported properties cannot collide with important cache entries', () => {
    const declarations = [
      { property: 'color', value: '#fff', important: true },
      { property: 'color!', value: '#fff' },
    ]
    for (const values of [declarations, [...declarations].reverse()])
      expect(() =>
        Css.compile({
          styles: { styles: [{ name: 'card', declarations: values }] },
        } as never),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Css.CompileError: ["card","color!"]: Unsupported literal property.]`,
      )
  })

  test('standard length families compile through public definitions', () => {
    const styles = Style.define({
      card: {
        width: ['1px', ...Lengths.units.map((unit) => `1${unit}` as const)],
      },
    })
    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(
      `".z_base0{width:1px;width:1px;width:1cm;width:1mm;width:1q;width:1Q;width:1in;width:1pc;width:1pt;width:1em;width:1ex;width:1cap;width:1ch;width:1ic;width:1lh;width:1rem;width:1rex;width:1rcap;width:1rch;width:1ric;width:1rlh;width:1vw;width:1vh;width:1vi;width:1vb;width:1vmin;width:1vmax;width:1svw;width:1svh;width:1svi;width:1svb;width:1svmin;width:1svmax;width:1lvw;width:1lvh;width:1lvi;width:1lvb;width:1lvmin;width:1lvmax;width:1dvw;width:1dvh;width:1dvi;width:1dvb;width:1dvmin;width:1dvmax;width:1cqw;width:1cqh;width:1cqi;width:1cqb;width:1cqmin;width:1cqmax;width:1%;}"`,
    )
  })

  test('standard length families match authored CSS in the browser', async () => {
    const styles = Style.define(
      Object.fromEntries(
        Lengths.units.map((unit) => [unit, { width: `1${unit}` as const }]),
      ),
    )
    const output = Css.compile({ styles })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({
        viewport: { width: 800, height: 600 },
      })
      await page.setContent(
        `<style>html{font-size:16px;line-height:24px}main{container-type:size;width:400px;height:300px}${output.css}</style><main>${Lengths.units.map((unit) => `<div id="compiled-${unit}" class="${output.classes[unit]}"></div><div id="authored-${unit}" style="width:1${unit}"></div>`).join('')}</main>`,
      )
      expect(
        await page.evaluate(
          (units) => units.filter((unit) => !CSS.supports('width', `1${unit}`)),
          [...Lengths.units],
        ),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page.evaluate(
          (units) =>
            units.filter(
              (unit) =>
                getComputedStyle(document.getElementById(`compiled-${unit}`)!)
                  .width !==
                getComputedStyle(document.getElementById(`authored-${unit}`)!)
                  .width,
            ),
          [...Lengths.units],
        ),
      ).toMatchInlineSnapshot(`[]`)
    } finally {
      await browser.close()
    }
  })

  test('standard length validation retains property bounds and syntax restrictions', () => {
    expect(() =>
      Style.define({
        card: {
          padding: '-1cqi',
          borderWidth: '1%',
          width: '1e999dvh',
          height: '1ms',
          margin: '1 dvw',
          fontSize: '1cqi; color:red',
        },
      } as never),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Style.InvalidError: ["card","padding"]: Expected a nonnegative literal length or numeric zero.
      ["card","borderWidth"]: Expected a nonnegative literal length or numeric zero. Also accepts: medium, thick, thin.
      ["card","width"]: Expected a nonnegative literal length, auto, or numeric zero. Also accepts: fit-content, max-content, min-content.
      ["card","height"]: Expected a nonnegative literal length, auto, or numeric zero. Also accepts: fit-content, max-content, min-content.
      ["card","margin"]: Expected one to 4 valid space-separated values; CSS-wide keywords must stand alone.
      ["card","fontSize"]: Expected a nonnegative literal length or numeric zero.]
    `)
    expect(
      Css.compile({
        styles: Style.define({
          card: { margin: '-1e2cqi', padding: '+.5rlh', borderWidth: '1Q' },
        }),
      }).css,
    ).toMatchInlineSnapshot(
      `".z_base0{margin:-1e2cqi;padding:+.5rlh;border-width:1Q;}"`,
    )
  })

  test('importance is distinct in cached and factored declarations', () => {
    const styles = Style.define({
      first: { color: ['#fff!', '#000!'] },
      normal: { color: '#fff' },
      last: { color: '#fff !important' },
      numeric: { opacity: '0.5!', padding: '0!' },
    })
    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(`
      ".z-first{color:#fff!important;color:#000!important;}
      .z-normal{color:#fff;}
      .z-last{color:#fff!important;}
      .z_base0{opacity:0.5!important;padding:0!important;}"
    `)
  })

  test('invalid fallback values and importance produce located diagnostics', () => {
    expect(() =>
      Style.define({ card: { color: [] } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["card","color"]: Fallback arrays must be nonempty.]`,
    )
    expect(() =>
      Style.define({ card: { padding: ['8px', undefined] } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["card","padding","1"]: Expected a nonnegative literal length or numeric zero.]`,
    )
    expect(() =>
      Style.define({ card: { color: ['#fff', ['#000']] } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["card","color","1"]: Expected a named color, system color, hex color, transparent, or currentColor.]`,
    )
    expect(() =>
      Style.define({
        card: { color: '#fff!!', opacity: '2px!', padding: "'8px!'" },
      } as never),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Style.InvalidError: ["card","color"]: Expected a named color, system color, hex color, transparent, or currentColor.
      ["card","opacity"]: Expected a finite number or percentage.
      ["card","padding"]: Expected a nonnegative literal length or numeric zero.]
    `)
    const sparse = ['8px']
    sparse.length = 3
    sparse[2] = '12px'
    expect(() =>
      Style.define({ card: { padding: sparse } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["card","padding","1"]: Fallback arrays require dense data entries without accessors.]`,
    )
  })

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
              "message": "Expected one to 4 valid space-separated values; CSS-wide keywords must stand alone.",
              "path": [
                "injection",
                "padding",
              ],
            },
            {
              "code": "invalid_declaration",
              "message": "Expected a finite number or percentage.",
              "path": [
                "numeric",
                "opacity",
              ],
            },
            {
              "code": "invalid_declaration",
              "message": "Expected a finite number or percentage.",
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
})
