/** Exercises variable authoring through source compilation and browser scopes. @module */
import * as Vm from 'node:vm'
import * as Packed from '../test/fixtures/Packed.js'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import { Config, Style, Vars } from 'zyzz'

import { StyleSheet } from 'zyzz/react-native'

describe('define', () => {
  test('accepts custom categories named tokens in portable styles', () => {
    const vars = Vars.define(
      { tokens: { ink: '#123456' } },
      { id: 'custom-category' },
    )
    const styles = Style.define({ card: { color: vars.tokens.ink } }, { vars })
    const native = StyleSheet.compile({ styles, vars: { base: vars } })
    expect(native.styles.base.light.card).toEqual({ color: '#123456' })
  })
  test('compiles variable sets, mappings, references, and media conditions', async () => {
    const result = Graph.compile({
      modules: {
        'app.ts': `
        import { Config, Vars } from 'zyzz'
        const base = Vars.define({
          color: { accent: '#2563eb', foreground: { light: '#171717', dark: '#fafafa' } },
          spacing: { page: { default: '16px', '@media (min-width: 768px)': '32px' } },
          surface: { panel: '#fff' },
        })
        const alternate = Vars.extend(base, { color: { accent: '#9333ea' } })
        const config = Config.create({
          vars: { base, alternate }, defaultVars: 'base',
          mappings: { surface: ['backgroundColor'], spacing: ['padding'] },
        })
        export const scope = config.vars({ set: 'alternate', colorScheme: 'dark' })
        export const card = config.style({ color: 'accent', padding: 'page', width: config.vars.spacing.page, backgroundColor: 'panel' })
      `,
      },
    })
    expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(`
      ":root{--z-t1e8a67z1uaws1j-config-color_2e_accent:#2563eb;}
      :root{--z-t1e8a67z1uaws1j-config-spacing_2e_page:16px;}
      @media (min-width: 768px){:root{--z-t1e8a67z1uaws1j-config-spacing_2e_page:32px;}}
      :root{--z-t1e8a67z1uaws1j-config-surface_2e_panel:#fff;}
      .z_theme-1e8a67z1uaws1j-config-base{--z-t1e8a67z1uaws1j-config-color_2e_accent:#2563eb;--z-t1e8a67z1uaws1j-config-spacing_2e_page:16px;--z-t1e8a67z1uaws1j-config-surface_2e_panel:#fff;}
      @media (min-width: 768px){.z_theme-1e8a67z1uaws1j-config-base{--z-t1e8a67z1uaws1j-config-spacing_2e_page:32px;}}
      .z_theme-1e8a67z1uaws1j-config-alternate{--z-t1e8a67z1uaws1j-config-color_2e_accent:#9333ea;--z-t1e8a67z1uaws1j-config-spacing_2e_page:16px;--z-t1e8a67z1uaws1j-config-surface_2e_panel:#fff;}
      @media (min-width: 768px){.z_theme-1e8a67z1uaws1j-config-alternate{--z-t1e8a67z1uaws1j-config-spacing_2e_page:32px;}}
      .z_scheme-dark{color-scheme:dark;}
      .z_scheme-light{color-scheme:light;}
      .z_scheme-light-dark{color-scheme:light dark;}
      .z-text-VoQob9{color:var(--z-t1e8a67z1uaws1j-config-color_2e_accent,#2563eb);}
      .z-p-gtVQSx{padding:var(--z-t1e8a67z1uaws1j-config-spacing_2e_page,16px);}
      .z-w-OXGcNP{width:var(--z-t1e8a67z1uaws1j-config-spacing_2e_page,16px);}
      .z-bg-4MueOF{background-color:var(--z-t1e8a67z1uaws1j-config-surface_2e_panel,#fff);}"
    `)
    const code = await Packed.bundle({
      entry: 'app.ts',
      modules: { 'app.ts': result.modules['app.ts']!.code },
    })
    const fixture = Vm.runInNewContext(`${code};Fixture;`)
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({
        viewport: { width: 500, height: 600 },
      })
      await page.setContent(
        `<style>${result.modules['app.ts']!.css}</style><div class="${fixture.scope.className}" style="color-scheme:dark"><div id="card" class="${fixture.card().className}"></div></div>`,
      )
      expect(
        await page.locator('#card').evaluate((node) => ({
          color: getComputedStyle(node).color,
          padding: getComputedStyle(node).padding,
          width: getComputedStyle(node).width,
        })),
      ).toMatchInlineSnapshot(`
        {
          "color": "rgb(147, 51, 234)",
          "padding": "16px",
          "width": "16px",
        }
      `)
      await page.setViewportSize({ width: 1000, height: 600 })
      expect(
        await page
          .locator('#card')
          .evaluate((node) => getComputedStyle(node).padding),
      ).toMatchInlineSnapshot(`"32px"`)
    } finally {
      await browser.close()
    }
  })
  test('links definitions and semantic references across source and packed modules', async () => {
    const source = `import { Vars, Config } from 'zyzz'
      const palette = Vars.define({ gray: { 50: '#fafafa', 900: '#171717' }, pair: { light: '#171717', dark: '#fafafa' } })
      const base = Vars.define({ color: { foreground: { light: palette.gray[900], dark: palette.gray[50] }, branchPair: { light: palette.pair, dark: palette.pair } }, surface: { paired: palette.pair }, spacing: { page: { default: '16px', '@media (min-width: 768px)': '32px' } } })
      const alternate = Vars.extend(base, { color: { foreground: '#9333ea' } })
      export const { style, vars } = Config.create({ vars: { base, alternate }, defaultVars: 'base', mappings: { spacing: ['padding'], surface: ['backgroundColor'] } })
      export const packedCard = style({ color: 'foreground', padding: 'page' })`
    const library = Graph.compile({ modules: { 'index.ts': source } })
    const app = Graph.compile({
      contracts: { 'library/index.js': library.contracts['index.ts']! },
      imports: { 'app.ts': { library: 'library/index.js', zyzz: null } },
      modules: {
        'app.ts': `import { style, vars, packedCard } from 'library'; export const packed = packedCard; export const scope = vars({ set: 'base', colorScheme: 'dark' }); export const card = style({ color: 'foreground', backgroundColor: 'paired', borderColor: 'branchPair', padding: 'page', width: vars.spacing.page });`,
      },
    })
    const code = await Packed.bundle({
      entry: 'app.ts',
      modules: { 'app.ts': app.modules['app.ts']!.code },
      packages: { library: { 'index.ts': library.modules['index.ts']!.code } },
    })
    const fixture = Vm.runInNewContext(`${code};Fixture;`)
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({
        viewport: { width: 1000, height: 600 },
      })
      await page.setContent(
        `<style>${library.modules['index.ts']!.css}${app.modules['app.ts']!.css}</style><div class="${fixture.scope.className}"><div id="card" class="${fixture.card().className}"></div><div id="packed" class="${fixture.packed().className}"></div></div>`,
      )
      expect(
        await page.locator('#packed').evaluate((node) => ({
          color: getComputedStyle(node).color,
          padding: getComputedStyle(node).padding,
        })),
      ).toEqual({ color: 'rgb(250, 250, 250)', padding: '32px' })
      expect(
        await page
          .locator('#card')
          .evaluate((node) => getComputedStyle(node).backgroundColor),
      ).toMatchInlineSnapshot('"rgb(250, 250, 250)"')
      expect(
        await page
          .locator('#card')
          .evaluate((node) => getComputedStyle(node).borderTopColor),
      ).toMatchInlineSnapshot('"rgb(250, 250, 250)"')
      expect(
        await page.locator('#card').evaluate((node) => ({
          color: getComputedStyle(node).color,
          padding: getComputedStyle(node).padding,
          width: getComputedStyle(node).width,
        })),
      ).toMatchInlineSnapshot(`
        {
          "color": "rgb(250, 250, 250)",
          "padding": "32px",
          "width": "32px",
        }
      `)
    } finally {
      await browser.close()
    }
  })
  test('selects nested sets and ordered media color pairs', async () => {
    const graph = Graph.compile({
      modules: {
        'app.ts': `
      import { Config, Vars } from 'zyzz'
      const base = Vars.define({ color: { foreground: {
        default: { light: '#fff', dark: '#000' },
        '@media (min-width: 600px)': { light: '#f00', dark: '#00f' },
        '@media (min-width: 900px)': { light: '#0f0', dark: '#800080' },
      } }, spacing: { text: '20px' } })
      const alternate = Vars.extend(base, { color: { foreground: '#ff0' } })
      export const { style, vars } = Config.create({ vars: { base, alternate }, defaultVars: 'base' })
      export const dark = vars({ colorScheme: 'dark' })
      export const light = vars({ colorScheme: 'light' })
      export const nested = vars({ set: 'alternate' })
      export const card = style({ color: 'foreground', fontSize: vars.spacing.text })
    `,
      },
    })
    const code = await Packed.bundle({
      entry: 'app.ts',
      modules: { 'app.ts': graph.modules['app.ts']!.code },
    })
    const fixture = Vm.runInNewContext(`${code};Fixture;`)
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({
        viewport: { width: 1000, height: 600 },
      })
      await page.setContent(
        `<style>${graph.modules['app.ts']!.css}</style><div id="scope" class="${fixture.dark.className}"><div id="outer" class="${fixture.card().className}"></div><div class="${fixture.nested.className}"><div id="inner" class="${fixture.card().className}"></div></div></div>`,
      )
      expect(
        await page
          .locator('#outer')
          .evaluate((node) => getComputedStyle(node).color),
      ).toMatchInlineSnapshot('"rgb(128, 0, 128)"')
      expect(
        await page
          .locator('#inner')
          .evaluate((node) => getComputedStyle(node).color),
      ).toMatchInlineSnapshot('"rgb(255, 255, 0)"')
      expect(
        await page
          .locator('#outer')
          .evaluate((node) => getComputedStyle(node).fontSize),
      ).toMatchInlineSnapshot('"20px"')
      await page.locator('#scope').evaluate((node, className) => {
        node.setAttribute('class', className)
      }, fixture.light.className)
      expect(
        await page
          .locator('#outer')
          .evaluate((node) => getComputedStyle(node).color),
      ).toMatchInlineSnapshot('"rgb(0, 255, 0)"')
      await page.setViewportSize({ width: 700, height: 600 })
      expect(
        await page
          .locator('#outer')
          .evaluate((node) => getComputedStyle(node).color),
      ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
      await page.setViewportSize({ width: 500, height: 600 })
      expect(
        await page
          .locator('#outer')
          .evaluate((node) => getComputedStyle(node).color),
      ).toMatchInlineSnapshot('"rgb(255, 255, 255)"')
    } finally {
      await browser.close()
    }
  })

  test('compiles native scalar pairs and rejects media-conditioned values', () => {
    const vars = Vars.define({
      foreground: { light: '#fff', dark: '#000' },
      gutter: { default: '16px', '@media (min-width: 600px)': '32px' },
    })
    const tables = StyleSheet.compile({
      styles: Style.define({ card: { color: vars.foreground } }),
    })
    expect(tables.styles.default.dark.card.color).toMatchInlineSnapshot(
      '"#000"',
    )
    expect(() =>
      StyleSheet.compile({
        styles: Style.define({ card: { padding: vars.gutter } }),
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [StyleSheet.CompileError: ["default","light","card","padding"]: Media-conditioned variables require a web target.
      ["default","dark","card","padding"]: Media-conditioned variables require a web target.]
    `)
  })

  test('rejects mapping collisions and incompatible overrides', () => {
    expect(() =>
      Config.create({
        vars: { color: { accent: '#fff' }, surface: { accent: '#000' } },
        mappings: { surface: ['color'] },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: Ambiguous variable token accent for color.]`,
    )
    const base = Vars.define({ color: { accent: '#fff' } })
    expect(() =>
      // @ts-expect-error invalid color domain
      Vars.extend(base, { color: { accent: '16px' } }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Vars.InvalidError: ["color","accent"]: Variable overrides must preserve their domain.]`,
    )
  })
})

test('rejects removed theme imports and config fields', () => {
  for (const name of ['Theme', 'Variables'])
    expect(() =>
      Graph.compile({
        modules: { 'app.ts': `import { ${name} } from 'zyzz';` },
      }),
    ).toThrow(`Import Vars instead of ${name}.`)
  for (const key of ['theme', 'themes', 'defaultTheme'])
    expect(() => Config.create({ [key]: {} } as never)).toThrow(
      `Use vars and defaultVars instead of ${key}.`,
    )
  for (const key of ['theme', 'themes'])
    expect(() =>
      Graph.compile({
        modules: {
          'app.ts': `import { Config } from 'zyzz'; const config=Config.create({vars:{color:{ink:'red'}}}); const {${key}}=config;`,
        },
      }),
    ).toThrow('Use vars')
})
test('retains named sets when only root helpers are exported', async () => {
  const result = Graph.compile({
    modules: {
      'app.ts': `import {Config} from 'zyzz'; export const {appearance,script}=Config.create({vars:{base:{color:{ink:'red'}},other:{color:{ink:'blue'}}},defaultVars:'other'});`,
    },
  })
  const code = await Packed.bundle({
    entry: 'app.ts',
    modules: { 'app.ts': result.modules['app.ts']!.code },
  })
  const fixture = Vm.runInNewContext(`${code};Fixture;`)
  expect(fixture.script()).toContain('other')
  expect(result.modules['app.ts']!.code).toContain('"defaultVars":"other"')
  expect(result.modules['app.ts']!.code).not.toContain('Selection')
})
test('keeps reference paths that collide with function properties', () => {
  const config = Config.create({
    id: 'paths',
    vars: Vars.define({ name: 'red', length: '8px' }),
  })
  expect(config.vars.name.value).toBe('red')
  expect(config.vars.length.value).toBe('8px')
  expect(typeof config.vars).toBe('function')
  expect(config.vars().className).toContain('z_theme-')
})

test('rejects missing responsive typography thresholds', () => {
  expect(() =>
    Vars.define({
      typography: { heading: { '@media >=missing': { fontSize: '24px' } } },
    }),
  ).toThrow('Unknown query threshold.')
})
