/** Verifies profile identities, descriptor output, and packed source ownership. @module */
import * as Trace from '@jridgewell/trace-mapping'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

const source = `import {colorProfile, global} from 'zyzz/web';
export const profile = colorProfile({src:'url(./print.icc)',components:'c, m, y, k',renderingIntent:'relative-colorimetric'});
global({body:{color:\`color(\${profile} 0 1 1 0)\`}});`

describe('compile', () => {
  test('preserves profile components and color expressions across packed aliases', () => {
    const library = Graph.compile({ modules: { 'profiles.ts': source } })
    const output = Graph.compile({
      contracts: { 'lib/profiles.js': library.contracts['profiles.ts']! },
      imports: { 'app.ts': { lib: 'lib/profiles.js', zyzz: null } },
      modules: {
        'app.ts': `import {profile as print} from 'lib';import {css} from 'zyzz';export const styles={text:css({color:\`color(\${print} 0 0 0 1)\`})};`,
      },
    })

    expect(output.sharedCss).toMatchInlineSnapshot(`
      "@color-profile --z-colorprofile6yg15mcvz3uu-70-72-6f-66-69-6c-65 {
        src:url("zyzz-asset:lib%2Fprint.icc");components:c, m, y, k;rendering-intent:relative-colorimetric;
      }
      body{color:color(--z-colorprofile6yg15mcvz3uu-70-72-6f-66-69-6c-65 0 1 1 0);}"
    `)
    expect(output.sharedAssets).toMatchInlineSnapshot(`
      {
        "zyzz-asset:lib%2Fprint.icc": "lib/print.icc",
      }
    `)
    expect(output.modules['app.ts']?.css).toMatchInlineSnapshot(
      `".z-1e8a67z1uaws1j-base0{color:color(--z-colorprofile6yg15mcvz3uu-70-72-6f-66-69-6c-65 0 0 0 1);}"`,
    )
    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.sharedCssMap!), {
        line: 1,
        column: 0,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 23,
        "line": 2,
        "name": null,
        "source": "lib/profiles.ts",
      }
    `)
  })

  test('preserves relative colors and nested profile interpolation', () => {
    const output = Transform.compile({
      moduleId: 'relative.ts',
      source: `import {colorProfile,global} from 'zyzz/web';const profile=colorProfile({src:'url(/print.icc)',components:'c,m,y,k'});global({body:{color:\`color(from rgb(1 2 3) \${profile} c m y k)\`,backgroundColor:\`color(\${\`\${profile}\`} 0 0 0 1)\`}});`,
    })

    expect(output.css).toMatchInlineSnapshot(`
      "@color-profile --z-colorprofile1f6rnh81dpdeum-70-72-6f-66-69-6c-65{src:url(/print.icc);components:c,m,y,k;}
      body{color:color(from rgb(1 2 3) --z-colorprofile1f6rnh81dpdeum-70-72-6f-66-69-6c-65 c m y k);background-color:color(--z-colorprofile1f6rnh81dpdeum-70-72-6f-66-69-6c-65 0 0 0 1);}"
    `)
  })

  test('rejects a profile interpolated outside color()', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {colorProfile,global} from 'zyzz/web';const profile=colorProfile({src:'url(/print.icc)'});global({body:{color:\`\${profile}\`}});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:97: Named stylesheet reference is incompatible with this descriptor.]`,
    )
  })

  test('retains Unicode, import ordering, and source maps without a BOM or charset contribution', () => {
    const output = Graph.compile({
      modules: {
        'unicode.ts': `import {global,importCss} from 'zyzz/web';\nglobal({'body::before':{content:'"héllo ● 日本語"'}});\nimportCss({url:'https://example.com/base.css'});`,
      },
    })
    const packed = Graph.compile({
      contracts: { 'lib/unicode.js': output.contracts['unicode.ts']! },
      imports: { 'app.ts': { lib: 'lib/unicode.js' } },
      modules: { 'app.ts': `import 'lib';` },
    })

    expect(packed.sharedCss).toBe(output.sharedCss)
    const css = packed.sharedCss!

    expect(css).toMatchInlineSnapshot(`
      "@import url("https://example.com/base.css");
      body::before{content:"héllo ● 日本語";}"
    `)
    expect(
      new TextDecoder('utf-8', { fatal: true }).decode(
        new TextEncoder().encode(css),
      ),
    ).toMatchInlineSnapshot(`
      "@import url("https://example.com/base.css");
      body::before{content:"héllo ● 日本語";}"
    `)
    expect(css.startsWith('@import')).toMatchInlineSnapshot('true')
    expect(css.includes('@charset')).toMatchInlineSnapshot('false')
    expect(css.charCodeAt(0) === 0xfeff).toMatchInlineSnapshot('false')
  })
})
