/** Verifies ordered nesting, query identities, scalar inference, and native browser conditions. @module */
import * as Trace from '@jridgewell/trace-mapping'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style } from 'zyzz'
import { Css } from 'zyzz/web'
import { Graph, Source, Transform } from 'zyzz/compiler'

const source =
  'import {Theme} from "zyzz"; const theme=Theme.define({breakpoints:{tablet:"48rem",desktop:"64rem"},containers:{card:"24rem"},containerNames:["sidebar"],spacing:{small:"4px",large:"16px"}}); export const box=theme.css({padding:"small", ":hover":{padding:"large"}, "@media tablet..desktop":{width:"100px","&[data-active]":{height:"20px"}}, "@container sidebar >=card":{display:"grid"},"@supports (display:grid)":{gap:"small"},"@starting-style":{opacity:0}})()'
describe('compile', () => {
  test('preserves media case and ignores selector comments for dynamic locality', () => {
    const source =
      'import {css} from "zyzz"; css((v:{alpha:number})=>({"&/* state, & */:hover":{opacity:v.alpha},"@media SCREEN":{color:"red"}}))'
    const output = Transform.compile({ moduleId: 'comments.ts', source })

    expect(output.css).toContain('@media SCREEN')
    expect(output.css).toContain('opacity:var(')
  })
  test('reports invalid condition grammar at each authored key', () => {
    const source =
      'import {css} from "zyzz"; css({"@supports display: grid":{color:"red"},"@supports color: red":{color:"blue"}})'

    try {
      Transform.compile({ moduleId: 'locations.ts', source })
      throw new Error('Expected source diagnostics')
    } catch (error) {
      if (!(error instanceof Source.ExtractError)) throw error

      expect(error.diagnostics.map((diagnostic) => diagnostic.start)).toEqual([
        source.indexOf('"@supports display'),
        source.indexOf('"@supports color'),
      ])
    }
  })
  test('scopes pseudo selectors containing ampersands in data', () => {
    const output = Transform.compile({
      moduleId: 'data.ts',
      source: `import { css } from 'zyzz'; css({ ':hover[data-token="a&b"]': { color: 'red' } })`,
    })

    expect(output.css).toContain('&:hover[data-token="a&b"]')
    expect(() =>
      Transform.compile({
        moduleId: 'backdrop.ts',
        source: `import { css } from 'zyzz'; css((v: { alpha: number }) => ({ '::backdrop': { opacity: v.alpha } }))`,
      }),
    ).toThrow()
  })
  test('maps condition keys and supports local dynamic selector lists', () => {
    const source = `import {css} from 'zyzz'; css((v:{alpha:number})=>({'&:hover, &:focus':{opacity:v.alpha},'@media screen':{color:'red'}}))`
    const output = Transform.compile({ moduleId: 'keys.ts', source })
    const map = new Trace.TraceMap(output.cssMap)

    for (const key of ['&:hover, &:focus', '@media screen']) {
      const lines = output.css.slice(0, output.css.indexOf(key)).split('\n')
      const location = Trace.originalPositionFor(map, {
        line: lines.length,
        column: lines.at(-1)!.length,
      })

      expect(location.column).toBe(source.indexOf(`'${key}'`))
    }
  })
  test('freezes nested diagnostic paths and locations', () => {
    try {
      Reflect.apply(Style.define, undefined, [
        { box: { ':hover': { color: [] } } },
        {
          locations: [
            {
              path: ['box', ':hover', 'color'],
              source: 'input.ts',
              start: 1,
              end: 2,
            },
          ],
        },
      ])
      throw new Error('Expected validation failure')
    } catch (error) {
      expect(error).toBeInstanceOf(Style.InvalidError)

      if (!(error instanceof Style.InvalidError)) throw error

      const diagnostic = error.diagnostics[0]!

      expect(
        [
          diagnostic,
          diagnostic.path,
          diagnostic.location,
          diagnostic.location?.path,
        ].every(Object.isFrozen),
      ).toBe(true)
      expect(diagnostic.location?.path).toEqual(['box', ':hover', 'color'])
    }
  })

  test('preserves explicit pseudo relationships and qualified media types', () => {
    expect(
      Transform.compile({
        moduleId: 'selectors.ts',
        source:
          'import {css} from "zyzz"; css({":where(.dark) &":{color:"red"},"@media only screen":{display:"grid"},"@media not print":{display:"block"}})',
      }).css,
    ).toMatchInlineSnapshot(
      `
      ".z-style-31e6cc1lbrj8g-26-atomic-color-0{:where(.dark) &{color:red;}}
      .z-style-31e6cc1lbrj8g-26-atomic-display-1{@media only screen{display:grid;}}
      .z-style-31e6cc1lbrj8g-26-atomic-display-2{@media not print{display:block;}}"
    `,
    )
  })
  test('maps declarations after matching text in feature conditions', () => {
    const source =
      'import {css} from "zyzz"; css({"@supports (display:grid)":{display:"grid"}})'
    const output = Transform.compile({ moduleId: 'supports.ts', source })
    const column = output.css.lastIndexOf('display:')

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: 1,
        column,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 59,
        "line": 1,
        "name": "display",
        "source": "supports.ts",
      }
    `)
  })
  test('rejects private dynamic values on relationship subjects', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'sibling.ts',
        source:
          'import {css} from "zyzz"; css((v:{alpha:number})=>({"& + .peer":{opacity:v.alpha}}))',
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: sibling.ts:73: Dynamic values require conditions that select the styled element.
      sibling.ts:73: Expected a literal string or number; expressions are not evaluated.]
    `)
  })
  test('preserves functional pseudo lists and multiline conditions', () => {
    const output = Transform.compile({
      moduleId: 'lines.ts',
      source:
        'import {css} from "zyzz"; css({":is(:hover,:focus)":{color:"red"},"@media (width > 1px)\\n and (hover: hover)":{padding:"2px"}})',
    })

    expect(output.css).toMatchInlineSnapshot(
      `
      ".z-style-1xoh7zjj7hyhn-26-atomic-color-0{&:is(:hover,:focus){color:red;}}
      .z-style-1xoh7zjj7hyhn-26-atomic-padding-1{@media (width > 1px)  and (hover: hover){padding:2px;}}"
    `,
    )
  })
  test('rejects malformed conditions in the direct compiler pipeline', () => {
    expect(() =>
      Css.compile({
        styles: Style.define({ body: { '&[': { color: 'red' } } }),
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["body","&["]: Unbalanced condition delimiters.]`,
    )
  })
  test('Chromium retains flat A/B/A overrides around conditional declarations', async () => {
    const output = Css.compile({
      styles: Style.define({
        a: { marginLeft: '2px' },
        b: { marginLeft: '4px', ':hover': { color: 'red' } },
        c: { marginLeft: '2px' },
      }),
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-a-atomic-marginLeft-0{margin-left:2px;}
      .z-b-atomic-marginLeft-0{margin-left:4px;}
      .z-b-atomic-color-1{&:hover{color:red;}}
      .z-c-atomic-marginLeft-0{margin-left:2px;}"
    `)

    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${output.css}</style><div id="box" class="${output.classes.a} ${output.classes.b} ${output.classes.c}">Box</div>`,
      )

      expect(
        await page
          .locator('#box')
          .evaluate((element) => getComputedStyle(element).marginLeft),
      ).toMatchInlineSnapshot(`"2px"`)
    } finally {
      await browser.close()
    }
  })
  test('maps nested declarations and passes through raw media lists', () => {
    const source =
      'import {css} from "zyzz"; css({color:"red","@media screen, print":{padding:"2px"}})'
    const output = Transform.compile({ moduleId: 'mapped.ts', source })

    expect(output.css).toMatchInlineSnapshot(
      `
      ".z-style-cqzv9l1th5n7r-26-atomic-color-0{color:red;}
      .z-style-cqzv9l1th5n7r-26-atomic-padding-1{@media screen, print{padding:2px;}}"
    `,
    )

    const prefix = output.css.slice(0, output.css.indexOf('padding:'))
    const lines = prefix.split('\n')
    const column = lines.at(-1)!.length

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: lines.length,
        column,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 67,
        "line": 1,
        "name": "padding",
        "source": "mapped.ts",
      }
    `)
  })
  test('requires nesting in every selector list member', () => {
    for (const selector of ['&:hover, :focus', ':hover, &:focus'])
      expect(() =>
        Transform.compile({
          moduleId: 'list.ts',
          source: `import {css} from 'zyzz'; css({${JSON.stringify(selector)}:{color:'red'}})`,
        }),
      ).toThrow('Selector lists require explicit & selectors.')

    expect(
      Transform.compile({
        moduleId: 'list.ts',
        source: `import {css} from 'zyzz'; css({'&:is(:hover, :focus), &:active':{color:'red'}})`,
      }).css,
    ).toContain('&:is(')
  })
  test('requires explicit nesting in pseudo selector lists', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'list.ts',
        source:
          'import {css} from "zyzz"; css({":hover, :focus":{color:"red"}})',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: list.ts:31: Selector lists require explicit & selectors.]`,
    )
  })
  test('preserves authored nesting and resolves distinct threshold domains', () => {
    expect(Transform.compile({ moduleId: 'conditions.ts', source }).css)
      .toMatchInlineSnapshot(`
        ".z_theme-w47itm14d5v1i-theme{--z-tw47itm14d5v1i-theme-spacing_2e_small:4px;--z-tw47itm14d5v1i-theme-spacing_2e_large:16px;}
        .z-style-w47itm14d5v1i-207-atomic-padding-0{padding:var(--z-tw47itm14d5v1i-theme-spacing_2e_small,4px);}
        .z-style-w47itm14d5v1i-207-atomic-padding-1{&:hover{padding:var(--z-tw47itm14d5v1i-theme-spacing_2e_large,16px);}}
        .z-style-w47itm14d5v1i-207-atomic-width-2{@media (48rem <= width < 64rem){width:100px;}}
        .z-style-w47itm14d5v1i-207-atomic-height-3{@media (48rem <= width < 64rem){&[data-active]{height:20px;}}}
        .z-style-w47itm14d5v1i-207-atomic-display-4{@container sidebar (width >= 24rem){display:grid;}}
        .z-style-w47itm14d5v1i-207-atomic-gap-5{@supports (display:grid){gap:var(--z-tw47itm14d5v1i-theme-spacing_2e_small,4px);}}
        .z-style-w47itm14d5v1i-207-atomic-opacity-6{@starting-style{opacity:0;}}"
      `)
  })
  test('retains dynamic and theme variables inside nested contexts', () => {
    expect(
      Transform.compile({
        moduleId: 'dynamic.ts',
        source:
          'import {Theme} from "zyzz"; const theme=Theme.define({spacing:{gap:"4px"}}); export const box=theme.css((values:{alpha:number})=>({":hover":{opacity:values.alpha,marginLeft:`calc(${theme.vars.spacing.gap} + 2px)`}}))',
      }).css,
    ).toMatchInlineSnapshot(`
      ".z_theme-1h5dayl7tfv4v-theme{--z-t1h5dayl7tfv4v-theme-spacing_2e_gap:4px;}
      .z-style-1h5dayl7tfv4v-94-atomic-opacity-0{&:hover{opacity:var(--z-d1h5dayl7tfv4v-94-61-6c-70-68-61);}}
      .z-style-1h5dayl7tfv4v-94-atomic-marginLeft-1{&:hover{margin-left:calc(var(--z-t1h5dayl7tfv4v-theme-spacing_2e_gap,4px) + 2px);}}"
    `)
  })
  test('resolves imported thresholds through the packed contract', () => {
    const library = Graph.compile({
      modules: {
        'theme.ts':
          'import {Theme} from "zyzz"; export const theme=Theme.define({breakpoints:{tablet:"48rem"}})',
      },
    })

    const output = Graph.compile({
      contracts: { 'library.js': library.contracts['theme.ts']! },
      imports: { 'app.ts': { library: 'library.js' } },
      modules: {
        'app.ts':
          'import {theme} from "library"; export const box=theme.css({"@media tablet":{width:"100px"}})()',
      },
    })

    expect(output.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1xn44ix111xh3v-theme{}
      .z-style-1e8a67z1uaws1j-48-atomic-width-0{@media (width >= 48rem){width:100px;}}"
    `)
  })
  test.each([
    ['@media missing', 'Unknown query threshold.'],
    ['@media desktop..tablet', 'Query range must increase.'],
    ['@container missing >=card', 'Unknown container name.'],
  ])('rejects invalid alias %s', (key, message) => {
    try {
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {Theme} from "zyzz"; const theme=Theme.define({breakpoints:{tablet:"48rem",desktop:"64rem"},containers:{card:"24rem"}}); theme.css({${JSON.stringify(key)}:{width:"1px"}})`,
      })
      throw new Error('Expected rejection')
    } catch (error) {
      expect((error as Error).message.endsWith(message!)).toMatchInlineSnapshot(
        `true`,
      )
    }
  })
  test('rejects malformed selector syntax before emission', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: 'import {css} from "zyzz"; css({"&[":{color:"red"}})',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:31: Unbalanced condition delimiters.]`,
    )
  })
  test('Chromium resolves named container thresholds', async () => {
    const output = Transform.compile({
      moduleId: 'container.ts',
      source:
        'import {Theme} from "zyzz"; const theme=Theme.define({containers:{card:"24rem"},containerNames:["sidebar"]}); export const box=theme.css({width:"40px","@container sidebar >=card":{width:"100px"}})()',
    })

    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${output.css}</style><section id="container" style="container-type:inline-size;container-name:sidebar;width:500px"><div id="box" class="${Object.values(output.classes)[0]}"></div></section>`,
      )

      expect(
        await page
          .locator('#box')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"100px"`)

      await page
        .locator('#container')
        .evaluate((element) => ((element as HTMLElement).style.width = '300px'))

      expect(
        await page
          .locator('#box')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"40px"`)
    } finally {
      await browser.close()
    }
  })
  test('Chromium evaluates pointer and viewport conditions with ordered declarations', async () => {
    const output = Transform.compile({
      moduleId: 'browser.ts',
      source:
        'import {css} from "zyzz"; export const box=css({width:"40px",height:"20px",":hover":{width:"80px"},"@media (width >= 800px)":{height:"40px"},"&[data-active]":{opacity:0.5}})()',
    })

    const browser = await chromium.launch()

    try {
      const page = await browser.newPage({
        viewport: { width: 600, height: 500 },
      })

      await page.setContent(
        `<style>${output.css}</style><div id="box" class="${Object.values(output.classes)[0]}"></div>`,
      )

      expect(
        await page
          .locator('#box')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"40px"`)

      await page.locator('#box').hover()

      expect(
        await page
          .locator('#box')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"80px"`)

      await page.setViewportSize({ width: 900, height: 500 })

      expect(
        await page
          .locator('#box')
          .evaluate((element) => getComputedStyle(element).height),
      ).toMatchInlineSnapshot(`"40px"`)

      await page
        .locator('#box')
        .evaluate((element) => element.setAttribute('data-active', ''))

      expect(
        await page
          .locator('#box')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot(`"0.5"`)
    } finally {
      await browser.close()
    }
  })
})
