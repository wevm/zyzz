/** Exercises variable authoring through source compilation and browser scopes. @module */
import * as Vm from 'node:vm'
import * as Packed from '../test/fixtures/Packed.js'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import { Config, Style, Vars } from 'zyzz'

import { StyleSheet } from 'zyzz/react-native'

describe('define', () => {
  test('merges derived vars and follows palette overrides on native', () => {
    const base = Vars.define(
      { color: { palette: { ink: '#123456' } }, spacing: { small: '4px' } },
      (vars) => ({
        color: { foreground: vars.color.palette.ink },
        spacing: { large: '16px' },
      }),
      { id: 'derived-native' },
    )
    const other = Vars.extend(base, { color: { palette: { ink: '#abcdef' } } })
    const styles = Style.define({
      card: { color: base.color.foreground, padding: base.spacing.large },
    })
    const result = StyleSheet.compile({ styles, vars: { base, other } })
    expect(result.styles.base.light.card).toMatchInlineSnapshot(`
      {
        "color": "#123456",
        "paddingBottom": 16,
        "paddingLeft": 16,
        "paddingRight": 16,
        "paddingTop": 16,
      }
    `)
    expect(result.styles.other.light.card).toMatchInlineSnapshot(`
      {
        "color": "#abcdef",
        "paddingBottom": 16,
        "paddingLeft": 16,
        "paddingRight": 16,
        "paddingTop": 16,
      }
    `)
    expect(() =>
      Vars.extend(base, { color: { palette: { ink: base.color.foreground } } }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Vars.InvalidError: ["color","palette","ink"]: Cyclic variables are not supported.]`,
    )
    expect(() =>
      Vars.define({ color: { ink: '#000' } }, () => ({
        color: { ink: '#fff' },
      })),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Vars.InvalidError: ["color","ink"]: Derived variables cannot replace existing paths.]`,
    )
    expect(() =>
      Vars.define({ color: { palette: { ink: '#000' } } }, () => ({
        color: { palette: '#fff' },
      })),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Vars.InvalidError: ["color","palette"]: Derived variables cannot replace existing paths.]`,
    )
    expect(() =>
      Vars.define({ spacing: { small: '4px' } }, () => ({
        spacing: { small: { nested: '8px' } },
      })),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Vars.InvalidError: ["spacing","small"]: Derived variables cannot replace existing paths.]`,
    )
  })

  test('preserves anonymous derived references through configured mappings', () => {
    const base = Vars.define({ palette: { ink: '#123456' } }, (vars) => ({
      color: { foreground: vars.palette.ink },
    }))
    const other = Vars.extend(base, { palette: { ink: '#abcdef' } })
    const config = Config.create({
      id: 'derived-config',
      vars: other,
      mappings: { color: ['color'] },
    })
    const result = StyleSheet.compile({
      styles: Style.define({ card: { color: config.vars.color.foreground } }),
    })
    expect(result.styles.default.light.card).toMatchInlineSnapshot(`
      {
        "color": "#abcdef",
      }
    `)
  })

  test.each(['expression', 'block', 'function', 'full paths'])(
    'compiles derived vars through source and packed browser scopes: %s',
    async (form) => {
      const value =
        '({color:{foreground:{light:vars.color.palette.ink,dark:vars.color.palette.paper}},spacing:{large:vars.spacing.small}})'
      const callback = (() => {
        if (form === 'expression' || form === 'full paths')
          return `vars => ${value}, {id:'derived-web'}`
        if (form === 'block') return `vars => { return ${value} }`
        return `function(vars) { return ${value} }`
      })()
      const source = `import {Config, Vars} from 'zyzz';
      const base = Vars.define({color:{palette:{ink:'#123456',paper:'#ffffff'}},spacing:{small:{default:'4px','@media (min-width: 600px)':'16px'}}},
        ${callback});
      const other = Vars.extend(base,{color:{palette:{ink:'#abcdef',paper:'#000000'}},spacing:{small:{default:'8px','@media (min-width: 600px)':'32px'}}});
      export const {style,vars}=Config.create({vars:{base,other},defaultVars:'base',${form === 'full paths' ? 'mappings:false,' : ''}});`
      const app = `import {style,vars} from 'library';
      export const base=vars({set:'base',colorScheme:'light'});
      export const other=vars({set:'other',colorScheme:'light'});
      export const dark=vars({set:'other',colorScheme:'dark'});
      export const card=style({borderColor: vars.color.foreground, color:'${form === 'full paths' ? 'color.' : ''}foreground',padding:'${form === 'full paths' ? 'spacing.' : ''}large'});`
      const library = Graph.compile({ modules: { 'index.ts': source } })
      const browser = await chromium.launch()
      try {
        for (const packed of [false, true]) {
          const result = Graph.compile(
            packed
              ? {
                  contracts: {
                    'library/index.js': library.contracts['index.ts']!,
                  },
                  imports: { 'app.ts': { library: 'library/index.js' } },
                  modules: { 'app.ts': app },
                }
              : {
                  imports: {
                    'app.ts': { library: 'index.ts' },
                    'index.ts': { zyzz: null },
                  },
                  modules: { 'index.ts': source, 'app.ts': app },
                },
          )
          const code = await Packed.bundle({
            entry: 'app.ts',
            modules: { 'app.ts': result.modules['app.ts']!.code },
            packages: {
              library: {
                'index.ts': (packed ? library : result).modules['index.ts']!
                  .code,
              },
            },
          })
          const fixture = Vm.runInNewContext(`${code};Fixture;`)
          const page = await browser.newPage({
            viewport: { width: 500, height: 600 },
          })
          await page.setContent(
            `<style>${
              (packed ? library.modules['index.ts']!.css : '') +
              Object.values(result.modules)
                .map((module) => module.css)
                .join('')
            }</style>${['base', 'other', 'dark'].map((key) => `<div class="${fixture[key].className}"><div class="${fixture.card().className}" data-card></div></div>`).join('')}`,
          )
          expect(
            await page.locator('[data-card]').evaluateAll((nodes) =>
              nodes.map((node) => ({
                color: getComputedStyle(node).color,
                padding: getComputedStyle(node).padding,
              })),
            ),
          ).toMatchInlineSnapshot(`
          [
            {
              "color": "rgb(18, 52, 86)",
              "padding": "4px",
            },
            {
              "color": "rgb(171, 205, 239)",
              "padding": "8px",
            },
            {
              "color": "rgb(0, 0, 0)",
              "padding": "8px",
            },
          ]
        `)
          await page.setViewportSize({ width: 800, height: 600 })
          expect(
            await page
              .locator('[data-card]')
              .evaluateAll((nodes) =>
                nodes.map((node) => getComputedStyle(node).padding),
              ),
          ).toMatchInlineSnapshot(`
            [
              "16px",
              "32px",
              "32px",
            ]
          `)
          await page.close()
        }
      } finally {
        await browser.close()
      }
    },
  )

  test('validates full paths against property domains', () => {
    const config = Config.create({
      id: 'full-paths',
      vars: { surface: { ink: '#123456' }, size: { page: '16px' } },
      mappings: false,
    })
    config.style({ color: 'surface.ink', width: 'size.page' })
    expect(() =>
      // @ts-expect-error color values cannot be used as lengths
      config.style({ width: 'surface.ink' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["style","width"]: Variable value is incompatible with this property.]`,
    )
    expect(() =>
      Graph.compile({
        modules: {
          'index.ts': `import {Config} from 'zyzz';
        const {style}=Config.create({vars:{surface:{ink:'#123456'}},mappings:false});
        export const card=style({width:'surface.ink'});`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: index.ts:154: Variable value is incompatible with this property.]`,
    )
  })

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
      ":where(*){--z-f1i8tofc19dwsq:16px;}@media (min-width: 768px){:where(*){--z-f1i8tofc19dwsq:32px;}}
      .z_theme-1e8a67z1uaws1j-config-base{--z-t1e8a67z1uaws1j-config-color_2e_accent:#2563eb;--z-t1e8a67z1uaws1j-config-spacing_2e_page:var(--z-f1i8tofc19dwsq);--z-t1e8a67z1uaws1j-config-surface_2e_panel:#fff;}
      @media (min-width: 768px){.z_theme-1e8a67z1uaws1j-config-base{--z-t1e8a67z1uaws1j-config-spacing_2e_page:32px;}}
      .z_theme-1e8a67z1uaws1j-config-alternate{--z-t1e8a67z1uaws1j-config-color_2e_accent:#9333ea;--z-t1e8a67z1uaws1j-config-spacing_2e_page:var(--z-f1i8tofc19dwsq);--z-t1e8a67z1uaws1j-config-surface_2e_panel:#fff;}
      @media (min-width: 768px){.z_theme-1e8a67z1uaws1j-config-alternate{--z-t1e8a67z1uaws1j-config-spacing_2e_page:32px;}}
      .z_scheme-dark{color-scheme:dark;}
      .z_scheme-light{color-scheme:light;}
      .z_scheme-light-dark{color-scheme:light dark;}
      .z-text-VoQob9{color:var(--z-t1e8a67z1uaws1j-config-color_2e_accent,#2563eb);}
      .z-p-uudsXs{padding:var(--z-t1e8a67z1uaws1j-config-spacing_2e_page,var(--z-f1i8tofc19dwsq));}
      .z-w-SlwuVH{width:var(--z-t1e8a67z1uaws1j-config-spacing_2e_page,var(--z-f1i8tofc19dwsq));}
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

test('resolves nested native pairs and rejects nested media values', () => {
  const palette = Vars.define({
    ink: { light: '#fff', dark: '#000' },
    media: { default: '#fff', '@media (min-width: 600px)': '#000' },
  })
  const nested = Vars.define({
    ink: { light: palette.ink, dark: palette.ink },
    media: { light: palette.media, dark: palette.media },
  })
  const outer = Vars.define({ ink: { light: nested.ink, dark: nested.ink } })
  const tables = StyleSheet.compile({
    styles: Style.define({ card: { color: outer.ink } }),
  })
  expect(tables.styles.default.light.card.color).toBe('#fff')
  expect(tables.styles.default.dark.card.color).toBe('#000')
  expect(() =>
    StyleSheet.compile({
      styles: Style.define({ card: { color: nested.media } }),
    }),
  ).toThrow('Media-conditioned variables require a web target.')
})

test('preserves root leaf-shaped names and query contracts', () => {
  const vars = Vars.define({
    light: '8px',
    dark: 2,
    default: 'red',
    breakpoints: { tablet: '48rem' },
    containers: { compact: '20rem' },
    containerNames: ['card'],
  })
  expect(vars.light.value).toBe('8px')
  expect(vars.dark.value).toBe(2)
  expect(vars.default.value).toBe('red')
  expect(() =>
    Vars.extend(vars, {
      breakpoints: { tablet: '50rem' },
      containers: { compact: '24rem' },
      containerNames: ['card'],
    }),
  ).not.toThrow()
  for (const overrides of [
    { breakpoints: { desktop: '80rem' } },
    { containers: { wide: '40rem' } },
    { containerNames: ['other'] },
  ])
    expect(() => Vars.extend(vars, overrides as never)).toThrow(
      'Extensions cannot',
    )
  expect(() =>
    Vars.extend(Vars.define({ ink: '#fff' }), {
      breakpoints: { desktop: '80rem' },
    } as never),
  ).toThrow('Extensions cannot add query thresholds.')
  expect(() => Vars.define({ spacing: { scale: ['4px'] } } as never)).toThrow()
})

test('round-trips authored packed marker keys and rejects identity mode collisions', () => {
  const library = Graph.compile({
    modules: {
      'index.ts': `import {Config,Vars} from 'zyzz';
    const palette = Vars.define({ ink: '#123456' });
    export const {style,vars} = Config.create({id:'marker-config', vars:{palette:{$variable:'#fff',$object:'#000',nested:{$variable:{identity:'authored',path:'ink',value:'#abcdef'}}},color:{ink:palette.ink}}});`,
    },
  })
  const contract = library.contracts['index.ts']!
  const result = Graph.compile({
    contracts: { 'library/index.js': contract },
    imports: { 'app.ts': { library: 'library/index.js' } },
    modules: {
      'app.ts': `import {style,vars} from 'library'; export const card=style({color:vars.palette.$variable,backgroundColor:vars.palette.$object,borderColor:vars.palette.nested.$variable.value,outlineColor:'ink'});`,
    },
  })
  expect(result.modules['app.ts']!.css).toContain('#fff')
  expect(result.modules['app.ts']!.css).toContain('#000')
  expect(result.modules['app.ts']!.css).toContain('#abcdef')
  expect(result.modules['app.ts']!.css).toContain('#123456')
  const legacy = JSON.parse(contract)
  for (const entry of Object.values(legacy.themes) as {
    variableSet?: boolean
    tokens: unknown
  }[]) {
    delete entry.variableSet
    entry.tokens = { color: { ink: '#fff' } }
  }
  legacy.exports = {}
  delete legacy.configurations
  for (const contracts of [
    { 'first.js': JSON.stringify(legacy), 'second.js': contract },
    { 'first.js': contract, 'second.js': JSON.stringify(legacy) },
  ])
    expect(() => Graph.compile({ contracts, modules: {} })).toThrow(
      'Conflicting packed variable-set modes for one identity.',
    )
  const reference = (
    Object.values(JSON.parse(contract).themes) as {
      tokens: { color?: unknown }
    }[]
  ).find((entry) => entry.tokens.color)! as {
    tokens: { color: { ink: { $variable: { identity: string } } } }
  }
  for (const entry of Object.values(legacy.themes) as { identity: string }[])
    entry.identity = reference.tokens.color.ink.$variable.identity
  expect(() =>
    Graph.compile({
      contracts: {
        'legacy.js': JSON.stringify(legacy),
        'variables.js': contract,
      },
      modules: {},
    }),
  ).toThrow('Conflicting packed variable-set modes for one identity.')
})

test('keeps extended reference fallbacks distinct in source and packed scopes', async () => {
  const source = `import {Config,Vars} from 'zyzz';
    const palette = Vars.define({ink:'#ff0000',space:{default:'8px','@media (min-width: 600px)':'16px'}});
    const other = Vars.extend(palette,{ink:'#0000ff',space:{default:'24px','@media (min-width: 600px)':'32px'}});
    const base = Vars.define({color:{ink:palette.ink},spacing:{gap:palette.space}});
    const alternate = Vars.extend(base,{color:{ink:other.ink},spacing:{gap:other.space}});
    export const {style,vars}=Config.create({vars:{base,alternate},defaultVars:'base'});`
  const app = `import {style,vars} from 'library';
    export const base=vars({set:undefined});
    export const alternate=vars({set:'alternate'});
    export const card=style({color:'ink',padding:'gap'});`
  const library = Graph.compile({ modules: { 'index.ts': source } })
  const browser = await chromium.launch()
  try {
    for (const packed of [false, true]) {
      const result = Graph.compile(
        packed
          ? {
              contracts: { 'library/index.js': library.contracts['index.ts']! },
              imports: { 'app.ts': { library: 'library/index.js' } },
              modules: { 'app.ts': app },
            }
          : {
              imports: {
                'app.ts': { library: 'index.ts' },
                'index.ts': { zyzz: null },
              },
              modules: { 'index.ts': source, 'app.ts': app },
            },
      )
      const code = await Packed.bundle({
        entry: 'app.ts',
        modules: { 'app.ts': result.modules['app.ts']!.code },
        packages: {
          library: {
            'index.ts': (packed ? library : result).modules['index.ts']!.code,
          },
        },
      })
      const fixture = Vm.runInNewContext(`${code};Fixture;`)
      const page = await browser.newPage({
        viewport: { width: 500, height: 600 },
      })
      await page.setContent(
        `<style>${
          (packed ? library.modules['index.ts']!.css : '') +
          Object.values(result.modules)
            .map((module) => module.css)
            .join('')
        }</style><div class="${fixture.base.className}"><div id="base" class="${fixture.card().className}"></div><div class="${fixture.alternate.className}"><div id="alternate" class="${fixture.card().className}"></div></div></div><div id="plain" class="${fixture.card().className}"></div>`,
      )
      const styles = () =>
        page.locator('#base, #alternate, #plain').evaluateAll((nodes) =>
          nodes.map((node) => ({
            color: getComputedStyle(node).color,
            padding: getComputedStyle(node).padding,
          })),
        )
      expect(await styles()).toEqual([
        { color: 'rgb(255, 0, 0)', padding: '8px' },
        { color: 'rgb(0, 0, 255)', padding: '24px' },
        { color: 'rgb(255, 0, 0)', padding: '8px' },
      ])
      await page.setViewportSize({ width: 800, height: 600 })
      expect(await styles()).toEqual([
        { color: 'rgb(255, 0, 0)', padding: '16px' },
        { color: 'rgb(0, 0, 255)', padding: '32px' },
        { color: 'rgb(255, 0, 0)', padding: '16px' },
      ])
      await page.close()
    }
  } finally {
    await browser.close()
  }
})
