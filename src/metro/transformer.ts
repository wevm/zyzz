/** Chains native authoring compilation into the configured Metro Babel transformer. @module */
import type * as Babel from '@babel/core'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'
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
  options: Omit<NativeOptions, 'platform' | 'target' | 'moduleId'>,
) {
  const upstream: Upstream = Module.createRequire(import.meta.url)(upstreamPath)
  return {
    getCacheKey(...args: readonly unknown[]) {
      const hash = Crypto.createHash('sha256')
      hash.update(upstream.getCacheKey?.(...args) ?? '')
      hash.update(JSON.stringify(options))
      // Metro only hashes the generated entrypoint. Include the library implementation it delegates to.
      const root = Path.resolve(import.meta.dirname, '..')
      for (const name of Fs.readdirSync(root, { recursive: true })
        .map(String)
        .sort()) {
        if (name.endsWith('.js')) {
          hash.update(name)
          hash.update(Fs.readFileSync(Path.join(root, name)))
        }
      }
      return hash.digest('hex')
    },
    transform(input: Input) {
      const platform = input.options.platform
      if (
        (platform !== 'ios' && platform !== 'android') ||
        input.filename.split(/[\\/]/).includes('node_modules')
      )
        return upstream.transform(input)
      return upstream.transform({
        ...input,
        plugins: [
          [zyzz, { ...options, platform, target: 'native' }],
          ...(input.plugins ?? []),
        ],
      })
    },
  }
}
