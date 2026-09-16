/** Exercises shared authoring through native compilation and static selection. @module */
import * as StaticValues from '../../test/fixtures/native/StaticValues.js'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import * as Vm from 'node:vm'
import { getQuickJS } from 'quickjs-emscripten'
import { describe, expect, test } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'
import { Source } from 'zyzz/compiler'
import { StyleSheet } from 'zyzz/react-native'
import { Css } from 'zyzz/web'

describe('compose', () => {
  test('retains native literal values through conditional composition', () => {
    const tables = StyleSheet.compile({
      styles: Style.define({ card: { opacity: 0.5 } }),
    })
    const composed = StyleSheet.compose(false, tables.styles.default.light.card)

    expect(composed === tables.styles.default.light.card).toMatchInlineSnapshot(
      'true',
    )
    expect(
      StyleSheet.flatten(
        StyleSheet.compose({ position: 'absolute' }, { top: 0 }),
      ),
    ).toMatchInlineSnapshot(`
      {
        "position": "absolute",
        "top": 0,
      }
    `)
  })

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
  test('retains every pinned static native property through source compilation', async () => {
    const inventory = JSON.parse(
      await Fs.readFile(
        new URL(
          '../../test/conformance/native/inventory.json',
          import.meta.url,
        ),
        'utf8',
      ),
    )
    const properties = [
      ...new Set(
        Object.values(inventory.styles).flatMap((style) =>
          Object.keys(style as object),
        ),
      ),
    ].sort()
    expect(Object.keys(StaticValues.values).sort()).toEqual(properties)
    expect(properties.length).toMatchInlineSnapshot('157')
    const source = `import {style} from 'zyzz';export const card=style({targets:{native:${JSON.stringify(StaticValues.values)}}});`
    const extracted = Source.extract({ moduleId: 'static.ts', source })
    for (const platform of ['ios', 'android'] as const) {
      const compiled = StyleSheet.compile({
        platform,
        styles: extracted.styles,
      })
      const card = Object.values(compiled.styles.default.light)[0]!
      expect(card).toEqual(StaticValues.values)
      expect(Object.isFrozen(card)).toMatchInlineSnapshot('true')
      expect(Object.isFrozen(card.filter)).toMatchInlineSnapshot('true')
    }
    expect(Css.compile({ styles: extracted.styles }).css).toMatchInlineSnapshot(
      `""`,
    )
  })

  test('converts matrices, font variants, and shadow lengths with explicit scales', () => {
    const styles = Style.define({
      card: {
        transform:
          'matrix(1, 2, 3, 4, 5, -6) matrix3d(1,0,0,.1,0,1,0,.2,0,0,1,-.002,3,4,5,1)',
        boxShadow: 'inset 1rem -2px 3px -1px rgb(100% 0% 0% / 50%), 0 1px blue',
        textShadow: '1px -2px 3px hsl(120deg 100% 50%)',
        fontVariant: 'small-caps tabular-nums',
      },
    })
    const output = StyleSheet.compile({ styles, units: { px: 2, rem: 20 } })
      .styles.default.light.card
    expect(output).toMatchInlineSnapshot(`
      {
        "boxShadow": [
          {
            "blurRadius": 6,
            "color": "#ff000080",
            "inset": true,
            "offsetX": 20,
            "offsetY": -4,
            "spreadDistance": -2,
          },
          {
            "blurRadius": 0,
            "color": "blue",
            "inset": false,
            "offsetX": 0,
            "offsetY": 2,
            "spreadDistance": 0,
          },
        ],
        "fontVariant": [
          "small-caps",
          "tabular-nums",
        ],
        "textShadowColor": "#00ff00ff",
        "textShadowOffset": {
          "height": -4,
          "width": 2,
        },
        "textShadowRadius": 6,
        "transform": [
          {
            "matrix": [
              1.5,
              1.4,
              0,
              0.05,
              4,
              2.8,
              0,
              0.1,
              -0.01,
              0.012,
              1,
              -0.001,
              40,
              32,
              10,
              1,
            ],
          },
        ],
      }
    `)
    expect(Object.isFrozen(output.transform)).toMatchInlineSnapshot('true')
    if (Array.isArray(output.transform))
      expect(Object.isFrozen(output.transform[0].matrix)).toMatchInlineSnapshot(
        'true',
      )
    expect(Object.isFrozen(output.textShadowOffset)).toMatchInlineSnapshot(
      'true',
    )
    const reset = StyleSheet.compile({
      styles: Style.define({
        card: { boxShadow: 'none', textShadow: 'none', fontVariant: 'normal' },
      }),
    }).styles.default.light.card
    expect(reset).toMatchInlineSnapshot(`
      {
        "boxShadow": [],
        "fontVariant": [],
        "textShadowColor": "transparent",
        "textShadowOffset": {
          "height": 0,
          "width": 0,
        },
        "textShadowRadius": 0,
      }
    `)
  })

  test('matches browser matrix composition for ordered mixed transforms', async () => {
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      for (const transform of [
        'matrix(1,2,3,4,5,6) translate(8px,-4px) scale(2,3)',
        'rotateX(30deg) matrix(1,0,0,1,5,6) rotateY(20deg) rotateZ(10deg)',
        'skewX(15deg) matrix(1,0,0,1,5,6) skewY(-20deg) perspective(500px)',
      ]) {
        const native = StyleSheet.compile({
          styles: Style.define({ card: { transform } } as never),
        }).styles.default.light.card!.transform
        const expected = await page.evaluate(
          (value) => [...new DOMMatrix(value).toFloat64Array()],
          transform,
        )
        if (
          !Array.isArray(native) ||
          native.length !== 1 ||
          !('matrix' in native[0])
        )
          throw new Error('Expected one native matrix.')
        for (const [index, value] of expected.entries())
          expect(native[0].matrix[index]).toBeCloseTo(value, 10)
      }
    } finally {
      await browser.close()
    }
  }, 30_000)

  test('matches browser colors for absolute sRGB conversions', async () => {
    const upstream = await Fs.readFile(
      new URL(
        '../../test/conformance/native/upstream/normalizeColor.js.txt',
        import.meta.url,
      ),
      'utf8',
    )
    const nativeColor = Vm.runInNewContext(
      `const module={exports:{}};${upstream};module.exports`,
      {},
    ) as (value: string) => number | null
    const colors = [
      'rebeccapurple',
      'aliceblue',
      'transparent',
      '#1234',
      'rgb(100% 0% 0% / 50%)',
      'rgba(10, 20, 30, 0.5)',
      'rgb(12.5 256 -1)',
      'hsl(.5turn 100% 50% / 25%)',
      'hsl(-120deg 100% 50%)',
      'hwb(120 20% 30% / .5)',
      'hwb(0 80% 80%)',
    ]
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent('<canvas width="1" height="1"></canvas>')
      for (const color of colors) {
        const styles = Style.define({ card: { color } } as never)
        const converted = StyleSheet.compile({ styles }).styles.default.light
          .card!.color!
        if (typeof converted !== 'string')
          throw new Error('Expected a converted color string.')
        expect(nativeColor(converted), color).not.toBeNull()
        const pixels = await page.evaluate(
          ([shared, native]) => {
            const context = document.querySelector('canvas')!.getContext('2d')!
            return [shared, native].map((color) => {
              context.clearRect(0, 0, 1, 1)
              context.fillStyle = color
              context.fillRect(0, 0, 1, 1)
              return [...context.getImageData(0, 0, 1, 1).data]
            })
          },
          [color, converted] as const,
        )
        expect(pixels[1], color).toEqual(pixels[0])
      }
    } finally {
      await browser.close()
    }
  }, 30_000)

  test.each([
    { transform: 'matrix(1,0,0,1,0,0) translateX(10%)' },
    { color: 'currentcolor' },
    { color: 'oklch(.5 .2 30)' },
    { boxShadow: '1px 2px' },
    { boxShadow: '1px 2px -1px red' },
    { textShadow: '1px 2px red, 1px 2px blue' },
    { textShadow: 'inset 1px 2px red' },
    { fontVariant: 'all-small-caps' },
  ])(
    'diagnoses shared values without a portable native conversion: %j',
    (declarations) => {
      expect(() =>
        StyleSheet.compile({
          styles: Style.define({ card: declarations } as never),
        }),
      ).toThrow(StyleSheet.CompileError)
    },
  )

  test('resolves shared, native, and platform declarations in destination semantics', () => {
    const styles = Style.define({
      card: {
        fontSize: '10px',
        lineHeight: 1.5,
        opacity: 0.2,
        targets: {
          android: { elevation: 4, opacity: 0.9 },
          ios: { opacity: 0.8, shadowOffset: { width: -1, height: 2 } },
          native: {
            fontSize: 20,
            fontWeight: '600',
            opacity: 0.6,
            transform: [{ scale: 2 }],
          },
          web: { display: 'grid', opacity: 0.7 },
        },
      },
    })
    const ios = StyleSheet.compile({
      styles,
      platform: 'ios',
      units: { px: 3 },
    })
    const android = StyleSheet.compile({ styles, platform: 'android' })

    expect(ios.styles.default.light.card).toMatchInlineSnapshot(`
      {
        "fontSize": 20,
        "fontWeight": "600",
        "lineHeight": 30,
        "opacity": 0.8,
        "shadowOffset": {
          "height": 2,
          "width": -1,
        },
        "transform": [
          {
            "scale": 2,
          },
        ],
      }
    `)
    expect(android.styles.default.light.card).toMatchInlineSnapshot(`
      {
        "elevation": 4,
        "fontSize": 20,
        "fontWeight": "600",
        "lineHeight": 30,
        "opacity": 0.9,
        "transform": [
          {
            "scale": 2,
          },
        ],
      }
    `)
    expect(
      Css.compile({ styles }).css.includes('display:grid'),
    ).toMatchInlineSnapshot('true')
    expect(
      Css.compile({ styles }).css.includes('opacity:0.9'),
    ).toMatchInlineSnapshot('false')
    expect(() =>
      StyleSheet.compile({ styles }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[StyleSheet.CompileError: ["card","targets"]: Platform branches require an explicit platform.]`,
    )
  })

  test('retains native structured values through source extraction and table compilation', () => {
    const source = `import {style} from 'zyzz';
      const values = {boxShadow: [{offsetX: 1, offsetY: -2, blurRadius: 3, color: 'rgba(0, 0, 0, 0.5)', inset: true}],
        filter: [{brightness: 0.5}], fontVariant: ['small-caps', 'tabular-nums'],
        resizeMode: 'repeat', transform: [{matrix: [1,0,0,0,0,1,0,0,0,0,1,0,4,5,0,1]}]};
      export const card = style({targets: {native: values}});`
    const extracted = Source.extract({ source, moduleId: 'native.ts' })
    const output = StyleSheet.compile({ styles: extracted.styles })
    const card = Object.values(output.styles.default.light)[0]!

    expect(card).toMatchInlineSnapshot(`
      {
        "boxShadow": [
          {
            "blurRadius": 3,
            "color": "rgba(0, 0, 0, 0.5)",
            "inset": true,
            "offsetX": 1,
            "offsetY": -2,
          },
        ],
        "filter": [
          {
            "brightness": 0.5,
          },
        ],
        "fontVariant": [
          "small-caps",
          "tabular-nums",
        ],
        "resizeMode": "repeat",
        "transform": [
          {
            "matrix": [
              1,
              0,
              0,
              0,
              0,
              1,
              0,
              0,
              0,
              0,
              1,
              0,
              4,
              5,
              0,
              1,
            ],
          },
        ],
      }
    `)
    expect(Object.isFrozen(card.boxShadow)).toMatchInlineSnapshot('true')
    expect(Css.compile({ styles: extracted.styles }).css).toMatchInlineSnapshot(
      '""',
    )
  })

  test.each([
    { bogus: 1 },
    { transform: [{ matrix: [1, 2] }] },
    { transform: [{ matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] }, { scale: 2 }] },
    { transformOrigin: [1, 2] },
    { transformOrigin: [1, 2, 3, 4] },
    { width: true },
    { fontVariant: ['unknown'] },
    { transform: [{ scale: 2, rotate: '90deg' }] },
    { boxShadow: [{ offsetX: 1 }] },
  ])('rejects native branches outside pinned static domains: %j', (native) => {
    const styles = Style.define({ card: { targets: { native } } } as never)

    expect(() => StyleSheet.compile({ styles })).toThrow(
      StyleSheet.CompileError,
    )
  })

  test('copies static branch data without mutating callers or invoking host accessors', () => {
    const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    const native = { transform: [{ matrix }] }
    const styles = Style.define({ card: { targets: { native } } })
    matrix[0] = 2
    const output = StyleSheet.compile({ styles })

    expect(output.styles.default.light.card.transform).toMatchInlineSnapshot(`
      [
        {
          "matrix": [
            1,
            0,
            0,
            0,
            0,
            1,
            0,
            0,
            0,
            0,
            1,
            0,
            0,
            0,
            0,
            1,
          ],
        },
      ]
    `)
    expect(Object.isFrozen(matrix)).toMatchInlineSnapshot('false')
    let read = false
    const accessor = {
      get width() {
        read = true
        return 4
      },
    }
    expect(() =>
      Style.define({ card: { targets: { native: accessor } } } as never),
    ).toThrow(Style.InvalidError)
    expect(read).toMatchInlineSnapshot('false')
    expect(() =>
      Style.define({ card: { targets: { window: {} } } } as never),
    ).toThrow(Style.InvalidError)
  })

  test('compiles transform origins with signed offsets and explicit units', () => {
    const styles = Style.define({
      bottom: { transformOrigin: 'bottom' },
      center: { transformOrigin: 'center' },
      centered: { transformOrigin: 'center left' },
      duplicate: { transformOrigin: 'right top' },
      length: { transformOrigin: '2px' },
      offsets: {
        transformOrigin: '-1.25rem 25.5% -2px',
        transform: 'rotate(90deg)',
      },
      outside: { transformOrigin: '-25% 150%' },
      right: { transformOrigin: 'right' },
      top: { transformOrigin: 'top right' },
      zero: { transformOrigin: 0 },
    })
    const output = StyleSheet.compile({ styles, units: { px: 2, rem: 16 } })
    const selected = StyleSheet.select(output.styles, {
      colorScheme: 'dark',
      theme: 'default',
    })

    expect(selected).toMatchInlineSnapshot(`
      {
        "bottom": {
          "transformOrigin": [
            "50%",
            "100%",
            0,
          ],
        },
        "center": {
          "transformOrigin": [
            "50%",
            "50%",
            0,
          ],
        },
        "centered": {
          "transformOrigin": [
            "0%",
            "50%",
            0,
          ],
        },
        "duplicate": {
          "transformOrigin": [
            "100%",
            "0%",
            0,
          ],
        },
        "length": {
          "transformOrigin": [
            4,
            "50%",
            0,
          ],
        },
        "offsets": {
          "transform": [
            {
              "rotate": "90deg",
            },
          ],
          "transformOrigin": [
            -20,
            "25.5%",
            -4,
          ],
        },
        "outside": {
          "transformOrigin": [
            "-25%",
            "150%",
            0,
          ],
        },
        "right": {
          "transformOrigin": [
            "100%",
            "50%",
            0,
          ],
        },
        "top": {
          "transformOrigin": [
            "100%",
            "0%",
            0,
          ],
        },
        "zero": {
          "transformOrigin": [
            0,
            "50%",
            0,
          ],
        },
      }
    `)
    expect(
      Object.isFrozen(selected.offsets.transformOrigin),
    ).toMatchInlineSnapshot('true')
    expect(selected.top === selected.duplicate).toMatchInlineSnapshot('true')
    expect(
      Css.compile({ styles }).css.includes(
        'transform-origin:-1.25rem 25.5% -2px',
      ),
    ).toMatchInlineSnapshot('true')
    expect(
      StyleSheet.flatten([selected.offsets, { transformOrigin: [1, 2, 3] }]),
    ).toMatchInlineSnapshot(`
      {
        "transform": [
          {
            "rotate": "90deg",
          },
        ],
        "transformOrigin": [
          1,
          2,
          3,
        ],
      }
    `)
  })

  test.each([
    '',
    'left right',
    'top bottom',
    'top 10px',
    '10px left',
    'left top 10%',
    'left top 1px 2px',
    'calc(50% + 1px)',
    '1em',
    '1rem',
    '1px center center',
  ])('rejects unsupported transform-origin values: %s', (transformOrigin) => {
    const styles = Style.define({ card: { transformOrigin } } as never)

    try {
      StyleSheet.compile({ styles })
      throw new Error('Expected native rejection')
    } catch (error) {
      if (!(error instanceof StyleSheet.CompileError)) throw error
      expect(error.diagnostics.map(({ path }) => path)).toMatchInlineSnapshot(`
        [
          [
            "default",
            "light",
            "card",
            "transformOrigin",
          ],
          [
            "default",
            "dark",
            "card",
            "transformOrigin",
          ],
        ]
      `)
    }
  })

  test('compiles ordered transform lists without changing shared CSS', () => {
    const declarations = {
      transform:
        'translate(2rem, -25%) rotate(0.25turn) scale(2, -1) translateX(4px)',
    } satisfies StyleSheet.Properties
    const styles = Style.define({ card: declarations, duplicate: declarations })
    const output = StyleSheet.compile({ styles, units: { px: 2, rem: 16 } })
    const selected = StyleSheet.select(output.styles, {
      colorScheme: 'light',
      theme: 'default',
    })

    expect(selected.card.transform).toMatchInlineSnapshot(`
      [
        {
          "translateX": 32,
        },
        {
          "translateY": "-25%",
        },
        {
          "rotate": "90deg",
        },
        {
          "scaleX": 2,
        },
        {
          "scaleY": -1,
        },
        {
          "translateX": 8,
        },
      ]
    `)
    expect(selected.card === selected.duplicate).toMatchInlineSnapshot('true')
    expect(
      selected.card === output.styles.default.dark.card,
    ).toMatchInlineSnapshot('true')
    expect(Object.isFrozen(selected.card.transform)).toMatchInlineSnapshot(
      'true',
    )
    expect(
      Array.isArray(selected.card.transform) &&
        selected.card.transform.every(Object.isFrozen),
    ).toMatchInlineSnapshot('true')
    expect(
      Css.compile({ styles }).css.includes(declarations.transform),
    ).toMatchInlineSnapshot('true')
    expect(StyleSheet.flatten([selected.card, { transform: [{ scale: 3 }] }]))
      .toMatchInlineSnapshot(`
        {
          "transform": [
            {
              "scale": 3,
            },
          ],
        }
      `)
  })

  test('converts axis transforms, angles, and perspective into native values', () => {
    const output = StyleSheet.compile({
      styles: Style.define({
        axes: {
          transform:
            'rotateX(100grad) rotateY(1rad) rotateZ(0) skewX(-45deg) skewY(0.5turn) scaleX(2) scaleY(0) translateY(-2px) perspective(0.5px)',
        },
        defaults: { transform: 'translate(3px) scale(-2) perspective(0)' },
        empty: { transform: 'none' },
      }),
      units: { px: 2 },
    })

    expect(output.styles.default.light).toMatchInlineSnapshot(`
      {
        "axes": {
          "transform": [
            {
              "rotateX": "90deg",
            },
            {
              "rotateY": "1rad",
            },
            {
              "rotateZ": "0deg",
            },
            {
              "skewX": "-45deg",
            },
            {
              "skewY": "180deg",
            },
            {
              "scaleX": 2,
            },
            {
              "scaleY": 0,
            },
            {
              "translateY": -4,
            },
            {
              "perspective": 2,
            },
          ],
        },
        "defaults": {
          "transform": [
            {
              "translateX": 6,
            },
            {
              "translateY": 0,
            },
            {
              "scale": -2,
            },
            {
              "perspective": 2,
            },
          ],
        },
        "empty": {
          "transform": [],
        },
      }
    `)
  })

  test.each([
    'translateX(1em)',
    'translateX(1rem)',
    'translateX(calc(1px + 2px))',
    'translate(1px, 2px, 3px)',
    'translateX(1px) trailing',
    'translateX()',
    'rotate(2)',
    'rotate(1e999deg)',
    'scale(1e999)',
    'scale(1 2)',
    'scale(1,)',
    'perspective(-1px)',
    'skew(10deg, 20deg)',
    'matrix(1, 0, 0, 1, 0)',
    'matrix3d(1, 0, 0, 1, 0, 0)',
    'matrix(1, 0, 0, 1, 0, 1e999)',
    'translateZ(1px)',
  ])('rejects unsupported or malformed transforms: %s', (transform) => {
    const styles = Style.define({ card: { transform } } as never)

    try {
      StyleSheet.compile({ styles })
      throw new Error('Expected native rejection')
    } catch (error) {
      if (!(error instanceof StyleSheet.CompileError)) throw error
      expect(error.diagnostics.map(({ path }) => path.slice(0, 4)))
        .toMatchInlineSnapshot(`
          [
            [
              "default",
              "light",
              "card",
              "transform",
            ],
            [
              "default",
              "dark",
              "card",
              "transform",
            ],
          ]
        `)
    }
  })

  test('normalizes equivalent shared decoration order for native output', () => {
    const styles = Style.define({
      label: { textDecorationLine: 'line-through underline' },
    })
    const output = StyleSheet.compile({ styles })

    expect(
      output.styles.default.light.label.textDecorationLine,
    ).toMatchInlineSnapshot('"underline line-through"')
    expect(
      Css.compile({ styles }).css.includes('line-through underline'),
    ).toMatchInlineSnapshot('true')
  })

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
        const output=StyleSheet.compile({styles:Style.define({card:{padding:'8px',transform:'translateX(2px) scale(2)',transformOrigin:'-1.5px 25%'}})});
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
            "transform": [
              {
                "translateX": 2,
              },
              {
                "scale": 2,
              },
            ],
            "transformOrigin": [
              -1.5,
              "25%",
              0,
            ],
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
          const output=StyleSheet.compile({styles:Style.define({card:{padding:'8px',color:'#fff',transform:'rotate(90deg)',transformOrigin:'top right'}})});
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
              "transform": [
                {
                  "rotate": "90deg",
                },
              ],
              "transformOrigin": [
                "100%",
                "0%",
                0,
              ],
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
