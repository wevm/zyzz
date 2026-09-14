/** Verifies profile identities, descriptor output, and packed source ownership. @module */
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'
import * as Trace from '@jridgewell/trace-mapping'

const source = `import {colorProfile, global} from 'zyzz/web';
export const profile = colorProfile({src:'url(./print.icc)',components:'c, m, y, k',renderingIntent:'relative-colorimetric'});
global({body:{color:\`color(\${profile} 0 1 1 0)\`}});`

describe('compile', () => {
  test('requires a URL source', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {colorProfile} from 'zyzz/web';export const profile=colorProfile({src:'local(profile)'});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:59: Color-profile src requires one URL.]`,
    )
  })

  test('rejects an unknown rendering intent', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import {colorProfile} from 'zyzz/web';export const profile=colorProfile({src:'url(/p.icc)',renderingIntent:'auto'});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:59: Invalid color-profile rendering intent.]`,
    )
  })

  test('rejects malformed profile descriptors from packed libraries', () => {
    const library = Graph.compile({
      modules: {
        'profile.ts': `import {colorProfile} from 'zyzz/web';export const profile=colorProfile({src:'url(/p.icc)'});`,
      },
    })
    const contract = JSON.parse(library.contracts['profile.ts']!)
    contract.stylesheets[0].css =
      '@color-profile --profile{src:url(/p.icc);components:r,none,b;}'
    expect(() =>
      Graph.compile({
        contracts: { 'lib.js': JSON.stringify(contract) },
        imports: { 'app.ts': { lib: 'lib.js' } },
        modules: { 'app.ts': `import 'lib';` },
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: lib.js:0: Invalid library contract: Color-profile components require comma-separated identifiers other than none.]`,
    )
  })

  test('validates all profile descriptor grammars before source and packed publication', () => {
    for (const components of [
      'r,g,b',
      '图, \\72 ed, pi',
      'inherit, default, --custom',
      'r,r,b',
    ]) {
      for (const renderingIntent of [
        'absolute-colorimetric',
        'relative-colorimetric',
        'perceptual',
        'saturation',
      ]) {
        const library = Graph.compile({
          modules: {
            'profile.ts': `import {colorProfile} from 'zyzz/web';export const profile=colorProfile({src:'url(/print.icc)',components:${JSON.stringify(components)},renderingIntent:${JSON.stringify(renderingIntent)}},{within:['@layer colors','@media print']});`,
          },
        })
        const packed = Graph.compile({
          contracts: { 'lib.js': library.contracts['profile.ts']! },
          imports: { 'app.ts': { lib: 'lib.js' } },
          modules: { 'app.ts': `export {profile} from 'lib';` },
        })
        expect(
          packed.sharedCss?.includes('rendering-intent:'),
        ).toMatchInlineSnapshot('true')
        expect(packed.sharedCss?.includes('components:')).toMatchInlineSnapshot(
          'true',
        )
      }
    }
  })
  test('rejects invalid component lists instead of emitting an unusable profile', () => {
    for (const components of [
      '',
      'r g b',
      'none',
      'r,NoNe,b',
      'r,\\6e one,b',
      'r,,b',
      'r,b,',
      '1r,g,b',
      '"r",g,b',
    ]) {
      expect(() =>
        Transform.compile({
          moduleId: 'invalid.ts',
          source: `import {colorProfile} from 'zyzz/web';export const profile=colorProfile({src:'url(/print.icc)',components:${JSON.stringify(components)}});`,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[Source.ExtractError: invalid.ts:59: Color-profile components require comma-separated identifiers other than none.]`,
      )
    }
  })

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
      `".z-1e8a67z1uaws1j-base-color-164na6b1lxz3tf{color:color(--z-colorprofile6yg15mcvz3uu-70-72-6f-66-69-6c-65 0 0 0 1);}"`,
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

  test('retains referenced origins before relative profile names in packed output', () => {
    const library = Graph.compile({
      modules: {
        'relative.ts': `import {Theme} from 'zyzz';import {colorProfile,global} from 'zyzz/web';const theme=Theme.define({color:{base:'red'}});const profile=colorProfile({src:'url(/print.icc)',components:'c,m,y,k'});global({body:{color:\`color(from \${theme.vars.color.base} \${profile} c m y k)\`}});`,
      },
    })
    const packed = Graph.compile({
      contracts: { 'lib.js': library.contracts['relative.ts']! },
      imports: { 'app.ts': { lib: 'lib.js' } },
      modules: { 'app.ts': `import 'lib';` },
    })

    expect(packed.sharedCss).toMatchInlineSnapshot(`
      "@color-profile --z-colorprofile1f6rnh81dpdeum-70-72-6f-66-69-6c-65{src:url(/print.icc);components:c,m,y,k;}
      body{color:color(from var(--z-t1f6rnh81dpdeum-theme-color_2e_base,red) --z-colorprofile1f6rnh81dpdeum-70-72-6f-66-69-6c-65 c m y k);}"
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
