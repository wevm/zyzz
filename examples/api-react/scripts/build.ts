/** Compiles the source tree with the Host API, then bundles the compiled tree with Vite. @module */
import * as Path from 'node:path'
import * as Vite from 'vite'
import { Host } from 'zyzz/node'

const root = Path.resolve(import.meta.dirname, '..')
// The compiled tree lands in dist; the saved-selection script lands in public so Vite serves and copies it.
const host = await Host.create({
  packageId: 'api-react',
  root: Path.join(root, 'src'),
  script: Path.join(root, 'public/zyzz.js'),
})

try {
  await host.build()
} finally {
  await host.close()
}

// `zyzz build` owns dist, so the site builds beside it.
await Vite.build({ build: { outDir: 'build' }, configFile: false, root })
