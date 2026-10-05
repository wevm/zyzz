/** Compiles and type-checks the core API reference examples through public compiler entrypoints. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { style, variable, variants } from 'zyzz'
import { Source } from 'zyzz/compiler'
import { Host } from 'zyzz/node'
import { Css } from 'zyzz/web'

const project = Path.resolve(import.meta.dirname, '../../../../../..')
const require = Module.createRequire(import.meta.url)
let root = ''

beforeAll(async () => {
  root = await Fs.mkdtemp(Path.join(project, '.fixture-core-api-'))
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

/** Compiles one module's definitions, including definitions it does not apply. */
function css(source: string) {
  const extracted = Source.extract({ moduleId: 'Example.tsx', source })
  return Css.compile({ styles: extracted.styles }).css
}

/** Builds one example directory through the filesystem compiler, with a config module when the example imports one. */
async function build(
  name: string,
  files: readonly { name?: string | undefined; source: string }[],
  native?: Host.create.Options['native'] | undefined,
) {
  const directory = Path.join(root, name)
  await Fs.mkdir(directory)
  for (const file of files)
    await Fs.writeFile(Path.join(directory, file.name!), file.source)
  if (files.some((file) => file.source.includes("'./zyzz.config.js'")))
    await Fs.writeFile(Path.join(directory, 'zyzz.config.ts'), config)

  await using host = await Host.create({
    ...(native ? { native } : {}),
    outDir: Path.join(directory, 'dist'),
    packageId: 'core-api',
    root: directory,
  })
  await host.build()

  return (file: string) =>
    Fs.readFile(Path.join(directory, 'dist', file), 'utf8')
}

/** Config module for examples that import helpers from `./zyzz.config.js`. */
const config = `import { defineConfig } from 'zyzz'

export const { style, vars } = defineConfig({
  vars: { color: { page: { light: '#ffffff', dark: '#000000' } } },
})
`

