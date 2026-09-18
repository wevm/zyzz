/**
 * Exercises the packed executable through builds, diagnostics, and watch recovery.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import * as ChildProcess from 'node:child_process'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Path from 'node:path'
import * as Util from 'node:util'
import * as Universal from '../../test/fixtures/UniversalLibrary.js'
import * as Watch from '../../test/fixtures/Watch.js'
import { describe, expect, test, vi } from 'vite-plus/test'

const exec = Util.promisify(ChildProcess.execFile)

describe('zyzz', () => {
  test('builds and watches a source-free package through the published CLI', async () => {
    const root = await Fs.realpath(
      await Fs.mkdtemp(Path.join(Os.tmpdir(), 'zyzz-cli-package-')),
    )
    let child: ChildProcess.ChildProcess | undefined
    let exited: Promise<number | null> | undefined
    try {
      const library = await Universal.create(root)
      await Fs.mkdir(Path.join(root, 'src'))
      await Fs.writeFile(
        Path.join(root, 'src/app.ts'),
        `import * as library from '@acme/universal';export const props=library.button({size:'large',active:true});`,
      )
      const bin = Path.join(root, 'node_modules/.bin/zyzz')
      const native = [
        '--target',
        'native',
        '--color-scheme',
        'dark',
        '--platform',
        'android',
      ]
      await exec(bin, ['build', 'src', '--out-dir', 'native', ...native], {
        cwd: root,
      })
      await exec(bin, ['build', 'src', '--out-dir', 'web'], { cwd: root })

      async function execute(directory: string) {
        const bundle = await Esbuild.build({
          entryPoints: [Path.join(root, directory, 'app.ts')],
          bundle: true,
          platform: 'node',
          format: 'esm',
          write: false,
          logLevel: 'silent',
        })
        const file = Path.join(root, directory + '.mjs')
        await Fs.writeFile(file, bundle.outputFiles[0]!.text)
        return JSON.parse(
          (
            await exec(process.execPath, [
              '--input-type=module',
              '-e',
              `import {props} from ${JSON.stringify(file)};console.log(JSON.stringify(props));`,
            ])
          ).stdout,
        )
      }
      expect(await execute('native')).toMatchInlineSnapshot(`
        {
          "style": {
            "color": "#abcdef",
            "fontSize": 20,
            "opacity": 0.8,
          },
        }
      `)
      expect(
        (await Fs.readdir(Path.join(root, 'native'))).some(
          (file) => file.endsWith('.css') || file === 'zyzz.js',
        ),
      ).toMatchInlineSnapshot('false')

      const web = await Esbuild.build({
        entryPoints: [Path.join(root, 'web/app.ts')],
        bundle: true,
        format: 'iife',
        globalName: 'Consumer',
        write: false,
        logLevel: 'silent',
      })
      const css =
        (await Fs.readFile(Path.join(root, 'web/zyzz.css'), 'utf8')) +
        (await Fs.readFile(
          Path.join(library.installed, 'web/style.css'),
          'utf8',
        ))
      const browser = await chromium.launch({ headless: true })
      try {
        const page = await browser.newPage({ colorScheme: 'dark' })
        await page.setContent(
          `<style>:root{color-scheme:dark}${css}</style><div id="actual"></div><div id="control" style="color:#abcdef;font-size:20px;opacity:0.8"></div>`,
        )
        await page.addScriptTag({
          content:
            web.outputFiles[0]!.text +
            `;const element=document.querySelector('#actual');for(const [key,value] of Object.entries(Consumer.props)){if(key==='style')Object.assign(element.style,value);else element.setAttribute(key==='className'?'class':key,String(value))}`,
        })
        const results = await page
          .locator('#actual, #control')
          .evaluateAll((elements) =>
            elements.map((element) => {
              const style = getComputedStyle(element)
              return {
                color: style.color,
                fontSize: style.fontSize,
                opacity: style.opacity,
              }
            }),
          )
        expect(results[0]).toMatchInlineSnapshot(`
          {
            "color": "rgb(171, 205, 239)",
            "fontSize": "20px",
            "opacity": "0.8",
          }
        `)
        expect(results[0]).toEqual(results[1])
      } finally {
        await browser.close()
      }

      let events = ''
      child = ChildProcess.spawn(
        bin,
        ['dev', 'src', '--out-dir', 'watched', '--format', 'jsonl', ...native],
        { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      exited = new Promise((resolve, reject) => {
        child!.once('error', reject)
        child!.once('exit', resolve)
      })
      child.stdout!.on('data', (data: Buffer) => {
        events += data.toString()
      })
      child.stderr!.on('data', (data: Buffer) => {
        events += data.toString()
      })
      const output = Path.join(root, 'watched/app.ts')
      await vi.waitFor(
        async () => {
          if (!(await Fs.readFile(output, 'utf8')).includes('#abcdef'))
            throw new Error('Awaiting initial package build: ' + events)
        },
        { timeout: 20000 },
      )
      const original = await Fs.readFile(output, 'utf8')
      const sidecar = Path.join(library.installed, 'web/index.js.zyzz.json')
      const saved = await Fs.readFile(sidecar, 'utf8')
      expect(saved.includes('#abcdef')).toMatchInlineSnapshot('true')
      events = ''
      await Watch.write({ path: sidecar, source: '{' })
      await vi.waitFor(
        () => {
          if (!events.includes('"status":"error"'))
            throw new Error('Awaiting package diagnostic: ' + events)
        },
        { timeout: 20000 },
      )
      expect(await Fs.readFile(output, 'utf8')).toBe(original)
      await Watch.write({
        path: sidecar,
        source: saved.replaceAll('#abcdef', '#fedcba'),
      })
      await vi.waitFor(
        async () => {
          if (!(await Fs.readFile(output, 'utf8')).includes('#fedcba'))
            throw new Error('Awaiting repaired package: ' + events)
        },
        { timeout: 20000 },
      )
      expect(await execute('watched')).toMatchInlineSnapshot(`
        {
          "style": {
            "color": "#fedcba",
            "fontSize": 20,
            "opacity": 0.8,
          },
        }
      `)
      child.kill('SIGTERM')
      expect(await exited).toMatchInlineSnapshot('0')
      child = undefined
      expect(
        await Fs.stat(Path.join(root, 'watched/.zyzz-lock')).then(
          () => true,
          () => false,
        ),
      ).toMatchInlineSnapshot('false')
    } finally {
      if (child) {
        child.kill('SIGTERM')
        await exited
      }
      await Fs.rm(root, { recursive: true, force: true })
    }
  }, 120000)

  test('routes published native builds and rejects incompatible flags', async () => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-cli-native-'))
    try {
      const packed = await exec('pnpm', [
        'pack',
        '--json',
        '--pack-destination',
        root,
      ])
      const { filename } = JSON.parse(packed.stdout) as { filename: string }
      await exec('npm', [
        'install',
        '--prefix',
        root,
        filename,
        '--ignore-scripts',
        '--legacy-peer-deps',
        '--no-audit',
        '--no-fund',
        '--package-lock=false',
      ])
      await Fs.mkdir(Path.join(root, 'src'))
      await Fs.writeFile(
        Path.join(root, 'src/index.ts'),
        `import {Config} from 'zyzz';const {style}=Config.create({theme:{color:{ink:{light:'#123456',dark:'#abcdef'}}}});export const card=style({color:'ink',targets:{ios:{opacity:0.5},android:{opacity:0.8}}});`,
      )
      const bin = Path.join(root, 'node_modules/.bin/zyzz')
      const run = (args: string[]) =>
        exec(bin, ['build', ...args], { cwd: root })
      await run([
        '--target',
        'native',
        '--color-scheme',
        'dark',
        '--platform',
        'android',
      ])
      const files = await Fs.readdir(Path.join(root, 'dist'))
      expect(
        files.some((file) => file.endsWith('.css') || file === 'zyzz.js'),
      ).toMatchInlineSnapshot('false')
      const source = await Fs.readFile(Path.join(root, 'dist/index.ts'), 'utf8')
      expect(source.includes('#abcdef')).toMatchInlineSnapshot('true')
      expect(source.includes('0.8')).toMatchInlineSnapshot('true')
      const bundle = await Esbuild.build({
        entryPoints: [Path.join(root, 'dist/index.ts')],
        bundle: true,
        platform: 'node',
        format: 'esm',
        write: false,
      })
      await Fs.writeFile(
        Path.join(root, 'native.mjs'),
        bundle.outputFiles[0]!.text,
      )
      const executed = await exec(process.execPath, [
        '--input-type=module',
        '-e',
        `import {card} from ${JSON.stringify(Path.join(root, 'native.mjs'))};console.log(JSON.stringify(card()));`,
      ])
      expect(JSON.parse(executed.stdout)).toMatchInlineSnapshot(`
        {
          "style": {
            "color": "#abcdef",
            "opacity": 0.8,
          },
        }
      `)

      for (const args of [
        ['--target', 'native'],
        ['--target', 'native', '--color-scheme', 'dark', '--css-only'],
        ['--target', 'native', '--color-scheme', 'dark', '--script', 'init.js'],
        ['--platform', 'ios'],
        ['--color-scheme', 'light'],
      ])
        await expect(
          run(args).then(
            () => 'success',
            () => 'error',
          ),
        ).resolves.toMatchInlineSnapshot('"error"')
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  }, 120000)

  test.each([
    { cssOnly: false, cssOutput: 'atomic' },
    { cssOnly: true, cssOutput: 'atomic' },
    { cssOnly: false, cssOutput: 'grouped' },
    { cssOnly: true, cssOutput: 'grouped' },
  ] as const)(
    'runs published $cssOutput commands with css-only=$cssOnly',
    async ({ cssOnly, cssOutput }) => {
      const root = await Fs.mkdtemp(Path.resolve('.fixture-cli-'))
      let child: ChildProcess.ChildProcess | undefined

      try {
        const { stdout } = await exec('pnpm', [
          'pack',
          '--json',
          '--pack-destination',
          root,
        ])
        const { filename } = JSON.parse(stdout) as { filename: string }
        await exec(
          'npm',
          [
            'install',
            '--prefix',
            root,
            filename,
            '--ignore-scripts',
            '--legacy-peer-deps',
            '--no-audit',
            '--no-fund',
            '--package-lock=false',
          ],
          { timeout: 120000 },
        )
        // Artifact appearance precedes the ownership manifest's transaction commit.
        const settled = () =>
          vi.waitFor(
            async () => {
              const manifest = JSON.parse(
                await Fs.readFile(Path.join(root, 'dist/.zyzz.json'), 'utf8'),
              ) as { files: Record<string, string> }
              for (const [name, expected] of Object.entries(manifest.files)) {
                const content = await Fs.readFile(Path.join(root, 'dist', name))
                if (
                  Crypto.createHash('sha256').update(content).digest('hex') !==
                  expected
                )
                  throw new Error(`Waiting for committed output: ${name}`)
              }
            },
            { timeout: 20000 },
          )
        const bin = Path.join(root, 'node_modules/.bin/zyzz')
        const run = (args: string[]) =>
          exec(
            bin,
            [
              ...args,
              ...(cssOnly && ['build', 'dev'].includes(args[0]!)
                ? ['--css-only']
                : []),
            ],
            { cwd: root, timeout: 20000 },
          )
        const source = Path.join(root, 'src/button.ts')
        await Fs.mkdir(Path.dirname(source))
        await Fs.writeFile(
          Path.join(root, 'package.json'),
          JSON.stringify({ name: '@example/cli', type: 'module' }),
        )
        const config = Path.join(root, 'src/config.ts')
        const configure = (mode: string) =>
          Watch.write({
            path: config,
            source: `import { Config } from 'zyzz'; export const { script, style } = Config.create({ cssOutput: '${mode}' })`,
          })
        await configure(cssOutput)
        await Watch.write({
          path: source,
          source: `import { style } from './config.js'; export const button = style({ color: 'red', padding: '8px' })`,
        })

        expect(
          (await run(['--help'])).stdout.includes('dev'),
        ).toMatchInlineSnapshot('true')
        expect(
          (await run(['build', '--help'])).stdout.includes('--out-dir'),
        ).toMatchInlineSnapshot('true')
        const result = JSON.parse((await run(['build', '--json'])).stdout) as {
          files: string[]
        }
        expect(result.files.includes('button.ts.css')).toMatchInlineSnapshot(
          'true',
        )
        expect(result.files.includes('zyzz.css')).toMatchInlineSnapshot('true')
        expect(
          (await Fs.readFile(Path.join(root, 'dist/zyzz.js'), 'utf8')).includes(
            'localStorage.getItem("zyzz")',
          ),
        ).toMatchInlineSnapshot('true')
        expect(
          (
            await Fs.readFile(Path.join(root, 'dist/zyzz.css'), 'utf8')
          ).includes(
            await Fs.readFile(Path.join(root, 'dist/button.ts.css'), 'utf8'),
          ),
        ).toMatchInlineSnapshot('true')
        const original = await Fs.readFile(
          Path.join(root, 'dist/button.ts.css'),
          'utf8',
        )
        // CSS-only output keeps stylesheets, their maps, and the initialization script.
        expect(
          result.files.some(
            (file) =>
              !file.endsWith('.css') &&
              !file.endsWith('.css.map') &&
              file !== 'zyzz.js',
          ) === !cssOnly,
        ).toMatchInlineSnapshot('true')
        if (!cssOnly) {
          const compiled = await Fs.readFile(
            Path.join(root, 'dist/button.ts'),
            'utf8',
          )
          expect(compiled.includes('style({')).toMatchInlineSnapshot('false')
        }
        expect(
          (
            await Fs.readFile(Path.join(root, 'dist/button.ts.css'), 'utf8')
          ).includes('8px'),
        ).toMatchInlineSnapshot('true')
        expect(
          (
            await Fs.readFile(Path.join(root, 'dist/.zyzz.json'), 'utf8')
          ).includes('@example/cli'),
        ).toMatchInlineSnapshot('true')

        expect(
          cssOnly ||
            original.replace(/\s/g, '').includes('color:red;padding:8px;') ===
              (cssOutput === 'grouped'),
        ).toMatchInlineSnapshot('true')
        const bundle = await Esbuild.build({
          bundle: true,
          entryPoints: [cssOnly ? source : Path.join(root, 'dist/button.ts')],
          format: 'iife',
          globalName: 'fixture',
          write: false,
        })
        const browser = await chromium.launch()
        try {
          const page = await browser.newPage()
          await page.setContent(
            `<style>${original}</style><div id="button"></div>`,
          )
          await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
          await page.evaluate(() => {
            const { button } = (
              window as unknown as {
                fixture: { button(): { className: string } }
              }
            ).fixture
            document.getElementById('button')!.className = button().className
          })
          expect(
            await page
              .locator('#button')
              .evaluate((element) => getComputedStyle(element).padding),
          ).toMatchInlineSnapshot('"8px"')
          expect(
            await page
              .locator('#button')
              .evaluate((element) => getComputedStyle(element).color),
          ).toMatchInlineSnapshot('"rgb(255, 0, 0)"')
        } finally {
          await browser.close()
        }

        await Fs.writeFile(Path.join(root, 'dist/keep.txt'), 'unowned')
        await run([
          'build',
          'src',
          '--out-dir',
          'optimized',
          '--package-id',
          'other',
          '--minify',
        ])
        expect(
          (
            await Fs.readFile(Path.join(root, 'optimized/.zyzz.json'), 'utf8')
          ).includes('other'),
        ).toMatchInlineSnapshot('true')
        expect(
          await run(['build', 'missing']).then(
            () => 0,
            (error: { code: number }) => error.code,
          ),
        ).toMatchInlineSnapshot('1')
        expect(
          await run(['build', '--unknown']).then(
            () => 0,
            (error: { code: number }) => error.code,
          ),
        ).toMatchInlineSnapshot('1')

        await Watch.write({
          path: source,
          source: `import { style } from './config.js'; export const button = style({ color: 'red', padding: unknownValue() })`,
        })
        expect(
          await run(['build']).then(
            () => 0,
            (error: { code: number }) => error.code,
          ),
        ).toMatchInlineSnapshot('1')
        expect(
          (await Fs.readFile(Path.join(root, 'dist/button.ts.css'), 'utf8')) ===
            original,
        ).toMatchInlineSnapshot('true')

        for (const signal of ['SIGINT', 'SIGTERM'] as const) {
          const lines: string[] = []
          let output = ''
          child = ChildProcess.spawn(
            bin,
            ['dev', '--format', 'jsonl', ...(cssOnly ? ['--css-only'] : [])],
            {
              cwd: root,
              stdio: ['ignore', 'pipe', 'pipe'],
            },
          )
          const exited = new Promise<number | null>((resolve, reject) => {
            child!.once('error', reject)
            child!.once('exit', resolve)
          })
          child.stderr!.on('data', (data: Buffer) =>
            lines.push(data.toString()),
          )
          child.stdout!.on('data', (data: Buffer) => {
            output += data.toString()
            const parts = output.split('\n')
            output = parts.pop()!
            lines.push(...parts)
          })
          const wait = async (status: string) => {
            await vi.waitFor(
              () => {
                if (
                  !lines.some((line) => line.includes(`"status":"${status}"`))
                )
                  throw new Error(`Waiting for ${status}: ${lines.join('\n')}`)
              },
              { timeout: 20000 },
            )
            lines.length = 0
          }

          await wait('error')
          await Watch.write({
            path: source,
            source: `import { style } from './config.js'; export const button = style({ color: 'red', padding: '16px' })`,
          })
          await vi.waitFor(
            async () => {
              const css = await Fs.readFile(
                Path.join(root, 'dist/button.ts.css'),
                'utf8',
              )
              if (!css.includes('16px'))
                throw new Error(
                  `Waiting for recovered output (${signal}): ${css}\n${lines.join('\n')}`,
                )
            },
            { timeout: 20000 },
          )
          expect(
            (
              await Fs.readFile(Path.join(root, 'dist/button.ts.css'), 'utf8')
            ).includes('16px'),
          ).toMatchInlineSnapshot('true')
          await settled()
          lines.length = 0
          await configure(cssOutput === 'atomic' ? 'grouped' : 'atomic')
          // Final CSS processing can merge adjacent fixed-name atomic rules.
          if (cssOnly) await wait('built')
          else
            await vi.waitFor(
              async () => {
                const css = await Fs.readFile(
                  Path.join(root, 'dist/button.ts.css'),
                  'utf8',
                )
                if (
                  css.replace(/\s/g, '').includes('color:red;padding:16px;') !==
                  (cssOutput === 'atomic')
                )
                  throw new Error('Waiting for CSS output mode change')
              },
              { timeout: 20000 },
            )
          await settled()
          lines.length = 0
          await configure(cssOutput)
          if (cssOnly) await wait('built')
          else
            await vi.waitFor(
              async () => {
                const css = await Fs.readFile(
                  Path.join(root, 'dist/button.ts.css'),
                  'utf8',
                )
                if (
                  css.replace(/\s/g, '').includes('color:red;padding:16px;') !==
                  (cssOutput === 'grouped')
                )
                  throw new Error(
                    `Waiting for restored CSS output mode: ${css}\n${lines.join('\n')}`,
                  )
              },
              { timeout: 20000 },
            )
          await settled()
          await Fs.rename(source, Path.join(root, 'src/renamed.ts'))
          await vi.waitFor(
            async () => {
              if (
                !(await Fs.readdir(Path.join(root, 'dist'))).includes(
                  'renamed.ts.css',
                )
              )
                throw new Error('Waiting for renamed output')
            },
            { timeout: 20000 },
          )
          await settled()
          await Fs.rm(Path.join(root, 'src/renamed.ts'))
          await vi.waitFor(
            async () => {
              if (
                (await Fs.readdir(Path.join(root, 'dist'))).includes(
                  'renamed.ts.css',
                )
              )
                throw new Error(
                  `Waiting for removed output: ${lines.join('\n')}`,
                )
            },
            { timeout: 20000 },
          )
          await settled()
          child.kill(signal)
          expect(await exited).toMatchInlineSnapshot('0')
          child = undefined
          expect(
            (await Fs.readdir(Path.join(root, 'dist'))).includes('.zyzz-lock'),
          ).toMatchInlineSnapshot('false')
          expect(
            await Fs.readFile(Path.join(root, 'dist/keep.txt'), 'utf8'),
          ).toMatchInlineSnapshot('"unowned"')
          await Watch.write({
            path: source,
            source: `import { style } from './config.js'; export const button = style({ color: 'red', padding: unknownValue() })`,
          })
        }

        await Fs.rm(source)
        await vi.waitFor(() => run(['build']), { timeout: 20000 })
      } finally {
        if (child && child.exitCode === null && child.signalCode === null) {
          const exited = new Promise<void>((resolve) =>
            child!.once('exit', () => resolve()),
          )
          child.kill('SIGKILL')
          await exited
        }
        await Fs.rm(root, { force: true, maxRetries: 3, recursive: true })
      }
    },
    240000,
  )
})
