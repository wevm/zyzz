/**
 * Exercises linked source modules through compilation and actual module execution.
 * @module
 */
import * as ConfigFixture from '../../test/fixtures/ConfigGraph.js'
import * as Fixture from '../../test/fixtures/ThemeGraph.js'
import * as Library from '../../test/fixtures/VariantLibrary.js'
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Http from 'node:http'
import * as Path from 'node:path'
import * as Util from 'node:util'
import * as Vm from 'node:vm'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'
import { Host } from 'zyzz/node'

const root = Path.resolve(import.meta.dirname, '../..')
const modules = Fixture.modules

describe('compile', () => {
  test.each([
    ['web', 'single'],
    ['native', 'single'],
    ['web', 'base,mint'],
    ['web', 'mint,base'],
    ['native', 'base,mint'],
    ['native', 'mint,base'],
  ] as const)(
    'compiles packed %s recipes with catalog order %s into native consumer callables',
    async (target, order) => {
      const themes = Object.fromEntries(
        order.split(',').map((name) => [
          name,
          {
            color: {
              ink: {
                light: name === 'base' ? '#000000' : '#008844',
                dark: name === 'base' ? '#ffffff' : '#00ff88',
              },
            },
          },
        ]),
      )
      const source = `import {Config} from 'zyzz';const {variants}=Config.create(${JSON.stringify(order === 'single' ? { theme: { color: { ink: { light: '#000000', dark: '#ffffff' } } } } : { defaultTheme: 'base', themes })});export const card=variants({base:{color:'ink'},variants:{size:{small:{fontSize:'12px'},large:{fontSize:'20px'}}},defaultVariants:{size:'small'},compoundVariants:[{when:{size:'large'},style:{targets:{ios:{opacity:0.7},android:{opacity:0.8}}}}]});`
      const library = Graph.compile({
        modules: { 'library/card.ts': source },
        ...(target === 'native'
          ? {
              native: {
                colorScheme: 'light' as const,
                platform: 'ios' as const,
              },
            }
          : {}),
      })
      const output = Graph.compile({
        contracts: { 'library/card.ts': library.contracts['library/card.ts']! },
        imports: { 'app/index.ts': { library: 'library/card.ts' } },
        modules: {
          'app/index.ts': `import {card as button} from 'library';export {card} from 'library';export const result=button({size:'large'});`,
        },
        native: { colorScheme: 'dark', platform: 'android' },
      })
      const directory = await Fs.mkdtemp(
        Path.join(root, '.fixture-native-packed-'),
      )
      try {
        await Fs.writeFile(
          Path.join(directory, 'package.json'),
          JSON.stringify({ type: 'module', sideEffects: true }),
        )
        await Fs.writeFile(
          Path.join(directory, 'library.ts'),
          library.modules['library/card.ts']!.code,
        )
        const built = await Esbuild.build({
          stdin: {
            contents: output.modules['app/index.ts']!.code,
            loader: 'ts',
            resolveDir: root,
          },
          alias: {
            library: Path.join(directory, 'library.ts'),
            'zyzz/runtime': Path.join(root, 'src/runtime/index.ts'),
            zyzz: Path.join(root, 'src/index.ts'),
          },
          bundle: true,
          platform: 'node',
          format: 'esm',
          write: false,
        })
        await Fs.writeFile(
          Path.join(directory, 'bundle.mjs'),
          built.outputFiles[0]!.text,
        )
        const executed = await Util.promisify(ChildProcess.execFile)(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            `import {result,card} from ${JSON.stringify(Path.join(directory, 'bundle.mjs'))};console.log(JSON.stringify(result));console.log(JSON.stringify(card()));`,
          ],
        )
        expect(executed.stdout).toMatchInlineSnapshot(`
          "{"style":{"color":"#ffffff","fontSize":20,"opacity":0.8}}
          {"style":{"color":"#ffffff","fontSize":12}}
          "
        `)
        expect(output.dependencies['app/index.ts']).toMatchInlineSnapshot(`
          [
            "library/card.ts",
          ]
        `)
        expect(
          JSON.parse(output.contracts['app/index.ts']!).version,
        ).toMatchInlineSnapshot('21')
      } finally {
        await Fs.rm(directory, { recursive: true, force: true })
      }
    },
  )

  test('reads rule references alongside version 21 callable recipes', () => {
    const library = Graph.compile({
      modules: {
        'library.ts': `import {style} from 'zyzz';import {customMedia} from 'zyzz/web';export const card=style({opacity:0.5});export const compact=customMedia('(width < 40rem)');`,
      },
    })
    const output = Graph.compile({
      contracts: { 'library.js': library.contracts['library.ts']! },
      imports: { 'app.ts': { library: 'library.js' } },
      modules: { 'app.ts': `export {card,compact} from 'library';` },
    })

    expect(
      JSON.parse(output.contracts['app.ts']!).version,
    ).toMatchInlineSnapshot('21')
    expect(
      JSON.parse(output.contracts['app.ts']!).exports.compact.kind,
    ).toMatchInlineSnapshot('"rule-reference"')
  })

  test.each([
    `import {type Props} from 'types';`,
    `export {type Props} from 'types';`,
  ])('skips native specifier-only type dependencies: %s', (source) => {
    const output = Graph.compile({
      imports: { 'app.ts': { zyzz: null } },
      modules: {
        'app.ts': `${source}import {style} from 'zyzz';export const card=style({opacity:0.5});`,
      },
      native: { colorScheme: 'light' },
    })

    expect(output.dependencies['app.ts']).toMatchInlineSnapshot('[]')
    expect(
      output.modules['app.ts']!.code.includes('"opacity":0.5'),
    ).toMatchInlineSnapshot('true')
  })

  test.each([
    `import card from 'library';export const props=card();`,
    `export * from 'library';`,
    `export {default as card} from 'library';`,
  ])('retains native types through packed import forms: %s', (source) => {
    const library = Graph.compile({
      modules: {
        'library.ts': `import {style} from 'zyzz';export const card=style({opacity:0.5});export {card as default};`,
      },
    })
    const result = Graph.compile({
      contracts: { 'library.js': library.contracts['library.ts']! },
      imports: { 'app.ts': { library: 'library.js' } },
      modules: { 'app.ts': source },
      native: { colorScheme: 'light' },
    })
    expect(
      result.modules['app.ts']!.code.includes('Native.Callable'),
    ).toMatchInlineSnapshot('true')
    expect(
      result.modules['app.ts']!.code.includes('"opacity":0.5'),
    ).toMatchInlineSnapshot('true')
  })

  test('rejects missing and malformed packed native recipes', () => {
    const library = Graph.compile({
      modules: {
        'library.ts': `import {variants} from 'zyzz';export const card=variants({variants:{size:{small:{opacity:0.5}}}});`,
      },
    })
    const raw = JSON.parse(library.contracts['library.ts']!)
    const compile = (contract: string) =>
      Graph.compile({
        contracts: { 'library.ts': contract },
        imports: { 'app.ts': { './library.js': 'library.ts' } },
        modules: {
          'app.ts': `import {card} from './library.js';export const result=card();`,
        },
        native: { colorScheme: 'light' },
      })
    delete raw.exports.card.style.staticRecipe
    expect(() =>
      compile(JSON.stringify(raw)),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Native.CompileError: Packed native callable card requires a static recipe contract.]`,
    )
    const malformed = JSON.parse(library.contracts['library.ts']!)
    malformed.exports.card.style.staticRecipe.defaults.size = 'unknown'
    expect(() =>
      compile(JSON.stringify(malformed)),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: library.ts:0: Invalid library contract: Invalid packed recipe default.]`,
    )
  })

  test('rejects web-only authoring and disabled rewriting in native graphs', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'card.ts': `import {style} from 'zyzz';export const card=style({selectors:{'&:hover':{opacity:0.5}}});`,
        },
        native: { colorScheme: 'light' },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.CompileError: ["style-1slxe42dbli7u-45"]: Selectors, queries, and nested rules are not supported on native.]`,
    )
    expect(() =>
      Graph.compile({
        modules: {},
        compiler: false,
        native: { colorScheme: 'light' },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Native.CompileError: Native graph compilation requires source rewriting.]`,
    )
  })

  test('executes native imports, re-exports and composition with configured tokens', async () => {
    const modules = {
      'theme.ts': `import {Config} from 'zyzz';export const {style,variants}=Config.create({theme:{color:{ink:{light:'#000000',dark:'#ffffff'}}}});`,
      'barrel.ts': `export {style,variants} from './theme.js';`,
      'card.ts': `import {variants} from './barrel.js';export const card=variants({base:{color:'ink'},variants:{size:{small:{fontSize:'12px'},large:{fontSize:'20px'}}},defaultVariants:{size:'small'}});`,
      'overlay.ts': `import {style} from './barrel.js';export const overlay=style({targets:{native:{opacity:0.5},ios:{opacity:0.7}}});`,
      'index.ts': `import {cx} from 'zyzz';import {card} from './card.js';import {overlay} from './overlay.js';export {card} from './card.js';export const result=cx(card({size:'large'}),overlay());`,
    }
    const compiler = Graph.create()
    const native = { colorScheme: 'dark', platform: 'ios' } as const
    const result = compiler.compile({ modules, native })
    expect(result.dependencies['index.ts']).toMatchInlineSnapshot(`
      [
        "card.ts",
        "overlay.ts",
      ]
    `)
    expect(
      Object.values(result.modules).every((module) => module.css === ''),
    ).toMatchInlineSnapshot('true')
    expect(
      compiler.compile({ modules, native }) === result,
    ).toMatchInlineSnapshot('true')
    const directory = await Fs.mkdtemp(
      Path.join(root, '.fixture-native-graph-'),
    )
    try {
      await Promise.all(
        Object.entries(result.modules).map(([name, module]) =>
          Fs.writeFile(Path.join(directory, name), module.code),
        ),
      )
      const output = await Esbuild.build({
        entryPoints: [Path.join(directory, 'index.ts')],
        alias: {
          'zyzz/runtime': Path.join(root, 'src/runtime/index.ts'),
          zyzz: Path.join(root, 'src/index.ts'),
        },
        bundle: true,
        platform: 'node',
        format: 'esm',
        write: false,
      })
      const file = Path.join(directory, 'bundle.mjs')
      await Fs.writeFile(
        file,
        output.outputFiles[0]!.text + `\nconsole.log(JSON.stringify(result));`,
      )
      const executed = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [file],
      )
      expect(JSON.parse(executed.stdout)).toMatchInlineSnapshot(`
        {
          "style": [
            {
              "color": "#ffffff",
              "fontSize": 20,
            },
            {
              "opacity": 0.7,
            },
          ],
        }
      `)
    } finally {
      await Fs.rm(directory, { recursive: true, force: true })
    }
    const light = compiler.compile({
      modules,
      native: { ...native, colorScheme: 'light' },
    })
    expect(
      light.modules['card.ts']!.code.includes('#000000'),
    ).toMatchInlineSnapshot('true')
    expect(
      light.modules['card.ts']!.code === result.modules['card.ts']!.code,
    ).toMatchInlineSnapshot('false')
    const edited = compiler.compile({
      modules: {
        ...modules,
        'theme.ts': modules['theme.ts'].replace('#000000', '#123456'),
      },
      native: { ...native, colorScheme: 'light' },
    })
    expect(
      edited.modules['card.ts']!.code.includes('#123456'),
    ).toMatchInlineSnapshot('true')
  })

  test.each([
    [
      `export default {opacity:.6};`,
      `export {default as native} from './values.js';`,
    ],
    [`export const native={opacity:.6};`, `export * from './values.js';`],
    [
      `export const native={opacity:.6};`,
      `import {native} from './values.js';export {native};`,
    ],
    [
      `export default {opacity:.6};`,
      `import native from './values.js';export {native};`,
    ],
    [
      `export const native={opacity:.6,lineHeight:undefined};`,
      `export * from './values.js';`,
    ],
  ])(
    'resolves immutable target constants through barrels',
    (values, barrel) => {
      const output = Graph.compile({
        modules: {
          'values.ts': values,
          'barrel.ts': barrel,
          'card.ts': `import {style} from 'zyzz';import {native} from './barrel.js';export const card=style({targets:{native}});`,
        },
      })

      expect(
        JSON.parse(output.contracts['card.ts']!).exports.card.style.style
          .targets.native,
      ).toMatchInlineSnapshot(`
      {
        "opacity": 0.6,
      }
    `)
    },
  )

  test('resolves direct default target imports', () => {
    const output = Graph.compile({
      modules: {
        'values.ts': `const native={opacity:.6};export default native;`,
        'card.ts': `import {style} from 'zyzz';import native from './values.js';export const card=style({targets:{native}});`,
      },
    })

    expect(
      JSON.parse(output.contracts['card.ts']!).exports.card.style.style.targets
        .native,
    ).toMatchInlineSnapshot(`
      {
        "opacity": 0.6,
      }
    `)
  })

  test.each([
    `native.opacity=.8;`,
    `Object.assign(native,{opacity:.8});`,
    `consume(native);`,
  ])('rejects mutations and escapes in target re-exports', (mutation) => {
    expect(() =>
      Graph.compile({
        modules: {
          'values.ts': `export const native={opacity:.6};`,
          'barrel.ts': `import {native} from './values.js';${mutation}export {native};`,
          'card.ts': `import {style} from 'zyzz';import {native} from './barrel.js';export const card=style({targets:{native}});`,
        },
      }),
    ).toThrow()
  })

  test('rejects ambiguous target star exports and terminates cycles', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'a.ts': `export const native={opacity:.6};`,
          'b.ts': `export const native={opacity:.8};`,
          'barrel.ts': `export * from './a.js';export * from './b.js';export * from './cycle.js';`,
          'cycle.ts': `export * from './barrel.js';`,
          'card.ts': `import {style} from 'zyzz';import {native} from './barrel.js';export const card=style({targets:{native}});`,
        },
      }),
    ).toThrow()
  })

  test('renders web target overrides in variant alternatives', async () => {
    const output = Graph.compile({
      modules: {
        'card.ts': `import {variants} from 'zyzz';export const card=variants({base:{opacity:.1,targets:{web:{opacity:.2},native:{opacity:.3}}},variants:{active:{yes:{targets:{web:{opacity:.8},ios:{opacity:.9}}}}}});export const props=card({active:'yes'});`,
      },
    })
    const contract = JSON.parse(output.contracts['card.ts']!)
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent('<div id="card">Card</div>')
      await page.addStyleTag({ content: output.modules['card.ts']!.css })
      await page.locator('#card').evaluate((element, classes) => {
        element.setAttribute('class', classes)
        element.setAttribute('data-active', 'yes')
      }, Object.values(output.modules['card.ts']!.classes)[0]!)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot(`"0.8"`)
      expect(contract.version).toMatchInlineSnapshot(`21`)
      expect(
        JSON.stringify(contract).includes('"ios":{"opacity":0.9}'),
      ).toMatchInlineSnapshot('true')
      const packed = Graph.compile({
        contracts: { 'lib/index.js': JSON.stringify(contract) },
        modules: {},
      })
      expect(packed).toBeDefined()
    } finally {
      await browser.close()
    }
  }, 30_000)

  test.each([
    `export const native={opacity:.6};native.opacity=.8;`,
    `export const native={opacity:.6};Object.assign(native,{opacity:.8});`,
    `export const native={get opacity(){throw new Error('must not execute')}};`,
    `export const native=(()=>({opacity:.6}))();`,
  ])('rejects nonliteral or mutable imported native declarations', (source) => {
    expect(() =>
      Graph.compile({
        modules: {
          'values.ts': source,
          'card.ts': `import {style} from 'zyzz';import {native} from './values.js';export const card=style({targets:{native}});`,
        },
      }),
    ).toThrow()
  })

  test('preserves target branches through re-exports and packed contracts', () => {
    const output = Graph.compile({
      modules: {
        'lib/values.ts': `const native={opacity:.6};export {native};`,
        'lib/values-index.ts': `export {native as shared} from './values.js';`,
        'lib/card.ts': `import {style} from 'zyzz';import {shared} from './values-index.js';export const card=style({opacity:.2,targets:{web:{opacity:.7},native:shared,ios:{opacity:.8}}});`,
        'lib/index.ts': `export {card} from './card.js';`,
      },
    })
    const contract = JSON.parse(output.contracts['lib/index.ts']!)
    const packed = Graph.compile({
      contracts: { 'lib/index.js': JSON.stringify(contract) },
      imports: { 'app.ts': { lib: 'lib/index.js' } },
      modules: {
        'app.ts': `import {card} from 'lib';export const props=card();export {card};`,
      },
    })
    const restored = JSON.parse(packed.contracts['app.ts']!)

    expect(contract.version).toMatchInlineSnapshot(`21`)
    expect(restored.exports.card.style.style.targets.native)
      .toMatchInlineSnapshot(`
      {
        "opacity": 0.6,
      }
    `)
    expect(restored.exports.card.style.style.targets.ios).toMatchInlineSnapshot(
      `
      {
        "opacity": 0.8,
      }
    `,
    )
    expect(restored.exports.card.style.style.targets.web.declarations)
      .toMatchInlineSnapshot(`
      [
        {
          "property": "opacity",
          "value": 0.7,
        },
      ]
    `)
    expect(
      output.modules['lib/card.ts']!.css.includes('opacity:0.7'),
    ).toMatchInlineSnapshot('true')
    expect(
      output.modules['lib/card.ts']!.css.includes('opacity:0.8'),
    ).toMatchInlineSnapshot('false')
    delete contract.exports.card.style.staticRecipe
    contract.version = 19
    expect(() =>
      Graph.compile({
        contracts: { 'lib/index.js': JSON.stringify(contract) },
        modules: {},
      }),
    ).toThrow('Target branches require contract version 20')
  })

  test('destructured config exports compile grouped styles through re-exports and packed contracts', () => {
    const output = Graph.compile({
      modules: {
        'pkg/config.ts': `import { Config } from 'zyzz'; export const { style, theme } = Config.create({theme:{color:{brand:'#06c'},spacing:{md:'8px'}}});`,
        'pkg/index.ts': `export { style, theme } from './config.js';`,
        'pkg/card.ts': `import { style, theme } from './index.js'; export namespace styles {
  export const card = style({padding:'md'})

  export const label = style({color:theme.tokens.color.brand})
} export const props = styles.card(); export const scope = theme.className;`,
      },
    })

    expect(output.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1g1qfxjzbnv3-style-theme{--z-t1g1qfxjzbnv3-style-spacing_2e_md:8px;--z-t1g1qfxjzbnv3-style-color_2e_brand:#06c;}
      .z-p-Da8vPq{padding:var(--z-t1g1qfxjzbnv3-style-spacing_2e_md,8px);}
      .z-text-7YXMOR{color:var(--z-t1g1qfxjzbnv3-style-color_2e_brand,#06c);}"
    `)
    expect(output.modules['pkg/card.ts']!.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';
      import { style, theme } from './index.js'; export namespace styles {
        export const card = __zyzzProps.create({className:"z-p-Da8vPq z-style-5ngs574r5xr9-91"})

        export const label = __zyzzProps.create({className:"z-text-7YXMOR z-style-5ngs574r5xr9-137"})
      } export const props = styles.card(); export const scope = "z_theme-1g1qfxjzbnv3-style-theme";"
    `)

    const packed = Graph.compile({
      contracts: { 'library/index.js': output.contracts['pkg/index.ts']! },
      modules: {
        'app/card.ts': `import { style, theme } from 'library'; export namespace styles {
  export const card = style({color:'brand'})
} export const scope = theme.className;`,
      },
      imports: { 'app/card.ts': { library: 'library/index.js' } },
    })

    expect(packed.modules['app/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1g1qfxjzbnv3-style-theme{--z-t1g1qfxjzbnv3-style-color_2e_brand:#06c;--z-t1g1qfxjzbnv3-style-spacing_2e_md:8px;}
      .z-text-kekf5L{color:var(--z-t1g1qfxjzbnv3-style-color_2e_brand,#06c);}"
    `)
  })

  test('renamed destructured config bindings retain token inference during compilation', () => {
    const output = Graph.compile({
      modules: {
        'app/card.ts': `import { Config } from 'zyzz'; const { style: styled, theme: palette } = Config.create({theme:{color:{brand:'#06c'}}}); export namespace styles {
  export const card = styled({color:palette.tokens.color.brand})
}`,
      },
    })

    expect(output.modules['app/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-ujlnau19561g8-styled-theme{--z-tujlnau19561g8-styled-color_2e_brand:#06c;}
      .z-text-9dn05P{color:var(--z-tujlnau19561g8-styled-color_2e_brand,#06c);}"
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
export const original = zyzz.style({color:'brand'})();
export const props = other.style({color:'brand'})();
export const scope = mint.className;`,
      },
    })

    expect(output.modules['pkg/config.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1g1qfxjzbnv3-zyzz-theme{--z-t1g1qfxjzbnv3-zyzz-color_2e_brand:#06c;}
      .z_theme-1g1qfxjzbnv3-mint{--z-t1g1qfxjzbnv3-zyzz-color_2e_brand:#175;}
      .z_theme-1g1qfxjzbnv3-other-theme{--z-t1g1qfxjzbnv3-other-color_2e_brand:#06c;}
      .z-text-NoBexA-0{color:var(--z-t1g1qfxjzbnv3-zyzz-color_2e_brand,#06c);}
      .z-text-t6eO5h-0{color:var(--z-t1g1qfxjzbnv3-other-color_2e_brand,#06c);}"
    `)
    expect(
      output.modules['pkg/config.ts']!.code.includes('Config.create('),
    ).toMatchInlineSnapshot(`false`)
  })

  test('numeric configuration keys retain tokens and reject string-equivalent duplicates', () => {
    const output = Graph.compile({
      modules: {
        'pkg/config.ts': `import { Config } from 'zyzz'; const zyzz = Config.create({theme:{color:{brand:{500:'#06c'}},spacing:{2:'8px'}}}); export const props = zyzz.style({color:'brand.500',padding:zyzz.theme.tokens.spacing[2]})();`,
      },
    })

    expect(output.modules['pkg/config.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1g1qfxjzbnv3-zyzz-theme{--z-t1g1qfxjzbnv3-zyzz-color_2e_brand_2e_500:#06c;--z-t1g1qfxjzbnv3-zyzz-spacing_2e_2:8px;}
      .z-text-gjn37r{color:var(--z-t1g1qfxjzbnv3-zyzz-color_2e_brand_2e_500,#06c);}
      .z-p-ICp3rx{padding:var(--z-t1g1qfxjzbnv3-zyzz-spacing_2e_2,8px);}"
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
        'pkg/config.js': `import { Config } from 'zyzz'; export const zyzz = Config.create({defaultTheme:'brand.dark',themes:{'brand.dark':{color:{brand:'#06c'}}}}); export const props = zyzz.style({color:'brand'})(); export const scope = zyzz.themes['brand.dark'].className;`,
      },
    })

    expect(library.modules['pkg/config.js']!.code).toMatchInlineSnapshot(
      `
      "
      import { Appearance as __zyzzAppearance, Selection as __zyzzSelection } from 'zyzz/runtime';
       export const zyzz = ({appearance:__zyzzAppearance.root([["brand.dark","z_theme-1fzmg4ts3ctu1-zyzz-brand_2e_dark"]],{"defaultTheme":"brand.dark"}),script:__zyzzAppearance.create([["brand.dark","z_theme-1fzmg4ts3ctu1-zyzz-brand_2e_dark"]]),theme:{"className":"z_theme-1fzmg4ts3ctu1-zyzz-brand_2e_dark"},themes:/*#__PURE__*/__zyzzSelection.create([["brand.dark","z_theme-1fzmg4ts3ctu1-zyzz-brand_2e_dark"]],false)}); export const props = ({className:"z-text-WStLob"}); export const scope = "z_theme-1fzmg4ts3ctu1-zyzz-brand_2e_dark";"
    `,
    )

    const options = {
      contracts: { 'library/index.js': library.contracts['pkg/config.js']! },
      imports: { 'app/card.js': { '@acme/theme': 'library/index.js' } },
      modules: {
        'app/card.js': `import { zyzz } from '@acme/theme'; export const props = zyzz.style({color:zyzz.themes['brand.dark'].tokens.color.brand})(); export const scope = zyzz.themes['brand.dark'].className;`,
      },
    }

    expect(Graph.compile(options).modules['app/card.js']!.css)
      .toMatchInlineSnapshot(`
        ".z_theme-1fzmg4ts3ctu1-zyzz-brand_2e_dark{--z-t1fzmg4ts3ctu1-zyzz-color_2e_brand:#06c;}
        .z-text-8A5JJg{color:var(--z-t1fzmg4ts3ctu1-zyzz-color_2e_brand,#06c);}"
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
      [Source.ExtractError: app/card.js:75: Use direct configuration style calls or static theme members; configurations cannot escape or be mutated.
      app/card.js:143: Use direct configuration style calls or static theme members; configurations cannot escape or be mutated.]
    `)
  })

  test('configuration defaults, aliases, edits, and packed metadata retain the same contract', () => {
    const compiler = Graph.create()
    const output = compiler.compile({ modules: ConfigFixture.modules })

    expect(output.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-69adjg15dlzyu-zyzz-mint{--z-t69adjg15dlzyu-zyzz-color_2e_brand:light-dark(#175,#afa);--z-t69adjg15dlzyu-zyzz-spacing_2e_md:12px;}
      .z_theme-69adjg15dlzyu-zyzz-base{--z-t69adjg15dlzyu-zyzz-color_2e_brand:light-dark(#06c,#9cf);--z-t69adjg15dlzyu-zyzz-spacing_2e_md:8px;}
      .z_scheme-dark{color-scheme:dark;}
      .z_scheme-light{color-scheme:light;}
      .z_scheme-light-dark{color-scheme:light dark;}
      .z-text-ZwwVzx{color:var(--z-t69adjg15dlzyu-zyzz-color_2e_brand,light-dark(#06c,#9cf));}
      .z-p-S0bkzn{padding:var(--z-t69adjg15dlzyu-zyzz-spacing_2e_md,8px);}"
    `)
    expect(output.modules['pkg/zyzz.config.ts']!.code).toMatchInlineSnapshot(
      `
      "
      import { Appearance as __zyzzAppearance, Selection as __zyzzSelection } from 'zyzz/runtime';
       import { base } from './base.js'; export const zyzz = ({appearance:__zyzzAppearance.root([["mint","z_theme-69adjg15dlzyu-zyzz-mint"],["base","z_theme-69adjg15dlzyu-zyzz-base"]],{"defaultTheme":"base"}),script:__zyzzAppearance.create([["mint","z_theme-69adjg15dlzyu-zyzz-mint"],["base","z_theme-69adjg15dlzyu-zyzz-base"]]),theme:{"className":"z_theme-69adjg15dlzyu-zyzz-base"},themes:/*#__PURE__*/__zyzzSelection.create([["mint","z_theme-69adjg15dlzyu-zyzz-mint"],["base","z_theme-69adjg15dlzyu-zyzz-base"]],false)} as import('zyzz').Config.create.ReturnType<{readonly "defaultTheme":"base";readonly "themes":{readonly "mint":{readonly "color":{readonly "brand":{readonly "dark":"#afa";readonly "light":"#175"}};readonly "spacing":{readonly "md":"12px"}};readonly "base":{readonly "color":{readonly "brand":{readonly "dark":"#9cf";readonly "light":"#06c"}};readonly "spacing":{readonly "md":"8px"}}};readonly "layers":readonly ["reset","components"]}>);"
    `,
    )
    expect(output.modules['pkg/card.ts']!.code).toMatchInlineSnapshot(
      `"import { design } from './index.js'; const zyzz = (design as import('zyzz').Config.create.ReturnType<{readonly "defaultTheme":"base";readonly "themes":{readonly "mint":{readonly "color":{readonly "brand":{readonly "dark":"#afa";readonly "light":"#175"}};readonly "spacing":{readonly "md":"12px"}};readonly "base":{readonly "color":{readonly "brand":{readonly "dark":"#9cf";readonly "light":"#06c"}};readonly "spacing":{readonly "md":"8px"}}};readonly "layers":readonly ["reset","components"]}>); const { style } = (zyzz as import('zyzz').Config.create.ReturnType<{readonly "defaultTheme":"base";readonly "themes":{readonly "mint":{readonly "color":{readonly "brand":{readonly "dark":"#afa";readonly "light":"#175"}};readonly "spacing":{readonly "md":"12px"}};readonly "base":{readonly "color":{readonly "brand":{readonly "dark":"#9cf";readonly "light":"#06c"}};readonly "spacing":{readonly "md":"8px"}}};readonly "layers":readonly ["reset","components"]}>); export const props = ({className:"z-text-ZwwVzx z-p-S0bkzn"}); export const scope = "z_theme-69adjg15dlzyu-zyzz-mint";"`,
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
      .z_scheme-dark{color-scheme:dark;}
      .z_scheme-light{color-scheme:light;}
      .z_scheme-light-dark{color-scheme:light dark;}
      .z-text-ZwwVzx{color:var(--z-t69adjg15dlzyu-zyzz-color_2e_brand,light-dark(#06c,#9cf));}
      .z-p-S0bkzn{padding:var(--z-t69adjg15dlzyu-zyzz-spacing_2e_md,8px);}"
    `)

    const mapping = new Trace.TraceMap(output.modules['pkg/card.ts']!.cssMap)

    expect(
      Trace.originalPositionFor(mapping, { line: 1, column: 0 }).source,
    ).toMatchInlineSnapshot(`"pkg/zyzz.config.ts"`)

    const packed = Graph.compile({
      contracts: { 'library/index.js': output.contracts['pkg/index.ts']! },
      imports: { 'app/card.ts': { '@acme/theme': 'library/index.js' } },
      modules: {
        'app/card.ts': `import { design as zyzz } from '@acme/theme'; export const props = zyzz.style({color:'brand',padding:'md'})(); export const scope = zyzz.themes.mint.className;`,
      },
    })

    expect(packed.modules['app/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1h7j9xm1yzxb90-base{--z-t1h7j9xm1yzxb90-base-color_2e_brand:light-dark(#06c,#9cf);--z-t1h7j9xm1yzxb90-base-spacing_2e_md:8px;}
      .z_theme-69adjg15dlzyu-zyzz-mint{--z-t69adjg15dlzyu-zyzz-color_2e_brand:light-dark(#175,#afa);--z-t69adjg15dlzyu-zyzz-spacing_2e_md:12px;}
      .z_theme-69adjg15dlzyu-zyzz-base{--z-t69adjg15dlzyu-zyzz-color_2e_brand:light-dark(#06c,#9cf);--z-t69adjg15dlzyu-zyzz-spacing_2e_md:8px;}
      .z-text-tzHeLi{color:var(--z-t69adjg15dlzyu-zyzz-color_2e_brand,light-dark(#06c,#9cf));}
      .z-p-0c8Uy5{padding:var(--z-t69adjg15dlzyu-zyzz-spacing_2e_md,8px);}"
    `)
    expect(packed.modules['app/card.ts']!.code).toMatchInlineSnapshot(
      `"import { design as zyzz } from '@acme/theme'; export const props = ({className:"z-text-tzHeLi z-p-0c8Uy5"}); export const scope = "z_theme-69adjg15dlzyu-zyzz-mint";"`,
    )
  })

  test('single and token-free configuration calls compile without runtime factories', () => {
    const output = Graph.compile({
      modules: {
        'pkg/config.ts': `import { Config, Theme } from 'zyzz'; export const empty = Config.create(); const base = Theme.define({color:{brand:'#06c'}}); export const zyzz = Config.create({theme:base}); const theme = zyzz.theme; export const mint = Theme.extend(zyzz.theme,{color:{brand:'#175'}}); export const props = zyzz.style({color:theme.tokens.color.brand})(); export const plain = empty.style({padding:'8px'})();`,
      },
    })

    expect(output.modules['pkg/config.ts']!.code).toMatchInlineSnapshot(
      `
      "
      import { Appearance as __zyzzAppearance } from 'zyzz/runtime';
       export const empty = ({appearance:__zyzzAppearance.root([]),script:__zyzzAppearance.create([])} as import('zyzz').Config.create.ReturnType<{}>); const base = ({className:"z_theme-1g1qfxjzbnv3-base"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"}}>); export const zyzz = ({appearance:__zyzzAppearance.root([]),script:__zyzzAppearance.create([]),theme:{"className":"z_theme-1g1qfxjzbnv3-zyzz-theme"}} as import('zyzz').Config.create.ReturnType<{readonly "theme":{readonly "color":{readonly "brand":"#06c"}}}>); const theme = (zyzz.theme as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"}}>); export const mint = ({className:"z_theme-1g1qfxjzbnv3-mint"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"}}>); export const props = ({className:"z-text-hsmTVp"}); export const plain = ({className:"z-p-8px-KVn49Z"});"
    `,
    )
    expect(output.modules['pkg/config.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1g1qfxjzbnv3-zyzz-theme{--z-t1g1qfxjzbnv3-zyzz-color_2e_brand:#06c;}
      .z_theme-1g1qfxjzbnv3-mint{--z-t1g1qfxjzbnv3-zyzz-color_2e_brand:#175;}
      .z_scheme-dark{color-scheme:dark;}
      .z_scheme-light{color-scheme:light;}
      .z_scheme-light-dark{color-scheme:light dark;}
      .z-text-hsmTVp{color:var(--z-t1g1qfxjzbnv3-zyzz-color_2e_brand,#06c);}
      .z-p-8px-KVn49Z{padding:8px;}"
    `)
  })

  test('destructured appearance controls compile with the configured storage key', () => {
    const output = Graph.compile({
      modules: {
        'pkg/config.ts': `import { Config } from 'zyzz'; export const { appearance, style } = Config.create({ defaultTheme: 'base', storageKey: 'app', themes: { base: { color: { ink: '#123456' } }, mint: { color: { ink: '#008844' } } } }); export const initial = appearance.get(); export const controls = appearance;`,
        'pkg/single.ts': `import { Config } from 'zyzz'; export const zyzz = Config.create({ theme: { color: { ink: '#123456' } } }); export const select = () => zyzz.appearance.set({ colorScheme: 'dark' });`,
      },
    })
    const code = output.modules['pkg/config.ts']!.code

    expect(
      code.includes('appearance:__zyzzAppearance.root('),
    ).toMatchInlineSnapshot('true')
    expect(
      code.includes('{"defaultTheme":"base","storageKey":"app"}'),
    ).toMatchInlineSnapshot('true')
    expect(code.includes('script:')).toMatchInlineSnapshot('false')
    expect(
      output.modules['pkg/single.ts']!.code.includes(
        'appearance:__zyzzAppearance.root([])',
      ),
    ).toMatchInlineSnapshot('true')
  })

  test('destructured selectors pass to runtime helpers as values', () => {
    const output = Graph.compile({
      modules: {
        'pkg/config.ts': `import { Config } from 'zyzz'; export const { themes } = Config.create({ defaultTheme: 'base', themes: { base: { color: { ink: '#123456' } }, mint: { color: { ink: '#008844' } } } }); export const names = Object.keys(themes); export const catalog = [themes];`,
      },
    })
    const code = output.modules['pkg/config.ts']!.code

    expect(code.includes('__zyzzSelection.create(')).toMatchInlineSnapshot(
      'true',
    )
    expect(code.includes('Object.keys(themes)')).toMatchInlineSnapshot('true')
    expect(code.includes('[themes]')).toMatchInlineSnapshot('true')
  })

  test('configuration dynamic access and escaping fail before emission', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'pkg/config.ts': `import { Config } from 'zyzz'; const zyzz = Config.create(); console.log(zyzz);`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/config.ts:73: Use direct configuration style calls or static theme members; configurations cannot escape or be mutated.]`,
    )
    expect(() =>
      Graph.compile({
        modules: {
          'pkg/config.ts': `import { Config } from 'zyzz'; const zyzz = Config.create({theme:{color:{brand:'#06c'}}}); const key = 'theme'; export const scope = zyzz[key].className;`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: pkg/config.ts:133: Use direct configuration style calls or static theme members; configurations cannot escape or be mutated.]`,
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
        'library/theme.ts': `import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#06c'},spacing:{md:'8px'}}); export const mint = Theme.extend(theme,{color:{brand:'#175'}}); export const style = theme.style;`,
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
        'app/card.ts': `import { mint, style, theme } from '@acme/theme'; import { Theme } from 'zyzz'; export const local = Theme.extend(theme,{color:{brand:'#f00'}}); export const props = style({color:theme.tokens.color.brand,padding:'md'})(); export const scope = mint.className;`,
      },
    }

    const output = compiler.compile(options)

    expect(output.modules['app/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-18pt0w1ocy15n-theme{--z-t18pt0w1ocy15n-theme-color_2e_brand:#06c;--z-t18pt0w1ocy15n-theme-spacing_2e_md:8px;}
      .z_theme-18pt0w1ocy15n-mint{--z-t18pt0w1ocy15n-theme-color_2e_brand:#175;--z-t18pt0w1ocy15n-theme-spacing_2e_md:8px;}
      .z_theme-ujlnau19561g8-local{--z-t18pt0w1ocy15n-theme-color_2e_brand:#f00;--z-t18pt0w1ocy15n-theme-spacing_2e_md:8px;}
      .z-text-E4luCn{color:var(--z-t18pt0w1ocy15n-theme-color_2e_brand,#06c);}
      .z-p-sEtteP{padding:var(--z-t18pt0w1ocy15n-theme-spacing_2e_md,8px);}"
    `)
    expect(output.modules['app/card.ts']!.code).toMatchInlineSnapshot(
      `"import { mint, style, theme } from '@acme/theme';  export const local = ({className:"z_theme-ujlnau19561g8-local"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}}>); export const props = ({className:"z-text-E4luCn z-p-sEtteP"}); export const scope = "z_theme-18pt0w1ocy15n-mint";"`,
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
        "style-ujlnau19561g8-166": "z-text-E4luCn z-p-sEtteP",
      }
    `)
    expect(updated.modules['app/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-18pt0w1ocy15n-theme{--z-t18pt0w1ocy15n-theme-color_2e_brand:#06c;--z-t18pt0w1ocy15n-theme-spacing_2e_md:8px;}
      .z_theme-18pt0w1ocy15n-mint{--z-t18pt0w1ocy15n-theme-color_2e_brand:#080;--z-t18pt0w1ocy15n-theme-spacing_2e_md:8px;}
      .z_theme-ujlnau19561g8-local{--z-t18pt0w1ocy15n-theme-color_2e_brand:#f00;--z-t18pt0w1ocy15n-theme-spacing_2e_md:8px;}
      .z-text-E4luCn{color:var(--z-t18pt0w1ocy15n-theme-color_2e_brand,#06c);}
      .z-p-sEtteP{padding:var(--z-t18pt0w1ocy15n-theme-spacing_2e_md,8px);}"
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
        'app/a.ts': `import { styles } from '@acme/theme'; export const a = style({color:'brand'})();`,
        'app/b.ts': `import { styles } from '@acme/theme'; export const b = style({padding:'md'})();`,
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
      .z_theme-18i5hb1ihk25d-mint{--z-t1p8at5ioin1tk-theme-color_2e_brand:#175;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;--z-t1p8at5ioin1tk-theme-spacing_2e_unused:99px;}"
    `)
    expect(output.modules['app/b.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#06c;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;--z-t1p8at5ioin1tk-theme-spacing_2e_unused:99px;}
      .z_theme-18i5hb1ihk25d-mint{--z-t1p8at5ioin1tk-theme-color_2e_brand:#175;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;--z-t1p8at5ioin1tk-theme-spacing_2e_unused:99px;}"
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
          'app/card.ts': `import { styles } from 'first'; import { mint } from 'second'; export const props = style({color:'brand'})(); export const scope = mint.className;`,
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
        'pkg/card.ts': `import { theme } from './index.js'; export const value = theme.style('ordinary');`,
      },
    })

    expect(output.modules['pkg/card.ts']!.code).toMatchInlineSnapshot(
      `"import { theme } from './index.js'; export const value = theme.style('ordinary');"`,
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
        'pkg/card.ts': `import { style } from './theme.js'; export function run(style: (value: string) => string) { return style('ordinary') } export const props = style({color:'brand'})();`,
      },
    })

    expect(output.modules['pkg/card.ts']!.code).toMatchInlineSnapshot(
      `"import { style } from './theme.js'; export function run(style: (value: string) => string) { return style('ordinary') } export const props = ({className:"z-text-M9AX2F"});"`,
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
      `"import { theme, style, mint } from './index.js'; export const props = ({className:"z-text-M9AX2F z-p-nDkRTf"}); export const scope = "z_theme-18i5hb1ihk25d-mint";"`,
    )
    expect(output.modules['pkg/card.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#06c;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;}
      .z_theme-18i5hb1ihk25d-mint{--z-t1p8at5ioin1tk-theme-color_2e_brand:#175;--z-t1p8at5ioin1tk-theme-spacing_2e_md:8px;}
      .z-text-M9AX2F{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);}
      .z-p-nDkRTf{padding:var(--z-t1p8at5ioin1tk-theme-spacing_2e_md,8px);}"
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
        "{"props":{"className":"z-text-M9AX2F z-p-nDkRTf"},"scope":"z_theme-18i5hb1ihk25d-mint"}
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
        { timeout: 30_000 },
      )

      expect(checked.stdout).toMatchInlineSnapshot(`""`)
    } finally {
      await Fs.rm(directory, { recursive: true, force: true })
    }
  }, 35_000)

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
        "style-5ngs574r5xr9-70": "z-text-6nZ0FV z-p-nDkRTf",
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
        "style-5ngs574r5xr9-70": "z-text-M9AX2F z-p-nDkRTf",
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

  test('extensionless imports link themes from every supported source extension', () => {
    const stylesheets: Record<string, string> = {}
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
        const id = `pkg/theme${suffix}.${extension}`
        const output = Graph.compile({
          modules: {
            'pkg/card.ts': `import { theme } from './theme'; export const props = theme.style({color:'brand'})();`,
            [id]: modules['pkg/theme.ts'],
          },
        })
        expect(
          output.modules['pkg/card.ts']!.code.includes(
            JSON.stringify(
              Object.values(output.modules['pkg/card.ts']!.classes)[0],
            ),
          ),
        ).toMatchInlineSnapshot('true')
        stylesheets[id] = output.modules['pkg/card.ts']!.css
      }
    }
    expect(stylesheets).toMatchInlineSnapshot(`
      {
        "pkg/theme.cjs": ".z_theme-vj54t717rzpm5-theme{--z-tvj54t717rzpm5-theme-color_2e_brand:#06c;}
      .z-text-0unML8{color:var(--z-tvj54t717rzpm5-theme-color_2e_brand,#06c);}",
        "pkg/theme.cjsx": ".z_theme-1jqrhi11m9qdsp-theme{--z-t1jqrhi11m9qdsp-theme-color_2e_brand:#06c;}
      .z-text-4lUZcl{color:var(--z-t1jqrhi11m9qdsp-theme-color_2e_brand,#06c);}",
        "pkg/theme.cts": ".z_theme-r3hspl14ztdxn-theme{--z-tr3hspl14ztdxn-theme-color_2e_brand:#06c;}
      .z-text-3MS2_V{color:var(--z-tr3hspl14ztdxn-theme-color_2e_brand,#06c);}",
        "pkg/theme.ctsx": ".z_theme-17sd7oz1an7eof-theme{--z-t17sd7oz1an7eof-theme-color_2e_brand:#06c;}
      .z-text-4JUyJI{color:var(--z-t17sd7oz1an7eof-theme-color_2e_brand,#06c);}",
        "pkg/theme.js": ".z_theme-1vtv2ec1wfpxtq-theme{--z-t1vtv2ec1wfpxtq-theme-color_2e_brand:#06c;}
      .z-text-KYLMDJ{color:var(--z-t1vtv2ec1wfpxtq-theme-color_2e_brand,#06c);}",
        "pkg/theme.jsx": ".z_theme-vomr9w1ly6hby-theme{--z-tvomr9w1ly6hby-theme-color_2e_brand:#06c;}
      .z-text-Y6bsOg{color:var(--z-tvomr9w1ly6hby-theme-color_2e_brand,#06c);}",
        "pkg/theme.mjs": ".z_theme-ax2jo515o9mmb-theme{--z-tax2jo515o9mmb-theme-color_2e_brand:#06c;}
      .z-text-cv6VwP{color:var(--z-tax2jo515o9mmb-theme-color_2e_brand,#06c);}",
        "pkg/theme.mjsx": ".z_theme-qjbatz1ydbtfb-theme{--z-tqjbatz1ydbtfb-theme-color_2e_brand:#06c;}
      .z-text-AlXn8H{color:var(--z-tqjbatz1ydbtfb-theme-color_2e_brand,#06c);}",
        "pkg/theme.mts": ".z_theme-axno9rsn6z85-theme{--z-taxno9rsn6z85-theme-color_2e_brand:#06c;}
      .z-text-81DVcU{color:var(--z-taxno9rsn6z85-theme-color_2e_brand,#06c);}",
        "pkg/theme.mtsx": ".z_theme-1uyg4h1nwei8h-theme{--z-t1uyg4h1nwei8h-theme-color_2e_brand:#06c;}
      .z-text-yIMhnL{color:var(--z-t1uyg4h1nwei8h-theme-color_2e_brand,#06c);}",
        "pkg/theme.ts": ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#06c;}
      .z-text-M9AX2F{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);}",
        "pkg/theme.tsx": ".z_theme-1mppelm2v81s-theme{--z-t1mppelm2v81s-theme-color_2e_brand:#06c;}
      .z-text-kSOs5I{color:var(--z-t1mppelm2v81s-theme-color_2e_brand,#06c);}",
        "pkg/theme/index.cjs": ".z_theme-9rdhtkayoccw-theme{--z-t9rdhtkayoccw-theme-color_2e_brand:#06c;}
      .z-text-oqhxeb{color:var(--z-t9rdhtkayoccw-theme-color_2e_brand,#06c);}",
        "pkg/theme/index.cjsx": ".z_theme-qqufwg16uwqvc-theme{--z-tqqufwg16uwqvc-theme-color_2e_brand:#06c;}
      .z-text-KUq2YH{color:var(--z-tqqufwg16uwqvc-theme-color_2e_brand,#06c);}",
        "pkg/theme/index.cts": ".z_theme-7hri2qdg3eau-theme{--z-t7hri2qdg3eau-theme-color_2e_brand:#06c;}
      .z-text-_22RQ2{color:var(--z-t7hri2qdg3eau-theme-color_2e_brand,#06c);}",
        "pkg/theme/index.ctsx": ".z_theme-1gnhf7yeof43a-theme{--z-t1gnhf7yeof43a-theme-color_2e_brand:#06c;}
      .z-text--HXHM8{color:var(--z-t1gnhf7yeof43a-theme-color_2e_brand,#06c);}",
        "pkg/theme/index.js": ".z_theme-k60ez51fti4gf-theme{--z-tk60ez51fti4gf-theme-color_2e_brand:#06c;}
      .z-text-EGWpXC{color:var(--z-tk60ez51fti4gf-theme-color_2e_brand,#06c);}",
        "pkg/theme/index.jsx": ".z_theme-5msdfven29b7-theme{--z-t5msdfven29b7-theme-color_2e_brand:#06c;}
      .z-text-aDZDq5{color:var(--z-t5msdfven29b7-theme-color_2e_brand,#06c);}",
        "pkg/theme/index.mjs": ".z_theme-4cm3ea1msr4fq-theme{--z-t4cm3ea1msr4fq-theme-color_2e_brand:#06c;}
      .z-text-tYm1WO{color:var(--z-t4cm3ea1msr4fq-theme-color_2e_brand,#06c);}",
        "pkg/theme/index.mjsx": ".z_theme-xh8u7yzqpmau-theme{--z-txh8u7yzqpmau-theme-color_2e_brand:#06c;}
      .z-text-mv6F5_{color:var(--z-txh8u7yzqpmau-theme-color_2e_brand,#06c);}",
        "pkg/theme/index.mts": ".z_theme-6j6cqw1uhie2o-theme{--z-t6j6cqw1uhie2o-theme-color_2e_brand:#06c;}
      .z-text-ONpwJ7{color:var(--z-t6j6cqw1uhie2o-theme-color_2e_brand,#06c);}",
        "pkg/theme/index.mtsx": ".z_theme-zlq34g1ju1zx4-theme{--z-tzlq34g1ju1zx4-theme-color_2e_brand:#06c;}
      .z-text-FcfDiL{color:var(--z-tzlq34g1ju1zx4-theme-color_2e_brand,#06c);}",
        "pkg/theme/index.ts": ".z_theme-frljoj7wf8g9-theme{--z-tfrljoj7wf8g9-theme-color_2e_brand:#06c;}
      .z-text-MXEfZO{color:var(--z-tfrljoj7wf8g9-theme-color_2e_brand,#06c);}",
        "pkg/theme/index.tsx": ".z_theme-46atq9rsv205-theme{--z-t46atq9rsv205-theme-color_2e_brand:#06c;}
      .z-text-aviJxk{color:var(--z-t46atq9rsv205-theme-color_2e_brand,#06c);}",
      }
    `)
  })

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
      .z-text-sNm813{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);}
      .z-p-20px-OvtTGM{padding:20px;}"
    `)
    expect(before.modules['pkg/card0.ts']!.css).toMatchInlineSnapshot(`
      ".z_theme-1p8at5ioin1tk-theme{--z-t1p8at5ioin1tk-theme-color_2e_brand:#06c;}
      .z_theme-18i5hb1ihk25d-mint{--z-t1p8at5ioin1tk-theme-color_2e_brand:#175;}
      .z-text-sNm813{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);}
      .z-p-0px-OvtTGM{padding:0px;}"
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
      .z-text-6nZ0FV{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#f00);}
      .z-p-nDkRTf{padding:var(--z-t1p8at5ioin1tk-theme-spacing_2e_md,8px);}"
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
      import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#f00'},spacing:{md:'8px',unused:'99px'}}); export const style = theme.style;",
        "import { Theme } from 'zyzz'; import { theme } from './theme.js'; export const mint = Theme.extend(theme, {color:{brand:'#175'}});",
      ]
    `)
  })

  test('unimported compatible scope edits invalidate consumer CSS', () => {
    const compiler = Graph.create()
    const sources = {
      ...modules,
      'pkg/card.ts': `import { style } from './theme.js'; export const props = style({color:'brand'})();`,
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
      .z-text-M9AX2F{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);}"
    `)
  })

  test('import edits preserve the new graph scope order', () => {
    const compiler = Graph.create()

    const sources = {
      'pkg/a.ts': `export const value = 1;`,
      'pkg/b.ts': `import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#000'}});`,
      'pkg/c.ts': `import { Theme } from 'zyzz'; export const theme = Theme.define({color:{brand:'#fff'}});`,
      'pkg/styles.ts': `import { theme } from './b.js'; export const props = theme.style({color:'brand'})();`,
    }

    const before = compiler.compile({ modules: sources })

    const after = compiler.compile({
      modules: {
        ...sources,
        'pkg/a.ts': `import './c.js'; export const value = 1;`,
      },
    })

    expect(
      after.modules['pkg/styles.ts'] === before.modules['pkg/styles.ts'],
    ).toMatchInlineSnapshot(`false`)
    expect(Object.keys(after.modules['pkg/styles.ts']!.themes))
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
      'pkg/card.ts': `import { mint } from './alternate.js'; export const props = mint.style({color:'brand'})();`,
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
      .z-text-6nZ0FV{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#f00);}"
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
      'pkg/card.ts': `import { style } from './theme'; export const props = style({color:'brand'})();`,
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
      .z-text-M9AX2F{color:var(--z-t1p8at5ioin1tk-theme-color_2e_brand,#06c);}"
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
      'pkg/card.ts': `import { theme } from '@theme'; export const props = theme.style({color:'brand'})();`,
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
      .z-text-Kpfw_V{color:var(--z-tc1mlirqoc0mf-theme-color_2e_brand,#fff);}"
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

describe('output', () => {
  describe('compile', () => {
    test('retains producer modes and dynamic composition across all mode pairs', async () => {
      const browser = await chromium.launch()
      try {
        for (const producer of ['atomic', 'grouped'] as const) {
          const root = await Fs.mkdtemp(Path.resolve('.fixture-css-output-'))
          try {
            const library = await Library.create(root, {
              cssOutput: producer,
              output: 'react',
            })
            const contract = await Fs.readFile(
              Path.join(library.installed, 'index.js.zyzz.json'),
              'utf8',
            )
            const libraryCss = await Fs.readFile(
              Path.join(library.installed, 'style.css'),
              'utf8',
            )
            expect(JSON.parse(contract).version).toMatchInlineSnapshot(`21`)
            if (producer === 'atomic')
              expect(
                JSON.parse(contract).exports.controls.members.button.style.style
                  .cssOutput,
              ).toMatchInlineSnapshot(`"atomic"`)
            else
              expect(
                JSON.parse(contract).exports.controls.members.button.style.style
                  .cssOutput,
              ).toMatchInlineSnapshot(`"grouped"`)
            expect(await Fs.readdir(library.installed)).not.toContain(
              'styles.ts',
            )

            for (const consumer of ['atomic', 'grouped'] as const) {
              const source = `import {Config,cx} from 'zyzz';import {controls,style} from '@acme/variants';
const {style:configured}=Config.create({cssOutput:'${consumer}'});
const override=configured({paddingLeft:'5px'});
export const authored=style({color:'red',padding:'6px'});
export function sample(active:boolean){return cx(controls.button({size:active?{custom:{padding:'20px'}}:undefined,active,conditions:{wide:{size:'lg'}}}),override())}`
              const input = {
                contracts: { 'library/index.js': contract },
                imports: {
                  'app.ts': {
                    '@acme/variants': 'library/index.js',
                    zyzz: null,
                  },
                },
                modules: { 'app.ts': source },
              }
              const result = Graph.compile(input)
              const app = result.modules['app.ts']!
              if (producer === 'grouped')
                expect(
                  app.css.includes('{color:red;padding:6px;}'),
                ).toMatchInlineSnapshot(`true`)
              else
                expect(
                  app.css.includes('{color:red;padding:6px;}'),
                ).toMatchInlineSnapshot(`false`)
              const built = await Esbuild.build({
                bundle: true,
                format: 'iife',
                globalName: 'fixture',
                platform: 'browser',
                stdin: { contents: app.code, loader: 'ts', resolveDir: root },
                write: false,
              })
              const page = await browser.newPage({
                viewport: { width: 450, height: 400 },
              })
              try {
                // Both independent stylesheet orders must preserve explicit cx precedence.
                for (const css of [
                  libraryCss + '\n' + app.css,
                  app.css + '\n' + libraryCss,
                ]) {
                  await page.setContent(
                    `<style>${result.sharedCss ?? ''}\n${css}</style><div id="card"></div>`,
                  )
                  await page.addScriptTag({
                    content: built.outputFiles[0]!.text,
                  })
                  for (const active of [false, true, false]) {
                    const value = await page.evaluate((active) => {
                      const sample = (
                        window as unknown as {
                          fixture: {
                            sample(active: boolean): Record<string, unknown>
                          }
                        }
                      ).fixture.sample
                      const props = sample(active)
                      const element = document.querySelector(
                        '#card',
                      ) as HTMLElement
                      for (const name of element.getAttributeNames())
                        if (name !== 'id') element.removeAttribute(name)
                      element.className = props.className as string
                      for (const [key, value] of Object.entries(props)) {
                        if (key.startsWith('data-'))
                          element.setAttribute(key, String(value))
                        if (key === 'style')
                          for (const [name, scalar] of Object.entries(
                            value as Record<string, string>,
                          ))
                            element.style.setProperty(name, scalar)
                      }
                      const style = getComputedStyle(element)
                      return {
                        border: style.borderTopWidth,
                        keys: Object.keys(props).filter(
                          (key) =>
                            !['className', 'style'].includes(key) &&
                            !key.startsWith('data-'),
                        ),
                        opacity: style.opacity,
                        paddingLeft: style.paddingLeft,
                        paddingRight: style.paddingRight,
                      }
                    }, active)
                    if (active)
                      expect(value).toMatchInlineSnapshot(`
                    {
                      "border": "3px",
                      "keys": [],
                      "opacity": "1",
                      "paddingLeft": "5px",
                      "paddingRight": "20px",
                    }
                  `)
                    else
                      expect(value).toMatchInlineSnapshot(`
                    {
                      "border": "0px",
                      "keys": [],
                      "opacity": "0.5",
                      "paddingLeft": "5px",
                      "paddingRight": "4px",
                    }
                  `)
                  }
                  await page.setViewportSize({ width: 900, height: 400 })
                  expect(
                    await page
                      .locator('#card')
                      .evaluate(
                        (element) => getComputedStyle(element).paddingRight,
                      ),
                  ).toMatchInlineSnapshot(`"12px"`)
                  await page.setViewportSize({ width: 450, height: 400 })
                }
              } finally {
                await page.close()
              }
            }
          } finally {
            await Fs.rm(root, { force: true, recursive: true })
          }
        }
      } finally {
        await browser.close()
      }
    }, 180000)

    test('rejects invalid or conflicting packed output identities', () => {
      const compiled = Graph.compile({
        modules: Library.sources({ cssOutput: 'grouped', output: 'react' }),
      })
      const metadata = compiled.contracts['@acme/variants/index.ts']!
      const data = JSON.parse(metadata)
      const theme = Object.values(data.themes)[0] as { cssOutput: string }
      theme.cssOutput = 'automatic'
      expect(() =>
        Graph.compile({
          contracts: { 'library/index.js': JSON.stringify(data) },
          modules: {},
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: library/index.js:0: Invalid library contract: Invalid packed CSS output mode.]`,
      )

      const old = JSON.parse(metadata, (key, value) =>
        key === 'staticRecipe' ? undefined : value,
      )
      old.version = 16
      const legacy = Graph.compile({
        contracts: { 'library/index.js': JSON.stringify(old) },
        imports: { 'app.ts': { './library/index.js': 'library/index.js' } },
        modules: {
          'app.ts': `import {controls} from './library/index.js';export const props=controls.button();`,
        },
      })
      expect(legacy.modules['app.ts']!.css).toMatchInlineSnapshot(
        `".z_theme-13yvj2m4fsr2i-style-theme{--z-t13yvj2m4fsr2i-style-color_2e_brand:light-dark(#0066cc,#99ccff);}"`,
      )

      const conflicting = metadata.replaceAll(
        '"cssOutput":"grouped"',
        '"cssOutput":"atomic"',
      )
      expect(() =>
        Graph.compile({
          contracts: { 'first.js': metadata, 'second.js': conflicting },
          modules: {},
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: second.js:0: Invalid library contract: Conflicting packed CSS output modes for one theme identity.]`,
      )
    })
    test('upgrades missing legacy output modes through a source barrel', () => {
      const compiled = Graph.compile({
        modules: Library.sources({ cssOutput: 'atomic' }),
      })
      const data = JSON.parse(
        compiled.contracts['@acme/variants/index.ts']!,
        (key, value) =>
          key === 'cssOutput' || key === 'staticRecipe' ? undefined : value,
      )
      data.version = 16
      const contract = JSON.stringify(data)
      const barrel = Graph.compile({
        contracts: {
          'legacy.js': contract,
          'current.js': compiled.contracts['@acme/variants/index.ts']!,
        },
        imports: { 'barrel.ts': { './legacy.js': 'legacy.js' } },
        modules: { 'barrel.ts': `export {controls} from './legacy.js';` },
      })
      const consumer = Graph.compile({
        contracts: { 'barrel.js': barrel.contracts['barrel.ts']! },
        imports: { 'app.ts': { './barrel.js': 'barrel.js' } },
        modules: {
          'app.ts': `import {controls} from './barrel.js';export const props=controls.button();`,
        },
      })
      expect(consumer.modules['app.ts']!.code).toMatchInlineSnapshot(
        `"import {controls} from './barrel.js';export const props=controls.button();"`,
      )
      expect(consumer.modules['app.ts']!.css).toMatchInlineSnapshot(
        `".z_theme-13yvj2m4fsr2i-style-theme{--z-t13yvj2m4fsr2i-style-color_2e_brand:light-dark(#0066cc,#99ccff);}"`,
      )
    })

    test('shares published identities across consumers and retains nested child modes', () => {
      const first = Graph.compile({
        modules: {
          'first.ts':
            "import {Config} from 'zyzz'; const {style}=Config.create({cssOutput:'grouped'}); export const base=style({color:'red',padding:'8px'})",
        },
      })
      const packed = JSON.parse(first.contracts['first.ts']!)
      const grouped = packed.exports.base.style.style
      // Model a previously packed composition whose atomic parent owns a grouped child.
      packed.exports.base.style.style = {
        ...grouped,
        cssOutput: 'atomic',
        declarations: [],
        rules: [{ style: grouped }],
      }
      const second = Graph.compile({
        contracts: { 'first.js': JSON.stringify(packed) },
        imports: { 'second.ts': { './first.js': 'first.js' } },
        modules: { 'second.ts': "export {base} from './first.js'" },
      })
      const result = Graph.compile({
        contracts: { 'second.js': second.contracts['second.ts']! },
        imports: {
          'a.ts': { './second.js': 'second.js', zyzz: null },
          'b.ts': { './second.js': 'second.js', zyzz: null },
        },
        modules: {
          'a.ts':
            "import {cx,style} from 'zyzz'; import {base} from './second.js'; const local=style({opacity:0.5}); export const props=cx(base(),local())",
          'b.ts':
            "import {cx,style} from 'zyzz'; import {base} from './second.js'; const local=style({opacity:1}); export const props=cx(base(),local())",
        },
      })
      expect(result.modules['a.ts']!.css).toMatchInlineSnapshot(`
        ".z_theme-1mlrxl41f5va70-style{}
        .z-opacity-JtsrxR-0{opacity:0.5;}
        .z-style-hqKJ6I-0{color:red;padding:8px;}
        .z-opacity-qd65pw-1{opacity:0.5;}"
      `)
      expect(result.modules['b.ts']!.css).toMatchInlineSnapshot(`
        ".z_theme-1mlrxl41f5va70-style{}
        .z-opacity-1-jODrRV-0{opacity:1;}
        .z-style-6E-0SO-0{color:red;padding:8px;}
        .z-opacity-1-VDMo92-1{opacity:1;}"
      `)
    })

    test('restores legacy grouped configuration metadata before re-export', () => {
      const output = Graph.compile({
        modules: {
          'config.ts':
            "import {Config} from 'zyzz'; export const config=Config.create({cssOutput:'grouped'}); export const style=config.style; export const card=style({color:'red',padding:'8px'})",
        },
      })
      const packed = JSON.parse(output.contracts['config.ts']!, (key, value) =>
        key === 'staticRecipe' ? undefined : value,
      )
      packed.version = 16
      for (const theme of Object.values(packed.themes) as Record<
        string,
        unknown
      >[])
        delete theme.cssOutput
      const barrel = Graph.compile({
        contracts: { 'config.js': JSON.stringify(packed) },
        imports: { 'barrel.ts': { './config.js': 'config.js' } },
        modules: {
          'barrel.ts': "export {card,config,style} from './config.js'",
        },
      })
      const consumer = Graph.compile({
        contracts: { 'barrel.js': barrel.contracts['barrel.ts']! },
        imports: { 'app.ts': { './barrel.js': 'barrel.js' } },
        modules: {
          'app.ts':
            "import {style} from './barrel.js'; export const card=style({color:'blue',padding:'2px'})",
        },
      })
      expect(consumer.modules['app.ts']!.css).toMatchInlineSnapshot(`
        ".z_theme-u8smm21l81sow-config{}
        .g-style-1e8a67z1uaws1j-53{color:blue;padding:2px;}"
      `)
    })

    test('retains the graph default on packed root callables', () => {
      const result = Graph.compile({
        cssOutput: 'grouped',
        modules: {
          'lib.ts': `import {style} from 'zyzz';export const card=style({color:'red',padding:'8px'})`,
        },
      })
      const contract = JSON.parse(result.contracts['lib.ts']!)
      expect(contract.exports.card.style.style.cssOutput).toMatchInlineSnapshot(
        '"grouped"',
      )
      const consumer = Graph.compile({
        contracts: { 'lib.js': result.contracts['lib.ts']! },
        imports: { 'app.ts': { './lib.js': 'lib.js', zyzz: null } },
        modules: {
          'app.ts': `import {cx} from 'zyzz';import {card} from './lib.js';export const props=cx(card())`,
        },
      })
      expect(
        consumer.modules['app.ts']!.css.includes('color:red;padding:8px;'),
      ).toMatchInlineSnapshot('true')
    })
  })
})

describe('stylesheets', () => {
  describe('compile', () => {
    test('isolates packed reset layers while retaining graph-wide ordering', () => {
      const library = Graph.compile({
        modules: {
          'a.ts': `import 'zyzz/reset.css';import {layers} from 'zyzz/web';layers(['a']);`,
          'b.ts': `import 'zyzz/reset.css';import {layers} from 'zyzz/web';layers(['b']);`,
        },
      })

      expect(library.sharedCss).toMatchInlineSnapshot(`"@layer reset,a,b;"`)

      const app = Graph.compile({
        contracts: { 'lib/a.js': library.contracts['a.ts']! },
        imports: { 'app.ts': { lib: 'lib/a.js' } },
        modules: { 'app.ts': `import 'lib';` },
      })

      expect(app.sharedCss).toMatchInlineSnapshot(`"@layer reset,a;"`)

      const consumer = Graph.compile({
        contracts: { 'lib/a.js': library.contracts['a.ts']! },
        imports: {
          'app.ts': { lib: 'lib/a.js' },
          'extra.ts': { 'zyzz/web': null },
        },
        modules: {
          'app.ts': `import 'lib';`,
          'extra.ts': `import {layers} from 'zyzz/web';layers(['extra']);`,
        },
      })

      expect(consumer.sharedCss).toMatchInlineSnapshot(
        `"@layer reset,a,extra;"`,
      )
    })

    test('excludes unreachable library layers from reset ordering', () => {
      const library = Graph.compile({
        modules: {
          'unused.ts': `import {layers} from 'zyzz/web';layers(['unused']);`,
        },
      })

      const app = Graph.compile({
        contracts: { 'unused.js': library.contracts['unused.ts']! },
        modules: {
          'app.ts': `import 'zyzz/reset.css';export const loaded=true;`,
        },
      })

      expect(app.sharedCss).toMatchInlineSnapshot(`"@layer reset;"`)
    })

    test('invalidates repacked ownership when only contract resolutions change', () => {
      const dependency = Graph.compile({
        modules: {
          'index.ts': `import {global} from 'zyzz/web';global({body:{backgroundImage:'url(./pixel.svg)'}});`,
        },
      })

      const wrapper = Graph.compile({
        contracts: { 'dep/index.js': dependency.contracts['index.ts']! },
        imports: { 'wrapper/index.ts': { dep: 'dep/index.js' } },
        modules: {
          'wrapper/index.ts': `import 'dep';export const loaded=true;`,
        },
      })

      const contracts = {
        'wrapper/index.js': wrapper.contracts['wrapper/index.ts']!,
        'a/index.js': dependency.contracts['index.ts']!,
        'b/index.js': dependency.contracts['index.ts']!,
      }

      const modules = { 'app.ts': `import 'wrapper';` }
      const compiler = Graph.create()

      const first = compiler.compile({
        contracts,
        modules,
        imports: {
          'app.ts': { wrapper: 'wrapper/index.js' },
          'wrapper/index.js': { dep: 'a/index.js' },
        },
      })

      expect(Object.values(first.sharedAssets ?? {})).toMatchInlineSnapshot(`
      [
        "a/pixel.svg",
      ]
    `)

      const second = compiler.compile({
        contracts,
        modules,
        imports: {
          'app.ts': { wrapper: 'wrapper/index.js' },
          'wrapper/index.js': { dep: 'b/index.js' },
        },
      })

      expect(Object.values(second.sharedAssets ?? {})).toMatchInlineSnapshot(`
      [
        "b/pixel.svg",
      ]
    `)
      expect(Object.values(second.sharedAssetOwners ?? {}))
        .toMatchInlineSnapshot(`
      [
        "b/index.js",
      ]
    `)
    })
    test('retains reset ordering in every independent packed entry', () => {
      const library = Graph.compile({
        modules: {
          'a.ts': `import 'zyzz/reset.css';import {Config} from 'zyzz';const config=Config.create({layers:['components']});import {global} from 'zyzz/web';global({'@layer components':{body:{color:'red'}}});`,
          'b.ts': `import 'zyzz/reset.css';import {Config} from 'zyzz';const config=Config.create({layers:['components']});import {global} from 'zyzz/web';global({'@layer components':{body:{color:'blue'}}});`,
        },
      })

      const app = Graph.compile({
        contracts: { 'lib/b.js': library.contracts['b.ts']! },
        imports: { 'app.ts': { lib: 'lib/b.js' } },
        modules: { 'app.ts': `import 'lib';` },
      })

      expect(app.sharedCss).toMatchInlineSnapshot(`
      "@layer reset,components;
      @layer components{body{color:blue;}}"
    `)
    })
    test('rejects malformed optional packed source-map fields', () => {
      const library = Graph.compile({
        modules: {
          'index.ts': `import {global} from 'zyzz/web';global({body:{color:'red'}});`,
        },
      })

      for (const invalid of [
        { content: 1 },
        { content: null },
        { start: -1 },
        { start: 0.5 },
        { start: '0' },
      ]) {
        const contract = JSON.parse(library.contracts['index.ts']!)

        Object.assign(contract.stylesheets[0], invalid)

        expect(() =>
          Graph.compile({
            contracts: { 'lib/index.js': JSON.stringify(contract) },
            modules: { 'app.ts': 'export {}' },
          }),
        ).toThrowErrorMatchingInlineSnapshot(
          `[Source.ExtractError: lib/index.js:0: Invalid library contract: Invalid packed stylesheet section.]`,
        )
      }
    })

    test('rejects conflicting packed animations and orders optional reset first', () => {
      const first = Graph.compile({
        modules: {
          'index.ts': `import {keyframes} from 'zyzz/web';export const fade=keyframes({from:{opacity:0},to:{opacity:1}});`,
        },
      })

      const second = Graph.compile({
        modules: {
          'index.ts': `import {keyframes} from 'zyzz/web';export const fade=keyframes({from:{opacity:1},to:{opacity:0}});`,
        },
      })

      expect(() =>
        Graph.compile({
          contracts: {
            'a/index.js': first.contracts['index.ts']!,
            'b/index.js': second.contracts['index.ts']!,
          },
          imports: { 'app.ts': { a: 'a/index.js', b: 'b/index.js' } },
          modules: { 'app.ts': `import 'a';import 'b';` },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: b/index.js:0: Conflicting animation identity: z-k1wfnqsmu0q6os-66-61-64-65; compile libraries with package-qualified module IDs.]`,
      )

      const source = `import 'zyzz/reset.css';import {Config} from 'zyzz';const config=Config.create({layers:['base','components']});import {global} from 'zyzz/web';global({'@layer components':{button:{fontSize:'24px'},img:{maxWidth:'none'}}});`

      expect(Graph.compile({ modules: { 'app.ts': source } }).sharedCss)
        .toMatchInlineSnapshot(`
      "@layer reset,base,components;
      @layer components{button{font-size:24px;}img{max-width:none;}}"
    `)
    })
    test('keeps optional reset below component layers in Chromium', async () => {
      const source = `import 'zyzz/reset.css';import {Config} from 'zyzz';const config=Config.create({layers:['base','components']});import {global} from 'zyzz/web';global({'@layer components':{button:{fontSize:'24px'},img:{maxWidth:'none'}}});`
      const result = Graph.compile({ modules: { 'app.ts': source } })
      const reset = await Fs.readFile(Path.resolve('src/reset.css'), 'utf8')
      const browser = await chromium.launch({ headless: true })

      try {
        const page = await browser.newPage()

        await page.setContent(
          `<style>${result.sharedCss}\n${reset}</style><button>Button</button><img><h1>Heading</h1><ul><li>Item</li></ul>`,
        )

        expect(
          await page
            .locator('button')
            .evaluate((node) => getComputedStyle(node).fontSize),
        ).toMatchInlineSnapshot('"24px"')
        expect(
          await page
            .locator('img')
            .evaluate((node) => getComputedStyle(node).maxWidth),
        ).toMatchInlineSnapshot('"none"')

        expect(
          await page
            .locator('h1')
            .evaluate((node) => [
              getComputedStyle(node).fontSize,
              getComputedStyle(node).fontWeight,
              getComputedStyle(node).marginTop,
            ]),
        ).toMatchInlineSnapshot(`
          [
            "16px",
            "400",
            "0px",
          ]
        `)
        expect(
          await page
            .locator('ul')
            .evaluate((node) => getComputedStyle(node).listStyleType),
        ).toMatchInlineSnapshot('"none"')
      } finally {
        await browser.close()
      }
    })

    test('links default-exported keyframes from packed libraries', () => {
      const library = Graph.compile({
        modules: {
          'effects.ts': `import {keyframes} from 'zyzz/web';const fade=keyframes({from:{opacity:0},to:{opacity:1}});export default (fade satisfies string);`,
        },
      })

      const app = Graph.compile({
        contracts: { 'lib/index.js': library.contracts['effects.ts']! },
        imports: { 'app.ts': { lib: 'lib/index.js', zyzz: null } },
        modules: {
          'app.ts': `import fade from 'lib';import {style} from 'zyzz';export namespace styles {
  export const card = style({animationName:fade})
}`,
        },
      })

      expect(app.modules['app.ts']!.css).toMatchInlineSnapshot(
        `".z-animation-name-F7QXU7{animation-name:z-k185tc9w526bf2-66-61-64-65;}"`,
      )
      expect(app.sharedCss).toMatchInlineSnapshot(
        `"@keyframes z-k185tc9w526bf2-66-61-64-65{from{opacity:0;}to{opacity:1;}}"`,
      )
    })

    test('preserves suffix URLs and rejects relative assets without a graph host', () => {
      const source = `import {global} from 'zyzz/web';global({body:{backgroundImage:'url("?v=1")'},html:{backgroundImage:'url("")'}});`
      const result = Graph.compile({ modules: { 'app.ts': source } })

      expect(result.sharedAssets).toMatchInlineSnapshot(`{}`)
      expect(result.sharedCss).toMatchInlineSnapshot(`
      "body{background-image:url("?v=1");}
      html{background-image:url("");}"
    `)
      expect(Transform.compile({ moduleId: 'app.ts', source }).css)
        .toMatchInlineSnapshot(`
      "body{background-image:url("?v=1");}
      html{background-image:url("");}"
    `)
      expect(() =>
        Transform.compile({
          moduleId: 'app.ts',
          source: `import {global} from 'zyzz/web';global({body:{backgroundImage:'url("./image.svg")'}});`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: app.ts:32: Relative contribution assets require Graph.compile and a relocation host.]`,
      )
    })

    test('rejects conflicting source maps and attributes layer failures to packed owners', () => {
      const library = Graph.compile({
        modules: {
          'effects.ts': `import {global,layers} from 'zyzz/web';layers(['a','b']);global({body:{color:'red'}});`,
        },
      })

      const first = JSON.parse(library.contracts['effects.ts']!)
      const second = JSON.parse(library.contracts['effects.ts']!)

      second.stylesheets[0].content += '\n'

      expect(() =>
        Graph.compile({
          contracts: {
            'pkg/first.js': JSON.stringify(first),
            'pkg/second.js': JSON.stringify(second),
          },
          imports: { 'app.ts': { a: 'pkg/first.js', b: 'pkg/second.js' } },
          modules: { 'app.ts': `import 'a';import 'b';` },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: pkg/second.js:0: Conflicting packed stylesheet contributions.]`,
      )

      const errors = [['bad name'], ['a', 'a'], ['b', 'a']].map((layers) => {
        const contract = JSON.parse(library.contracts['effects.ts']!)

        contract.stylesheets.push({
          source: 'effects.ts',
          key: 'extra',
          css: '',
          layers: [layers],
        })

        try {
          Graph.compile({
            contracts: { 'pkg/index.js': JSON.stringify(contract) },
            modules: { 'app.ts': `export {}` },
          })

          return 'accepted'
        } catch (error) {
          return error
        }
      })

      expect(errors).toMatchInlineSnapshot(`
      [
        [Source.ExtractError: pkg/index.js:0: Invalid library contract: Invalid layer name.],
        [Source.ExtractError: pkg/index.js:0: Invalid library contract: Duplicate layer name.],
        [Source.ExtractError: pkg/index.js:0: Invalid library contract: Conflicting layer order constraints.],
      ]
    `)
    })
    test('packs source content once and links TypeScript animation aliases', () => {
      const source = `import {global,keyframes} from 'zyzz/web';global({body:{color:'red'}});const fade=keyframes({from:{opacity:0},to:{opacity:1}});export const enter=fade satisfies string;`
      const library = Graph.compile({ modules: { 'index.ts': source } })
      const sections = JSON.parse(library.contracts['index.ts']!).stylesheets

      expect(
        sections.filter(
          (section: { content?: string }) => section.content !== undefined,
        ).length,
      ).toMatchInlineSnapshot('1')

      const app = Graph.compile({
        contracts: { 'lib.js': library.contracts['index.ts']! },
        imports: { 'app.ts': { lib: 'lib.js', zyzz: null } },
        modules: {
          'app.ts': `import {enter} from 'lib';import {style} from 'zyzz';export namespace styles {
  export const card = style({animationName:enter})
}`,
        },
      })

      expect(app.modules['app.ts']!.css).toMatchInlineSnapshot(
        `".z-animation-name-wV2udT{animation-name:z-k1wfnqsmu0q6os-66-61-64-65;}"`,
      )
      expect(new Trace.TraceMap(app.sharedCssMap!).sourcesContent)
        .toMatchInlineSnapshot(`
      [
        "import {global,keyframes} from 'zyzz/web';global({body:{color:'red'}});const fade=keyframes({from:{opacity:0},to:{opacity:1}});export const enter=fade satisfies string;",
      ]
    `)
    })

    const source = `import {fontFace,global,keyframes,layers} from 'zyzz/web';layers(['reset','components']);fontFace({fontFamily:'App',src:'url(./assets/app.woff2)'});global({body:{backgroundImage:'url(./assets/pixel.png)'}});export const fade=keyframes({from:{opacity:0},to:{opacity:1}});`

    test('links relocated animation aliases and preserves packed side effects once', () => {
      const library = Graph.compile({
        modules: {
          'pkg/effects.ts': source + 'export const enter=fade;',
          'pkg/index.ts': `export {enter as fade} from './effects.js';`,
        },
      })

      const output = Graph.compile({
        contracts: {
          'app/node_modules/lib/index.js': library.contracts['pkg/index.ts']!,
        },
        imports: {
          'app/main.ts': { lib: 'app/node_modules/lib/index.js', zyzz: null },
        },
        modules: {
          'app/main.ts': `import {fade as enter} from 'lib';import {style} from 'zyzz';const alias=enter;export namespace styles {
  export const card = style({animationName:alias})
}`,
        },
      })

      expect(
        output.modules['app/main.ts']!.css.includes('animation-name:z-k'),
      ).toMatchInlineSnapshot('true')
      expect(
        output.sharedCss?.match(/@keyframes/g)?.length,
      ).toMatchInlineSnapshot('1')
      expect(output.sharedAssets).toMatchInlineSnapshot(`
      {
        "zyzz-asset:app%2Fnode_modules%2Flib%2Fassets%2Fapp.woff2": "app/node_modules/lib/assets/app.woff2",
        "zyzz-asset:app%2Fnode_modules%2Flib%2Fassets%2Fpixel.png": "app/node_modules/lib/assets/pixel.png",
      }
    `)
      expect(
        output.sharedCss?.includes('@layer reset,components;'),
      ).toMatchInlineSnapshot('true')

      const map = new Trace.TraceMap(output.sharedCssMap!)

      expect(
        Trace.originalPositionFor(map, { line: 2, column: 0 }).source,
      ).toMatchInlineSnapshot('"app/node_modules/lib/effects.ts"')
      expect(
        map.sourcesContent?.some(
          (content) => content === source + 'export const enter=fade;',
        ),
      ).toMatchInlineSnapshot('true')
    })
    test('preserves path-like URL suffixes and rejects nested output collisions', async () => {
      const graph = Graph.compile({
        modules: {
          'pkg/a.ts': `import {global} from 'zyzz/web';global({body:{backgroundImage:'url(./asset.svg?fallback=/../other.svg)'}});`,
        },
      })

      expect(Object.values(graph.sharedAssets ?? {})).toMatchInlineSnapshot(`
      [
        "pkg/asset.svg?fallback=/../other.svg",
      ]
    `)

      const root = await Fs.mkdtemp(Path.resolve('.fixture-asset-collision-'))

      try {
        await Fs.mkdir(Path.join(root, 'effects.ts.css'))
        await Fs.writeFile(Path.join(root, 'effects.ts.css/pixel.png'), 'pixel')
        await Fs.writeFile(
          Path.join(root, 'effects.ts'),
          `import {global} from 'zyzz/web';global({body:{backgroundImage:'url(./effects.ts.css/pixel.png)'}})`,
        )

        const host = await Host.create({
          root,
          outDir: Path.join(root, 'out'),
          packageId: 'pkg',
        })

        await expect(host.build()).rejects.toThrow(
          'Asset path conflicts with generated output.',
        )
        await Fs.mkdir(Path.join(root, 'assets'))
        await Fs.writeFile(Path.join(root, 'assets/icon:dark.svg'), 'icon')
        await Fs.writeFile(
          Path.join(root, 'effects.ts'),
          `import {global} from 'zyzz/web';global({body:{backgroundImage:'url(./assets/icon:dark.svg)'}})`,
        )
        await expect(host.build()).rejects.toThrowErrorMatchingInlineSnapshot(
          `[Error: Asset path escapes the package root.]`,
        )
        await host.close()
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    })
    test('maps separate contribution calls to their own authored positions', () => {
      const source = `import {global} from 'zyzz/web';
global({body:{color:'red'}});

global({html:{color:'blue'}});`
      const library = Graph.compile({ modules: { 'effects.ts': source } })

      const output = Graph.compile({
        modules: { 'app.ts': `import 'lib'` },
        imports: { 'app.ts': { lib: 'lib/index.js' } },
        contracts: { 'lib/index.js': library.contracts['effects.ts']! },
      })

      const map = new Trace.TraceMap(output.sharedCssMap!)
      const line =
        output
          .sharedCss!.split('\n')
          .findIndex((line) => line.includes('html')) + 1

      expect(
        Trace.originalPositionFor(map, { line, column: 0 }).line,
      ).toMatchInlineSnapshot('4')
    })
    test('does not capture nested shadows of imported animations', () => {
      const output = Graph.compile({
        modules: {
          'effects.ts': source,
          'app.ts': `import {fade} from './effects.js';function other(fade:unknown){let alias=fade;return alias}export {fade}`,
        },
      })

      expect(output.sharedCss?.includes('@keyframes')).toMatchInlineSnapshot(
        'true',
      )
    })
    test('attributes malformed packed CSS and rejects conflicting layer metadata', () => {
      const library = Graph.compile({ modules: { 'effects.ts': source } })
      const contract = JSON.parse(library.contracts['effects.ts']!)

      contract.stylesheets[1].css = '@import ;'

      expect(() =>
        Graph.compile({
          modules: { 'app.ts': `import 'lib'` },
          imports: { 'app.ts': { lib: 'lib/index.js' } },
          contracts: { 'lib/index.js': JSON.stringify(contract) },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: lib/index.js:0: Invalid library contract: Unexpected end of input]`,
      )

      const first = JSON.parse(library.contracts['effects.ts']!)
      const second = JSON.parse(library.contracts['effects.ts']!)

      second.stylesheets[0].layers = [['different']]

      expect(() =>
        Graph.compile({
          modules: { 'app.ts': `import 'a';import 'b'` },
          imports: { 'app.ts': { a: 'lib/a.js', b: 'lib/b.js' } },
          contracts: {
            'lib/a.js': JSON.stringify(first),
            'lib/b.js': JSON.stringify(second),
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        '[Source.ExtractError: lib/b.js:0: Conflicting packed stylesheet contributions.]',
      )
    })
    test('normalizes encoded asset traversal and rejects generated or control-file collisions', async () => {
      const root = await Fs.mkdtemp(Path.resolve('.fixture-assets-paths-'))

      try {
        await Fs.mkdir(Path.join(root, 'sub'))
        await Fs.writeFile(
          Path.join(root, 'asset.png'),
          new Uint8Array([1, 2, 3]),
        )
        await Fs.writeFile(
          Path.join(root, 'sub/effects.ts'),
          `import {global} from 'zyzz/web';global({body:{backgroundImage:'url(%2e%2e/asset.png)'}})`,
        )

        await using host = await Host.create({
          root,
          outDir: Path.join(root, 'out'),
          packageId: 'pkg',
        })

        await host.build()

        expect((await host.build()).changed).toMatchInlineSnapshot('[]')

        for (const name of [
          'zyzz.css',
          'zyzz.shared.css',
          '.ZYZZ.JSON',
          'sub/effects.ts.css',
        ]) {
          await Fs.writeFile(Path.join(root, name), 'asset')
          await Fs.writeFile(
            Path.join(root, 'sub/effects.ts'),
            `import {global} from 'zyzz/web';global({body:{backgroundImage:'url(../${name})'}})`,
          )
          await expect(host.build()).rejects.toThrow(/conflicts/)
        }
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    })
    test('retains animations exported through a specifier list', () => {
      const output = Graph.compile({
        modules: {
          'effects.ts': `import {keyframes} from 'zyzz/web';const fade=keyframes({from:{opacity:0},to:{opacity:1}});export {fade}`,
        },
      })

      expect(output.sharedCss?.includes('@keyframes')).toMatchInlineSnapshot(
        'true',
      )
    })
    test('does not retain animation names exported only as types', () => {
      const output = Graph.compile({
        modules: {
          'effects.ts': `import {keyframes} from 'zyzz/web';const fade=keyframes({from:{opacity:0},to:{opacity:1}});type fade=typeof fade;export type {fade}`,
        },
      })

      expect(output.sharedCss).toMatchInlineSnapshot('undefined')
    })
    test('serves relocated assets and layers with the optional reset in Chromium', async () => {
      const root = await Fs.mkdtemp(Path.resolve('.fixture-assets-browser-'))

      const server = Http.createServer(async (request, response) => {
        try {
          if (request.url === '/') {
            response.setHeader('Content-Type', 'text/html')
            response.end(
              '<link rel="stylesheet" href="/reset.css"><link rel="stylesheet" href="/zyzz.shared.css"><body>Styled page</body>',
            )

            return
          }

          const file = Path.join(root, 'out', request.url!.slice(1))

          response.setHeader(
            'Content-Type',
            file.endsWith('.svg') ? 'image/svg+xml' : 'text/css',
          )
          response.end(await Fs.readFile(file))
        } catch {
          response.statusCode = 404
          response.end()
        }
      })

      let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined

      try {
        await Fs.mkdir(Path.join(root, 'assets'))
        await Fs.writeFile(
          Path.join(root, 'assets/pixel.svg'),
          '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>',
        )
        await Fs.writeFile(
          Path.join(root, 'effects.ts'),
          `import {global} from 'zyzz/web';global({body:{margin:'13px',backgroundImage:'url(./assets/pixel.svg)'}});`,
        )

        await using host = await Host.create({
          root,
          outDir: Path.join(root, 'out'),
          packageId: 'pkg',
        })

        await host.build()
        await Fs.copyFile(
          Path.resolve('src/reset.css'),
          Path.join(root, 'out/reset.css'),
        )
        await new Promise<void>((resolve) =>
          server.listen(0, '127.0.0.1', resolve),
        )
        browser = await chromium.launch()

        const page = await browser.newPage()
        const loaded: string[] = []

        page.on('response', (response) => {
          if (response.url().endsWith('pixel.svg') && response.status() === 200)
            loaded.push('asset')
        })
        await page.goto(
          `http://127.0.0.1:${(server.address() as { port: number }).port}/`,
        )

        expect(
          await page
            .locator('body')
            .evaluate((el) => getComputedStyle(el).marginTop),
        ).toMatchInlineSnapshot('"13px"')
        expect(loaded).toMatchInlineSnapshot(`
          [
            "asset",
          ]
        `)

        await page.evaluate(
          `document.head.append(document.querySelector('link[href="/reset.css"]'))`,
        )

        expect(
          await page
            .locator('body')
            .evaluate((el) => getComputedStyle(el).marginTop),
        ).toMatchInlineSnapshot('"13px"')
      } finally {
        await browser?.close()

        if (server.listening)
          await new Promise<void>((resolve) => server.close(() => resolve()))

        await Fs.rm(root, { recursive: true, force: true })
      }
    })
    test('publishes binary relative assets with source maps and updates them atomically', async () => {
      const root = await Fs.mkdtemp(Path.resolve('.fixture-assets-'))

      try {
        await Fs.mkdir(Path.join(root, 'assets'))
        await Fs.writeFile(Path.join(root, 'effects.ts'), source)
        await Fs.writeFile(
          Path.join(root, 'assets/app.woff2'),
          new Uint8Array([0, 255, 1, 128]),
        )
        await Fs.writeFile(
          Path.join(root, 'assets/pixel.png'),
          new Uint8Array([137, 80, 78, 71, 0, 255]),
        )

        await using host = await Host.create({
          root,
          outDir: Path.join(root, 'out'),
          packageId: 'pkg',
        })

        await host.build()

        expect([
          ...(await Fs.readFile(Path.join(root, 'out/assets/app.woff2'))),
        ]).toMatchInlineSnapshot(`
        [
          0,
          255,
          1,
          128,
        ]
      `)
        expect(
          (
            await Fs.readFile(Path.join(root, 'out/zyzz.shared.css'), 'utf8')
          ).includes('zyzz-asset:'),
        ).toMatchInlineSnapshot('false')
        expect(
          JSON.parse(
            await Fs.readFile(
              Path.join(root, 'out/zyzz.shared.css.map'),
              'utf8',
            ),
          ).sourcesContent.includes(source),
        ).toMatchInlineSnapshot('true')
        expect((await host.build()).changed).toMatchInlineSnapshot('[]')

        await Fs.writeFile(
          Path.join(root, 'assets/app.woff2'),
          new Uint8Array([5, 255, 2]),
        )

        expect((await host.build()).changed).toMatchInlineSnapshot(`
        [
          "assets/app.woff2",
        ]
      `)
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    })
  })
})

describe('variables', () => {
  describe('compile', () => {
    test('resolves computed literal static keys with authored override order', () => {
      const result = Graph.compile({
        modules: {
          'app.ts': `import {style} from 'zyzz';const first={width:'5px',['width']:'10px'};const second={['width']:'20px',width:'30px'};const third={['width']:'40px'};export namespace styles {
  export const a = style({width:first.width})

  export const b = style({width:second.width})

  export const c = style({width:third.width})
}`,
        },
      })

      expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(`
        ".z-w-10px-_Z2Zm9-0{width:10px;}
        .z-w-30px-HfgmE9-0{width:30px;}
        .z-w-40px-2Xrlpp-0{width:40px;}"
      `)
    })

    test('rejects indexed folding across array spreads', () => {
      expect(() =>
        Graph.compile({
          modules: {
            'app.ts': `import {style} from 'zyzz';const prefix=['5px','6px'];const sizes=['10px',...prefix,'20px'];export namespace styles {
  export const card = style({width:sizes[2]})
}`,
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: app.ts:153: Static array indexes cannot cross spread elements.]`,
      )
    })

    test('rejects source/packed slot collisions and unresolved computed overrides', () => {
      const library = Graph.compile({
        modules: {
          'vars.ts': `import {variable} from 'zyzz';export const vars=({gap:variable('length')});`,
        },
      })

      expect(() =>
        Graph.compile({
          contracts: { 'lib/vars.js': library.contracts['vars.ts']! },
          modules: {
            'vars.ts': `import {variable} from 'zyzz';export const vars=({gap:variable('length')});`,
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: vars.ts:54: Conflicting variable identity: --z-v4t4nbe1og4cic-54; compile libraries with package-qualified module IDs.]`,
      )
      expect(() =>
        Graph.compile({
          modules: {
            'app.ts': `import {style} from 'zyzz';const base={width:'10px',[key]:'20px'};export namespace styles {
  export const card = style({width:base.width})
}`,
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: app.ts:127: Static member reads cannot cross unresolved computed keys.]`,
      )
    })

    test('normalizes wrapped compound static values and rejects loop mutation', () => {
      const source =
        "import {style} from 'zyzz';const size=10;export namespace styles {\n  export const card = style({width:(`${size}px` as const)})\n}"

      expect(
        Graph.compile({ modules: { 'app.ts': source } }).modules['app.ts']!.css,
      ).toMatchInlineSnapshot(`".z-w-10px-Jgxd-Q{width:10px;}"`)

      const errors = [
        "for(base.width of ['20px']){}",
        'for(base.width in {changed:true}){}',
      ].map((loop) => {
        try {
          Graph.compile({
            modules: {
              'app.ts': `import {style} from 'zyzz';const base={width:'10px'};${loop}export namespace styles {export const card=style(base);}`,
            },
          })

          return 'accepted'
        } catch (error) {
          return (error as import('zyzz/compiler').Source.ExtractError)
            .diagnostics
        }
      })

      expect(errors).toMatchInlineSnapshot(`
        [
          [
            {
              "code": "unsupported_syntax",
              "end": 82,
              "message": "Static data cannot be mutated or escape through unsupported expressions.",
              "source": "app.ts",
              "start": 53,
            },
          ],
          [
            {
              "code": "unsupported_syntax",
              "end": 88,
              "message": "Static data cannot be mutated or escape through unsupported expressions.",
              "source": "app.ts",
              "start": 53,
            },
          ],
        ]
      `)
    })

    test('attributes invalid registration CSS to its descriptor', () => {
      try {
        Graph.compile({
          modules: {
            'app.ts': `import {variable} from 'zyzz';
export const vars=({gap:variable('signedLength', {inherits:false,initialValue:'}'})});`,
          },
        })
        throw new Error('Expected invalid registration')
      } catch (error) {
        expect(
          (error as import('zyzz/compiler').Source.ExtractError).diagnostics,
        ).toMatchInlineSnapshot(`
          [
            {
              "code": "unsupported_syntax",
              "end": 114,
              "message": "Registered initial values must match the declared syntax.",
              "source": "app.ts",
              "start": 55,
            },
          ]
        `)
      }
    })
    test('compiles overlapping dynamic fields and default exported static records', () => {
      const result = Graph.compile({
        modules: {
          'app.ts': `import {style} from 'zyzz';const base={color:'red'};export default base;type Values={width:string;zIndex:number}&{width:'10px';zIndex:1|2};export namespace styles {
  export const card = style(base)

  export const dynamic = style((v:Values)=>({width:v.width,zIndex:v.zIndex}))
}`,
        },
      })

      expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(`
        ".z-text-red-Jgxd-Q{color:red;}
        .z-w-x2ilKd{width:var(--z-d1e8a67z1uaws1j-225-77-69-64-74-68);}
        .z-z-index-ROqnX4{z-index:var(--z-d1e8a67z1uaws1j-225-7a-49-6e-64-65-78);}"
      `)
    })

    test('shares defining variable identities across package entrypoint sidecars', () => {
      const library = Graph.compile({
        modules: {
          'vars.ts': `import {variable} from 'zyzz';export const vars=({gap:variable('length')});`,
          'index.ts': `export {vars} from './vars.js';`,
        },
      })

      const app = Graph.compile({
        contracts: {
          'pkg/vars.js': library.contracts['vars.ts']!,
          'pkg/index.js': library.contracts['index.ts']!,
        },
        imports: {
          'app.ts': { a: 'pkg/vars.js', b: 'pkg/index.js', zyzz: null },
        },
        modules: {
          'app.ts': `import {vars as a} from 'a';import {vars as b} from 'b';import {style} from 'zyzz';export namespace styles {
  export const card = style({width:a.gap,padding:b.gap})
}`,
        },
      })

      expect(app.modules['app.ts']!.css).toMatchInlineSnapshot(
        `
      ".z-w-_Z4cQB{width:var(--z-v4t4nbe1og4cic-54);}
      .z-p-46CIxU{padding:var(--z-v4t4nbe1og4cic-54);}"
    `,
      )
    })
    test('allows scalar copies and asserted static token bindings', () => {
      const result = Graph.compile({
        modules: {
          'app.ts': `import {Config} from 'zyzz';const {theme,style}=Config.create({theme:{color:{ink:'#123'}}});const dimensions={width:'10px',nested:{width:'20px'}};const width=dimensions.width;consume(width);consume(dimensions.width);const color=(theme.tokens.color.ink as string);export namespace styles {
  export const card = style({width:dimensions.width,color})
}`,
        },
      })

      expect(result.modules['app.ts']!.css).toMatchInlineSnapshot(`
        ".z_theme-1e8a67z1uaws1j-theme-theme{--z-t1e8a67z1uaws1j-theme-color_2e_ink:#123;}
        .z-w-10px-Jgxd-Q{width:10px;}
        .z-text-5nOHLL{color:var(--z-t1e8a67z1uaws1j-theme-color_2e_ink,#123);}"
      `)
    })
    test('links default variable exports through packed contracts', () => {
      const library = Graph.compile({
        modules: {
          'vars.ts': `import {variable} from 'zyzz';const vars=({gap:variable('length')});export default vars;`,
        },
      })

      const app = Graph.compile({
        contracts: { 'lib.js': library.contracts['vars.ts']! },
        imports: { 'app.ts': { lib: 'lib.js', zyzz: null } },
        modules: {
          'app.ts': `import vars from 'lib';import {style} from 'zyzz';export namespace styles {
  export const card = style({width:vars.gap})
}`,
        },
      })

      expect(app.modules['app.ts']!.css).toMatchInlineSnapshot(
        `".z-w-QiD0VB{width:var(--z-v4t4nbe1og4cic-47);}"`,
      )
    })
    test('rejects static records returned to runtime code', () => {
      expect(() =>
        Graph.compile({
          modules: {
            'app.ts': `import {style} from 'zyzz';const base={width:'10px'};function get(){return base};get().width='20px';style(base);`,
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: app.ts:53: Static data cannot be mutated or escape through unsupported expressions.]`,
      )
    })

    const librarySource = `import {variable} from 'zyzz';export const vars=({amount:variable('percentage', {inherits:false,initialValue:'25%'}),gap:variable('length', {inherits:true,initialValue:'4px'})});`

    function compile() {
      const library = Graph.compile({
        modules: {
          'vars.ts': librarySource,
          'index.ts': `export {vars as layout} from './vars.js';`,
        },
      })

      const app = Graph.compile({
        contracts: { 'lib/index.js': library.contracts['index.ts']! },
        imports: { 'app.ts': { lib: 'lib/index.js', zyzz: null } },
        modules: {
          'app.ts': `import {style} from 'zyzz';import {layout} from 'lib';export {layout};const base={height:'20px',padding:layout.gap} as const;type Width='10px'|'30px';interface Values {width:Width}export namespace styles {
  export const registered = style({...base,width:layout.amount})

  export const dynamic = style((values:Values)=>({...base,width:values.width}))
}`,
        },
      })

      return { library, app }
    }

    async function bundle() {
      const { library, app } = compile()
      const root = await Fs.mkdtemp(Path.resolve('.fixture-variable-package-'))

      try {
        const packageRoot = Path.join(root, 'node_modules/lib')

        await Fs.mkdir(packageRoot, { recursive: true })
        await Fs.writeFile(
          Path.join(packageRoot, 'package.json'),
          JSON.stringify({
            name: 'lib',
            type: 'module',
            exports: './index.js',
          }),
        )

        for (const [id, module] of Object.entries(library.modules)) {
          const filename = id.replace(/\.ts$/, '.js')

          await Fs.writeFile(
            Path.join(packageRoot, filename),
            (await Esbuild.transform(module.code, { loader: 'ts' })).code,
          )

          if (library.contracts[id])
            await Fs.writeFile(
              Path.join(packageRoot, filename + '.zyzz.json'),
              library.contracts[id]!,
            )
        }

        await Fs.writeFile(
          Path.join(root, 'app.ts'),
          app.modules['app.ts']!.code,
        )

        const bundle = await Esbuild.build({
          entryPoints: [Path.join(root, 'app.ts')],
          bundle: true,
          write: false,
          format: 'iife',
          globalName: 'Fixture',
          alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
        })

        return {
          css: (app.sharedCss ?? '') + app.modules['app.ts']!.css,
          code: bundle.outputFiles[0]!.text,
        }
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    }

    test('rejects variable identity collisions across independent libraries', () => {
      const a = Graph.compile({ modules: { 'vars.ts': librarySource } })
      const b = Graph.compile({
        modules: { 'vars.ts': librarySource.replace('25%', '50%') },
      })

      expect(() =>
        Graph.compile({
          contracts: {
            'a.js': a.contracts['vars.ts']!,
            'b.js': b.contracts['vars.ts']!,
          },
          modules: { 'app.ts': 'export {}' },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: b.js:0: Invalid library contract: Conflicting packed variable identity: --z-v4t4nbe1og4cic-57; compile libraries with package-qualified module IDs.]`,
      )
    })
    test('renders statically expanded theme records in a browser', async () => {
      const result = Graph.compile({
        modules: {
          'app.ts': `import {Theme} from 'zyzz';const theme=Theme.define({color:{primary:'#123'}});const base={color:theme.tokens.color.primary,backgroundColor:theme.vars.color.primary};export const style=theme.style(base);export const scope=theme.className;`,
        },
      })

      const bundle = await Esbuild.build({
        stdin: {
          contents: result.modules['app.ts']!.code,
          loader: 'ts',
          resolveDir: process.cwd(),
        },
        bundle: true,
        write: false,
        format: 'iife',
        globalName: 'Fixture',
        alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
      })

      const browser = await chromium.launch()

      try {
        const page = await browser.newPage()

        await page.setContent(
          `<style>${result.modules['app.ts']!.css}</style><main><div id="card"></div></main>`,
        )
        await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
        await page.evaluate(
          `document.querySelector('main').className=Fixture.scope;document.getElementById('card').className=Fixture.style().className`,
        )

        expect(
          await page
            .locator('#card')
            .evaluate((el) => [
              getComputedStyle(el).color,
              getComputedStyle(el).backgroundColor,
            ]),
        ).toMatchInlineSnapshot(`
      [
        "rgb(17, 34, 51)",
        "rgb(17, 34, 51)",
      ]
    `)
      } finally {
        await browser.close()
      }
    })
    test('expands immutable theme references and rejects hidden mutations and duplicate packed slots', async () => {
      const result = Graph.compile({
        modules: {
          'app.ts': `import {Theme} from 'zyzz';const theme=Theme.define({color:{primary:'#123'}});const base={color:theme.tokens.color.primary,backgroundColor:theme.vars.color.primary};export const style=theme.style(base);`,
        },
      })

      expect(
        result.modules['app.ts']!.css.includes('#123'),
      ).toMatchInlineSnapshot('true')

      const bundle = await Esbuild.build({
        stdin: {
          contents: result.modules['app.ts']!.code,
          loader: 'ts',
          resolveDir: process.cwd(),
        },
        bundle: true,
        write: false,
        format: 'iife',
        globalName: 'Fixture',
        alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
      })

      expect(
        Vm.runInNewContext(
          `${bundle.outputFiles![0]!.text};typeof Fixture.style().className`,
        ),
      ).toMatchInlineSnapshot('"string"')
      expect(() =>
        Graph.compile({
          modules: {
            'app.ts': `import {style} from 'zyzz';const base={width:'10px'};const [alias]=[base];alias.width='20px';export const card=style(base);`,
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: app.ts:59: Static data cannot be mutated or escape to runtime calls.]`,
      )

      const library = Graph.compile({ modules: { 'vars.ts': librarySource } })
      const data = JSON.parse(library.contracts['vars.ts']!)

      data.exports.vars.members.gap.variables.value.name =
        data.exports.vars.members.amount.variables.value.name

      expect(() =>
        Graph.compile({
          contracts: { 'lib.js': JSON.stringify(data) },
          imports: { 'app.ts': { lib: 'lib.js', zyzz: null } },
          modules: {
            'app.ts': `import {style} from 'zyzz';import {vars} from 'lib';export const card=style({width:vars.gap});`,
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: lib.js:0: Invalid library contract: Conflicting packed variable identity: --z-v4t4nbe1og4cic-57; compile libraries with package-qualified module IDs.]`,
      )
    })
    test('merges finite interface declarations and rejects unsafe static records', () => {
      const graph = Graph.compile({
        modules: {
          'app.ts': `import {style} from 'zyzz';interface Values {width:'10px'|'20px'} interface Values {opacity:0|1} export const card=style((values:Values)=>({width:values.width,opacity:values.opacity}));`,
        },
      })

      expect(
        graph.modules['app.ts']!.css.includes('opacity:var('),
      ).toMatchInlineSnapshot('true')

      const errors = [
        `const base={width:'10px'};let alias=base;alias.width='20px';style(base)`,
        `const base={__proto__:'red'};style({color:base.__proto__})`,
        `const vars=({__proto__:variable('length')});style({width:vars.__proto__})`,
        `const base={width:'10px'};const alias=flag?base:{};alias.width='20px';style(base)`,
        `const base={width:'10px'};const holder={safe:base,unsafe:flag?base:{}};holder.unsafe.width='20px';style(base)`,
      ].map((source) => {
        try {
          Graph.compile({
            modules: {
              'app.ts': `import {style,variable} from 'zyzz';${source}`,
            },
          })

          return 'accepted'
        } catch (error) {
          return error
        }
      })

      expect(errors).toMatchInlineSnapshot(`
        [
          [Source.ExtractError: app.ts:66: Static data cannot be mutated or escape to runtime calls.],
          [Source.ExtractError: app.ts:48: Static object prototypes are unsupported.],
          "accepted",
          [Source.ExtractError: app.ts:74: Static data cannot be mutated or escape through unsupported expressions.],
          [Source.ExtractError: app.ts:93: Static data cannot be mutated or escape through unsupported expressions.],
        ]
      `)
    })

    test('links registered variable references and assignments through packed aliases', async () => {
      expect(
        JSON.parse(compile().library.contracts['vars.ts']!).version,
      ).toMatchInlineSnapshot(`14`)

      const { code, css } = await bundle()

      const value = Vm.runInNewContext(`${code};Fixture;`) as {
        layout: {
          amount: import('zyzz').variable.Reference<'percentage'>
          gap: import('zyzz').variable.Reference<'length'>
        }
        styles: {
          dynamic: (values: { width: string }) => {
            style: Record<string, string>
          }
        }
      }

      expect(
        Object.values({
          ...value.layout['amount'].set('50%'),
          ...value.layout['gap'].set('8px'),
        }),
      ).toMatchInlineSnapshot(`
      [
        "50%",
        "8px",
      ]
    `)
      expect(Object.values(value.styles.dynamic({ width: '30px' }).style))
        .toMatchInlineSnapshot(`
      [
        "30px",
      ]
    `)
      expect(css).toMatchInlineSnapshot(`
        "@property --z-v4t4nbe1og4cic-57{syntax:"<percentage>";inherits:false;initial-value:25%;}
        @property --z-v4t4nbe1og4cic-121{syntax:"<length>";inherits:true;initial-value:4px;}.z-h-20px-Jgxd-Q{height:20px;}
        .z-p-0YuuzC{padding:var(--z-v4t4nbe1og4cic-121);}
        .z-w-Dt1VTw-2{width:var(--z-v4t4nbe1og4cic-57);}
        .z-w-VPbBSM-0{width:var(--z-d1e8a67z1uaws1j-297-77-69-64-74-68);}"
      `)
    })
    test('expands immutable members and shorthand while retaining dynamic intersections', () => {
      const graph = Graph.compile({
        modules: {
          'static.ts': `import { style, variable } from 'zyzz';const dimensions={width:'12px',padding:'4px'} as const;const width=dimensions.width;const base={width,padding:dimensions.padding};type Width='10px'|'30px';type Values={width:Width}&{opacity:0|1};export const count=({n:variable('number', {inherits:false,initialValue:-1})});export namespace styles {
  export const card = style({...base,padding:'8px'})

  export const dynamic = style((values:Values)=>({width:values.width,opacity:values.opacity}))
}`,
        },
      })

      expect(graph.modules['static.ts']!.css).toMatchInlineSnapshot(`
        ".z-w-12px-SQoKgr-0{width:12px;}
        .z-p-8px-BMtYBI{padding:8px;}
        .z-w-lZdSoA-0{width:var(--z-d15wl7di1emu9we-417-77-69-64-74-68);}
        .z-opacity-ZXgQg3{opacity:var(--z-d15wl7di1emu9we-417-6f-70-61-63-69-74-79);}"
      `)
      expect(graph.sharedCss).toMatchInlineSnapshot(
        `"@property --z-v15wl7di1emu9we-257{syntax:"<number>";inherits:false;initial-value:-1;}"`,
      )
      expect(
        graph.modules['static.ts']!.code.includes('values:Values'),
      ).toMatchInlineSnapshot('false')
    })
    test('keeps module type aliases when unrelated nested declarations shadow their names', () => {
      const output = Graph.compile({
        modules: {
          'app.ts': `import { style, variable } from 'zyzz';type Values={width:'10px'};function unrelated(){type Values={width:unknown}}export const vars=({gap:variable('length', {inherits:true,initialValue:'4px',syntax:undefined})});export const card=style((values:Values)=>({width:values.width}));`,
        },
      })

      expect(
        output.modules['app.ts']!.css.includes('width:var('),
      ).toMatchInlineSnapshot('true')
      expect(output.sharedCss?.includes('@property')).toMatchInlineSnapshot(
        'true',
      )
    })
    test('rejects mutation through nested record aliases', () => {
      expect(() =>
        Graph.compile({
          modules: {
            'app.ts': `import {style} from 'zyzz';const base={width:'10px'};const holder={nested:{base}};holder.nested.base.width='20px';export const card=style(base);`,
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: app.ts:82: Static data cannot be mutated or escape through unsupported expressions.]`,
      )
    })
    test('does not resolve a shadowed type alias using the outer declaration', () => {
      expect(() =>
        Graph.compile({
          modules: {
            'shadow.ts': `import {style} from 'zyzz';type Values={width:'10px'};function render(){type Values={width:unknown};return style((values:Values)=>({width:values.width}))}`,
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: shadow.ts:85: Dynamic values require explicit string or number scalar types.]`,
      )
    })
    test('rejects mutated and escaping static records through aliases', () => {
      const mutations = [
        `base.width='30px';`,
        `const alias=base;alias.width='30px';`,
        `consume(base);`,
      ]

      expect(
        mutations.map((mutation) => {
          try {
            Graph.compile({
              modules: {
                'app.ts': `import {style} from 'zyzz';const base={width:'10px'};${mutation}export const card=style(base);`,
              },
            })

            return 'accepted'
          } catch (error) {
            return error
          }
        }),
      ).toMatchInlineSnapshot(`
        [
          [Source.ExtractError: app.ts:53: Static data cannot be mutated or escape through unsupported expressions.],
          [Source.ExtractError: app.ts:70: Static data cannot be mutated or escape through unsupported expressions.],
          [Source.ExtractError: app.ts:53: Static data cannot be mutated or escape through unsupported expressions.],
        ]
      `)
    })
    test('rejects loop writes and noncanonical array member keys', () => {
      const errors = [
        `for(base.width of ['20px']){}`,
        `for(base.width in {x:1}){}`,
      ].map((write) => {
        try {
          Graph.compile({
            modules: {
              'app.js': `import {style} from 'zyzz';const base={width:'10px'};${write}export const card=style(base)`,
            },
          })

          return 'accepted'
        } catch (error) {
          return error
        }
      })

      expect(errors).toMatchInlineSnapshot(`
        [
          [Source.ExtractError: app.js:53: Static data cannot be mutated or escape through unsupported expressions.],
          [Source.ExtractError: app.js:53: Static data cannot be mutated or escape through unsupported expressions.],
        ]
      `)
      expect(() =>
        Graph.compile({
          modules: {
            'app.js': `import {style} from 'zyzz';const sizes=['10px','20px'];export const card=style({width:sizes['01']})`,
          },
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: app.js:86: Expected a literal string or number; expressions are not evaluated.]`,
      )
    })
    test('does not publish values through type-only variable exports', () => {
      const output = Graph.compile({
        modules: {
          'vars.ts': `import {variable} from 'zyzz';const vars=({gap:variable('length')});type vars=typeof vars;export type {vars};export {type vars as other}`,
        },
      })

      expect(output.contracts['vars.ts']).toMatchInlineSnapshot('undefined')
    })
    test('applies registered defaults, inheritance, and assignment in Chromium', async () => {
      const { code, css } = await bundle()
      const browser = await chromium.launch()

      try {
        const page = await browser.newPage()

        await page.setContent(
          `<style>${css}</style><main style="width:400px"><div id="card"></div></main>`,
        )
        await page.addScriptTag({ content: code })
        await page.evaluate(
          `document.getElementById('card').className=Fixture.styles.registered().className`,
        )

        expect(
          await page
            .locator('#card')
            .evaluate((el) => getComputedStyle(el).width),
        ).toMatchInlineSnapshot('"100px"')

        await page.evaluate(
          `for(const [key,value]of Object.entries(({...Fixture.layout["amount"].set('50%'),...Fixture.layout["gap"].set('8px')})))document.querySelector('main').style.setProperty(key,value)`,
        )

        expect(
          await page
            .locator('#card')
            .evaluate((el) => getComputedStyle(el).width),
        ).toMatchInlineSnapshot('"100px"')
        expect(
          await page
            .locator('#card')
            .evaluate((el) => getComputedStyle(el).paddingLeft),
        ).toMatchInlineSnapshot('"8px"')

        await page.evaluate(
          `for(const [key,value]of Object.entries(({...Fixture.layout["amount"].set('75%')})))document.getElementById('card').style.setProperty(key,value)`,
        )

        expect(
          await page
            .locator('#card')
            .evaluate((el) => getComputedStyle(el).width),
        ).toMatchInlineSnapshot('"300px"')
      } finally {
        await browser.close()
      }
    })
  })
})
