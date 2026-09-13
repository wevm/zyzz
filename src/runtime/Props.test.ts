/**
 * Exercises the public Props workflow through real collaborating modules.
 * @module
 */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import { Props } from 'zyzz/runtime'

const root = Path.resolve(import.meta.dirname, '../..')

describe('create', () => {
  test('merges variable assignments in static, dynamic and HTML calls', async () => {
    const result = Transform.compile({
      moduleId: 'usage.ts',
      source: `
      import {Config, css, variable} from 'zyzz';
      const accent=variable();
      const {css: htmlCss}=Config.create({output:'html'});
      const label=css({color:accent});
      const dynamic=css((input:{opacity:number})=>({color:accent,opacity:input.opacity}));
      const html=htmlCss({color:accent});
      const variables=Object.freeze({[accent]:'red'});
      const style=Object.freeze({[accent]:'blue',padding:'2px'});
      export const staticProps=label({variables,style,className:'external'});
      export const dynamicProps=dynamic({opacity:0.5,variables,style});
      export const htmlProps=html({variables});
      export const originals={variables,style};
    `,
    })
    const bundle = await Esbuild.build({
      alias: { 'zyzz/runtime': Path.join(root, 'src/runtime/index.ts') },
      bundle: true,
      format: 'esm',
      stdin: { contents: result.code, loader: 'ts', resolveDir: root },
      write: false,
    })
    const consumer = await import(
      `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0]!.text).toString('base64')}`
    )

    expect(consumer.staticProps).toMatchInlineSnapshot(`
      {
        "className": "z-1g4rm6r9aa2cb-base0 external",
        "style": {
          "--z-v1g4rm6r9aa2cb-70": "blue",
          "padding": "2px",
        },
      }
    `)
    expect(consumer.dynamicProps).toMatchInlineSnapshot(`
      {
        "className": "z-1g4rm6r9aa2cb-base1",
        "style": {
          "--z-d1g4rm6r9aa2cb-200-6f-70-61-63-69-74-79": 0.5,
          "--z-v1g4rm6r9aa2cb-70": "blue",
          "padding": "2px",
        },
      }
    `)
    expect(consumer.htmlProps).toMatchInlineSnapshot(`
      {
        "class": "z-1g4rm6r9aa2cb-base0",
        "style": "--z-v1g4rm6r9aa2cb-70:red",
      }
    `)
    expect(consumer.originals).toMatchInlineSnapshot(`
      {
        "style": {
          "--z-v1g4rm6r9aa2cb-70": "blue",
          "padding": "2px",
        },
        "variables": {
          "--z-v1g4rm6r9aa2cb-70": "red",
        },
      }
    `)
  })

  test('rewritten exports execute with overrides without runtime validation', async () => {
    const source = `import { css } from 'zyzz';
export const button = css({ color: '#f00', padding: '8px' });
export const inline = css({ color: '#fff' })();
export const text = '🎉';`
    const result = Transform.compile({ moduleId: 'example/button.ts', source })

    const bundle = await Esbuild.build({
      alias: { 'zyzz/runtime': Path.join(root, 'src/runtime/index.ts') },
      bundle: true,
      format: 'esm',
      metafile: true,
      stdin: { contents: result.code, loader: 'ts', resolveDir: root },
      write: false,
    })

    const consumer = await import(
      `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0]!.text).toString('base64')}`
    )

    const bind = Props.create({ className: Object.values(result.classes)[0]! })
    const style = { color: '#000', paddingLeft: '2px' } as const

    expect(consumer.button()).toMatchInlineSnapshot(`
    {
      "className": "z-12ydhop55omeb-base0 z-style-12ydhop55omeb-50",
    }
  `)

    expect(consumer.inline).toMatchInlineSnapshot(`
    {
      "className": "z-style-12ydhop55omeb-112",
    }
  `)

    expect(
      !Object.keys(bundle.metafile!.inputs).some((name) =>
        /oxc|compiler|web\/Css/.test(name),
      ),
    ).toMatchInlineSnapshot(`true`)

    expect(consumer.button({ className: 'external', style }))
      .toMatchInlineSnapshot(`
    {
      "className": "z-12ydhop55omeb-base0 z-style-12ydhop55omeb-50 external",
      "style": {
        "color": "#000",
        "paddingLeft": "2px",
      },
    }
  `)

    expect(
      JSON.stringify(consumer.button({ className: 'external', style })) ===
        JSON.stringify(bind({ className: 'external', style })),
    ).toMatchInlineSnapshot(`true`)

    expect(
      JSON.stringify(result) ===
        JSON.stringify(
          Transform.compile({ moduleId: 'example/button.ts', source }),
        ),
    ).toMatchInlineSnapshot(`true`)

    expect(style).toMatchInlineSnapshot(`
    {
      "color": "#000",
      "paddingLeft": "2px",
    }
  `)

    expect(consumer.text).toMatchInlineSnapshot(`"🎉"`)
  })
})
