/** Exercises the published plugin through real Oxlint and Vite Plus consumer processes. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Os from 'node:os'
import { afterEach, describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const require = Module.createRequire(import.meta.url)
const root = Path.resolve(import.meta.dirname, '../..')
const fixtures: string[] = []

afterEach(async () => {
  await Promise.all(
    fixtures
      .splice(0)
      .map((fixture) => Fs.rm(fixture, { force: true, recursive: true })),
  )
})

type Diagnostic = {
  code: string
  labels: { span: { column: number; line: number } }[]
  message: string
}

async function lint(
  source: string,
  rules: Record<string, unknown>,
  options: {
    readonly imports?: readonly string[]
    readonly runner?: 'oxlint' | 'vite-plus'
  } = {},
) {
  const fixture = await Fs.mkdtemp(Path.join(Os.tmpdir(), 'zyzz-oxlint-'))
  fixtures.push(fixture)
  await Fs.mkdir(Path.join(fixture, 'node_modules'))
  await Fs.symlink(root, Path.join(fixture, 'node_modules/zyzz'), 'dir')
  await Fs.symlink(
    Path.join(root, 'node_modules/vite-plus'),
    Path.join(fixture, 'node_modules/vite-plus'),
    'dir',
  )
  await Fs.writeFile(Path.join(fixture, 'package.json'), '{"type":"module"}')
  await Fs.writeFile(Path.join(fixture, 'source.tsx'), source)
  const config = {
    categories: { correctness: 'off' },
    jsPlugins: [{ name: 'zyzz', specifier: 'zyzz/oxlint' }],
    rules: Object.fromEntries(
      Object.entries(rules).map(([name, value]) => [`zyzz/${name}`, value]),
    ),
    settings: { zyzz: { imports: options.imports ?? [] } },
  }
  await Fs.writeFile(
    Path.join(fixture, '.oxlintrc.json'),
    JSON.stringify(config),
  )
  await Fs.writeFile(
    Path.join(fixture, 'vite.config.ts'),
    `export default ${JSON.stringify({ lint: config })}`,
  )
  const runner = options.runner ?? 'oxlint'
  const binary =
    runner === 'oxlint'
      ? Path.join(
          Path.dirname(require.resolve('oxlint/package.json')),
          'bin/oxlint',
        )
      : Path.join(root, 'node_modules/vite-plus/bin/vp')
  const result = ChildProcess.spawnSync(
    process.execPath,
    [
      binary,
      ...(runner === 'vite-plus' ? ['lint'] : ['-c', '.oxlintrc.json']),
      '--format',
      'json',
      'source.tsx',
    ],
    { cwd: fixture, encoding: 'utf8', timeout: 30_000 },
  )
  if (result.error) throw result.error
  if (result.status !== 0 && result.status !== 1)
    throw new Error(`${result.stdout}\n${result.stderr}`)
  let output: { diagnostics: Diagnostic[] }
  try {
    output = JSON.parse(result.stdout)
  } catch {
    throw new Error(`${result.stdout}\n${result.stderr}`)
  }
  return output.diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    column: diagnostic.labels[0]?.span.column,
    line: diagnostic.labels[0]?.span.line,
    message: diagnostic.message,
  }))
}

describe('zyzz/oxlint', () => {
  test('does not evaluate cyclic, reassigned, escaped, or mutated values', async () => {
    const source = `import { style as declared } from 'zyzz'
const cycle = [cycle]
const callback = () => callback
const fallbacks = []
fallbacks.push('flex')
const escaped = []
populate(escaped)
const object = { marginLeft: '1px' }
delete object.marginLeft
let style = declared
style = unrelated
style({ marginLeft: '1px' })
declared({ display: cycle, color: importedToken })
declared({ display: fallbacks })
declared({ display: escaped })
declared(object)
declared(callback)`
    expect(
      await lint(source, {
        'valid-styles': 'error',
        'use-logical-properties': 'error',
      }),
    ).toMatchInlineSnapshot(`[]`)
  })

  test('lints the existing React playground through published rules', async () => {
    const directory = Path.join(root, 'examples/vite-react/src')
    const files = (await Fs.readdir(directory)).filter((file) =>
      file.endsWith('.tsx'),
    )
    expect(files.length > 0).toMatchInlineSnapshot(`true`)
    for (const file of files)
      expect(
        await lint(await Fs.readFile(Path.join(directory, file), 'utf8'), {
          'no-conflicting-props': 'error',
          'no-unused': 'error',
          'valid-styles': 'error',
        }),
      ).toMatchInlineSnapshot(`[]`)
  })

  test('recognizes config filenames without registering import paths', async () => {
    for (const source of [
      './zyzz.config.ts',
      '../zyzz.config.mjs',
      '@/theme/zyzz.config.js',
      'zyzz.config.cts',
    ]) {
      expect(
        await lint(
          `import { style as css } from '${source}'
css({ marginLeft: '1px' })`,
          { 'use-logical-properties': 'error' },
        ),
      ).toMatchInlineSnapshot(`
        [
          {
            "code": "zyzz(use-logical-properties)",
            "column": 7,
            "line": 2,
            "message": "Use a CSS logical property instead of 'marginLeft', such as 'marginInlineStart' for horizontal LTR layouts.",
          },
        ]
      `)
    }
    expect(
      await lint(
        `import * as theme from '@/zyzz.config.ts'
const card = theme.style({ color: 'red' })
const element = <div {...card()} className="override" />`,
        { 'no-conflicting-props': 'error' },
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "zyzz(no-conflicting-props)",
          "column": 34,
          "line": 3,
          "message": "Pass 'className' into the Zyzz style call to merge styling props.",
        },
      ]
    `)
  })

  test('keeps explicit imports and excludes config lookalikes', async () => {
    const source = `import { style as custom } from '@/styles.js'
import { style as prefix } from '@/other-zyzz.config.ts'
import { style as directory } from '@/zyzz.config.ts/helpers.js'
import { style as suffix } from '@/zyzz.configured.ts'
custom({ left: '0px' })
prefix({ left: '0px' })
directory({ left: '0px' })
suffix({ left: '0px' })`
    expect(
      await lint(
        source,
        { 'use-logical-properties': 'error' },
        { imports: ['@/styles.js'] },
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "zyzz(use-logical-properties)",
          "column": 10,
          "line": 5,
          "message": "Use a CSS logical property instead of 'left', such as 'insetInlineStart' for horizontal LTR layouts.",
        },
      ]
    `)
  })

  test('tracks helpers, aliases, configuration modules, and lexical shadowing', async () => {
    const source = `import { style as s, variants, Config } from 'zyzz'
import * as z from 'zyzz'
import { style as configured } from '@/zyzz.config.js'
const { style: themed } = Config.create({})
const alias = s
const a = alias({ marginLeft: '1px' })
const b = z.style({ paddingRight: '2px' })
const c = configured({ borderLeft: 'none' })
const d = themed({ left: '0px' })
function unrelated(style: Function) { return style({ marginLeft: '1px' }) }
const e = variants({ base: { right: '0px' }, variants: { left: { true: { paddingLeft: '1px' } } }, defaultVariants: { left: true }, compoundVariants: [{ when: { left: true }, style: { marginRight: '1px' } }] })`
    expect(await lint(source, { 'use-logical-properties': 'error' }))
      .toMatchInlineSnapshot(`
      [
        {
          "code": "zyzz(use-logical-properties)",
          "column": 19,
          "line": 6,
          "message": "Use a CSS logical property instead of 'marginLeft', such as 'marginInlineStart' for horizontal LTR layouts.",
        },
        {
          "code": "zyzz(use-logical-properties)",
          "column": 21,
          "line": 7,
          "message": "Use a CSS logical property instead of 'paddingRight', such as 'paddingInlineEnd' for horizontal LTR layouts.",
        },
        {
          "code": "zyzz(use-logical-properties)",
          "column": 24,
          "line": 8,
          "message": "Use a CSS logical property instead of 'borderLeft', such as 'borderInlineStart' for horizontal LTR layouts.",
        },
        {
          "code": "zyzz(use-logical-properties)",
          "column": 20,
          "line": 9,
          "message": "Use a CSS logical property instead of 'left', such as 'insetInlineStart' for horizontal LTR layouts.",
        },
        {
          "code": "zyzz(use-logical-properties)",
          "column": 30,
          "line": 11,
          "message": "Use a CSS logical property instead of 'right', such as 'insetInlineEnd' for horizontal LTR layouts.",
        },
        {
          "code": "zyzz(use-logical-properties)",
          "column": 74,
          "line": 11,
          "message": "Use a CSS logical property instead of 'paddingLeft', such as 'paddingInlineStart' for horizontal LTR layouts.",
        },
        {
          "code": "zyzz(use-logical-properties)",
          "column": 185,
          "line": 11,
          "message": "Use a CSS logical property instead of 'marginRight', such as 'marginInlineEnd' for horizontal LTR layouts.",
        },
      ]
    `)
  })

  test('limits logical properties to declarations and honors suppressions', async () => {
    const source = `import { style } from 'zyzz'
const a = style({
  // allow-physical-property
  left: '0px',
  // oxlint-disable-next-line zyzz/use-logical-properties
  marginLeft: '1px',
  [unknown]: '1px',
  selectors: { '&:hover': { paddingRight: '2px' } },
  '@media (min-width: 1px)': { 'borderRightWidth': '1px' },
  targets: { ios: { marginLeft: 1 }, web: { scrollPaddingRight: '1px' } },
})
const b = style((input: { left: string }) => {
  inspect({ left: input.left })
  return { right: input.left }
})
function styleLike(value: unknown) { return value }
styleLike({ marginLeft: 1 })`
    expect(await lint(source, { 'use-logical-properties': 'error' }))
      .toMatchInlineSnapshot(`
      [
        {
          "code": "zyzz(use-logical-properties)",
          "column": 29,
          "line": 8,
          "message": "Use a CSS logical property instead of 'paddingRight', such as 'paddingInlineEnd' for horizontal LTR layouts.",
        },
        {
          "code": "zyzz(use-logical-properties)",
          "column": 32,
          "line": 9,
          "message": "Use a CSS logical property instead of 'borderRightWidth', such as 'borderInlineEndWidth' for horizontal LTR layouts.",
        },
        {
          "code": "zyzz(use-logical-properties)",
          "column": 45,
          "line": 10,
          "message": "Use a CSS logical property instead of 'scrollPaddingRight', such as 'scrollPaddingInlineEnd' for horizontal LTR layouts.",
        },
        {
          "code": "zyzz(use-logical-properties)",
          "column": 12,
          "line": 14,
          "message": "Use a CSS logical property instead of 'right', such as 'insetInlineEnd' for horizontal LTR layouts.",
        },
      ]
    `)
  })

  test('reports known invalid structure and markers without rejecting dynamic bindings', async () => {
    const source = `import { style } from 'zyzz'
import { style as themed } from 'zyzz/default'
const a = style({ display: [], color: 'red!important', margn: '1px', width: { x: 1 }, height: [,'1px'], opacity: true })
const b = style({ display: ['block', 'flex'], color: 'red !important', '--custom': 'anything' })
const c = style((value: { width: string }) => ({ width: value.width }))
const d = themed({ px: '2', color: 'accent', typography: 'body' })
const e = style({ color: importedToken })
const f = style({ get color() { throw new Error('must not execute') } })
const g = style(null)`
    expect(await lint(source, { 'valid-styles': 'error' }))
      .toMatchInlineSnapshot(`
      [
        {
          "code": "zyzz(valid-styles)",
          "column": 28,
          "line": 3,
          "message": "Fallback arrays must be nonempty.",
        },
        {
          "code": "zyzz(valid-styles)",
          "column": 39,
          "line": 3,
          "message": "Value markers require " !custom" followed by optional " !important", or " !important" alone.",
        },
        {
          "code": "zyzz(valid-styles)",
          "column": 56,
          "line": 3,
          "message": "Unknown CSS property 'margn'.",
        },
        {
          "code": "zyzz(valid-styles)",
          "column": 77,
          "line": 3,
          "message": "CSS declarations require scalar values or fallback arrays.",
        },
        {
          "code": "zyzz(valid-styles)",
          "column": 95,
          "line": 3,
          "message": "Fallback arrays require dense data entries without holes.",
        },
        {
          "code": "zyzz(valid-styles)",
          "column": 114,
          "line": 3,
          "message": "CSS declarations require string or number values.",
        },
        {
          "code": "zyzz(valid-styles)",
          "column": 19,
          "line": 8,
          "message": "Style objects require data properties, not methods or accessors.",
        },
        {
          "code": "zyzz(valid-styles)",
          "column": 17,
          "line": 9,
          "message": "Expected a style object.",
        },
      ]
    `)
  })

  test('accepts supported compiler input and preserves declaration ordering', async () => {
    const source = `import { style, variants } from 'zyzz'
namespace styles {
  export const card = style({ margin: '1px', marginLeft: '2px', display: ['block', 'flex'], ':hover': { color: 'red' } })
  export const button = variants({ base: { padding: '2px' }, variants: { size: { large: { padding: '4px' } } } })
}
export const props = styles.card()
export const button = styles.button({ size: 'large' })`
    const result = Transform.compile({ moduleId: 'fixture.tsx', source })
    expect(result.css.length > 0).toMatchInlineSnapshot(`true`)
    expect(
      await lint(source, {
        'valid-styles': 'error',
        'no-unused': 'error',
        'no-conflicting-props': 'error',
      }),
    ).toMatchInlineSnapshot(`[]`)
  })

  test('reports competing JSX props and style spreads', async () => {
    const source = `import { style, cx } from 'zyzz'
namespace styles {
  export const card = style({ color: 'red' })
  export const label = style({ color: 'blue' })
}
const direct = style({ color: 'red' })
const props = direct()
const a = <div {...styles.card()} className="external" />
const b = <div style={{ opacity: 0.5 }} {...direct()} />
const c = <div {...styles.card()} {...styles.label()} />
const d = <div {...props} className="external" />
const e = <div {...styles.card({ className: 'external', style: { opacity: 0.5 } })} />
const f = <div {...cx(styles.card(), styles.label())} />
function unrelated(direct: Function) { return <div {...direct()} className="ok" /> }`
    expect(await lint(source, { 'no-conflicting-props': 'error' }))
      .toMatchInlineSnapshot(`
      [
        {
          "code": "zyzz(no-conflicting-props)",
          "column": 35,
          "line": 8,
          "message": "Pass 'className' into the Zyzz style call to merge styling props.",
        },
        {
          "code": "zyzz(no-conflicting-props)",
          "column": 16,
          "line": 9,
          "message": "Pass 'style' into the Zyzz style call to merge styling props.",
        },
        {
          "code": "zyzz(no-conflicting-props)",
          "column": 35,
          "line": 10,
          "message": "Compose Zyzz applications with cx() instead of overwriting them with multiple JSX spreads.",
        },
        {
          "code": "zyzz(no-conflicting-props)",
          "column": 27,
          "line": 11,
          "message": "Pass 'className' into the Zyzz style call to merge styling props.",
        },
      ]
    `)
  })

  test('reports unused namespace members while preserving exports, escapes, and computed access', async () => {
    const source = `import { style } from 'zyzz'
namespace styles {
  export const card = style({ color: 'red' })
  export const label = style({ color: 'blue' })
}
styles.card()
export namespace shared { export const card = style({ color: 'red' }) }
namespace escaped { export const card = style({ color: 'red' }) }
consume(escaped)
namespace computed { export const card = style({ color: 'red' }) }
computed[key]()
namespace direct {
  export const card = style({ color: 'red' })
  export const props = card()
}
namespace shadowed { export const card = style({ color: 'red' }) }
function use(shadowed: { card: Function }) { shadowed.card() }`
    expect(await lint(source, { 'no-unused': 'error' })).toMatchInlineSnapshot(`
      [
        {
          "code": "zyzz(no-unused)",
          "column": 16,
          "line": 4,
          "message": "Style 'styles.label' is never used.",
        },
        {
          "code": "zyzz(no-unused)",
          "column": 35,
          "line": 16,
          "message": "Style 'shadowed.card' is never used.",
        },
      ]
    `)
  })

  test('enforces project property bans and literal allowlists', async () => {
    const source = `import { style } from 'zyzz'
const a = style({ zIndex: layer, color: '#ff0000', padding: ['4px', '7px'] })
const b = style({ color: theme.tokens.color.accent, padding: '4px' })
const c = style({ selectors: { '&:hover': { color: 'red' } } })`
    expect(
      await lint(source, {
        'restricted-properties': [
          'error',
          {
            color: { reason: 'Use color tokens.', values: [] },
            padding: {
              reason: 'Use the spacing scale.',
              values: ['0', '4px', '8px'],
            },
            zIndex: { reason: 'Use a stacking context.' },
          },
        ],
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "zyzz(restricted-properties)",
          "column": 19,
          "line": 2,
          "message": "Property 'zIndex' is restricted. Use a stacking context.",
        },
        {
          "code": "zyzz(restricted-properties)",
          "column": 34,
          "line": 2,
          "message": "Property 'color' is restricted. Use color tokens.",
        },
        {
          "code": "zyzz(restricted-properties)",
          "column": 52,
          "line": 2,
          "message": "Property 'padding' is restricted. Use the spacing scale.",
        },
        {
          "code": "zyzz(restricted-properties)",
          "column": 45,
          "line": 4,
          "message": "Property 'color' is restricted. Use color tokens.",
        },
      ]
    `)
  })

  test('loads the package entrypoint through Vite Plus', async () => {
    expect(
      await lint(
        `import { style } from 'zyzz'; style({ marginLeft: '1px' })`,
        { 'use-logical-properties': 'error' },
        { runner: 'vite-plus' },
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "code": "zyzz(use-logical-properties)",
          "column": 39,
          "line": 1,
          "message": "Use a CSS logical property instead of 'marginLeft', such as 'marginInlineStart' for horizontal LTR layouts.",
        },
      ]
    `)
  })
})