describe('style API page', () => {
  test('compiles the overview example', async () => {
    const [card] = await examples('style')

    expect(css(card!.source)).toMatchInlineSnapshot(`
      ".z-border-radius-8px{border-radius:8px;}
      .z-p-16px{padding:16px;}
      .z-font-size-\\5b 1\\2e 25rem\\5d {font-size:1.25rem;}
      .z-m-0{margin:0;}"
    `)
  })

  test('compiles declarations, conditions, and callbacks', async () => {
    const [declarations, conditions, callback] = await examples(
      'style',
      'styles',
    )

    expect(css(declarations!.source)).toMatchInlineSnapshot(`
      ".z-text-\\5b black\\21 important\\5d {color:black!important;}
      .z-display-\\5b block\\3b display\\3a grid\\5d {display:block;display:grid;}
      .z-p-16px{padding:16px;}"
    `)
    expect(css(conditions!.source)).toMatchInlineSnapshot(`
      ".z-3oDDjY-link-text-0{color:blue;}
      .z-3oDDjY-link-text-1{&:hover{color:navy;}}
      @media (width >= 48rem){.z-3oDDjY-link-font-size-2{font-size:1.125rem;}}"
    `)
    expect(css(callback!.source)).toMatchInlineSnapshot(`
      ".z-bg-green{background-color:green;}
      .z-w-\\5b var\\28 --z-3oDDjY-meter-amount\\29 \\5d {width:var(--z-3oDDjY-meter-amount);}"
    `)
  })

  test('compiles selectors that reference another definition', async () => {
    const [label] = await examples('style', 'styles.selectors')

    expect(css(label!.source)).toMatchInlineSnapshot(`
      ".z-3oDDjY-styles-label-text-0{color:gray;}
      .z-3oDDjY-styles-label-text-1{[data-state="open"] &{color:blue;}}
      .z-3oDDjY-styles-label-text-2{.z-style-3oDDjY-styles-card:hover &{color:black;}}"
    `)
  })

  test('compiles static variable assignments', async () => {
    const [button] = await examples('style', 'styles.vars')

    expect(css(button!.source)).toMatchInlineSnapshot(`
      ".z-3oDDjY-button-bg-0{background-color:var(--z-variables-accent);}
      .z-3oDDjY-button---z-variables-accent-1{--z-variables-accent:royalblue;}
      .z-3oDDjY-button---z-variables-accent-2{&:hover{--z-variables-accent:navy;}}"
    `)
  })

  test('compiles only the web target branch for web output', async () => {
    const [balance] = await examples('style', 'styles.targets')

    expect(css(balance!.source)).toMatchInlineSnapshot(`
      ".z-3oDDjY-balance-font-size-0{font-size:16px;}
      .z-3oDDjY-balance-font-variant-numeric-1{font-variant-numeric:tabular-nums;}"
    `)
  })

  test('applies an explicit identity without a compiler transform', () => {
    expect(style({}, { id: 'card' })()).toMatchInlineSnapshot(`
      {
        "className": "z-style-id-card",
      }
    `)
    expect(() => style()).toThrowErrorMatchingInlineSnapshot(
      `[Error: Empty style requires an explicit id without the compiler plugin.]`,
    )
  })

  test('compiles the types example', async () => {
    const [panel] = await examples('style', 'Types')

    expect(css(panel!.source)).toMatchInlineSnapshot(
      `".z-p-16px{padding:16px;}"`,
    )
  })

  test('builds the native example as a style table', async () => {
    const [profile] = await examples('style', 'React Native')
    const directory = Path.join(root, 'native')
    await Fs.mkdir(directory)
    await Fs.writeFile(Path.join(directory, profile!.name!), profile!.source)

    await using host = await Host.create({
      native: { colorScheme: 'light', platform: 'ios' },
      outDir: Path.join(directory, 'dist'),
      packageId: 'core-api',
      root: directory,
    })
    await host.build()

    const output = await Fs.readFile(
      Path.join(directory, 'dist/Profile.tsx'),
      'utf8',
    )
    expect(JSON.parse(output.match(/__zyzzNative\.create\((\{.*\})\)/)![1]!))
      .toMatchInlineSnapshot(`
      {
        "axes": {},
        "defaults": {},
        "styles": {
          "0": {
            "color": "#111111",
            "fontSize": 16,
          },
        },
      }
    `)
  })
})

