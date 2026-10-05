/** Runs and type-checks the runtime API reference examples against the real runtime helpers. @module */
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Http from 'node:http'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import type { style, variable } from 'zyzz'
import {
  Appearance,
  Composition,
  CompositionHtml,
  ConditionalRecipe,
  Html,
  Native,
  NativeContext,
  NativeDynamic,
  NativeStatic,
  NativeVars,
  PayloadRecipe,
  Props,
  Recipe,
  Selection,
} from 'zyzz/runtime'

const project = Path.resolve(import.meta.dirname, '../../../../../..')
const require = Module.createRequire(import.meta.url)
let root = ''

beforeAll(async () => {
  root = await Fs.mkdtemp(Path.join(project, '.fixture-runtime-api-'))
  await Fs.mkdir(Path.join(root, 'node_modules'))
  await Fs.symlink(project, Path.join(root, 'node_modules/zyzz'), 'dir')
  for (const name of ['@types', 'react-native'])
    await Fs.symlink(
      Path.join(project, 'node_modules', name),
      Path.join(root, 'node_modules', name),
      'dir',
    )
})

afterAll(async () => {
  if (root) await Fs.rm(root, { force: true, recursive: true })
})

/** Reads a page's importing examples in order, optionally from one section. */
async function examples(page: string, heading?: string | undefined) {
  const document = await Fs.readFile(
    new URL(`./${page}.mdx`, import.meta.url),
    'utf8',
  )
  const section =
    heading === undefined
      ? document
      : document
          .split(/^#{2,3} /m)
          .find((entry) => entry.startsWith(`${heading}\n`))
  if (section === undefined)
    throw new Error(`${page} has no ${heading} section.`)

  return Array.from(
    section.matchAll(/```tsx?([^\n]*)\n([\s\S]*?)```/g),
    (match) => ({
      name: match[1]!.match(/title="([^"]+)"/)?.[1],
      source: match[2]!,
    }),
  ).filter((example) => example.source.includes('import '))
}

/** Imports a page's first example, exporting its module-level `const` declarations as the bindings `module` names. */
async function load<module>(page: string): Promise<module> {
  const [example] = await examples(page)
  const directory = await Fs.mkdtemp(Path.join(root, 'load-'))
  const file = Path.join(directory, example!.name!)
  await Fs.writeFile(
    file,
    example!.source.replace(/^const /gm, 'export const '),
  )

  return import(file)
}

describe('Props API page', () => {
  test('applies the overview example', async () => {
    const example = await load<{ card: style.ReturnType; props: style.Props }>(
      'namespaces/Props',
    )

    expect(example.props).toMatchInlineSnapshot(`
      {
        "className": "z-card wide",
        "style": {
          "padding": "24px",
        },
      }
    `)
    expect(example.card()).toMatchInlineSnapshot(`
      {
        "className": "z-card",
      }
    `)
    expect(example.card({ vars: { '--accent': 'crimson' } }))
      .toMatchInlineSnapshot(`
      {
        "className": "z-card",
        "style": {
          "--accent": "crimson",
        },
      }
    `)
  })

  test('returns the supplied style object without vars', () => {
    const card = Props.create({ className: 'z-card' })
    const style = { padding: '24px' }

    expect(card({ style }).style === style).toMatchInlineSnapshot(`true`)
  })
})

describe('Dynamic API page', () => {
  test('applies the overview example', async () => {
    const example = await load<{
      meter: style.Dynamic<{ amount: string }>
      props: style.Props
    }>('namespaces/Dynamic')

    expect(example.props).toMatchInlineSnapshot(`
      {
        "className": "z-meter",
        "style": {
          "--meter-amount": "50%",
        },
      }
    `)
    expect(example.meter({ amount: '' }).style).toMatchInlineSnapshot(`
      {
        "--meter-amount": " ",
      }
    `)
    expect(
      example.meter({
        amount: '50%',
        style: { '--meter-amount': '10%', opacity: 0.5 },
      }).style,
    ).toMatchInlineSnapshot(`
      {
        "--meter-amount": "50%",
        "opacity": 0.5,
      }
    `)
    expect(
      example.meter({ amount: '50%', className: 'wide' }).className,
    ).toMatchInlineSnapshot(`"z-meter wide"`)
  })
})

