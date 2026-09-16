/** Exercises shared authoring through native compilation and static selection. @module */
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { getQuickJS } from 'quickjs-emscripten'
import { describe, expect, test } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'
import { StyleSheet } from 'zyzz/react-native'
import { Css } from 'zyzz/web'

describe('compose', () => {
  test('composes compiled tables with conditional native overrides', () => {
    const tables = StyleSheet.compile({
      styles: Style.define({ card: { padding: '8px', color: 'red' } }),
    })
    const styles = StyleSheet.select(tables.styles, {
      colorScheme: 'dark',
      theme: 'default',
    })
    const override = { paddingLeft: 16, color: 'blue' }
    const composed = StyleSheet.compose(styles.card, [false, [override]])

    expect(StyleSheet.flatten(composed)).toMatchInlineSnapshot(`
      {
        "color": "blue",
        "paddingBottom": 8,
        "paddingLeft": 16,
        "paddingRight": 8,
        "paddingTop": 8,
      }
    `)
    expect(styles.card.paddingLeft).toMatchInlineSnapshot('8')
    expect(
      StyleSheet.compose(styles.card, null) === styles.card,
    ).toMatchInlineSnapshot('true')
    expect(
      StyleSheet.compose(false, override) === override,
    ).toMatchInlineSnapshot('true')
    expect(StyleSheet.compose(null, undefined)).toMatchInlineSnapshot(
      'undefined',
    )
  })
})

describe('flatten', () => {
  test('preserves objects and shallowly replaces structured native values', () => {
    const styles = StyleSheet.compile({
      styles: Style.define({ image: { objectFit: 'cover' } }),
    })
    const transform = [{ scale: 2 }]
    const override = { transform, opacity: 0.5 }
    const result = StyleSheet.flatten([
      styles.styles.default.light.image,
      { transform: [{ scale: 1 }], opacity: 1 },
      [null, false, '', undefined, override],
    ])

    expect(result).toMatchInlineSnapshot(`
      {
        "objectFit": "cover",
        "opacity": 0.5,
        "transform": [
          {
            "scale": 2,
          },
        ],
      }
    `)
    expect(result.transform === transform).toMatchInlineSnapshot('true')
    expect(Object.isFrozen(transform)).toMatchInlineSnapshot('false')
    expect(StyleSheet.flatten(override) === override).toMatchInlineSnapshot(
      'true',
    )
    expect(StyleSheet.flatten([null, false, undefined])).toMatchInlineSnapshot(
      '{}',
    )
    expect(StyleSheet.flatten(null)).toMatchInlineSnapshot('undefined')
  })

  test('composes an absolute-fill overlay with explicit native offsets', () => {
    const tables = StyleSheet.compile({
      styles: Style.define({
        overlay: { backgroundColor: '#000', opacity: 0.5 },
      }),
    })
    const result = StyleSheet.flatten([
      StyleSheet.absoluteFill,
      tables.styles.default.dark.overlay,
      { top: 12 },
    ])

    expect(result).toMatchInlineSnapshot(`
      {
        "backgroundColor": "#000",
        "bottom": 0,
        "left": 0,
        "opacity": 0.5,
        "position": "absolute",
        "right": 0,
        "top": 12,
      }
    `)
    expect(StyleSheet.absoluteFill.top).toMatchInlineSnapshot('0')
    expect(Object.isFrozen(StyleSheet.absoluteFill)).toMatchInlineSnapshot(
      'true',
    )
  })
})