describe('variants API page', () => {
  test('compiles the overview example', async () => {
    const [button] = await examples('variants')

    expect(css(button!.source)).toMatchInlineSnapshot(`
      ".z-3oDDjY-styles-button-border-radius-0{border-radius:6px;}
      .z-3oDDjY-styles-button-p-1{&:where([data-size="compact"]){padding:4px 8px;}}
      .z-3oDDjY-styles-button-p-2{&:where([data-size="regular"]){padding:8px 16px;}}"
    `)
  })

  test('compiles the base, choices, and dynamic choices', async () => {
    const [base] = await examples('variants', 'definition.base')
    const [boolean, dynamic] = await examples('variants', 'definition.variants')

    expect(css(base!.source)).toMatchInlineSnapshot(`
      ".z-3oDDjY-button-border-radius-0{border-radius:6px;}
      .z-3oDDjY-button-opacity-1{&:hover{opacity:0.9;}}
      .z-3oDDjY-button-p-2{&:where([data-size="compact"]){padding:4px;}}"
    `)
    expect(css(boolean!.source)).toMatchInlineSnapshot(`
      ".z-3oDDjY-button-opacity-0{&:where([data-loading="true"]){opacity:0.5;}}
      .z-3oDDjY-button-p-1{&:where([data-size="compact"]){padding:4px;}}
      .z-3oDDjY-button-p-2{&:where([data-size="regular"]){padding:8px;}}"
    `)
    expect(css(dynamic!.source)).toMatchInlineSnapshot(`
      ".z-3oDDjY-button-p-0{&:where([data-size="compact"]){padding:4px;}}
      .z-3oDDjY-button-p-1{&:where([data-size="custom"]){padding:var(--z-3oDDjY-button-1-1-0-padding);}}"
    `)
  })

  test('compiles compounds after every axis', async () => {
    const [compound] = await examples('variants', 'definition.compoundVariants')

    expect(css(compound!.source)).toMatchInlineSnapshot(`
      ".z-3oDDjY-button-opacity-0{&:where([data-loading="true"]){opacity:0.5;}}
      .z-3oDDjY-button-p-1{&:where([data-size="compact"]){padding:4px;}}
      .z-3oDDjY-button-p-2{&:where([data-size="regular"]){padding:8px;}}
      .z-3oDDjY-button-font-weight-3{&:where([data-loading="true"]):where([data-size="regular"]):where(*, .__zyzz-compound-0){font-weight:600;}}"
    `)
  })

  test('compiles named conditions', async () => {
    const [conditions] = await examples('variants', 'definition.conditions')

    expect(css(conditions!.source)).toMatchInlineSnapshot(`
      "@media not ((width>=48rem)){.z-3oDDjY-button-p-0{&:where([data-size="compact"]){padding:4px;}}}
      @media not ((width>=48rem)){.z-3oDDjY-button-p-1{&:where([data-size="regular"]){padding:8px;}}}
      @media (width >= 48rem){.z-3oDDjY-button-p-2{&:where([data-size="compact"]:not([data-zyzz-condition-0-size]),[data-zyzz-condition-0-size="scompact"]){padding:4px;}}}
      @media (width >= 48rem){.z-3oDDjY-button-p-3{&:where([data-size="regular"]:not([data-zyzz-condition-0-size]),[data-zyzz-condition-0-size="sregular"]){padding:8px;}}}"
    `)
  })

  test('selects choices without a compiler transform', () => {
    const button = variants(
      {
        conditions: { wide: '@media (width >= 48rem)' },
        // A dynamic choice infers its callback only when `variants` precedes `defaultVariants`.
        variants: {
          loading: { false: {}, true: { opacity: 0.5 } },
          size: {
            compact: { padding: '4px' },
            custom: (values: { padding: `${number}px` }) => ({
              padding: values.padding,
            }),
            regular: { padding: '8px' },
          },
        },
        defaultVariants: { size: 'regular' },
      },
      { id: 'button' },
    )

    expect(button()).toMatchInlineSnapshot(`
      {
        "className": "z-style-id-button",
        "data-size": "regular",
      }
    `)
    expect(button({ loading: false, size: null })).toMatchInlineSnapshot(`
      {
        "className": "z-style-id-button",
        "data-loading": "false",
      }
    `)
    expect(
      button({ conditions: { wide: { size: 'regular' } }, size: 'compact' }),
    ).toMatchInlineSnapshot(`
      {
        "className": "z-style-id-button",
        "data-size": "compact",
        "data-zyzz-condition-0-size": "sregular",
      }
    `)
    expect(button({ size: { custom: { padding: '16px' } } }))
      .toMatchInlineSnapshot(`
      {
        "className": "z-style-id-button",
        "data-size": "custom",
        "style": {
          "--z-button-2-1-0-padding": "16px",
        },
      }
    `)
    expect(() =>
      variants({ variants: { size: { compact: {} } } }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: variants requires an explicit id without the compiler plugin.]`,
    )
  })

  test('compiles the types example', async () => {
    const [button] = await examples('variants', 'Types')

    expect(css(button!.source)).toMatchInlineSnapshot(`
      ".z-3oDDjY-styles-button-p-0{&:where([data-size="compact"]){padding:4px;}}
      .z-3oDDjY-styles-button-p-1{&:where([data-size="regular"]){padding:8px;}}"
    `)
  })

  test('builds the native example as a selection table', async () => {
    const [badge] = await examples('variants', 'React Native')
    const read = await build('variants-native', [badge!], {
      colorScheme: 'light',
      platform: 'ios',
    })

    const output = await read('Badge.tsx')
    expect(
      JSON.parse(output.match(/__zyzzNativeStatic\.create\((\{.*\})\)/)![1]!),
    ).toMatchInlineSnapshot(`
      {
        "axes": {
          "tone": [
            "info",
            "warning",
          ],
        },
        "defaults": {},
        "rules": [
          {
            "matches": [
              [
                "tone",
                [
                  "info",
                ],
              ],
            ],
            "steps": [
              "0",
            ],
          },
          {
            "matches": [
              [
                "tone",
                [
                  "warning",
                ],
              ],
            ],
            "steps": [
              "1",
            ],
          },
        ],
        "styles": {
          "0": {
            "color": "#0070f3",
          },
          "1": {
            "color": "#f5a623",
          },
        },
      }
    `)
  })

  test('rejects named conditions in native builds', async () => {
    const [conditions] = await examples('variants', 'definition.conditions')

    await expect(
      build(
        'variants-native-conditions',
        [{ name: 'Button.ts', source: conditions!.source }],
        { colorScheme: 'light', platform: 'ios' },
      ),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Native.CompileError: Native source compilation does not support named conditions or HTML output.]`,
    )
  })
})