describe('Recipe API page', () => {
  test('applies the overview example', async () => {
    const example = await load<{
      button: ReturnType<typeof Recipe.create>
      props: unknown
    }>('namespaces/Recipe')

    expect(example.props).toMatchInlineSnapshot(`
      {
        "className": "z-button",
        "data-size": "large",
      }
    `)
    expect(example.button({ size: null })).toMatchInlineSnapshot(`
      {
        "className": "z-button",
      }
    `)
    expect(example.button({ style: { padding: '24px' } }).style)
      .toMatchInlineSnapshot(`
      {
        "padding": "24px",
      }
    `)
  })

  test('returns HTML attributes and boolean choices as strings', () => {
    expect(
      Recipe.create({
        axes: { size: ['small'] },
        className: 'z-button',
        defaults: { size: 'small' },
        html: true,
      })(),
    ).toMatchInlineSnapshot(`
      {
        "class": "z-button",
        "data-size": "small",
      }
    `)
    expect(
      Recipe.create({
        axes: { active: ['true', 'false'] },
        className: 'z-button',
        defaults: {},
      })({ active: true }),
    ).toMatchInlineSnapshot(`
      {
        "className": "z-button",
        "data-active": "true",
      }
    `)
  })
})

describe('ConditionalRecipe API page', () => {
  test('applies the overview example', async () => {
    const example = await load<{
      button: ReturnType<typeof ConditionalRecipe.create>
      props: unknown
    }>('namespaces/ConditionalRecipe')

    expect(example.props).toMatchInlineSnapshot(`
      {
        "className": "z-button",
        "data-size": "small",
        "data-zyzz-condition-0-size": "slarge",
      }
    `)
    expect(
      example.button({ size: 'large', conditions: { wide: { size: null } } }),
    ).toMatchInlineSnapshot(`
      {
        "className": "z-button",
        "data-size": "large",
        "data-zyzz-condition-0-size": "n",
      }
    `)
    expect(
      example.button({
        style: { padding: '24px' },
        vars: { '--accent': 'crimson' },
      }).style,
    ).toMatchInlineSnapshot(`
      {
        "--accent": "crimson",
        "padding": "24px",
      }
    `)
  })

  test('names conditional attributes by condition index', () => {
    expect(
      ConditionalRecipe.attribute({ axis: 'size', condition: 1 }),
    ).toMatchInlineSnapshot(`"data-zyzz-condition-1-size"`)
  })
})

describe('PayloadRecipe API page', () => {
  test('applies the overview example', async () => {
    const example = await load<{
      box: ReturnType<typeof PayloadRecipe.create>
      props: unknown
    }>('namespaces/PayloadRecipe')

    expect(example.props).toMatchInlineSnapshot(`
      {
        "className": "z-box",
        "data-size": "custom",
        "style": {
          "--box-padding": "12px",
        },
      }
    `)
    expect(example.box({ size: 'fixed' })).toMatchInlineSnapshot(`
      {
        "className": "z-box",
        "data-size": "fixed",
      }
    `)
  })

  test('binds default and conditional payload slots', () => {
    const definition = {
      axes: { size: ['custom', 'fixed'] },
      conditions: ['wide'],
      defaults: { size: 'custom' },
    }
    const box = PayloadRecipe.create({
      ...definition,
      defaultPayloads: { size: { padding: '4px' } },
      payloads: [
        {
          axis: 'size',
          choice: 'custom',
          slots: [{ padding: '--box-padding' }, { padding: '--box-wide' }],
        },
      ],
      select: ConditionalRecipe.create({ ...definition, className: 'z-box' }),
    })

    expect(box()).toMatchInlineSnapshot(`
      {
        "className": "z-box",
        "data-size": "custom",
        "style": {
          "--box-padding": "4px",
        },
      }
    `)
    expect(
      box({ conditions: { wide: { size: { custom: { padding: '20px' } } } } }),
    ).toMatchInlineSnapshot(`
      {
        "className": "z-box",
        "data-size": "custom",
        "data-zyzz-condition-0-size": "scustom",
        "style": {
          "--box-padding": "4px",
          "--box-wide": "20px",
        },
      }
    `)
  })
})

describe('Composition API page', () => {
  test('applies the overview example', async () => {
    const example = await load<{
      compose: ReturnType<typeof Composition.create>
      props: unknown
    }>('namespaces/Composition')

    expect(example.props).toMatchInlineSnapshot(`
      {
        "className": "z-card-button wide",
        "data-size": "large",
      }
    `)
    expect(
      example.compose(
        { className: 'z-card', style: { color: 'blue', padding: '8px' } },
        { className: 'z-button', style: { color: 'red' } },
      ).style,
    ).toMatchInlineSnapshot(`
      {
        "color": "red",
        "padding": "8px",
      }
    `)
  })
})

