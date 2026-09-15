/** Compiles the source tree with the Host API, then bundles the compiled tree with Vite. @module */
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

try {
  await host.build()
  await Fs.writeFile(Path.join(outDir, 'styles.css'), await stylesheet(outDir))
} finally {
  await host.close()
}

// The compiled configuration is a build artifact, so it loads through a runtime URL.
const compiled = (await import(
  Url.pathToFileURL(Path.join(outDir, 'zyzz.config.ts')).href
)) as { script: () => string }

await Vite.build({
  configFile: false,
  plugins: [
    {
      name: 'zyzz-initialization',
      transformIndexHtml: () => [
        // Saved preferences apply before any other script or visible content.
        {
          children: compiled.script(),
          injectTo: 'head-prepend',
          tag: 'script',
        },
      ],
    },
  ],
  root,
})
