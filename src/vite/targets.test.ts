/** Verifies precompiled stylesheets keep native light-dark() through Vite's CSS pipeline. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { build } from 'vite'
import { describe, expect, test } from 'vite-plus/test'
import { targets } from './index.js'

describe('targets', () => {
  test('preserves light-dark() that Vite would lower by default', async () => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-vite-targets-'))

    try {
      await Fs.writeFile(
        Path.join(root, 'styles.css'),
        '.scope{color-scheme:dark}.card{color:light-dark(#111111,#eeeeee)}',
      )
      await Fs.writeFile(Path.join(root, 'main.ts'), "import './styles.css'")

      const stylesheets: string[] = []
      for (const plugins of [[], [targets()]]) {
        const result = await build({
          root,
          configFile: false,
          logLevel: 'silent',
          plugins,
          build: {
            cssCodeSplit: false,
            write: false,
            rolldownOptions: { input: Path.join(root, 'main.ts') },
          },
        })
        if (Array.isArray(result) || !('output' in result))
          throw new Error('Expected one Vite build.')
        const stylesheet = result.output.find(
          (file) => file.type === 'asset' && file.fileName.endsWith('.css'),
        )
        if (!stylesheet || stylesheet.type !== 'asset')
          throw new Error('Expected a stylesheet asset.')
        stylesheets.push(
          typeof stylesheet.source === 'string'
            ? stylesheet.source
            : new TextDecoder().decode(stylesheet.source),
        )
      }

      const [lowered, preserved] = stylesheets

      expect(lowered?.includes('light-dark(')).toMatchInlineSnapshot('false')
      expect(preserved?.includes('light-dark(')).toMatchInlineSnapshot('true')
    } finally {
      await Fs.rm(root, { force: true, recursive: true })
    }
  })

  test('rejects explicit targets without light-dark() support', async () => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-vite-targets-'))

    try {
      await Fs.writeFile(Path.join(root, 'main.ts'), '')

      await expect(
        build({
          root,
          configFile: false,
          logLevel: 'silent',
          plugins: [targets()],
          build: {
            cssTarget: 'chrome111',
            write: false,
            rolldownOptions: { input: Path.join(root, 'main.ts') },
          },
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        '[Error: Zyzz theme colours require native light-dark() support. Set CSS targets to Chrome/Edge 123+, Firefox 120+, or Safari/iOS 17.5+.]',
      )
    } finally {
      await Fs.rm(root, { force: true, recursive: true })
    }
  })
})