describe('Html API page', () => {
  test('renders the overview example', async () => {
    const example = await load<{ attributes: Html.Attributes; markup: string }>(
      'namespaces/Html',
    )

    expect(example.attributes).toMatchInlineSnapshot(`
      {
        "class": "z-card",
        "data-state": "open",
        "style": "background-color:red",
      }
    `)
    expect(example.markup).toMatchInlineSnapshot(
      `"<article class="z-card" style="background-color:red" data-state="open"></article>"`,
    )
  })

  test('converts and escapes attributes', () => {
    expect(
      Html.from({
        className: 'z-card',
        style: { color: 'red', msTransform: 'none', '--x': '1' },
      }).style,
    ).toMatchInlineSnapshot(`"color:red;-ms-transform:none;--x:1"`)
    expect(
      Html.serialize({ class: 'z-card wide', 'data-x': "it's" }),
    ).toMatchInlineSnapshot(`"class="z-card&#32;wide" data-x="it&#39;s""`)
    expect(Html.create({ className: 'z-card' })({ style: { padding: '1rem' } }))
      .toMatchInlineSnapshot(`
      {
        "class": "z-card",
        "style": "padding:1rem",
      }
    `)
  })
})

describe('CompositionHtml API page', () => {
  test('composes the overview example', async () => {
    const example = await load<{ attributes: Html.Attributes }>(
      'namespaces/CompositionHtml',
    )

    expect(example.attributes).toMatchInlineSnapshot(`
      {
        "class": "z-card-composed",
        "style": "padding:1rem",
      }
    `)
  })

  test('ignores attributes without retained props', () => {
    const compose = CompositionHtml.create({
      className: 'z-card-composed',
      inputs: [{ className: 'z-card', owners: [] }],
    })

    expect(
      Object.getOwnPropertySymbols(
        CompositionHtml.from({ className: 'z-card' }),
      ),
    ).toMatchInlineSnapshot(`
      [
        Symbol(zyzz.composition.input.v1),
      ]
    `)
    expect(compose(Html.from({ className: 'z-card' }))).toMatchInlineSnapshot(`
      {
        "class": "z-card-composed",
      }
    `)
  })
})

