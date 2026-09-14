/**
 * Exercises the packed executable through builds, diagnostics, and watch recovery.
 * @module
 */
import * as Esbuild from 'esbuild'
import { chromium } from 'playwright'
import * as ChildProcess from 'node:child_process'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import * as Watch from '../../test/fixtures/Watch.js'
import { describe, expect, test, vi } from 'vite-plus/test'

const exec = Util.promisify(ChildProcess.execFile)

describe('zyzz', () => {
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
        const { stdout } = await exec('npm', [
          'pack',
          '--json',
          '--pack-destination',
          root,
        ])
        const packed = JSON.parse(stdout) as { filename: string }[]
        const filename = packed[0]!.filename
        await exec(
          'npm',
          [
            'install',
            '--prefix',
            root,
            Path.join(root, filename!),
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
            source: `import { Config } from 'zyzz'; export const { css } = Config.create({ cssOutput: '${mode}' })`,
          })
        await configure(cssOutput)
        await Watch.write({
          path: source,
          source: `import { css } from './config.js'; export const button = css({ color: 'red', padding: '8px' })`,
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
        const original = await Fs.readFile(
          Path.join(root, 'dist/button.ts.css'),
          'utf8',
        )
        expect(
          result.files.some(
            (file) => !file.endsWith('.css') && !file.endsWith('.css.map'),
          ) === !cssOnly,
        ).toMatchInlineSnapshot('true')
        if (!cssOnly) {
          const compiled = await Fs.readFile(
            Path.join(root, 'dist/button.ts'),
            'utf8',
          )
          expect(compiled.includes('css({')).toMatchInlineSnapshot('false')
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
          source: `import { css } from './config.js'; export const button = css({ color: 'red', padding: unknownValue() })`,
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
            source: `import { css } from './config.js'; export const button = css({ color: 'red', padding: '16px' })`,
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
            source: `import { css } from './config.js'; export const button = css({ color: 'red', padding: unknownValue() })`,
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
