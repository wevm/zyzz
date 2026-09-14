/**
 * Exercises the packed executable through builds, diagnostics, and watch recovery.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { describe, expect, test, vi } from 'vite-plus/test'

const exec = Util.promisify(ChildProcess.execFile)

describe('zyzz', () => {
  test('runs the published build and dev commands', async () => {
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
      const bin = Path.join(root, 'node_modules/.bin/zyzz')
      const run = (args: string[]) =>
        exec(bin, args, { cwd: root, timeout: 20000 })
      const source = Path.join(root, 'src/button.ts')
      await Fs.mkdir(Path.dirname(source))
      await Fs.writeFile(
        Path.join(root, 'package.json'),
        JSON.stringify({ name: '@example/cli', type: 'module' }),
      )
      await Fs.writeFile(
        source,
        `import { css } from 'zyzz'; export const button = css({ padding: '8px' })`,
      )

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
        Path.join(root, 'dist/button.ts'),
        'utf8',
      )
      expect(original.includes('zyzz/runtime')).toMatchInlineSnapshot('true')
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

      await Fs.writeFile(
        source,
        `import { css } from 'zyzz'; export const button = css({ padding: unknownValue() })`,
      )
      expect(
        await run(['build']).then(
          () => 0,
          (error: { code: number }) => error.code,
        ),
      ).toMatchInlineSnapshot('1')
      expect(
        (await Fs.readFile(Path.join(root, 'dist/button.ts'), 'utf8')) ===
          original,
      ).toMatchInlineSnapshot('true')

      for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        const lines: string[] = []
        let output = ''
        child = ChildProcess.spawn(bin, ['dev', '--format', 'jsonl'], {
          cwd: root,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        const exited = new Promise<number | null>((resolve, reject) => {
          child!.once('error', reject)
          child!.once('exit', resolve)
        })
        child.stdout!.on('data', (data: Buffer) => {
          output += data.toString()
          const parts = output.split('\n')
          output = parts.pop()!
          lines.push(...parts)
        })
        const wait = async (status: string) => {
          await vi.waitFor(
            () => {
              if (!lines.some((line) => line.includes(`"status":"${status}"`)))
                throw new Error(`Waiting for ${status}`)
            },
            { timeout: 20000 },
          )
          lines.length = 0
        }

        await wait('error')
        await Fs.writeFile(
          source,
          `import { css } from 'zyzz'; export const button = css({ padding: '16px' })`,
        )
        await wait('built')
        expect(
          (
            await Fs.readFile(Path.join(root, 'dist/button.ts.css'), 'utf8')
          ).includes('16px'),
        ).toMatchInlineSnapshot('true')
        await Fs.rename(source, Path.join(root, 'src/renamed.ts'))
        await vi.waitFor(
          async () => {
            if (
              !(await Fs.readdir(Path.join(root, 'dist'))).includes(
                'renamed.ts',
              )
            )
              throw new Error('Waiting for renamed output')
          },
          { timeout: 20000 },
        )
        await Fs.rm(Path.join(root, 'src/renamed.ts'))
        await vi.waitFor(
          async () => {
            if (
              (await Fs.readdir(Path.join(root, 'dist'))).includes('renamed.ts')
            )
              throw new Error('Waiting for removed output')
          },
          { timeout: 20000 },
        )
        child.kill(signal)
        expect(await exited).toMatchInlineSnapshot('0')
        child = undefined
        expect(
          (await Fs.readdir(Path.join(root, 'dist'))).includes('.zyzz-lock'),
        ).toMatchInlineSnapshot('false')
        expect(
          await Fs.readFile(Path.join(root, 'dist/keep.txt'), 'utf8'),
        ).toMatchInlineSnapshot('"unowned"')
        await Fs.writeFile(
          source,
          `import { css } from 'zyzz'; export const button = css({ padding: unknownValue() })`,
        )
      }

      await Fs.rm(source)
      await run(['build'])
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        const exited = new Promise<void>((resolve) =>
          child!.once('exit', () => resolve()),
        )
        child.kill('SIGKILL')
        await exited
      }
      await Fs.rm(root, { force: true, recursive: true })
    }
  }, 240000)
})
