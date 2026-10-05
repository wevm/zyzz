/** Compiles, runs, and type-checks the React Native API reference examples through public entrypoints. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { Graph, Source } from 'zyzz/compiler'
import { Host } from 'zyzz/node'
import { StyleSheet } from 'zyzz/react-native'
import {
  defineConfig,
  Provider,
  useVars,
  withStyles,
} from 'zyzz/react-native/react'

const project = Path.resolve(import.meta.dirname, '../../../../../..')
const require = Module.createRequire(import.meta.url)
let root = ''

beforeAll(async () => {
  root = await Fs.mkdtemp(Path.join(project, '.fixture-react-native-api-'))
  await Fs.mkdir(Path.join(root, 'node_modules'))
  await Fs.symlink(project, Path.join(root, 'node_modules/zyzz'), 'dir')
  for (const name of [
    '@types',
    'react',
    'react-native',
    'react-native-reanimated',
    'react-native-worklets',
  ])
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

/** Config module for examples that import helpers from `./zyzz.config.js`. */
const config = `import { defineConfig } from 'zyzz/react-native'

export const { Provider, style, variants, vars } = defineConfig({
  defaultVars: 'base',
  vars: {
    base: {
      color: { ink: { dark: '#eeeeee', light: '#111111' } },
      spacing: { gap: '8px' },
    },
    alternate: {
      color: { ink: { dark: '#ffcccc', light: '#990000' } },
      spacing: { gap: '12px' },
    },
  },
})
`

/** Fixture modules an example imports without providing them. */
function fixtures(
  files: readonly { name?: string | undefined; source: string }[],
) {
  const sources = files.map((file) => file.source).join('\n')
  return [
    ...(sources.includes("'./zyzz.config.js'") &&
    !files.some((file) => file.name === 'zyzz.config.ts')
      ? [{ name: 'zyzz.config.ts', source: config }]
      : []),
    ...(sources.includes("'./inputs.js'") &&
    !files.some((file) => file.name === 'inputs.ts')
      ? [{ name: 'inputs.ts', source: inputs }]
      : []),
  ]
}

/** Builds one example directory as Metro does, for the Provider's runtime selection. */
async function build(
  name: string,
  files: readonly { name?: string | undefined; source: string }[],
) {
  const directory = Path.join(root, name)
  await Fs.mkdir(directory)
  for (const file of [...files, ...fixtures(files)])
    await Fs.writeFile(Path.join(directory, file.name!), file.source)

  await using host = await Host.create({
    native: { colorScheme: 'light', contextual: true, platform: 'ios' },
    outDir: Path.join(directory, 'dist'),
    packageId: 'react-native-api',
    root: directory,
  })
  await host.build()

  return (file: string) =>
    Fs.readFile(Path.join(directory, 'dist', file), 'utf8')
}

/** Lists the compiled style tables of a built module, in emitted order. */
function tables(code: string) {
  return Array.from(
    code.matchAll(
      /__zyzzNative(?:Static)?\.create\((\{"axes".*?\})\) as import/g,
    ),
    (match) => (JSON.parse(match[1]!) as { styles: unknown }).styles,
  )
}

