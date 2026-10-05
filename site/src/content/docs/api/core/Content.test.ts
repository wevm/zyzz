/** Compiles and type-checks the core API reference examples through public compiler entrypoints. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { style } from 'zyzz'
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

describe('core API examples', () => {
  test('type-check against the published declarations', async () => {
    const files = await Promise.all(
      (await examples('style'))
        // Twoslash blocks that declare expected errors are checked by the site build.
        .filter((example) => !example.source.includes('// @errors'))
        .map(async (example, index) => {
          const directory = Path.join(root, 'types', String(index))
          const file = Path.join(directory, example.name ?? 'Example.tsx')
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
        '--target',
        'ESNext',
        ...files,
      ],
      { cwd: root, encoding: 'utf8', timeout: 30000 },
    )

    expect(files).toHaveLength(10)
    expect(checked.status, checked.stdout + checked.stderr).toBe(0)
  }, 60_000)
})
