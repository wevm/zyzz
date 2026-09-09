/**
 * Exercises the public Theme workflow through real collaborating modules.
 * @module
 */
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'
import { Css } from 'zyzz/web'

const tokens = {
  backgroundColor: { surface: { dark: '#111', light: '#fff' } },
  color: { brand: '#06c', unused: '#f00' },
  spacing: { md: '8px' },
} as const

describe('define', () => {
  test('bound authoring requires a transform and never generates runtime CSS', () => {
    const theme = Theme.define(tokens)
    expect(() => theme.className).toThrowErrorMatchingInlineSnapshot(
      `[css.MissingTransformError: css requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.]`,
    )
    const { css } = theme
    expect(() =>
      css({ color: 'brand', padding: 'md' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[css.MissingTransformError: css requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.]`,
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
      ".z_theme-base{--z-t0-color_2e_brand:#fff;}
      .z_base0{color:var(--z-t0-color_2e_brand,#fff);}"
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
        'z_theme-base': { color: base.tokens.color.brand.primary },
      }),
      themes: { base, 'foo.bar': alternate, foo_2e_bar: base },
    })
    expect(output.classes).toMatchInlineSnapshot(`
      {
        "other": "other",
        "z_theme-base": "z_5f_theme-base",
      }
    `)
    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-base{--z-t0-color_2e_brand_5f_2e_5f_primary:#000;--z-t0-color_2e_brand_2e_primary:#fff;}
      .z_theme-foo_2e_bar{--z-t0-color_2e_brand_5f_2e_5f_primary:#f00;--z-t0-color_2e_brand_2e_primary:#06c;}
      .z_theme-foo_5f_2e_5f_bar{--z-t0-color_2e_brand_5f_2e_5f_primary:#000;--z-t0-color_2e_brand_2e_primary:#fff;}
      .other{color:var(--z-t0-color_2e_brand_5f_2e_5f_primary,#000);}
      .z_5f_theme-base{color:var(--z-t0-color_2e_brand_2e_primary,#fff);}"
    `)
    expect(output.themes).toMatchInlineSnapshot(`
      {
        "base": "z_theme-base",
        "foo.bar": "z_theme-foo_2e_bar",
        "foo_2e_bar": "z_theme-foo_5f_2e_5f_bar",
      }
    `)

    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(`<style>${output.css}</style>
        <section class="${output.themes['foo.bar']}">
          <div id="nested" class="${output.classes['z_theme-base']}"></div>
          <div id="escaped" class="${output.classes.other}"></div>
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
      ".z_theme-base{--z-t0-backgroundColor_2e_surface:light-dark(#fff,#111);--z-t0-color_2e_brand:#06c;--z-t0-spacing_2e_md:8px;}
      .z_theme-independent{--z-t1-color_2e_brand:#06c;}
      .z_base0{background-color:var(--z-t0-backgroundColor_2e_surface,light-dark(#fff,#111));padding:var(--z-t0-spacing_2e_md,8px);}
      .z-button{color:var(--z-t0-color_2e_brand,#06c);}
      .z-independent{color:var(--z-t1-color_2e_brand,#06c);}"
    `)
    expect(result.classes).toMatchInlineSnapshot(`
      {
        "button": "z_base0 z-button",
        "independent": "z-independent",
      }
    `)
    expect(result.themes).toMatchInlineSnapshot(`
      {
        "base": "z_theme-base",
        "independent": "z_theme-independent",
      }
    `)
    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(`
      ".z_base0{background-color:var(--z-t0-backgroundColor_2e_surface,light-dark(#fff,#111));padding:var(--z-t0-spacing_2e_md,8px);}
      .z-button{color:var(--z-t0-color_2e_brand,#06c);}
      .z-independent{color:var(--z-t1-color_2e_brand,#06c);}"
    `)
    expect(Css.compile({ styles, themes: { independent, renamed: theme } }).css)
      .toMatchInlineSnapshot(`
      ".z_theme-independent{--z-t1-color_2e_brand:#06c;}
      .z_theme-renamed{--z-t0-backgroundColor_2e_surface:light-dark(#fff,#111);--z-t0-color_2e_brand:#06c;--z-t0-spacing_2e_md:8px;}
      .z_base0{background-color:var(--z-t0-backgroundColor_2e_surface,light-dark(#fff,#111));padding:var(--z-t0-spacing_2e_md,8px);}
      .z-button{color:var(--z-t0-color_2e_brand,#06c);}
      .z-independent{color:var(--z-t1-color_2e_brand,#06c);}"
    `)
    expect(Object.isFrozen(theme.tokens.spacing.md)).toMatchInlineSnapshot(
      'true',
    )
    expect(Object.keys(theme)).toMatchInlineSnapshot(`
      [
        "className",
        "css",
        "tokens",
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
      ".z_theme-base{--z-t0-color_2e_brand:#06c;}
      .z_base0{color:var(--z-t0-color_2e_brand,#06c);}"
    `)
  })

  test('invalid authoring fails before CSS can be emitted without reading accessors', () => {
    const invalid = [
      { color: { brand: { light: '#fff' } } },
      { color: { brand: { dark: '#000', light: '#fff', system: '#ccc' } } },
      { color: { 'blue.500': '#fff' } },
      { color: { brand: '#fff;display:none' } },
      { spacing: { md: '-1px' } },
      { spacing: { md: { dark: '1rem', light: '2rem' } } },
      { color: {} },
      { color: { brand: 'inherit' } },
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

    const theme = Theme.define(tokens)
    expect(() =>
      Reflect.apply(Style.define, undefined, [
        { button: { padding: theme.tokens.color.brand } },
      ]),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["button","padding"]: Token group is incompatible with this property.]`,
    )
    expect(() =>
      Css.compile({
        styles: {
          styles: [
            {
              declarations: [
                { property: 'padding', value: theme.tokens.color.brand },
              ],
              name: 'button',
            },
          ],
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Css.CompileError: ["button","padding"]: Token group is incompatible with this property.]`,
    )
  })
})

describe('extend', () => {
  test('undefined override leaves fail while omitted leaves inherit', () => {
    const theme = Theme.define({
      color: { brand: '#06c' },
      spacing: { md: '1lh' },
    })
    const alternate = Theme.extend(theme, { color: { brand: '#fff' } })
    const styles = Style.define({ card: { padding: theme.tokens.spacing.md } })
    expect(Css.compile({ styles, themes: { alternate, base: theme } }).css)
      .toMatchInlineSnapshot(`
      ".z_theme-alternate{--z-t0-spacing_2e_md:1lh;}
      .z_theme-base{--z-t0-spacing_2e_md:1lh;}
      .z_base0{padding:var(--z-t0-spacing_2e_md,1lh);}"
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
      ".z_theme-alternate{--z-t0-color_2e_blue_2e_500:#f00;--z-t0-spacing_2e_md:8px;}
      .z_theme-base{--z-t0-color_2e_blue_2e_500:#06c;--z-t0-spacing_2e_md:8px;}
      .z_theme-nested{--z-t0-color_2e_blue_2e_500:#f00;--z-t0-spacing_2e_md:12px;}
      .z_base0{color:var(--z-t0-color_2e_blue_2e_500,#06c);padding:var(--z-t0-spacing_2e_md,8px);}"
    `)
    expect(
      Css.compile({
        styles: Style.define({
          button: { color: alternate.tokens.color.blue[500] },
        }),
      }).css,
    ).toMatchInlineSnapshot(
      `".z_base0{color:var(--z-t0-color_2e_blue_2e_500,#f00);}"`,
    )
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
