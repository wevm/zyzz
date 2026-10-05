/** Runs and type-checks the compiler API reference examples through public compiler entrypoints. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vite-plus/test'
import { defineVars, extendVars } from 'zyzz'
import { Graph, Native, Source, Transform } from 'zyzz/compiler'

const project = Path.resolve(import.meta.dirname, '../../../../../..')
const require = Module.createRequire(import.meta.url)
let root = ''
let count = 0

beforeAll(async () => {
  root = await Fs.mkdtemp(Path.join(project, '.fixture-compiler-api-'))
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

/** Reads a page's TypeScript examples in order, optionally from one section. */
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
  ).filter((example) => !example.source.includes('// @errors'))
}

/** Reads the first importing example of a page or one of its sections. */
async function example(page: string, heading?: string | undefined) {
  const found = (await examples(page, heading)).find((entry) =>
    entry.source.includes('import '),
  )
  if (!found) throw new Error(`${page} ${heading} has no importing example.`)

  return found.source
}

/** Reads the module text of each `'id': \`…\`` or `source: \`…\`` template in an example. */
function templates(code: string) {
  return Object.fromEntries(
    Array.from(
      code.matchAll(/(?:'([^']+)'|source): `([\s\S]*?)`/g),
      (match) => [match[1] ?? 'source', match[2]!],
    ),
  )
}

