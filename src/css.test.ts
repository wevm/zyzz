import * as Esbuild from 'esbuild'
import { expect, test } from 'vite-plus/test'
import { css } from 'zyzz'
import { Source } from 'zyzz/compiler'
import { Css } from 'zyzz/web'

test('public root bundles for browsers without the source parser', async () => {
  const result = await Esbuild.build({
    bundle: true,
    conditions: ['src'],
    metafile: true,
    platform: 'browser',
    stdin: {
      contents: "export { css, Style } from 'zyzz'",
      resolveDir: process.cwd(),
    },
    write: false,
  })
  expect({
    browserBundle: result.outputFiles.length,
    parserIncluded: Object.keys(result.metafile.inputs).some(
      (path) =>
        path.includes('@babel') ||
        path.includes('oxc-parser') ||
        path.includes('oxc-walker') ||
        path.includes('/compiler/'),
    ),
  }).toMatchInlineSnapshot(`
    {
      "browserBundle": 1,
      "parserIncluded": false,
    }
  `)
})

test('literal authoring extracts but cannot execute without source rewriting', () => {
  const result = Source.extract({
    moduleId: 'example/style.ts',
    source: "import { css } from 'zyzz'; css({ padding: 0 });",
  })
  expect(Css.compile({ styles: result.styles }).css).toMatchInlineSnapshot(
    `".z_base0{padding:0;}"`,
  )
  expect(() => css({ padding: 0 })).toThrowErrorMatchingInlineSnapshot(
    `[css.MissingTransformError: css requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.]`,
  )
})