describe('cx API page', () => {
  test('compiles the overview example', async () => {
    const [tab] = await examples('cx')

    expect(css(tab!.source)).toMatchInlineSnapshot(`
      ".z-3oDDjY-styles-tab-text-0{color:gray;}
      .z-3oDDjY-styles-tab-p-1{padding:8px 12px;}
      .z-3oDDjY-styles-active-text-0{color:black;}
      .z-Tab-0-3oDDjY-styles-tab-3oDDjY-styles-active-0-text-0{color:gray;}
      .z-Tab-0-3oDDjY-styles-tab-3oDDjY-styles-active-0-p-1{padding:8px 12px;}
      .z-Tab-0-3oDDjY-styles-tab-3oDDjY-styles-active-text-0{color:gray;}
      .z-Tab-0-3oDDjY-styles-tab-3oDDjY-styles-active-p-1{padding:8px 12px;}
      .z-Tab-0-3oDDjY-styles-tab-3oDDjY-styles-active-text-2{color:black;}"
    `)
  })

  test('compiles ordered shorthand and longhand conflicts', async () => {
    const [applied] = await examples('cx', 'applied')

    expect(css(applied!.source)).toMatchInlineSnapshot(`
      ".z-3oDDjY-base-text-0{color:red;}
      .z-3oDDjY-base-p-1{padding:8px;}
      .z-3oDDjY-inset-text-0{color:blue;}
      .z-3oDDjY-inset-pl-1{padding-left:12px;}
      .z-props-0-3oDDjY-base-3oDDjY-inset-text-0{color:red;}
      .z-props-0-3oDDjY-base-3oDDjY-inset-p-1{padding:8px;}
      .z-props-0-3oDDjY-base-3oDDjY-inset-text-2{color:blue;}
      .z-props-0-3oDDjY-base-3oDDjY-inset-pl-3{padding-left:12px;}"
    `)
  })

  test('builds a variable scope beside applied styles', async () => {
    const [root] = await examples('cx', 'Variable Scopes')
    const read = await build('cx-scopes', [root!])

    expect(await read('Root.tsx.css')).toMatchInlineSnapshot(`
      ".z_scheme-dark {
        color-scheme: dark;
      }

      .z_scheme-light {
        color-scheme: light;
      }

      .z_scheme-light-dark {
        color-scheme: light dark;
      }

      .z-SlmzrP-styles-page-m-0, .z-Root-0-SlmzrP-styles-page-m-0 {
        margin: 0;
      }
      "
    `)
  })

  test('builds the native example', async () => {
    const [label] = await examples('cx', 'React Native')
    const read = await build('cx-native', [label!], {
      colorScheme: 'light',
      platform: 'ios',
    })

    const output = await read('Label.tsx')
    expect(output.match(/const cx=[^;]+;/)?.[0]).toMatchInlineSnapshot(
      `"const cx=__zyzzNative.compose;"`,
    )
    expect(
      Array.from(
        output.matchAll(/__zyzzNative\.create\((\{.*?\})\)/g),
        (match) => JSON.parse(match[1]!),
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "axes": {},
          "defaults": {},
          "styles": {
            "0": {
              "color": "#111111",
              "fontSize": 16,
            },
          },
        },
        {
          "axes": {},
          "defaults": {},
          "styles": {
            "0": {
              "color": "#2563eb",
            },
          },
        },
      ]
    `)
  })
})

describe('variable API page', () => {
  test('compiles the overview example', async () => {
    const [plan] = await examples('variable')

    expect(css(plan!.source)).toMatchInlineSnapshot(`
      ".z-text-\\5b var\\28 --z-variables-accent\\29 \\5d {color:var(--z-variables-accent);}
      .z-m-0{margin:0;}
      .z-3oDDjY-styles-plan-border-left-0{border-left:4px solid;}
      .z-3oDDjY-styles-plan-border-left-color-1{border-left-color:var(--z-variables-accent);}
      .z-\\5b --z-variables-accent\\3a \\23 0070f3\\5d {--z-variables-accent:#0070f3;}"
    `)
  })

  test('compiles a typed reference', async () => {
    const [grid] = await examples('variable', 'kind')

    expect(css(grid!.source)).toMatchInlineSnapshot(`
      ".z-display-grid{display:grid;}
      .z-gap-\\5b var\\28 --z-variables-gap\\29 \\5d {gap:var(--z-variables-gap);}"
    `)
  })

  test('registers typed variables with @property', async () => {
    const [inherits] = await examples('variable', 'options.inherits')
    const [initialValue] = await examples('variable', 'options.initialValue')
    const [syntax] = await examples('variable', 'options.syntax')
    const read = await build('variable-registration', [
      { name: 'gap.ts', source: inherits!.source },
      { name: 'accent.ts', source: initialValue!.source },
      { name: 'offset.ts', source: syntax!.source },
    ])

    expect(await read('zyzz.css')).toMatchInlineSnapshot(`
      "@property --z-accent {
        syntax: "<color>";
        inherits: true;
        initial-value: #0070f3;
      }

      @property --z-gap {
        syntax: "<length>";
        inherits: false;
        initial-value: 0;
      }

      @property --z-offset {
        syntax: "<length>";
        inherits: false;
        initial-value: 0;
      }



      "
    `)
  })

  test('names and assigns variables without a compiler transform', () => {
    const accent = variable('color', { id: 'acme-accent' })
    const gap = variable('length', { id: 'gap' })

    expect(String(accent)).toMatchInlineSnapshot(`"--z-acme_2d_accent"`)
    expect(gap.set('12px')).toMatchInlineSnapshot(`
      {
        "--z-gap": "12px",
      }
    `)
    expect(Object.isFrozen(gap.set('12px'))).toMatchInlineSnapshot(`true`)
    expect(() => variable('color')).toThrowErrorMatchingInlineSnapshot(
      `[Error: variable requires an explicit id without the compiler plugin.]`,
    )
  })

  test('rejects variables in native builds', async () => {
    const [plan] = await examples('variable')

    await expect(
      build('variable-native', [plan!], {
        colorScheme: 'light',
        platform: 'ios',
      }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Native.CompileError: Native static modules do not support CSS contributions, variables, or web set controls.]`,
    )
  })
})

describe('core API examples', () => {
  test('type-check against the published declarations', async () => {
    const pages = await Promise.all(
      ['style', 'variants', 'cx', 'variable'].map((page) => examples(page)),
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
          await Fs.writeFile(Path.join(directory, 'zyzz.config.ts'), config)
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
        '--target',
        'ESNext',
        ...files,
      ],
      { cwd: root, encoding: 'utf8', timeout: 30000 },
    )

    expect(files).toHaveLength(31)
    expect(checked.status, checked.stdout + checked.stderr).toBe(0)
  }, 60_000)
})
