/** Verifies ordered nesting, query identities, scalar inference, and native browser conditions. @module */
import * as Trace from '@jridgewell/trace-mapping'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

const source =
  'import {Theme} from "zyzz"; const theme=Theme.define({breakpoints:{tablet:"48rem",desktop:"64rem"},containers:{card:"24rem"},containerNames:["sidebar"],spacing:{small:"4px",large:"16px"}}); export const box=theme.css({padding:"small", ":hover":{padding:"large"}, "@media tablet..desktop":{width:"100px","&[data-active]":{height:"20px"}}, "@container sidebar >=card":{display:"grid"},"@supports (display:grid)":{gap:"small"},"@starting-style":{opacity:0}})()'
describe('conditions', () => {
  test('maps nested declarations and passes through raw media lists', () => {
    const source =
      'import {css} from "zyzz"; css({color:"red","@media screen, print":{padding:"2px"}})'
    const output = Transform.compile({ moduleId: 'mapped.ts', source })
    expect(output.css).toMatchInlineSnapshot(
      `".z-style-cqzv9l1th5n7r-26{color:red;@media screen, print{padding:2px;}}"`,
    )
    const column = output.css.indexOf('padding:')
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: 1,
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
      .z-style-w47itm14d5v1i-207{padding:var(--z-tw47itm14d5v1i-theme-spacing_2e_small,4px);&:hover{padding:var(--z-tw47itm14d5v1i-theme-spacing_2e_large,16px);}@media (48rem <= width < 64rem){width:100px;&[data-active]{height:20px;}}@container sidebar (width >= 24rem){display:grid;}@supports (display:grid){gap:var(--z-tw47itm14d5v1i-theme-spacing_2e_small,4px);}@starting-style{opacity:0;}}"
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
      .z-style-1h5dayl7tfv4v-94{&:hover{opacity:var(--z-d1h5dayl7tfv4v-94-61-6c-70-68-61);margin-left:calc(var(--z-t1h5dayl7tfv4v-theme-spacing_2e_gap,4px) + 2px);}}"
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
      .z-style-1e8a67z1uaws1j-48{@media (width >= 48rem){width:100px;}}"
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
      `[Source.ExtractError: invalid.ts:26: Invalid selector or condition: Unexpected end of input]`,
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
