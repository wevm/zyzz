/** Exercises scalar typography, isolated query metadata, and packed theme contracts. @module */
import * as Fs from 'node:fs/promises'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'
import { Graph, Transform } from 'zyzz/compiler'
import { Css } from 'zyzz/web'
import { theme as bundled, tokens } from './themes/default.js'

describe('compile', () => {
  test('preserves dashed and non-ASCII container identifiers', () => {
    expect(() =>
      Theme.define({ containerNames: ['--sidebar', '-sidebar', '侧栏'] }),
    ).not.toThrow()
  })
  test('retains query groups in packed configuration options', () => {
    const result = Graph.compile({
      modules: {
        'config.ts':
          'import {Config,Theme} from "zyzz"; const theme=Theme.define({breakpoints:{tablet:"48rem"},containers:{card:"24rem"},containerNames:["sidebar"]}); export const zyzz=Config.create({theme})',
      },
    })

    expect(
      JSON.parse(result.contracts['config.ts']!).version,
    ).toMatchInlineSnapshot(`17`)
    expect(JSON.parse(result.contracts['config.ts']!).exports.zyzz.options)
      .toMatchInlineSnapshot(`
      {
        "theme": {
          "breakpoints": {
            "tablet": "48rem",
          },
          "containerNames": [
            "sidebar",
          ],
          "containers": {
            "card": "24rem",
          },
        },
      }
    `)
  })
  test('resolves numeric scale names and preserves typography palette keys', () => {
    const theme = Theme.define({
      fontSize: { '2xl': '1.5rem' },
      borderRadius: { '2xl': '1rem' },
    })

    expect(
      Css.compile({
        styles: Style.define(
          { body: { fontSize: '2xl', borderRadius: '2xl' } },
          { theme },
        ),
      }).css,
    ).toMatchInlineSnapshot(
      `
      ".z-font-size-spaxontqspvx{font-size:var(--z0,1.5rem);}
      .z-border-radius-18kv7mn18gwtp1{border-radius:var(--z1,1rem);}"
    `,
    )
  })
  test('keeps generated bundled values synchronized', async () => {
    const source = await Fs.readFile(
      new URL('./themes/default.ts', import.meta.url),
      'utf8',
    )
    const raw = source.slice(
      source.indexOf('export const tokens = ') + 22,
      source.indexOf(' as const'),
    )

    const generated = source.slice(
      source.indexOf('export const theme = Theme.define(') + 34,
      source.indexOf(
        ')\n',
        source.indexOf('export const theme = Theme.define('),
      ),
    )

    expect(raw.trim() === generated.trim()).toMatchInlineSnapshot(`true`)
  })
  test('links bundled source through its exported css boundary', async () => {
    const source = await Fs.readFile(
      new URL('./themes/default.ts', import.meta.url),
      'utf8',
    )

    const output = Graph.compile({
      modules: {
        'default.ts': source,
        'app.ts':
          'import {css} from "./default.js"; export const body=css({fontFamily:"sans",fontSize:"base",color:"blue.500"})()',
      },
    })

    expect(output.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-26ntzho2pyyt-theme{--z-t26ntzho2pyyt-theme-fontFamily_2e_sans:Geist, ui-sans-serif, system-ui, sans-serif;--z-t26ntzho2pyyt-theme-fontSize_2e_base:1rem;--z-t26ntzho2pyyt-theme-color_2e_blue_2e_500:oklch(62.3% 0.214 259.815);}
      .z-font-family-1e8a67zly006l{font-family:var(--z-t26ntzho2pyyt-theme-fontFamily_2e_sans,Geist, ui-sans-serif, system-ui, sans-serif);}
      .z-font-size-1e8a67zly006l{font-size:var(--z-t26ntzho2pyyt-theme-fontSize_2e_base,1rem);}
      .z-text-1e8a67zly006l{color:var(--z-t26ntzho2pyyt-theme-color_2e_blue_2e_500,oklch(62.3% 0.214 259.815));}"
    `)

    const built = await Esbuild.build({
      stdin: {
        contents: 'import * as root from "zyzz/compiler"; console.log(root)',
        resolveDir: import.meta.dirname,
      },
      bundle: true,
      platform: 'node',
      external: ['oxc-parser', 'lightningcss'],
      write: false,
      metafile: true,
      conditions: ['src'],
    })

    expect(
      Object.keys(built.metafile!.inputs).some((path) =>
        path.includes('themes/default'),
      ),
    ).toMatchInlineSnapshot(`false`)
  })
  test('rejects sparse and accessor container identities', () => {
    const sparse: string[] = []

    sparse.length = 1

    expect(() => Theme.define({ containerNames: sparse })).toThrow(
      Theme.InvalidError,
    )

    let invoked = false

    const names = Object.defineProperty([], '0', {
      get() {
        invoked = true

        return 'card'
      },
    })

    expect(() => Theme.define({ containerNames: names })).toThrow(
      Theme.InvalidError,
    )
    expect(invoked).toMatchInlineSnapshot(`false`)
  })
  test('emits typography variables without emitting threshold variables', () => {
    const theme = Theme.define({
      breakpoints: { tablet: '48rem' },
      containers: { card: '24rem' },
      containerNames: ['sidebar'],
      fontSize: { body: '1rem' },
      fontWeight: { medium: 500 },
    })

    const alternate = Theme.extend(theme, {
      breakpoints: { tablet: '50rem' },
      fontSize: { body: '1.25rem' },
    })

    const styles = Style.define({
      body: {
        fontSize: theme.tokens.fontSize.body,
        fontWeight: theme.tokens.fontWeight.medium,
      },
    })

    const output = Css.compile({ styles, themes: { base: theme, alternate } })

    expect(output.css).toMatchInlineSnapshot(`
      ".t_0{--z0:1rem;--z1:500;}
      .t_1{--z0:1.25rem;--z1:500;}
      .z-font-size-mfi2e01haafcm{font-size:var(--z0,1rem);}
      .z-font-weight-jps5k417zvdkc{font-weight:var(--z1,500);}"
    `)
    expect(Object.keys(theme.vars)).toMatchInlineSnapshot(`
      [
        "fontSize",
        "fontWeight",
      ]
    `)
  })
  test('retains query metadata in packed contracts', () => {
    const library = Graph.compile({
      modules: {
        'theme.ts':
          'import {Theme} from "zyzz"; export const theme=Theme.define({breakpoints:{tablet:"48rem"},fontSize:{body:"1rem"}})',
      },
    })

    const packed = library.contracts['theme.ts']!

    expect(packed.includes('48rem')).toMatchInlineSnapshot(`true`)

    const consumer = Graph.compile({
      contracts: { 'library.js': packed },
      imports: { 'app.ts': { library: 'library.js' } },
      modules: {
        'app.ts':
          'import {theme} from "library"; export const body=theme.css({fontSize:"body"})()',
      },
    })

    expect(consumer.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1xn44ix111xh3v-theme{--z-t1xn44ix111xh3v-theme-fontSize_2e_body:1rem;}
      .z-font-size-1e8a67zly006l{font-size:var(--z-t1xn44ix111xh3v-theme-fontSize_2e_body,1rem);}"
    `)
  })
  test('Chromium applies bundled typography and scheme colors', async () => {
    const styles = Style.define({
      body: {
        fontSize: bundled.tokens.fontSize.base,
        color: bundled.tokens.color.foreground,
      },
    })

    const output = Css.compile({ styles, themes: { base: bundled } })
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${output.css}</style><div class="${output.themes.base}" style="color-scheme:light"><p id="body" class="${output.classes.body}">Text</p></div>`,
      )

      expect(
        await page
          .locator('#body')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot(`"16px"`)
      expect(
        await page
          .locator('#body')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(17, 17, 17)"`)

      await page
        .locator('#body')
        .evaluate(
          (element) => (element.parentElement!.style.colorScheme = 'dark'),
        )

      expect(
        await page
          .locator('#body')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(255, 255, 255)"`)
    } finally {
      await browser.close()
    }
  })
  test('compiles the opt-in bundled typography and palette', () => {
    const styles = Style.define({
      body: {
        color: bundled.tokens.color.foreground,
        fontFamily: bundled.tokens.fontFamily.sans,
        fontSize: bundled.tokens.fontSize.base,
        padding: bundled.tokens.spacing[4],
      },
    })

    const output = Css.compile({ styles, themes: { default: bundled } })

    expect(output.css).toMatchInlineSnapshot(`
      ".t_0{--z0:light-dark(#111,#fff);--z1:Geist, ui-sans-serif, system-ui, sans-serif;--z2:1rem;--z3:1rem;}
      .z-text-4agpf61de4iwe{color:var(--z0,light-dark(#111,#fff));}
      .z-font-family-1y87rfgfbaelm{font-family:var(--z1,Geist, ui-sans-serif, system-ui, sans-serif);}
      .z-font-size-4uh2221pt2df8{font-size:var(--z2,1rem);}
      .z-p-47cuxv1vyt2wv{padding:var(--z3,1rem);}"
    `)
    expect(tokens.breakpoints.md).toMatchInlineSnapshot(`"48rem"`)
  })
  test.each([
    '"-1px"',
    '"50%"',
    '20',
    '"var(--screen)"',
    '{light:"1px",dark:"2px"}',
  ])('rejects invalid threshold %s', (value) => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {Theme} from "zyzz"; const theme=Theme.define({breakpoints:{tablet:${value}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:40: ["breakpoints","tablet"]: Expected a named nonnegative length threshold.]`,
    )
  })
})

describe('define', () => {
  test('preserves typography palette and exponent threshold keys', () => {
    expect(
      Theme.define({
        fontWeight: { body: { light: 300, bold: 700 } },
        containers: { screen: '1e3px' },
      }).tokens.fontWeight.body.light.value,
    ).toMatchInlineSnapshot(`300`)
  })
})
