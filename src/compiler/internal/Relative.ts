/**
 * Retains closed in-memory relative resolution for callers without a build host.
 * @module
 */

/** Resolves only supplied relative source modules. Build adapters supply their own edges. */
export function resolve(options: resolve.Options): string | undefined {
  if (!options.specifier.startsWith('.')) return undefined

  if (
    /\.[a-z0-9]+$/i.test(options.specifier) &&
    !/\.[cm]?[jt]sx?$/.test(options.specifier)
  )
    return undefined

  const parts = options.moduleId.split('/').slice(0, -1)

  for (const part of options.specifier.split('/')) {
    if (part === '.' || !part) continue

    if (part === '..') {
      if (!parts.length)
        throw new Error('Source import escapes the supplied graph.')

      parts.pop()
    } else parts.push(part)
  }

  const path = parts.join('/')
  if (Object.hasOwn(options.modules, path)) return path

  const candidates = (() => {
    if (/\.[cm]?jsx?$/.test(path)) {
      return [
        path.replace(/\.js$/, '.ts'),
        path.replace(/\.js$/, '.tsx'),
        path.replace(/\.jsx$/, '.tsx'),
        path.replace(/\.mjs$/, '.mts'),
        path.replace(/\.cjs$/, '.cts'),
      ]
    }

    if (!/\.[^/]+$/.test(path)) {
      return [
        '.cjs',
        '.cjsx',
        '.cts',
        '.ctsx',
        '.js',
        '.jsx',
        '.mjs',
        '.mjsx',
        '.mts',
        '.mtsx',
        '.ts',
        '.tsx',
      ].flatMap((extension) => [path + extension, path + '/index' + extension])
    }

    return []
  })()

  const matches = [...new Set(candidates)].filter((candidate) =>
    Object.hasOwn(options.modules, candidate),
  )
  if (matches.length !== 1)
    throw new Error(
      matches.length
        ? `Ambiguous source import: ${options.specifier}`
        : `Missing source module: ${options.specifier}`,
    )

  return matches[0]!
}

/** Closed source-map resolution contracts. */
export declare namespace resolve {
  /** Source identity and available files. No filesystem or package lookup occurs. */
  type Options = {
    /** Importing source identity. */
    readonly moduleId: string
    /** Complete supplied source map. */
    readonly modules: Readonly<Record<string, string>>
    /** Authored import string. */
    readonly specifier: string
  }
}
