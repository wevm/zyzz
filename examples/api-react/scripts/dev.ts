/** Watches the source tree with the Host API and serves the compiled tree with Vite. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Url from 'node:url'
import * as Vite from 'vite'
import { Host } from 'zyzz/node'

// Node runs this script directly, so the sibling module loads through its runtime URL.
const { stylesheet } = (await import(
  new URL('./stylesheet.ts', import.meta.url).href
)) as typeof import('./stylesheet.js')

const root = Path.resolve(import.meta.dirname, '..')
const outDir = Path.join(root, '.zyzz')
const host = await Host.create({
  outDir,
  packageId: 'api-react',
  root: Path.join(root, 'src'),
})
let initialization = ''
let pending = Promise.resolve()
let server: Promise<Vite.ViteDevServer> | undefined

// Builds can outpace publication, so each result publishes after the previous one settles.
host.watch({
  onResult(event) {
    pending = pending
      .then(() => publish(event))
      .catch((error: unknown) => console.error(error))
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

  await Fs.writeFile(Path.join(outDir, 'styles.css'), await stylesheet(outDir))
  console.log(`zyzz: ${event.result.changed.length} artifacts changed`)

  // Each build republishes the configuration, so a fresh module URL picks up catalog changes.
  const compiled = (await import(
    `${Url.pathToFileURL(Path.join(outDir, 'zyzz.config.ts')).href}?t=${Date.now()}`
  )) as { script: () => string }

  initialization = compiled.script()
  server ??= serve()
  await server
}

async function serve() {
  const server = await Vite.createServer({
    configFile: false,
    plugins: [
      {
        name: 'zyzz-initialization',
        transformIndexHtml: () => [
          // Saved preferences apply before any other script or visible content.
          { children: initialization, injectTo: 'head-prepend', tag: 'script' },
        ],
      },
    ],
    root,
  })

  await server.listen()
  server.printUrls()

  return server
}

async function stop() {
  await pending
  await (await server)?.close()
  await host.close()
}
