/** Verifies theme variable identity through source graphs, emission, and browser inheritance. @module */
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source, Transform } from 'zyzz/compiler'

describe('compile', () => {
  test('retains type-only generic references to Vars', () => {
    const output = Transform.compile({
      moduleId: 'generic.ts',
      source:
        'import {Vars} from "zyzz"; const v=Vars.define({gap:"length"}); function identity<T>(v:T){return v}; export const typed=identity<Vars.Definition<{gap:"length"}>>(v)',
    })
    expect(output.code).toMatchInlineSnapshot(
      `"import {Vars} from "zyzz"; const v=Object.freeze({["gap"]:Object.freeze({"name":"--z-v1cd72gh91mozv-76-67-61-70","type":"length","variable":true})}); function identity<T>(v:T){return v}; export const typed=identity<Vars.Definition<{gap:"length"}>>(v)"`,
    )
  })
  test('rejects namespace Vars authoring', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'namespace.ts',
        source:
          'import * as zyzz from "zyzz"; export const v=zyzz.Vars.define({gap:"length"})',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: namespace.ts:45: Import Vars by name; namespace authoring calls are not supported yet.]`,
    )
  })

  test('preserves assertions around nested variable templates and fallbacks', () => {
    expect(
      Transform.compile({
        moduleId: 'assertions.ts',
        source:
          'import { Theme, css } from "zyzz"; const theme=Theme.define({spacing:{md:"8px"}}); css({width:["1px", (`calc(${(`${theme.vars.spacing.md}` satisfies string)})` as string)]})',
      }).css,
    ).toMatchInlineSnapshot(`
      ".z_theme-1jvt0134f5zz3-theme{--z-t1jvt0134f5zz3-theme-spacing_2e_md:8px;}
      .z-1jvt0134f5zz3-base0{width:1px;width:calc(var(--z-t1jvt0134f5zz3-theme-spacing_2e_md,8px));}"
    `)
  })
  test('rejects spacing variables in integer properties', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'domains.ts',
        source:
          'import { Theme, css } from "zyzz"; const theme=Theme.define({spacing:{md:"8px"}}); css({maxLines:theme.vars.spacing.md})',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: domains.ts:97: Theme variable domain is incompatible with this property.]`,
    )
  })

  test('retains live references in root declarations and important templates', () => {
    const source = [
      'import { Theme, css } from "zyzz";',
      'const theme = Theme.define({spacing:{md:"8px"},color:{brand:"red",unused:"blue"}});',
      'export const box = css({width:`calc(100% - ${theme.vars.spacing.md})!`, color:theme.vars.color.brand})()',
    ].join('\n')
    expect(Transform.compile({ moduleId: 'vars.ts', source }).css)
      .toMatchInlineSnapshot(`
      ".z_theme-4t4nbe1og4cic-theme{--z-t4t4nbe1og4cic-theme-spacing_2e_md:8px;--z-t4t4nbe1og4cic-theme-color_2e_brand:red;}
      .z-4t4nbe1og4cic-base0{width:calc(100% - var(--z-t4t4nbe1og4cic-theme-spacing_2e_md,8px))!important;color:var(--z-t4t4nbe1og4cic-theme-color_2e_brand,red);}"
    `)
  })

  test('links imported variables and compatible scopes without copying declaration values', () => {
    const result = Graph.compile({
      modules: {
        'theme.ts':
          'import { Theme } from "zyzz"; export const theme = Theme.define({ spacing: { md: "8px" }, color: { brand: { light: "red", dark: "blue" } } }); export const alt = Theme.extend(theme, { spacing: { md: "16px" } });',
        'app.ts':
          'import { css } from "zyzz"; import { theme as palette, alt } from "./theme.js"; export const box = css({ width: `calc(100% - ${palette.vars.spacing.md})`, color: palette.vars.color.brand })(); export const scope = alt.className;',
      },
    })
    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1xn44ix111xh3v-theme{--z-t1xn44ix111xh3v-theme-spacing_2e_md:8px;--z-t1xn44ix111xh3v-theme-color_2e_brand:light-dark(red,blue);}
      .z_theme-1xn44ix111xh3v-alt{--z-t1xn44ix111xh3v-theme-spacing_2e_md:16px;--z-t1xn44ix111xh3v-theme-color_2e_brand:light-dark(red,blue);}
      .z-1e8a67z1uaws1j-base0{width:calc(100% - var(--z-t1xn44ix111xh3v-theme-spacing_2e_md,8px));color:var(--z-t1xn44ix111xh3v-theme-color_2e_brand,light-dark(red,blue));}"
    `)
    expect(result.modules['theme.ts']!.css).toMatchInlineSnapshot(`""`)
  })

  test('compiles named configuration variables from packed contracts', () => {
    const library = Graph.compile({
      modules: {
        'config.ts':
          'import { Config } from "zyzz"; export const zyzz = Config.create({ theme: { spacing: { md: "8px" } } });',
      },
    })
    const output = Graph.compile({
      contracts: { 'library/index.js': library.contracts['config.ts']! },
      imports: { 'app.ts': { '@acme/theme': 'library/index.js', zyzz: null } },
      modules: {
        'app.ts':
          'import { css } from "zyzz"; import { zyzz } from "@acme/theme"; export const box = css({width:`calc(100% - ${zyzz.theme.vars.spacing.md})`})()',
      },
    })
    expect(output.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-u8smm21l81sow-zyzz-theme{--z-tu8smm21l81sow-zyzz-spacing_2e_md:8px;}
      .z-1e8a67z1uaws1j-base0{width:calc(100% - var(--z-tu8smm21l81sow-zyzz-spacing_2e_md,8px));}"
    `)
    expect(
      output.modules['app.ts']!.code.includes('.vars'),
    ).toMatchInlineSnapshot(`false`)
  })

  test.each([
    [
      'escaped reads',
      'export const value = String(theme.vars.spacing.md)',
      'Token references must be direct',
    ],
    [
      'wrong domains',
      'css({ color: `${theme.vars.spacing.md}` })',
      'incompatible',
    ],
    [
      'unknown paths',
      'css({ width: `${theme.vars.spacing.missing}` })',
      'Unknown theme token path',
    ],
  ])('rejects %s', (_name, source, message) => {
    try {
      Transform.compile({
        moduleId: 'invalid.ts',
        source:
          'import { Theme, css } from "zyzz"; const theme = Theme.define({spacing:{md:"8px"}});' +
          source,
      })
      throw new Error('Expected source failure')
    } catch (error) {
      if (!(error instanceof Source.ExtractError)) throw error
      expect(error.message.includes(message!)).toMatchInlineSnapshot(`true`)
    }
  })

  test('inherits variable overrides in native CSS', async () => {
    const output = Transform.compile({
      moduleId: 'browser.ts',
      source: [
        'import { Theme, css } from "zyzz";',
        'const theme = Theme.define({spacing:{md:"8px"}});',
        'const alt = Theme.extend(theme,{spacing:{md:"16px"}});',
        'css({width:`calc(100% - ${theme.vars.spacing.md})`})()',
        'export const scope = alt.className;',
      ].join('\n'),
    })
    const className = output.css.match(/\.([^{}]+)\{width:/)![1]!
    const scope = output.css.match(/\.([^{}]+)\{[^{}]*:16px;/)![1]!
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><div style="width:100px"><div id="box" class="${className}"></div></div>`,
      )
      expect(
        await page
          .locator('#box')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"92px"`)
      await page
        .locator('#box')
        .evaluate(
          (element, scope) => element.parentElement!.classList.add(scope),
          scope,
        )
      expect(
        await page
          .locator('#box')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"84px"`)
    } finally {
      await browser.close()
    }
  })
})
