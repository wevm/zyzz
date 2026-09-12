/** Verifies reusable namespace declarations through extraction, bundling, and execution. @module */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const source = `import { css } from 'zyzz';
export namespace styles {
  const spacing = { padding: '8px' } as const;
  const base = { ...spacing, color: 'red' } as const;
  export const card = css(base);
  export const button = css({ ...base, color: 'blue' });
  export const dynamic = css((values: { width: '10px' | '20px' }) => ({ ...base, width: values.width }));
  export const alias = card;
}
export const card = styles.alias();
export const button = styles.button();
export const dynamic = styles.dynamic({ width: '20px' });`

describe('compile', () => {
  test('reuses private declarations and exported callables within a namespace', async () => {
    const output = Transform.compile({ moduleId: 'namespace.ts', source })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-mpx2ize76wo1-base0{padding:8px;}
      .z-style-mpx2ize76wo1-177{color:red;}
      .z-style-mpx2ize76wo1-212{color:blue;}
      .z-mpx2ize76wo1-base1{padding:8px;width:var(--z-dmpx2ize76wo1-270-77-69-64-74-68);}
      .z-style-mpx2ize76wo1-270{color:red;}"
    `)

    const built = await Esbuild.build({
      bundle: true,
      conditions: ['src'],
      format: 'esm',
      platform: 'node',
      stdin: {
        contents: output.code,
        loader: 'ts',
        resolveDir: Path.resolve('.'),
      },
      write: false,
    })
    const result = await import(
      `data:text/javascript;base64,${Buffer.from(built.outputFiles[0]!.text).toString('base64')}`
    )

    expect(result.card).toMatchInlineSnapshot(`
      {
        "className": "z-mpx2ize76wo1-base0 z-style-mpx2ize76wo1-177",
      }
    `)
    expect(result.button).toMatchInlineSnapshot(`
      {
        "className": "z-mpx2ize76wo1-base0 z-style-mpx2ize76wo1-212",
      }
    `)
    expect(result.dynamic).toMatchInlineSnapshot(`
      {
        "className": "z-mpx2ize76wo1-base1 z-style-mpx2ize76wo1-270",
        "style": {
          "--z-dmpx2ize76wo1-270-77-69-64-74-68": "20px",
        },
      }
    `)
    expect(result.styles.alias === result.styles.card).toMatchInlineSnapshot(
      'true',
    )
  })

  test('keeps identically named declarations in separate namespace scopes', () => {
    const output = Transform.compile({
      moduleId: 'scopes.ts',
      source: `import {css} from 'zyzz';
      namespace first { const base = {color:'red'} as const; export const card = css(base); }
      namespace second { const base = {color:'blue'} as const; export const card = css(base); }`,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-style-1ezo5v71uomczz-107{color:red;}
      .z-style-1ezo5v71uomczz-203{color:blue;}"
    `)
  })

  test('rejects mutation of reused namespace declarations', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'mutation.ts',
        source: `import {css} from 'zyzz'; namespace styles { const base = {color:'red'}; base.color='blue'; export const card = css(base); }`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: mutation.ts:73: Static data cannot be mutated or escape through unsupported expressions.]`,
    )
  })
})
