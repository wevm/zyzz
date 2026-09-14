/** Verifies named theme selection through linked and packed compilation. @module */
import * as Packed from '../test/fixtures/Packed.js'
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import * as Vm from 'node:vm'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source, Transform } from 'zyzz/compiler'
import { Config } from 'zyzz'

describe('create', () => {
  test('distinguishes catalog names from configuration helpers', async () => {
    const library = Graph.compile({
      modules: {
        'index.ts': `import {Config} from 'zyzz';const config=Config.create({defaultTheme:'css',themes:{css:{color:{ink:'red'}},themes:{color:{ink:'blue'}}}});export const select=config.themes;const {css:cssTheme,themes:themesTheme}=select;export const first=cssTheme.className;export const second=themesTheme.className;`,
      },
    })

    const app = Graph.compile({
      contracts: { 'lib.js': library.contracts['index.ts']! },
      imports: { 'app.ts': { lib: 'lib.js' } },
      modules: {
        'app.ts': `import {select,first,second} from 'lib';const {css:cssTheme,themes:themesTheme}=select;export const same=first===cssTheme.className && second===themesTheme.className;`,
      },
    })

    const code = await Packed.bundle({
      entry: 'app.ts',
      modules: { 'app.ts': app.modules['app.ts']!.code },
      packages: { lib: { 'index.ts': library.modules['index.ts']!.code } },
    })

    expect(Vm.runInNewContext(`${code};Fixture.same;`)).toMatchInlineSnapshot(
      'true',
    )
  })
  test('rejects exported config destructuring without graph linking', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'app.ts',
        source: `import {Config} from 'zyzz';const config=Config.create();export const {css}=config;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:70: Exported configuration destructuring requires source linking.]`,
    )
  })

  for (const output of ['react', 'html']) {
    test(`renders packed ${output} selection and stable component rules in Chromium`, async () => {
      const library = Graph.compile({
        modules: {
          'index.ts': `import {Config} from 'zyzz';export const {css,themes}=Config.create({output:'${output}',defaultTheme:'base',themes:{base:{color:{ink:{light:'#123456',dark:'#abcdef'}}},mint:{color:{ink:{light:'#008844',dark:'#aaffcc'}}}}});`,
        },
      })

      const app = Graph.compile({
        contracts: { 'lib.js': library.contracts['index.ts']! },
        imports: { 'app.ts': { lib: 'lib.js' } },
        modules: {
          'app.ts': `import {css,themes} from 'lib';export namespace styles {
  export const card = css({color:'ink'})
}export const select=themes;`,
        },
      })

      const code = await Packed.bundle({
        entry: 'app.ts',
        modules: { 'app.ts': app.modules['app.ts']!.code },
        packages: { lib: { 'index.ts': library.modules['index.ts']!.code } },
      })

      const browser = await chromium.launch()

      try {
        const page = await browser.newPage()

        await page.setContent(
          `<style>${app.modules['app.ts']!.css}</style><div id="scope"><div id="card">Card</div></div>`,
        )
        await page.addScriptTag({ content: code })

        const colors = await page.evaluate(
          `(()=>{const el=document.getElementById('card'),scope=document.getElementById('scope'),props=Fixture.styles.card();el.className=props.class??props.className;return [['base','light'],['mint','dark']].map(([theme,colorScheme])=>{const props=Fixture.select({theme,colorScheme});scope.className=props.class??props.className;if(typeof props.style==='string')scope.setAttribute('style',props.style);else Object.assign(scope.style,props.style);return getComputedStyle(el).color})})()`,
        )

        expect(colors).toMatchInlineSnapshot(`
          [
            "rgb(18, 52, 86)",
            "rgb(170, 255, 204)",
          ]
        `)
      } finally {
        await browser.close()
      }
    })
  }

  test('aliases named selectors through local and packed member access', () => {
    const library = Graph.compile({
      modules: {
        'config.ts': `import {Config} from 'zyzz';export const config=Config.create({defaultTheme:'base',themes:{base:{color:{ink:'red'}}}});const select=config.themes;export const props=select({theme:'base'});`,
      },
    })

    const app = Graph.compile({
      contracts: { 'lib.js': library.contracts['config.ts']! },
      imports: { 'app.ts': { lib: 'lib.js' } },
      modules: {
        'app.ts': `import {config} from 'lib';const select=config.themes;const alias=select;export const props=alias({theme:'base'});`,
      },
    })

    expect(
      app.modules['app.ts']!.code.includes('alias({theme:'),
    ).toMatchInlineSnapshot('true')
  })
  test('destructures named selectors from packed full configurations', () => {
    const library = Graph.compile({
      modules: {
        'config.ts': `import {Config} from 'zyzz';export const config=Config.create({defaultTheme:'base',themes:{base:{color:{ink:'red'}}}});`,
      },
    })

    const app = Graph.compile({
      contracts: { 'lib.js': library.contracts['config.ts']! },
      imports: { 'app.ts': { lib: 'lib.js' } },
      modules: {
        'app.ts': `import {config} from 'lib';const {themes:select,theme,css}=config;export const props=select({theme:'base'});export const style=css({color:theme.tokens.color.ink});`,
      },
    })

    expect(app.modules['app.ts']!.css.includes('red')).toMatchInlineSnapshot(
      'true',
    )
  })
  test('reports missing transforms and removes unused selection runtime from bundles', async () => {
    const { themes } = Config.create({
      defaultTheme: 'base',
      themes: { base: {} },
    })

    expect(() => themes({ theme: 'base' })).toThrowErrorMatchingInlineSnapshot(
      `[css.MissingTransformError: css requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.]`,
    )

    const graph = Graph.compile({
      modules: {
        'app.ts': `import {Config} from 'zyzz';const {css}=Config.create({defaultTheme:'base',themes:{base:{color:{ink:'red'}},other:{color:{ink:'blue'}}}});export const props=css({color:'ink'})();`,
      },
    })

    const bundle = await Esbuild.build({
      stdin: {
        contents: graph.modules['app.ts']!.code,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      minify: true,
      format: 'esm',
      alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
    })

    expect(
      bundle.outputFiles![0]!.text.includes('colorScheme'),
    ).toMatchInlineSnapshot('false')
  })
  test('rejects selectors on configurations without named catalogs', () => {
    const errors = ['{}', "{theme:{color:{ink:'red'}}}"].map((options) => {
      try {
        Graph.compile({
          modules: {
            'app.js': `import {Config} from 'zyzz';const config=Config.create(${options});config.themes({theme:'base'})`,
          },
        })

        return 'accepted'
      } catch (error) {
        return error
      }
    })

    expect(errors).toMatchInlineSnapshot(`
      [
        [Source.ExtractError: app.js:59: Theme selection requires a named catalog.],
        [Source.ExtractError: app.js:84: Theme selection requires a named catalog.],
      ]
    `)
  })
  test('versions complete named configurations as callable and isolates builtin bindings', async () => {
    const graph = Graph.compile({
      modules: {
        'config.js': `import {Config} from 'zyzz';const Object=null,Array=null,TypeError=null,globalThis=null;export const config=Config.create({defaultTheme:'base',themes:{base:{color:{ink:'red'}}}});export const selected=config.themes({theme:'base',colorScheme:'dark'})`,
      },
    })

    expect(
      JSON.parse(graph.contracts['config.js']!).version,
    ).toMatchInlineSnapshot('17')

    const bundle = await Esbuild.build({
      stdin: {
        contents: graph.modules['config.js']!.code,
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'Fixture',
      alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
    })

    const value = Vm.runInNewContext(
      `${bundle.outputFiles[0]!.text};Fixture.selected`,
    )

    expect(value.style.colorScheme).toMatchInlineSnapshot('"dark"')
  })
  test('preserves legacy static catalogs while rejecting callable selection', () => {
    const library = Graph.compile({
      modules: {
        'config.ts': `import {Config} from 'zyzz';export const config=Config.create({defaultTheme:'base',themes:{base:{color:{ink:'red'}}}})`,
      },
    })

    const legacy = JSON.parse(library.contracts['config.ts']!)

    legacy.version = 2
    for (const theme of Object.values(legacy.themes) as {
      cssOutput?: string
    }[])
      delete theme.cssOutput

    const contracts = { 'lib.js': JSON.stringify(legacy) },
      imports = { 'app.ts': { lib: 'lib.js' } }

    const staticOutput = Graph.compile({
      contracts,
      imports,
      modules: {
        'app.ts': `import {config} from 'lib';export const name=config.themes.base.className`,
      },
    })

    expect(
      staticOutput.modules['app.ts']!.code.includes('z_theme'),
    ).toMatchInlineSnapshot('true')

    for (const source of [
      `import {config} from 'lib';config.themes({theme:'base'})`,
      `import {config} from 'lib';const {themes}=config;themes({theme:'base'})`,
    ])
      expect(() =>
        Graph.compile({ contracts, imports, modules: { 'app.ts': source } }),
      ).toThrow(Source.ExtractError)

    const forwarded = Graph.compile({
      contracts,
      imports,
      modules: { 'app.ts': `export {config} from 'lib'` },
    })

    expect(() =>
      Graph.compile({
        contracts: { 'forward.js': forwarded.contracts['app.ts']! },
        imports: { 'main.ts': { forward: 'forward.js' } },
        modules: {
          'main.ts': `import {config} from 'forward';config.themes({theme:'base'})`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: main.ts:31: This legacy catalog is not callable; rebuild its library.]`,
    )
  })
  test('rejects unchecked selector names, fields, and schemes', async () => {
    const graph = Graph.compile({
      modules: {
        'config.ts': `import {Config} from 'zyzz';export const {themes}=Config.create({defaultTheme:'base',themes:{base:{color:{ink:'#123456'}}}});`,
      },
    })

    const bundle = await Esbuild.build({
      stdin: {
        contents: graph.modules['config.ts']!.code,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'Fixture',
      alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
    })

    const select = Vm.runInNewContext(
      `${bundle.outputFiles[0]!.text};Fixture.themes;`,
    ) as (input: unknown) => unknown

    for (const input of [
      { theme: 'missing' },
      { theme: 1 },
      { theme: 'toString' },
      { theme: 'base', colorScheme: 'invalid' },
      { theme: 'base', extra: true },
      null,
    ])
      expect(() => select(input)).toThrowErrorMatchingInlineSnapshot(
        '[TypeError: Invalid theme selection.]',
      )
  })

  for (const output of ['react', 'html'] as const) {
    test(`selects imported and packed ${output} themes without changing component rules`, async () => {
      const library = Graph.compile({
        modules: {
          'config.ts': `import { Config } from 'zyzz'; export const { css, theme, themes } = Config.create({output:'${output}',defaultTheme:'ocean',themes:{ocean:{color:{ink:{light:'#123456',dark:'#abcdef'}}},mint:{color:{ink:{light:'#008844',dark:'#aaffcc'}}}}});`,
          'index.ts': `export { css, theme, themes as select } from './config.js';`,
        },
      })

      const app = Graph.compile({
        contracts: { 'library/index.js': library.contracts['index.ts']! },
        imports: { 'app.ts': { library: 'library/index.js' } },
        modules: {
          'app.ts': `import { css, theme, select } from 'library'; export namespace styles {
  export const card = css({color:select.mint.tokens.color.ink})
} export const mint=select.mint.className; export const first=select({theme:'ocean'}); export const second=select({theme:'mint',colorScheme:'dark'}); export const selectTheme=(name:'ocean'|'mint')=>select({theme:name});`,
        },
      })

      const bundle = await Packed.bundle({
        entry: 'app.ts',
        modules: { 'app.ts': app.modules['app.ts']!.code },
        packages: {
          library: Object.fromEntries(
            Object.entries(library.modules).map(([name, module]) => [
              name,
              module.code,
            ]),
          ),
        },
      })

      const result = Vm.runInNewContext(`${bundle};Fixture;`) as {
        mint: string
        first: Record<string, unknown>
        second: Record<string, unknown>
        selectTheme: (name: string) => Record<string, unknown>
      }

      const key = output === 'html' ? 'class' : 'className'

      expect(result.mint === result.second[key]).toMatchInlineSnapshot('true')
      expect(typeof result.first[key]).toMatchInlineSnapshot('"string"')
      expect(result.first.style).toMatchInlineSnapshot('undefined')
      expect(result.second[key] !== result.first[key]).toMatchInlineSnapshot(
        'true',
      )
      expect(
        result.selectTheme('mint')[key] === result.second[key],
      ).toMatchInlineSnapshot('true')

      if (output === 'html')
        expect(result.second.style).toMatchInlineSnapshot('"color-scheme:dark"')
      else
        expect(result.second.style).toMatchInlineSnapshot(
          `
          {
            "colorScheme": "dark",
          }
        `,
        )
    })
  }

  test('nested selections inherit tokens and independently force color schemes in a browser', async () => {
    const result = Graph.compile({
      modules: {
        'app.ts': `import {Config} from 'zyzz'; const {css,themes}=Config.create({defaultTheme:'a',themes:{a:{color:{ink:{light:'#123456',dark:'#abcdef'}}},b:{color:{ink:{light:'#008844',dark:'#aaffcc'}}}}}); export namespace styles {
  export const card = css({color:'ink'})
} export const outer=themes({theme:'a',colorScheme:'light'}); export const inner=themes({theme:'b',colorScheme:'dark'});`,
      },
    })

    const bundle = await Esbuild.build({
      stdin: {
        contents: result.modules['app.ts']!.code,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: 'iife',
      globalName: 'Fixture',
      write: false,
      alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
    })

    const browser = await chromium.launch({ headless: true })

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${result.modules['app.ts']!.css}</style><div id="outer"><div id="inner"></div></div>`,
      )
      await page.addScriptTag({ content: bundle.outputFiles[0]!.text })

      const colors = await page.evaluate(
        `(()=>{const {styles,outer,inner}=Fixture;for(const [id,scope]of [['outer',outer],['inner',inner]]){const el=document.getElementById(id);el.className=scope.className+' '+styles.card().className;Object.assign(el.style,scope.style)}return ['outer','inner'].map(id=>getComputedStyle(document.getElementById(id)).color)})()`,
      )

      expect(colors).toMatchInlineSnapshot(`
        [
          "rgb(18, 52, 86)",
          "rgb(170, 255, 204)",
        ]
      `)
    } finally {
      await browser.close()
    }
  })
})