describe('Selection API page', () => {
  test('applies the overview example', async () => {
    const example = await load<{
      props: unknown
      vars: Selection.create.ReturnType<'base' | 'mint'>
    }>('namespaces/Selection')

    expect(example.props).toMatchInlineSnapshot(`
      {
        "className": "z-theme-mint z_scheme-dark",
        "style": {
          "colorScheme": "dark",
        },
      }
    `)
    expect(example.vars({ set: 'base' })).toMatchInlineSnapshot(`
      {
        "className": "z-theme-base",
      }
    `)
    expect(() =>
      example.vars({ set: 'missing' } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: Invalid variable selection.]`,
    )
  })

  test('returns HTML attributes and selects a default set', () => {
    const entries = [['base', 'z-theme-base']] as const

    expect(
      Selection.create(
        entries,
        true,
      )({
        set: 'base',
        colorScheme: 'light dark',
      }),
    ).toMatchInlineSnapshot(`
      {
        "class": "z-theme-base z_scheme-light-dark",
        "style": "color-scheme:light dark",
      }
    `)
    expect(
      Selection.create(entries, false, 'set', 'base')({ colorScheme: 'dark' }),
    ).toMatchInlineSnapshot(`
      {
        "className": "z-theme-base z_scheme-dark",
        "style": {
          "colorScheme": "dark",
        },
      }
    `)
  })
})

describe('Appearance API page', () => {
  test('restores and persists the root selection in Chromium', async () => {
    const [example] = await examples('namespaces/Appearance')
    const loaded = await load<{ script: () => string }>('namespaces/Appearance')
    const bundle = await Esbuild.build({
      stdin: { contents: example!.source, loader: 'ts', resolveDir: project },
      alias: { 'zyzz/runtime': Path.join(project, 'src/runtime/index.ts') },
      bundle: true,
      format: 'iife',
      globalName: 'Example',
      write: false,
    })
    const markup = `<!doctype html><html class="external z-theme-base"><head><script>${loaded.script()}</script><script>${bundle.outputFiles[0]!.text}</script></head><body></body></html>`
    const server = Http.createServer((_, response) => {
      response.setHeader('Content-Type', 'text/html')
      response.end(markup)
    })
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined

    try {
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      )
      browser = await chromium.launch({ headless: true })
      const page = await browser.newPage()
      await page.goto(
        `http://127.0.0.1:${(server.address() as { port: number }).port}/`,
      )

      expect(await page.evaluate('Example.appearance.get()'))
        .toMatchInlineSnapshot(`
        {
          "set": "base",
        }
      `)

      await page.evaluate(
        "Example.appearance.set({ colorScheme: 'dark', set: 'mint' })",
      )

      expect(
        await page.evaluate("localStorage.getItem('theme')"),
      ).toMatchInlineSnapshot(`"{"set":"mint","colorScheme":"dark"}"`)

      // The inline script restores the saved record on the next load.
      await page.reload()

      expect(
        await page.evaluate('document.documentElement.className'),
      ).toMatchInlineSnapshot(`"external z-theme-mint z_scheme-dark"`)
      expect(
        await page.evaluate(
          'getComputedStyle(document.documentElement).colorScheme',
        ),
      ).toMatchInlineSnapshot(`"dark"`)

      await page.evaluate('Example.appearance.set({ colorScheme: undefined })')
      await page.reload()

      expect(
        await page.evaluate('document.documentElement.className'),
      ).toMatchInlineSnapshot(`"external z-theme-mint"`)
      expect(
        await page.evaluate(
          "(() => { try { Example.appearance.set({ set: 'missing' }) } catch (error) { return String(error) } })()",
        ),
      ).toMatchInlineSnapshot(`"TypeError: Invalid set selection."`)
    } finally {
      await browser?.close()
      await new Promise((resolve) => server.close(resolve))
    }
  })

  test('requires a default set for a named catalog', () => {
    expect(() =>
      Appearance.root([['mint', 'z-theme-mint']]),
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: defaultVars must name a catalog set.]`,
    )
  })
})

describe('Variable API page', () => {
  test('creates the overview reference', async () => {
    const example = await load<{
      accent: variable.Reference<'color'>
      assignment: unknown
    }>('namespaces/Variable')

    expect(String(example.accent)).toMatchInlineSnapshot(`"--accent"`)
    expect(example.assignment).toMatchInlineSnapshot(`
      {
        "--accent": "crimson",
      }
    `)
    expect(Object.isFrozen(example.assignment)).toMatchInlineSnapshot(`true`)
    expect({ [example.accent]: 'red' }).toMatchInlineSnapshot(`
      {
        "--accent": "red",
      }
    `)
  })
})

describe('Native API page', () => {
  test('applies the overview example', async () => {
    const example = await load<{
      badge: Native.Callable<{ size: readonly ['small', 'large'] }>
      props: unknown
    }>('namespaces/Native')

    expect(example.props).toMatchInlineSnapshot(`
      {
        "style": {
          "padding": 8,
        },
      }
    `)
    expect(example.badge({ size: null })).toMatchInlineSnapshot(`
      {
        "style": {},
      }
    `)
    expect(example.badge({ style: { opacity: 0.5 } })).toMatchInlineSnapshot(`
      {
        "style": [
          {
            "padding": 4,
          },
          {
            "opacity": 0.5,
          },
        ],
      }
    `)
    expect(
      Native.compose(example.badge(), false, example.badge({ size: 'large' })),
    ).toMatchInlineSnapshot(`
      {
        "style": [
          {
            "padding": 4,
          },
          {
            "padding": 8,
          },
        ],
      }
    `)
    expect(() =>
      example.badge({ size: 'huge' } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Native.SelectionError: Unknown native recipe choice for size.]`,
    )
  })

  test('returns one frozen object for a table without axes', () => {
    const card = Native.create({
      axes: {},
      defaults: {},
      styles: { 0: { padding: 8 } },
    })

    expect(card() === card()).toMatchInlineSnapshot(`true`)
  })
})

