/** Watches the source tree with the Host API and serves the compiled tree with Vite. @module */
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
let server: Promise<Vite.ViteDevServer> | undefined

host.watch({
  onResult(event) {
    void publish(event).catch((error: unknown) => console.error(error))
  },
})

for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void stop().then(() => process.exit(0))
  })

/** Regenerates the stylesheet index after every build; Vite starts once the compiled entry exists. */
async function publish(event: Host.Event) {
  if ('error' in event) {
    console.error(event.error)
    return
  }

  await Fs.writeFile(
    Path.join(outDir, 'styles.css'),
    await stylesheet(event.result.files),
  )
  console.log(`zyzz: ${event.result.changed.length} artifacts changed`)

  server ??= serve()
  await server
}

async function serve() {
  const server = await Vite.createServer({ configFile: false, root })

  await server.listen()
  server.printUrls()

  return server
}

async function stop() {
  await (await server)?.close()
  await host.close()
}

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
