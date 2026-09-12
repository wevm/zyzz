/** Verifies eager named declarations in a real production Vite build. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Vite from 'vite'
import { describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'

describe('zyzz', () => {
  test.each(['zyzz/web', './web', '@/web'])(
    'retains disconnected named declarations through local barrels: %s',
    async (specifier) => {
      const barrel = specifier !== 'zyzz/web'
      const root = await Fs.mkdtemp(Path.resolve('.fixture-named-vite-'))
      try {
        await Fs.writeFile(
          Path.join(root, 'index.html'),
          '<script type="module" src="/main.ts"></script>',
        )
        await Fs.writeFile(
          Path.join(root, 'main.ts'),
          'document.body.textContent="ready"',
        )
        await Fs.writeFile(
          Path.join(root, 'adapter.ts'),
          `export {counterStyle as namedCounter,fontPaletteValues,positionTry} from 'zyzz/web'`,
        )
        await Fs.writeFile(
          Path.join(root, 'web.ts'),
          `export * from './adapter'`,
        )
        await Fs.writeFile(
          Path.join(root, 'effects.ts'),
          `import {${barrel ? 'namedCounter as counterStyle' : 'counterStyle'},fontPaletteValues,positionTry} from '${specifier}';export const counter=counterStyle({system:'cyclic',symbols:'"x"'});export const palette=fontPaletteValues({fontFamily:'Body',basePalette:0});export const below=positionTry({top:'1px'});`,
        )
        const build = await Vite.build({
          root,
          configFile: false,
          logLevel: 'silent',
          plugins: [zyzz()],
          resolve: { alias: { '@': root } },
          build: { write: false, minify: false, cssMinify: false },
        })
        if (!('output' in build)) throw new Error('Expected one Rollup output')
        const css = build.output
          .filter(
            (value) =>
              value.type === 'asset' && value.fileName.endsWith('.css'),
          )
          .map((value) => (value.type === 'asset' ? String(value.source) : ''))
          .join('\n')
        expect(
          css.match(
            /@(counter-style|font-palette-values|position-try|color-profile)/g,
          ),
        ).toMatchInlineSnapshot(`
        [
          "@counter-style",
          "@font-palette-values",
          "@position-try",
        ]
      `)
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    },
  )
})
