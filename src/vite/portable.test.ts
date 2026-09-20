/** Verifies Vite stylesheet delivery with and without authoring transformation. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { build } from 'vite'
import { describe, expect, test } from 'vite-plus/test'
import { zyzz } from './index.js'

describe('zyzz', () => {
  test.each(['atomic', 'grouped'] as const)(
    'delivers %s CSS with either compiler setting',
    async (cssOutput) => {
      const root = await Fs.mkdtemp(Path.resolve('.fixture-vite-portable-'))
      const browser = await chromium.launch()
      try {
        await Fs.writeFile(
          Path.join(root, 'main.ts'),
          `import { Config, variable } from 'zyzz';
        const { style } = Config.create({ cssOutput: '${cssOutput}' });
        const accent = variable('color', { id: 'vite-accent' });
        const card = style({ color: accent, padding: '8px' });
        const props = card({ vars: accent.set('red') }); Object.assign(globalThis, { fixture: { props } });`,
        )
        const page = await browser.newPage()
        for (const compiler of [false, true]) {
          const result = await build({
            root,
            configFile: false,
            logLevel: 'silent',
            plugins: [zyzz({ compiler })],
            resolve: {
              alias: [
                { find: /^zyzz$/, replacement: Path.resolve('src/index.ts') },
                {
                  find: /^zyzz\/runtime$/,
                  replacement: Path.resolve('src/runtime/index.ts'),
                },
              ],
            },
            build: {
              cssCodeSplit: false,
              write: false,
              minify: true,
              rolldownOptions: {
                input: Path.join(root, 'main.ts'),
                output: { format: 'iife', name: 'fixture' },
              },
            },
          })
          if (Array.isArray(result) || !('output' in result))
            throw new Error('Expected one Vite build.')
          const script = result.output.find((file) => file.type === 'chunk')!
          const stylesheet = result.output.find(
            (file) => file.type === 'asset' && file.fileName.endsWith('.css'),
          )!
          if (
            !script ||
            !stylesheet ||
            script.type !== 'chunk' ||
            stylesheet.type !== 'asset'
          )
            throw new Error('Missing build output.')
          await page.setContent(
            `<style>${stylesheet.source}</style><div id="card"></div>`,
          )
          await page.addScriptTag({ content: script.code })
          await page.evaluate(() => {
            const props = (
              window as unknown as {
                fixture: {
                  props: { className: string; style: Record<string, string> }
                }
              }
            ).fixture.props
            const card = document.getElementById('card')!
            card.className = props.className
            for (const [name, value] of Object.entries(props.style))
              card.style.setProperty(name, value)
          })
          expect(
            await page
              .locator('#card')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
          expect(
            await page
              .locator('#card')
              .evaluate((element) => getComputedStyle(element).padding),
          ).toMatchInlineSnapshot('"8px"')
        }
      } finally {
        await browser.close()
        await Fs.rm(root, { recursive: true, force: true })
      }
    },
    30000,
  )
})