describe('NativeStatic API page', () => {
  test('applies the overview example', async () => {
    const example = await load<{
      props: unknown
      text: Native.Callable<{ size: readonly ['small', 'large'] }>
    }>('namespaces/NativeStatic')

    expect(example.props).toMatchInlineSnapshot(`
      {
        "style": {
          "fontSize": 20,
          "lineHeight": 25,
        },
      }
    `)
    expect(example.text().style).toMatchInlineSnapshot(`
      {
        "fontSize": 16,
        "lineHeight": 20,
      }
    `)
    expect(example.text().style === example.text().style).toMatchInlineSnapshot(
      `true`,
    )
  })

  test('rejects a rule that names a missing fragment', () => {
    expect(() =>
      NativeStatic.create({
        axes: {},
        defaults: {},
        rules: [{ matches: [], steps: ['base'] }],
        styles: {},
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Native.SelectionError: Native binding program is missing a static style.]`,
    )
  })
})

describe('NativeDynamic API page', () => {
  test('applies the overview example', async () => {
    const example = await load<{
      meter: NativeDynamic.Callable<{ width: string }>
      props: unknown
    }>('namespaces/NativeDynamic')

    expect(example.props).toMatchInlineSnapshot(`
      {
        "style": {
          "width": 12,
        },
      }
    `)
    expect(example.meter({ width: '50%' })).toMatchInlineSnapshot(`
      {
        "style": {
          "width": "50%",
        },
      }
    `)
    expect(example.meter({ width: '12px', style: { opacity: 0.5 } }))
      .toMatchInlineSnapshot(`
      {
        "style": [
          {
            "width": 12,
          },
          {
            "opacity": 0.5,
          },
        ],
      }
    `)
    expect(() => example.meter({} as never)).toThrowErrorMatchingInlineSnapshot(
      `[Native.SelectionError: Missing or invalid native payload: width.]`,
    )
  })

  test('binds payloads and converts units', () => {
    const box = NativeDynamic.create({
      axes: { size: ['custom', 'fixed'] },
      defaults: {},
      payloads: [
        {
          axis: 'size',
          choice: 'custom',
          slots: [{ padding: '--box-padding' }],
        },
      ],
      program: {
        rules: [
          {
            matches: [['size', ['custom']]],
            steps: [
              { parts: [{ slot: '--box-padding' }], property: 'padding' },
            ],
          },
          { matches: [['size', ['fixed']]], steps: [{ style: 'fixed' }] },
        ],
        slots: {},
      },
      styles: { fixed: { padding: 0 } },
      units: { rem: 16 },
    })

    expect(box({ size: { custom: { padding: '1rem 12px' } } }))
      .toMatchInlineSnapshot(`
      {
        "style": {
          "paddingBottom": 16,
          "paddingLeft": 12,
          "paddingRight": 12,
          "paddingTop": 16,
        },
      }
    `)
    expect(box({ size: 'fixed' })).toMatchInlineSnapshot(`
      {
        "style": {
          "padding": 0,
        },
      }
    `)
  })
})

describe('NativeContext API page', () => {
  test('resolves the overview example', async () => {
    const example = await load<{ ink: Native.Callable<{}>; style: unknown }>(
      'namespaces/NativeContext',
    )

    expect(example.style).toMatchInlineSnapshot(`
      {
        "color": "#fafafa",
      }
    `)
    expect(example.ink() === example.ink()).toMatchInlineSnapshot(`true`)
    expect(
      NativeContext.resolve([example.ink().style, { opacity: 0.5 }], {
        colorScheme: 'dark',
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "color": "#fafafa",
        },
        {
          "opacity": 0.5,
        },
      ]
    `)
    expect(
      NativeContext.resolve(NativeContext.application(example.ink), {
        colorScheme: 'dark',
      }),
    ).toMatchInlineSnapshot(`
      {
        "color": "#fafafa",
      }
    `)
    expect(
      NativeContext.key(example.ink(), { colorScheme: 'dark' }).length,
    ).toMatchInlineSnapshot(`1`)
    expect(
      NativeContext.key({ color: 'red' }, { colorScheme: 'dark' }),
    ).toMatchInlineSnapshot(`[]`)
    expect(() =>
      NativeContext.resolve(example.ink().style, undefined),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Compiled native styles require a Zyzz Provider.]`,
    )
  })

  test('passes application input to the selected table', () => {
    const table = (padding: number) =>
      Native.create({
        axes: { size: ['small', 'large'] },
        defaults: { size: 'small' },
        styles: { 0: { padding }, 1: { padding: padding * 2 }, 2: {} },
      })
    const badge = NativeContext.create(
      { base: { dark: table(4), light: table(3) } },
      'base',
    )

    expect(
      NativeContext.resolve(badge, { colorScheme: 'dark' }, { size: 'large' }),
    ).toMatchInlineSnapshot(`
      {
        "padding": 8,
      }
    `)
    expect(
      NativeContext.resolve(
        NativeContext.application(badge, { size: 'large' }),
        { colorScheme: 'light' },
      ),
    ).toMatchInlineSnapshot(`
      {
        "padding": 6,
      }
    `)
  })

  test('selects media alternatives from the viewport', () => {
    const table = (padding: number) =>
      Native.create({ axes: {}, defaults: {}, styles: { 0: { padding } } })
    const box = NativeContext.responsive(
      [{ kind: 'compare', left: 'width', operator: '>=', right: 600 }],
      {
        0: NativeContext.create(
          { default: { dark: table(4), light: table(4) } },
          'default',
        ),
        1: NativeContext.create(
          { default: { dark: table(8), light: table(8) } },
          'default',
        ),
      },
    )

    expect(
      NativeContext.resolve(box().style, {
        colorScheme: 'light',
        viewport: { height: 844, width: 700 },
      }),
    ).toMatchInlineSnapshot(`
      {
        "padding": 8,
      }
    `)
    expect(() =>
      NativeContext.resolve(box().style, { colorScheme: 'light' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Native media queries require the native Provider window dimensions.]`,
    )
  })
})

