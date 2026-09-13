/** Connects Next.js configuration to the shared static compiler. @module */
import type { NextConfig } from 'next'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'

/**
 * Adds source transformation, CSS delivery, and project dependency watching to both bundlers.
 * Preserves existing configuration hooks and creates `.zyzz/next` beneath the working directory.
 * Throws file-system errors during setup; compilation errors are reported by the bundler.
 */
export function zyzz(config: NextConfig): NextConfig
export function zyzz(config: zyzz.Factory): zyzz.Factory
export function zyzz(config: Promise<NextConfig>): Promise<NextConfig>
export function zyzz(
  config: NextConfig | zyzz.Factory | Promise<NextConfig>,
): NextConfig | zyzz.Factory | Promise<NextConfig> {
  if (typeof config === 'function')
    return async (phase, context) => zyzz(await config(phase, context))
  if (config instanceof Promise) return config.then(zyzz)

  const loader = Module.createRequire(import.meta.url).resolve(
    'zyzz/next/loader',
  )
  const options = { root: process.cwd() }
  const shared = Path.join(options.root, '.zyzz', 'next', 'shared.css')
  Fs.mkdirSync(Path.dirname(shared), { recursive: true })
  try {
    Fs.writeFileSync(shared, '', { flag: 'wx' })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
  }
  const pattern = '*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'
  const existing = config.turbopack?.rules?.[pattern]
  const rule = {
    condition: {
      all: [{ not: 'foreign' as const }, { not: { query: /zyzz-style/ } }],
    },
    loaders: [
      { loader, options: { ...options, bundler: 'turbopack', mode: 'source' } },
    ],
  }

  return {
    ...config,
    turbopack: {
      ...config.turbopack,
      rules: {
        ...config.turbopack?.rules,
        [pattern]: [
          ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
          rule,
          {
            condition: { query: /zyzz-style/ },
            loaders: [
              {
                loader,
                options: { ...options, bundler: 'turbopack', mode: 'style' },
              },
            ],
            as: '*.css',
          },
        ],
        '**/.zyzz/next/shared.css': {
          loaders: [
            {
              loader,
              options: { ...options, bundler: 'turbopack', mode: 'shared' },
            },
          ],
        },
      },
    },
    webpack(value, context) {
      const result = config.webpack?.(value, context) ?? value
      result.module ??= {}
      result.module.rules ??= []
      result.module.rules.push({
        enforce: 'pre',
        exclude: /node_modules/,
        include: options.root,
        test: /\.[cm]?[jt]sx?$/,
        use: [
          {
            loader,
            options: { ...options, bundler: 'webpack', mode: 'source' },
          },
        ],
      })
      return result
    },
  }
}

/** Next.js configuration callback contracts. */
export declare namespace zyzz {
  /** Receives the Next.js phase and defaults and returns application options. */
  type Factory = (
    phase: string,
    context: { defaultConfig: NextConfig },
  ) => NextConfig | Promise<NextConfig>
}
