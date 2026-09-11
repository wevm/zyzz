/** Exercises named descriptor identities through source and packed-library compilation. @module */
import * as Esbuild from 'esbuild'
import * as Trace from '@jridgewell/trace-mapping'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Transform } from 'zyzz/compiler'

describe('compile', () => {
  test('emits valid JavaScript, prunes dead names, and resolves wrapped references', async () => {
    const output = Transform.compile({
      moduleId: 'names.js',
      source: `import {counterStyle,fontPaletteValues,positionTry,colorProfile} from 'zyzz/web';const unused=counterStyle({symbols:'"x"'});const unusedPalette=fontPaletteValues({fontFamily:'Body'});const unusedPosition=positionTry({top:'1px'});const unusedProfile=colorProfile({src:'url(/profile.icc)'});const base=counterStyle({symbols:'"x"'});export const alias=counterStyle({system:'extends decimal',fallback:(base)});`,
    })
    expect(
      (await Esbuild.transform(output.code, { loader: 'js' })).warnings,
    ).toMatchInlineSnapshot('[]')
    expect(output.css).toMatchInlineSnapshot(`
      "@counter-style z-counterstyle16ar4zc1t3v3rg-62-61-73-65{symbols:"x";}
      @counter-style z-counterstyle16ar4zc1t3v3rg-61-6c-69-61-73{system:extends decimal;fallback:z-counterstyle16ar4zc1t3v3rg-62-61-73-65;}"
    `)
    const map = new Trace.TraceMap(output.cssMap)
    expect(Trace.originalPositionFor(map, { line: 2, column: 0 }))
      .toMatchInlineSnapshot(`
      {
        "column": 349,
        "line": 1,
        "name": null,
        "source": "names.js",
      }
    `)
  })
  test('rejects untyped cross-domain references and malformed descriptors', () => {
    const cases = [
      `export const x=counterStyle({});`,
      `export const x=counterStyle({system:'fixedfoo',symbols:'"x"'});`,
      `export const x=counterStyle({symbols:'"x"',fallback:1});`,
      `const p=fontPaletteValues({fontFamily:'Body'});export const x=css({listStyleType:p});`,
      `const p=fontPaletteValues({fontFamily:'Body'});export const x=counterStyle({symbols:'"x"',fallback:(p)});`,
    ]
    expect(
      cases.map((source) => {
        try {
          Transform.compile({
            moduleId: 'bad.js',
            source:
              `import {css} from 'zyzz';import {counterStyle,fontPaletteValues} from 'zyzz/web';` +
              source,
          })
          return 'accepted'
        } catch (error) {
          return error
        }
      }),
    ).toMatchInlineSnapshot(`
      [
        [Source.ExtractError: bad.js:96: The counter system requires symbols or additiveSymbols.],
        [Source.ExtractError: bad.js:96: Expected a supported counter system, with an integer after fixed.],
        [Source.ExtractError: bad.js:96: Expected supported scalar descriptors and required fields.],
        [Source.ExtractError: bad.js:162: Named stylesheet reference is incompatible with this property.],
        [Source.ExtractError: bad.js:143: Named stylesheet reference is incompatible with this descriptor.],
      ]
    `)
  })
  test('emits each named descriptor family and direct references', () => {
    const output = Transform.compile({
      moduleId: 'names.ts',
      source: `import {css} from 'zyzz'; import {colorProfile,counterStyle,fontPaletteValues,positionTry} from 'zyzz/web';
export const dots=counterStyle({system:'cyclic',symbols:'"●"',suffix:'" "'});
export const palette=fontPaletteValues({fontFamily:'Body',basePalette:0,overrideColors:'0 red'});
export const below=positionTry({positionArea:'bottom',marginTop:'4px'});
export const profile=colorProfile({src:'url(/profile.icc)',renderingIntent:'relative-colorimetric'});
export const styles={list:css({listStyleType:dots,fontPalette:palette,positionTryFallbacks:below})};`,
    })
    expect(output.css).toMatchInlineSnapshot(`
      "@counter-style z-counterstyle141558i1cjhj8q-64-6f-74-73{system:cyclic;symbols:"●";suffix:" ";}
      @font-palette-values --z-fontpalettevalues141558i1cjhj8q-70-61-6c-65-74-74-65{font-family:Body;base-palette:0;override-colors:0 red;}
      @position-try --z-positiontry141558i1cjhj8q-62-65-6c-6f-77{position-area:bottom;margin-top:4px;}
      @color-profile --z-colorprofile141558i1cjhj8q-70-72-6f-66-69-6c-65{src:url(/profile.icc);rendering-intent:relative-colorimetric;}
      .z-141558i1cjhj8q-base0{list-style-type:z-counterstyle141558i1cjhj8q-64-6f-74-73;font-palette:--z-fontpalettevalues141558i1cjhj8q-70-61-6c-65-74-74-65;position-try-fallbacks:--z-positiontry141558i1cjhj8q-62-65-6c-6f-77;}"
    `)
    expect(
      output.code
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n'),
    ).toMatchInlineSnapshot(`
      "
      import { Props as __zyzzProps } from 'zyzz/runtime';

      export const dots="z-counterstyle141558i1cjhj8q-64-6f-74-73" as import('zyzz/web').counterStyle.Reference;
      export const palette="--z-fontpalettevalues141558i1cjhj8q-70-61-6c-65-74-74-65" as import('zyzz/web').fontPaletteValues.Reference;
      export const below="--z-positiontry141558i1cjhj8q-62-65-6c-6f-77" as import('zyzz/web').positionTry.Reference;
      export const profile="--z-colorprofile141558i1cjhj8q-70-72-6f-66-69-6c-65" as import('zyzz/web').colorProfile.Reference;
      export const styles={list:__zyzzProps.create({className:"z-141558i1cjhj8q-base0"})};"
    `)
  })
  test('preserves aliases and re-exports through packed metadata and rebuilds', () => {
    const compiler = Graph.create()
    const library = Graph.compile({
      modules: {
        'names.ts': `import {counterStyle} from 'zyzz/web';const dots=counterStyle({system:'cyclic',symbols:'"●"'});const alias=dots;export {alias};`,
      },
    })
    const input = {
      contracts: { 'lib/names.js': library.contracts['names.ts']! },
      imports: { 'app.ts': { lib: 'lib/names.js', zyzz: null } },
      modules: {
        'app.ts': `import {css} from 'zyzz';import {alias} from 'lib';export const styles={list:css({listStyleType:alias})};`,
      },
    }
    const output = compiler.compile(input)
    expect(output.sharedCss).toMatchInlineSnapshot(
      `"@counter-style z-counterstyle141558i1cjhj8q-64-6f-74-73{system:cyclic;symbols:"●";}"`,
    )
    expect(output.modules['app.ts']!.css).toMatchInlineSnapshot(
      `".z-1e8a67z1uaws1j-base0{list-style-type:z-counterstyle141558i1cjhj8q-64-6f-74-73;}"`,
    )
    expect(
      JSON.parse(library.contracts['names.ts']!).version,
    ).toMatchInlineSnapshot('9')
    const edited = Graph.compile({
      modules: {
        'names.ts': `import {counterStyle} from 'zyzz/web';export const alias=counterStyle({system:'cyclic',symbols:'"■"'});`,
      },
    })
    expect(
      compiler.compile({
        ...input,
        contracts: { 'lib/names.js': edited.contracts['names.ts']! },
      }).sharedCss,
    ).toMatchInlineSnapshot(
      `"@counter-style z-counterstyle141558i1cjhj8q-61-6c-69-61-73{system:cyclic;symbols:"■";}"`,
    )
  })
  test('rejects unsupported descriptor keys and position declarations at the source call', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {positionTry} from 'zyzz/web';export const fallback=positionTry({color:'red'})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:59: Unsupported position-try declaration.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'bad.ts',
        source: `import {fontPaletteValues} from 'zyzz/web';export const palette=fontPaletteValues({src:'url(/font)'})`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: bad.ts:64: Expected supported scalar descriptors and required fields.]`,
    )
  })
})
