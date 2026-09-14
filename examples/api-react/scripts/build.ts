/** Compiles the source tree with the Host API, then bundles the compiled tree with Vite. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Vite from 'vite'
import { Host } from 'zyzz/node'

const root = Path.resolve(import.meta.dirname, '..')
const outDir = Path.join(root, '.zyzz')
const host = await Host.create({
  outDir,
  packageId: 'api-react',
  root: Path.join(root, 'src'),
})

try {
  const result = await host.build()

  await Fs.writeFile(
    Path.join(outDir, 'styles.css'),
    await stylesheet(result.files),
  )
} finally {
  await host.close()
}

await Vite.build({ configFile: false, root })

/** Imports the shared stylesheet before module stylesheets, skipping modules without local styles. */
async function stylesheet(files: readonly string[]) {
  const shared = files.filter((file) => file === 'zyzz.shared.css')
  const modules = files.filter(
    (file) => file.endsWith('.css') && file !== 'zyzz.shared.css',
  )
  const imports: string[] = []

  for (const file of [...shared, ...modules]) {
    const content = await Fs.readFile(Path.join(outDir, file), 'utf8')
    if (content.trim()) imports.push(`@import "./${file}";`)
  }

  return imports.join('\n')
}
