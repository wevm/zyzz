import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { expect, test } from 'vite-plus/test'

const exec = Util.promisify(ChildProcess.execFile)

test('packed public entrypoint runs in an isolated consumer', async () => {
  const root = Path.resolve(import.meta.dirname, '../..')
  const directory = await Fs.mkdtemp(
    Path.join(Os.tmpdir(), 'typestyle-consumer-'),
  )
  try {
    await exec('pnpm', ['build'], { cwd: root, timeout: 30_000 })
    await exec('pnpm', ['pack', '--pack-destination', directory], {
      cwd: root,
      timeout: 30_000,
    })
    const target = Path.join(directory, 'node_modules/typestyle')
    await Fs.mkdir(target, { recursive: true })
    await exec(
      'tar',
      [
        '-xzf',
        Path.join(directory, 'typestyle-0.0.0.tgz'),
        '-C',
        target,
        '--strip-components=1',
      ],
      { timeout: 10_000 },
    )
    await Fs.writeFile(
      Path.join(directory, 'package.json'),
      JSON.stringify({ type: 'module' }),
    )
    await Fs.copyFile(
      Path.join(root, 'test/fixtures/package-consumer.ts'),
      Path.join(directory, 'consumer.ts'),
    )
    await exec(
      process.execPath,
      [
        Path.join(root, 'node_modules/typescript/bin/tsc'),
        'consumer.ts',
        '--module',
        'nodenext',
        '--strict',
        '--noEmit',
        '--skipLibCheck',
        '--types',
        'node',
        '--typeRoots',
        Path.join(root, 'node_modules/@types'),
      ],
      { cwd: directory, timeout: 30_000 },
    )
    const result = await exec(process.execPath, ['consumer.ts'], {
      cwd: directory,
      timeout: 10_000,
    })
    expect(result.stdout.trim()).toBe('packed consumer passed')
    const manifest: unknown = JSON.parse(
      await Fs.readFile(Path.join(target, 'package.json'), 'utf8'),
    )
    expect(manifest).not.toHaveProperty('dependencies')
  } finally {
    await Fs.rm(directory, { recursive: true, force: true })
  }
}, 60_000)
