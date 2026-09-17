/** Exercises web and native Babel compilation through real presets, modules, and browser rendering. @module */
import * as Babel from '@babel/core'
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/babel'

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
    plugins: [[zyzz, { colorScheme: 'light', platform, units: { px: 1 } }]],
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

describe('zyzz', () => {
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

  test('rejects web stylesheet authoring for both native platforms', () => {
    for (const platform of ['ios', 'android'] as const)
      for (const source of [
        "import { global } from 'zyzz/web'; global({ body: { color: 'red' } })",
        "import { fontFace } from 'zyzz/web'; fontFace({ fontFamily: 'Fixture', src: 'url(/font.woff2)' })",
      ])
        expect(() =>
          compile(source, platform),
        ).toThrowErrorMatchingInlineSnapshot(
          `[Native.CompileError: /Fixture.ts: Native static modules do not support CSS contributions, variables, or web theme controls.]`,
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

describe('web', () => {
  for (const cssOutput of ['atomic', 'grouped'] as const)
    test(`renders extracted ${cssOutput} CSS with dynamic bindings and selectors`, async () => {
      const source = `import { style, variants } from 'zyzz'
        const box = style({ width: '40px', height: '12px', backgroundColor: 'red', selectors: { '&:hover': { opacity: 0.5 } } })
        const meter = style((value: { width: \`\${number}px\` }) => ({ width: value.width, height: '8px' }))
        const card = variants({ base: { opacity: 0.2 }, variants: { active: { true: { opacity: 0.7 } } } })
        export const results = [box(), meter({ width: '72px' }), card({ active: true })]`
      const output = Babel.transformSync(source, {
        babelrc: false,
        configFile: false,
        filename: '/project/left/Styles.ts',
        plugins: [[zyzz, { target: 'web', cssOutput }]],
        presets: [preset],
        root: '/project',
        sourceMaps: true,
      })!
      const metadata = output.metadata!.zyzz!
      expect(metadata.moduleId).toMatchInlineSnapshot(`"left/Styles.ts"`)
      expect(
        metadata.cssMap.sourcesContent?.includes(source),
      ).toMatchInlineSnapshot(`true`)
      const runtime = await execute(output.code!)
      const browser = await chromium.launch()
      try {
        const page = await browser.newPage()
        await page.setContent(
          '<div id="box"></div><div id="meter"></div><div id="card"></div>',
        )
        await page.addStyleTag({ content: metadata.css })
        await page.evaluate((results) => {
          for (const [index, id] of ['box', 'meter', 'card'].entries()) {
            const element = document.getElementById(id)!
            element.className = results[index].className
            for (const [name, value] of Object.entries(results[index]))
              if (name !== 'className' && name !== 'style')
                element.setAttribute(name, String(value))
            for (const [name, value] of Object.entries(
              results[index].style ?? {},
            ))
              element.style.setProperty(name, String(value))
          }
        }, runtime.results)
        expect(
          await page
            .locator('#box')
            .evaluate((element) => getComputedStyle(element).width),
        ).toMatchInlineSnapshot(`"40px"`)
        expect(
          await page
            .locator('#box')
            .evaluate((element) => getComputedStyle(element).backgroundColor),
        ).toMatchInlineSnapshot(`"rgb(255, 0, 0)"`)
        expect(
          await page
            .locator('#meter')
            .evaluate((element) => getComputedStyle(element).width),
        ).toMatchInlineSnapshot(`"72px"`)
        expect(
          await page
            .locator('#card')
            .evaluate((element) => getComputedStyle(element).opacity),
        ).toMatchInlineSnapshot(`"0.7"`)
        await page.locator('#box').hover()
        expect(
          await page
            .locator('#box')
            .evaluate((element) => getComputedStyle(element).opacity),
        ).toMatchInlineSnapshot(`"0.5"`)
      } finally {
        await browser.close()
      }

      const other = Babel.transformSync(source, {
        babelrc: false,
        configFile: false,
        filename: '/project/right/Styles.ts',
        plugins: [[zyzz, { target: 'web', cssOutput }]],
        presets: [preset],
        root: '/project',
      })!
      const otherRuntime = await execute(other.code!)
      expect(
        runtime.results[0].className === otherRuntime.results[0].className,
      ).toMatchInlineSnapshot(`false`)
    })
})
