import { Style } from 'typestyle'
import { describe, expect, test } from 'vite-plus/test'
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

describe('consumer authoring through immutable definitions', () => {
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
      { display: ['block', 'grid'] },
      { color: '#fff!' },
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
})
