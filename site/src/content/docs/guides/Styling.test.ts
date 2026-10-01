/** Verifies the guide's authored examples through the filesystem compiler. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { expect, test } from 'vite-plus/test'
import { Host } from 'zyzz/node'

const document = await Fs.readFile(
  new URL('./styling.mdx', import.meta.url),
  'utf8',
)
const examples = Array.from(
  document.matchAll(/```tsx? title="([^"]+)"\n([\s\S]*?)```/g),
)
const project = Path.resolve(import.meta.dirname, '../../../../..')

test('compiles every styling example with its documented imports', async () => {
  const root = await Fs.mkdtemp(Path.join(project, '.fixture-styling-guide-'))
  const modules = new Map<string, string>()
  const output: string[] = []

  try {
    await Fs.mkdir(Path.join(root, 'node_modules'))
    await Fs.symlink(project, Path.join(root, 'node_modules/zyzz'), 'dir')

    for (const [index, example] of examples.entries()) {
      const name = example[1]!
      const source = example[2]!
      modules.set(name, source)
      const directory = Path.join(root, String(index))
      await Fs.mkdir(directory)
      await Fs.writeFile(Path.join(directory, name), source)
      for (const dependency of source.matchAll(/from '\.\/([^']+)\.js'/g)) {
        const filename = `${dependency[1]}.ts`
        await Fs.writeFile(
          Path.join(directory, filename),
          modules.get(filename)!,
        )
      }
      const outDir = Path.join(directory, 'dist')
      await using host = await Host.create({
        outDir,
        packageId: `guide-${index}`,
        root: directory,
      })

      await host.build()

      const css = await Fs.readFile(Path.join(outDir, 'zyzz.css'), 'utf8')
      output.push(`${name}: ${css.length > 0 ? 'compiled CSS' : 'empty CSS'}`)
    }

    expect(output).toMatchInlineSnapshot(`
      [
        "Actions.tsx: compiled CSS",
        "Card.tsx: compiled CSS",
        "button.styles.ts: compiled CSS",
        "Button.tsx: compiled CSS",
        "Actions.tsx: compiled CSS",
        "Button.tsx: compiled CSS",
        "Meter.tsx: compiled CSS",
        "zyzz.config.ts: compiled CSS",
        "Panel.tsx: compiled CSS",
        "Card.tsx: compiled CSS",
        "Label.tsx: compiled CSS",
        "Label.tsx: compiled CSS",
        "Label.tsx: compiled CSS",
      ]
    `)
  } finally {
    await Fs.rm(root, { force: true, recursive: true })
  }
}, 60_000)
