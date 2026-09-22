/** Verifies named theme selection through linked and packed compilation. @module */
import * as Packed from '../test/fixtures/Packed.js'
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import * as Vm from 'node:vm'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'
import { Config } from 'zyzz'

describe('create', () => {
  test('distinguishes catalog names from configuration helpers', async () => {
    const library = Graph.compile({
      modules: {
        'index.ts':
          "import {Config} from 'zyzz';const config=Config.create({defaultVars:'style',vars:{style:{color:{ink:'red'}},vars:{color:{ink:'blue'}}}});export const select=config.vars;export const first=select({set:'style'}).className;export const second=select({set:'vars'}).className;",
      },
    })

    const app = Graph.compile({
      contracts: { 'lib.js': library.contracts['index.ts']! },
      imports: { 'app.ts': { lib: 'lib.js' } },
      modules: {
        'app.ts': `import {select,first,second} from 'lib';export const same=first===select({set:'style'}).className && second===select({set:'vars'}).className;`,
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
        source: `import {Config} from 'zyzz';const config=Config.create();export const {style}=config;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:70: Exported configuration destructuring requires source linking.]`,
    )
  })

  for (const output of ['react', 'html']) {
    test(`renders packed ${output} selection and stable component rules in Chromium`, async () => {
      const library = Graph.compile({
        modules: {
          'index.ts': `import {Config} from 'zyzz';export const {style,vars}=Config.create({output:'${output}',defaultVars:'base',vars:{base:{color:{ink:{light:'#123456',dark:'#abcdef'}}},mint:{color:{ink:{light:'#008844',dark:'#aaffcc'}}}}});`,
        },
      })

      const app = Graph.compile({
        contracts: { 'lib.js': library.contracts['index.ts']! },
        imports: { 'app.ts': { lib: 'lib.js' } },
        modules: {
          'app.ts': `import {style,vars} from 'lib';export namespace styles {
  export const card = style({color:'ink'})
}export const select=vars;`,
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
          `(()=>{const el=document.getElementById('card'),scope=document.getElementById('scope'),props=Fixture.styles.card();el.className=props.class??props.className;return [['base','light'],['mint','dark']].map(([theme,colorScheme])=>{const props=Fixture.select({set:theme,colorScheme});scope.className=props.class??props.className;if(typeof props.style==='string')scope.setAttribute('style',props.style);else Object.assign(scope.style,props.style);return getComputedStyle(el).color})})()`,
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
        'config.ts':
          "import {Config} from 'zyzz';export const config=Config.create({defaultVars:'base',vars:{base:{color:{ink:'red'}}}});const select=config.vars;export const props=select({set:'base'});",
      },
    })

    const app = Graph.compile({
      contracts: { 'lib.js': library.contracts['config.ts']! },
      imports: { 'app.ts': { lib: 'lib.js' } },
      modules: {
        'app.ts': `import {config} from 'lib';const select=config.vars;const alias=select;export const props=alias({set:'base'});`,
      },
    })

    expect(
      app.modules['app.ts']!.code.includes('alias({set:'),
    ).toMatchInlineSnapshot('true')
  })
  test('destructures named selectors from packed full configurations', () => {
    const library = Graph.compile({
      modules: {
        'config.ts':
          "import {Config} from 'zyzz';export const config=Config.create({defaultVars:'base',vars:{base:{color:{ink:'red'}}}});",
      },
    })

    const app = Graph.compile({
      contracts: { 'lib.js': library.contracts['config.ts']! },
      imports: { 'app.ts': { lib: 'lib.js' } },
      modules: {
        'app.ts': `import {config} from 'lib';const {vars:select,style}=config;export const props=select({set:'base'});export const card=style({color:select.color.ink});`,
      },
    })

    expect(app.modules['app.ts']!.css.includes('red')).toMatchInlineSnapshot(
      'true',
    )
  })
  test('reports missing transforms and removes unused selection runtime from bundles', async () => {
    const { vars } = Config.create({
      defaultVars: 'base',
      vars: { base: {} },
    })

    expect(() => vars({ set: 'base' })).toThrowErrorMatchingInlineSnapshot(
      `[Error: Config.create requires an explicit id without the compiler plugin.]`,
    )

    const graph = Graph.compile({
      modules: {
        'app.ts':
          "import {Config} from 'zyzz';const {style}=Config.create({defaultVars:'base',vars:{base:{color:{ink:'red'}},other:{color:{ink:'blue'}}}});export const props=style({color:'ink'})();",
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
    const errors = ['{}'].map((options) => {
      try {
        Graph.compile({
          modules: {
            'app.js': `import {Config} from 'zyzz';const config=Config.create(${options});config.vars({set:'base'})`,
          },
        })

        return 'accepted'
      } catch (error) {
        return error
      }
    })

    expect(errors).toMatchInlineSnapshot(`
      [
        [Source.ExtractError: app.js:59: This configuration has no vars.],
      ]
    `)
  })
  test('versions complete named configurations as callable and isolates builtin bindings', async () => {
    const graph = Graph.compile({
      modules: {
        'config.js':
          "import {Config} from 'zyzz';const Object=null,Array=null,TypeError=null,globalThis=null;export const config=Config.create({defaultVars:'base',vars:{base:{color:{ink:'red'}}}});export const selected=config.vars({set:'base',colorScheme:'dark'})",
      },
    })

    expect(
      JSON.parse(graph.contracts['config.js']!).version,
    ).toMatchInlineSnapshot(`29`)

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
  test('rejects variable catalogs recorded with old schemas', () => {
    const library = Graph.compile({
      modules: {
        'config.ts':
          "import {Config} from 'zyzz';export const config=Config.create({defaultVars:'base',vars:{base:{color:{ink:'red'}}}})",
      },
    })
    for (const version of [2, 18, 25]) {
      const contract = JSON.parse(library.contracts['config.ts']!)
      contract.version = version
      for (const source of [
        "import {config} from 'lib';config.vars({set:'base'})",
        "import {config} from 'lib';const {vars}=config;vars({set:'base'})",
        "export {config} from 'lib'",
      ])
        expect(() =>
          Graph.compile({
            contracts: { 'lib.js': JSON.stringify(contract) },
            imports: { 'app.ts': { lib: 'lib.js' } },
            modules: { 'app.ts': source },
          }),
        ).toThrow('Vars contracts require contract version 29 or later.')
    }
  })
  test('rejects unchecked selector names, fields, and schemes', async () => {
    const graph = Graph.compile({
      modules: {
        'config.ts':
          "import {Config} from 'zyzz';export const {vars:vars}=Config.create({defaultVars:'base',vars:{base:{color:{ink:'#123456'}}}});",
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
      `${bundle.outputFiles[0]!.text};Fixture.vars;`,
    ) as (input: unknown) => unknown

    for (const input of [
      { set: 'missing' },
      { set: 1 },
      { set: 'toString' },
      { set: 'base', colorScheme: 'invalid' },
      { set: 'base', extra: true },
      null,
    ])
      expect(() => select(input)).toThrowErrorMatchingInlineSnapshot(
        '[TypeError: Invalid variable selection.]',
      )
  })

  for (const output of ['react', 'html'] as const) {
    test(`selects imported and packed ${output} vars without changing component rules`, async () => {
      const library = Graph.compile({
        modules: {
          'config.ts': `import { Config } from 'zyzz'; export const { style, vars } = Config.create({output:'${output}',defaultVars:'ocean',vars:{ocean:{color:{ink:{light:'#123456',dark:'#abcdef'}}},mint:{color:{ink:{light:'#008844',dark:'#aaffcc'}}}}});`,
          'index.ts': `export { style, vars as select } from './config.js';`,
        },
      })

      const app = Graph.compile({
        contracts: { 'library/index.js': library.contracts['index.ts']! },
        imports: { 'app.ts': { library: 'library/index.js' } },
        modules: {
          'app.ts': `import { select, style } from 'library'; export namespace styles {
  export const card = style({color:select.color.ink})
} export const mint=select({set:'mint'})['${output === 'html' ? 'class' : 'className'}']; export const first=select({set:'ocean'}); export const second=select({set:'mint',colorScheme:'dark'}); export const selectTheme=(name:'ocean'|'mint')=>select({set:name});`,
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

      expect(
        result.second[key] === `${result.mint} z_scheme-dark`,
      ).toMatchInlineSnapshot(`true`)
      expect(typeof result.first[key]).toMatchInlineSnapshot('"string"')
      expect(result.first.style).toMatchInlineSnapshot('undefined')
      expect(result.second[key] !== result.first[key]).toMatchInlineSnapshot(
        'true',
      )
      expect(
        result.selectTheme('mint')[key] === result.mint,
      ).toMatchInlineSnapshot(`true`)

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
        'app.ts':
          "import {Config} from 'zyzz'; const {style,vars:vars}=Config.create({defaultVars:'a',vars:{a:{color:{ink:{light:'#123456',dark:'#abcdef'}}},b:{color:{ink:{light:'#008844',dark:'#aaffcc'}}}}}); export namespace styles {\n  export const card = style({color:'ink'})\n} export const outer=vars({set:'a',colorScheme:'light'}); export const inner=vars({set:'b',colorScheme:'dark'});",
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
