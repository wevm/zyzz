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
  'shares responsive variables and the reset across source modules (development: %s)',
  async (development) => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-next-variables-'))
    const browser = await chromium.launch()
    const compiler = webpack({
      cache: false,
      context: root,
      devtool: false,
      entry: './entry.mjs',
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
      output: {
        cssFilename: 'styles.css',
        filename: 'bundle.js',
        library: { name: 'Fixture', type: 'var' },
        path: Path.join(root, 'dist'),
      },
    })
    try {
      const files = {
        'config.mjs': `import {Config,Vars} from 'zyzz';import {global} from 'zyzz/web';const base=Vars.define({editorial:{labelSize:{default:'14px','@media (width >= 1024px)':'16px'},space:{default:'8px','@media (width >= 1024px)':'12px'}}});const large=Vars.extend(base,{editorial:{labelSize:{default:'20px','@media (width >= 1024px)':'24px'}}});export const {style,vars}=Config.create({vars:{base,large},defaultVars:'base',mappings:false,layers:['reset','base']});global({'@layer base':{body:{margin:0}}});`,
        'first.mjs': `import {style} from './config.mjs';export const first=style({fontSize:'editorial.labelSize'})();`,
        'second.mjs': `import {style} from './config.mjs';export const second=style({fontSize:'editorial.labelSize',padding:'editorial.space'})();`,
        'layout.mjs': `export default function Layout(){return null}`,
        'entry.mjs': `import './layout.mjs';import {vars} from './config.mjs';export {first} from './first.mjs';export {second} from './second.mjs';export const base=vars({set:'base'});export const large=vars({set:'large'});`,
      }
      for (const [name, source] of Object.entries(files))
        await Fs.writeFile(Path.join(root, name), source)
      await new Promise<void>((resolve, reject) =>
        compiler.run((error, stats) => {
          if (error || !stats || stats.hasErrors())
            reject(error ?? new Error(stats?.toString('errors-only')))
          else resolve()
        }),
      )
      const css = await Fs.readFile(Path.join(root, 'dist/styles.css'), 'utf8')
      const code = await Fs.readFile(Path.join(root, 'dist/bundle.js'), 'utf8')
      expect(
        css.match(/box-sizing:\s*border-box/g)?.length,
      ).toMatchInlineSnapshot('1')
      expect(
        css.match(/--z-editorial-labelSize-fallback-[\w-]+:\s*14px/g)?.length,
      ).toMatchInlineSnapshot('1')
      expect(
        css.match(/--z-editorial-labelSize-fallback-[\w-]+:\s*20px/g)?.length,
      ).toMatchInlineSnapshot('1')

      const page = await browser.newPage({
        viewport: { width: 800, height: 600 },
      })
      await page.setContent(`<style>${css}</style><script>${code}</script>`)
      await page.evaluate(() => {
        const fixture = (
          window as unknown as {
            Fixture: Record<string, { className: string }>
          }
        ).Fixture
        document.body.innerHTML = `<div class="${fixture.base!.className}"><div id="first" class="${fixture.first!.className}"></div><div class="${fixture.large!.className}"><div id="second" class="${fixture.second!.className}"></div></div></div>`
      })
      expect(
        await page
          .locator('#first')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot('"14px"')
      expect(
        await page
          .locator('#second')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot('"20px"')
      expect(
        await page
          .locator('#second')
          .evaluate((element) => getComputedStyle(element).padding),
      ).toMatchInlineSnapshot('"8px"')
      await page.setViewportSize({ width: 1200, height: 600 })
      expect(
        await page
          .locator('#first')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot('"16px"')
      expect(
        await page
          .locator('#second')
          .evaluate((element) => getComputedStyle(element).fontSize),
      ).toMatchInlineSnapshot('"24px"')
      expect(
        await page
          .locator('#second')
          .evaluate((element) => getComputedStyle(element).padding),
      ).toMatchInlineSnapshot('"12px"')
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
