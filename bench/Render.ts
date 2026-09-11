/**
 * Builds production React fixtures and persists Browser Mode measurements.
 * @module
 */
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Zlib from 'node:zlib'
import type { BrowserCommand } from 'vite-plus/test/node'
import type * as RenderFixture from './RenderFixture.js'
import * as Runtime from './Runtime.js'

/** Framework and component dimensions for a browser run. */
export type Options = Runtime.create.Options & {
  /** Rendered card count. */
  components: number
  /** Workload implemented by the React fixture. */
  kind: 'callable' | 'dynamic' | 'overrides'
}

/** Raw samples from one independently ordered pass. */
export type Group = Options & {
  /** Forward or reversed framework order. */
  pass: number
  /** Per-operation timings after warmup. */
  samples: readonly RenderFixture.Sample[]
}

/** Creates server commands scoped to a single Vitest configuration. */
export function commands() {
  const directory = process.env.BENCH_RENDER_OUTPUT ?? 'bench/results'
  const cache = new Map<string, string>()

  const prepareRender: BrowserCommand<[Options], string> = async (
    _,
    options,
  ) => {
    const key = `${options.components}/${options.kind}/${options.library}`
    const cached = cache.get(key)
    if (cached) return cached

    const output = await Runtime.create(options)

    const result = await Esbuild.build({
      bundle: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      format: 'iife',
      legalComments: 'none',
      minify: true,
      platform: 'browser',
      stdin: {
        contents: `import * as RenderFixture from './bench/RenderFixture.ts';\n${output.javascript}\nwindow.renderFixture = RenderFixture.create({...${JSON.stringify({ components: options.components, inputs: Runtime.overrides, kind: options.kind, literals: Runtime.literalStyles(options.count) })}, apply: fixture.apply});`,
        loader: 'ts',
        resolveDir: process.cwd(),
      },
      write: false,
    })

    const javascript = result.outputFiles[0]!.text
    const sizes = {
      cssGzip: Zlib.gzipSync(output.css).byteLength,
      javascriptGzip: Zlib.gzipSync(javascript).byteLength,
    }

    await Fs.mkdir(Path.join(directory, 'render', key), { recursive: true })
    await Fs.writeFile(
      Path.join(directory, 'render', key, 'sizes.json'),
      JSON.stringify(sizes),
    )

    const html = `<!doctype html><html><head><style>body{margin:0}main{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:4px}article{box-sizing:border-box}h2,p{margin:0;font:12px sans-serif}${output.css}</style></head><body><div id="app"></div><script>${javascript.replace(/<\/script/gi, '<\\/script')}</script></body></html>`

    cache.set(key, html)

    return html
  }

  const saveRender: BrowserCommand<[readonly Group[], string], void> = async (
    _,
    groups,
    userAgent,
  ) => {
    await Fs.mkdir(directory, { recursive: true })
    await Fs.writeFile(
      Path.join(directory, 'render-timings.json'),
      JSON.stringify({ groups, userAgent, version: 1 }, null, 2),
    )
  }

  return { prepareRender, saveRender }
}