describe('compile', () => {
  test('compiles portable layout, image, and text scalars from shared declarations', () => {
    const styles = Style.define({
      card: {
        alignContent: 'space-evenly',
        aspectRatio: '16 / 9',
        backfaceVisibility: 'hidden',
        boxSizing: 'border-box',
        direction: 'rtl',
        display: 'contents',
        position: 'static',
      },
      image: { objectFit: 'cover' },
      label: {
        textAlign: 'justify',
        textDecorationColor: '#ff0000',
        textDecorationLine: 'underline line-through',
        textDecorationStyle: 'double',
        textTransform: 'uppercase',
        userSelect: 'text',
      },
    })
    const output = StyleSheet.compile({ styles })
    const selected = StyleSheet.select(output.styles, {
      colorScheme: 'light',
      theme: 'default',
    })

    expect(selected.card).toMatchInlineSnapshot(`
      {
        "alignContent": "space-evenly",
        "aspectRatio": 1.7777777777777777,
        "backfaceVisibility": "hidden",
        "boxSizing": "border-box",
        "direction": "rtl",
        "display": "contents",
        "position": "static",
      }
    `)
    expect(selected.image).toMatchInlineSnapshot(`
      {
        "objectFit": "cover",
      }
    `)
    expect(selected.label).toMatchInlineSnapshot(`
      {
        "textAlign": "justify",
        "textDecorationColor": "#ff0000",
        "textDecorationLine": "underline line-through",
        "textDecorationStyle": "double",
        "textTransform": "uppercase",
        "userSelect": "text",
      }
    `)
    expect(
      Css.compile({ styles }).css.includes('aspect-ratio:16 / 9'),
    ).toMatchInlineSnapshot(`true`)
  })

  test('rejects automatic aspect ratios instead of guessing an intrinsic size', () => {
    const styles = Style.define({ image: { aspectRatio: 'auto' } })

    expect(() => StyleSheet.compile({ styles }))
      .toThrowErrorMatchingInlineSnapshot(`
      [StyleSheet.CompileError: ["default","light","image","aspectRatio"]: Use a positive finite aspect ratio.
      ["default","dark","image","aspectRatio"]: Use a positive finite aspect ratio.]
    `)
  })

  test('loads native exports from a source-free package', async () => {
    const root = Path.resolve(import.meta.dirname, '../..')
    const directory = await Fs.mkdtemp(Path.join(root, '.fixture-native-'))
    try {
      const dependency = Path.join(directory, 'node_modules/zyzz')
      await Fs.mkdir(dependency, { recursive: true })
      await Fs.copyFile(
        Path.join(root, 'package.json'),
        Path.join(dependency, 'package.json'),
      )
      await Fs.cp(Path.join(root, 'dist'), Path.join(dependency, 'dist'), {
        recursive: true,
      })
      const { stdout } = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `
        import {Style} from 'zyzz'; import {StyleSheet} from 'zyzz/react-native';
        const output=StyleSheet.compile({styles:Style.define({card:{padding:'8px'}})});
        console.log(JSON.stringify(StyleSheet.select(output.styles,{theme:'default',colorScheme:'light'})));
      `,
        ],
        { cwd: directory, timeout: 10_000 },
      )
      expect(JSON.parse(stdout)).toMatchInlineSnapshot(`
        {
          "card": {
            "paddingBottom": 8,
            "paddingLeft": 8,
            "paddingRight": 8,
            "paddingTop": 8,
          },
        }
      `)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })

  test('compiles shared tokens into explicit theme and scheme tables', () => {
    const base = Theme.define({
      color: { ink: { dark: '#fff', light: '#000' } },
      spacing: { md: '1rem' },
    })
    const alternate = Theme.extend(base, { spacing: { md: '2rem' } })
    const styles = Style.define({
      card: { color: base.tokens.color.ink, padding: base.tokens.spacing.md },
      fixed: { opacity: 0.5 },
    })
    const output = StyleSheet.compile({
      styles,
      themes: { base, alternate },
      units: { rem: 16 },
    })

    expect(output.styles.base.light.card).toMatchInlineSnapshot(`
      {
        "color": "#000",
        "paddingBottom": 16,
        "paddingLeft": 16,
        "paddingRight": 16,
        "paddingTop": 16,
      }
    `)
    expect(output.styles.alternate.dark.card).toMatchInlineSnapshot(`
      {
        "color": "#fff",
        "paddingBottom": 32,
        "paddingLeft": 32,
        "paddingRight": 32,
        "paddingTop": 32,
      }
    `)
    expect(
      output.styles.base.light.fixed === output.styles.alternate.dark.fixed,
    ).toMatchInlineSnapshot('true')
    expect(
      Object.isFrozen(output.styles.base.light.card),
    ).toMatchInlineSnapshot('true')
    expect(Object.isFrozen(output.styles.base.light)).toMatchInlineSnapshot(
      'true',
    )
    expect(Object.isFrozen(output.styles)).toMatchInlineSnapshot('true')
    expect(
      Css.compile({ styles, themes: { base, alternate } }).css.includes(
        'light-dark(#000,#fff)',
      ),
    ).toMatchInlineSnapshot('true')
  })

  test('preserves authored shorthand overrides and explicit typography conversion', () => {
    const styles = Style.define({
      card: {
        borderTopWidth: '9px',
        borderWidth: '2px',
        fontFamily: 'Inter, sans-serif',
        lineHeight: 1.5,
        fontSize: '1rem',
        margin: '-1px 2px 3px 4px',
        paddingLeft: '1px',
        padding: '4px 8px',
        paddingBottom: '2px',
        width: '50%',
      },
    })
    const output = StyleSheet.compile({
      fonts: { 'Inter, sans-serif': 'Inter-Regular' },
      styles,
      units: { px: 2, rem: 20 },
    })

    expect(output.styles.default.light.card).toMatchInlineSnapshot(`
      {
        "borderBottomWidth": 4,
        "borderLeftWidth": 4,
        "borderRightWidth": 4,
        "borderTopWidth": 4,
        "fontFamily": "Inter-Regular",
        "fontSize": 20,
        "lineHeight": 30,
        "marginBottom": 6,
        "marginLeft": 8,
        "marginRight": 4,
        "marginTop": -2,
        "paddingBottom": 4,
        "paddingLeft": 16,
        "paddingRight": 16,
        "paddingTop": 8,
        "width": "50%",
      }
    `)
    expect(
      output.styles.default.light.card === output.styles.default.dark.card,
    ).toMatchInlineSnapshot('true')
  })

  test('does not substitute unrelated token contracts with matching paths', () => {
    const base = Theme.define({ color: { ink: 'red' } })
    const unrelated = Theme.define({ color: { ink: 'blue' } })
    const output = StyleSheet.compile({
      styles: Style.define({ text: { color: base.tokens.color.ink } }),
      themes: { unrelated },
    })

    expect(output.styles.unrelated.light.text).toMatchInlineSnapshot(
      `
      {
        "color": "red",
      }
    `,
    )
  })

  test.each([
    { display: 'grid' },
    { padding: '1em' },
    { padding: '1rem' },
    { padding: ['1px', '2px'] },
    { color: 'red!' },
    { color: 'currentColor' },
    { ':hover': { color: 'red' } },
    { '@media (width > 10px)': { padding: '1px' } },
    { fontFamily: 'sans-serif' },
    { lineHeight: 1.5 },
    { width: 'calc(100% - 1px)' },
    { flex: 1 },
  ])('rejects unsupported native semantics: %j', (input) => {
    const styles = Style.define({ card: input } as never)

    try {
      StyleSheet.compile({ styles })
      throw new Error('Expected native rejection')
    } catch (error) {
      if (!(error instanceof StyleSheet.CompileError)) throw error
      expect(error.name).toMatchInlineSnapshot('"StyleSheet.CompileError"')
    }
  })

  test('reports a precise property path without accepting web variables', () => {
    const theme = Theme.define({ color: { ink: 'red' } })
    const styles = Style.define({ card: { color: theme.vars.color.ink } })
    try {
      StyleSheet.compile({ styles })
      throw new Error('Expected native rejection')
    } catch (error) {
      if (!(error instanceof StyleSheet.CompileError)) throw error
      expect(error.diagnostics).toMatchInlineSnapshot(`
        [
          {
            "code": "unsupported_feature",
            "message": "Web variables, expressions, and dynamic bindings are not native scalar tokens.",
            "path": [
              "default",
              "light",
              "card",
              "color",
            ],
          },
          {
            "code": "unsupported_feature",
            "message": "Web variables, expressions, and dynamic bindings are not native scalar tokens.",
            "path": [
              "default",
              "dark",
              "card",
              "color",
            ],
          },
        ]
      `)
    }
  })

  test('rejects invalid unit scales and empty theme maps', () => {
    const styles = Style.define({ card: { padding: '1px' } })
    expect(() =>
      StyleSheet.compile({ styles, units: { px: 0 } }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.CompileError: ["units","px"]: Unit scales must be positive finite px or rem conversions.]`,
    )
    expect(() =>
      StyleSheet.compile({ styles, themes: {} }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.CompileError: ["themes"]: Supply at least one theme, or omit themes for a default table.]`,
    )
  })

  test('runs shared definitions and native lookup in QuickJS without host globals', async () => {
    const bundle = await Esbuild.build({
      bundle: true,
      format: 'iife',
      globalName: 'fixture',
      platform: 'neutral',
      stdin: {
        contents: `import {Style} from './src/index.ts'; import {StyleSheet} from './src/react-native/index.ts';
          const output=StyleSheet.compile({styles:Style.define({card:{padding:'8px',color:'#fff'}})});
          export const result=StyleSheet.select(output.styles,{theme:'default',colorScheme:'dark'});
          export const stable=result===StyleSheet.select(output.styles,{theme:'default',colorScheme:'dark'});`,
        loader: 'ts',
        resolveDir: Path.resolve(import.meta.dirname, '../..'),
      },
      write: false,
    })
    const engine = await getQuickJS()
    const context = engine.newContext()
    try {
      const result = context.unwrapResult(
        context.evalCode(
          `${bundle.outputFiles[0]!.text};JSON.stringify({card:fixture.result.card,stable:fixture.stable})`,
        ),
      )
      try {
        expect(JSON.parse(context.getString(result))).toMatchInlineSnapshot(`
          {
            "card": {
              "color": "#fff",
              "paddingBottom": 8,
              "paddingLeft": 8,
              "paddingRight": 8,
              "paddingTop": 8,
            },
            "stable": true,
          }
        `)
      } finally {
        result.dispose()
      }
    } finally {
      context.dispose()
    }
  })
})

describe('select', () => {
  test('returns the original table and rejects unknown own labels and schemes', () => {
    const output = StyleSheet.compile({
      styles: Style.define({ card: { opacity: 1 } }),
    })
    expect(
      StyleSheet.select(output.styles, {
        colorScheme: 'light',
        theme: 'default',
      }) === output.styles.default.light,
    ).toMatchInlineSnapshot('true')
    expect(() =>
      StyleSheet.select(output.styles, {
        theme: '__proto__',
        colorScheme: 'light',
      } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.SelectionError: Select an existing theme label and light or dark colorScheme.]`,
    )
    expect(() =>
      StyleSheet.select(output.styles, {
        theme: 'default',
        colorScheme: 'system',
      } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.SelectionError: Select an existing theme label and light or dark colorScheme.]`,
    )
  })
})
