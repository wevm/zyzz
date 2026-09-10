/**
 * Exercises linked source modules through compilation and actual module execution.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import * as ConfigFixture from '../../test/fixtures/ConfigGraph.js'
import * as Fixture from '../../test/fixtures/ThemeGraph.js'

const root = Path.resolve(import.meta.dirname, '../..')
const modules = Fixture.modules

describe('compile', () => {
  test('destructured config exports compile grouped styles through re-exports and packed contracts', () => {
    const output = Graph.compile({
      modules: {
        'pkg/config.ts': `import { Config } from 'zyzz'; export const { css, theme } = Config.create({theme:{color:{brand:'#06c'},spacing:{md:'8px'}}});`,
        'pkg/index.ts': `export { css, theme } from './config.js';`,
        'pkg/card.ts': `import { css, theme } from './index.js'; export const styles = { card: css({padding:'md'}), label: css({color:theme.tokens.color.brand}) }; export const props = styles.card(); export const scope = theme.className;`,
      },
    })
    expect(output.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1g1qfxjzbnv3-css-theme{--z-t1g1qfxjzbnv3-css-spacing_2e_md:8px;--z-t1g1qfxjzbnv3-css-color_2e_brand:#06c;}
      .z-5ngs574r5xr9-base1{padding:var(--z-t1g1qfxjzbnv3-css-spacing_2e_md,8px);}
      .z-5ngs574r5xr9-base0{color:var(--z-t1g1qfxjzbnv3-css-color_2e_brand,#06c);}"
    `)
    expect(output.modules['pkg/card.ts']!.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';
      import { css, theme } from './index.js'; export const styles = { card: __zyzzProps.create({className:"z-5ngs574r5xr9-base1"}), label: __zyzzProps.create({className:"z-5ngs574r5xr9-base0"}) }; export const props = styles.card(); export const scope = "z_theme-1g1qfxjzbnv3-css-theme";"
    `)
    const packed = Graph.compile({
      contracts: { 'library/index.js': output.contracts['pkg/index.ts']! },
      modules: {
        'app/card.ts': `import { css, theme } from 'library'; export const styles = { card: css({color:'brand'}) }; export const scope = theme.className;`,
      },
      imports: { 'app/card.ts': { library: 'library/index.js' } },
    })
    expect(packed.modules['app/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1g1qfxjzbnv3-css-theme{--z-t1g1qfxjzbnv3-css-color_2e_brand:#06c;--z-t1g1qfxjzbnv3-css-spacing_2e_md:8px;}
      .z-ujlnau19561g8-base0{color:var(--z-t1g1qfxjzbnv3-css-color_2e_brand,#06c);}"
    `)
  })

  test('renamed destructured config bindings retain token inference during compilation', () => {
    const output = Graph.compile({
      modules: {
        'app/card.ts': `import { Config } from 'zyzz'; const { css: styled, theme: palette } = Config.create({theme:{color:{brand:'#06c'}}}); export const styles = { card: styled({color:palette.tokens.color.brand}) };`,
      },
    })
    expect(output.modules['app/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-ujlnau19561g8-styled-theme{--z-tujlnau19561g8-styled-color_2e_brand:#06c;}
      .z-ujlnau19561g8-base0{color:var(--z-tujlnau19561g8-styled-color_2e_brand,#06c);}"
    `)
  })

  test('preceding handle aliases feed later theme and configuration factories', () => {
    const output = Graph.compile({
      modules: {
        'pkg/config.ts': `import { Config, Theme } from 'zyzz';
const zyzz = Config.create({theme:{color:{brand:'#06c'}}});
const instance = zyzz;
const theme = instance.theme, alias = theme;
const mint = Theme.extend(alias,{color:{brand:'#175'}});
const other = Config.create({theme:alias});
export const original = zyzz.css({color:'brand'})();
export const props = other.css({color:'brand'})();
export const scope = mint.className;`,
      },
    })
    expect(output.modules['pkg/config.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1g1qfxjzbnv3-zyzz-theme{--z-t1g1qfxjzbnv3-zyzz-color_2e_brand:#06c;}
      .z_theme-1g1qfxjzbnv3-mint{--z-t1g1qfxjzbnv3-zyzz-color_2e_brand:#175;}
      .z_theme-1g1qfxjzbnv3-other-theme{--z-t1g1qfxjzbnv3-other-color_2e_brand:#06c;}
      .z-style-1g1qfxjzbnv3-291{color:var(--z-t1g1qfxjzbnv3-zyzz-color_2e_brand,#06c);}
      .z-style-1g1qfxjzbnv3-341{color:var(--z-t1g1qfxjzbnv3-other-color_2e_brand,#06c);}"
    `)
    expect(
      output.modules['pkg/config.ts']!.code.includes('Config.create('),
    ).toMatchInlineSnapshot(`false`)
  })

  test('numeric configuration keys retain tokens and reject string-equivalent duplicates', () => {
    const output = Graph.compile({
      modules: {
        'pkg/config.ts': `import { Config } from 'zyzz'; const zyzz = Config.create({theme:{color:{brand:{500:'#06c'}},spacing:{2:'8px'}}}); export const props = zyzz.css({color:'brand.500',padding:zyzz.theme.tokens.spacing[2]})();`,
      },
    })
    expect(output.modules['pkg/config.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1g1qfxjzbnv3-zyzz-theme{--z-t1g1qfxjzbnv3-zyzz-color_2e_brand_2e_500:#06c;--z-t1g1qfxjzbnv3-zyzz-spacing_2e_2:8px;}
      .z-1g1qfxjzbnv3-base0{color:var(--z-t1g1qfxjzbnv3-zyzz-color_2e_brand_2e_500,#06c);padding:var(--z-t1g1qfxjzbnv3-zyzz-spacing_2e_2,8px);}"
    `)
    expect(() =>
      Graph.compile({
        modules: {
          'pkg/config.ts': `import { Config } from 'zyzz'; const zyzz = Config.create({theme:{spacing:{2:'8px','2':'12px'}}});`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/config.ts:44: Configuration requires unique literal keys.]`,
    )
  })

  test('dotted catalog keys retain member boundaries in source and packed libraries', () => {
    const library = Graph.compile({
      modules: {
        'pkg/config.js': `import { Config } from 'zyzz'; export const zyzz = Config.create({defaultTheme:'brand.dark',themes:{'brand.dark':{color:{brand:'#06c'}}}}); export const props = zyzz.css({color:'brand'})(); export const scope = zyzz.themes['brand.dark'].className;`,
      },
    })
    expect(library.modules['pkg/config.js']!.code).toMatchInlineSnapshot(
      `
      "
      import { Appearance as __zyzzAppearance } from 'zyzz/runtime';
       export const zyzz = ((()=>{const catalog=Object.fromEntries([["brand.dark","z_theme-1fzmg4ts3ctu1-zyzz-brand_2e_dark"]]);return {script:__zyzzAppearance.create([["brand.dark","z_theme-1fzmg4ts3ctu1-zyzz-brand_2e_dark"]]),theme:{"className":"z_theme-1fzmg4ts3ctu1-zyzz-brand_2e_dark"},themes:Object.defineProperties(((input)=>({className:catalog[input.theme],...(input.colorScheme?{style:{colorScheme:input.colorScheme}}:{})})),Object.getOwnPropertyDescriptors(Object.fromEntries(Object.entries(catalog).map(([name,className])=>[name,{className}]))))}})()); export const props = ({className:"z-1fzmg4ts3ctu1-base0"}); export const scope = "z_theme-1fzmg4ts3ctu1-zyzz-brand_2e_dark";"
    `,
    )
    const options = {
      contracts: { 'library/index.js': library.contracts['pkg/config.js']! },
      imports: { 'app/card.js': { '@acme/theme': 'library/index.js' } },
      modules: {
        'app/card.js': `import { zyzz } from '@acme/theme'; export const props = zyzz.css({color:zyzz.themes['brand.dark'].tokens.color.brand})(); export const scope = zyzz.themes['brand.dark'].className;`,
      },
    }
    expect(Graph.compile(options).modules['app/card.js']!.css)
      .toMatchInlineSnapshot(`
      ".z_theme-1fzmg4ts3ctu1-zyzz-brand_2e_dark{--z-t1fzmg4ts3ctu1-zyzz-color_2e_brand:#06c;}
      .z-115845g13hgi1q-base0{color:var(--z-t1fzmg4ts3ctu1-zyzz-color_2e_brand,#06c);}"
    `)
    expect(() =>
      Graph.compile({
        ...options,
        modules: {
          'app/card.js': options.modules['app/card.js'].replaceAll(
            "['brand.dark']",
            '.brand.dark',
          ),
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: app/card.js:73: Use direct configuration css calls or static theme members; configurations cannot escape or be mutated.
      app/card.js:73: Expected a literal string or number; expressions are not evaluated.
      app/card.js:141: Use direct configuration css calls or static theme members; configurations cannot escape or be mutated.]
    `)
  })

  test('configuration defaults, aliases, edits, and packed metadata retain the same contract', () => {
    const compiler = Graph.create()
    const output = compiler.compile({ modules: ConfigFixture.modules })
    expect(output.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-69adjg15dlzyu-zyzz-mint{--z-t69adjg15dlzyu-zyzz-color_2e_brand:light-dark(#175,#afa);--z-t69adjg15dlzyu-zyzz-spacing_2e_md:12px;}
      .z_theme-69adjg15dlzyu-zyzz-base{--z-t69adjg15dlzyu-zyzz-color_2e_brand:light-dark(#06c,#9cf);--z-t69adjg15dlzyu-zyzz-spacing_2e_md:8px;}
      .z-5ngs574r5xr9-base0{color:var(--z-t69adjg15dlzyu-zyzz-color_2e_brand,light-dark(#06c,#9cf));padding:var(--z-t69adjg15dlzyu-zyzz-spacing_2e_md,8px);}"
    `)
    expect(output.modules['pkg/zyzz.config.ts']!.code).toMatchInlineSnapshot(
      `
      "
      import { Appearance as __zyzzAppearance } from 'zyzz/runtime';
       import { base } from './base.js'; export const zyzz = ((()=>{const catalog: Record<string,string>=Object.fromEntries([["mint","z_theme-69adjg15dlzyu-zyzz-mint"],["base","z_theme-69adjg15dlzyu-zyzz-base"]]);return {script:__zyzzAppearance.create([["mint","z_theme-69adjg15dlzyu-zyzz-mint"],["base","z_theme-69adjg15dlzyu-zyzz-base"]]),theme:{"className":"z_theme-69adjg15dlzyu-zyzz-base"},themes:Object.defineProperties(((input: {theme: string; colorScheme?: string})=>({className:catalog[input.theme],...(input.colorScheme?{style:{colorScheme:input.colorScheme}}:{})})),Object.getOwnPropertyDescriptors(Object.fromEntries(Object.entries(catalog).map(([name,className])=>[name,{className}]))))}})() as import('zyzz').Config.create.ReturnType<{readonly "defaultTheme":"base";readonly "themes":{readonly "mint":{readonly "color":{readonly "brand":{readonly "dark":"#afa";readonly "light":"#175"}};readonly "spacing":{readonly "md":"12px"}};readonly "base":{readonly "color":{readonly "brand":{readonly "dark":"#9cf";readonly "light":"#06c"}};readonly "spacing":{readonly "md":"8px"}}};readonly "layers":readonly ["reset","components"]}>);"
    `,
    )
    expect(output.modules['pkg/card.ts']!.code).toMatchInlineSnapshot(
      `"import { design } from './index.js'; const zyzz = (design as import('zyzz').Config.create.ReturnType<{readonly "defaultTheme":"base";readonly "themes":{readonly "mint":{readonly "color":{readonly "brand":{readonly "dark":"#afa";readonly "light":"#175"}};readonly "spacing":{readonly "md":"12px"}};readonly "base":{readonly "color":{readonly "brand":{readonly "dark":"#9cf";readonly "light":"#06c"}};readonly "spacing":{readonly "md":"8px"}}};readonly "layers":readonly ["reset","components"]}>); const { css } = ({css:undefined} as unknown as {readonly css:import('zyzz').Config.create.ReturnType<{readonly "defaultTheme":"base";readonly "themes":{readonly "mint":{readonly "color":{readonly "brand":{readonly "dark":"#afa";readonly "light":"#175"}};readonly "spacing":{readonly "md":"12px"}};readonly "base":{readonly "color":{readonly "brand":{readonly "dark":"#9cf";readonly "light":"#06c"}};readonly "spacing":{readonly "md":"8px"}}};readonly "layers":readonly ["reset","components"]}>['css']}); export const props = ({className:"z-5ngs574r5xr9-base0"}); export const scope = "z_theme-69adjg15dlzyu-zyzz-mint";"`,
    )
    const updated = compiler.compile({
      modules: {
        ...ConfigFixture.modules,
        'pkg/zyzz.config.ts': ConfigFixture.modules[
          'pkg/zyzz.config.ts'
        ].replace("'#175'", "'#f00'"),
      },
    })
    expect(updated.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-69adjg15dlzyu-zyzz-mint{--z-t69adjg15dlzyu-zyzz-color_2e_brand:light-dark(#f00,#afa);--z-t69adjg15dlzyu-zyzz-spacing_2e_md:12px;}
      .z_theme-69adjg15dlzyu-zyzz-base{--z-t69adjg15dlzyu-zyzz-color_2e_brand:light-dark(#06c,#9cf);--z-t69adjg15dlzyu-zyzz-spacing_2e_md:8px;}
      .z-5ngs574r5xr9-base0{color:var(--z-t69adjg15dlzyu-zyzz-color_2e_brand,light-dark(#06c,#9cf));padding:var(--z-t69adjg15dlzyu-zyzz-spacing_2e_md,8px);}"
    `)
    const mapping = new Trace.TraceMap(output.modules['pkg/card.ts']!.cssMap)
    expect(
      Trace.originalPositionFor(mapping, { line: 1, column: 0 }).source,
    ).toMatchInlineSnapshot(`"pkg/zyzz.config.ts"`)
    const packed = Graph.compile({
      contracts: { 'library/index.js': output.contracts['pkg/index.ts']! },
      imports: { 'app/card.ts': { '@acme/theme': 'library/index.js' } },
      modules: {
        'app/card.ts': `import { design as zyzz } from '@acme/theme'; export const props = zyzz.css({color:'brand',padding:'md'})(); export const scope = zyzz.themes.mint.className;`,
      },
    })
    expect(packed.modules['app/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1h7j9xm1yzxb90-base{--z-t1h7j9xm1yzxb90-base-color_2e_brand:light-dark(#06c,#9cf);--z-t1h7j9xm1yzxb90-base-spacing_2e_md:8px;}
      .z_theme-69adjg15dlzyu-zyzz-mint{--z-t69adjg15dlzyu-zyzz-color_2e_brand:light-dark(#175,#afa);--z-t69adjg15dlzyu-zyzz-spacing_2e_md:12px;}
      .z_theme-69adjg15dlzyu-zyzz-base{--z-t69adjg15dlzyu-zyzz-color_2e_brand:light-dark(#06c,#9cf);--z-t69adjg15dlzyu-zyzz-spacing_2e_md:8px;}
      .z-ujlnau19561g8-base0{color:var(--z-t69adjg15dlzyu-zyzz-color_2e_brand,light-dark(#06c,#9cf));padding:var(--z-t69adjg15dlzyu-zyzz-spacing_2e_md,8px);}"
    `)
    expect(packed.modules['app/card.ts']!.code).toMatchInlineSnapshot(
      `"import { design as zyzz } from '@acme/theme'; export const props = ({className:"z-ujlnau19561g8-base0"}); export const scope = "z_theme-69adjg15dlzyu-zyzz-mint";"`,
    )
  })

  test('single and token-free configuration calls compile without runtime factories', () => {
    const output = Graph.compile({
      modules: {
        'pkg/config.ts': `import { Config, Theme } from 'zyzz'; export const empty = Config.create(); const base = Theme.define({color:{brand:'#06c'}}); export const zyzz = Config.create({theme:base}); const theme = zyzz.theme; export const mint = Theme.extend(zyzz.theme,{color:{brand:'#175'}}); export const props = zyzz.css({color:theme.tokens.color.brand})(); export const plain = empty.css({padding:'8px'})();`,
      },
    })
    expect(output.modules['pkg/config.ts']!.code).toMatchInlineSnapshot(
      `
      "
      import { Appearance as __zyzzAppearance } from 'zyzz/runtime';
       export const empty = ({script:__zyzzAppearance.create([])} as import('zyzz').Config.create.ReturnType<{}>); const base = ({className:"z_theme-1g1qfxjzbnv3-base"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"}}>); export const zyzz = ({script:__zyzzAppearance.create([]),theme:{"className":"z_theme-1g1qfxjzbnv3-zyzz-theme"}} as import('zyzz').Config.create.ReturnType<{readonly "theme":{readonly "color":{readonly "brand":"#06c"}}}>); const theme = (zyzz.theme as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"}}>); export const mint = ({className:"z_theme-1g1qfxjzbnv3-mint"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"}}>); export const props = ({className:"z-1g1qfxjzbnv3-base0"}); export const plain = ({className:"z-1g1qfxjzbnv3-base1"});"
    `,
    )
    expect(output.modules['pkg/config.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1g1qfxjzbnv3-zyzz-theme{--z-t1g1qfxjzbnv3-zyzz-color_2e_brand:#06c;}
      .z_theme-1g1qfxjzbnv3-mint{--z-t1g1qfxjzbnv3-zyzz-color_2e_brand:#175;}
      .z-1g1qfxjzbnv3-base0{color:var(--z-t1g1qfxjzbnv3-zyzz-color_2e_brand,#06c);}
      .z-1g1qfxjzbnv3-base1{padding:8px;}"
    `)
  })

  test('configuration dynamic access and escaping fail before emission', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'pkg/config.ts': `import { Config } from 'zyzz'; const zyzz = Config.create(); console.log(zyzz);`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/config.ts:73: Use direct configuration css calls or static theme members; configurations cannot escape or be mutated.]`,
    )
    expect(() =>
      Graph.compile({
        modules: {
          'pkg/config.ts': `import { Config } from 'zyzz'; const zyzz = Config.create({theme:{color:{brand:'#06c'}}}); const key = 'theme'; export const scope = zyzz[key].className;`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/config.ts:133: Use direct configuration css calls or static theme members; configurations cannot escape or be mutated.]`,
    )
    expect(() =>
      Graph.compile({
        modules: {
          'pkg/config.ts': `import { Config } from 'zyzz'; const zyzz = Config.create({themes:{base:{color:{brand:'#06c'}}},defaultTheme:'missing'});`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/config.ts:44: defaultTheme must name a theme in the catalog.]`,
    )
  })

  test('serialized library contracts link aliases, extensions, and consumer scopes', () => {
    const library = Graph.compile({
      modules: {
        'library/theme.ts': `import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#06c'},spacing:{md:'8px'}}); export const mint = Theme.extend(theme,{color:{brand:'#175'}}); export const css = theme.css;`,
        'library/index.ts': `export * from './theme.js';`,
      },
    })
    const compiler = Graph.create()
    const options = {
      contracts: { 'library/index.js': library.contracts['library/index.ts']! },
      imports: {
        'app/card.ts': { '@acme/theme': 'library/index.js', zyzz: null },
      },
      modules: {
        'app/card.ts': `import { css, theme, mint } from '@acme/theme'; import { Theme } from 'zyzz'; export const local = Theme.extend(theme,{color:{brand:'#f00'}}); export const props = css({color:theme.tokens.color.brand,padding:'md'})(); export const scope = mint.className;`,
      },
    }
    const output = compiler.compile(options)
    expect(output.modules['app/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-18pt0w1ocy15n-theme{--z-t18pt0w1ocy15n-theme-color_2e_brand:#06c;--z-t18pt0w1ocy15n-theme-spacing_2e_md:8px;}
      .z_theme-18pt0w1ocy15n-mint{--z-t18pt0w1ocy15n-theme-color_2e_brand:#175;--z-t18pt0w1ocy15n-theme-spacing_2e_md:8px;}
      .z_theme-ujlnau19561g8-local{--z-t18pt0w1ocy15n-theme-color_2e_brand:#f00;--z-t18pt0w1ocy15n-theme-spacing_2e_md:8px;}
      .z-ujlnau19561g8-base0{color:var(--z-t18pt0w1ocy15n-theme-color_2e_brand,#06c);padding:var(--z-t18pt0w1ocy15n-theme-spacing_2e_md,8px);}"
    `)
    expect(output.modules['app/card.ts']!.code).toMatchInlineSnapshot(
      `"import { css, theme, mint } from '@acme/theme';  export const local = ({className:"z_theme-ujlnau19561g8-local"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}}>); export const props = ({className:"z-ujlnau19561g8-base0"}); export const scope = "z_theme-18pt0w1ocy15n-mint";"`,
    )
    const updated = compiler.compile({
      ...options,
      contracts: {
        'library/index.js': options.contracts['library/index.js'].replaceAll(
          '#175',
          '#080',
        ),
      },
    })
    expect(updated.modules['app/card.ts']!.classes).toMatchInlineSnapshot(`
      {
        "style-ujlnau19561g8-164": "z-ujlnau19561g8-base0",
      }
    `)
    expect(updated.modules['app/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-18pt0w1ocy15n-theme{--z-t18pt0w1ocy15n-theme-color_2e_brand:#06c;--z-t18pt0w1ocy15n-theme-spacing_2e_md:8px;}
      .z_theme-18pt0w1ocy15n-mint{--z-t18pt0w1ocy15n-theme-color_2e_brand:#080;--z-t18pt0w1ocy15n-theme-spacing_2e_md:8px;}
      .z_theme-ujlnau19561g8-local{--z-t18pt0w1ocy15n-theme-color_2e_brand:#f00;--z-t18pt0w1ocy15n-theme-spacing_2e_md:8px;}
      .z-ujlnau19561g8-base0{color:var(--z-t18pt0w1ocy15n-theme-color_2e_brand,#06c);padding:var(--z-t18pt0w1ocy15n-theme-spacing_2e_md,8px);}"
    `)
    expect(() =>
      compiler.compile({
        ...options,
        contracts: { 'library/index.js': '{"version":999}' },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: library/index.js:0: Invalid library contract: Unsupported Zyzz contract version.]`,
    )
    expect(
      compiler.compile(options).modules['app/card.ts']!.css ===
        output.modules['app/card.ts']!.css,
    ).toMatchInlineSnapshot(`true`)
  })

  test('unchanged and edited consumers retain one imported contract identity', () => {
    const library = Graph.compile({ modules: Fixture.modules })
    const compiler = Graph.create()
    const options = {
      contracts: { 'library/index.js': library.contracts['pkg/index.ts']! },
      imports: {
        'app/a.ts': { '@acme/theme': 'library/index.js' },
        'app/b.ts': { '@acme/theme': 'library/index.js' },
      },
      modules: {
        'app/a.ts': `import { style } from '@acme/theme'; export const a = style({color:'brand'})();`,
        'app/b.ts': `import { style } from '@acme/theme'; export const b = style({padding:'md'})();`,
      },
    }
    compiler.compile(options)
    const next = {
      ...options,
      modules: {
        ...options.modules,
        'app/b.ts': options.modules['app/b.ts'].replace(
          "padding:'md'",
          "color:'brand',padding:'md'",
        ),
      },
    }
    const output = compiler.compile(next)
    expect(output.modules['app/a.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#06c;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;--z-t1p8at5ioin1tk-theme-spacing_2e_unused:99px;}
      .z_theme-18i5hb1ihk25d-mint{--z-t1p8at5ioin1tk-theme-color_2e_brand:#175;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;--z-t1p8at5ioin1tk-theme-spacing_2e_unused:99px;}
      .z-7vl04zjqauul-base0{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);}"
    `)
    expect(output.modules['app/b.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#06c;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;--z-t1p8at5ioin1tk-theme-spacing_2e_unused:99px;}
      .z_theme-18i5hb1ihk25d-mint{--z-t1p8at5ioin1tk-theme-color_2e_brand:#175;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;--z-t1p8at5ioin1tk-theme-spacing_2e_unused:99px;}
      .z-bm7tc8jqax5q-base0{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);padding:var(--z-t1p8at5ioin1tk-theme-spacing_2e_md,8px);}"
    `)
    expect(
      JSON.stringify(output) === JSON.stringify(Graph.compile(next)),
    ).toMatchInlineSnapshot(`true`)
  })

  test('conflicting installed copies fail before compiling consumers', () => {
    const library = Graph.compile({ modules: Fixture.modules })
    const contract = library.contracts['pkg/index.ts']!
    expect(() =>
      Graph.compile({
        contracts: {
          first: contract,
          second: contract.replaceAll('#06c', '#f00'),
        },
        imports: { 'app/card.ts': { first: 'first', second: 'second' } },
        modules: {
          'app/card.ts': `import { style } from 'first'; import { mint } from 'second'; export const props = style({color:'brand'})(); export const scope = mint.className;`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: second:0: Invalid library contract: Conflicting library theme identity: 1p8at5ioin1tk-theme]`,
    )
  })

  test('ordinary exports named like object prototype properties remain ordinary imports', () => {
    const output = Graph.compile({
      modules: {
        'pkg/utility.ts': `export function toString() { return 'ordinary' }`,
        'pkg/card.ts': `import { toString } from './utility.js'; export const value = toString();`,
      },
    })
    expect(output.modules['pkg/card.ts']!.code).toMatchInlineSnapshot(
      `"import { toString } from './utility.js'; export const value = toString();"`,
    )
    expect(output.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`""`)
  })

  test('dynamic source imports fail before output', () => {
    expect(() =>
      Graph.compile({
        modules: {
          ...modules,
          'pkg/lazy.ts': `export const load = () => import('./theme.js');`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/lazy.ts:26: Source graph dependencies require static imports.]`,
    )
  })

  test('explicit non-theme exports shadow star contracts', () => {
    const output = Graph.compile({
      modules: {
        ...modules,
        'pkg/index.ts': `export * from './theme.js'; export const theme = { css: (value: string) => value };`,
        'pkg/card.ts': `import { theme } from './index.js'; export const value = theme.css('ordinary');`,
      },
    })
    expect(output.modules['pkg/card.ts']!.code).toMatchInlineSnapshot(
      `"import { theme } from './index.js'; export const value = theme.css('ordinary');"`,
    )
    expect(output.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`""`)
  })
  test('conflicting star contracts fail before output', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'pkg/a.ts': `import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#000'}});`,
          'pkg/b.ts': `import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#fff'}});`,
          'pkg/index.ts': `export * from './a.js'; export * from './b.js';`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/index.ts:0: Ambiguous theme re-export: theme]`,
    )
  })
  test('type-only imports do not load source dependencies', () => {
    const output = Graph.compile({
      modules: {
        'pkg/types.ts': `import type { Theme } from './missing.js'; export type Contract = Theme;`,
      },
    })
    expect(output.dependencies).toMatchInlineSnapshot(`
      {
        "pkg/types.ts": [],
      }
    `)
  })
  test('imported aliases retain shadowed bindings', () => {
    const output = Graph.compile({
      modules: {
        ...modules,
        'pkg/card.ts': `import { css } from './theme.js'; export function run(css: (value: string) => string) { return css('ordinary') } export const props = css({color:'brand'})();`,
      },
    })
    expect(output.modules['pkg/card.ts']!.code).toMatchInlineSnapshot(
      `"import { css } from './theme.js'; export function run(css: (value: string) => string) { return css('ordinary') } export const props = ({className:"z-5ngs574r5xr9-base0"});"`,
    )
  })

  test('imports, aliases, extensions and re-exports share token identities and source maps', async () => {
    const output = Graph.compile({ modules })
    expect(output.dependencies).toMatchInlineSnapshot(`
      {
        "pkg/alternate.ts": [
          "pkg/theme.ts",
        ],
        "pkg/card.ts": [
          "pkg/index.ts",
        ],
        "pkg/index.ts": [
          "pkg/theme.ts",
          "pkg/alternate.ts",
        ],
        "pkg/theme.ts": [],
      }
    `)
    expect(output.modules['pkg/card.ts']!.code).toMatchInlineSnapshot(
      `"import { theme, style, mint } from './index.js'; export const props = ({className:"z-5ngs574r5xr9-base0"}); export const scope = "z_theme-18i5hb1ihk25d-mint";"`,
    )
    expect(output.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#06c;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;}
      .z_theme-18i5hb1ihk25d-mint{--z-t1p8at5ioin1tk-theme-color_2e_brand:#175;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;}
      .z-5ngs574r5xr9-base0{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);padding:var(--z-t1p8at5ioin1tk-theme-spacing_2e_md,8px);}"
    `)
    expect(
      Trace.originalPositionFor(
        new Trace.TraceMap(output.modules['pkg/card.ts']!.cssMap),
        { line: 1, column: 0 },
      ),
    ).toMatchInlineSnapshot(`
      {
        "column": 51,
        "line": 1,
        "name": "1p8at5ioin1tk-theme",
        "source": "pkg/theme.ts",
      }
    `)
    const directory = await Fs.mkdtemp(Path.join(root, '.fixture-graph-'))
    try {
      for (const [name, module] of Object.entries(output.modules)) {
        const file = Path.join(directory, name)
        await Fs.mkdir(Path.dirname(file), { recursive: true })
        await Fs.writeFile(file, module.code)
      }
      const bundle = await Esbuild.build({
        entryPoints: [Path.join(directory, 'pkg/card.ts')],
        bundle: true,
        format: 'cjs',
        metafile: true,
        write: false,
      })
      expect(
        Object.keys(bundle.metafile!.inputs).some((path) =>
          /Theme\.ts|compiler\//.test(path),
        ),
      ).toMatchInlineSnapshot(`false`)
      const path = Path.join(directory, 'bundle.cjs')
      await Fs.writeFile(path, bundle.outputFiles[0]!.text)
      const executed = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        ['-e', `console.log(JSON.stringify(require(${JSON.stringify(path)})))`],
      )
      expect(executed.stdout).toMatchInlineSnapshot(`
        "{"props":{"className":"z-5ngs574r5xr9-base0"},"scope":"z_theme-18i5hb1ihk25d-mint"}
        "
      `)
      const checked = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          Path.join(root, 'node_modules/typescript/bin/tsc'),
          '--customConditions',
          'src',
          '--module',
          'NodeNext',
          '--target',
          'esnext',
          '--strict',
          '--skipLibCheck',
          '--noEmit',
          Path.join(directory, 'pkg/card.ts'),
        ],
        { timeout: 10_000 },
      )
      expect(checked.stdout).toMatchInlineSnapshot(`""`)
    } finally {
      await Fs.rm(directory, { recursive: true, force: true })
    }
  }, 15_000)

  test('token edits preserve identities and removing the last use removes declarations', () => {
    const before = Graph.compile({ modules })
    const after = Graph.compile({
      modules: {
        ...modules,
        'pkg/theme.ts': modules['pkg/theme.ts'].replace("'#06c'", "'#f00'"),
      },
    })
    expect(after.modules['pkg/card.ts']!.classes).toMatchInlineSnapshot(`
      {
        "style-5ngs574r5xr9-70": "z-5ngs574r5xr9-base0",
      }
    `)
    expect(after.modules['pkg/card.ts']!.themes).toMatchInlineSnapshot(`
      {
        "18i5hb1ihk25d-mint": "z_theme-18i5hb1ihk25d-mint",
        "1p8at5ioin1tk-theme": "z_theme-1p8at5ioin1tk-theme",
      }
    `)
    expect(before.modules['pkg/card.ts']!.classes).toMatchInlineSnapshot(`
      {
        "style-5ngs574r5xr9-70": "z-5ngs574r5xr9-base0",
      }
    `)
    const removed = Graph.compile({
      modules: {
        ...modules,
        'pkg/card.ts': `import { mint } from './alternate.js'; export const scope = mint.className;`,
      },
    })
    expect(removed.modules['pkg/alternate.ts']!.css).toMatchInlineSnapshot(`""`)
    expect(removed.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`""`)
    expect(removed.modules['pkg/index.ts']!.css).toMatchInlineSnapshot(`""`)
    expect(removed.modules['pkg/theme.ts']!.css).toMatchInlineSnapshot(`""`)
  })

  test('linked scopes render inherited values in Chromium', async () => {
    const output = Graph.compile({ modules })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent('<main id="scope"><div id="card">Card</div></main>')
      await page.addStyleTag({
        content: Object.values(output.modules)
          .map((module) => module.css)
          .join('\n'),
      })
      const classes = Object.values(output.modules['pkg/card.ts']!.classes)[0]!
      await page
        .locator('#card')
        .evaluate(
          (element, classes) => element.setAttribute('class', classes),
          classes,
        )
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(0, 102, 204)"`)
      const scope =
        output.modules['pkg/card.ts']!.themes[
          Object.keys(output.modules['pkg/card.ts']!.themes).find((name) =>
            name.endsWith('-mint'),
          )!
        ]!
      await page
        .locator('#scope')
        .evaluate(
          (element, scope) => element.setAttribute('class', scope),
          scope,
        )
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(17, 119, 85)"`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).padding),
      ).toMatchInlineSnapshot(`"8px"`)
    } finally {
      await browser.close()
    }
  })

  for (const extension of [
    'cjs',
    'cjsx',
    'cts',
    'ctsx',
    'js',
    'jsx',
    'mjs',
    'mjsx',
    'mts',
    'mtsx',
    'ts',
    'tsx',
  ]) {
    for (const suffix of ['', '/index']) {
      test(`extensionless imports link themes from ${suffix || 'direct'}.${extension}`, () => {
        const output = Graph.compile({
          modules: {
            'pkg/card.ts': `import { theme } from './theme'; export const props = theme.css({color:'brand'})();`,
            [`pkg/theme${suffix}.${extension}`]: modules['pkg/theme.ts'],
          },
        })
        expect(output.modules['pkg/card.ts']!.code).toMatchInlineSnapshot(
          `"import { theme } from './theme'; export const props = ({className:"z-5ngs574r5xr9-base0"});"`,
        )
      })
    }
  }

  test.each(['pkg/theme.mts', 'pkg/theme/index.mjs'])(
    'extensionless imports reject ambiguity with %s',
    (moduleId) => {
      expect(() =>
        Graph.compile({
          modules: {
            'pkg/card.ts': `import { theme } from './theme';`,
            'pkg/theme.cts': modules['pkg/theme.ts'],
            [moduleId]: modules['pkg/theme.ts'],
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: pkg/card.ts:0: Ambiguous source import: ./theme]`,
      )
    },
  )

  test('missing source imports fail before output', () => {
    expect(() =>
      Graph.compile({
        modules: { 'pkg/card.ts': `import { theme } from './missing.js';` },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/card.ts:0: Missing source module: ./missing.js]`,
    )
  })
  test('cycles fail before output', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'pkg/a.ts': `export * from './b.js';`,
          'pkg/b.ts': `export * from './a.js';`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/a.ts:0: Circular source dependencies are not supported yet.]`,
    )
  })
  test('ambiguous source extensions fail before output', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'pkg/a.ts': `import './b';`,
          'pkg/b.ts': '',
          'pkg/b.tsx': '',
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/a.ts:0: Ambiguous source import: ./b]`,
    )
  })
  test('namespace theme imports fail before output', () => {
    expect(() =>
      Graph.compile({
        modules: {
          ...modules,
          'pkg/card.ts': `import * as Themes from './theme.js';`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/card.ts:7: Import theme contracts by name; namespace imports are not supported.]`,
    )
  })
})

describe('create', () => {
  test('unchanged snapshots reuse results within an isolated compiler', () => {
    const compiler = Graph.create()
    const before = compiler.compile({ modules })
    expect(
      compiler.compile({ modules: { ...modules } }) === before,
    ).toMatchInlineSnapshot(`true`)
    expect(
      Graph.create().compile({ modules }) === before,
    ).toMatchInlineSnapshot(`false`)
  })

  test('a consumer edit retains unrelated transforms and snapshots caller inputs', () => {
    const compiler = Graph.create()
    const sources = Fixture.project(3)
    const before = compiler.compile({ modules: sources })
    sources['pkg/card0.ts'] = sources['pkg/card0.ts']!.replace('0px', '20px')
    const after = compiler.compile({ modules: sources })
    expect(
      after.modules['pkg/card1.ts'] === before.modules['pkg/card1.ts'],
    ).toMatchInlineSnapshot(`true`)
    expect(
      after.modules['pkg/card0.ts'] === before.modules['pkg/card0.ts'],
    ).toMatchInlineSnapshot(`false`)
    expect(after.modules['pkg/card0.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#06c;}
      .z_theme-18i5hb1ihk25d-mint{--z-t1p8at5ioin1tk-theme-color_2e_brand:#175;}
      .z-1k1dzu31vy9i39-base0{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);padding:20px;}"
    `)
    expect(before.modules['pkg/card0.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#06c;}
      .z_theme-18i5hb1ihk25d-mint{--z-t1p8at5ioin1tk-theme-color_2e_brand:#175;}
      .z-1k1dzu31vy9i39-base0{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);padding:0px;}"
    `)
  })

  test('theme edits propagate through re-exports and preserve defining source maps', () => {
    const compiler = Graph.create()
    compiler.compile({ modules })
    const after = compiler.compile({
      modules: {
        ...modules,
        'pkg/theme.ts':
          '\n' + modules['pkg/theme.ts'].replace("'#06c'", "'#f00'"),
      },
    })
    expect(after.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#f00;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;}
      .z_theme-18i5hb1ihk25d-mint{--z-t1p8at5ioin1tk-theme-color_2e_brand:#175;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;}
      .z-5ngs574r5xr9-base0{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#f00);padding:var(--z-t1p8at5ioin1tk-theme-spacing_2e_md,8px);}"
    `)
    const map = new Trace.TraceMap(after.modules['pkg/card.ts']!.cssMap)
    expect(Trace.originalPositionFor(map, { column: 0, line: 1 }))
      .toMatchInlineSnapshot(`
      {
        "column": 51,
        "line": 2,
        "name": "1p8at5ioin1tk-theme",
        "source": "pkg/theme.ts",
      }
    `)
    expect(after.modules['pkg/card.ts']!.cssMap.sourcesContent)
      .toMatchInlineSnapshot(`
      [
        "import { theme, style, mint } from './index.js'; export const props = style({color:theme.tokens.color.brand,padding:'md'})(); export const scope = mint.className;",
        "
      import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#f00'},spacing:{md:'8px',unused:'99px'}}); export const css = theme.css;",
        "import { Theme } from 'zyzz'; import { theme } from './theme.js'; export const mint = Theme.extend(theme, {color:{brand:'#175'}});",
      ]
    `)
  })

  test('unimported compatible scope edits invalidate consumer CSS', () => {
    const compiler = Graph.create()
    const sources = {
      ...modules,
      'pkg/card.ts': `import { css } from './theme.js'; export const props = css({color:'brand'})();`,
    }
    const before = compiler.compile({ modules: sources })
    const after = compiler.compile({
      modules: {
        ...sources,
        'pkg/alternate.ts': modules['pkg/alternate.ts'].replace(
          "'#175'",
          "'#f00'",
        ),
      },
    })
    expect(
      after.modules['pkg/card.ts'] === before.modules['pkg/card.ts'],
    ).toMatchInlineSnapshot(`false`)
    expect(after.dependencies['pkg/card.ts']).toMatchInlineSnapshot(`
      [
        "pkg/theme.ts",
      ]
    `)
    expect(after.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#06c;}
      .z_theme-18i5hb1ihk25d-mint{--z-t1p8at5ioin1tk-theme-color_2e_brand:#f00;}
      .z-5ngs574r5xr9-base0{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);}"
    `)
  })

  test('import edits preserve the new graph scope order', () => {
    const compiler = Graph.create()
    const sources = {
      'pkg/a.ts': `export const value = 1;`,
      'pkg/b.ts': `import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#000'}});`,
      'pkg/c.ts': `import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#fff'}});`,
      'pkg/style.ts': `import { theme } from './b.js'; export const props = theme.css({color:'brand'})();`,
    }
    const before = compiler.compile({ modules: sources })
    const after = compiler.compile({
      modules: {
        ...sources,
        'pkg/a.ts': `import './c.js'; export const value = 1;`,
      },
    })
    expect(
      after.modules['pkg/style.ts'] === before.modules['pkg/style.ts'],
    ).toMatchInlineSnapshot(`false`)
    expect(Object.keys(after.modules['pkg/style.ts']!.themes))
      .toMatchInlineSnapshot(`
      [
        "dremeuyk1z1i-theme",
        "c1mlirqoc0mf-theme",
      ]
    `)
  })

  test('edited imports replace dependency edges before later theme edits', () => {
    const compiler = Graph.create()
    compiler.compile({ modules })
    const sources = {
      ...modules,
      'pkg/card.ts': `import { mint } from './alternate.js'; export const props = mint.css({color:'brand'})();`,
    }
    compiler.compile({ modules: sources })
    const after = compiler.compile({
      modules: {
        ...sources,
        'pkg/alternate.ts': modules['pkg/alternate.ts'].replace(
          "'#175'",
          "'#f00'",
        ),
      },
    })
    expect(after.dependencies['pkg/card.ts']).toMatchInlineSnapshot(`
      [
        "pkg/alternate.ts",
      ]
    `)
    expect(after.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#06c;}
      .z_theme-18i5hb1ihk25d-mint{--z-t1p8at5ioin1tk-theme-color_2e_brand:#f00;}
      .z-5ngs574r5xr9-base0{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#f00);}"
    `)
  })

  test('failed edits retain the last successful graph and recover', () => {
    const compiler = Graph.create()
    const before = compiler.compile({ modules })
    expect(() =>
      compiler.compile({
        modules: {
          ...modules,
          'pkg/theme.ts': `import { theme } from './index.js'; export { theme };`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/theme.ts:0: Circular source dependencies are not supported yet.]`,
    )
    expect(compiler.compile({ modules }) === before).toMatchInlineSnapshot(
      `true`,
    )
    const after = compiler.compile({
      modules: {
        ...modules,
        'pkg/card.ts': `export const value = 'recovered';`,
      },
    })
    expect(after.modules['pkg/card.ts']!.code).toMatchInlineSnapshot(
      `"export const value = 'recovered';"`,
    )
    expect(after.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`""`)
  })

  test('file additions recheck ambiguity and removals drop stale scopes', () => {
    const compiler = Graph.create()
    const sources = {
      ...modules,
      'pkg/card.ts': `import { css } from './theme'; export const props = css({color:'brand'})();`,
    }
    const before = compiler.compile({ modules: sources })
    expect(() =>
      compiler.compile({
        modules: {
          ...sources,
          'pkg/theme.mts': modules['pkg/theme.ts'],
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/card.ts:0: Ambiguous source import: ./theme]`,
    )
    expect(
      compiler.compile({ modules: sources }) === before,
    ).toMatchInlineSnapshot(`true`)
    const after = compiler.compile({
      modules: {
        'pkg/card.ts': sources['pkg/card.ts'],
        'pkg/theme.ts': sources['pkg/theme.ts'],
      },
    })
    expect(after.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#06c;}
      .z-5ngs574r5xr9-base0{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);}"
    `)
    expect(Object.keys(after.modules)).toMatchInlineSnapshot(`
      [
        "pkg/card.ts",
        "pkg/theme.ts",
      ]
    `)
    expect(() =>
      compiler.compile({
        modules: {
          'pkg/card.ts': sources['pkg/card.ts'],
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/card.ts:0: Missing source module: ./theme]`,
    )
  })

  test('incremental scope edits render without changing component classes in Chromium', async () => {
    const compiler = Graph.create()
    const before = compiler.compile({ modules })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      const scope = before.modules['pkg/card.ts']!.themes['18i5hb1ihk25d-mint']!
      const className = Object.values(
        before.modules['pkg/card.ts']!.classes,
      ).join(' ')
      await page.setContent(
        `<main class="${scope}"><div id="card" class="${className}">Card</div></main>`,
      )
      const sheet = await page.addStyleTag({
        content: before.modules['pkg/card.ts']!.css,
      })
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(17, 119, 85)"`)
      const after = compiler.compile({
        modules: {
          ...modules,
          'pkg/alternate.ts': modules['pkg/alternate.ts'].replace(
            "'#175'",
            "'#f00'",
          ),
        },
      })
      await sheet.evaluate((element, css) => {
        element.textContent = css
      }, after.modules['pkg/card.ts']!.css)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(255, 0, 0)"`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).padding),
      ).toMatchInlineSnapshot(`"8px"`)
    } finally {
      await browser.close()
    }
  })
})

describe('create', () => {
  test('host resolution controls aliases and invalidates changed targets', () => {
    const compiler = Graph.create()
    const modules = {
      'pkg/a.ts': `import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#000'}});`,
      'pkg/b.ts': `import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#fff'}});`,
      'pkg/card.ts': `import { theme } from '@theme'; export const props = theme.css({color:'brand'})();`,
    }
    const imports = {
      'pkg/a.ts': { zyzz: null },
      'pkg/b.ts': { zyzz: null },
      'pkg/card.ts': { '@theme': 'pkg/a.ts' },
    }
    const before = compiler.compile({ imports, modules })
    imports['pkg/card.ts']['@theme'] = 'pkg/b.ts'
    const after = compiler.compile({ imports, modules })
    expect(after.dependencies['pkg/card.ts']).toMatchInlineSnapshot(`
      [
        "pkg/b.ts",
      ]
    `)
    expect(after.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-c1mlirqoc0mf-theme{--z-tc1mlirqoc0mf-theme-color_2e_brand:#fff;}
      .z-5ngs574r5xr9-base0{color:var(--z-tc1mlirqoc0mf-theme-color_2e_brand,#fff);}"
    `)
    expect(after === before).toMatchInlineSnapshot(`false`)
    expect(() =>
      compiler.compile({ imports: {}, modules }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/a.ts:0: Missing host resolution: zyzz]`,
    )
    expect(() =>
      compiler.compile({
        imports: { ...imports, 'pkg/card.ts': { '@theme': 'pkg/missing.ts' } },
        modules,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/card.ts:0: Missing host source module: @theme]`,
    )
    expect(
      compiler.compile({ imports, modules }) === after,
    ).toMatchInlineSnapshot(`true`)
  })
})
