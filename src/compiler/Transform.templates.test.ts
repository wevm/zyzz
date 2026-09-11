/** Verifies static templates through extraction, emission, executable output, and browser styles. @module */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Source, Transform } from 'zyzz/compiler'
import * as Templates from '../../test/fixtures/Templates.js'

describe('compile', () => {
  test('folds negative bigint substitutions without losing precision', () => {
    const output = Transform.compile({
      moduleId: 'bigint.ts',
      source:
        'import { css } from "zyzz"; css({ marginLeft: `${-12n}px`, "--large": `${-9007199254740993n}`, "--zero": `${-0n}` })',
    })

    expect(output.css).toMatchInlineSnapshot(
      `".z-1hxpdr579toep-base0{margin-left:-12px;--large:-9007199254740993;--zero:0;}"`,
    )
  })

  test('bounds nested template extraction', () => {
    const nested = (count: number) =>
      '`'.concat('${`'.repeat(count), '8', '`}'.repeat(count), '`')

    expect(
      Transform.compile({
        moduleId: 'depth.ts',
        source:
          'import { css } from "zyzz"; css({ "--value": ' + nested(127) + ' })',
      }).css,
    ).toMatchInlineSnapshot(`".z-1948yv52aoftj-base0{--value:8;}"`)
    expect(() =>
      Transform.compile({
        moduleId: 'depth.ts',
        source:
          'import { css } from "zyzz"; css({ "--value": ' + nested(128) + ' })',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: depth.ts:45: Expected a literal string or number; expressions are not evaluated.]`,
    )
  })

  test('folds primitive templates with the same CSS as ordinary strings', async () => {
    const output = Transform.compile({
      moduleId: 'templates.ts',
      source: Templates.source,
    })

    expect(output.css).toMatchInlineSnapshot(
      `".z-1nogkwjo2b0vl-base0{color:red;content:"true:null:12";margin-left:-2px;padding:4px;padding:8px!important;width:calc(100% - 16px);}"`,
    )

    const literal = Transform.compile({
      moduleId: 'templates.ts',
      source: `import { css } from 'zyzz'; export const box = css({ color: 'red', content: '"true:null:12"', marginLeft: '-2px', padding: ['4px', '8px!'], width: 'calc(100% - 16px)' })()`,
    })

    expect(output.css === literal.css).toMatchInlineSnapshot(`true`)
    expect(output.code.includes('${')).toMatchInlineSnapshot(`false`)

    const js = await Esbuild.transform(output.code, {
      format: 'esm',
      loader: 'ts',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )

    expect(module.box).toMatchInlineSnapshot(`
      {
        "className": "z-1nogkwjo2b0vl-base0",
      }
    `)
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.map), {
        line: 2,
        column: 0,
      }).source,
    ).toMatchInlineSnapshot(`"templates.ts"`)
  })

  test('preserves cooked escapes, empty text, and bound token resolution', () => {
    const source = [
      "import { Theme } from 'zyzz'",
      "const theme = Theme.define({ color: { brand: '#06c' } })",
      'export const box = theme.css({ color: `br${"and"}`, content: `"\\u0041"`, "--empty": `` })()',
    ].join('\n')

    expect(Transform.compile({ moduleId: 'theme.ts', source }).css)
      .toMatchInlineSnapshot(`
      ".z_theme-1xn44ix111xh3v-theme{--z-t1xn44ix111xh3v-theme-color_2e_brand:#06c;}
      .z-1xn44ix111xh3v-base0{color:var(--z-t1xn44ix111xh3v-theme-color_2e_brand,#06c);content:"A";--empty:;}"
    `)
  })

  test('reports exact diagnostics for unsupported template expressions', () => {
    const diagnostics = [
      'unknown',
      '(()=>{throw Error("executed")})()',
      '({toString(){throw Error("executed")}})',
      '[]',
      '/x/',
      '1e999',
      '+12n',
      'String.raw`x`',
      '1 + 2',
    ].map((expression) => {
      const source =
        'import { css } from "zyzz"; css({ width: `${' + expression + '}px` })'

      try {
        Transform.compile({ moduleId: 'invalid.ts', source })
        throw new Error('Expected extraction failure')
      } catch (error) {
        if (!(error instanceof Source.ExtractError)) throw error

        return error.diagnostics
      }
    })

    expect(diagnostics).toMatchInlineSnapshot(`
      [
        [
          {
            "code": "unsupported_syntax",
            "end": 55,
            "message": "Expected a literal string or number; expressions are not evaluated.",
            "source": "invalid.ts",
            "start": 41,
          },
        ],
        [
          {
            "code": "unsupported_syntax",
            "end": 81,
            "message": "Expected a literal string or number; expressions are not evaluated.",
            "source": "invalid.ts",
            "start": 41,
          },
        ],
        [
          {
            "code": "unsupported_syntax",
            "end": 81,
            "message": "Static data requires literal property keys without methods.",
            "source": "invalid.ts",
            "start": 46,
          },
        ],
        [
          {
            "code": "unsupported_syntax",
            "end": 50,
            "message": "Expected a literal string or number; expressions are not evaluated.",
            "source": "invalid.ts",
            "start": 41,
          },
        ],
        [
          {
            "code": "unsupported_syntax",
            "end": 51,
            "message": "Expected a literal string or number; expressions are not evaluated.",
            "source": "invalid.ts",
            "start": 41,
          },
        ],
        [
          {
            "code": "unsupported_syntax",
            "end": 53,
            "message": "Expected a literal string or number; expressions are not evaluated.",
            "source": "invalid.ts",
            "start": 41,
          },
        ],
        [
          {
            "code": "unsupported_syntax",
            "end": 52,
            "message": "Expected a literal string or number; expressions are not evaluated.",
            "source": "invalid.ts",
            "start": 41,
          },
        ],
        [
          {
            "code": "unsupported_syntax",
            "end": 61,
            "message": "Expected a literal string or number; expressions are not evaluated.",
            "source": "invalid.ts",
            "start": 41,
          },
        ],
        [
          {
            "code": "unsupported_syntax",
            "end": 53,
            "message": "Expected a literal string or number; expressions are not evaluated.",
            "source": "invalid.ts",
            "start": 41,
          },
        ],
      ]
    `)
  })

  test('matches native CSS for template fallbacks, math, and importance', async () => {
    const output = Transform.compile({
      moduleId: 'templates.ts',
      source: Templates.source,
    })
    const js = await Esbuild.transform(output.code, {
      format: 'esm',
      loader: 'ts',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${output.css}</style><div style="width:400px"><div id="actual" class="${module.box.className}" style="padding:1px"></div><div id="control" style="color:red;content:'true:null:12';margin-left:-2px;padding:8px!important;width:calc(100% - 16px)"></div></div>`,
      )

      expect(
        await page.evaluate(() => {
          const actual = getComputedStyle(document.getElementById('actual')!)
          const control = getComputedStyle(document.getElementById('control')!)

          return ['color', 'content', 'margin-left', 'padding', 'width'].filter(
            (property) =>
              actual.getPropertyValue(property) !==
              control.getPropertyValue(property),
          )
        }),
      ).toMatchInlineSnapshot(`[]`)
    } finally {
      await browser.close()
    }
  })
})
