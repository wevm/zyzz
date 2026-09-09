/**
 * Exercises the public Transform workflow through real collaborating modules.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import * as Borders from '../../test/fixtures/Borders.js'
import * as Declarations from '../../test/fixtures/Declarations.js'
import * as Flex from '../../test/fixtures/Flex.js'
import * as Lengths from '../../test/fixtures/Lengths.js'
import * as Logical from '../../test/fixtures/Logical.js'

const root = Path.resolve(import.meta.dirname, '../..')

describe('compile', () => {
  test('border source tokens and mixed physical/logical priority render in the browser', async () => {
    const output = Transform.compile({
      moduleId: 'example/borders.ts',
      source: Borders.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>div{width:100px;height:100px}${output.css}</style><main><div id="box" class="${module.box.className}"></div><div id="control" style="border-style:solid;border-width:2px;border-left-width:3px;border-inline-start-width:4px;border-inline-start-width:5px!important;border-color:#06c;border-inline-end-color:#fff;border-radius:8px;border-start-start-radius:10px;outline-color:#fff;outline-style:dashed;outline-width:2px;outline-offset:-1px"></div></main>`,
      )
      for (const writingMode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'])
        for (const direction of ['ltr', 'rtl']) {
          await page.locator('main').evaluate(
            (element, values) => {
              element.style.writingMode = values.writingMode
              element.style.direction = values.direction
            },
            { writingMode, direction },
          )
          expect(
            await page.evaluate(() => {
              const actual = getComputedStyle(document.getElementById('box')!)
              const expected = getComputedStyle(
                document.getElementById('control')!,
              )
              return [
                'border-top-width',
                'border-left-width',
                'border-bottom-width',
                'border-right-width',
                'border-top-color',
                'border-left-color',
                'border-bottom-color',
                'border-right-color',
                'border-top-left-radius',
                'border-top-right-radius',
                'border-bottom-left-radius',
                'border-bottom-right-radius',
                'outline-color',
                'outline-width',
                'outline-style',
                'outline-offset',
              ].filter(
                (property) =>
                  actual.getPropertyValue(property) !==
                  expected.getPropertyValue(property),
              )
            }),
          ).toMatchInlineSnapshot(`[]`)
        }
    } finally {
      await browser.close()
    }
  })

  test('border tokens, priority, and per-entry source maps survive compilation', () => {
    const output = Transform.compile({
      moduleId: 'example/borders.ts',
      source: Borders.source,
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-1qal89srxpye2-zyzz-theme{--z-t1qal89srxpye2-zyzz-borderColor_2e_brand:#06c;--z-t1qal89srxpye2-zyzz-color_2e_brand:#fff;--z-t1qal89srxpye2-zyzz-borderRadius_2e_round:8px;}
      .z-1qal89srxpye2-base1{border-style:solid;border-color:var(--z-t1qal89srxpye2-zyzz-borderColor_2e_brand,#06c);border-inline-end-color:var(--z-t1qal89srxpye2-zyzz-color_2e_brand,#fff);border-radius:var(--z-t1qal89srxpye2-zyzz-borderRadius_2e_round,8px);border-start-start-radius:10px;outline-color:var(--z-t1qal89srxpye2-zyzz-color_2e_brand,#fff);outline-style:dashed;outline-width:2px;outline-offset:-1px;}
      .z-style-1qal89srxpye2-169{border-width:2px;border-left-width:3px;border-inline-start-width:4px;border-inline-start-width:5px!important;}
      .z-1qal89srxpye2-base0{border-style:solid;}
      .z-style-1qal89srxpye2-524{border-width:2px;border-inline-start-width:5px;border-left-width:3px;}"
    `)
    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('border-inline-start-width:5px'),
    )
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('border-inline-start-width:5px'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 92,
        "line": 4,
        "name": "borderInlineStartWidth",
        "source": "example/borders.ts",
      }
    `)
  })

  test('border and outline sources reject percentages and invalid scalar bounds', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import { css } from 'zyzz'; css({borderLeftWidth:'10%',borderBlockWidth:'5%',outlineWidth:'2%',outlineOffset:'4%',borderEndStartRadius:'-1px'});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: invalid.ts:49: Expected a nonnegative literal length or numeric zero.
      invalid.ts:72: Expected a nonnegative literal length or numeric zero.
      invalid.ts:90: Expected a nonnegative literal length or numeric zero.
      invalid.ts:109: Expected a literal length or numeric zero.
      invalid.ts:135: Expected a nonnegative literal length or numeric zero.]
    `)
  })

  test('flex sizing and overflow preserve tokens, importance, and maps', () => {
    const output = Transform.compile({
      moduleId: 'example/flex.ts',
      source: Flex.source,
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-bjw6jw1i067e2-zyzz-theme{--z-tbjw6jw1i067e2-zyzz-spacing_2e_item:60px;}
      .z-bjw6jw1i067e2-base0{display:flex;flex-wrap:wrap;align-content:space-between;align-items:flex-start;}
      .z-style-bjw6jw1i067e2-122{width:180px;height:100px;}
      .z-bjw6jw1i067e2-base1{flex-basis:40px;flex-basis:var(--z-tbjw6jw1i067e2-zyzz-spacing_2e_item,60px);flex-grow:0;flex-shrink:0;align-self:flex-end;order:-1!important;}
      .z-style-bjw6jw1i067e2-265{height:20px;}
      .z-style-bjw6jw1i067e2-421{width:40px;height:40px;overflow:hidden;overflow:clip!important;overflow-x:visible;}
      .z-style-bjw6jw1i067e2-528{width:40px;height:40px;overflow-x:clip;overflow:hidden;overflow-y:scroll;}"
    `)
    const lines = output.css.split('\n')
    const line = lines.findIndex((line) => line.includes('flex-basis:var('))
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('flex-basis:var('),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 48,
        "line": 4,
        "name": "flexBasis",
        "source": "example/flex.ts",
      }
    `)
  })

  test('flex and overflow diagnostics retain scalar bounds and integer order', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import { css } from 'zyzz'; css({order:1.5,flexBasis:'-1px',alignSelf:'space-between',overflow:'none'});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: invalid.ts:39: Expected a finite integer from -9007199254740991 to 9007199254740991.
      invalid.ts:53: Expected a nonnegative literal length, auto, or numeric zero.
      invalid.ts:70: Expected one of: auto, baseline, center, end, flex-end, flex-start, normal, self-end, self-start, start, stretch (or a CSS-wide keyword).
      invalid.ts:95: Expected one of: auto, clip, hidden, scroll, visible (or a CSS-wide keyword).]
    `)
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import { css } from 'zyzz'; css({order:'1.5!'});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:39: Expected a finite integer from -9007199254740991 to 9007199254740991.]`,
    )
  })

  test('flex sizing, line alignment, and overflow match native browser layout', async () => {
    const output = Transform.compile({
      moduleId: 'example/flex.ts',
      source: Flex.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      const children = (item: string) =>
        `<div style="width:60px;height:40px;flex-shrink:0"></div><div ${item}></div><div style="width:60px;height:20px;flex-shrink:0"></div><div style="width:60px;height:20px;flex-shrink:0"></div>`
      await page.setContent(
        `<style>${output.css}</style><main id="actual" class="${module.container.className}">${children(`class="${module.item.className}"`)}</main><main id="expected" style="display:flex;flex-wrap:wrap;width:180px;height:100px;align-content:space-between;align-items:flex-start">${children('style="flex-basis:60px;flex-grow:0;flex-shrink:0;height:20px;align-self:flex-end;order:-1!important"')}</main><div id="clip" class="${module.clip.className}"><div style="width:200px;height:200px"></div></div><div id="scroll" class="${module.scroll.className}"><div style="width:200px;height:200px"></div></div>`,
      )
      expect(
        await page.evaluate(() => {
          const layout = (id: string) => {
            const parent = document.getElementById(id)!
            const origin = parent.getBoundingClientRect()
            return Array.from(parent.children, (child) => {
              const box = child.getBoundingClientRect()
              return {
                height: box.height,
                width: box.width,
                x: box.x - origin.x,
                y: box.y - origin.y,
              }
            })
          }
          return (
            JSON.stringify(layout('actual')) ===
            JSON.stringify(layout('expected'))
          )
        }),
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page.locator('#actual').evaluate((parent) => {
          const child = parent.children[1]!
          const box = child.getBoundingClientRect()
          const origin = parent.getBoundingClientRect()
          return {
            height: box.height,
            width: box.width,
            x: box.x - origin.x,
            y: box.y - origin.y,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "height": 20,
          "width": 60,
          "x": 0,
          "y": 20,
        }
      `)
      expect(
        await page.locator('#clip').evaluate((element) => {
          element.scrollTop = 10
          const style = getComputedStyle(element)
          return {
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            scrollTop: element.scrollTop,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "overflowX": "clip",
          "overflowY": "clip",
          "scrollTop": 0,
        }
      `)
      expect(
        await page.locator('#scroll').evaluate((element) => {
          element.scrollTop = 10
          const style = getComputedStyle(element)
          return {
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            scrollTop: element.scrollTop,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "overflowX": "hidden",
          "overflowY": "scroll",
          "scrollTop": 10,
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('logical boxes preserve tokens, importance, and fallback source maps', () => {
    const output = Transform.compile({
      moduleId: 'example/logical.ts',
      source: Logical.source,
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-9k2sno1hln8ye-zyzz-theme{--z-t9k2sno1hln8ye-zyzz-spacing_2e_space:12px;}
      .z-9k2sno1hln8ye-base0{margin-inline-end:var(--z-t9k2sno1hln8ye-zyzz-spacing_2e_space,12px)!important;position:relative;inset-inline-start:-3px;}
      .z-style-9k2sno1hln8ye-121{width:60px;inline-size:70px;inline-size:80px!important;block-size:40px;padding-left:2px;padding-inline-start:4px;padding-inline-start:var(--z-t9k2sno1hln8ye-zyzz-spacing_2e_space,12px);}
      .z-style-9k2sno1hln8ye-374{inline-size:30px;width:50px;padding-inline-start:6px;padding-left:8px;}"
    `)
    const lines = output.css.split('\n')
    const line = lines.findIndex((line) => line.includes('inline-size:80px'))
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('inline-size:80px'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 34,
        "line": 4,
        "name": "inlineSize",
        "source": "example/logical.ts",
      }
    `)
  })

  test('logical boxes reject invalid scalar values with source locations', () => {
    const diagnostics = [
      "paddingInline:'-1px'",
      "blockSize:'-1px'",
      "inset:'1px 2px'",
      "writingMode:'diagonal'",
    ].map((declaration) => {
      try {
        Transform.compile({
          moduleId: 'invalid.ts',
          source: `import { css } from 'zyzz'; css({${declaration}});`,
        })
      } catch (error) {
        return (error as Error).message
      }
      return null
    })
    expect(diagnostics).toMatchInlineSnapshot(`
      [
        "invalid.ts:47: Expected a nonnegative literal length or numeric zero.",
        "invalid.ts:43: Expected a nonnegative literal length, auto, or numeric zero.",
        "invalid.ts:39: Expected a literal length, auto, or numeric zero.",
        "invalid.ts:45: Expected one of: horizontal-tb, vertical-lr, vertical-rl (or a CSS-wide keyword).",
      ]
    `)
  })

  test('logical boxes render inherited writing modes and scope overrides in the browser', async () => {
    const output = Transform.compile({
      moduleId: 'example/logical.ts',
      source: Logical.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><main style="writing-mode:horizontal-tb;direction:ltr"><div id="box" class="${module.logical.className}"></div><div id="control" style="width:60px;inline-size:70px;inline-size:80px!important;block-size:40px;padding-left:2px;padding-inline-start:4px;padding-inline-start:12px;margin-inline-end:12px!important;position:relative;inset-inline-start:-3px"></div><div id="physical" class="${module.physical.className}"></div><div id="physical-control" style="inline-size:30px;width:50px;padding-inline-start:6px;padding-left:8px"></div></main>`,
      )
      for (const writingMode of [
        'horizontal-tb',
        'vertical-rl',
        'vertical-lr',
      ]) {
        for (const direction of ['ltr', 'rtl']) {
          await page.locator('main').evaluate(
            (element, values) => {
              element.style.writingMode = values.writingMode
              element.style.direction = values.direction
            },
            { writingMode, direction },
          )
          expect(
            await page.evaluate(() => {
              const properties = [
                'width',
                'height',
                'padding-left',
                'padding-right',
                'padding-top',
                'padding-bottom',
                'margin-left',
                'margin-right',
                'margin-top',
                'margin-bottom',
                'left',
                'right',
                'top',
                'bottom',
              ]
              return [
                ['box', 'control'],
                ['physical', 'physical-control'],
              ].flatMap(([actual, expected]) => {
                const a = getComputedStyle(document.getElementById(actual!)!)
                const b = getComputedStyle(document.getElementById(expected!)!)
                return properties
                  .filter(
                    (property) =>
                      a.getPropertyValue(property) !==
                      b.getPropertyValue(property),
                  )
                  .map((property) => ({
                    actual: a.getPropertyValue(property),
                    expected: b.getPropertyValue(property),
                    property,
                  }))
              })
            }),
          ).toMatchInlineSnapshot(`[]`)
        }
      }
      await page.locator('main').evaluate((element, scope) => {
        element.setAttribute('class', scope)
      }, module.scope)
      // A scope edit must update both the shorthand and explicit reference.
      await page.addStyleTag({
        content: `.${module.scope}{${output.css.match(/--[^:]+(?=:12px)/)![0]}:20px;}`,
      })
      expect(
        await page.locator('#box').evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            marginInlineEnd: style.marginInlineEnd,
            paddingInlineStart: style.paddingInlineStart,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "marginInlineEnd": "20px",
          "paddingInlineStart": "20px",
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('important zero shorthands retain token identity before literal coercion', () => {
    const output = Transform.compile({
      moduleId: 'zero.ts',
      source: `import { Theme, css } from 'zyzz';
const theme = Theme.define({spacing:{0:'8px'}});
export const token = theme.css({padding:'0!'})();
export const literal = css({padding:'0!'})();
export const plain = theme.css({padding:0})();`,
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-1s1gwcevjtf8w-theme{--z-t1s1gwcevjtf8w-theme-spacing_2e_0:8px;}
      .z-style-1s1gwcevjtf8w-105{padding:var(--z-t1s1gwcevjtf8w-theme-spacing_2e_0,8px)!important;}
      .z-style-1s1gwcevjtf8w-157{padding:0!important;}
      .z-style-1s1gwcevjtf8w-201{padding:0;}"
    `)
  })

  test('asserted fallback arrays retain token references and entry source maps', () => {
    const output = Transform.compile({
      moduleId: 'assertions.ts',
      source: `import { Theme } from 'zyzz';
const theme = Theme.define({color:{brand:'#06c'}});
export const props = theme.css({
  display: ['block','flex'] as const,
  color: ((['#000',theme.tokens.color.brand] as const) satisfies readonly unknown[])!,
})();`,
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-1jvt0134f5zz3-theme{--z-t1jvt0134f5zz3-theme-color_2e_brand:#06c;}
      .z-1jvt0134f5zz3-base0{display:block;display:flex;color:#000;color:var(--z-t1jvt0134f5zz3-theme-color_2e_brand,#06c);}"
    `)
    const lines = output.css.split('\n')
    const line = lines.findIndex((line) => line.includes('color:var('))
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('color:var('),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 19,
        "line": 5,
        "name": "color",
        "source": "assertions.ts",
      }
    `)
  })

  test('nondecimal length spellings fail source and theme compilation', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid-length.ts',
        source: `import { css } from 'zyzz'; export const props = css({width:'0x10dvh'})();`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid-length.ts:60: Expected a nonnegative literal length, auto, or numeric zero.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'invalid-theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({spacing:{space:'0b10lh'}}); export const props = theme.css({padding:'space'})();`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid-theme.ts:44: ["spacing","space"]: Expected a nonnegative literal length or numeric zero.]`,
    )
  })

  test('standard lengths preserve source spelling, token fallbacks, and maps', () => {
    const output = Transform.compile({
      moduleId: 'example/lengths.ts',
      source: Lengths.source,
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-1aowg2i1i6ewzi-zyzz-theme{--z-t1aowg2i1i6ewzi-zyzz-spacing_2e_space:1lh;}
      .z-1aowg2i1i6ewzi-base1{width:50vw;width:50cqi!important;height:10dvh;border-width:1pc;border-style:solid;}
      .z-style-1aowg2i1i6ewzi-117{margin-left:-1in;}
      .z-1aowg2i1i6ewzi-base0{padding:1rem;padding:var(--z-t1aowg2i1i6ewzi-zyzz-spacing_2e_space,1lh);}
      .z-style-1aowg2i1i6ewzi-244{margin-top:2rlh!important;}"
    `)
    const lines = output.css.split('\n')
    const line = lines.findIndex((line) => line.includes('width:50cqi'))
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('width:50cqi'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 39,
        "line": 3,
        "name": "width",
        "source": "example/lengths.ts",
      }
    `)
  })

  test('standard lengths resolve against browser viewport, container, and font metrics', async () => {
    const output = Transform.compile({
      moduleId: 'example/lengths.ts',
      source: Lengths.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage({
        viewport: { width: 800, height: 600 },
      })
      await page.setContent(
        `<style>html{font-size:16px;line-height:24px}main{container-type:size;width:400px;height:300px;line-height:30px}${output.css}</style><main><div id="root" class="${module.root.className}"></div><div id="themed" class="${module.themed.className}"></div></main>`,
      )
      expect(
        await page.locator('#root').evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            borderWidth: style.borderTopWidth,
            height: style.height,
            marginLeft: style.marginLeft,
            width: style.width,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "borderWidth": "16px",
          "height": "60px",
          "marginLeft": "-96px",
          "width": "200px",
        }
      `)
      expect(
        await page.locator('#themed').evaluate((element) => {
          const style = getComputedStyle(element)
          return { marginTop: style.marginTop, padding: style.paddingTop }
        }),
      ).toMatchInlineSnapshot(`
        {
          "marginTop": "48px",
          "padding": "30px",
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('importance syntax cannot collide with theme token names', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/reserved.ts',
        source: `import { Theme } from 'zyzz';
const theme = Theme.define({spacing:{md:'4px','md!':'8px'}});
export const props = theme.css({padding:'md!'})();`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/reserved.ts:44: ["spacing","md!"]: Token keys cannot contain !; it is reserved for declaration importance.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'example/reserved-config.ts',
        source: `import { Config } from 'zyzz';
const zyzz = Config.create({theme:{spacing:{'nested!':{md:'8px'}}}});
export const props = zyzz.css({padding:'nested!.md'})();`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/reserved-config.ts:44: ["spacing","nested!"]: Token keys cannot contain !; it is reserved for declaration importance.]`,
    )
  })

  test('fallback declarations retain importance, token identity, and element source maps', () => {
    const output = Transform.compile({
      moduleId: 'example/fallbacks.ts',
      source: Declarations.source,
    })
    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-1ne2r2w17wkfe-theme{--z-t1ne2r2w17wkfe-theme-color_2e_brand:#06c;}
      .z_theme-1ne2r2w17wkfe-mint{--z-t1ne2r2w17wkfe-theme-color_2e_brand:#175;}
      .z-1ne2r2w17wkfe-base0{display:block;display:flex;opacity:0.25!important;opacity:0.75;}
      .z-style-1ne2r2w17wkfe-183{color:#000;color:var(--z-t1ne2r2w17wkfe-theme-color_2e_brand,#06c);color:var(--z-t1ne2r2w17wkfe-theme-color_2e_brand,#06c)!important;padding:4px!important;padding:8px;padding-left:12px;}
      .z-style-1ne2r2w17wkfe-390{color:#fff;padding:20px;}"
    `)
    const lines = output.css.split('\n')
    const line = lines.findIndex((line) => line.includes('color:var('))
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('color:var('),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 18,
        "line": 6,
        "name": "color",
        "source": "example/fallbacks.ts",
      }
    `)
  })

  test('fallback order and importance select browser styles with inherited tokens', async () => {
    const output = Transform.compile({
      moduleId: 'example/fallbacks.ts',
      source: Declarations.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.setContent(
        `<style>${output.css}</style><main class="${module.scope}"><div id="card" class="${module.props.className} ${module.later.className}"></div></main>`,
      )
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(17, 119, 85)"`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot(`"0.25"`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).paddingLeft),
      ).toMatchInlineSnapshot(`"4px"`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).display),
      ).toMatchInlineSnapshot(`"flex"`)
    } finally {
      await browser.close()
    }
  })

  test('explicit token paths compile through bound aliases with defining fallbacks', async () => {
    const result = Transform.compile({
      moduleId: 'example/tokens.ts',
      source: `import { Theme } from 'zyzz';
const theme = Theme.define({ color: { transparent: '#06c', palette: { 500: '#123' } }, spacing: { 0: '8px', 4: '16px' } });
const alternate = Theme.extend(theme, { color: { transparent: '#175', palette: { 500: '#456' } } });
const { css } = theme;
export const scope = alternate.className;
export const props = css({ color: theme.tokens.color.transparent, borderColor: (theme['tokens'].color.palette['500']!), padding: theme.tokens.spacing[0] })();
`,
    })
    expect(result.code).toMatchInlineSnapshot(`
      "
      const theme = ({className:"z_theme-1wr3l4n1jk260t-theme"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "transparent":"#06c";readonly "palette":{readonly 500:"#123"}};readonly "spacing":{readonly 0:"8px";readonly 4:"16px"}}>);
      const alternate = ({className:"z_theme-1wr3l4n1jk260t-alternate"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "transparent":"#06c";readonly "palette":{readonly 500:"#123"}};readonly "spacing":{readonly 0:"8px";readonly 4:"16px"}}>);
      const { css } = ({css:undefined} as unknown as {readonly css:import('zyzz').Theme.Definition<{readonly "color":{readonly "transparent":"#06c";readonly "palette":{readonly 500:"#123"}};readonly "spacing":{readonly 0:"8px";readonly 4:"16px"}}>['css']});
      export const scope = "z_theme-1wr3l4n1jk260t-alternate";
      export const props = ({className:"z-1wr3l4n1jk260t-base0"});
      "
    `)
    expect(result.css).toMatchInlineSnapshot(`
      ".z_theme-1wr3l4n1jk260t-theme{--z-t1wr3l4n1jk260t-theme-color_2e_transparent:#06c;--z-t1wr3l4n1jk260t-theme-color_2e_palette_2e_500:#123;--z-t1wr3l4n1jk260t-theme-spacing_2e_0:8px;}
      .z_theme-1wr3l4n1jk260t-alternate{--z-t1wr3l4n1jk260t-theme-color_2e_transparent:#175;--z-t1wr3l4n1jk260t-theme-color_2e_palette_2e_500:#456;--z-t1wr3l4n1jk260t-theme-spacing_2e_0:8px;}
      .z-1wr3l4n1jk260t-base0{color:var(--z-t1wr3l4n1jk260t-theme-color_2e_transparent,#06c);border-color:var(--z-t1wr3l4n1jk260t-theme-color_2e_palette_2e_500,#123);padding:var(--z-t1wr3l4n1jk260t-theme-spacing_2e_0,8px);}"
    `)
    const output = await Esbuild.build({
      bundle: true,
      format: 'cjs',
      metafile: true,
      stdin: { contents: result.code, loader: 'ts' },
      write: false,
    })
    expect(output.metafile!.outputs['stdin.js']!.imports).toMatchInlineSnapshot(
      `[]`,
    )
    const directory = await Fs.mkdtemp(Path.join(root, '.fixture-tokens-'))
    try {
      const path = Path.join(directory, 'module.cjs')
      await Fs.writeFile(path, output.outputFiles[0]!.text)
      const executed = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          '-e',
          `console.log(JSON.stringify(require(${JSON.stringify(path)}).props))`,
        ],
      )
      expect(executed.stdout).toMatchInlineSnapshot(`
        "{"className":"z-1wr3l4n1jk260t-base0"}
        "
      `)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
    const map = new Trace.TraceMap(result.cssMap)
    const lines = result.css.split('\n')
    const line = lines.findIndex((value) => value.includes('color:var('))
    expect(
      Trace.originalPositionFor(map, {
        line: line + 1,
        column: lines[line]!.indexOf('color:'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 27,
        "line": 6,
        "name": "color",
        "source": "example/tokens.ts",
      }
    `)
  })

  test('explicit token diagnostics reject dynamic paths', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ color: theme.tokens.color[key] });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:106: Token paths require static property names without optional access.
      example/tokens.ts:106: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject unknown paths', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ color: theme.tokens.color.missing });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:106: Unknown theme token path.
      example/tokens.ts:106: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject palette references', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ color: theme.tokens.color });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:106: Expected a scalar theme token reference.
      example/tokens.ts:106: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject escaping tokens', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); export const value = theme.tokens.color.brand;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/tokens.ts:108: Token references must be direct property values in bound theme css calls.]`,
    )
  })

  test('explicit token diagnostics reject root css tokens', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); css({ color: theme.tokens.color.brand });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:100: Token references must be direct property values in bound theme css calls.
      example/tokens.ts:100: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject token expressions', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ color: theme.tokens.color.brand + '' });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:106: Token references must be direct property values in bound theme css calls.
      example/tokens.ts:106: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject token writes', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.tokens.color.brand = value;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/tokens.ts:87: Token references must be direct property values in bound theme css calls.]`,
    )
  })

  test('explicit token diagnostics reject optional tokens', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ color: theme.tokens.color?.brand });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:106: Token paths require static property names without optional access.
      example/tokens.ts:106: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject token metadata', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ color: theme.tokens.color.brand.value });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:106: Unknown theme token path.
      example/tokens.ts:106: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject wrong domains', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ padding: theme.tokens.color.brand });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/tokens.ts:108: Token group is incompatible with this property.]`,
    )
  })

  test('local themes compile to scope constants and executable token styles', async () => {
    const source = `import { Theme } from 'zyzz';
const theme = Theme.define({ color: { brand: { dark: '#fff', light: '#000' } }, spacing: { 1: '4px', md: '8px' } });
const alternate = Theme.extend(theme, { color: { brand: '#f00' } });
export type Brand = typeof theme.tokens.color.brand;
export const scope = alternate.className;
export const props = theme.css({ color: 'brand', padding: 'md' })();`
    const result = Transform.compile({ moduleId: 'example/theme.ts', source })
    const bundle = await Esbuild.build({
      bundle: true,
      format: 'esm',
      metafile: true,
      stdin: { contents: result.code, loader: 'ts' },
      write: false,
    })

    expect(result.code).toMatchInlineSnapshot(`
      "
      const theme = ({className:"z_theme-1dre7461ulsxz8-theme"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":{readonly "dark":"#fff";readonly "light":"#000"}};readonly "spacing":{readonly 1:"4px";readonly "md":"8px"}}>);
      const alternate = ({className:"z_theme-1dre7461ulsxz8-alternate"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":{readonly "dark":"#fff";readonly "light":"#000"}};readonly "spacing":{readonly 1:"4px";readonly "md":"8px"}}>);
      export type Brand = typeof theme.tokens.color.brand;
      export const scope = "z_theme-1dre7461ulsxz8-alternate";
      export const props = ({className:"z-1dre7461ulsxz8-base0"});"
    `)
    expect(result.css).toMatchInlineSnapshot(`
      ".z_theme-1dre7461ulsxz8-theme{--z-t1dre7461ulsxz8-theme-color_2e_brand:light-dark(#000,#fff);--z-t1dre7461ulsxz8-theme-spacing_2e_md:8px;}
      .z_theme-1dre7461ulsxz8-alternate{--z-t1dre7461ulsxz8-theme-color_2e_brand:#f00;--z-t1dre7461ulsxz8-theme-spacing_2e_md:8px;}
      .z-1dre7461ulsxz8-base0{color:var(--z-t1dre7461ulsxz8-theme-color_2e_brand,light-dark(#000,#fff));padding:var(--z-t1dre7461ulsxz8-theme-spacing_2e_md,8px);}"
    `)
    expect(result.themes).toMatchInlineSnapshot(`
      {
        "1dre7461ulsxz8-alternate": "z_theme-1dre7461ulsxz8-alternate",
        "1dre7461ulsxz8-theme": "z_theme-1dre7461ulsxz8-theme",
      }
    `)
    expect(bundle.metafile!.outputs['stdin.js']!.imports).toMatchInlineSnapshot(
      `[]`,
    )
    expect(
      bundle.outputFiles[0]!.text.includes('Theme.define'),
    ).toMatchInlineSnapshot('false')

    const directory = await Fs.mkdtemp(Path.join(root, '.fixture-theme-types-'))
    try {
      const file = Path.join(directory, 'theme.ts')
      await Fs.writeFile(
        file,
        `${result.code}\ntheme.css({ padding: 1 });\n// @ts-expect-error The numeric token 2 is undeclared.\ntheme.css({ padding: 2 });`,
      )
      const checked = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          Path.join(root, 'node_modules/typescript/bin/tsc'),
          '--customConditions',
          'src',
          '--module',
          'NodeNext',
          '--noEmit',
          '--skipLibCheck',
          '--strict',
          '--target',
          'ES2022',
          file,
        ],
      ).catch((error: Error & { stdout?: string }) => {
        throw new Error(error.stdout || error.message)
      })
      expect(checked.stdout).toMatchInlineSnapshot('""')
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }

    const map = new Trace.TraceMap(result.cssMap)
    const lines = result.css.split('\n')
    const line = lines.findIndex((value) => value.includes('color:var('))
    expect(
      Trace.originalPositionFor(map, {
        column: lines[line]!.indexOf('color:'),
        line: line + 1,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 33,
        "line": 6,
        "name": "color",
        "source": "example/theme.ts",
      }
    `)
    expect(Trace.originalPositionFor(map, { column: 0, line: 1 }))
      .toMatchInlineSnapshot(`
      {
        "column": 14,
        "line": 2,
        "name": "1dre7461ulsxz8-theme",
        "source": "example/theme.ts",
      }
    `)
  })

  test('theme identity survives value edits and preceding unrelated definitions', () => {
    const source = `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); export const scope = theme.className; export const props = theme.css({ color: 'brand' })();`
    const original = Transform.compile({ moduleId: 'example/theme.ts', source })
    const changed = Transform.compile({
      moduleId: 'example/theme.ts',
      source: source.replace("'#000'", "'#fff'"),
    })
    const inserted = Transform.compile({
      moduleId: 'example/theme.ts',
      source: source.replace(
        'const theme',
        "const other = Theme.define({ spacing: { sm: '4px' } }); const theme",
      ),
    })
    const separate = Transform.compile({ moduleId: 'another/theme.ts', source })

    expect(original.themes).toMatchInlineSnapshot(`
      {
        "1dre7461ulsxz8-theme": "z_theme-1dre7461ulsxz8-theme",
      }
    `)
    expect(changed.themes).toMatchInlineSnapshot(`
      {
        "1dre7461ulsxz8-theme": "z_theme-1dre7461ulsxz8-theme",
      }
    `)
    expect(inserted.themes).toMatchInlineSnapshot(`
      {
        "1dre7461ulsxz8-other": "z_theme-1dre7461ulsxz8-other",
        "1dre7461ulsxz8-theme": "z_theme-1dre7461ulsxz8-theme",
      }
    `)
    expect(separate.themes).toMatchInlineSnapshot(`
      {
        "134fgjpd7aup3-theme": "z_theme-134fgjpd7aup3-theme",
      }
    `)
    expect(original.css.match(/--z-t[^,:;]+/g)).toMatchInlineSnapshot(`
      [
        "--z-t1dre7461ulsxz8-theme-color_2e_brand",
        "--z-t1dre7461ulsxz8-theme-color_2e_brand",
      ]
    `)
    expect(changed.css.match(/--z-t[^,:;]+/g)).toMatchInlineSnapshot(`
      [
        "--z-t1dre7461ulsxz8-theme-color_2e_brand",
        "--z-t1dre7461ulsxz8-theme-color_2e_brand",
      ]
    `)
    expect(inserted.css.match(/--z-t[^,:;]+/g)).toMatchInlineSnapshot(`
      [
        "--z-t1dre7461ulsxz8-theme-color_2e_brand",
        "--z-t1dre7461ulsxz8-theme-color_2e_brand",
      ]
    `)
  })

  test.each(['direct', 'member', 'destructured', 'tokens'] as const)(
    'local themed callables preserve overrides, scope inheritance, and schemes in Chromium: %s',
    async (kind) => {
      const alias = (() => {
        if (kind === 'member') {
          return 'const css = theme.css;'
        }
        if (kind === 'destructured') {
          return 'const { css } = theme;'
        }
        return ''
      })()
      const source = `import { Theme } from 'zyzz';
const theme = Theme.define({ color: { brand: { dark: '#fff', light: '#000' } }, spacing: { md: '8px' } });
const alternate = Theme.extend(theme, { color: { brand: '#f00' } });
export const alternateScope = alternate.className;
export const baseScope = theme.className;
${alias}
export const button = ${kind === 'direct' || kind === 'tokens' ? 'theme.css' : 'css'}(${kind === 'tokens' ? '{ color: theme.tokens.color.brand, padding: theme.tokens.spacing.md }' : "{ color: 'brand', padding: 'md' }"});`
      const result = Transform.compile({ moduleId: 'example/theme.ts', source })
      const bundle = await Esbuild.build({
        alias: { 'zyzz/runtime': Path.join(root, 'src/runtime/index.ts') },
        bundle: true,
        format: 'iife',
        globalName: 'Fixture',
        metafile: true,
        stdin: { contents: result.code, loader: 'ts', resolveDir: root },
        write: false,
      })
      expect(
        Object.keys(bundle.metafile!.inputs).some((path) =>
          /Theme\.ts|compiler\//.test(path),
        ),
      ).toMatchInlineSnapshot('false')

      const browser = await chromium.launch()
      try {
        const page = await browser.newPage()
        await page.setContent(
          '<section id="scope"><button id="button">Continue</button></section>',
        )
        await page.addStyleTag({ content: result.css })
        await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
        const rendered = await page.evaluate(() => {
          const fixture = (
            window as unknown as {
              Fixture: {
                alternateScope: string
                baseScope: string
                button: (options: { className: string }) => {
                  className: string
                }
              }
            }
          ).Fixture
          const scope = document.querySelector<HTMLElement>('#scope')!
          const button = document.querySelector<HTMLElement>('#button')!
          button.className = fixture.button({ className: 'external' }).className
          const values: string[] = []
          for (const name of ['', fixture.alternateScope, fixture.baseScope]) {
            scope.className = name
            for (const scheme of ['light', 'dark']) {
              scope.style.colorScheme = scheme
              values.push(getComputedStyle(button).color)
            }
          }
          return values
        })
        expect(rendered).toMatchInlineSnapshot(`
          [
            "rgb(0, 0, 0)",
            "rgb(255, 255, 255)",
            "rgb(255, 0, 0)",
            "rgb(255, 0, 0)",
            "rgb(0, 0, 0)",
            "rgb(255, 255, 255)",
          ]
      `)
        expect(
          await page
            .locator('#button')
            .evaluate((element) => element.classList.contains('external')),
        ).toMatchInlineSnapshot('true')
        expect(
          await page
            .locator('#button')
            .evaluate((element) => getComputedStyle(element).padding),
        ).toMatchInlineSnapshot('"8px"')
      } finally {
        await browser.close()
      }
    },
  )

  test('JavaScript theme modules remain JavaScript and shadowed factories remain untouched', async () => {
    const source = `import { Theme as T } from 'zyzz'; const theme = T.define({ color: { brand: '#000' } }); export const props = theme.css({ color: 'brand' })(); export function other(T) { return T.define({ arbitrary: true }); }`
    const result = Transform.compile({ moduleId: 'example/theme.js', source })
    const transformed = await Esbuild.transform(result.code, { loader: 'js' })
    expect(transformed.code).toMatchInlineSnapshot(`
      "import { Theme as T } from "zyzz";
      const theme = { className: "z_theme-1kg4lys8lrjea-theme" };
      export const props = { className: "z-1kg4lys8lrjea-base0" };
      export function other(T2) {
        return T2.define({ arbitrary: true });
      }
      "
    `)
  })

  test('exported theme objects require linking instead of losing their authoring contract', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; export const theme = Theme.define({ color: { brand: '#000' } });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:43: Define local themes with a module-level const; exported themes require source linking.]`,
    )
  })

  test('theme expressions are rejected without executing application code', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: readColor() } });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:75: Theme values must be literal data; expressions are not evaluated.]`,
    )
  })

  test('theme css aliases and destructuring compile with lexical shadowing', async () => {
    const result = Transform.compile({
      moduleId: 'example/aliases.ts',
      source: `import { Theme } from 'zyzz';
const theme = Theme.define({ color: { brand: '#06c' }, spacing: { md: '8px' } });
const css = theme.css;
const chained = css;
const { css: renamed } = theme;
export type Styles = Parameters<typeof renamed>[0];
export const first = chained({ color: 'brand' })();
export const second = renamed({ padding: 'md' })();
export function shadow(css: (input: string) => string) { return css('untouched') }
`,
    })
    expect(result.code).toMatchInlineSnapshot(`
      "
      const theme = ({className:"z_theme-1ypjmwd1mnjqht-theme"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}}>);
      const css = (undefined as unknown as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}}>['css']);
      const chained = (undefined as unknown as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}}>['css']);
      const { css: renamed } = ({css:undefined} as unknown as {readonly css:import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}}>['css']});
      export type Styles = Parameters<typeof renamed>[0];
      export const first = ({className:"z-1ypjmwd1mnjqht-base0"});
      export const second = ({className:"z-1ypjmwd1mnjqht-base1"});
      export function shadow(css: (input: string) => string) { return css('untouched') }
      "
    `)
    expect(result.css).toMatchInlineSnapshot(`
      ".z_theme-1ypjmwd1mnjqht-theme{--z-t1ypjmwd1mnjqht-theme-color_2e_brand:#06c;--z-t1ypjmwd1mnjqht-theme-spacing_2e_md:8px;}
      .z-1ypjmwd1mnjqht-base0{color:var(--z-t1ypjmwd1mnjqht-theme-color_2e_brand,#06c);}
      .z-1ypjmwd1mnjqht-base1{padding:var(--z-t1ypjmwd1mnjqht-theme-spacing_2e_md,8px);}"
    `)
    const bundle = await Esbuild.build({
      bundle: true,
      format: 'cjs',
      metafile: true,
      stdin: { contents: result.code, loader: 'ts' },
      write: false,
    })
    expect(bundle.metafile!.outputs['stdin.js']!.imports).toMatchInlineSnapshot(
      `[]`,
    )
    const directory = await Fs.mkdtemp(Path.join(root, '.fixture-alias-'))
    try {
      const file = Path.join(directory, 'module.cjs')
      await Fs.writeFile(file, bundle.outputFiles[0]!.text)
      const executed = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          '-e',
          `const value = require(${JSON.stringify(file)}); console.log(JSON.stringify(value.first)); console.log(JSON.stringify(value.second)); console.log(value.shadow(value => value));`,
        ],
      )
      expect(executed.stdout).toMatchInlineSnapshot(`
        "{"className":"z-1ypjmwd1mnjqht-base0"}
        {"className":"z-1ypjmwd1mnjqht-base1"}
        untouched
        "
      `)
      await Fs.writeFile(
        Path.join(directory, 'module.ts'),
        `${result.code}
renamed({ color: 'brand' });
// @ts-expect-error Unknown tokens remain rejected after rewriting.
renamed({ color: 'unknown' });
// @ts-expect-error Aliases preserve token domains.
css({ color: 'md' });
`,
      )
      const checked = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          Path.join(root, 'node_modules/typescript/bin/tsc'),
          '--customConditions',
          'src',
          '--module',
          'NodeNext',
          '--target',
          'esnext',
          '--strict',
          '--skipLibCheck',
          '--noEmit',
          Path.join(directory, 'module.ts'),
        ],
      )
      expect(checked.stdout).toMatchInlineSnapshot(`""`)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })

  test('JavaScript aliases remain JavaScript and parameter initializers retain lexical bindings', async () => {
    const result = Transform.compile({
      moduleId: 'example/aliases.js',
      source: `import { Theme } from 'zyzz';
const theme = Theme.define({color:{brand:'#06c'}});
const { css } = theme;
export function card(value = css({color:'brand'})()) { var css = 1; return value }
`,
    })
    expect(result.code).toMatchInlineSnapshot(`
      "
      const theme = ({className:"z_theme-1yrnmp3116l80n-theme"});
      const { css } = ({css:undefined});
      export function card(value = ({className:"z-1yrnmp3116l80n-base0"})) { var css = 1; return value }
      "
    `)
    const output = await Esbuild.transform(result.code, { loader: 'js' })
    expect(output.warnings).toMatchInlineSnapshot(`[]`)
  })

  test('theme alias diagnostics reject exported aliases', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); export const css = theme.css;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:95: Theme css aliases require a local module-level const binding.]`,
    )
  })

  test('theme alias diagnostics reject escaping aliases', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); const css = theme.css; consume(css);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:113: Theme css aliases support direct calls only; exporting or escaping them requires source linking.]`,
    )
  })

  test('theme alias diagnostics reject reassigned aliases', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); const css = theme.css; (css as unknown) = value;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:106: Theme css aliases support direct calls only; exporting or escaping them requires source linking.]`,
    )
  })

  test('theme alias diagnostics reject destructuring defaults', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); const { css = fallback } = theme;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:88: Destructure only css into a const binding without defaults or rest properties.]`,
    )
  })

  test('theme alias diagnostics reject destructuring rest', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); const { css, ...rest } = theme;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:88: Destructure only css into a const binding without defaults or rest properties.]`,
    )
  })

  test('theme alias diagnostics reject mutable aliases', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); let css = theme.css;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:86: Theme css aliases require a local module-level const binding.]`,
    )
  })

  test('theme alias diagnostics reject early alias calls', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); css({color:'brand'}); const css = theme.css;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:82: Theme css alias references must follow their definition.]`,
    )
  })

  test('theme alias diagnostics reject optional alias calls', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); const css = theme.css; css?.({color:'brand'});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:105: Theme css aliases support direct calls only; exporting or escaping them requires source linking.]`,
    )
  })

  test('theme alias diagnostics reject export specifiers', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); const css = theme.css; export { css };`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:114: Theme css aliases support direct calls only; exporting or escaping them requires source linking.]`,
    )
  })

  test.each([
    'Z.Theme.define({ color: { brand: "#000" } })',
    'Z["Theme"].define({ color: { brand: "#000" } })',
    'Z.Theme.extend(base, {})',
  ])('namespace theme factories produce a source diagnostic: %s', (factory) => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/namespace.ts',
        source: `import * as Z from 'zyzz'; const theme = ${factory}; export const scope = theme.className;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/namespace.ts:41: Import Theme by name; namespace authoring calls are not supported yet.]`,
    )
  })

  test('rejects wrapped scope writes: (theme.className as string) = value;', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); (theme.className as string) = value;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: (theme.className!) = value;', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); (theme.className!) = value;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: (theme.className satisfies string) = value;', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); (theme.className satisfies string) = value;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: ((theme.className as string)!) = value;', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); ((theme.className as string)!) = value;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: (theme.className as string)++;', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); (theme.className as string)++;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: delete (theme.className as string);', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); delete (theme.className as string);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: ({ value: (theme.className as string) } = input);', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); ({ value: (theme.className as string) } = input);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:89: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: for ((theme.className as string) of values) {}', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); for ((theme.className as string) of values) {}`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('theme scopes cannot be assigned through destructuring targets', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); ({ value: theme.className } = input);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:89: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('folded applications need no runtime and maps trace Unicode and CRLF sources', async () => {
    const source = `import { css } from 'zyzz';\r\nconst text = '🎉';\r\nexport const props = css({ color: '#f00', padding: '8px' })();`
    const result = Transform.compile({ moduleId: 'example/inline.ts', source })

    const bundle = await Esbuild.build({
      bundle: true,
      format: 'esm',
      metafile: true,
      stdin: { contents: result.code, loader: 'ts' },
      write: false,
    })

    const cssMap = new Trace.TraceMap(result.cssMap)
    const map = new Trace.TraceMap(result.map)
    const outputLines = result.code.split('\n')
    const row = outputLines.findIndex((line) => line.includes('className'))

    expect(result.code).toMatchInlineSnapshot(`
    "
    const text = '🎉';
    export const props = ({className:"z-14fkufe1imnkw4-base0"});"
  `)

    expect(result.css).toMatchInlineSnapshot(
      `".z-14fkufe1imnkw4-base0{color:#f00;padding:8px;}"`,
    )

    expect(
      ['color:', 'padding:'].map((property) =>
        Trace.originalPositionFor(cssMap, {
          column: result.css.indexOf(property),
          line: 1,
        }),
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "column": 27,
          "line": 3,
          "name": "color",
          "source": "example/inline.ts",
        },
        {
          "column": 42,
          "line": 3,
          "name": "padding",
          "source": "example/inline.ts",
        },
      ]
    `)

    expect(bundle.metafile!.outputs['stdin.js']!.imports).toMatchInlineSnapshot(
      `[]`,
    )

    expect(
      Trace.originalPositionFor(map, {
        column: outputLines[row]!.indexOf('className'),
        line: row + 1,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 21,
        "line": 3,
        "name": null,
        "source": "example/inline.ts",
      }
    `)

    expect(result.map.sources).toMatchInlineSnapshot(`
    [
      "example/inline.ts",
    ]
  `)

    expect(result.cssMap.sources).toMatchInlineSnapshot(`
    [
      "example/inline.ts",
    ]
  `)

    expect(result.map.sourcesContent).toMatchInlineSnapshot(`
    [
      "import { css } from 'zyzz';
    const text = '🎉';
    export const props = css({ color: '#f00', padding: '8px' })();",
    ]
  `)

    expect(result.cssMap.sourcesContent).toMatchInlineSnapshot(`
    [
      "import { css } from 'zyzz';
    const text = '🎉';
    export const props = css({ color: '#f00', padding: '8px' })();",
    ]
  `)
  })

  test('imports, hashbangs, type references, shadowing, and surrounding JSX survive rewriting', async () => {
    const sources = [
      `import other, { css } from 'zyzz'; export const props = css({})(); export { other };`,
      `"use client"; import { css } from 'zyzz'; export const button = css({});`,
      `#!/usr/bin/env node\nimport { css, Style } from 'zyzz'; export const button = css({}); export { Style };`,
      `import { Style, css, css as other } from 'zyzz'; export const a = css({})(); export const b = other({})(); export { Style };`,
      `import { css, css as other, Style } from 'zyzz'; export const a = css({})(); export const b = other({})(); export { Style };`,
      `import { css } from 'zyzz'; export type Signature = typeof css; export const button = css({});`,
      `import { css } from 'zyzz'; const __zyzzProps = 1; export const el = <button {...css({color:'#f00'})()} />; export const button = css({});`,
      `import { css } from 'zyzz'; export function f(value = css({})()) { var css; return value; }`,
      `export const untouched = '🎉';`,
    ]

    const outputs = []
    for (const source of sources) {
      const result = Transform.compile({
        moduleId: 'example/syntax.tsx',
        source,
      })
      await Esbuild.transform(result.code, { loader: 'tsx' })
      outputs.push(result.code)
    }

    expect(outputs).toMatchInlineSnapshot(`
    [
      "import other from 'zyzz'; export const props = ({className:""}); export { other };",
      ""use client";
    import { Props as __zyzzProps } from 'zyzz/runtime';
      export const button = __zyzzProps.create({className:""});",
      "#!/usr/bin/env node

    import { Props as __zyzzProps } from 'zyzz/runtime';
    import { Style } from 'zyzz'; export const button = __zyzzProps.create({className:""}); export { Style };",
      "import { Style,  } from 'zyzz'; export const a = ({className:""}); export const b = ({className:""}); export { Style };",
      "import { Style } from 'zyzz'; export const a = ({className:""}); export const b = ({className:""}); export { Style };",
      "
    import { Props as __zyzzProps } from 'zyzz/runtime';
    import { css } from 'zyzz'; export type Signature = typeof css; export const button = __zyzzProps.create({className:""});",
      "
    import { Props as __zyzzProps_ } from 'zyzz/runtime';
     const __zyzzProps = 1; export const el = <button {...({className:"z-15sihh01ggr9so-base0"})} />; export const button = __zyzzProps_.create({className:""});",
      "import { css } from 'zyzz'; export function f(value = ({className:""})) { var css; return value; }",
      "export const untouched = '🎉';",
    ]
  `)
  })

  test('separately transformed modules render without class collisions in Chromium', async () => {
    const browser = await chromium.launch()
    const directory = await Fs.mkdtemp(Path.join(root, '.fixture-transform-'))
    try {
      const first = Transform.compile({
        moduleId: 'package/first.ts',
        source: `import { css } from 'zyzz'; export const button = css({ color: '#f00', padding: '8px' });`,
      })
      const second = Transform.compile({
        moduleId: 'package/second.ts',
        source: `import { css } from 'zyzz'; export const props = css({ color: '#00f', padding: '4px' })();`,
      })
      await Fs.writeFile(Path.join(directory, 'first.ts'), first.code)
      await Fs.writeFile(Path.join(directory, 'second.ts'), second.code)

      const bundle = await Esbuild.build({
        alias: { 'zyzz/runtime': Path.join(root, 'src/runtime/index.ts') },
        bundle: true,
        format: 'iife',
        globalName: 'fixture',
        stdin: {
          contents: `import { button } from './first'; import { props } from './second'; export const values = [button(), props, button({ className: 'external', style: { paddingLeft: '2px' } })];`,
          loader: 'ts',
          resolveDir: directory,
        },
        write: false,
      })

      const page = await browser.newPage()
      await page.setContent('<!doctype html><body></body>')
      await page.addStyleTag({ content: first.css + '\n' + second.css })
      await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
      const result = await page.evaluate(`fixture.values.map(props => {
      const element = document.createElement('button');
      element.className = props.className;
      Object.assign(element.style, props.style);
      document.body.append(element);
      const style = getComputedStyle(element);
      return { color: style.color, padding: style.padding };
    })`)

      expect(result).toMatchInlineSnapshot(`
      [
        {
          "color": "rgb(255, 0, 0)",
          "padding": "8px",
        },
        {
          "color": "rgb(0, 0, 255)",
          "padding": "4px",
        },
        {
          "color": "rgb(255, 0, 0)",
          "padding": "8px 8px 8px 2px",
        },
      ]
    `)
    } finally {
      await browser.close()
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })

  test('compiled library exports run against the packed runtime without a styling plugin', async () => {
    const directory = await Fs.mkdtemp(
      Path.join(root, '.fixture-transform-pack-'),
    )
    try {
      const run = Util.promisify(ChildProcess.execFile)
      await run('pnpm', ['build'], { cwd: root })
      await run('pnpm', ['pack', '--pack-destination', directory], {
        cwd: root,
      })

      const archive = (await Fs.readdir(directory)).find((name) =>
        name.endsWith('.tgz'),
      )!
      const installed = Path.join(directory, 'node_modules/zyzz')
      await Fs.mkdir(installed, { recursive: true })
      await run('tar', [
        '-xzf',
        Path.join(directory, archive),
        '--strip-components=1',
        '-C',
        installed,
      ])

      const output = Transform.compile({
        moduleId: 'library/button.ts',
        source: `import { css } from 'zyzz'; export const button = css({ color: '#f00' });`,
      })
      await Fs.writeFile(Path.join(directory, 'button.ts'), output.code)
      const consumer = await run(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import { button } from './button.ts'; console.log(JSON.stringify(button({className:'external'})));`,
        ],
        { cwd: directory },
      )

      const bundle = await Esbuild.build({
        bundle: true,
        metafile: true,
        platform: 'browser',
        stdin: {
          contents: `export { button } from './button.ts'`,
          resolveDir: directory,
        },
        write: false,
      })

      const platforms = await run(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import { Style } from 'zyzz'; import { Css } from 'zyzz/web'; console.log(JSON.stringify(Css.compile({ styles: Style.define({ button: { padding: 0 } }) })));`,
        ],
        { cwd: directory },
      )
      expect(JSON.parse(platforms.stdout)).toMatchInlineSnapshot(`
      {
        "classes": {
          "button": "z_base0",
        },
        "css": ".z_base0{padding:0;}",
        "themes": {},
      }
    `)

      const listing = await run('tar', ['-tzf', Path.join(directory, archive)])

      expect(
        Object.keys(bundle.metafile!.inputs).some((name) =>
          /oxc|compiler|web\/Css/.test(name),
        ),
      ).toMatchInlineSnapshot(`false`)

      expect(JSON.parse(consumer.stdout)).toMatchInlineSnapshot(`
      {
        "className": "z-fyitz4td647s-base0 external",
      }
    `)

      expect(
        /\.(?:test|test-d|bench)\.ts/.test(listing.stdout),
      ).toMatchInlineSnapshot(`false`)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  }, 30000)
})
