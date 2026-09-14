/** Exercises unchanged authoring against extracted CSS and optional source optimization. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Config, css, cx, Theme, variable, variants } from '../index.js'
import { Graph, Transform } from './index.js'
import { customMedia } from '../web/index.js'

describe('compile', () => {
  test('keeps extended theme scopes stable without a source transform', () => {
    const base = Theme.define({ color: { primary: 'red' } }, { id: 'palette' })
    const alternate = Theme.extend(base, { color: { primary: 'blue' } })
    const source = `import { Theme } from 'zyzz'; const base = Theme.define({ color: { primary: 'red' } }, { id: 'palette' }); const alternate = Theme.extend(base, { color: { primary: 'blue' } }); export const scope = alternate.className; export const card = base.css({ color: 'primary' });`
    const output = Transform.compile({
      compiler: false,
      moduleId: 'app.ts',
      source,
    })

    expect(output.code).toBe(source)
    expect(output.css).toContain(`.${alternate.className}{`)
  })

  test('matches explicitly named custom queries without rewriting source', () => {
    const wide = customMedia('(width >= 600px)', { id: 'wide' })
    const source = `import { css } from 'zyzz'; import { customMedia } from 'zyzz/web'; const wide = customMedia('(width >= 600px)', { id: 'wide' }); export const card = css({ [wide]: { color: 'red' } });`
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
    const source = `import { css, variable } from 'zyzz'; const accent = variable('color'); export const card = css({ color: accent });`

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
          'a.ts': `import { css } from 'zyzz'; export const a = css({ color: 'red' }, { id: 'same' });`,
          'b.ts': `import { css } from 'zyzz'; export const b = css({ color: 'blue' }, { id: 'same' });`,
        },
      }),
    ).toThrow()
    expect(() =>
      Transform.compile({
        compiler: false,
        moduleId: 'app.ts',
        source: `import { css } from 'zyzz'; export const bar = css((v: { width: number }) => ({ opacity: v.width }));`,
      }),
    ).toThrow('explicit id')
  })

  test('matches unchanged static definitions and variable assignments', () => {
    const accent = variable('color', { id: 'accent' })
    const card = css({
      color: accent,
      padding: '8px',
      ':hover': { opacity: 0.5 },
    })
    const source = `import { css, variable } from 'zyzz';
      const accent = variable('color', { id: 'accent' });
      export const card = css({ color: accent, padding: '8px', ':hover': { opacity: 0.5 } });`
    const output = Graph.compile({
      compiler: false,
      modules: { 'app/card.ts': source },
    }).modules['app/card.ts']!

    expect(output.code === source).toMatchInlineSnapshot('true')
    expect(output.css.includes(`.${card().className}{`)).toMatchInlineSnapshot(
      'true',
    )
    expect(card({ variables: accent.set('red') })).toMatchInlineSnapshot(`
      {
        "className": "z-content-1wyeijq1ll9w4",
        "style": {
          "--z-vid-61-63-63-65-6e-74": "red",
        },
      }
    `)
  })

  test('binds explicit dynamic identities and finite selections', () => {
    const bar = css(
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
    const source = `import { css, variants } from 'zyzz';
      export const bar = css((values: { width: \`\${number}px\` }) => ({ width: values.width }), { id: 'bar' });
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
      theme: { color: { primary: 'red' } },
    })
    const card = config.css({ color: 'primary' })
    const source = `import { Config } from 'zyzz';
      const { css, theme } = Config.create({ id: 'app', theme: { color: { primary: 'red' } } });
      export const card = css({ color: 'primary' });`
    const output = Graph.compile({
      compiler: false,
      modules: { 'app/theme.ts': source },
    })

    expect(
      output.modules['app/theme.ts']!.css.includes(card().className),
    ).toMatchInlineSnapshot('true')
    expect(
      output.modules['app/theme.ts']!.css.includes(config.theme.className),
    ).toMatchInlineSnapshot('true')
  })
})

describe('compile', () => {
  test.each(['atomic', 'grouped'] as const)(
    'renders %s applications with both compiler settings',
    async (cssOutput) => {
      const source = `import { Config, cx, variable } from 'zyzz';
      const { css, variants } = Config.create({ cssOutput: '${cssOutput}' });
      import { global, keyframes } from 'zyzz/web';
      global({ body: { margin: '0' } });
      const spin = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } }, { id: 'spin' });
      const accent = variable('color', { id: 'accent' });
      const { css: themed, theme } = Config.create({ cssOutput: '${cssOutput}', id: 'palette', theme: { color: { primary: 'red' } } });
      const parent = css({}, { id: 'parent' });
      const child = themed({ color: 'primary', selectors: { [\`\${parent} &\`]: { backgroundColor: 'blue' } } });
      const left = css({ paddingLeft: '8px', color: accent });
      const padding = css({ padding: '16px', animationName: spin });
      const button = variants({ variants: { size: { fluid: (values: { width: \`\${number}px\` }) => ({ width: values.width }), fixed: { width: '10px' } } }, conditions: { wide: '@media (min-width: 500px)' } }, { id: 'button' });
      export function render(enabled: boolean) {
        return { theme: { className: theme.className }, parent: parent(), child: child(), box: cx(left({ variables: accent.set('green') }), enabled && padding()), button: button({ size: { fluid: { width: '20px' } }, conditions: { wide: { size: { fluid: { width: '30px' } } } } }) };
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

test('reports located invalid ids and allows identity text in declaration values', () => {
  expect(() =>
    Transform.compile({
      moduleId: 'invalid.ts',
      source: "import {css} from 'zyzz'; css({color:'red'},{id:''})",
    }),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Source.ExtractError: invalid.ts:26: Definition options require one nonempty literal id.]`,
  )
  expect(
    Transform.compile({
      compiler: false,
      moduleId: 'content.ts',
      source: `import {css} from 'zyzz'; css({content:'"z-style-banner"'})`,
    }).css,
  ).toMatchInlineSnapshot(
    `".z-content-1iip0sa1qla8lk{content:"z-style-banner";}"`,
  )
})

test('composes html theme selections without source rewriting', () => {
  const config = Config.create({
    id: 'html',
    output: 'html',
    themes: {
      light: { color: { primary: 'red' } },
      dark: { color: { primary: 'blue' } },
    },
    defaultTheme: 'light',
  })
  expect(
    cx(config.themes({ theme: 'dark' }), config.css({ color: 'primary' })()),
  ).toMatchInlineSnapshot(`
    {
      "class": "z-compose-1wfpeq21v73xyw z_theme-id-68-74-6d-6c-dark",
    }
  `)
})

test('rejects conflicting explicit themes and named contributions across modules', () => {
  expect(() =>
    Graph.compile({
      compiler: false,
      modules: {
        'a.ts':
          "import {Theme} from 'zyzz'; const t=Theme.define({color:{primary:'red'}},{id:'same'}); export const card=t.css({color:'primary'})",
        'b.ts':
          "import {Theme} from 'zyzz'; const t=Theme.define({color:{primary:'blue'}},{id:'same'}); export const card=t.css({color:'primary'})",
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
