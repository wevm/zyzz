import * as Esbuild from 'esbuild'
import * as Path from 'node:path'
import { expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const root = Path.resolve(import.meta.dirname, '../..')

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
  const style = { color: '#000', paddingLeft: '2px' }
  const invalid = [
    null,
    [],
    { id: 'button' },
    { 'data-size': 'small' },
    { className: 1 },
    { style: null },
  ]
  expect({
    defaults: consumer.button(),
    errors: invalid.map((value) => {
      try {
        consumer.button(value)
        return 'accepted'
      } catch (error) {
        return (error as Error).message
      }
    }),
    inline: consumer.inline,
    isolated: !Object.keys(bundle.metafile!.inputs).some((name) =>
      /oxc|compiler|web\/Css/.test(name),
    ),
    overrides: consumer.button({ className: 'external', style }),
    same:
      JSON.stringify(result) ===
      JSON.stringify(
        Transform.compile({ moduleId: 'example/button.ts', source }),
      ),
    style,
    text: consumer.text,
  }).toMatchInlineSnapshot(`
    {
      "defaults": {
        "className": "z-12ydhop55omeb-base0 z-style-12ydhop55omeb-50",
      },
      "errors": [
        "Expected only className and style overrides.",
        "Expected only className and style overrides.",
        "Expected only className and style overrides.",
        "Expected only className and style overrides.",
        "Expected a string className override.",
        "Expected an inline style object.",
      ],
      "inline": {
        "className": "z-style-12ydhop55omeb-112",
      },
      "isolated": true,
      "overrides": {
        "className": "z-12ydhop55omeb-base0 z-style-12ydhop55omeb-50 external",
        "style": {
          "color": "#000",
          "paddingLeft": "2px",
        },
      },
      "same": true,
      "style": {
        "color": "#000",
        "paddingLeft": "2px",
      },
      "text": "🎉",
    }
  `)
})
