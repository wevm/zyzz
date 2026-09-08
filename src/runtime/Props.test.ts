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
  test('rewritten exports execute with overrides and reject unrelated props', async () => {
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
    const invalid = [
      null,
      [],
      { id: 'button' },
      { 'data-size': 'small' },
      { className: 1 },
      { style: null },
    ]

    expect(consumer.button()).toMatchInlineSnapshot(`
    {
      "className": "z-12ydhop55omeb-base0 z-style-12ydhop55omeb-50",
    }
  `)

    expect(
      invalid.map((value) => {
        try {
          Reflect.apply(bind, undefined, [value])
          return 'accepted'
        } catch (error) {
          return (error as Error).message
        }
      }),
    ).toMatchInlineSnapshot(`
      [
        "Expected only className and style overrides.",
        "Expected only className and style overrides.",
        "Expected only className and style overrides.",
        "Expected only className and style overrides.",
        "Expected a string className override.",
        "Expected an inline style object.",
      ]
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
