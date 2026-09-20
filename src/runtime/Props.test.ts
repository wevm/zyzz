/**
 * Exercises the public Props workflow through real collaborating modules.
 * @module
 */
import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import type { CSSProperties } from 'react'
import { describe, expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'
import { Props } from 'zyzz/runtime'

const root = Path.resolve(import.meta.dirname, '../..')

describe('create', () => {
  test('merges variable assignments in static, dynamic and HTML calls', async () => {
    const result = Transform.compile({
      moduleId: 'usage.ts',
      source: `
      import { Config, style, variable } from 'zyzz';
      const accent=variable();
      const {style: htmlStyle}=Config.create({output:'html'});
      const label=style({color:accent});
      const dynamic=style((input:{opacity:number})=>({color:accent,opacity:input.opacity}));
      const html=htmlStyle({color:accent});
      const variables=Object.freeze({[accent]:'red'});
      const inline=Object.freeze({[accent]:'blue',padding:'2px'});
      export const staticProps=label({variables,style:inline,className:'external'});
      export const dynamicProps=dynamic({opacity:0.5,variables,style:inline});
      export const htmlProps=html({variables});
      export const originals={variables,style:inline};
      export const variablesOnly=dynamic({opacity:0.5,variables});
      const htmlDynamic=htmlStyle((input:{opacity:number})=>({color:accent,opacity:input.opacity}));
      export const htmlDynamicProps=htmlDynamic({opacity:0.25,variables});
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
        "className": "z-text-Ppd1-S external",
        "style": {
          "--z-v1g4rm6r9aa2cb-74": "blue",
          "padding": "2px",
        },
      }
    `)
    expect(consumer.dynamicProps).toMatchInlineSnapshot(`
      {
        "className": "z-text-Ppd1-S z-opacity-NQNW0k-0",
        "style": {
          "--z-d1g4rm6r9aa2cb-210-6f-70-61-63-69-74-79": 0.5,
          "--z-v1g4rm6r9aa2cb-74": "blue",
          "padding": "2px",
        },
      }
    `)
    expect(consumer.htmlProps).toMatchInlineSnapshot(`
      {
        "class": "z-text-Ppd1-S",
        "style": "--z-v1g4rm6r9aa2cb-74:red",
      }
    `)
    expect(consumer.variablesOnly).toMatchInlineSnapshot(`
      {
        "className": "z-text-Ppd1-S z-opacity-NQNW0k-0",
        "style": {
          "--z-d1g4rm6r9aa2cb-210-6f-70-61-63-69-74-79": 0.5,
          "--z-v1g4rm6r9aa2cb-74": "red",
        },
      }
    `)
    expect(consumer.htmlDynamicProps).toMatchInlineSnapshot(`
      {
        "class": "z-text-Ppd1-S z-opacity-bKRLtj-0",
        "style": "--z-v1g4rm6r9aa2cb-74:red;--z-d1g4rm6r9aa2cb-807-6f-70-61-63-69-74-79:0.25",
      }
    `)
    expect(consumer.originals).toMatchInlineSnapshot(`
      {
        "style": {
          "--z-v1g4rm6r9aa2cb-74": "blue",
          "padding": "2px",
        },
        "variables": {
          "--z-v1g4rm6r9aa2cb-74": "red",
        },
      }
    `)
  })

  test('rewritten exports execute with overrides without runtime validation', async () => {
    const source = `import { style } from 'zyzz';
export const button = style({ color: '#f00', padding: '8px' });
export const inline = style({ color: '#fff' })();
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
        "className": "z-text-LDML8V-0 z-p-8px-z6lkOr z-style-12ydhop55omeb-52",
      }
    `)

    expect(consumer.inline).toMatchInlineSnapshot(`
      {
        "className": "z-text-4RcTT1-0",
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
          "className": "z-text-LDML8V-0 z-p-8px-z6lkOr z-style-12ydhop55omeb-52 external",
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

    const inline: CSSProperties = Object.freeze({
      opacity: undefined,
      padding: 12,
    })

    expect(bind({ style: inline }).style).toBe(inline)
    expect(consumer.button({ style: inline }).style).toEqual({
      opacity: undefined,
      padding: 12,
    })
    expect(consumer.button({ style: { padding: 'md' } }).style).toEqual({
      padding: 'md',
    })
  })
})
