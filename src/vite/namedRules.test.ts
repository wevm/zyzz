/** Verifies eager named declarations in a real production Vite build. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Vite from 'vite'
import { describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'

describe('zyzz', () => {
  test('retains named declarations from disconnected source modules', async () => {
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
        Path.join(root, 'effects.ts'),
        `import {counterStyle,fontPaletteValues,positionTry,colorProfile} from 'zyzz/web';export const counter=counterStyle({system:'cyclic',symbols:'"x"'});export const palette=fontPaletteValues({fontFamily:'Body',basePalette:0});export const below=positionTry({top:'1px'});export const profile=colorProfile({src:'url(/profile.icc)'});`,
      )
      const build = await Vite.build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [zyzz()],
        build: { write: false, minify: false, cssMinify: false },
      })
      if (!('output' in build)) throw new Error('Expected one Rollup output')
      const css = build.output
        .filter(
          (value) => value.type === 'asset' && value.fileName.endsWith('.css'),
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
          "@color-profile",
        ]
      `)
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