describe('NativeVars API page', () => {
  test('reads the overview example', async () => {
    const example = await load<{ tokens: object; values: NativeVars.Tree }>(
      'namespaces/NativeVars',
    )

    expect(example.values).toMatchInlineSnapshot(`
      {
        "color": {
          "ink": "#fafafa",
        },
      }
    `)
    expect(Object.isFrozen(example.values.color)).toMatchInlineSnapshot(`true`)
    expect(() =>
      NativeVars.read({}, { colorScheme: 'dark' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: useVars requires variables compiled by the native adapter.]`,
    )
    expect(() =>
      NativeVars.read(example.tokens, { colorScheme: 'dark', set: 'mint' }),
    ).toThrowErrorMatchingInlineSnapshot(`[Error: Unknown native vars: mint.]`)
  })

  test('throws diagnostics when a leaf is read', () => {
    const light = {
      color: {
        faded: ['Composed values are not supported on native.'] as [string],
      },
    }
    const values = NativeVars.read(
      NativeVars.create({
        defaultVars: 'base',
        profiles: { base: { dark: light, light } },
        unnamed: false,
      }),
      { colorScheme: 'light' },
    )

    expect(
      () => (values.color as NativeVars.Tree).faded,
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Composed values are not supported on native.]`,
    )
  })
})

describe('runtime API examples', () => {
  test('type-check against the published declarations', async () => {
    const pages = await Promise.all(
      [
        'namespaces/Props',
        'namespaces/Dynamic',
        'namespaces/Recipe',
        'namespaces/ConditionalRecipe',
        'namespaces/PayloadRecipe',
        'namespaces/Composition',
        'namespaces/Html',
        'namespaces/CompositionHtml',
        'namespaces/Selection',
        'namespaces/Appearance',
        'namespaces/Variable',
        'namespaces/Native',
        'namespaces/NativeStatic',
        'namespaces/NativeDynamic',
        'namespaces/NativeContext',
        'namespaces/NativeVars',
      ].map((page) => examples(page)),
    )
    const files = await Promise.all(
      pages.flat().map(async (example, index) => {
        const directory = Path.join(root, 'types', String(index))
        const file = Path.join(directory, example.name!)
        await Fs.mkdir(directory, { recursive: true })
        await Fs.writeFile(file, example.source)
        return file
      }),
    )

    const checked = ChildProcess.spawnSync(
      process.execPath,
      [
        Path.join(
          Path.dirname(require.resolve('typescript/package.json')),
          'bin/tsc',
        ),
        '--ignoreConfig',
        '--noEmit',
        '--strict',
        '--exactOptionalPropertyTypes',
        '--noUncheckedIndexedAccess',
        '--skipLibCheck',
        '--jsx',
        'react-jsx',
        '--module',
        'preserve',
        '--moduleResolution',
        'bundler',
        // Native examples import `zyzz/react-native` as Metro resolves it.
        '--customConditions',
        'react-native',
        '--target',
        'ESNext',
        ...files,
      ],
      { cwd: root, encoding: 'utf8', timeout: 30000 },
    )

    expect(files.length).toMatchInlineSnapshot(`37`)
    expect(checked.stdout + checked.stderr).toMatchInlineSnapshot(`""`)
    expect(checked.status).toMatchInlineSnapshot(`0`)
  }, 60_000)
})
