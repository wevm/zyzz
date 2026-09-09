/**
 * Exercises the public Style workflow through real collaborating modules.
 * @module
 */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import * as Vm from 'node:vm'
import * as Worker from 'node:worker_threads'
import { chromium } from 'playwright'
import { getQuickJS } from 'quickjs-emscripten'
import { describe, expect, test } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'
import { Css } from 'zyzz/web'
import { components } from '../test/fixtures/components.js'

function diagnose(input: unknown, options: Style.define.Options = {}) {
  try {
    // @ts-expect-error Exercise untyped consumers through the public boundary.
    return Style.define(input, options)
  } catch (error) {
    if (!(error instanceof Style.InvalidError)) throw error
    return { diagnostics: error.diagnostics, name: error.name }
  }
}

describe('define', () => {
  test('theme shorthand and explicit references emit identical scoped styles', () => {
    const theme = Theme.define({
      backgroundColor: { brand: '#fff' },
      borderColor: { brand: '#000' },
      borderRadius: { md: '4px' },
      color: { blue: { 500: '#06c' }, brand: '#06c' },
      spacing: { 4: '1rem' },
      textColor: { brand: { dark: '#fff', light: '#111' } },
    })
    const named = Style.define(
      {
        card: {
          backgroundColor: 'brand',
          borderColor: 'brand',
          borderRadius: 'md',
          color: 'brand',
          padding: 4,
        },
        link: { color: 'blue.500' },
      },
      { theme },
    )
    const explicit = Style.define({
      card: {
        backgroundColor: theme.tokens.backgroundColor.brand,
        borderColor: theme.tokens.borderColor.brand,
        borderRadius: theme.tokens.borderRadius.md,
        color: theme.tokens.textColor.brand,
        padding: theme.tokens.spacing[4],
      },
      link: { color: theme.tokens.color.blue[500] },
    })
    const alternate = Theme.extend(theme, { spacing: { 4: '2rem' } })
    const output = Css.compile({
      styles: named,
      themes: { alternate, base: theme },
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-alternate{--z-t0-backgroundColor_2e_brand:#fff;--z-t0-borderColor_2e_brand:#000;--z-t0-borderRadius_2e_md:4px;--z-t0-textColor_2e_brand:light-dark(#111,#fff);--z-t0-spacing_2e_4:2rem;--z-t0-color_2e_blue_2e_500:#06c;}
      .z_theme-base{--z-t0-backgroundColor_2e_brand:#fff;--z-t0-borderColor_2e_brand:#000;--z-t0-borderRadius_2e_md:4px;--z-t0-textColor_2e_brand:light-dark(#111,#fff);--z-t0-spacing_2e_4:1rem;--z-t0-color_2e_blue_2e_500:#06c;}
      .z_base0{background-color:var(--z-t0-backgroundColor_2e_brand,#fff);border-color:var(--z-t0-borderColor_2e_brand,#000);border-radius:var(--z-t0-borderRadius_2e_md,4px);padding:var(--z-t0-spacing_2e_4,1rem);}
      .z-card{color:var(--z-t0-textColor_2e_brand,light-dark(#111,#fff));}
      .z-link{color:var(--z-t0-color_2e_blue_2e_500,#06c);}"
    `)
    expect(
      output.css ===
        Css.compile({ styles: explicit, themes: { alternate, base: theme } })
          .css,
    ).toMatchInlineSnapshot('true')
  })

  test('CSS literals and zero precede colliding token names', () => {
    const theme = Theme.define({
      color: { white: '#000' },
      spacing: { 0: '8px', '1rem': '2rem' },
    })
    const styles = Style.define(
      {
        explicit: {
          color: theme.tokens.color.white,
          padding: theme.tokens.spacing[0],
        },
        literal: { color: 'white', padding: 0, width: '1rem' },
      },
      { theme },
    )
    expect(Css.compile({ styles }).css).toMatchInlineSnapshot(`
      ".z-explicit{color:var(--z-t0-color_2e_white,#000);padding:var(--z-t0-spacing_2e_0,8px);}
      .z_base0{width:1rem;}
      .z-literal{color:white;padding:0;}"
    `)
  })

  test('unknown and wrong-domain names fail through the public pipeline', () => {
    const theme = Theme.define({
      color: { brand: '#06c' },
      spacing: { md: '1rem' },
    })
    function compile(style: unknown) {
      const styles = Reflect.apply(Style.define, undefined, [
        { card: style },
        { theme },
      ]) as Style.Definition
      return Css.compile({ styles })
    }
    expect(() =>
      compile({ color: 'missing' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["card","color"]: Expected a hex color, transparent, currentColor, black, or white.]`,
    )
    expect(() => compile({ color: 'md' })).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["card","color"]: Expected a hex color, transparent, currentColor, black, or white.]`,
    )
    expect(() =>
      compile({ padding: 'brand' }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["card","padding"]: Expected a nonnegative literal length or numeric zero.]`,
    )
    expect(() => compile({ padding: 4 })).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: ["card","padding"]: Expected a nonnegative literal length or numeric zero.]`,
    )
  })

  test('named tokens follow inherited theme and scheme changes in Chromium', async () => {
    const theme = Theme.define({
      color: { brand: { dark: '#fff', light: '#111' } },
      spacing: { md: '8px' },
    })
    const alternate = Theme.extend(theme, {
      color: { brand: { dark: '#9cf', light: '#06c' } },
      spacing: { md: '16px' },
    })
    const styles = Style.define(
      { card: { color: 'brand', padding: 'md' } },
      { theme },
    )
    const output = Css.compile({ styles, themes: { alternate, base: theme } })
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({ colorScheme: 'light' })
      await page.setContent(
        `<style>:root{color-scheme:light dark}${output.css}</style><main><div class="${output.classes.card}">Card</div></main>`,
      )
      async function read() {
        return page.locator('div').evaluate((element) => {
          const style = getComputedStyle(element)
          return { color: style.color, padding: style.padding }
        })
      }
      expect(await read()).toMatchInlineSnapshot(`
        {
          "color": "rgb(17, 17, 17)",
          "padding": "8px",
        }
      `)
      await page.locator('main').evaluate((element, scope) => {
        element.setAttribute('class', scope)
      }, output.themes.alternate)
      expect(await read()).toMatchInlineSnapshot(`
        {
          "color": "rgb(0, 102, 204)",
          "padding": "16px",
        }
      `)
      await page.emulateMedia({ colorScheme: 'dark' })
      expect(await read()).toMatchInlineSnapshot(`
        {
          "color": "rgb(153, 204, 255)",
          "padding": "16px",
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('preserves named declarations and cascade-significant order across modules', () => {
    const definition = Style.define(components)
    expect({
      definition,
      repeatMatches:
        JSON.stringify(Style.define(components)) === JSON.stringify(definition),
      roundtripMatches:
        JSON.stringify(JSON.parse(JSON.stringify(definition))) ===
        JSON.stringify(definition),
    }).toMatchInlineSnapshot(`
      {
        "definition": {
          "styles": [
            {
              "declarations": [
                {
                  "property": "display",
                  "value": "flex",
                },
                {
                  "property": "flexDirection",
                  "value": "column",
                },
                {
                  "property": "gap",
                  "value": "0.5rem",
                },
                {
                  "property": "padding",
                  "value": "1rem",
                },
                {
                  "property": "paddingLeft",
                  "value": 0,
                },
                {
                  "property": "marginTop",
                  "value": "-2px",
                },
                {
                  "property": "width",
                  "value": "100%",
                },
                {
                  "property": "maxWidth",
                  "value": "40rem",
                },
                {
                  "property": "backgroundColor",
                  "value": "#fff",
                },
                {
                  "property": "borderWidth",
                  "value": "1px",
                },
                {
                  "property": "borderStyle",
                  "value": "solid",
                },
                {
                  "property": "borderColor",
                  "value": "#0003",
                },
                {
                  "property": "borderRadius",
                  "value": "0.5rem",
                },
              ],
              "name": "card",
            },
            {
              "declarations": [
                {
                  "property": "color",
                  "value": "currentColor",
                },
                {
                  "property": "fontSize",
                  "value": "1rem",
                },
                {
                  "property": "fontWeight",
                  "value": 600,
                },
                {
                  "property": "lineHeight",
                  "value": 1.5,
                },
                {
                  "property": "textAlign",
                  "value": "start",
                },
                {
                  "property": "opacity",
                  "value": 0.8,
                },
              ],
              "name": "label",
            },
            {
              "declarations": [
                {
                  "property": "display",
                  "value": "none",
                },
              ],
              "name": "hidden",
            },
          ],
        },
        "repeatMatches": true,
        "roundtripMatches": true,
      }
    `)
  })

  test('copies input and freezes the entire public data graph', () => {
    const input = { card: { padding: '1rem' as const } }
    const definition = Style.define(input)
    Object.assign(input.card, { padding: '9rem' })
    const objects = [
      definition,
      definition.styles,
      definition.styles[0],
      definition.styles[0]?.declarations,
      definition.styles[0]?.declarations[0],
    ]
    expect({
      frozen: objects.map(Object.isFrozen),
      mutationAccepted: Reflect.set(definition.styles, '0', {}),
      value: definition.styles[0]?.declarations[0]?.value,
    }).toMatchInlineSnapshot(`
      {
        "frozen": [
          true,
          true,
          true,
          true,
          true,
        ],
        "mutationAccepted": false,
        "value": "1rem",
      }
    `)
  })

  test('reports multiple consumer errors with exact paths and optional source spans', () => {
    const location = {
      end: 11,
      path: ['card', 'padding'],
      source: 'consumer.ts',
      start: 10,
    }
    // Diagnostic order follows authored declaration order.
    const failure = diagnose(
      {
        card: { padding: 4, colour: 'red', opacity: Infinity },
        'other.card': { ':hover': {} },
      },
      { locations: [location] },
    )
    location.path[0] = 'changed'
    expect({
      failure,
      frozen:
        'diagnostics' in failure &&
        Object.isFrozen(failure.diagnostics[0]?.path),
    }).toMatchInlineSnapshot(`
      {
        "failure": {
          "diagnostics": [
            {
              "code": "invalid_value",
              "location": {
                "end": 11,
                "path": [
                  "card",
                  "padding",
                ],
                "source": "consumer.ts",
                "start": 10,
              },
              "message": "Expected a nonnegative literal length or numeric zero.",
              "path": [
                "card",
                "padding",
              ],
            },
            {
              "code": "unsupported_property",
              "message": "Unsupported property. This boundary accepts the documented literal subset only.",
              "path": [
                "card",
                "colour",
              ],
            },
            {
              "code": "invalid_value",
              "message": "Expected a finite number from 0 to 1.",
              "path": [
                "card",
                "opacity",
              ],
            },
            {
              "code": "unsupported_property",
              "message": "Unsupported property. This boundary accepts the documented literal subset only.",
              "path": [
                "other.card",
                ":hover",
              ],
            },
          ],
          "name": "Style.InvalidError",
        },
        "frozen": true,
      }
    `)
  })

  test('rejects executable and non-data inputs without invoking accessors', () => {
    let reads = 0
    const input = {
      card: {
        get padding() {
          reads++
          return '1rem'
        },
      },
    }
    const failures = [
      input,
      null,
      [],
      () => ({}),
      new Date(),
      { card: null },
      { card: { [Symbol('color')]: '#fff' } },
    ].map((value) => diagnose(value))
    expect({ failures, reads }).toMatchInlineSnapshot(`
      {
        "failures": [
          {
            "diagnostics": [
              {
                "code": "invalid_structure",
                "message": "Only enumerable string-keyed data properties are supported; accessors and symbols are not evaluated.",
                "path": [
                  "card",
                  "padding",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_structure",
                "message": "Expected a plain object with enumerable data properties.",
                "path": [],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_structure",
                "message": "Expected a plain object with enumerable data properties.",
                "path": [],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_structure",
                "message": "Expected a plain object with enumerable data properties.",
                "path": [],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_structure",
                "message": "Expected a plain object with enumerable data properties.",
                "path": [],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_structure",
                "message": "Expected a plain object with enumerable data properties.",
                "path": [
                  "card",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_structure",
                "message": "Only enumerable string-keyed data properties are supported; accessors and symbols are not evaluated.",
                "path": [
                  "card",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
        ],
        "reads": 0,
      }
    `)
  })

  test('accepts empty definitions and null-prototype data without interpreting style names', () => {
    const input = Object.assign(
      Object.create(null) as Record<string, Style.Properties>,
      {
        constructor: { color: '#abcdef' as const },
        toString: { margin: 'auto' as const },
      },
    )
    expect({
      empty: Style.define({}),
      emptyStyle: Style.define({ empty: {} }),
      nullPrototype: Style.define(input),
    }).toMatchInlineSnapshot(`
      {
        "empty": {
          "styles": [],
        },
        "emptyStyle": {
          "styles": [
            {
              "declarations": [],
              "name": "empty",
            },
          ],
        },
        "nullPrototype": {
          "styles": [
            {
              "declarations": [
                {
                  "property": "color",
                  "value": "#abcdef",
                },
              ],
              "name": "constructor",
            },
            {
              "declarations": [
                {
                  "property": "margin",
                  "value": "auto",
                },
              ],
              "name": "toString",
            },
          ],
        },
      }
    `)
  })

  test('validates supported value domains before returning any definition', () => {
    const accepted = Style.define({
      card: {
        color: '#ABCDEF80',
        display: 'revert-layer',
        fontWeight: 1000,
        margin: '-0.5rem',
        opacity: 0,
        padding: '1e2px',
        width: '50%',
      },
    })
    const invalid: readonly unknown[] = [
      { padding: '-1px' },
      { padding: '1.px' },
      { padding: '1e999px' },
      { borderWidth: '10%' },
      { opacity: NaN },
      { opacity: 2 },
      { color: '#abcdz' },
      { color: 'blue.700' },
      { fontWeight: 0 },
      { padding: undefined },
      { display: { fallback: 'block' } },
      { color: '#fff!!' },
      { width: 'calc(100% - 1rem)' },
      { padding: { token: 'sm' } },
    ]
    expect({
      accepted,
      rejected: invalid.map((card) => diagnose({ card })),
    }).toMatchInlineSnapshot(`
      {
        "accepted": {
          "styles": [
            {
              "declarations": [
                {
                  "property": "color",
                  "value": "#ABCDEF80",
                },
                {
                  "property": "display",
                  "value": "revert-layer",
                },
                {
                  "property": "fontWeight",
                  "value": 1000,
                },
                {
                  "property": "margin",
                  "value": "-0.5rem",
                },
                {
                  "property": "opacity",
                  "value": 0,
                },
                {
                  "property": "padding",
                  "value": "1e2px",
                },
                {
                  "property": "width",
                  "value": "50%",
                },
              ],
              "name": "card",
            },
          ],
        },
        "rejected": [
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a nonnegative literal length or numeric zero.",
                "path": [
                  "card",
                  "padding",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a nonnegative literal length or numeric zero.",
                "path": [
                  "card",
                  "padding",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a nonnegative literal length or numeric zero.",
                "path": [
                  "card",
                  "padding",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a nonnegative literal length or numeric zero.",
                "path": [
                  "card",
                  "borderWidth",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a finite number from 0 to 1.",
                "path": [
                  "card",
                  "opacity",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a finite number from 0 to 1.",
                "path": [
                  "card",
                  "opacity",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a hex color, transparent, currentColor, black, or white.",
                "path": [
                  "card",
                  "color",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a hex color, transparent, currentColor, black, or white.",
                "path": [
                  "card",
                  "color",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a finite number from 1 to 1000.",
                "path": [
                  "card",
                  "fontWeight",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a nonnegative literal length or numeric zero.",
                "path": [
                  "card",
                  "padding",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected one of: block, flex, grid, inline, inline-block, inline-flex, inline-grid, none (or a CSS-wide keyword).",
                "path": [
                  "card",
                  "display",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a hex color, transparent, currentColor, black, or white.",
                "path": [
                  "card",
                  "color",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a nonnegative literal length, auto, or numeric zero.",
                "path": [
                  "card",
                  "width",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
          {
            "diagnostics": [
              {
                "code": "invalid_value",
                "message": "Expected a nonnegative literal length or numeric zero.",
                "path": [
                  "card",
                  "padding",
                ],
              },
            ],
            "name": "Style.InvalidError",
          },
        ],
      }
    `)
  })

  test('preserves numeric names through public authoring', () => {
    expect(Style.define({ 0: { color: '#fff' }, 1.5: { padding: 0 } }))
      .toMatchInlineSnapshot(`
    {
      "styles": [
        {
          "declarations": [
            {
              "property": "color",
              "value": "#fff",
            },
          ],
          "name": "0",
        },
        {
          "declarations": [
            {
              "property": "padding",
              "value": 0,
            },
          ],
          "name": "1.5",
        },
      ],
    }
  `)
  })

  test('accepts cross-realm records while rejecting class instances without reading getters', () => {
    const foreign: unknown = Vm.runInNewContext(`({
    card: { color: '#fff', padding: 0 },
  })`)
    const nested: unknown = { card: Vm.runInNewContext("({ color: '#fff' })") }
    const instances: readonly unknown[] = Vm.runInNewContext(`[
    new (class Card { color = '#fff' })(),
    new Date(),
    Object.create({ color: '#fff' }),
    new (class Card extends null { constructor() {
      return Object.create(new.target.prototype)
    } })(),
  ]`)
    let reads = 0
    const prototype = Object.create(null) as object
    Object.defineProperty(prototype, 'constructor', {
      get() {
        reads++
        return Object
      },
    })
    const rejected = [...instances, Object.create(prototype)].map((card) =>
      diagnose({ card }),
    )
    expect({
      foreign: diagnose(foreign),
      nested: diagnose(nested),
      reads,
      rejected,
    }).toMatchInlineSnapshot(`
    {
      "foreign": {
        "styles": [
          {
            "declarations": [
              {
                "property": "color",
                "value": "#fff",
              },
              {
                "property": "padding",
                "value": 0,
              },
            ],
            "name": "card",
          },
        ],
      },
      "nested": {
        "styles": [
          {
            "declarations": [
              {
                "property": "color",
                "value": "#fff",
              },
            ],
            "name": "card",
          },
        ],
      },
      "reads": 0,
      "rejected": [
        {
          "diagnostics": [
            {
              "code": "invalid_structure",
              "message": "Expected a plain object with enumerable data properties.",
              "path": [
                "card",
              ],
            },
          ],
          "name": "Style.InvalidError",
        },
        {
          "diagnostics": [
            {
              "code": "invalid_structure",
              "message": "Expected a plain object with enumerable data properties.",
              "path": [
                "card",
              ],
            },
          ],
          "name": "Style.InvalidError",
        },
        {
          "diagnostics": [
            {
              "code": "invalid_structure",
              "message": "Expected a plain object with enumerable data properties.",
              "path": [
                "card",
              ],
            },
          ],
          "name": "Style.InvalidError",
        },
        {
          "diagnostics": [
            {
              "code": "invalid_structure",
              "message": "Expected a plain object with enumerable data properties.",
              "path": [
                "card",
              ],
            },
          ],
          "name": "Style.InvalidError",
        },
        {
          "diagnostics": [
            {
              "code": "invalid_structure",
              "message": "Expected a plain object with enumerable data properties.",
              "path": [
                "card",
              ],
            },
          ],
          "name": "Style.InvalidError",
        },
      ],
    }
  `)
  })

  const portableSource = `import { Style } from 'zyzz'; import { Css } from 'zyzz/web';
export const result = Css.compile({ styles: Style.define({ button: { color: '#f00', padding: 0 } }) });`

  async function portableBundle() {
    const bundle = await Esbuild.build({
      bundle: true,
      conditions: ['src'],
      format: 'iife',
      globalName: 'fixture',
      metafile: true,
      platform: 'browser',
      stdin: {
        contents: portableSource,
        resolveDir: Path.resolve(import.meta.dirname, '..'),
      },
      target: 'es2022',
      write: false,
    })

    expect(
      Object.keys(bundle.metafile.inputs).filter((path) =>
        /oxc|compiler|node:|themes/.test(path),
      ),
    ).toMatchInlineSnapshot('[]')
    return bundle.outputFiles[0]!.text
  }

  test('the pure compilation pipeline agrees in Node, a worker, and QuickJS', async () => {
    const code = await portableBundle()
    const server = Vm.runInNewContext(`${code}; JSON.stringify(fixture.result)`)
    expect(JSON.parse(server)).toMatchInlineSnapshot(`
    {
      "classes": {
        "button": "z_base0",
      },
      "css": ".z_base0{color:#f00;padding:0;}",
      "themes": {},
    }
  `)

    const worker = new Worker.Worker(
      `${code}; require('node:worker_threads').parentPort.postMessage(JSON.stringify(fixture.result));`,
      { eval: true },
    )
    try {
      const result = await new Promise<string>((resolve, reject) => {
        worker.once('error', reject)
        worker.once('message', resolve)
      })
      expect(JSON.parse(result)).toMatchInlineSnapshot(`
      {
        "classes": {
          "button": "z_base0",
        },
        "css": ".z_base0{color:#f00;padding:0;}",
        "themes": {},
      }
    `)
    } finally {
      await worker.terminate()
    }

    const engine = await getQuickJS()
    const context = engine.newContext()
    try {
      const result = context.unwrapResult(
        context.evalCode(`${code}; JSON.stringify(fixture.result)`),
      )
      try {
        expect(JSON.parse(context.getString(result))).toMatchInlineSnapshot(`
      {
        "classes": {
          "button": "z_base0",
        },
        "css": ".z_base0{color:#f00;padding:0;}",
        "themes": {},
      }
    `)
      } finally {
        result.dispose()
      }
    } finally {
      context.dispose()
    }
  })

  test('the pure compilation pipeline runs in Chromium and a browser worker', async () => {
    const code = await portableBundle()
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.addScriptTag({ content: code })
      expect(await page.evaluate('fixture.result')).toMatchInlineSnapshot(`
      {
        "classes": {
          "button": "z_base0",
        },
        "css": ".z_base0{color:#f00;padding:0;}",
        "themes": {},
      }
    `)

      const result = await page.evaluate(async (code) => {
        const url = URL.createObjectURL(
          new Blob([code + '; postMessage(fixture.result);'], {
            type: 'text/javascript',
          }),
        )
        const worker = new globalThis.Worker(url)
        try {
          return await new Promise((resolve, reject) => {
            worker.onmessage = (event) => resolve(event.data)
            worker.onerror = (event) => reject(new Error(event.message))
          })
        } finally {
          worker.terminate()
          URL.revokeObjectURL(url)
        }
      }, code)
      expect(result).toMatchInlineSnapshot(`
      {
        "classes": {
          "button": "z_base0",
        },
        "css": ".z_base0{color:#f00;padding:0;}",
        "themes": {},
      }
    `)
    } finally {
      await browser.close()
    }
  })
})
