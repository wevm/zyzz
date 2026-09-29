/** Connects Next.js configuration to the shared static compiler. @module */
import type { NextConfig } from 'next'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'

/**
 * Adds source transformation, CSS delivery, and imported dependency watching to both bundlers.
 * Preserves configuration hooks. Compilation emits stylesheets beneath `.zyzz/next`.
 * Compilation and file-system errors are reported by the bundler.
 */
export function zyzz(config: NextConfig, options?: zyzz.Options): NextConfig
export function zyzz(config: zyzz.Factory, options?: zyzz.Options): zyzz.Factory
export function zyzz(
  config: Promise<NextConfig>,
  options?: zyzz.Options,
): Promise<NextConfig>
export function zyzz(
  config: NextConfig | zyzz.Factory | Promise<NextConfig>,
  options: zyzz.Options = {},
): NextConfig | zyzz.Factory | Promise<NextConfig> {
  if (typeof config === 'function')
    return async (phase, context) => zyzz(await config(phase, context), options)
  if (config instanceof Promise)
    return config.then((value) => zyzz(value, options))

  const loader = Module.createRequire(import.meta.url).resolve(
    'zyzz/next/loader',
  )
  const loaderOptions = {
    development: process.env.NODE_ENV === 'development',
    reset: options.reset ?? false,
    root: process.cwd(),
  }
  // Turbopack must observe the output directory before taking its filesystem snapshot.
  const directory = Path.join(loaderOptions.root, '.zyzz', 'next')
  Fs.mkdirSync(directory, { recursive: true })
  for (const [name, source] of Object.entries({
    'package.json': JSON.stringify({ sideEffects: true, type: 'module' }),
    'style.css': '',
  })) {
    try {
      Fs.writeFileSync(Path.join(directory, name), source, { flag: 'wx' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  const pattern = '*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'
  const existing = config.turbopack?.rules?.[pattern]
  const rule = {
    condition: { not: 'foreign' as const },
    loaders: [
      {
        loader,
        options: { ...loaderOptions, bundler: 'turbopack' },
      },
    ],
  }

  return {
    ...config,
    experimental: {
      ...config.experimental,
      lightningCssFeatures: {
        ...config.experimental?.lightningCssFeatures,
        exclude: [
          ...new Set([
            ...(config.experimental?.lightningCssFeatures?.exclude ?? []),
            'light-dark' as const,
          ]),
        ],
      },
    },
    turbopack: {
      ...config.turbopack,
      rules: {
        ...config.turbopack?.rules,
        [pattern]: [
          ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
          rule,
        ],
        '**/.zyzz/next/style.css': {
          condition: { query: /zyzz=/ },
          loaders: [
            {
              loader,
              options: {
                ...loaderOptions,
                bundler: 'turbopack',
                mode: 'style',
              },
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
        include: loaderOptions.root,
        test: /\.[cm]?[jt]sx?$/,
        use: [
          {
            loader,
            options: { ...loaderOptions, bundler: 'webpack' },
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

  /** Web stylesheet delivery settings. */
  type Options = {
    /** Include the CSS reset. Defaults to false. */
    readonly reset?: boolean | undefined
  }
}
