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
      ".z-a-atomic-scrollSnapAlign-0{scroll-snap-align:start end;}
      .z-a-atomic-scrollSnapStop-1{scroll-snap-stop:normal;}
      .z-a-atomic-scrollSnapType-2{scroll-snap-type:x proximity;}
      .z-b-atomic-scrollSnapAlign-0{scroll-snap-align:center;scroll-snap-align:none start!important;}
      .z-b-atomic-scrollSnapStop-1{scroll-snap-stop:always;}
      .z-b-atomic-scrollSnapType-2{scroll-snap-type:both mandatory;}
      .z-c-atomic-scrollSnapAlign-0{scroll-snap-align:start end;}
      .z-c-atomic-scrollSnapStop-1{scroll-snap-stop:normal;}
      .z-c-atomic-scrollSnapType-2{scroll-snap-type:x proximity;}"
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
      ".z-a-atomic-scrollMargin-0{scroll-margin:4px;}
      .z-a-atomic-scrollPadding-1{scroll-padding:8px;}
      .z-a-atomic-overscrollBehavior-2{overscroll-behavior:contain;}
      .z-b-atomic-scrollMarginInlineStart-0{scroll-margin-inline-start:-2px;}
      .z-b-atomic-scrollPaddingBlockStart-1{scroll-padding-block-start:20px;}
      .z-b-atomic-overscrollBehaviorX-2{overscroll-behavior-x:none;}
      .z-c-atomic-scrollMargin-0{scroll-margin:4px;}
      .z-c-atomic-scrollPadding-1{scroll-padding:8px;}
      .z-c-atomic-overscrollBehavior-2{overscroll-behavior:contain;}"
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

    const styles: Record<string, Style.LiteralDeclarations> = {
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
    const input: Record<string, Style.LiteralDeclarations> = {}

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
      ".z-a-atomic-borderColor-0{border-color:#000;}
      .z-a-atomic-borderRadius-1{border-radius:4px;}
      .z-a-atomic-borderStyle-2{border-style:solid;}
      .z-a-atomic-borderWidth-3{border-width:2px;}
      .z-b-atomic-borderInlineStartColor-0{border-inline-start-color:#fff;}
      .z-b-atomic-borderStartStartRadius-1{border-start-start-radius:8px;}
      .z-b-atomic-borderInlineStartStyle-2{border-inline-start-style:dashed;}
      .z-b-atomic-borderInlineStartWidth-3{border-inline-start-width:6px;}
      .z-c-atomic-borderColor-0{border-color:#000;}
      .z-c-atomic-borderRadius-1{border-radius:4px;}
      .z-c-atomic-borderStyle-2{border-style:solid;}
      .z-c-atomic-borderWidth-3{border-width:2px;}"
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
      ".z-a-atomic-overflow-0{overflow:hidden;}
      .z-b-atomic-overflowX-0{overflow-x:scroll;}
      .z-c-atomic-overflow-0{overflow:hidden;}"
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
        ".z_base-blockSize-3sm9ph1y4g1mz{block-size:40px;}
        .z_base-inlineSize-3imo0i1y4g1my{inline-size:80px;}
        .z_base-maxBlockSize-38n2bj1y4g1mx{max-block-size:100px;}
        .z_base-maxInlineSize-2yngmk1y4g1mw{max-inline-size:120px;}
        .z_base-minBlockSize-2onuxl1y4g1n3{min-block-size:10px;}
        .z_base-minInlineSize-2eo98m1y4g1n2{min-inline-size:20px;}
        .z_base-position-12e054k1kl2h3q{position:relative;}
        .z_base-inset-12nzqtj1kl2h3r{inset:1px;}
        .z_base-insetBlock-12xzcii1kl2h3o{inset-block:2px;}
        .z_base-insetBlockStart-137yy7h1kl2h3p{inset-block-start:-3px;}
        .z_base-insetBlockEnd-11a1qco1kl2h3m{inset-block-end:4px;}
        .z_base-insetInline-11k1c1n1kl2h3n{inset-inline:5px;}
        .z_base-insetInlineStart-11u0xqm1kl2h3k{inset-inline-start:-6px;}
        .z_base-insetInlineEnd-1240jfl1kl2h3l{inset-inline-end:7px;}
        .z_base-top-1063bks1kl2h3y{top:8px;}
        .z_base-right-10g2x9r1kl2h3z{right:9px;}
        .z_base-bottom-6kb9xxkic91j{bottom:10px;}
        .z_base-left-6abo8ykic91i{left:11px;}
        .z_base-marginBlock-1rh3u6916hkw5l{margin-block:-2px;}
        .z_base-marginBlockStart-1r748ha16hkw5k{margin-block-start:3px;}
        .z_base-marginBlockEnd-1qx4msb16hkw5n{margin-block-end:4px;}
        .z_base-marginInline-1qn513c16hkw5m{margin-inline:5px;}
        .z_base-marginInlineStart-1sl28y516hkw5p{margin-inline-start:6px;}
        .z_base-marginInlineEnd-1sb2n9616hkw5o{margin-inline-end:7px;}
        .z_base-paddingBlock-1s131k716hkw5r{padding-block:8px;}
        .z_base-paddingBlockStart-1rr3fv816hkw5q{padding-block-start:9px;}
        .z_base-paddingBlockEnd-1p970mh16hkw5d{padding-block-end:10px;}
        .z_base-paddingInline-1oz7exi16hkw5c{padding-inline:11px;}
        .z_base-paddingInlineStart-u6gy9m1gj0flk{padding-inline-start:12px;}
        .z_base-paddingInlineEnd-uggjyl1gj0fll{padding-inline-end:13px;}"
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
      ".z-a-atomic-width-0{width:80px;}
      .z-a-atomic-minWidth-1{min-width:20px;}
      .z-a-atomic-maxWidth-2{max-width:100px;}
      .z-a-atomic-top-3{top:4px;}
      .z-a-atomic-marginLeft-4{margin-left:6px;}
      .z-a-atomic-paddingLeft-5{padding-left:8px;}
      .z-b-atomic-inlineSize-0{inline-size:40px;}
      .z-b-atomic-minInlineSize-1{min-inline-size:30px;}
      .z-b-atomic-maxInlineSize-2{max-inline-size:60px;}
      .z-b-atomic-insetBlockStart-3{inset-block-start:12px;}
      .z-b-atomic-marginInlineStart-4{margin-inline-start:14px;}
      .z-b-atomic-paddingInlineStart-5{padding-inline-start:16px;}
      .z-c-atomic-width-0{width:80px;}
      .z-c-atomic-minWidth-1{min-width:20px;}
      .z-c-atomic-maxWidth-2{max-width:100px;}
      .z-c-atomic-top-3{top:4px;}
      .z-c-atomic-marginLeft-4{margin-left:6px;}
      .z-c-atomic-paddingLeft-5{padding-left:8px;}"
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

  test('standard length families compile through public definitions', () => {
    const styles = Style.define({
      card: {
        width: ['1px', ...Lengths.units.map((unit) => `1${unit}` as const)],
      },
    })

    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(
      `".z_base-width-11hsk3q1tuqfr0{width:1px;width:1px;width:1cm;width:1mm;width:1q;width:1Q;width:1in;width:1pc;width:1pt;width:1em;width:1ex;width:1cap;width:1ch;width:1ic;width:1lh;width:1rem;width:1rex;width:1rcap;width:1rch;width:1ric;width:1rlh;width:1vw;width:1vh;width:1vi;width:1vb;width:1vmin;width:1vmax;width:1svw;width:1svh;width:1svi;width:1svb;width:1svmin;width:1svmax;width:1lvw;width:1lvh;width:1lvi;width:1lvb;width:1lvmin;width:1lvmax;width:1dvw;width:1dvh;width:1dvi;width:1dvb;width:1dvmin;width:1dvmax;width:1cqw;width:1cqh;width:1cqi;width:1cqb;width:1cqmin;width:1cqmax;width:1%;}"`,
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

  test('importance is distinct in cached and factored declarations', () => {
    const styles = Style.define({
      first: { color: ['#fff!', '#000!'] },
      normal: { color: '#fff' },
      last: { color: '#fff !important' },
      numeric: { opacity: '0.5!', padding: '0!' },
    })

    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(`
      ".z-first-atomic-color-0{color:#fff!important;color:#000!important;}
      .z-normal-atomic-color-0{color:#fff;}
      .z-last-atomic-color-0{color:#fff!important;}
      .z_base-opacity-6mhgmrh9mpfn{opacity:0.5!important;}
      .z_base-padding-6chuxsh9mpfm{padding:0!important;}"
    `)
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
          "-1": "z--1-atomic-color-0 z_base-display-1bzbmfg190jjg8 z--1-atomic-padding-1",
          "1": "z-1-atomic-color-0 z_base-display-1bzbmfg190jjg8 z-1-atomic-padding-2",
          "_31_": "z-_5f_31_5f_-atomic-color-0 z_base-display-1bzbmfg190jjg8 z-_5f_31_5f_-atomic-padding-1",
          "again": "z-1-atomic-color-0 z_base-display-1bzbmfg190jjg8 z-1-atomic-padding-2",
          "base_0": "z-base_5f_0-atomic-color-0 z_base-display-1bzbmfg190jjg8 z-base_5f_0-atomic-padding-1",
          "empty": "",
        },
        "css": ".z-1-atomic-color-0{color:#000;}
      .z_base-display-1bzbmfg190jjg8{display:block;}
      .z-1-atomic-padding-2{padding:8px;}
      .z--1-atomic-color-0{color:#fff;}
      .z--1-atomic-padding-1{padding:3px;}
      .z-_5f_31_5f_-atomic-color-0{color:#333;}
      .z-_5f_31_5f_-atomic-padding-1{padding:4px;}
      .z-base_5f_0-atomic-color-0{color:#555;}
      .z-base_5f_0-atomic-padding-1{padding:5px;}",
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
          " ": "z_base-display-nz2e2w1qywe5m",
          "1 space:💪": "z_base-marginTop-yoxcaq1qlh0kw z_base-color-yywxzp1qlh0kx",
          "_20_": "z_base-display-nz2e2w1qywe5m",
          "__proto__": "z_base-display-nz2e2w1qywe5m",
          "card": "z_base-padding-11hsk3q1tuqfr0 z_base-paddingLeft-11rs5sp1tuqfr1 z_base-opacity-10xtcps1tuqfr2",
          "empty": "",
        },
        "css": ".z_base-padding-11hsk3q1tuqfr0{padding:1rem;}
      .z_base-paddingLeft-11rs5sp1tuqfr1{padding-left:0;}
      .z_base-opacity-10xtcps1tuqfr2{opacity:0.5;}
      .z_base-marginTop-yoxcaq1qlh0kw{margin-top:-2px;}
      .z_base-color-yywxzp1qlh0kx{color:#fff;}
      .z_base-display-nz2e2w1qywe5m{display:block;}",
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
        "reordered": false,
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

  test('compiler diagnostics reject duplicate style names without emitting CSS', () => {
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
