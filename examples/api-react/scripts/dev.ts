/** Watches the source tree with the Host API and serves the compiled tree with Vite. @module */
import * as Path from 'node:path'
import * as Vite from 'vite'
import { Host } from 'zyzz/node'

const root = Path.resolve(import.meta.dirname, '..')
// The compiled tree lands in dist; the saved-selection script lands in public so Vite serves it.
const host = await Host.create({
  packageId: 'api-react',
  root: Path.join(root, 'src'),
  script: Path.join(root, 'public/zyzz.js'),
})
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

/** Reports each build; Vite starts once the compiled entry exists. */
async function publish(event: Host.Event) {
  if ('error' in event) {
    console.error(event.error)
    return
  }

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
  await pending
  await (await server)?.close()
  await host.close()
}
