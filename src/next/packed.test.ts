/** Verifies packed stylesheet deduplication through the public loader and browser cascade. @module */
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import { expect, test } from 'vite-plus/test'
import webpack from 'webpack'
import { Graph } from 'zyzz/compiler'

const require = Module.createRequire(import.meta.url)

test.each([false, true])(
  'deduplicates packed CSS across source entries (development: %s)',
  async (development) => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-next-packed-'))
    const library = Path.join(root, 'node_modules/@acme/probe')
    const browser = await chromium.launch()
    const compiler = webpack({
      cache: false,
      context: root,
      devtool: false,
      entry: ['./a.mjs', './b.mjs'],
      experiments: { css: true },
      mode: 'development',
      module: {
        rules: [
          {
            include: root,
            test: /\.mjs$/,
            use: [
              {
                loader: require.resolve('zyzz/next/loader'),
                options: { bundler: 'webpack', development, reset: true, root },
              },
            ],
          },
        ],
      },
      output: { cssFilename: 'styles.css', path: Path.join(root, 'dist') },
    })
    try {
      const packed = Graph.compile({
        modules: {
          'index.js':
            "import {global} from 'zyzz/web';global({'.probe':{color:'red'},'@layer components':{'.probe':{margin:'9px'}}});export const loaded=true;",
        },
      })
      await Fs.mkdir(library, { recursive: true })
      await Fs.writeFile(
        Path.join(library, 'package.json'),
        JSON.stringify({
          name: '@acme/probe',
          type: 'module',
          exports: './index.js',
          sideEffects: true,
        }),
      )
      await Fs.writeFile(
        Path.join(library, 'index.js'),
        packed.modules['index.js']!.code,
      )
      await Fs.writeFile(
        Path.join(library, 'index.js.zyzz.json'),
        packed.contracts['index.js']!,
      )
      await Fs.writeFile(
        Path.join(root, 'a.mjs'),
        "import '@acme/probe';import {global} from 'zyzz/web';global({'.probe':{color:'blue'}});",
      )
      await Fs.writeFile(
        Path.join(root, 'b.mjs'),
        "import '@acme/probe';import {global} from 'zyzz/web';global({'.other':{opacity:0.5}});",
      )
      await new Promise<void>((resolve, reject) =>
        compiler.run((error, stats) => {
          if (error || !stats || stats.hasErrors())
            reject(error ?? new Error(stats?.toString('errors-only')))
          else resolve()
        }),
      )
      const css = await Fs.readFile(Path.join(root, 'dist/styles.css'), 'utf8')
      expect(css.match(/color:\s*red/g)?.length).toMatchInlineSnapshot('1')
      const page = await browser.newPage()
      await page.setContent(
        `<style>${css}</style><div class="probe">Probe</div>`,
      )
      expect(
        await page
          .locator('.probe')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot('"rgb(0, 0, 255)"')
      expect(
        await page
          .locator('.probe')
          .evaluate((element) => getComputedStyle(element).margin),
      ).toMatchInlineSnapshot('"9px"')
    } finally {
      await browser.close()
      await new Promise<void>((resolve, reject) =>
        compiler.close((error) => (error ? reject(error) : resolve())),
      )
      await Fs.rm(root, { force: true, recursive: true })
    }
  },
  30_000,
)