/** Reads the compiled native variable profiles of a built config module. */
function profiles(code: string) {
  const literal = code.match(
    /NativeVars\.create\(JSON\.parse\(("(?:\\.|[^"\\])*")\)\)/,
  )
  if (!literal) throw new Error('The module has no compiled variables.')
  return JSON.parse(JSON.parse(literal[1]!) as string) as {
    media?: { profiles: unknown }
    profiles: unknown
  }
}

/** Runs one example with Node against the built package and returns its output streams. */
async function run(name: string, source: string, print = '') {
  const directory = Path.join(root, name)
  await Fs.mkdir(directory)
  const files = [{ name: 'Example.ts', source }]
  for (const file of fixtures(files))
    await Fs.writeFile(Path.join(directory, file.name), file.source)
  // Node strips types without rewriting `.js` specifiers to their `.ts` sources.
  const runnable = source.replaceAll("'./inputs.js'", "'./inputs.ts'")
  await Fs.writeFile(
    Path.join(directory, 'Example.ts'),
    print ? `${runnable}\nconsole.log(JSON.stringify(${print}))\n` : runnable,
  )

  const result = ChildProcess.spawnSync(
    process.execPath,
    [Path.join(directory, 'Example.ts')],
    { cwd: directory, encoding: 'utf8', timeout: 30000 },
  )
  // An uncaught error prints its source line first, so report the error line.
  const lines = result.stderr.trim().split('\n')
  return {
    stderr: lines.find((line) => /^\S*Error\b.*: /.test(line)) ?? lines[0],
    stdout: result.stdout.trim() ? JSON.parse(result.stdout) : undefined,
  }
}

/** Exports a snippet's module-level `const` definitions, which the compiler emits only when exported or applied. */
function exported(source: string) {
  return source.replace(/^const /gm, 'export const ')
}

/** Inputs module for Host examples that import `./inputs.js`. */
const inputs = `import type { Host } from 'zyzz/react-native'

export const inputs = {
  colorScheme: 'light',
  density: 3,
  fontScale: 1,
  highContrast: false,
  platform: 'ios',
  reducedMotion: false,
  rtl: false,
  set: 'base',
} satisfies Host.create.Options
`

/** Renders an element on the server and returns the thrown message. */
function rendering(element: ReactNode) {
  try {
    renderToStaticMarkup(element)
    return undefined
  } catch (error) {
    return (error as Error).message
  }
}

describe('defineConfig API page', () => {
  test('selects each set and scheme from the overview config', async () => {
    const [configModule] = await examples('defineConfig')
    const read = await build('define-config', [
      configModule!,
      {
        name: 'Label.tsx',
        source: `import { Text } from 'react-native'
import { style } from './zyzz.config.js'

export const Label = () => <Text {...styles.label()} />

namespace styles {
  export const label = style({ color: 'ink' })
}
`,
      },
    ])

    expect(tables(await read('Label.tsx'))).toMatchInlineSnapshot(`
      [
        {
          "0": {
            "color": "#111111",
          },
        },
        {
          "0": {
            "color": "#eeeeee",
          },
        },
        {
          "0": {
            "color": "#990000",
          },
        },
        {
          "0": {
            "color": "#ffcccc",
          },
        },
      ]
    `)
  })

  test('rejects web compilation and CSS-only options', async () => {
    const [configModule] = await examples('defineConfig')

    expect(() =>
      Graph.compile({ modules: { 'zyzz.config.ts': configModule!.source } }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: zyzz.config.ts:181: Native defineConfig requires a native compilation target.]`,
    )
    expect(() =>
      Graph.compile({
        modules: {
          'zyzz.config.ts': `import { defineConfig } from 'zyzz/react-native'
export const { style } = defineConfig({ layers: ['components'], vars: { spacing: { gap: '8px' } } })`,
        },
        native: { colorScheme: 'light', contextual: true, platform: 'ios' },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Native.CompileError: Native static modules do not support CSS contributions, variables, or web set controls.]`,
    )
  })
})

describe('Provider API page', () => {
  test('compiles one table per window profile', async () => {
    const [panel] = await examples('Provider', 'Window Size')
    const read = await build('provider-window', [
      { name: 'Panel.ts', source: exported(panel!.source) },
    ])

    expect(tables(await read('Panel.ts'))).toMatchInlineSnapshot(`
      [
        {
          "0": {
            "flexDirection": "column",
          },
        },
        {
          "0": {
            "flexDirection": "row",
          },
        },
      ]
    `)
  })

  test('compiles the default selection example', async () => {
    const [screen] = await examples('Provider', 'Default Selection')
    const read = await build('provider-default', [screen!])

    expect(tables(await read('Screen.tsx'))).toMatchInlineSnapshot(`
      [
        {
          "0": {
            "backgroundColor": "#111111",
          },
        },
        {
          "0": {
            "backgroundColor": "#eeeeee",
          },
        },
        {
          "0": {
            "backgroundColor": "#990000",
          },
        },
        {
          "0": {
            "backgroundColor": "#ffcccc",
          },
        },
      ]
    `)
  })

  test('rejects unknown names, the set prop, and unresolved schemes', () => {
    const bound = defineConfig({
      defaultVars: 'base',
      id: 'provider-page',
      vars: { base: { spacing: { gap: '8px' } } },
    })

    expect(
      rendering(
        createElement(bound.Provider, {
          colorScheme: 'light',
          vars: 'missing' as never,
        }),
      ),
    ).toMatchInlineSnapshot(`"Unknown native vars: missing."`)
    expect(
      rendering(
        createElement(Provider, {
          colorScheme: 'light',
          set: 'base',
        } as never),
      ),
    ).toMatchInlineSnapshot(`"Provider uses vars instead of set."`)
    expect(
      rendering(createElement(Provider, { colorScheme: 'system' } as never)),
    ).toMatchInlineSnapshot(
      `"Native appearance requires a resolved light/dark scheme and a nonempty vars name."`,
    )
  })
})

describe('useStyles API page', () => {
  test('compiles the toast and banner styles', async () => {
    const [toast] = await examples('useStyles')
    const [banner] = await examples('useStyles', 'Default Selection')
    const read = await build('use-styles', [toast!, banner!])

    expect(tables(await read('Toast.tsx'))).toMatchInlineSnapshot(`
      [
        {
          "0": {
            "backgroundColor": "#111111",
            "paddingBottom": 8,
            "paddingLeft": 8,
            "paddingRight": 8,
            "paddingTop": 8,
          },
        },
        {
          "0": {
            "backgroundColor": "#eeeeee",
            "paddingBottom": 8,
            "paddingLeft": 8,
            "paddingRight": 8,
            "paddingTop": 8,
          },
        },
        {
          "0": {
            "backgroundColor": "#990000",
            "paddingBottom": 12,
            "paddingLeft": 12,
            "paddingRight": 12,
            "paddingTop": 12,
          },
        },
        {
          "0": {
            "backgroundColor": "#ffcccc",
            "paddingBottom": 12,
            "paddingLeft": 12,
            "paddingRight": 12,
            "paddingTop": 12,
          },
        },
        {
          "0": {
            "fontSize": 14,
            "fontWeight": 600,
          },
        },
      ]
    `)
    expect(tables(await read('Banner.tsx'))[0]).toMatchInlineSnapshot(`
      {
        "0": {
          "color": "#111111",
        },
      }
    `)
  })
})

describe('useVars API page', () => {
  test('compiles native values and responsive profiles', async () => {
    const [sheet] = await examples('useVars')
    const [gutter] = await examples('useVars', 'Responsive Values')
    const read = await build('use-vars', [sheet!, gutter!])

    expect(profiles(await read('zyzz.config.ts')).profiles)
      .toMatchInlineSnapshot(`
        {
          "alternate": {
            "dark": {
              "color": {
                "ink": "#ffcccc",
              },
              "spacing": {
                "gap": 12,
              },
            },
            "light": {
              "color": {
                "ink": "#990000",
              },
              "spacing": {
                "gap": 12,
              },
            },
          },
          "base": {
            "dark": {
              "color": {
                "ink": "#eeeeee",
              },
              "spacing": {
                "gap": 8,
              },
            },
            "light": {
              "color": {
                "ink": "#111111",
              },
              "spacing": {
                "gap": 8,
              },
            },
          },
        }
      `)
    expect(profiles(await read('Gutter.tsx')).media).toMatchInlineSnapshot(`
      {
        "profiles": {
          "0": {
            "default": {
              "dark": {
                "spacing": {
                  "gutter": 16,
                },
              },
              "light": {
                "spacing": {
                  "gutter": 16,
                },
              },
            },
          },
          "1": {
            "default": {
              "dark": {
                "spacing": {
                  "gutter": 24,
                },
              },
              "light": {
                "spacing": {
                  "gutter": 24,
                },
              },
            },
          },
        },
        "queries": [
          {
            "kind": "compare",
            "left": "width",
            "operator": ">=",
            "right": 768,
          },
        ],
      }
    `)
  })

  test('requires a Provider', () => {
    const variables = defineConfig({
      id: 'use-vars-page',
      vars: { spacing: { gap: '8px' } },
    }).vars
    function Reader() {
      return String(useVars(variables))
    }

    expect(rendering(createElement(Reader))).toMatchInlineSnapshot(
      `"useVars requires a Zyzz Provider."`,
    )
  })
})

describe('withStyles API page', () => {
  test('compiles wrapped and animated styles', async () => {
    const [screen] = await examples('withStyles')
    const [panel] = await examples('withStyles', 'Style Arrays')
    const read = await build('with-styles', [screen!, panel!])

    expect(tables(await read('Screen.tsx'))[0]).toMatchInlineSnapshot(`
      {
        "0": {
          "backgroundColor": "#111111",
          "flexGrow": 1,
        },
      }
    `)
    expect(tables(await read('Panel.tsx'))[0]).toMatchInlineSnapshot(`
      {
        "0": {
          "backgroundColor": "#111111",
        },
      }
    `)
  })

  test('rejects key and ref style props', () => {
    function Card(props: { readonly bodyStyle?: object | undefined }) {
      return String(props.bodyStyle)
    }

    expect(() =>
      withStyles(Card, { styleProps: ['ref' as never] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: withStyles requires style prop names excluding key and ref.]`,
    )
  })
})

describe('Reanimated API pages', () => {
  test('compiles the animated token and style examples', async () => {
    const [tile] = await examples('useAnimatedVars')
    const [button] = await examples('useAnimatedStyleValue')
    const read = await build('reanimated', [tile!, button!])

    // The compiler links the hook argument to the config's native profiles.
    expect(
      (await read('Tile.tsx')).match(/useAnimatedVars\(.*\)$/m)?.[0],
    ).toMatchInlineSnapshot(
      `"useAnimatedVars((__zyzzProfilegr2qzmleze7u as typeof vars), (values) => values.color.ink)"`,
    )
    expect(tables(await read('Button.tsx'))[0]).toMatchInlineSnapshot(`
      {
        "0": {
          "backgroundColor": "#e5e5e5",
        },
        "1": {
          "backgroundColor": "#2563eb",
        },
      }
    `)
  })
})

describe('StyleSheet API page', () => {
  test('compiles and selects the overview tables', async () => {
    const [overview] = await examples('namespaces/StyleSheet')

    expect(
      await run(
        'stylesheet',
        overview!.source,
        '{ output: output.styles, same: selected.text === output.styles.base.dark.text }',
      ),
    ).toMatchInlineSnapshot(`
      {
        "stderr": "",
        "stdout": {
          "output": {
            "base": {
              "dark": {
                "text": {
                  "color": "#ffffff",
                  "fontSize": 16,
                },
              },
              "light": {
                "text": {
                  "color": "#111111",
                  "fontSize": 16,
                },
              },
            },
          },
          "same": true,
        },
      }
    `)
  })

  test('composes, flattens, and fills', async () => {
    const [compose] = await examples(
      'namespaces/StyleSheet',
      'StyleSheet.compose',
    )
    const [flatten] = await examples(
      'namespaces/StyleSheet',
      'StyleSheet.flatten',
    )
    const [fill] = await examples(
      'namespaces/StyleSheet',
      'StyleSheet.absoluteFill',
    )

    expect(
      (
        await run(
          'stylesheet-compose',
          compose!.source.replace(
            'declare const active: boolean',
            'const active = true',
          ),
          'style',
        )
      ).stdout,
    ).toMatchInlineSnapshot(`
      [
        {
          "borderRadius": 8,
        },
        {
          "opacity": 0.5,
        },
      ]
    `)
    expect((await run('stylesheet-flatten', flatten!.source, 'style')).stdout)
      .toMatchInlineSnapshot(`
      {
        "borderRadius": 8,
        "opacity": 0.5,
      }
    `)
    expect((await run('stylesheet-fill', fill!.source, 'overlay')).stdout)
      .toMatchInlineSnapshot(`
      [
        {
          "bottom": 0,
          "left": 0,
          "position": "absolute",
          "right": 0,
          "top": 0,
        },
        {
          "top": 12,
        },
      ]
    `)
  })

  test('reports compile and selection errors', async () => {
    const [compile] = await examples(
      'namespaces/StyleSheet',
      'StyleSheet.CompileError',
    )
    const output = StyleSheet.compile({
      styles: Source.extract({
        moduleId: 'Text.ts',
        source: `import { style } from 'zyzz'\nexport const text = style({ opacity: 1 })`,
      }).styles,
    })

    expect(
      (await run('stylesheet-error', compile!.source)).stderr,
    ).toMatchInlineSnapshot(`"[ 'default', 'light', 'label', 'fontSize' ]"`)
    expect(() =>
      StyleSheet.select(output.styles, {
        colorScheme: 'light',
        set: 'base' as never,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.SelectionError: Select an existing set label and light or dark colorScheme.]`,
    )
  })
})

describe('Variants API page', () => {
  test('compiles every selection of the overview recipe', async () => {
    const [overview] = await examples('namespaces/Variants')

    expect((await run('variants', overview!.source, 'compiled')).stdout)
      .toMatchInlineSnapshot(`
        {
          "axes": {
            "tone": [
              "quiet",
              "loud",
            ],
          },
          "defaults": {
            "tone": "quiet",
          },
          "styles": {
            "default": {
              "dark": {
                "0": {
                  "opacity": 0.5,
                  "paddingBottom": 8,
                  "paddingLeft": 8,
                  "paddingRight": 8,
                  "paddingTop": 8,
                },
                "1": {
                  "opacity": 1,
                  "paddingBottom": 8,
                  "paddingLeft": 8,
                  "paddingRight": 8,
                  "paddingTop": 8,
                },
                "2": {
                  "paddingBottom": 8,
                  "paddingLeft": 8,
                  "paddingRight": 8,
                  "paddingTop": 8,
                },
              },
              "light": {
                "0": {
                  "opacity": 0.5,
                  "paddingBottom": 8,
                  "paddingLeft": 8,
                  "paddingRight": 8,
                  "paddingTop": 8,
                },
                "1": {
                  "opacity": 1,
                  "paddingBottom": 8,
                  "paddingLeft": 8,
                  "paddingRight": 8,
                  "paddingTop": 8,
                },
                "2": {
                  "paddingBottom": 8,
                  "paddingLeft": 8,
                  "paddingRight": 8,
                  "paddingTop": 8,
                },
              },
            },
          },
        }
      `)
  })

  test('rejects recipes past the limit and undeclared defaults', async () => {
    const [limit] = await examples('namespaces/Variants', 'Selection Limit')
    const [error] = await examples(
      'namespaces/Variants',
      'Variants.CompileError',
    )

    expect(
      (await run('variants-limit', limit!.source)).stderr,
    ).toMatchInlineSnapshot(
      `"CompileError [Variants.CompileError]: Native recipes support at most 256 selections, including null choices."`,
    )
    expect(
      (await run('variants-error', error!.source)).stderr,
    ).toMatchInlineSnapshot(
      `"Defaults must select a declared axis and choice."`,
    )
  })
})

describe('Host API page', () => {
  test('rebinds the overview callable after an update', async () => {
    const [attach] = await examples('namespaces/Host')
    const source = `${attach!.source}
import { defineVars } from 'zyzz'
import { Source } from 'zyzz/compiler'
import { Variants as Tables } from 'zyzz/react-native'
import { inputs } from './inputs.js'

const recipe = Source.extract({
  moduleId: 'card.ts',
  source: "import { defineVars, variants } from 'zyzz'\\nconst theme = defineVars({ color: { ink: { dark: '#eeeeee', light: '#111111' } } })\\nexport const card = variants({ variants: { tone: { quiet: { opacity: 0.5 }, loud: { color: theme.color.ink } } } })",
}).calls[0]!.staticRecipe!
// The extracted references keep their own pairs, so any set label selects them.
const attached = attach(Tables.compile({ recipe, vars: { base: defineVars({}) } }), inputs)
const light = attached.card({ tone: 'loud' })
attached.host.update({ colorScheme: 'dark' })
`

    expect(
      (
        await run(
          'host',
          source,
          '{ light, dark: attached.card({ tone: "loud" }), hairline: attached.host.getSnapshot().hairlineWidth }',
        )
      ).stdout,
    ).toMatchInlineSnapshot(`
      {
        "dark": {
          "style": {
            "color": "#eeeeee",
          },
        },
        "hairline": 0.3333333333333333,
        "light": {
          "style": {
            "color": "#111111",
          },
        },
      }
    `)
  })

  test('reports input and lifecycle errors', async () => {
    const [input] = await examples('namespaces/Host', 'Host.InputError')
    const [lifecycle] = await examples('namespaces/Host', 'Host.LifecycleError')

    expect(
      (await run('host-input', input!.source)).stderr,
    ).toMatchInlineSnapshot(
      `"Provide a set, resolved scheme, positive finite scales, and boolean accessibility inputs."`,
    )
    expect(
      (await run('host-lifecycle', lifecycle!.source)).stderr,
    ).toMatchInlineSnapshot(`"The native host is disposed."`)
  })
})

describe('Values API page', () => {
  test('compiles each section example for iOS', async () => {
    const pages = await examples('values')
    const compiled = pages.map((example) => {
      try {
        const styles = Source.extract({
          moduleId: 'Example.ts',
          source: exported(example.source),
        }).styles
        return StyleSheet.compile({
          platform: 'ios',
          styles,
          units: { rem: 16 },
        }).styles.default.light
      } catch (error) {
        return (error as Error).message
      }
    })

    expect(compiled).toMatchInlineSnapshot(`
      [
        {
          "style-5oy1mw1layq8a-50": {
            "color": "#11111180",
            "paddingBottom": 16,
            "paddingLeft": 16,
            "paddingRight": 16,
            "paddingTop": 16,
          },
        },
        {
          "style-5oy1mw1layq8a-53": {
            "bottom": 0,
            "left": 8,
            "position": "absolute",
            "right": 8,
            "top": 0,
          },
        },
        {
          "style-5oy1mw1layq8a-50": {
            "width": 20,
          },
        },
        {
          "style-5oy1mw1layq8a-51": {
            "backgroundColor": "#ff000080",
          },
        },
        {
          "style-5oy1mw1layq8a-50": {
            "flexBasis": 0,
            "flexGrow": 1,
            "flexShrink": 0,
          },
        },
        {
          "style-5oy1mw1layq8a-50": {
            "fontSize": 16,
            "lineHeight": 24,
          },
        },
        {
          "style-5oy1mw1layq8a-53": {
            "fontVariant": [
              "tabular-nums",
              "small-caps",
            ],
          },
        },
        {
          "style-5oy1mw1layq8a-51": {
            "transform": [
              {
                "translateX": 10,
              },
              {
                "rotate": "90deg",
              },
            ],
            "transformOrigin": [
              -20,
              "25%",
              -2,
            ],
          },
        },
        {
          "style-5oy1mw1layq8a-51": {
            "textShadowColor": "#0003",
            "textShadowOffset": {
              "height": 1,
              "width": 0,
            },
            "textShadowRadius": 2,
          },
        },
        {
          "style-5oy1mw1layq8a-51": {
            "fontFamily": "System",
            "fontSize": 16,
            "lineHeight": 24,
          },
        },
        "["default","light","style-5oy1mw1layq8a-52","position"]: Unsupported native keyword.
      ["default","dark","style-5oy1mw1layq8a-52","position"]: Unsupported native keyword.",
      ]
    `)
  })
})

describe('React Native API examples', () => {
  test('type-check against the published declarations', async () => {
    const pages = await Promise.all(
      [
        'defineConfig',
        'Provider',
        'useStyles',
        'useVars',
        'withStyles',
        'useAnimatedVars',
        'useAnimatedStyleValue',
        'namespaces/StyleSheet',
        'namespaces/Variants',
        'namespaces/Host',
        'values',
      ].map((page) => examples(page)),
    )
    const files = await Promise.all(
      pages
        .flat()
        // Twoslash blocks that declare expected errors are checked by the site build.
        .filter((example) => !example.source.includes('// @errors'))
        .map(async (example, index) => {
          const directory = Path.join(root, 'types', String(index))
          const file = Path.join(directory, example.name ?? 'Example.tsx')
          await Fs.mkdir(directory, { recursive: true })
          await Fs.writeFile(file, example.source)
          for (const fixture of fixtures([example]))
            await Fs.writeFile(
              Path.join(directory, fixture.name),
              fixture.source,
            )
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
        // Applications import `zyzz/react-native` as Metro resolves it.
        '--customConditions',
        'react-native',
        '--target',
        'ESNext',
        ...files,
      ],
      { cwd: root, encoding: 'utf8', timeout: 60000 },
    )

    expect(files).toHaveLength(46)
    expect(checked.status, checked.stdout + checked.stderr).toBe(0)
  }, 90_000)
})
