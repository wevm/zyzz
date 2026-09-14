/** Verifies configured output through source graphs, runtime props, and CSS maps. @module */
import * as Trace from '@jridgewell/trace-mapping'
import { describe, expect, test } from 'vite-plus/test'
import { Config } from 'zyzz'
import { Css } from 'zyzz/web'
import { Graph, Source, Transform } from 'zyzz/compiler'

describe('compile', () => {
  test('inherits output through config aliases, re-exports, and theme handles', () => {
    for (const cssOutput of ['atomic', 'grouped'] as const) {
      const output = Graph.compile({
        modules: {
          'pkg/config.ts': `import { Config } from 'zyzz'
import { Css } from 'zyzz/web';export const { css, variants, theme } = Config.create({cssOutput:'${cssOutput}',output:'html',theme:{color:{brand:'red'}}});`,
          'pkg/index.ts': `export { css as styled, variants, theme } from './config.js';`,
          'app.ts': `import { styled, variants, theme } from './pkg/index.js';
export const card=styled({color:'brand',padding:'8px'});
export const other=theme.css({color:'brand',padding:'8px'});
export const button=variants({base:{color:'brand',padding:'8px'},variants:{size:{large:{padding:'12px'}}}});
export const props=card();`,
        },
      })
      const app = output.modules['app.ts']!

      if (cssOutput === 'atomic') {
        expect(app.code).toMatchInlineSnapshot(`
          "
          import { CompositionHtml as __zyzzCompositionHtml, Props as __zyzzProps, Recipe as __zyzzRecipe } from 'zyzz/runtime';
          import { styled, variants, theme } from './pkg/index.js';
          export const card=(__zyzzCompositionHtml.bind(__zyzzProps.create({className:"z-text-NXxdb9-0 z-p-8px-NXxdb9-1 z-style-1e8a67z1uaws1j-76"})) as import('zyzz').css.ReturnType<'html'>);
          export const other=(__zyzzCompositionHtml.bind(__zyzzProps.create({className:"z-text-36L1vp-0 z-p-8px-36L1vp-1 z-style-1e8a67z1uaws1j-134"})) as import('zyzz').css.ReturnType<'html'>);
          export const button=(__zyzzCompositionHtml.bind(__zyzzRecipe.create({"axes":{"size":["large"]},"defaults":{},"className":"z-text-ho7psp-0 z-p-8px-ho7psp-1 z-p-ho7psp-2 z-style-1e8a67z1uaws1j-196"})) as import('zyzz').variants.ReturnType<{variants:{"size":{"large":{}}}},"html">);
          export const props=card();"
        `)
        expect(app.css).toMatchInlineSnapshot(`
          ".z_theme-1g1qfxjzbnv3-css-theme{--z-t1g1qfxjzbnv3-css-color_2e_brand:red;}
          .z-text-NXxdb9-0{color:var(--z-t1g1qfxjzbnv3-css-color_2e_brand,red);}
          .z-p-8px-NXxdb9-1{padding:8px;}
          .z-text-36L1vp-0{color:var(--z-t1g1qfxjzbnv3-css-color_2e_brand,red);}
          .z-p-8px-36L1vp-1{padding:8px;}
          .z-text-ho7psp-0{color:var(--z-t1g1qfxjzbnv3-css-color_2e_brand,red);}
          .z-p-8px-ho7psp-1{padding:8px;}
          .z-p-ho7psp-2{&:where([data-size="large"]){padding:12px;}}"
        `)
      } else {
        expect(app.code).toMatchInlineSnapshot(`
          "
          import { CompositionHtml as __zyzzCompositionHtml, Props as __zyzzProps, Recipe as __zyzzRecipe } from 'zyzz/runtime';
          import { styled, variants, theme } from './pkg/index.js';
          export const card=(__zyzzCompositionHtml.bind(__zyzzProps.create({className:"g-style-1e8a67z1uaws1j-76 z-style-1e8a67z1uaws1j-76"})) as import('zyzz').css.ReturnType<'html'>);
          export const other=(__zyzzCompositionHtml.bind(__zyzzProps.create({className:"g-style-1e8a67z1uaws1j-134 z-style-1e8a67z1uaws1j-134"})) as import('zyzz').css.ReturnType<'html'>);
          export const button=(__zyzzCompositionHtml.bind(__zyzzRecipe.create({"axes":{"size":["large"]},"defaults":{},"className":"g-style-1e8a67z1uaws1j-196 z-style-1e8a67z1uaws1j-196"})) as import('zyzz').variants.ReturnType<{variants:{"size":{"large":{}}}},"html">);
          export const props=card();"
        `)
        expect(app.css).toMatchInlineSnapshot(`
          ".z_theme-1g1qfxjzbnv3-css-theme{--z-t1g1qfxjzbnv3-css-color_2e_brand:red;}
          .g-style-1e8a67z1uaws1j-76{color:var(--z-t1g1qfxjzbnv3-css-color_2e_brand,red);padding:8px;}
          .g-style-1e8a67z1uaws1j-134{color:var(--z-t1g1qfxjzbnv3-css-color_2e_brand,red);padding:8px;}
          .g-style-1e8a67z1uaws1j-196{color:var(--z-t1g1qfxjzbnv3-css-color_2e_brand,red);padding:8px;&:where([data-size="large"]){padding:12px;}}"
        `)
      }
    }
  })

  test('mode changes invalidate class output and preserve declaration tracing', () => {
    const source = (mode: string) =>
      `import {Config} from 'zyzz';const {css}=Config.create({cssOutput:'${mode}'});export const card=css({color:'red',padding:'8px'});`
    const atomic = Transform.compile({
      moduleId: 'app.ts',
      source: source('atomic'),
    })
    const grouped = Transform.compile({
      moduleId: 'app.ts',
      source: source('grouped'),
    })

    expect(atomic.classes).toMatchInlineSnapshot(`
      {
        "style-1e8a67z1uaws1j-94": "z-text-red-Jgxd-Q z-p-8px-Jgxd-Q z-style-1e8a67z1uaws1j-94",
      }
    `)
    expect(grouped.classes).toMatchInlineSnapshot(`
      {
        "style-1e8a67z1uaws1j-95": "g-style-1e8a67z1uaws1j-95 z-style-1e8a67z1uaws1j-95",
      }
    `)
    for (const [mode, output] of [
      ['atomic', atomic],
      ['grouped', grouped],
    ] as const) {
      const lines = output.css.split('\n')
      const line = lines.findIndex((line) => line.includes('padding:8px'))
      const mapped = Trace.originalPositionFor(
        new Trace.TraceMap(output.cssMap),
        {
          column: lines[line]!.indexOf('padding:8px'),
          line: line + 1,
        },
      )
      expect(mapped.source).toMatchInlineSnapshot(`"app.ts"`)
      if (mode === 'atomic') expect(mapped.column).toMatchInlineSnapshot(`111`)
      else expect(mapped.column).toMatchInlineSnapshot(`112`)
    }
  })

  test('rejects unsupported output options through config and extraction', () => {
    expect(() =>
      Config.create({ cssOutput: 'automatic' } as never),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Config.InvalidError: cssOutput must be atomic or grouped.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'app.ts',
        source:
          "import {Config} from 'zyzz';const {css}=Config.create({cssOutput:'automatic'});const card=css({color:'red'});",
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: app.ts:40: cssOutput must be atomic or grouped.]`,
    )
  })
  test('preserves immutable configured output across extraction and composition', () => {
    for (const cssOutput of ['atomic', 'grouped'] as const) {
      const source = `import {Config,cx} from 'zyzz';const {css}=Config.create({cssOutput:'${cssOutput}'});const a=css({color:'red',padding:'8px'});const b=css({paddingLeft:'2px'});export const props=cx(a(),b());`
      const extracted = Source.extract({ moduleId: 'config.ts', source })
      function frozen(
        style: (typeof extracted.styles.styles)[number],
      ): boolean {
        return (
          Object.isFrozen(style) &&
          Object.isFrozen(style.declarations) &&
          (!style.rules ||
            (Object.isFrozen(style.rules) &&
              style.rules.every(
                (rule) => Object.isFrozen(rule) && frozen(rule.style),
              )))
        )
      }
      expect(extracted.styles.styles.every(frozen)).toMatchInlineSnapshot(
        `true`,
      )
      if (cssOutput === 'atomic')
        expect(extracted.styles.styles.map((style) => style.cssOutput))
          .toMatchInlineSnapshot(`
            [
              "atomic",
              "atomic",
              "atomic",
            ]
          `)
      else
        expect(extracted.styles.styles.map((style) => style.cssOutput))
          .toMatchInlineSnapshot(`
            [
              "grouped",
              "grouped",
              "atomic",
            ]
          `)
      const output = Transform.compile({ moduleId: 'config.ts', source })
      const emitted = Css.compile({
        cssOutput: cssOutput === 'atomic' ? 'grouped' : 'atomic',
        styles: extracted.styles,
      })
      if (cssOutput === 'atomic') {
        expect(output.css).toMatchInlineSnapshot(`
          ".z-text-red-pHVTxb-0{color:red;}
          .z-p-8px-pHVTxb-1{padding:8px;}
          .z-pl-2px-Q94x48-0{padding-left:2px;}
          .z-text-red-vb56La-0{color:red;}
          .z-p-8px-vb56La-1{padding:8px;}
          .z-pl-2px-vb56La-2{padding-left:2px;}"
        `)
        expect(emitted.css).toMatchInlineSnapshot(`
          ".z-text-red-Xy5JQE-0{color:red;}
          .z-p-8px-Xy5JQE-1{padding:8px;}
          .z-pl-2px-B2WTsH-0{padding-left:2px;}
          .z-text-red-kbyxdF-0{color:red;}
          .z-p-8px-kbyxdF-1{padding:8px;}
          .z-pl-2px-kbyxdF-2{padding-left:2px;}"
        `)
      } else {
        expect(output.css).toMatchInlineSnapshot(`
          ".g-style-u8smm21l81sow-88{color:red;padding:8px;}
          .g-style-u8smm21l81sow-129{padding-left:2px;}
          .z-style-3O7IWW-0{color:red;padding:8px;}
          .z-style-3O7IWW-1{padding-left:2px;}"
        `)
        expect(emitted.css).toMatchInlineSnapshot(`
          ".g-style-u8smm21l81sow-88{color:red;padding:8px;}
          .g-style-u8smm21l81sow-129{padding-left:2px;}
          .z-style-EZLe7p-0{color:red;padding:8px;}
          .z-style-EZLe7p-1{padding-left:2px;}"
        `)
      }
    }
  })

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

  test('rejects invalid style output metadata through the public emitter', () => {
    const extracted = Source.extract({
      moduleId: 'invalid.ts',
      source: "import {css} from 'zyzz'; css({color:'red'})",
    })
    const styles = {
      ...extracted.styles,
      styles: extracted.styles.styles.map((style) => ({
        ...style,
        cssOutput: 'invalid' as 'atomic',
      })),
    }
    expect(() => Css.compile({ styles })).toThrowErrorMatchingInlineSnapshot(
      `[Css.CompileError: ["style-1snulh75pd83z-26","cssOutput"]: cssOutput must be atomic or grouped.]`,
    )
  })
})
