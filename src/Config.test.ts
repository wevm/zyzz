/**
 * Exercises configuration normalization through style validation and CSS emission.
 * @module
 */
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Config, Style, Theme } from 'zyzz'
import { Css } from 'zyzz/web'

describe('create', () => {
  test('mixed named inputs share isolated scopes and retain the default fallback', () => {
    const base = Theme.define({
      color: { brand: '#06c' },
      spacing: { md: '8px' },
    })
    const zyzz = Config.create({
      defaultTheme: 'base',
      themes: {
        base,
        mint: {
          color: { brand: { light: '#175', dark: '#afa' } },
          spacing: { md: '12px' },
        },
      },
    })
    const output = Css.compile({
      styles: Style.define({
        card: {
          color: zyzz.themes.base.tokens.color.brand,
          padding: zyzz.themes.base.tokens.spacing.md,
        },
      }),
      themes: zyzz.themes,
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".t_0{--z0:#06c;--z1:8px;}
      .t_1{--z0:light-dark(#175,#afa);--z1:12px;}
      .z_base0{color:var(--z0,#06c);padding:var(--z1,8px);}"
    `)
    expect(Object.isFrozen(zyzz.themes)).toMatchInlineSnapshot(`true`)
    expect(zyzz.themes.base === base).toMatchInlineSnapshot(`false`)
    // The original definition cannot become a scope for the normalized contract.
    expect(
      Css.compile({
        styles: Style.define({
          card: { color: zyzz.themes.base.tokens.color.brand },
        }),
        themes: { original: base },
      }).css,
    ).toMatchInlineSnapshot(
      `".z_base0{color:var(--z0,#06c);}"`,
    )
    const other = Config.create({ theme: base })
    expect(
      Css.compile({
        styles: Style.define({
          card: { color: other.theme.tokens.color.brand },
        }),
        themes: zyzz.themes,
      }).css,
    ).toMatchInlineSnapshot(
      `".z_base0{color:var(--z0,#06c);}"`,
    )
  })

  test('normalized themes inherit and select schemes in Chromium', async () => {
    const zyzz = Config.create({
      defaultTheme: 'base',
      themes: {
        base: {
          color: { brand: { light: '#06c', dark: '#9cf' } },
          spacing: { md: '8px' },
        },
        mint: {
          color: { brand: { light: '#175', dark: '#afa' } },
          spacing: { md: '12px' },
        },
      },
    })
    const output = Css.compile({
      styles: Style.define({
        card: {
          color: zyzz.themes.base.tokens.color.brand,
          padding: zyzz.themes.base.tokens.spacing.md,
        },
      }),
      themes: zyzz.themes,
    })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><main class="${output.themes.mint}"><div id="mint" class="${output.classes.card}"></div><section class="${output.themes.base}"><div id="base" class="${output.classes.card}"></div></section></main>`,
      )
      expect(
        await page
          .locator('#mint')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(17, 119, 85)"`)
      expect(
        await page
          .locator('#mint')
          .evaluate((element) => getComputedStyle(element).padding),
      ).toMatchInlineSnapshot(`"12px"`)
      expect(
        await page
          .locator('#base')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(0, 102, 204)"`)
      await page.evaluate(() => {
        document.documentElement.style.colorScheme = 'dark'
      })
      expect(
        await page
          .locator('#mint')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(170, 255, 170)"`)
      expect(
        await page
          .locator('#base')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(153, 204, 255)"`)
    } finally {
      await browser.close()
    }
  })

  test('single inline themes and reusable extensions retain validated values', () => {
    const base = Theme.define({ spacing: { md: '8px' } })
    const zyzz = Config.create({
      theme: Theme.extend(base, { spacing: { md: '12px' } }),
    })
    expect(
      Css.compile({
        styles: Style.define(
          { card: { padding: 'md' } },
          { theme: zyzz.theme },
        ),
        themes: { selected: zyzz.theme },
      }).css,
    ).toMatchInlineSnapshot(`
      ".t_0{--z0:12px;}
      .z_base0{padding:var(--z0,12px);}"
    `)
    const inline = Config.create({ theme: { spacing: { md: '1rem' } } })
    expect(
      Css.compile({
        styles: Style.define({
          card: { padding: inline.theme.tokens.spacing.md },
        }),
      }).css,
    ).toMatchInlineSnapshot(
      `".z_base0{padding:var(--z0,1rem);}"`,
    )
    expect(() =>
      zyzz.css({ padding: 'md' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[css.MissingTransformError: css requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.]`,
    )
    expect(() =>
      Config.create().css({ padding: '8px' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[css.MissingTransformError: css requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.]`,
    )
  })

  test('rejects unknown default before CSS emission', () => {
    expect(() =>
      emit({
        defaultTheme: 'missing',
        themes: { base: { color: { brand: '#06c' } } },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: defaultTheme must name a theme in the catalog.]`,
    )
  })
  test('rejects incompatible paths before CSS emission', () => {
    expect(() =>
      emit({
        defaultTheme: 'base',
        themes: {
          base: { color: { brand: '#06c' } },
          mint: { color: { other: '#175' } },
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: Theme "mint" must have the default theme's complete token paths and domains.]`,
    )
  })
  test('rejects mixed modes before CSS emission', () => {
    expect(() =>
      emit({ theme: {}, themes: {} }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: Use either theme or themes, not both.]`,
    )
  })
  test('rejects default without catalog before CSS emission', () => {
    expect(() =>
      emit({ defaultTheme: 'base' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: defaultTheme requires a named themes catalog.]`,
    )
  })
  test('rejects invalid token domain before CSS emission', () => {
    expect(() =>
      emit({ theme: { spacing: { md: '#fff' } } }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: ["spacing","md"]: Expected a nonnegative literal length or numeric zero.]`,
    )
  })
  test('rejects duplicate layers before CSS emission', () => {
    expect(() =>
      emit({ layers: ['base', 'base'] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: Duplicate layer: base]`,
    )
  })
  test('rejects reserved layers before CSS emission', () => {
    expect(() =>
      emit({ layers: ['base', 'initial'] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: Layer names must be plain CSS identifiers, optionally dotted.]`,
    )
  })
  test('rejects invalid layer names before CSS emission', () => {
    expect(() =>
      emit({ layers: ['base', 'bad name'] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: Layer names must be plain CSS identifiers, optionally dotted.]`,
    )
  })
})

function emit(input: unknown) {
  const config = Config.create(input as Config.create.Options)
  return Css.compile({
    styles: Style.define({ card: { color: '#06c' } }),
    themes: 'themes' in config ? config.themes : {},
  })
}
