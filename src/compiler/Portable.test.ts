import { Vars } from 'zyzz'
/** Exercises unchanged authoring against extracted CSS and optional source optimization. @module */
import { Config, cx, style, variable, variants } from '../index.js'
import { customMedia } from '../web/index.js'
import { Graph, Transform } from './index.js'
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import {
  Graph as outputGraph,
  Transform as outputTransform,
} from 'zyzz/compiler'

describe('compile', () => {
  test('keeps extended theme scopes stable without a source transform', () => {
    const base = Vars.define({ color: { primary: 'red' } }, { id: 'palette' })
    const alternate = Vars.extend(base, { color: { primary: 'blue' } })
    const config = Config.create({
      vars: { base, alternate },
      defaultVars: 'base',
      id: 'scopes',
    })
    const source = `import {Config,Vars} from 'zyzz';const base=Vars.define({color:{primary:'red'}},{id:'palette'});const alternate=Vars.extend(base,{color:{primary:'blue'}});const config=Config.create({vars:{base,alternate},defaultVars:'base',id:'scopes'});export const scope=config.vars({set:'alternate'}).className;export const card=config.style({color:'primary'});`
    const output = Transform.compile({
      compiler: false,
      moduleId: 'app.ts',
      source,
    })

    expect(output.code).toBe(source)
    expect(output.css).toContain(
      `.${config.vars({ set: 'alternate' }).className}{`,
    )
  })

  test('matches explicitly named custom queries without rewriting source', () => {
    const wide = customMedia('(width >= 600px)', { id: 'wide' })
    const source = `import { style } from 'zyzz'; import { customMedia } from 'zyzz/web'; const wide = customMedia('(width >= 600px)', { id: 'wide' }); export const card = style({ [wide]: { color: 'red' } });`
    const output = Transform.compile({
      compiler: false,
      moduleId: 'app.ts',
      source,
    })

    expect(output.code).toBe(source)
    expect(output.css).toContain(String(wide))
    expect(output.css).toContain('@custom-media --z-custommediaid-')
  })

  test('rejects missing and conflicting identities and invalidates mode caches', () => {
    const cache = Graph.create()
    const source = `import { style, variable } from 'zyzz'; const accent = variable('color'); export const card = style({ color: accent });`

    expect(
      cache.compile({ modules: { 'app.ts': source } }).modules['app.ts']!
        .code !== source,
    ).toBe(true)
    expect(() =>
      cache.compile({ compiler: false, modules: { 'app.ts': source } }),
    ).toThrow('explicit variable id')
    expect(() =>
      Graph.compile({
        compiler: false,
        modules: {
          'a.ts': `import { style } from 'zyzz'; export const a = style({ color: 'red' }, { id: 'same' });`,
          'b.ts': `import { style } from 'zyzz'; export const b = style({ color: 'blue' }, { id: 'same' });`,
        },
      }),
    ).toThrow()
    expect(() =>
      Transform.compile({
        compiler: false,
        moduleId: 'app.ts',
        source: `import { style } from 'zyzz'; export const bar = style((v: { width: number }) => ({ opacity: v.width }));`,
      }),
    ).toThrow('explicit id')
  })

  test('matches unchanged static definitions and variable assignments', () => {
    const accent = variable('color', { id: 'accent' })
    const card = style({
      color: accent,
      padding: '8px',
      ':hover': { opacity: 0.5 },
    })
    const source = `import { style, variable } from 'zyzz';
      const accent = variable('color', { id: 'accent' });
      export const card = style({ color: accent, padding: '8px', ':hover': { opacity: 0.5 } });`
    const output = Graph.compile({
      compiler: false,
      modules: { 'app/card.ts': source },
    }).modules['app/card.ts']!

    expect(output.code === source).toMatchInlineSnapshot('true')
    expect(output.css.includes(`.${card().className}{`)).toMatchInlineSnapshot(
      'true',
    )
    expect(card({ vars: accent.set('red') })).toMatchInlineSnapshot(`
      {
        "className": "z-content-1wyeijq1ll9w4",
        "style": {
          "--z-vid-61-63-63-65-6e-74": "red",
        },
      }
    `)
  })

  test('binds explicit dynamic identities and finite selections', () => {
    const bar = style(
      (values: { width: `${number}px` }) => ({ width: values.width }),
      { id: 'bar' },
    )
    const button = variants(
      {
        variants: {
          size: { small: { padding: '4px' }, large: { padding: '8px' } },
        },
        defaultVariants: { size: 'small' },
      },
      { id: 'button' },
    )
    const source = `import { style, variants } from 'zyzz';
      export const bar = style((values: { width: \`\${number}px\` }) => ({ width: values.width }), { id: 'bar' });
      export const button = variants({ variants: { size: { small: { padding: '4px' }, large: { padding: '8px' } } }, defaultVariants: { size: 'small' } }, { id: 'button' });`
    const output = Transform.compile({
      compiler: false,
      moduleId: 'app.ts',
      source,
    })

    expect(
      output.css.includes(`.${bar({ width: '20px' }).className}{`),
    ).toMatchInlineSnapshot('true')
    expect(
      output.css.includes(Object.keys(bar({ width: '20px' }).style!)[0]!),
    ).toMatchInlineSnapshot('true')
    expect(
      output.css.includes(`.${button().className}{`),
    ).toMatchInlineSnapshot('true')
    expect(button({ size: 'large' })).toMatchInlineSnapshot(`
      {
        "className": "z-style-id-62-75-74-74-6f-6e",
        "data-size": "large",
      }
    `)
    expect(
      Transform.compile({ moduleId: 'app.ts', source }).code !== source,
    ).toMatchInlineSnapshot('true')
  })

  test('binds a configured theme with an explicit identity', () => {
    const config = Config.create({
      id: 'app',
      vars: { color: { primary: 'red' } },
    })
    const card = config.style({ color: 'primary' })
    const source =
      "import { Config } from 'zyzz';\n      const { style, vars:theme } = Config.create({ id: 'app', vars: { color: { primary: 'red' } } });\n      export const card = style({ color: 'primary' });"
    const output = Graph.compile({
      compiler: false,
      modules: { 'app/theme.ts': source },
    })

    expect(
      output.modules['app/theme.ts']!.css.includes(card().className),
    ).toMatchInlineSnapshot('true')
    expect(
      output.modules['app/theme.ts']!.css.includes(config.vars().className),
    ).toMatchInlineSnapshot('true')
  })
})