/** Exports module-level `const` bindings, leaving module text inside templates unchanged. */
function exported(code: string) {
  let template = false

  return code
    .split('\n')
    .map((line) => {
      const next =
        template || !line.startsWith('const ') ? line : `export ${line}`
      if ((line.replaceAll('\\`', '').match(/`/g)?.length ?? 0) % 2)
        template = !template
      return next
    })
    .join('\n')
}

/** Imports an example module with its module-level `const` bindings exported. */
async function run(code: string) {
  const file = Path.join(root, `example-${count++}.ts`)
  await Fs.writeFile(file, exported(code))

  return (await import(file)) as Record<string, any>
}

/** Writes compiled module code and imports it, so its callables run against `zyzz/runtime`. */
async function load(code: string) {
  const file = Path.join(root, `compiled-${count++}.ts`)
  await Fs.writeFile(file, code)

  return (await import(file)) as Record<string, any>
}

describe('Source API page', () => {
  test('extracts the overview example', async () => {
    const module = await run(await example('namespaces/Source'))

    expect(module.css).toMatchInlineSnapshot(`".z-p-1rem{padding:1rem;}"`)
    expect(module.output.styles.styles[0].declarations).toMatchInlineSnapshot(`
      [
        {
          "property": "padding",
          "value": "1rem",
        },
      ]
    `)
    expect(module.output.calls[0]).toMatchInlineSnapshot(`
      {
        "cssName": "FdvK6e-card",
        "cssNamespace": undefined,
        "end": 76,
        "identity": "z-style-FdvK6e-card",
        "name": "style-12aqmga1qxkrpc-50",
        "start": 50,
      }
    `)
    expect(module.output.themeCalls).toMatchInlineSnapshot(`[]`)
    expect(module.output.contributions).toMatchInlineSnapshot(`undefined`)
  })

  test('returns portable identities without rewriting', async () => {
    const { source } = templates(await example('namespaces/Source'))
    const output = Source.extract({
      compiler: false,
      moduleId: 'app/Card.tsx',
      source: source!,
    })

    expect(output.calls[0]?.portable).toMatchInlineSnapshot(
      `"z-content-_5b__5b__22_padding_22__2c__22_1rem_22__2c_false_5d__5d_"`,
    )
  })

  test('omits portable identities for dynamic styles and variants', () => {
    const output = Source.extract({
      compiler: false,
      moduleId: 'app/Card.tsx',
      source: `import { style, variants } from 'zyzz'
export const bar = style((values: { alpha: number }) => ({ opacity: values.alpha }))
export const button = variants({ variants: { tone: { loud: { opacity: 1 } } } })
`,
    })

    expect(output.calls.map((call) => call.portable)).toMatchInlineSnapshot(`
      [
        undefined,
        undefined,
      ]
    `)
  })

  test('compiles extracted variable sets', async () => {
    const module = await run(await example('namespaces/Source', 'vars'))

    expect(module.result.css).toMatchInlineSnapshot(`
      ".z-theme-theme{--z-color-brand:#06c;}
      .z-text-\\5b var\\28 --z-color-brand\\2c \\23 06c\\29 \\5d {color:var(--z-color-brand,#06c);}"
    `)
    expect(module.result.vars).toMatchInlineSnapshot(`
      {
        "src-Card-8E7ByFdvK6e-style-theme": "z-theme-theme",
      }
    `)
    expect(module.output.themeCalls).toHaveLength(1)
  })

  test('returns contributions and variable calls', () => {
    const output = Source.extract({
      moduleId: 'app/theme.ts',
      source: `import { variable } from 'zyzz'
import { global } from 'zyzz/web'

export const accent = variable('color')

global({ body: { margin: 0 } })
`,
    })

    expect(output.contributions).toMatchInlineSnapshot(`
      [
        {
          "kind": "rule",
          "selector": "body",
          "style": {
            "declarations": [
              {
                "property": "margin",
                "value": 0,
              },
            ],
            "name": "contribution",
          },
        },
      ]
    `)
    expect(output.variableCalls?.[0]?.slots).toMatchInlineSnapshot(`
      {
        "value": {
          "name": "--z-accent",
          "type": "color",
          "variable": true,
        },
      }
    `)
  })

  test('resolves static input', async () => {
    const source = await example('namespaces/Source', 'Static Input')
    const output = Source.extract({ moduleId: 'app/Card.tsx', source })

    expect(output.styles.styles[0]?.declarations).toMatchInlineSnapshot(`
      [
        {
          "property": "display",
          "value": "block",
        },
        {
          "property": "display",
          "value": "grid",
        },
        {
          "property": "padding",
          "value": "8px",
        },
        {
          "important": true,
          "property": "color",
          "value": "red",
        },
      ]
    `)
  })

  test('rejects exported configs without a graph', () => {
    expect(() =>
      Source.extract({
        moduleId: 'app/zyzz.config.ts',
        source: `import { defineConfig } from 'zyzz'
export const { style } = defineConfig({ vars: { color: { brand: '#06c' } } })
`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app/zyzz.config.ts:49: Define local themes with a module-level const; exported themes require source linking.]`,
    )
  })

  test('throws the documented error', async () => {
    const { source } = templates(
      await example('namespaces/Source', 'Source.ExtractError'),
    )

    expect(() =>
      Source.extract({ moduleId: 'app/Card.tsx', source: source! }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app/Card.tsx:66: Expected a literal string or number; expressions are not evaluated.]`,
    )
  })
})

describe('Transform API page', () => {
  test('compiles the overview example', async () => {
    const module = await run(await example('namespaces/Transform'))

    expect(module.output.code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';


      export const card = __zyzzProps.create({className:"z-p-1rem z-style-FdvK6e-card"})
      "
    `)
    expect(module.output.css).toMatchInlineSnapshot(
      `".z-p-1rem{padding:1rem;}"`,
    )
    expect(module.output.classes).toMatchInlineSnapshot(`
      {
        "style-12aqmga1qxkrpc-50": "z-p-1rem z-style-FdvK6e-card",
      }
    `)
    expect(module.output.vars).toMatchInlineSnapshot(`{}`)
    expect(module.output.map.sources).toMatchInlineSnapshot(`
      [
        "app/Card.tsx",
      ]
    `)
    expect(module.output.cssMap.sources).toMatchInlineSnapshot(`
      [
        "app/Card.tsx",
      ]
    `)
  })

  test('applies the documented options', async () => {
    const { source } = templates(await example('namespaces/Transform'))

    expect(
      Transform.compile({
        compiler: false,
        moduleId: 'app/Card.tsx',
        source: source!,
      }).code,
    ).toBe(source)
    expect(
      Transform.compile({
        cssOutput: 'grouped',
        moduleId: 'app/Card.tsx',
        source: source!,
      }).css,
    ).toMatchInlineSnapshot(`".z-FdvK6e-card{padding:1rem;}"`)
    expect(
      Transform.compile({
        moduleId: 'app/Card.tsx',
        schemes: true,
        source: source!,
      }).css,
    ).toMatchInlineSnapshot(`
      ".z_scheme-dark{color-scheme:dark;}
      .z_scheme-light{color-scheme:light;}
      .z_scheme-light-dark{color-scheme:light dark;}
      .z-p-1rem{padding:1rem;}"
    `)
  })

  test('keeps unreached definitions in development', () => {
    const source = `import { style } from 'zyzz'

const unused = style({ color: 'red' })

export const card = style({ padding: '1rem' })
`

    expect(
      Transform.compile({ moduleId: 'app/Card.tsx', source }).css,
    ).toMatchInlineSnapshot(`".z-p-1rem{padding:1rem;}"`)
    expect(
      Transform.compile({ development: true, moduleId: 'app/Card.tsx', source })
        .css,
    ).toMatchInlineSnapshot(`
      ".z-text-red{color:red;}
      .z-p-1rem{padding:1rem;}"
    `)
  })

  test('reuses rules with independent composition', async () => {
    const module = await run(
      await example('namespaces/Transform', 'options.composition'),
    )
    const { source } = templates(
      await example('namespaces/Transform', 'options.composition'),
    )

    expect(module.output.classes).toMatchInlineSnapshot(`
      {
        "style-1ykuc7f14p42q1-132": "z-JJZ3wD-a-text-0 z-style-JJZ3wD-c",
        "style-1ykuc7f14p42q1-47": "z-JJZ3wD-a-text-0 z-style-JJZ3wD-a",
        "style-1ykuc7f14p42q1-89": "z-JJZ3wD-b-text-0 z-style-JJZ3wD-b",
      }
    `)
    expect(Transform.compile({ moduleId: 'app/Text.tsx', source: source! }).css)
      .toMatchInlineSnapshot(`
      ".z-JJZ3wD-a-text-0{color:red;}
      .z-JJZ3wD-b-text-0{color:blue;}
      .z-JJZ3wD-c-text-0{color:red;}"
    `)
  })

  test('returns scope classes for local variable sets', async () => {
    const { source } = templates(await example('namespaces/Source', 'vars'))

    expect(
      Transform.compile({ moduleId: 'app/Card.tsx', source: source! }).vars,
    ).toMatchInlineSnapshot(`
      {
        "src-Card-8E7ByFdvK6e-style-theme": "z-theme-theme",
      }
    `)
  })

  test('throws the documented error', async () => {
    const { source } = templates(
      await example('namespaces/Transform', 'Errors'),
    )

    expect(() =>
      Transform.compile({
        cssOutput: 'nested' as never,
        moduleId: 'app/Card.tsx',
        source: source!,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Css.CompileError: ["cssOutput"]: cssOutput must be atomic or grouped.]`,
    )
  })
})

describe('Graph API page', () => {
  test('links the overview example', async () => {
    const module = await run(await example('namespaces/Graph'))

    expect(module.output.dependencies).toMatchInlineSnapshot(`
      {
        "app/Card.tsx": [
          "app/zyzz.config.ts",
        ],
        "app/zyzz.config.ts": [],
      }
    `)
    expect(module.output.modules['app/Card.tsx'].code).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';
      import { style } from './zyzz.config.js'

      export const card = __zyzzProps.create({className:"z-text-[var(--z-color-brand,#06c)] z-style-FdvK6e-card"})
      "
    `)
    expect(module.output.modules['app/Card.tsx'].css).toMatchInlineSnapshot(`
      ".z-theme-theme{--z-color-brand:#06c;}
      .z_scheme-dark{color-scheme:dark;}
      .z_scheme-light{color-scheme:light;}
      .z_scheme-light-dark{color-scheme:light dark;}
      .z-text-\\5b var\\28 --z-color-brand\\2c \\23 06c\\29 \\5d {color:var(--z-color-brand,#06c);}"
    `)
    expect(module.output.sharedCss).toMatchInlineSnapshot(`undefined`)
  })

  test('consumes a library contract', async () => {
    const { library } = await run(
      await example('namespaces/Graph', 'Library Contracts'),
    )
    const modules = templates(
      await example('namespaces/Graph', 'options.contracts'),
    )
    const output = Graph.compile({
      contracts: {
        'library/index.js': library.contracts['library/index.ts'],
      },
      imports: { 'app/Card.tsx': { '@acme/theme': 'library/index.js' } },
      modules: { 'app/Card.tsx': modules['app/Card.tsx']! },
    })

    expect(Object.keys(library.contracts)).toMatchInlineSnapshot(`
      [
        "library/index.ts",
      ]
    `)
    expect(output.dependencies).toMatchInlineSnapshot(`
      {
        "app/Card.tsx": [
          "library/index.js",
        ],
      }
    `)
    expect(output.modules['app/Card.tsx']?.css).toMatchInlineSnapshot(`
      ".z-theme-theme{--z-color-brand:#06c;}
      .z-text-\\5b var\\28 --z-color-brand\\2c \\23 06c\\29 \\5d {color:var(--z-color-brand,#06c);}"
    `)
  })

  test('emits contracts only for modules with compiler exports', () => {
    const output = Graph.compile({
      modules: {
        'app/constants.ts': `export const size = 1
`,
      },
    })

    expect(output.contracts).toMatchInlineSnapshot(`{}`)
  })

  test('requires host resolution for every import', () => {
    expect(() =>
      Graph.compile({
        imports: { 'app/Card.tsx': {} },
        modules: {
          'app/Card.tsx': `import { style } from 'zyzz'
export const card = style({ color: 'red' })
`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app/Card.tsx:0: Missing host resolution: zyzz]`,
    )
  })

  test('resolves index files and extensionless paths', () => {
    const output = Graph.compile({
      modules: {
        'app/card/index.ts': `import { style } from 'zyzz'
export const card = style({ color: 'red' })
`,
        'app/index.ts': `export { card } from './card'
`,
      },
    })

    expect(output.dependencies).toMatchInlineSnapshot(`
      {
        "app/card/index.ts": [],
        "app/index.ts": [
          "app/card/index.ts",
        ],
      }
    `)
  })

  test('returns shared CSS, the reset, and assets', () => {
    const output = Graph.compile({
      modules: {
        'app/fonts.ts': `import { fontFace, global } from 'zyzz/web'

fontFace({ fontFamily: 'Geist', src: "url('./Geist.woff2') format('woff2')" })

global({ body: { margin: 0 } })
`,
      },
      reset: '@layer reset { * { margin: 0 } }',
    })

    expect(output.sharedCss).toMatchInlineSnapshot(`
      "@layer reset;
      @font-face {
        font-family: Geist;
        src: url("zyzz-asset:app%2FGeist.woff2") format("woff2");
      }
      body{margin:0;}
      @layer reset { * { margin: 0 } }"
    `)
    expect(output.sharedCssMap?.sources).toMatchInlineSnapshot(`
      [
        "app/fonts.ts",
        "zyzz/reset.css",
      ]
    `)
    expect(output.sharedAssets).toMatchInlineSnapshot(`
      {
        "zyzz-asset:app%2FGeist.woff2": "app/Geist.woff2",
      }
    `)
    expect(output.sharedAssetOwners).toMatchInlineSnapshot(`
      {
        "zyzz-asset:app%2FGeist.woff2": "app/fonts.ts",
      }
    `)
    expect(output.modules['app/fonts.ts']?.css).toMatchInlineSnapshot(`""`)
  })

  test('reuses unaffected results across snapshots', async () => {
    const modules = templates(await example('namespaces/Graph'))
    const compiler = Graph.create()
    const first = compiler.compile({ modules })

    expect(compiler.compile({ modules }) === first).toMatchInlineSnapshot(
      `true`,
    )

    const edited = {
      ...modules,
      'app/Card.tsx': modules['app/Card.tsx']!.replace(
        "'brand'",
        "'red !custom'",
      ),
    }
    const next = compiler.compile({ modules: edited })

    expect(
      next.modules['app/zyzz.config.ts'] ===
        first.modules['app/zyzz.config.ts'],
    ).toMatchInlineSnapshot(`true`)
    expect(next.modules['app/Card.tsx']?.css).toMatchInlineSnapshot(`
      ".z_scheme-dark{color-scheme:dark;}
      .z_scheme-light{color-scheme:light;}
      .z_scheme-light-dark{color-scheme:light dark;}
      .z-text-red{color:red;}"
    `)
    expect(() =>
      compiler.compile({
        modules: { ...modules, 'app/Card.tsx': 'export const = 1' },
      }),
    ).toThrow(Source.ExtractError)
    // The failed snapshot leaves the last successful one in place.
    expect(
      compiler.compile({ modules: edited }) === next,
    ).toMatchInlineSnapshot(`true`)
  })

  test('rejects circular imports and invalid contracts', () => {
    expect(() =>
      Graph.compile({
        modules: {
          'a.ts': `import { b } from './b.js'
export const a = b
`,
          'b.ts': `import { a } from './a.js'
export const b = a
`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: a.ts:0: Circular source dependencies are not supported yet.]`,
    )
    expect(() =>
      Graph.compile({
        contracts: { 'library/index.js': '{"version":999}' },
        imports: { 'app/Card.tsx': { library: 'library/index.js' } },
        modules: {
          'app/Card.tsx': `import { style } from 'library'
export const card = style({ color: 'brand' })
`,
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: library/index.js:0: Invalid library contract: Unsupported Zyzz contract version.]`,
    )
  })

  test('throws the documented error', async () => {
    const modules = templates(await example('namespaces/Graph', 'Errors'))

    expect(() => Graph.compile({ modules })).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app/Card.tsx:0: Missing source module: ./missing.js]`,
    )
  })
})

describe('Native API page', () => {
  test('compiles the overview example', async () => {
    const module = await run(await example('namespaces/Native'))

    expect(module.output.code).toMatchInlineSnapshot(`
      "
      import {Native as __zyzzNative,NativeStatic as __zyzzNativeStatic} from 'zyzz/runtime';




      import { variants } from 'zyzz'

      export const button = (__zyzzNativeStatic.create({"axes":{"tone":["quiet","loud"]},"defaults":{"tone":"quiet"},"rules":[{"matches":[],"steps":["0"]},{"matches":[["tone",["quiet"]]],"steps":["1"]},{"matches":[["tone",["loud"]]],"steps":["2"]}],"styles":{"0":{"paddingTop":8},"1":{"opacity":0.5},"2":{"opacity":1}}}) as import('zyzz/runtime').Native.Callable<{"tone":readonly ["quiet","loud"]}>)
      "
    `)
    expect(module.output.recipes).toMatchInlineSnapshot(`{}`)
    expect(JSON.parse(module.output.map).sources).toMatchInlineSnapshot(`
      [
        "app/Button.tsx",
      ]
    `)
  })

  test('applies the documented options', () => {
    const label = `import { defineConfig } from 'zyzz'

const { style } = defineConfig({
  vars: { color: { ink: { light: '#171717', dark: '#fafafa' } } },
})

export const label = style({ color: 'ink', fontFamily: 'Geist', padding: '1rem' })
`
    const fixed = Native.compile({
      colorScheme: 'dark',
      fonts: { Geist: 'Geist-Regular' },
      moduleId: 'app/Label.tsx',
      source: label,
      units: { rem: 16 },
    })

    expect(fixed.code.includes('"color":"#fafafa"')).toMatchInlineSnapshot(
      `true`,
    )
    expect(Object.values(fixed.recipes)[0]?.styles).toMatchInlineSnapshot(`
      {
        "default": {
          "dark": {
            "0": {
              "color": "#fafafa",
              "fontFamily": "Geist-Regular",
              "paddingBottom": 16,
              "paddingLeft": 16,
              "paddingRight": 16,
              "paddingTop": 16,
            },
          },
          "light": {
            "0": {
              "color": "#171717",
              "fontFamily": "Geist-Regular",
              "paddingBottom": 16,
              "paddingLeft": 16,
              "paddingRight": 16,
              "paddingTop": 16,
            },
          },
        },
      }
    `)
    expect(
      Native.compile({
        colorScheme: 'light',
        contextual: true,
        fonts: { Geist: 'Geist-Regular' },
        moduleId: 'app/Label.tsx',
        source: label,
        units: { rem: 16 },
      }).code.includes('"dark":'),
    ).toMatchInlineSnapshot(`true`)
    expect(() =>
      Native.compile({
        colorScheme: 'light',
        moduleId: 'app/Label.tsx',
        source: label,
        units: { rem: 16 },
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [StyleSheet.CompileError: ["default","light","0","fontFamily"]: Provide an explicit fonts mapping for this family.
      ["default","dark","0","fontFamily"]: Provide an explicit fonts mapping for this family.]
    `)
    expect(() =>
      Native.compile({
        colorScheme: 'light',
        moduleId: 'app/Label.tsx',
        source: `import { style } from 'zyzz'
export const label = style({ targets: { ios: { opacity: 1 } } })
`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.CompileError: ["0","targets"]: Platform branches require an explicit platform.]`,
    )
  })

  test('labels tables with vars and selects a set', () => {
    const base = defineVars({ color: { ink: '#171717' } })
    const brand = extendVars(base, { color: { ink: '#2563eb' } })
    const source = `import { style } from 'zyzz'
export const label = style({ opacity: 0.5 })
`
    const output = Native.compile({
      colorScheme: 'light',
      moduleId: 'app/Label.tsx',
      set: 'brand',
      source,
      vars: { base, brand },
    })

    expect(Object.keys(Object.values(output.recipes)[0]!.styles))
      .toMatchInlineSnapshot(`
      [
        "base",
        "brand",
      ]
    `)
    expect(() =>
      Native.compile({
        colorScheme: 'light',
        moduleId: 'app/Label.tsx',
        set: 'missing',
        source,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.SelectionError: Select an existing set label and light or dark colorScheme.]`,
    )
  })

  test('defers set validation in contextual output', () => {
    const output = Native.compile({
      colorScheme: 'light',
      contextual: true,
      moduleId: 'app/Label.tsx',
      set: 'missing',
      source: `import { style } from 'zyzz'
export const label = style({ opacity: 0.5 })
`,
    })

    expect(output.code.includes('"missing"')).toMatchInlineSnapshot(`true`)
  })

  test('runs the compiled callables', async () => {
    const source = await example('namespaces/Native', 'Callables')
    const output = Native.compile({
      colorScheme: 'light',
      moduleId: 'app/Button.tsx',
      source: exported(source),
    })
    const module = await load(output.code)

    expect(module.button({ tone: 'loud' })).toMatchInlineSnapshot(`
      {
        "style": {
          "opacity": 1,
          "paddingTop": 8,
        },
      }
    `)
    expect(module.button({ tone: null })).toMatchInlineSnapshot(`
      {
        "style": {
          "paddingTop": 8,
        },
      }
    `)
    expect(module.button({ style: { marginTop: 4 } })).toMatchInlineSnapshot(`
      {
        "style": [
          {
            "opacity": 0.5,
            "paddingTop": 8,
          },
          {
            "marginTop": 4,
          },
        ],
      }
    `)
    expect(module.bar({ alpha: 0.25 })).toMatchInlineSnapshot(`
      {
        "style": {
          "opacity": 0.25,
        },
      }
    `)
    expect(() => module.bar({})).toThrowErrorMatchingInlineSnapshot(
      `[Native.SelectionError: Missing or invalid native payload: alpha.]`,
    )
  })

  test('compiles the graph output example', async () => {
    const module = await run(await example('namespaces/Native', 'Graph Output'))

    expect(module.output.modules['app/card.ts'].code).toMatchInlineSnapshot(`
      "
      import {Native as __zyzzNative} from 'zyzz/runtime';




      import { style } from 'zyzz'

      export const card = (__zyzzNative.create({"axes":{},"defaults":{},"styles":{"0":{"opacity":0.5}}}) as import('zyzz/runtime').Native.Callable<{}>)
      "
    `)
    expect(module.output.modules['app/card.ts'].css).toMatchInlineSnapshot(`""`)
    expect(module.output.modules['app/card.ts'].classes).toMatchInlineSnapshot(
      `{}`,
    )
    expect(module.output.dependencies).toMatchInlineSnapshot(`
      {
        "app/card.ts": [],
        "app/index.ts": [
          "app/card.ts",
        ],
      }
    `)
  })

  test('throws the documented errors', async () => {
    const compile = templates(
      await example('namespaces/Native', 'Native.CompileError'),
    )
    const styleSheet = templates(
      await example('namespaces/Native', 'StyleSheet.CompileError'),
    )

    expect(() =>
      Native.compile({
        colorScheme: 'light',
        moduleId: 'app/global.ts',
        source: compile.source!,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Native.CompileError: Native static modules do not support CSS contributions, variables, or web set controls.]`,
    )
    expect(() =>
      Native.compile({
        colorScheme: 'light',
        moduleId: 'app/Card.tsx',
        source: styleSheet.source!,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [StyleSheet.CompileError: ["default","light","0","padding"]: Provide units.rem for rem lengths.
      ["default","dark","0","padding"]: Provide units.rem for rem lengths.]
    `)
  })
})

describe('compiler API examples', () => {
  test('type-check against the published declarations', async () => {
    const pages = await Promise.all(
      [
        '../compiler',
        'namespaces/Graph',
        'namespaces/Native',
        'namespaces/Source',
        'namespaces/Transform',
      ].map((page) => examples(page)),
    )
    const files = await Promise.all(
      pages
        .flat()
        .filter((entry) => entry.source.includes('import '))
        .map(async (entry, index) => {
          const directory = Path.join(root, 'types', String(index))
          const file = Path.join(directory, entry.name ?? 'Example.tsx')
          await Fs.mkdir(directory, { recursive: true })
          await Fs.writeFile(file, entry.source)
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
        // Error examples import `zyzz/react-native` as Metro resolves it.
        '--customConditions',
        'react-native',
        '--target',
        'ESNext',
        ...files,
      ],
      { cwd: root, encoding: 'utf8', timeout: 30000 },
    )

    expect(files).toHaveLength(25)
    expect(checked.status, checked.stdout + checked.stderr).toBe(0)
  }, 60_000)
})
