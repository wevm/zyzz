/** Verifies callback compilation, required inputs, private slots, and static declaration preservation. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const source = [
  'import { css } from "zyzz";',
  'export const bar = css((values: { amount: `${number}%`; gap: `${number}px`; alpha: number }) => ({ display:"block", width:values.amount, marginLeft:`calc(${values.gap} + 2px)`,opacity:values.alpha }));',
  'export const first = bar({amount:"25%",gap:"4px",alpha:0.5});',
].join('\n')

describe('compile', () => {
  test('unwraps all transparent callback assertions and rejects token concatenation', () => {
    for (const callback of [
      '(((v:{alpha:number})=>({opacity:v.alpha}))!)',
      '(((v:{alpha:number})=>({opacity:v.alpha}))! as unknown)',
    ])
      expect(
        Transform.compile({
          moduleId: 'asserted.ts',
          source: 'import {css} from "zyzz"; css(' + callback + ')',
        }).css,
      ).toContain('opacity:var(')

    for (const body of [
      '{color:`#${v.hex}`}',
      '{fontFamily:`prefix${v.hex}`}',
      '{fontFamily:`${v.hex}suffix`}',
    ])
      expect(() =>
        Transform.compile({
          moduleId: 'joined.ts',
          source:
            'import {css} from "zyzz"; css((v:{hex:"fff"|"000"})=>(' +
            body +
            '))',
        }),
      ).toThrow()
  })
  test('supports zero dimensions and rejects private-property keywords and quoted substitutions', async () => {
    const output = Transform.compile({
      moduleId: 'zero.ts',
      source:
        'import {css} from "zyzz"; export const style=css((v:{width:0|`${number}px`})=>({width:v.width}))',
    })

    const built = await Esbuild.build({
      stdin: {
        contents: output.code,
        resolveDir: Path.resolve(import.meta.dirname, '../..'),
        loader: 'ts',
      },
      bundle: true,
      write: false,
      platform: 'node',
      conditions: ['src'],
      format: 'esm',
    })

    const result = await import(
      `data:text/javascript;base64,${Buffer.from(built.outputFiles[0]!.text).toString('base64')}`
    )

    expect(Object.values(result.style({ width: 0 }).style)).toEqual([0])
    expect(Object.values(result.style({ width: '10px' }).style)).toEqual([
      '10px',
    ])

    for (const source of [
      'css((v:{color:"initial"|"red"})=>({color:v.color}))',
      'css((v:{text:string})=>({content:`"${v.text}"`}))',
    ])
      expect(() =>
        Transform.compile({
          moduleId: 'bad.ts',
          source: 'import {css} from "zyzz"; ' + source,
        }),
      ).toThrow()
  })

  test('supports asserted callbacks, quoted fields, negative literals, and empty values', async () => {
    const output = Transform.compile({
      moduleId: 'scalars.ts',
      source: `import {css} from 'zyzz'; export const style = css(((v: {'item-size': string; order: -1 | 1}) => ({marginLeft: v['item-size'], order: v.order})) satisfies unknown)`,
    })

    expect(output.css).toContain('order:var(')

    const built = await Esbuild.build({
      stdin: {
        contents: output.code,
        resolveDir: Path.resolve(import.meta.dirname, '../..'),
        loader: 'ts',
      },
      bundle: true,
      write: false,
      platform: 'node',
      conditions: ['src'],
      format: 'esm',
    })

    const result = await import(
      `data:text/javascript;base64,${Buffer.from(built.outputFiles[0]!.text).toString('base64')}`
    )

    expect(Object.values(result.style({ 'item-size': '', order: -1 }).style))
      .toMatchInlineSnapshot(`
      [
        " ",
        -1,
      ]
    `)
  })
  test('rejects a sign joined to a private numeric token', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'sign.ts',
        source:
          'import {css} from "zyzz"; css((v:{alpha:number})=>({opacity:`+${v.alpha}`}))',
      }),
    ).toThrow()
  })

  test('rejects constrained and reserved callback domains', () => {
    const errors = [
      'css((v:{level:number})=>({zIndex:v.level}))',
      'css((v:{ref:number})=>({opacity:v.ref}))',
      'css((v:{key:number})=>({opacity:v.key}))',
      'css((v:{class:number})=>({opacity:v.class}))',
      'css((v:{width:`${number}%!`})=>({width:v.width}))',
    ].map((source) => {
      try {
        Transform.compile({
          moduleId: 'invalid.ts',
          source: 'import {css} from "zyzz"; ' + source,
        })

        return 'accepted'
      } catch (error) {
        return String(error)
      }
    })

    expect(errors).toMatchInlineSnapshot(`
      [
        "Source.ExtractError: invalid.ts:59: Variable domain is incompatible with this property.",
        "Source.ExtractError: invalid.ts:34: Dynamic values require unique required scalar fields without styling override keys.",
        "Source.ExtractError: invalid.ts:34: Dynamic values require unique required scalar fields without styling override keys.",
        "Source.ExtractError: invalid.ts:34: Dynamic values require unique required scalar fields without styling override keys.",
        "Source.ExtractError: invalid.ts:34: Dynamic values require explicit string or number scalar types.",
      ]
    `)
  })
  test('unwraps non-null callback bodies before binding theme variables', () => {
    expect(
      Transform.compile({
        moduleId: 'body.ts',
        source:
          'import {Theme} from "zyzz"; const t=Theme.define({color:{ink:"red"}}); t.css((v:{alpha:number})=>({color:t.vars.color.ink,opacity:v.alpha})!)',
      }).css,
    ).toMatchInlineSnapshot(`
      ".z_theme-10qvms41gznlvu-t{--z-t10qvms41gznlvu-t-color_2e_ink:red;}
      .z-10qvms41gznlvu-base0{color:var(--z-t10qvms41gznlvu-t-color_2e_ink,red);opacity:var(--z-d10qvms41gznlvu-71-61-6c-70-68-61);}"
    `)
  })
  test('rejects imported names in callback template annotations', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'annotation.ts',
        source:
          'import {css,Theme} from "zyzz"; css((v:{width:`${Theme.Length}px`})=>({width:v.width}))',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: annotation.ts:40: Dynamic values require explicit string or number scalar types.]`,
    )
  })
  test('static callable bundles omit the dynamic helper', async () => {
    const output = Transform.compile({
      moduleId: 'static.ts',
      source:
        'import {css} from "zyzz"; export const card=css({display:"block"})',
    })

    const built = await Esbuild.build({
      stdin: {
        contents: output.code,
        resolveDir: Path.resolve(import.meta.dirname, '../..'),
        loader: 'ts',
      },
      bundle: true,
      write: false,
      metafile: true,
      conditions: ['src'],
    })

    expect(
      Object.keys(built.metafile!.inputs)
        .filter((path) => path.endsWith('/runtime/Dynamic.ts'))
        .flatMap((path) =>
          Object.values(built.metafile!.outputs).map(
            (output) => output.inputs[path]?.bytesInOutput ?? 0,
          ),
        ),
    ).toMatchInlineSnapshot(`
      [
        0,
      ]
    `)
  })
  test('rejects number slots adjacent to dimension suffixes', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'units.ts',
        source:
          'import {css} from "zyzz"; css((v:{size:number})=>({width:`${v.size}px`}))',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: units.ts:57: Expected a literal string or number; expressions are not evaluated.]`,
    )
  })
  test('retains static fallbacks in asserted theme callbacks', () => {
    expect(
      Transform.compile({
        moduleId: 'fallback.ts',
        source:
          'import {Theme} from "zyzz"; const t=Theme.define({color:{ink:"red"}}); t.css(((v:{alpha:number})=>({opacity:v.alpha,color:["blue",t.vars.color.ink]})) satisfies Callback)',
      }).css,
    ).toMatchInlineSnapshot(`
      ".z_theme-181sefq1osze6y-t{--z-t181sefq1osze6y-t-color_2e_ink:red;}
      .z-181sefq1osze6y-base0{opacity:var(--z-d181sefq1osze6y-71-61-6c-70-68-61);color:blue;color:var(--z-t181sefq1osze6y-t-color_2e_ink,red);}"
    `)
  })
  test('compiles callbacks to fixed rules and preserves callable values', async () => {
    const output = Transform.compile({ moduleId: 'dynamic.ts', source })

    expect(output.css).toMatchInlineSnapshot(
      `".z-1h5dayl7tfv4v-base0{display:block;width:var(--z-d1h5dayl7tfv4v-47-61-6d-6f-75-6e-74);margin-left:calc(var(--z-d1h5dayl7tfv4v-47-67-61-70) + 2px);opacity:var(--z-d1h5dayl7tfv4v-47-61-6c-70-68-61);}"`,
    )
    expect(output.code.includes('values.amount')).toMatchInlineSnapshot(`false`)
    expect(output.code.includes('css.Dynamic')).toMatchInlineSnapshot(`true`)

    const built = await Esbuild.build({
      stdin: {
        contents: output.code,
        resolveDir: Path.resolve(import.meta.dirname, '../..'),
        loader: 'ts',
      },
      bundle: true,
      write: false,
      platform: 'node',
      conditions: ['src'],
      format: 'esm',
    })

    const module = await import(
      `data:text/javascript;base64,${Buffer.from(built.outputFiles[0]!.text).toString('base64')}`
    )

    expect(module.first).toMatchInlineSnapshot(`
      {
        "className": "z-1h5dayl7tfv4v-base0 z-style-1h5dayl7tfv4v-47",
        "style": {
          "--z-d1h5dayl7tfv4v-47-61-6c-70-68-61": 0.5,
          "--z-d1h5dayl7tfv4v-47-61-6d-6f-75-6e-74": "25%",
          "--z-d1h5dayl7tfv4v-47-67-61-70": "4px",
        },
      }
    `)
    expect(
      module.bar({
        amount: '75%',
        gap: '8px',
        alpha: 1,
        className: 'external',
        style: { color: 'red' },
      }),
    ).toMatchInlineSnapshot(`
      {
        "className": "z-1h5dayl7tfv4v-base0 z-style-1h5dayl7tfv4v-47 external",
        "style": {
          "--z-d1h5dayl7tfv4v-47-61-6c-70-68-61": 1,
          "--z-d1h5dayl7tfv4v-47-61-6d-6f-75-6e-74": "75%",
          "--z-d1h5dayl7tfv4v-47-67-61-70": "8px",
          "color": "red",
        },
      }
    `)

    const key = Object.keys(module.first.style)[0]!

    expect(
      module.bar({
        amount: '50%',
        gap: '8px',
        alpha: 1,
        style: { [key]: 'bad' },
      }).style[key],
    ).toBe('50%')
  })

  test('Chromium updates values with stable classes and rule counts', async () => {
    const output = Transform.compile({ moduleId: 'dynamic.ts', source })

    const built = await Esbuild.build({
      stdin: {
        contents: output.code,
        resolveDir: Path.resolve(import.meta.dirname, '../..'),
        loader: 'ts',
      },
      bundle: true,
      write: false,
      platform: 'browser',
      conditions: ['src'],
      format: 'iife',
      globalName: 'fixture',
    })

    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${output.css}</style><div style="width:200px"><div id="bar"></div></div>`,
      )
      await page.addScriptTag({
        content:
          built.outputFiles[0]!.text +
          `;globalThis.update = (amount) => { const props = fixture.bar({amount,gap:'0px',alpha:1}); const element = document.getElementById('bar'); element.className = props.className; for(const [key,value] of Object.entries(props.style)) element.style.setProperty(key,String(value)); }; globalThis.update('25%');`,
      })

      expect(
        await page
          .locator('#bar')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"50px"`)

      const original = await page.locator('#bar').getAttribute('class')

      await page.addScriptTag({
        content: `for(let i=0;i<20;i++) globalThis.update('75%')`,
      })

      expect(
        await page
          .locator('#bar')
          .evaluate((element) => getComputedStyle(element).width),
      ).toMatchInlineSnapshot(`"150px"`)
      expect(
        (await page.locator('#bar').getAttribute('class')) === original,
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page.evaluate(() => document.styleSheets[0]!.cssRules.length),
      ).toMatchInlineSnapshot(`1`)
    } finally {
      await browser.close()
    }
  })

  test('mixes bound theme references with static and dynamic declarations', () => {
    expect(
      Transform.compile({
        moduleId: 'theme-dynamic.ts',
        source:
          'import { Theme } from "zyzz"; const theme = Theme.define({color:{brand:"red"}}); export const bar = theme.css((values: {alpha:number})=>({color:theme.vars.color.brand,opacity:values.alpha}));',
      }).css,
    ).toMatchInlineSnapshot(`
      ".z_theme-1aby40l12ykqib-theme{--z-t1aby40l12ykqib-theme-color_2e_brand:red;}
      .z-1aby40l12ykqib-base0{color:var(--z-t1aby40l12ykqib-theme-color_2e_brand,red);opacity:var(--z-d1aby40l12ykqib-100-61-6c-70-68-61);}"
    `)
  })

  test('encodes identifier characters in private CSS names', () => {
    expect(
      Transform.compile({
        moduleId: 'dollar.ts',
        source:
          'import { css } from "zyzz"; css((values:{$alpha:number})=>({opacity:values.$alpha}))',
      }).css,
    ).toMatchInlineSnapshot(
      `".z-ijyhsi11fth46-base0{opacity:var(--z-dijyhsi11fth46-28-24-61-6c-70-68-61);}"`,
    )
  })

  test('rejects interpolated dynamic fallback entries', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'fallback.ts',
        source:
          'import { css } from "zyzz"; css((values:{width:number})=>({width:["1px",`${values.width}px`]}))',
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: fallback.ts:72: Expected a literal string or number; expressions are not evaluated.
      fallback.ts:75: Dynamic fallback entries are not supported.
      fallback.ts:75: Dynamic fallback entries are not supported.]
    `)
  })

  test('rejects dynamic rule structure and optional values', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source:
          'import { css } from "zyzz"; css((values:{width?:string})=>({width:values.width}))',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:41: Dynamic values require unique required scalar fields without styling override keys.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source:
          'import { css } from "zyzz"; css((values:{width:string})=>({...values}))',
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:59: Static spreads require an immutable object literal.]`,
    )
  })
})
