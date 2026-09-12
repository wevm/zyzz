/**
 * Wraps Next.js configuration with Zyzz source transformation and CSS delivery for webpack and Turbopack.
 * @module
 */
import type { NextConfig } from 'next'
import * as Url from 'node:url'
import * as Loader from './internal/Loader.js'

/**
 * Attaches the Zyzz loader to both Next.js bundlers while preserving the existing configuration.
 * Existing `turbopack.rules` entries and a `webpack` hook are composed; the wrapper appends its
 * own rules after them. Project modules are transformed with the shared compiler, and their CSS
 * is delivered through the bundler's stylesheet pipeline without Babel or PostCSS configuration.
 * @param nextConfig - Application configuration object; pass `{}` for an otherwise empty configuration.
 * @returns The same options with the Zyzz integration attached.
 * @throws TypeError for asynchronous or function-valued configurations.
 */
export function zyzz(nextConfig: NextConfig): NextConfig {
  if (
    typeof nextConfig !== 'object' ||
    nextConfig === null ||
    Array.isArray(nextConfig) ||
    'then' in nextConfig
  )
    throw new TypeError(
      'zyzz(nextConfig) requires a Next.js configuration object; asynchronous and function-valued configurations are unsupported.',
    )

  const rules = nextConfig.turbopack?.rules ?? {}
  const existing = rules[glob]
  const rule = {
    condition: { not: { path: /node_modules/ } },
    loaders: [{ loader, options: { bundler: 'turbopack' } }],
  }

  return {
    ...nextConfig,
    turbopack: {
      ...nextConfig.turbopack,
      rules: {
        ...rules,
        [glob]:
          existing === undefined
            ? rule
            : Array.isArray(existing)
              ? [...existing, rule]
              : [existing, rule],
      },
    },
    webpack(config, context) {
      const composed: unknown = nextConfig.webpack
        ? nextConfig.webpack(config, context)
        : config

      if (!isWebpackConfig(composed))
        throw new Error(
          'The existing webpack hook must return a webpack configuration.',
        )

      composed.module.rules.push(
        {
          exclude: /node_modules/,
          test: /\.[cm]?[jt]sx?$/,
          use: [{ loader, options: { bundler: 'webpack' } }],
        },
        {
          resourceQuery: Loader.stylesheet,
          test: Loader.carrier,
          use: [{ loader, options: { bundler: 'webpack' } }],
        },
      )

      return composed
    },
  }
}

type WebpackConfig = { module: { rules: unknown[] } }

const glob = '*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'

// The loader ships beside this module, as TypeScript source or as built JavaScript.
const loader = Url.fileURLToPath(
  import.meta.url.replace(
    /index\.([cm]?[jt]s)(?:\?.*)?$/,
    'internal/Loader.$1',
  ),
)

function isWebpackConfig(value: unknown): value is WebpackConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'module' in value &&
    typeof value.module === 'object' &&
    value.module !== null &&
    'rules' in value.module &&
    Array.isArray(value.module.rules)
  )
}
