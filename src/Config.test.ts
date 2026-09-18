/**
 * Exercises configuration normalization through style validation and CSS emission.
 * @module
 */
import * as Path from 'node:path'
import * as Ts from 'typescript-api'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Config, Style, Theme } from 'zyzz'
import { Css } from 'zyzz/web'

describe('create', () => {
  test('suggests configured CSS values and theme tokens with property diagnostics', () => {
    const root = Path.resolve(import.meta.dirname, '..')
    const file = Path.join(root, '.fixture-config-editor.ts')
    let source = `import { Config } from 'zyzz'
import { theme } from 'zyzz/default'
const { style } = Config.create({ theme })
const pane = style({ alignItems: 'center', fontFamily: 'sans' })
const dynamic = style((values: { width: \`\${number}px\` }) => ({
  width: values.width,
  alignItems: 'center',
}))
dynamic({ width: '12px' })
`
    let version = 0
    const snapshots = new Map<string, Ts.IScriptSnapshot>()
    const options: Ts.CompilerOptions = {
      module: Ts.ModuleKind.ESNext,
      moduleResolution: Ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      paths: { zyzz: [Path.join(root, 'src/index.ts')] },
      skipLibCheck: true,
      strict: true,
      target: Ts.ScriptTarget.ESNext,
      types: [],
    }
    const service = Ts.createLanguageService({
      fileExists: (path) => path === file || Ts.sys.fileExists(path),
      getCompilationSettings: () => options,
      getCurrentDirectory: () => root,
      getDefaultLibFileName: Ts.getDefaultLibFilePath,
      getProjectVersion: () => String(version),
      getScriptFileNames: () => [file],
      getScriptSnapshot: (path) => {
        if (path === file) return Ts.ScriptSnapshot.fromString(source)

        const cached = snapshots.get(path)
        if (cached) return cached

        const text = Ts.sys.readFile(path)
        if (text === undefined) return undefined

        const snapshot = Ts.ScriptSnapshot.fromString(text)
        snapshots.set(path, snapshot)
        return snapshot
      },
      getScriptVersion: (path) => (path === file ? String(version) : '0'),
      readDirectory: Ts.sys.readDirectory,
      readFile: (path) => (path === file ? source : Ts.sys.readFile(path)),
    })

    function complete(property: string, original: string, value: string) {
      const previous = source
      source = source.replace(
        `${property}: '${original}'`,
        `${property}: '${value}'`,
      )
      version++
      try {
        const position =
          source.indexOf(`${property}: '${value}'`) +
          `${property}: '`.length +
          value.length
        return service
          .getCompletionsAtPosition(file, position, {})
          ?.entries.map((entry) => entry.name)
      } finally {
        source = previous
        version++
      }
    }

    function diagnose(before: string, after: string) {
      const previous = source
      source = source.replace(before, after)
      version++
      try {
        return service.getSemanticDiagnostics(file).map((diagnostic) => ({
          code: diagnostic.code,
          message: Ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            '\n',
          ),
          span: source.slice(
            diagnostic.start!,
            diagnostic.start! + diagnostic.length!,
          ),
        }))
      } finally {
        source = previous
        version++
      }
    }

    try {
      expect(service.getSemanticDiagnostics(file)).toMatchInlineSnapshot(`[]`)
      expect(complete('alignItems', 'center', '')).toMatchInlineSnapshot(`
        [
          "baseline",
          "center",
          "end",
          "first baseline",
          "flex-end",
          "flex-start",
          "last baseline",
          "normal",
          "safe center",
          "safe end",
          "safe flex-end",
          "safe flex-start",
          "safe start",
          "start",
          "stretch",
          "unsafe center",
          "unsafe end",
          "unsafe flex-end",
          "unsafe flex-start",
          "unsafe start",
          "anchor-center",
          "safe self-end",
          "safe self-start",
          "self-end",
          "self-start",
          "unsafe self-end",
          "unsafe self-start",
          "inherit",
          "initial",
          "revert",
          "revert-layer",
          "unset",
        ]
      `)
      expect(complete('fontFamily', 'sans', '')).toMatchInlineSnapshot(`
        [
          "",
          "mono",
          "sans",
          "serif",
        ]
      `)
      expect(
        diagnose("alignItems: 'center'", "alignItems: 'invalid-alignment'"),
      ).toMatchInlineSnapshot(`
        [
          {
            "code": 2322,
            "message": "Type '"invalid-alignment"' is not assignable to type '("invalid-alignment" & Reference<"*">) | ("invalid-alignment" & readonly [Atom<Value<{ readonly kind: "enum"; readonly values: readonly ["anchor-center", "baseline", "center", "end", "first baseline", ... 21 more ..., "unsafe start"]; }> | Reference<...>>, ...Atom<...>[]])'.",
            "span": "alignItems",
          },
        ]
      `)
      expect(diagnose("fontFamily: 'sans'", "unknownProperty: 'sans'"))
        .toMatchInlineSnapshot(`
        [
          {
            "code": 2322,
            "message": "Type 'string' is not assignable to type 'never'.",
            "span": "unknownProperty",
          },
        ]
      `)
    } finally {
      service.dispose()
    }
  }, 30_000)

  test('uses the validated descriptor snapshot for configuration', () => {
    const options = new Proxy(
      { cssOutput: 'grouped' as const },
      {
        get(target, key, receiver) {
          if (key === 'cssOutput') throw new Error('Unexpected property read')
          return Reflect.get(target, key, receiver)
        },
      },
    )
    expect(Object.isFrozen(Config.create(options))).toMatchInlineSnapshot(
      `true`,
    )
  })

  test('mixed named inputs share isolated scopes and retain the default fallback', () => {
    const base = Theme.define({
      color: { brand: '#06c' },
      spacing: { md: '8px' },
    })

    const zyzz = Config.create({
      defaultTheme: 'base',
      themes: {
        base,
        mint: {
          color: { brand: { light: '#175', dark: '#afa' } },
          spacing: { md: '12px' },
        },
      },
    })

    const output = Css.compile({
      styles: Style.define({
        card: {
          color: zyzz.themes.base.tokens.color.brand,
          padding: zyzz.themes.base.tokens.spacing.md,
        },
      }),
      themes: zyzz.themes,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".t_0{--z0:#06c;--z1:8px;}
      .t_1{--z0:light-dark(#175,#afa);--z1:12px;}
      .z-text-gsB0EO{color:var(--z0,#06c);}
      .z-p-Fm87Na{padding:var(--z1,8px);}"
    `)
    expect(Object.isFrozen(zyzz.themes)).toMatchInlineSnapshot(`true`)
    expect(zyzz.themes.base === base).toMatchInlineSnapshot(`false`)
    // The original definition cannot become a scope for the normalized contract.
    expect(
      Css.compile({
        styles: Style.define({
          card: { color: zyzz.themes.base.tokens.color.brand },
        }),
        themes: { original: base },
      }).css,
    ).toMatchInlineSnapshot(`".z-text-gsB0EO{color:var(--z0,#06c);}"`)

    const other = Config.create({ theme: base })

    expect(
      Css.compile({
        styles: Style.define({
          card: { color: other.theme.tokens.color.brand },
        }),
        themes: zyzz.themes,
      }).css,
    ).toMatchInlineSnapshot(`".z-text-gsB0EO{color:var(--z0,#06c);}"`)
  })

  test('normalized themes inherit and select schemes in Chromium', async () => {
    const zyzz = Config.create({
      defaultTheme: 'base',
      themes: {
        base: {
          color: { brand: { light: '#06c', dark: '#9cf' } },
          spacing: { md: '8px' },
        },
        mint: {
          color: { brand: { light: '#175', dark: '#afa' } },
          spacing: { md: '12px' },
        },
      },
    })

    const output = Css.compile({
      styles: Style.define({
        card: {
          color: zyzz.themes.base.tokens.color.brand,
          padding: zyzz.themes.base.tokens.spacing.md,
        },
      }),
      themes: zyzz.themes,
    })

    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${output.css}</style><main class="${output.themes.mint}"><div id="mint" class="${output.classes.card}"></div><section class="${output.themes.base}"><div id="base" class="${output.classes.card}"></div></section></main>`,
      )

      expect(
        await page
          .locator('#mint')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(17, 119, 85)"`)
      expect(
        await page
          .locator('#mint')
          .evaluate((element) => getComputedStyle(element).padding),
      ).toMatchInlineSnapshot(`"12px"`)
      expect(
        await page
          .locator('#base')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(0, 102, 204)"`)

      await page.evaluate(() => {
        document.documentElement.style.colorScheme = 'dark'
      })

      expect(
        await page
          .locator('#mint')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(170, 255, 170)"`)
      expect(
        await page
          .locator('#base')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(153, 204, 255)"`)
    } finally {
      await browser.close()
    }
  })

  test('single inline themes and reusable extensions retain validated values', () => {
    const base = Theme.define({ spacing: { md: '8px' } })
    const zyzz = Config.create({
      theme: Theme.extend(base, { spacing: { md: '12px' } }),
    })

    expect(
      Css.compile({
        styles: Style.define(
          { card: { padding: 'md' } },
          { theme: zyzz.theme },
        ),
        themes: { selected: zyzz.theme },
      }).css,
    ).toMatchInlineSnapshot(`
      ".t_0{--z0:12px;}
      .z-p-VAexTA{padding:var(--z0,12px);}"
    `)

    const inline = Config.create({ theme: { spacing: { md: '1rem' } } })

    expect(
      Css.compile({
        styles: Style.define({
          card: { padding: inline.theme.tokens.spacing.md },
        }),
      }).css,
    ).toMatchInlineSnapshot(`".z-p-YqOp03{padding:var(--z0,1rem);}"`)
    expect(() =>
      zyzz.style({ padding: 'md' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Config.create requires an explicit id without the compiler plugin.]`,
    )
    expect(Config.create().style({ padding: '8px' })()).toMatchInlineSnapshot(`
      {
        "className": "z-content-3f8gqjlziaxl",
      }
    `)
  })

  test('rejects unknown default before CSS emission', () => {
    expect(() =>
      emit({
        defaultTheme: 'missing',
        themes: { base: { color: { brand: '#06c' } } },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: defaultTheme must name a theme in the catalog.]`,
    )
  })
  test('rejects incompatible paths before CSS emission', () => {
    expect(() =>
      emit({
        defaultTheme: 'base',
        themes: {
          base: { color: { brand: '#06c' } },
          mint: { color: { other: '#175' } },
        },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: Theme "mint" must have the default theme's complete token paths and domains.]`,
    )
  })
  test('rejects mixed modes before CSS emission', () => {
    expect(() =>
      emit({ theme: {}, themes: {} }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: Use either theme or themes, not both.]`,
    )
  })
  test('rejects default without catalog before CSS emission', () => {
    expect(() =>
      emit({ defaultTheme: 'base' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: defaultTheme requires a named themes catalog.]`,
    )
  })
  test('rejects duplicate layers before CSS emission', () => {
    expect(() =>
      emit({ layers: ['base', 'base'] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: Duplicate layer: base]`,
    )
  })
  test('rejects reserved layers before CSS emission', () => {
    expect(() =>
      emit({ layers: ['base', 'initial'] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: Layer names must be plain CSS identifiers, optionally dotted.]`,
    )
  })
  test('rejects invalid layer names before CSS emission', () => {
    expect(() =>
      emit({ layers: ['base', 'bad name'] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: Layer names must be plain CSS identifiers, optionally dotted.]`,
    )
  })
})

function emit(input: unknown) {
  const config = Config.create(input as Config.create.Options)

  return Css.compile({
    styles: Style.define({ card: { color: '#06c' } }),
    themes: 'themes' in config ? config.themes : {},
  })
}
