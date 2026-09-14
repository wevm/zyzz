/**
 * Builds production React fixtures and persists Browser Mode measurements.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Os from 'node:os'
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
  kind: 'callable' | 'dynamic' | 'overrides' | 'variants'
}

/** Raw samples from one independently ordered pass. */
export type Group = Options & {
  /** Forward or reversed framework order. */
  pass: number
  /** Per-operation timings after warmup. */
  samples: readonly RenderFixture.Sample[]
  /** CSS style rules, including nested conditional rules, counted outside timing. */
  styleRules: number
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
      cssOutput: options.library === 'zyzz' ? 'grouped' : undefined,
      cssRaw: Buffer.byteLength(output.css),
      cssBrotli: Zlib.brotliCompressSync(output.css).byteLength,
      cssGzip: Zlib.gzipSync(output.css).byteLength,
      javascriptRaw: Buffer.byteLength(javascript),
      javascriptBrotli: Zlib.brotliCompressSync(javascript).byteLength,
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
      JSON.stringify(
        {
          groups,
          userAgent,
          version: 1,
          zyzzCssOutput: 'grouped',
          node: process.version,
          platform: `${Os.platform()} ${Os.arch()}`,
          cpu: Os.cpus()[0]?.model,
          revision:
            process.env.BASE_SHA ??
            ChildProcess.execFileSync('git', ['rev-parse', 'HEAD'], {
              encoding: 'utf8',
            }).trim(),
          warmupCycles: 3,
          sampleCycles: 20,
          scope:
            'Production React mounts, changed-prop updates, and remounts. Compilation, loading, and correctness checks are outside timing; forward and reversed library passes share one runner.',
        },
        null,
        2,
      ),
    )
  }

  return { prepareRender, saveRender }
}
