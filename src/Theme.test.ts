/**
 * Exercises the public Theme workflow through real collaborating modules.
 * @module
 */
import { theme as bundled, tokens as contextTokens } from './themes/default.js'
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'
import { Graph, Transform } from 'zyzz/compiler'
import { Css } from 'zyzz/web'

const tokens = {
  backgroundColor: { surface: { dark: '#111', light: '#fff' } },
  color: { brand: '#06c', unused: '#f00' },
  spacing: { md: '8px' },
} as const

describe('define', () => {
  test('bound authoring requires an explicit identity without compilation', () => {
    const theme = Theme.define(tokens)

    expect(() => theme.className).toThrowErrorMatchingInlineSnapshot(
      `[css.MissingTransformError: css requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.]`,
    )

    const { css } = theme

    expect(() =>
      css({ color: 'brand', padding: 'md' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Theme.define requires an explicit id without the compiler plugin.]`,
    )
    expect(Object.isFrozen(theme)).toMatchInlineSnapshot('true')
  })

  test('annotated token records compile with omitted optional groups', () => {
    const input: Theme.Tokens = { color: { brand: '#fff' }, spacing: undefined }
    const theme = Theme.define(input)
    const reference = theme.tokens.color!.brand as Theme.Reference<'color'>
    const output = Css.compile({
      styles: Style.define({ card: { color: reference } }),
      themes: { base: theme },
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".t_0{--z0:#fff;}
      .z-text-bJfYby{color:var(--z0,#fff);}"
    `)
  })

  test('escaped identifiers preserve independent styles and scoped palettes in Chromium', async () => {
    const base = Theme.define({
      color: { brand: { primary: '#fff' }, brand_2e_primary: '#000' },
    })
    const alternate = Theme.extend(base, {
      color: { brand: { primary: '#06c' }, brand_2e_primary: '#f00' },
    })

    const output = Css.compile({
      composition: 'independent',
      styles: Style.define({
        other: { color: base.tokens.color.brand_2e_primary },
        t_0: { color: '#175' },
        'z_theme-base': { color: base.tokens.color.brand.primary },
      }),
      themes: { base, 'foo.bar': alternate, foo_2e_bar: base },
    })

    expect(output.classes).toMatchInlineSnapshot(`
      {
        "other": "z-text-JqClw3-0",
        "t_0": "z-text-4iVqd5-0",
        "z_theme-base": "z-text-SnBR4v-0",
      }
    `)
    expect(output.css).toMatchInlineSnapshot(`
      ".t_0{--z0:#000;--z1:#fff;}
      .t_1{--z0:#f00;--z1:#06c;}
      .t_2{--z0:#000;--z1:#fff;}
      .z-text-JqClw3-0{color:var(--z0,#000);}
      .z-text-4iVqd5-0{color:#175;}
      .z-text-SnBR4v-0{color:var(--z1,#fff);}"
    `)
    expect(output.themes).toMatchInlineSnapshot(`
      {
        "base": "t_0",
        "foo.bar": "t_1",
        "foo_2e_bar": "t_2",
      }
    `)

    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(`<style>${output.css}</style>
        <section class="${output.themes['foo.bar']}">
          <div id="nested" class="${output.classes['z_theme-base']}"></div>
          <div id="escaped" class="${output.classes.other}"></div>
          <div id="collision" class="${output.classes.t_0}"></div>
        </section>
        <section class="${output.themes.foo_2e_bar}"><div id="base" class="${output.classes['z_theme-base']}"></div></section>`)

      expect(
        await page
          .locator('#nested')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(0, 102, 204)"')
      expect(
        await page
          .locator('#escaped')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
      expect(
        await page
          .locator('#collision')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(17, 119, 85)"')
      expect(
        await page
          .locator('#base')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(255, 255, 255)"')
    } finally {
      await browser.close()
    }
  })

  test('portable references compile to live variables and defining fallbacks', () => {
    const theme = Theme.define(tokens)
    const independent = Theme.define(tokens)

    const styles = Style.define({
      button: {
        backgroundColor: theme.tokens.backgroundColor.surface,
        color: theme.tokens.color.brand,
        padding: theme.tokens.spacing.md,
      },
      independent: { color: independent.tokens.color.brand },
    })

    const result = Css.compile({ styles, themes: { base: theme, independent } })

    expect(result.css).toMatchInlineSnapshot(`
      ".t_0{--z0:light-dark(#fff,#111);--z1:#06c;--z2:8px;}
      .t_1{--z3:#06c;}
      .z-bg-lyZQGr{background-color:var(--z0,light-dark(#fff,#111));}
      .z-text-hGV2TL-1{color:var(--z1,#06c);}
      .z-p-B1LbZi{padding:var(--z2,8px);}
      .z-text-AbT2X3-0{color:var(--z3,#06c);}"
    `)
    expect(result.classes).toMatchInlineSnapshot(`
      {
        "button": "z-bg-lyZQGr z-text-hGV2TL-1 z-p-B1LbZi",
        "independent": "z-text-AbT2X3-0",
      }
    `)
    expect(result.themes).toMatchInlineSnapshot(`
      {
        "base": "t_0",
        "independent": "t_1",
      }
    `)
    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(`
      ".z-bg-lyZQGr{background-color:var(--z0,light-dark(#fff,#111));}
      .z-text-hGV2TL-1{color:var(--z1,#06c);}
      .z-p-B1LbZi{padding:var(--z2,8px);}
      .z-text-AbT2X3-0{color:var(--z3,#06c);}"
    `)
    expect(Css.compile({ styles, themes: { independent, renamed: theme } }).css)
      .toMatchInlineSnapshot(`
        ".t_0{--z3:#06c;}
        .t_1{--z0:light-dark(#fff,#111);--z1:#06c;--z2:8px;}
        .z-bg-lyZQGr{background-color:var(--z0,light-dark(#fff,#111));}
        .z-text-hGV2TL-1{color:var(--z1,#06c);}
        .z-p-B1LbZi{padding:var(--z2,8px);}
        .z-text-AbT2X3-0{color:var(--z3,#06c);}"
      `)
    expect(Object.isFrozen(theme.tokens.spacing.md)).toMatchInlineSnapshot(
      'true',
    )
    expect(Object.keys(theme)).toMatchInlineSnapshot(`
      [
        "className",
        "css",
        "tokens",
        "variants",
        "vars",
      ]
    `)
  })

  test('theme scopes stay distinct from authored style names', () => {
    const theme = Theme.define(tokens)
    const styles = Style.define({
      'theme-base': { color: theme.tokens.color.brand },
    })

    expect(Css.compile({ styles, themes: { base: theme } }).css)
      .toMatchInlineSnapshot(`
        ".t_0{--z0:#06c;}
        .z-text-gsB0EO{color:var(--z0,#06c);}"
      `)
  })

  test('invalid authoring fails before CSS can be emitted without reading accessors', () => {
    const invalid = [
      { color: { brand: { light: '#fff' } } },
      { color: { brand: { dark: '#000', light: '#fff', system: '#ccc' } } },
      { color: { 'blue.500': '#fff' } },
      { color: {} },
    ]

    for (const input of invalid) {
      let error: unknown

      try {
        const theme = Reflect.apply(Theme.define, undefined, [
          input,
        ]) as Theme.Definition

        Css.compile({ styles: Style.define({}), themes: { base: theme } })
      } catch (cause) {
        error = cause
      }

      expect(error instanceof Theme.InvalidError).toMatchInlineSnapshot('true')
    }

    let reads = 0

    const input = {
      color: {
        get brand() {
          reads++

          return '#fff' as const
        },
      },
    }

    expect(() => Theme.define(input)).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["color"]: Expected nonempty keys without dots and enumerable data properties.]`,
    )
    expect(reads).toMatchInlineSnapshot('0')
  })
})

describe('extend', () => {
  test('object-shaped length overrides fail at the public boundary', () => {
    const theme = Theme.define({ spacing: { md: '1lh' } })

    expect(() =>
      Theme.extend(theme, { spacing: { md: {} } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["spacing","md"]: A token leaf cannot become a palette.]`,
    )
    expect(() =>
      Theme.extend(theme, { spacing: { md: [] } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["spacing","md"]: Expected a plain data record.]`,
    )
    expect(() =>
      Theme.extend(theme, { spacing: { md: () => '2rem' } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["spacing","md"]: Expected a plain data record.]`,
    )
  })

  test('undefined override leaves fail while omitted leaves inherit', () => {
    const theme = Theme.define({
      color: { brand: '#06c' },
      spacing: { md: '1lh' },
    })
    const alternate = Theme.extend(theme, { color: { brand: '#fff' } })
    const styles = Style.define({ card: { padding: theme.tokens.spacing.md } })

    expect(Css.compile({ styles, themes: { alternate, base: theme } }).css)
      .toMatchInlineSnapshot(`
        ".t_0{--z0:1lh;}
        .t_1{--z0:1lh;}
        .z-p-SVcDu8{padding:var(--z0,1lh);}"
      `)
    expect(() =>
      Theme.extend(theme, { spacing: { md: undefined } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["spacing","md"]: Expected a plain data record.]`,
    )
    expect(() =>
      Theme.extend(theme, { color: { brand: undefined } } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["color","brand"]: Expected a plain data record.]`,
    )
  })

  test('compatible overrides retain identities and reset every live inherited value', () => {
    const input = {
      color: { blue: { 500: '#06c' } },
      spacing: { md: '8px' },
    } as const
    const theme = Theme.define(input)
    const alternate = Theme.extend(theme, { color: { blue: { 500: '#f00' } } })
    const nested = Theme.extend(alternate, { spacing: { md: '12px' } })

    const styles = Style.define({
      button: {
        color: theme.tokens.color.blue[500],
        padding: theme.tokens.spacing.md,
      },
    })

    expect(
      Css.compile({ styles, themes: { alternate, base: theme, nested } }).css,
    ).toMatchInlineSnapshot(`
      ".t_0{--z0:#f00;--z1:8px;}
      .t_1{--z0:#06c;--z1:8px;}
      .t_2{--z0:#f00;--z1:12px;}
      .z-text-gsB0EO{color:var(--z0,#06c);}
      .z-p-Fm87Na{padding:var(--z1,8px);}"
    `)
    expect(
      Css.compile({
        styles: Style.define({
          button: { color: alternate.tokens.color.blue[500] },
        }),
      }).css,
    ).toMatchInlineSnapshot(`".z-text-3RFK8y{color:var(--z0,#f00);}"`)
    expect(input).toMatchInlineSnapshot(`
      {
        "color": {
          "blue": {
            "500": "#06c",
          },
        },
        "spacing": {
          "md": "8px",
        },
      }
    `)
    expect(() =>
      Reflect.apply(Theme.extend, undefined, [
        theme,
        { color: { blue: { 600: '#fff' } } },
      ]),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["color","blue","600"]: Extensions cannot add token paths.]`,
    )
    expect(() =>
      Reflect.apply(Theme.extend, undefined, [
        theme,
        { spacing: { md: { extra: '2px' } } },
      ]),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Theme.InvalidError: ["spacing","md"]: A token leaf cannot become a palette.]`,
    )
  })

  test('scopes and preferred schemes render independently in Chromium', async () => {
    const theme = Theme.define(tokens)
    const alternate = Theme.extend(theme, {
      backgroundColor: { surface: { dark: '#222', light: '#eee' } },
      spacing: { md: '16px' },
    })
    const nested = Theme.extend(theme, { color: { brand: '#f00' } })

    const styles = Style.define({
      button: {
        backgroundColor: theme.tokens.backgroundColor.surface,
        color: theme.tokens.color.brand,
        padding: theme.tokens.spacing.md,
      },
    })

    const output = Css.compile({
      styles,
      themes: { alternate, base: theme, nested },
    })
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage({ colorScheme: 'light' })

      await page.setContent(`<style>:root{color-scheme:light dark}${output.css}</style>
        <div id="fallback" class="${output.classes.button}"></div>
        <section class="${output.themes.alternate}">
          <div id="alternate" class="${output.classes.button}"></div>
          <section class="${output.themes.nested}"><div id="nested" class="${output.classes.button}"></div></section>
          <div id="forced" style="color-scheme:dark" class="${output.classes.button}"></div>
        </section>`)

      async function read(id: string) {
        return page.locator(`#${id}`).evaluate((element) => {
          const style = getComputedStyle(element)

          return {
            backgroundColor: style.backgroundColor,
            color: style.color,
            padding: style.padding,
          }
        })
      }

      expect(await read('fallback')).toMatchInlineSnapshot(`
        {
          "backgroundColor": "rgb(255, 255, 255)",
          "color": "rgb(0, 102, 204)",
          "padding": "8px",
        }
      `)
      expect(await read('alternate')).toMatchInlineSnapshot(`
        {
          "backgroundColor": "rgb(238, 238, 238)",
          "color": "rgb(0, 102, 204)",
          "padding": "16px",
        }
      `)
      expect(await read('nested')).toMatchInlineSnapshot(`
        {
          "backgroundColor": "rgb(255, 255, 255)",
          "color": "rgb(255, 0, 0)",
          "padding": "8px",
        }
      `)
      expect(await read('forced')).toMatchInlineSnapshot(`
        {
          "backgroundColor": "rgb(34, 34, 34)",
          "color": "rgb(0, 102, 204)",
          "padding": "16px",
        }
      `)

      await page.emulateMedia({ colorScheme: 'dark' })

      expect(await read('fallback')).toMatchInlineSnapshot(`
        {
          "backgroundColor": "rgb(17, 17, 17)",
          "color": "rgb(0, 102, 204)",
          "padding": "8px",
        }
      `)
      expect(await read('nested')).toMatchInlineSnapshot(`
        {
          "backgroundColor": "rgb(17, 17, 17)",
          "color": "rgb(255, 0, 0)",
          "padding": "8px",
        }
      `)
    } finally {
      await browser.close()
    }
  })
})

describe('queries', () => {
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
      ".z-font-size-pT9O1S{font-size:var(--z0,1.5rem);}
      .z-border-radius-EaHYnW{border-radius:var(--z1,1rem);}"
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
        .z-font-family-p8Bi9V{font-family:var(--z-t26ntzho2pyyt-theme-fontFamily_2e_sans,Geist, ui-sans-serif, system-ui, sans-serif);}
        .z-font-size-1ft8_Q{font-size:var(--z-t26ntzho2pyyt-theme-fontSize_2e_base,1rem);}
        .z-text-aBVyXQ{color:var(--z-t26ntzho2pyyt-theme-color_2e_blue_2e_500,oklch(62.3% 0.214 259.815));}"
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
        .z-font-size-kdtzCc{font-size:var(--z0,1rem);}
        .z-font-weight-hMXM99{font-weight:var(--z1,500);}"
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
        .z-font-size-6_nacQ{font-size:var(--z-t1xn44ix111xh3v-theme-fontSize_2e_body,1rem);}"
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
        .z-text-3Tq_IH{color:var(--z0,light-dark(#111,#fff));}
        .z-font-family--hJCD3{font-family:var(--z1,Geist, ui-sans-serif, system-ui, sans-serif);}
        .z-font-size-4nuiGJ{font-size:var(--z2,1rem);}
        .z-p-3OsuE-{padding:var(--z3,1rem);}"
      `)
      expect(contextTokens.breakpoints.md).toMatchInlineSnapshot(`"48rem"`)
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
})
