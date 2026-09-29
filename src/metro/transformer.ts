/** Chains native authoring compilation into the configured Metro Babel transformer. @module */
import * as Compilation from '../babel/internal/Compilation.js'
import * as Compiler from '../compiler/Graph.js'
import * as Snapshot from '../node/internal/Snapshot.js'
import type * as Babel from '@babel/core'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Graph from './Graph.js'
import { type NativeOptions, zyzz } from '../babel/index.js'

/** Babel transformer inputs passed through without removing upstream fields. */
type Input = {
  readonly filename: string
  readonly options: { readonly platform?: string | undefined }
  readonly plugins?: readonly Babel.PluginItem[] | undefined
  readonly src: string
}

type Upstream = {
  getCacheKey?: ((...args: readonly unknown[]) => string) | undefined
  transform: (input: Input) => unknown
}

/** Creates a transformer with isolated options and the existing upstream implementation. */
export function create(
  upstreamPath: string,
  options: Omit<
    NativeOptions,
    'platform' | 'target' | 'moduleId' | 'modules' | 'imports' | 'colorScheme'
  > & { readonly root: string },
) {
  const compilers = new Map<string, ReturnType<typeof Compiler.create>>()
  const snapshot = Snapshot.create()
  const upstream: Upstream = Module.createRequire(import.meta.url)(upstreamPath)
  return {
    getCacheKey(...args: readonly unknown[]) {
      const hash = Crypto.createHash('sha256')
      hash.update(upstream.getCacheKey?.(...args) ?? '')
      hash.update(JSON.stringify(options))
      function sources(directory: string) {
        for (const entry of Fs.readdirSync(directory, {
          withFileTypes: true,
        }).sort((a, b) => a.name.localeCompare(b.name))) {
          if (
            entry.name.startsWith('.') ||
            ['node_modules', 'dist'].includes(entry.name)
          )
            continue
          const path = Path.join(directory, entry.name)
          if (entry.isDirectory()) sources(path)
          else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) {
            hash.update(path)
            hash.update(Fs.readFileSync(path))
          }
        }
      }
      sources(options.root)
      // Metro only hashes the generated entrypoint. Include the library implementation it delegates to.
      const root = Path.resolve(import.meta.dirname, '..')
      for (const name of Fs.readdirSync(root, { recursive: true })
        .map(String)
        .sort()) {
        if (
          /\.[cm]?[jt]sx?$/.test(name) &&
          !/\.(?:d|test|test-d|bench|bench-d)\.[cm]?[jt]sx?$/.test(name)
        ) {
          hash.update(name)
          hash.update(Fs.readFileSync(Path.join(root, name)))
        }
      }
      return hash.digest('hex')
    },
    transform(input: Input) {
      const platform = input.options.platform
      const filename = Path.resolve(options.root, input.filename)
      if (
        (platform !== 'ios' && platform !== 'android') ||
        !/\.[cm]?[jt]sx?$/.test(input.filename) ||
        input.filename.split(/[\\/]/).includes('node_modules') ||
        Path.relative(options.root, filename).startsWith(`..${Path.sep}`)
      )
        return upstream.transform(input)

      const graph = Graph.read(
        filename,
        input.src,
        platform,
        options.root,
        snapshot,
      )
      const key = `${platform}:${filename}`
      let compiler = compilers.get(key)
      if (!compiler) {
        compiler = Compiler.create()
        compilers.set(key, compiler)
      }

      return upstream.transform({
        ...input,
        plugins: [
          [
            zyzz,
            {
              ...options,
              platform,
              target: 'native',
              ...graph,
              [Compilation.key]: {
                compile: compiler.compile,
                parse: snapshot.parse,
                programs: snapshot.programs(graph.modules),
              },
            },
          ],
          ...(input.plugins ?? []),
        ],
      })
    },
  }
}