describe('compile', () => {
  test.each(['atomic', 'grouped'] as const)(
    'renders %s applications with both compiler settings',
    async (cssOutput) => {
      const source = `import { Config, cx, variable } from 'zyzz';
      const { style, variants } = Config.create({ cssOutput: '${cssOutput}' });
      import { global, keyframes } from 'zyzz/web';
      global({ body: { margin: '0' } });
      const spin = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }, { id: 'spin' });
      const accent = variable('color', { id: 'accent' });
      const { style: themed, vars:theme } = Config.create({ cssOutput: '${cssOutput}', id: 'palette', vars:{ color: { primary: 'red' } } });
      const parent = style({}, { id: 'parent' });
      const child = themed({ color: 'primary', selectors: { [\`\${parent} &\`]: { backgroundColor: 'blue' } } });
      const left = style({ paddingLeft: '8px', color: accent });
      const padding = style({ padding: '16px', animationName: spin });
      const button = variants({ variants: { size: { fluid: (values: { width: \`\${number}px\` }) => ({ width: values.width }), fixed: { width: '10px' } } }, conditions: { wide: '@media (min-width: 500px)' } }, { id: 'button' });
      export function render(enabled: boolean) {
        return { theme:theme(), parent: parent(), child: child(), box: cx(left({ vars: accent.set('green') }), enabled && padding()), button: button({ size: { fluid: { width: '20px' } }, conditions: { wide: { size: { fluid: { width: '30px' } } } } }) };
      }`
      const browser = await chromium.launch()
      try {
        const page = await browser.newPage({
          viewport: { width: 800, height: 600 },
        })
        for (const compiler of [false, true]) {
          const output = Transform.compile({
            compiler,
            moduleId: 'app.ts',
            source,
          })
          const bundle = await Esbuild.build({
            bundle: true,
            write: false,
            format: 'iife',
            globalName: 'fixture',
            stdin: {
              contents: output.code,
              loader: 'ts',
              resolveDir: process.cwd(),
            },
            alias: {
              zyzz: Path.resolve('src/index.ts'),
              'zyzz/web': Path.resolve('src/web/index.ts'),
              'zyzz/runtime': Path.resolve('src/runtime/index.ts'),
            },
          })
          await page.setContent(
            `<style>${output.css}</style><div id="root"><div id="parent"><div id="child"></div></div><div id="box"></div><div id="button"></div></div>`,
          )
          await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
          for (const enabled of [false, true]) {
            await page.evaluate((enabled) => {
              const values = (
                window as unknown as {
                  fixture: {
                    render(enabled: boolean): Record<
                      string,
                      {
                        className: string
                        style?: Record<string, string>
                        [key: `data-${string}`]: string
                      }
                    >
                  }
                }
              ).fixture.render(enabled)
              for (const [key, props] of Object.entries(values)) {
                const element = document.getElementById(
                  key === 'theme' ? 'root' : key,
                )!
                element.className = props.className
                element.removeAttribute('style')
                for (const [name, value] of Object.entries(props.style ?? {})) {
                  if (name.startsWith('--'))
                    element.style.setProperty(name, value)
                  else Object.assign(element.style, { [name]: value })
                }
                for (const [name, value] of Object.entries(props))
                  if (name.startsWith('data-'))
                    element.setAttribute(name, String(value))
              }
            }, enabled)
            if (enabled)
              expect(
                await page
                  .locator('#box')
                  .evaluate((element) => getComputedStyle(element).paddingLeft),
              ).toMatchInlineSnapshot('"16px"')
            else
              expect(
                await page
                  .locator('#box')
                  .evaluate((element) => getComputedStyle(element).paddingLeft),
              ).toMatchInlineSnapshot('"8px"')
            expect(
              await page
                .locator('#box')
                .evaluate((element) => getComputedStyle(element).color),
            ).toMatchInlineSnapshot('"rgb(0, 128, 0)"')
            expect(
              await page
                .locator('#child')
                .evaluate(
                  (element) => getComputedStyle(element).backgroundColor,
                ),
            ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
            expect(
              await page
                .locator('#child')
                .evaluate((element) => getComputedStyle(element).color),
            ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
            expect(
              await page
                .locator('#button')
                .evaluate((element) => getComputedStyle(element).width),
            ).toMatchInlineSnapshot('"30px"')
          }
        }
      } finally {
        await browser.close()
      }
    },
    30000,
  )
})

describe('Transform.compile', () => {
  test('reports located invalid ids and allows identity text in declaration values', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: "import {style} from 'zyzz'; style({color:'red'},{id:''})",
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:28: Definition options require one nonempty literal id.]`,
    )
    expect(
      Transform.compile({
        compiler: false,
        moduleId: 'content.ts',
        source: `import {style} from 'zyzz'; style({content:'"z-style-banner"'})`,
      }).css,
    ).toMatchInlineSnapshot(
      `".z-content-1iip0sa1qla8lk{content:"z-style-banner";}"`,
    )
  })
  test('rejects missing ids on selectable empty scopes and locates invalid selector ids', () => {
    for (const source of [
      "import {Config} from 'zyzz';const {vars:themes}=Config.create({vars:{light:{},dark:{}},defaultVars:'light'});themes({set:'dark'})",
      "import {Config} from 'zyzz';\nimport {Vars} from 'zyzz';const theme=Vars.define({}); const themeConfig=Config.create({vars:theme});export const scope=themeConfig.vars().className",
    ])
      expect(() =>
        Transform.compile({ compiler: false, moduleId: 'empty.ts', source }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: CSS-only themes require an explicit id on Config.create or Vars.define.]`,
      )
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {style} from 'zyzz';const bad=style({color:'red'},{id:''});export const other=style({selectors:{[\`\${bad} &\`]:{color:'blue'}}})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:37: Definition options require one nonempty literal id.]`,
    )
  })
})

describe('cx', () => {
  test('composes html theme selections without source rewriting', () => {
    const config = Config.create({
      id: 'html',
      output: 'html',
      vars: {
        light: { color: { primary: 'red' } },
        dark: { color: { primary: 'blue' } },
      },
      defaultVars: 'light',
    })
    expect(
      cx(config.vars({ set: 'dark' }), config.style({ color: 'primary' })()),
    ).toMatchInlineSnapshot(`
    {
      "class": "z-compose-1wfpeq21v73xyw z_theme-id-68-74-6d-6c-dark",
    }
  `)
  })
})

describe('Graph.compile', () => {
  test('rejects conflicting explicit themes and named contributions across modules', () => {
    expect(() =>
      Graph.compile({
        compiler: false,
        modules: {
          'a.ts':
            "import {Config} from 'zyzz';\nimport {Vars} from 'zyzz'; const t=Vars.define({color:{primary:'red'}},{id:'same'}); const tConfig=Config.create({vars:t}); export const card=tConfig.style({color:'primary'})",
          'b.ts':
            "import {Config} from 'zyzz';\nimport {Vars} from 'zyzz'; const t=Vars.define({color:{primary:'blue'}},{id:'same'}); const tConfig=Config.create({vars:t}); export const card=tConfig.style({color:'primary'})",
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: b.ts:0: The same explicit identity is used for different definitions.]`,
    )
    expect(() =>
      Graph.compile({
        compiler: false,
        modules: {
          'a.ts':
            "import {keyframes} from 'zyzz/web'; export const fade=keyframes({from:{opacity:0},to:{opacity:1}},{id:'same'})",
          'b.ts':
            "import {keyframes} from 'zyzz/web'; export const fade=keyframes({from:{opacity:1},to:{opacity:0}},{id:'same'})",
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: b.ts:0: Conflicting animation identity: z-kid-73-61-6d-65; compile libraries with package-qualified module IDs.]`,
    )
  })

  test('accepts identical portable declarations across separate modules', () => {
    const output = Graph.compile({
      compiler: false,
      modules: {
        'a.ts': `import {style} from 'zyzz';export const card=style({color:'red',padding:'8px'})`,
        'b.ts': `import {style} from 'zyzz';export const card=style({color:'red',padding:'8px'})`,
      },
    })
    expect(
      output.modules['a.ts']!.css === output.modules['b.ts']!.css,
    ).toMatchInlineSnapshot('true')
  })

  test('checks explicit identities against packed library definitions', () => {
    const library = Graph.compile({
      compiler: false,
      modules: {
        'lib.ts': `import {style} from 'zyzz';export const card=style({color:'red'},{id:'same'})`,
      },
    })
    expect(() =>
      Graph.compile({
        compiler: false,
        contracts: { 'lib.js': library.contracts['lib.ts']! },
        modules: {
          'app.ts': `import {style} from 'zyzz';export const card=style({color:'blue'},{id:'same'})`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:0: The same explicit style id is used for different declarations.]`,
    )
    const theme = Graph.compile({
      compiler: false,
      modules: {
        'theme.ts':
          "import {Vars} from 'zyzz';export const theme=Vars.define({color:{primary:'red'}},{id:'same'})",
      },
    })
    expect(() =>
      Graph.compile({
        compiler: false,
        contracts: { 'theme.js': theme.contracts['theme.ts']! },
        modules: {
          'app.ts':
            "import {Vars} from 'zyzz';export const theme=Vars.define({color:{primary:'blue'}},{id:'same'})",
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:0: The same explicit identity is used for different definitions.]`,
    )
  })
})

describe('output', () => {
  describe('Transform.compile', () => {
    test.each(['atomic', 'grouped'] as const)(
      'maps %s declarations with either compiler setting',
      (cssOutput) => {
        const source = `import { Config } from 'zyzz';
const { style } = Config.create({ cssOutput: '${cssOutput}' });
export const card = style({
  color: 'red',
  padding: '8px',
});`
        for (const compiler of [false, true]) {
          const result = outputTransform.compile({
            compiler,
            moduleId: 'card.ts',
            source,
          })
          const map = new Trace.TraceMap(result.cssMap)

          for (const [property, line] of [
            ['color:red', 4],
            ['padding:8px', 5],
          ] as const) {
            const offset = result.css.indexOf(property)
            const prefix = result.css.slice(0, offset).split('\n')
            const original = Trace.originalPositionFor(map, {
              column: prefix.at(-1)!.length,
              line: prefix.length,
            })

            expect(original.source).toMatchInlineSnapshot('"card.ts"')
            expect(original.line === line).toMatchInlineSnapshot('true')
            expect(original.column).toMatchInlineSnapshot('2')
          }
        }
      },
    )
  })

  describe('Graph.create', () => {
    test.each([false, true])(
      'invalidates imported output config with compiler=%s',
      (compiler) => {
        const graph = outputGraph.create()
        const source = `import { style } from './config.js'; export const card = style({ color: 'red', padding: '8px' });`
        const compile = (cssOutput: string) =>
          graph.compile({
            compiler,
            modules: {
              'card.ts': source,
              'config.ts': `import { Config } from 'zyzz'; export const { style } = Config.create({ cssOutput: '${cssOutput}' });`,
            },
          }).modules['card.ts']!
        const atomic = compile('atomic')
        const grouped = compile('grouped')
        const restored = compile('atomic')

        expect(
          atomic.css.includes('color:red;padding:8px;'),
        ).toMatchInlineSnapshot('false')
        expect(
          grouped.css.includes('color:red;padding:8px;'),
        ).toMatchInlineSnapshot('true')
        expect(restored.css === atomic.css).toMatchInlineSnapshot('true')
        expect(restored.code === atomic.code).toMatchInlineSnapshot('true')
        expect(() => compile('invalid')).toThrowErrorMatchingInlineSnapshot(
          `[Source.ExtractError: config.ts:56: cssOutput must be atomic or grouped.]`,
        )
      },
    )
  })
})
