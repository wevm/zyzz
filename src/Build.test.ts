import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import * as Build from './Build.js'
import * as Compiler from './Compiler.js'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => Fs.rm(path, { recursive: true, force: true })),
  )
})

async function fixture() {
  const root = await Fs.mkdtemp(Path.resolve('.fixture-build-'))
  directories.push(root)
  const sourceDir = Path.join(root, 'src')
  const outDir = Path.join(root, 'dist')
  await Fs.mkdir(sourceDir)
  return { sourceDir, outDir }
}

describe('build', () => {
  it('emits consumable ESM, declarations and CSS without a consumer plugin', async () => {
    const options = await fixture()
    const code = `import { css } from 'typestyle'; export const button: string = css({padding: 4, color:'gray.1000'});`
    await Fs.writeFile(Path.join(options.sourceDir, 'index.ts'), code)
    const result = await Build.build(options)
    const javascript = await Fs.readFile(
      Path.join(options.outDir, 'index.js'),
      'utf8',
    )
    expect(javascript).not.toContain('typestyle')
    expect(javascript).toContain('export const button = "cp_')
    expect(
      await Fs.readFile(Path.join(options.outDir, 'index.d.ts'), 'utf8'),
    ).toContain('export declare const button: string')
    expect(result.css).toBe(Compiler.compile({ id: 'other.ts', code }).css)
  }, 15000)

  it('removes stale owned files and preserves unrelated assets on rebuild', async () => {
    const options = await fixture()
    await Fs.writeFile(
      Path.join(options.sourceDir, 'index.ts'),
      `import {css} from 'typestyle'; export const a = css({padding:1});`,
    )
    await Fs.writeFile(
      Path.join(options.sourceDir, 'old.ts'),
      `export const b = 1;`,
    )
    await Build.build(options)
    await Fs.writeFile(Path.join(options.outDir, 'notes.txt'), 'keep')
    await Fs.rm(Path.join(options.sourceDir, 'old.ts'))
    await Fs.writeFile(
      Path.join(options.sourceDir, 'index.ts'),
      `export const a = 'unstyled';`,
    )
    const result = await Build.build(options)
    expect(result.css).toBe('')
    await expect(
      Fs.access(Path.join(options.outDir, 'old.js')),
    ).rejects.toThrow()
    await expect(
      Fs.access(Path.join(options.outDir, 'old.d.ts')),
    ).rejects.toThrow()
    expect(
      await Fs.readFile(Path.join(options.outDir, 'notes.txt'), 'utf8'),
    ).toBe('keep')
  }, 15000)

  it('does not replace the prior build when type checking fails', async () => {
    const options = await fixture()
    await Fs.writeFile(
      Path.join(options.sourceDir, 'index.ts'),
      `export const a: string = 'valid';`,
    )
    await Build.build(options)
    await Fs.writeFile(
      Path.join(options.sourceDir, 'index.ts'),
      `import {css} from 'typestyle'; export const a = css({color:'blue.123'});`,
    )
    await expect(Build.build(options)).rejects.toThrow('blue.123')
    expect(
      await Fs.readFile(Path.join(options.outDir, 'index.js'), 'utf8'),
    ).toContain('valid')
  }, 15000)

  it('refuses overlapping directories before writing files', async () => {
    const options = await fixture()
    await expect(
      Build.build({ ...options, outDir: options.sourceDir }),
    ).rejects.toThrow('overlap')
    await expect(
      Build.build({ ...options, outDir: Path.join(options.sourceDir, 'dist') }),
    ).rejects.toThrow('overlap')
  })
})
