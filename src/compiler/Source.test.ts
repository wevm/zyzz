/**
 * Exercises the public Source workflow through real collaborating modules.
 * @module
 */
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Source } from 'zyzz/compiler'
import { Css } from 'zyzz/web'

describe('extract', () => {
  test('parameter initializers preserve imports across body hoisting and nested closures', () => {
    const source = `import { css } from 'zyzz';
const text = '🎉';
function button(style = css({ color: '#f00' })) { var css; }
function closure(style = () => css({ color: '#f00' })) { if (true) { var css; } }
const arrow = (style = css({ color: '#f00' })) => { var css; };
const named = function css(style = css({ color: unknown })) { var css; };
function parameter(css, style = css({ color: unknown })) { var css; }
function later(style = css({ color: unknown }), css) {}
function destructured({ css }, style = css({ color: unknown })) {}
function body() { css({ color: unknown }); if (true) { var css; } }
function local() { css({ color: unknown }); const css = unknown; }
type Signature = <T>(value: T) => T;
export type { css };
export { type css as StyleFunction };
export { css as external } from 'another-package';
function afterType(style = css({ color: '#f00' })) { var css; }
`

    const result = Source.extract({ moduleId: 'example/parameters.ts', source })
    const output = Css.compile({ styles: result.styles })

    expect({
      calls: result.calls.map((call) => source.slice(call.start, call.end)),
      css: output.css,
    }).toMatchInlineSnapshot(`
    {
      "calls": [
        "css({ color: '#f00' })",
        "css({ color: '#f00' })",
        "css({ color: '#f00' })",
        "css({ color: '#f00' })",
      ],
      "css": ".z_base0{color:#f00;}",
    }
  `)
  })

  test('imported assignments and indirect references fail before CSS emission', () => {
    const source = `import { css } from 'zyzz';
import { css as Css } from 'zyzz';
({ css } = values);
[css] = values;
css++;
for (css of values) {}
export { css };
const object = { css };
const element = <Css />;
`

    try {
      const result = Source.extract({ moduleId: 'example/writes.ts', source })

      Css.compile({ styles: result.styles })
      throw new Error('Expected extraction failure')
    } catch (error) {
      if (!(error instanceof Source.ExtractError)) throw error

      expect(
        error.diagnostics.map((item) => ({
          code: item.code,
          message: item.message,
          text: source.slice(item.start, item.end),
        })),
      ).toMatchInlineSnapshot(`
      [
        {
          "code": "unsupported_syntax",
          "message": "Imported css bindings cannot be reassigned.",
          "text": "{ css } = values",
        },
        {
          "code": "unsupported_syntax",
          "message": "Imported css bindings cannot be reassigned.",
          "text": "[css] = values",
        },
        {
          "code": "unsupported_syntax",
          "message": "Imported css bindings cannot be reassigned.",
          "text": "css++",
        },
        {
          "code": "unsupported_syntax",
          "message": "Imported css bindings cannot be reassigned.",
          "text": "for (css of values) {}",
        },
        {
          "code": "unsupported_syntax",
          "message": "Use a direct css call; aliases, re-exports, and indirect references are not supported yet.",
          "text": "css",
        },
        {
          "code": "unsupported_syntax",
          "message": "Use a direct css call; aliases, re-exports, and indirect references are not supported yet.",
          "text": "css",
        },
        {
          "code": "unsupported_syntax",
          "message": "Use a direct css call; aliases, re-exports, and indirect references are not supported yet.",
          "text": "Css",
        },
      ]
    `)
    }
  })

  test('source bindings extract ordered literals without executing application code', () => {
    const source = `import { css as define } from 'zyzz';
throw new Error('Application source must never execute');
export const card = define({ padding: '8px', paddingLeft: 0 });
function nested(define) { return define({ padding: unknown }); }
function css(value) { return value; }
css({ color: unknown });
export const view = <div {...define({ color: '#fff', opacity: +0.5 })()} />;
type Definition = ReturnType<typeof define>;
`

    const result = Source.extract({ moduleId: 'example/card.tsx', source })
    const output = Css.compile({ styles: result.styles })

    expect({
      calls: result.calls.map((call) => source.slice(call.start, call.end)),
      declarations: result.styles.styles.map((style) => style.declarations),
      frozen:
        Object.isFrozen(result) &&
        Object.isFrozen(result.calls) &&
        Object.isFrozen(result.styles.styles),
      repeated: Source.extract({ moduleId: 'example/card.tsx', source }),
      rules: output.css,
    }).toMatchInlineSnapshot(`
      {
        "calls": [
          "define({ padding: '8px', paddingLeft: 0 })",
          "define({ color: '#fff', opacity: +0.5 })",
        ],
        "declarations": [
          [
            {
              "property": "padding",
              "value": "8px",
            },
            {
              "property": "paddingLeft",
              "value": 0,
            },
          ],
          [
            {
              "property": "color",
              "value": "#fff",
            },
            {
              "property": "opacity",
              "value": 0.5,
            },
          ],
        ],
        "frozen": true,
        "repeated": {
          "calls": [
            {
              "end": 158,
              "name": "style-16i62vd1bo8k8l-116",
              "start": 116,
            },
            {
              "end": 357,
              "name": "style-16i62vd1bo8k8l-317",
              "start": 317,
            },
          ],
          "styles": {
            "styles": [
              {
                "declarations": [
                  {
                    "property": "padding",
                    "value": "8px",
                  },
                  {
                    "property": "paddingLeft",
                    "value": 0,
                  },
                ],
                "name": "style-16i62vd1bo8k8l-116",
              },
              {
                "declarations": [
                  {
                    "property": "color",
                    "value": "#fff",
                  },
                  {
                    "property": "opacity",
                    "value": 0.5,
                  },
                ],
                "name": "style-16i62vd1bo8k8l-317",
              },
            ],
          },
          "themeAliases": [],
          "themeCalls": [],
          "themeReferences": [],
          "themes": {},
        },
        "rules": ".z_base1{padding:8px;padding-left:0;}
      .z_base0{color:#fff;opacity:0.5;}",
      }
    `)
  })

  test('renamed imports retain source order and isolate portable module identities', () => {
    const source = `import { css as second } from 'zyzz'; import { css as first } from 'zyzz';
const a = first({ marginTop: '-2px' } as const); const b = second({ lineHeight: 1.5 } satisfies {});`
    const first = Source.extract({ moduleId: '@example/ui/card.ts', source })
    const second = Source.extract({ moduleId: '@example/ui/other.ts', source })

    expect({
      calls: first.calls.map((call) => source.slice(call.start, call.end)),
      distinct: first.calls.every(
        (call, index) => call.name !== second.calls[index]?.name,
      ),
      styles: first.styles.styles.map((style) => style.declarations),
    }).toMatchInlineSnapshot(`
    {
      "calls": [
        "first({ marginTop: '-2px' } as const)",
        "second({ lineHeight: 1.5 } satisfies {})",
      ],
      "distinct": true,
      "styles": [
        [
          {
            "property": "marginTop",
            "value": "-2px",
          },
        ],
        [
          {
            "property": "lineHeight",
            "value": 1.5,
          },
        ],
      ],
    }
  `)
    expect(
      Source.extract({
        moduleId: 'example/empty.ts',
        source: 'const css = (x) => x; css({ anything: unknown });',
      }),
    ).toMatchInlineSnapshot(`
      {
        "calls": [],
        "styles": {
          "styles": [],
        },
        "themeAliases": [],
        "themeCalls": [],
        "themeReferences": [],
        "themes": {},
      }
    `)
  })

  test('unsupported source produces located diagnostics without partial artifacts', () => {
    const source = `import { css } from 'zyzz';
css({ padding: 4 });
css({ ...defaults });
css(() => ({ color: '#fff' }));
css(external);
css({ color: execute() });
css({ get color() { throw new Error('never execute') } });
css({ padding: 0, padding: '1px' });
const alias = css;
css?.({ padding: 0 });
css({ padding });
css({ ['color']: '#fff' });
css = unknown;
import * as Zyzz from 'zyzz';
Zyzz.css({ padding: 0 });
`

    try {
      Source.extract({ moduleId: 'example/errors.ts', source })
      throw new Error('Expected extraction failure')
    } catch (error) {
      if (!(error instanceof Source.ExtractError)) throw error

      expect({
        diagnostics: error.diagnostics.map((item) => ({
          ...item,
          text: source.slice(item.start, item.end),
        })),
        frozen:
          Object.isFrozen(error.diagnostics) &&
          error.diagnostics.every(Object.isFrozen),
        name: error.name,
      }).toMatchInlineSnapshot(`
        {
          "diagnostics": [
            {
              "code": "unsupported_syntax",
              "end": 66,
              "message": "Static spreads require an immutable object literal.",
              "source": "example/errors.ts",
              "start": 55,
              "text": "...defaults",
            },
            {
              "code": "unsupported_syntax",
              "end": 100,
              "message": "Dynamic styles require one typed values parameter.",
              "source": "example/errors.ts",
              "start": 75,
              "text": "() => ({ color: '#fff' })",
            },
            {
              "code": "unsupported_syntax",
              "end": 116,
              "message": "Expected one literal object or typed callback; spreads and referenced definitions are not supported.",
              "source": "example/errors.ts",
              "start": 103,
              "text": "css(external)",
            },
            {
              "code": "unsupported_syntax",
              "end": 140,
              "message": "Expected a literal string or number; expressions are not evaluated.",
              "source": "example/errors.ts",
              "start": 131,
              "text": "execute()",
            },
            {
              "code": "unsupported_syntax",
              "end": 199,
              "message": "Static data requires literal property keys without methods.",
              "source": "example/errors.ts",
              "start": 151,
              "text": "get color() { throw new Error('never execute') }",
            },
            {
              "code": "unsupported_syntax",
              "end": 258,
              "message": "Use a direct css call; aliases, re-exports, and indirect references are not supported yet.",
              "source": "example/errors.ts",
              "start": 255,
              "text": "css",
            },
            {
              "code": "unsupported_syntax",
              "end": 263,
              "message": "Use a direct css call; aliases, re-exports, and indirect references are not supported yet.",
              "source": "example/errors.ts",
              "start": 260,
              "text": "css",
            },
            {
              "code": "unsupported_syntax",
              "end": 296,
              "message": "Expected a literal string or number; expressions are not evaluated.",
              "source": "example/errors.ts",
              "start": 289,
              "text": "padding",
            },
            {
              "code": "unsupported_syntax",
              "end": 324,
              "message": "Only explicit literal properties are supported; spreads, computed keys, shorthand, and methods are not evaluated.",
              "source": "example/errors.ts",
              "start": 307,
              "text": "['color']: '#fff'",
            },
            {
              "code": "unsupported_syntax",
              "end": 342,
              "message": "Imported css bindings cannot be reassigned.",
              "source": "example/errors.ts",
              "start": 329,
              "text": "css = unknown",
            },
            {
              "code": "unsupported_syntax",
              "end": 382,
              "message": "Import css by name; namespace authoring calls are not supported yet.",
              "source": "example/errors.ts",
              "start": 374,
              "text": "Zyzz.css",
            },
          ],
          "frozen": true,
          "name": "Source.ExtractError",
        }
      `)
    }
  })

  test('syntax and module identity failures remain source owned', () => {
    const errors = [
      '/absolute.ts',
      'C:\\file.ts',
      'example/../file.ts',
      '',
    ].map((moduleId) => {
      try {
        Source.extract({ moduleId, source: '' })
        throw new Error('Expected invalid module ID')
      } catch (error) {
        if (!(error instanceof Source.ExtractError)) throw error

        return error.diagnostics
      }
    })

    expect(errors).toMatchInlineSnapshot(`
    [
      [
        {
          "code": "invalid_module",
          "end": 0,
          "message": "Expected a portable package-relative module ID without absolute paths, backslashes, or traversal segments.",
          "source": "/absolute.ts",
          "start": 0,
        },
      ],
      [
        {
          "code": "invalid_module",
          "end": 0,
          "message": "Expected a portable package-relative module ID without absolute paths, backslashes, or traversal segments.",
          "source": "C:\\file.ts",
          "start": 0,
        },
      ],
      [
        {
          "code": "invalid_module",
          "end": 0,
          "message": "Expected a portable package-relative module ID without absolute paths, backslashes, or traversal segments.",
          "source": "example/../file.ts",
          "start": 0,
        },
      ],
      [
        {
          "code": "invalid_module",
          "end": 0,
          "message": "Expected a portable package-relative module ID without absolute paths, backslashes, or traversal segments.",
          "source": "",
          "start": 0,
        },
      ],
    ]
  `)

    try {
      Source.extract({
        moduleId: 'example/broken.ts',
        source: 'export const =',
      })
      throw new Error('Expected parse failure')
    } catch (error) {
      if (!(error instanceof Source.ExtractError)) throw error

      expect(error.diagnostics).toMatchInlineSnapshot(`
      [
        {
          "code": "syntax_error",
          "end": 14,
          "message": "Unexpected token",
          "source": "example/broken.ts",
          "start": 13,
        },
      ]
    `)
    }
  })

  test('extracted definitions render authored shorthand and override order in Chromium', async () => {
    const extracted = Source.extract({
      moduleId: 'example/cascade.tsx',
      source: `import { css } from 'zyzz';
const first = css({ color: '#000', padding: '8px', paddingLeft: 0 });
const middle = css({ color: '#fff', paddingLeft: '3px' });
const last = css({ color: '#000', padding: '8px', paddingLeft: 0 });`,
    })

    const output = Css.compile({ styles: extracted.styles })
    const classes = extracted.calls.map((call) => output.classes[call.name]!)
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent('<!doctype html><body></body>')
      await page.addStyleTag({ content: output.css })

      const result = await page.evaluate(
        (classes) =>
          [`${classes[1]} ${classes[0]}`, `${classes[2]} ${classes[1]}`].map(
            (className) => {
              const element = document.createElement('div')

              element.className = className
              document.body.append(element)

              const computed = getComputedStyle(element)

              return { color: computed.color, padding: computed.padding }
            },
          ),
        classes,
      )

      expect(result).toMatchInlineSnapshot(`
      [
        {
          "color": "rgb(255, 255, 255)",
          "padding": "8px 8px 8px 3px",
        },
        {
          "color": "rgb(0, 0, 0)",
          "padding": "8px 8px 8px 0px",
        },
      ]
    `)
    } finally {
      await browser.close()
    }
  })
})
