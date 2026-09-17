/** Exercises native Babel compilation through Expo's real preset and emitted module execution. @module */
import * as Babel from '@babel/core'
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import plugin from 'zyzz/babel'

const require = Module.createRequire(
  Path.resolve('examples/expo-native/package.json'),
)
const expoRequire = Module.createRequire(require.resolve('expo/package.json'))
const preset = expoRequire.resolve('babel-preset-expo')

function compile(source: string, platform: 'android' | 'ios' = 'ios') {
  const caller = { name: 'metro', platform, isDev: false }

  return Babel.transformSync(source, {
    babelrc: false,
    caller,
    configFile: false,
    filename: '/Fixture.ts',
    plugins: [[plugin, { colorScheme: 'light', platform, units: { px: 1 } }]],
    presets: [preset],
    sourceMaps: true,
  })!
}

async function execute(code: string) {
  const result = await Esbuild.build({
    bundle: true,
    format: 'esm',
    platform: 'node',
    stdin: { contents: code, resolveDir: process.cwd() },
    write: false,
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0]!.text).toString('base64')}`
  )
}

describe('plugin', () => {
  test('executes platform styles, variants, and changing payloads without authoring callbacks', async () => {
    const source = `import { style, variants } from 'zyzz'
      const box = style({ width: '10px', targets: { ios: { opacity: 0.5 }, android: { opacity: 0.8 } } })
      const card = variants({ base: { padding: '2px' }, variants: { big: { true: { padding: '8px' }, false: { padding: '4px' } } }, defaultVariants: { big: false } })
      const meter = style((value: { width: \`\${number}px\` }) => ({ width: value.width }))
      export const results = [box(), card(), card({ big: true }), meter({ width: '12px' }), meter({ width: '24px' })]`
    const ios = await execute(compile(source).code!)
    expect(ios.results).toMatchInlineSnapshot(`
      [
        {
          "style": {
            "opacity": 0.5,
            "width": 10,
          },
        },
        {
          "style": {
            "paddingBottom": 4,
            "paddingLeft": 4,
            "paddingRight": 4,
            "paddingTop": 4,
          },
        },
        {
          "style": {
            "paddingBottom": 8,
            "paddingLeft": 8,
            "paddingRight": 8,
            "paddingTop": 8,
          },
        },
        {
          "style": {
            "width": 12,
          },
        },
        {
          "style": {
            "width": 24,
          },
        },
      ]
    `)
    const android = await execute(compile(source, 'android').code!)
    expect(android.results[0]).toMatchInlineSnapshot(`
      {
        "style": {
          "opacity": 0.8,
          "width": 10,
        },
      }
    `)
  })

  test('preserves source locations after generated imports and shortened expressions', () => {
    const output = compile(`import { style } from 'zyzz'
export const box = style({ width: '10px' })
export const marker = 'original-location'
`)
    const lines = output.code!.split('\n')
    const line = lines.findIndex((line) => line.includes('original-location'))
    const position = Trace.originalPositionFor(
      new Trace.TraceMap(JSON.stringify(output.map)),
      {
        line: line + 1,
        column: lines[line]!.indexOf('original-location'),
      },
    )
    expect(position.line).toMatchInlineSnapshot(`3`)
  })

  test('rejects graph-dependent authoring instead of emitting web helpers', () => {
    expect(() =>
      compile(
        "import { Config } from 'zyzz'; export const { style } = Config.create({})",
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: /Fixture.ts: Zyzz Babel currently supports literal style and variants definitions. Theme/config compilation requires the graph adapter.]`,
    )
    expect(() =>
      compile("export { style } from 'zyzz'"),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: /Fixture.ts: Zyzz Babel does not support re-exporting authoring helpers. Export compiled style definitions instead.]`,
    )
  })

  test('passes ordinary modules through and rejects unsupported native declarations', async () => {
    const result = await execute(
      compile(
        "import type { Config } from 'zyzz'; export { type Style } from 'zyzz'; export const value: number = 42",
      ).code!,
    )
    expect(result.value).toMatchInlineSnapshot(`42`)
    expect(() =>
      compile(
        "import { style } from 'zyzz'; export const box = style({ selectors: { ':hover': { opacity: 0.5 } } })",
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: /Fixture.ts: babel/Fixture.ts:70: Selectors require an explicit & target.]`,
    )
  })
})
