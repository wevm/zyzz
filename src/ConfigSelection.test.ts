/** Verifies named theme selection through linked and packed compilation. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import * as Vm from 'node:vm'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

describe('create', () => {
  test('rejects selectors on configurations without named catalogs', () => {
    for (const options of ['{}', "{theme:{color:{ink:'red'}}}"])
      expect(() =>
        Graph.compile({
          modules: {
            'app.js': `import {Config} from 'zyzz';const config=Config.create(${options});config.themes({theme:'base'})`,
          },
        }),
      ).toThrow(/named catalog/)
  })
  test('versions complete named configurations as callable and isolates builtin bindings', async () => {
    const graph = Graph.compile({
      modules: {
        'config.js': `import {Config} from 'zyzz';const Object=null,Array=null,TypeError=null,globalThis=null;export const config=Config.create({defaultTheme:'base',themes:{base:{color:{ink:'red'}}}});export const selected=config.themes({theme:'base',colorScheme:'dark'})`,
      },
    })
    expect(
      JSON.parse(graph.contracts['config.js']!).version,
    ).toMatchInlineSnapshot('4')
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
          'app.ts': `import { css, theme, select } from 'library'; export const styles={card:css({color:select.mint.tokens.color.ink})}; export const mint=select.mint.className; export const first=select({theme:'ocean'}); export const second=select({theme:'mint',colorScheme:'dark'}); export const selectTheme=(name:'ocean'|'mint')=>select({theme:name});`,
        },
      })
      const bundle = await Esbuild.build({
        bundle: true,
        format: 'iife',
        globalName: 'Fixture',
        write: false,
        entryPoints: ['app.ts'],
        plugins: [
          {
            name: 'compiled',
            setup(build) {
              build.onResolve(
                { filter: /^(app\.ts|library|\.\/config\.js)$/ },
                (args) => ({
                  path:
                    args.path === 'library'
                      ? 'index.ts'
                      : args.path === './config.js'
                        ? 'config.ts'
                        : args.path,
                  namespace: 'compiled',
                }),
              )
              build.onLoad({ filter: /.*/, namespace: 'compiled' }, (args) => ({
                contents: (app.modules[args.path] ??
                  library.modules[args.path])!.code,
                loader: 'ts',
                resolveDir: process.cwd(),
              }))
            },
          },
        ],
        alias: { 'zyzz/runtime': Path.resolve('src/runtime/index.ts') },
      })
      const result = Vm.runInNewContext(
        `${bundle.outputFiles[0]!.text};Fixture;`,
      ) as {
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
        'app.ts': `import {Config} from 'zyzz'; const {css,themes}=Config.create({defaultTheme:'a',themes:{a:{color:{ink:{light:'#123456',dark:'#abcdef'}}},b:{color:{ink:{light:'#008844',dark:'#aaffcc'}}}}}); export const styles={card:css({color:'ink'})}; export const outer=themes({theme:'a',colorScheme:'light'}); export const inner=themes({theme:'b',colorScheme:'dark'});`,
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
