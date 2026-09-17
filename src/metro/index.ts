/** Configures native Zyzz compilation in Metro without a separate generation command. @module */
import type { NativeOptions } from '../babel/index.js'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Watch from './Watch.js'

/** Minimum Metro configuration consumed by the adapter. */
export type Config = {
  /** Existing development middleware settings. */
  readonly server?: object | undefined
  /** Application root used for the adapter cache. */
  readonly projectRoot?: string | undefined
  /** Existing transformer configuration, including Expo's Babel transformer. */
  readonly transformer?:
    | {
        /** Upstream Babel transformer to preserve. */
        readonly babelTransformerPath?: string | undefined
      }
    | undefined
}

/**
 * Preserves Metro configuration and chains Zyzz before the existing Babel transformer.
 * Writes an immutable adapter entrypoint under `.zyzz/metro`, not compiled application files.
 */
export function zyzz<const config extends Config>(
  config: config,
  options: Omit<
    NativeOptions,
    'platform' | 'target' | 'moduleId' | 'modules' | 'imports' | 'colorScheme'
  > = {},
): zyzz.ReturnType<config> {
  if (Object.hasOwn(options, 'colorScheme'))
    throw new Error(
      'Select colorScheme through the React provider, not Metro configuration.',
    )
  const root = Path.resolve(config.projectRoot ?? process.cwd())
  const require = Module.createRequire(Path.join(root, 'package.json'))
  const upstream = config.transformer?.babelTransformerPath
  if (!upstream)
    throw new Error('Zyzz requires a configured Metro Babel transformer.')

  const adapter = Module.createRequire(import.meta.url).resolve(
    'zyzz/metro/transformer',
  )
  const code = `module.exports = require(${JSON.stringify(adapter)}).create(${JSON.stringify(require.resolve(upstream))}, ${JSON.stringify({ ...options, root })});\n`
  const directory = Path.join(root, '.zyzz', 'metro')
  const filename = Path.join(directory, `${Crypto.hash('sha256', code)}.cjs`)
  Fs.mkdirSync(directory, { recursive: true })
  try {
    Fs.writeFileSync(filename, code, { flag: 'wx' })
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
      throw error
  }

  const enhance =
    config.server &&
    (Reflect.get(config.server, 'enhanceMiddleware') as
      | ((middleware: Middleware, server: Watch.Server) => Middleware)
      | undefined)
  type Middleware = (...args: unknown[]) => unknown
  return {
    ...config,
    server: {
      ...config.server,
      enhanceMiddleware(middleware: Middleware, server: Watch.Server) {
        const ready = Watch.attach(server, root)
        const next = enhance
          ? enhance.call(config.server, middleware, server)
          : middleware
        return (...args: unknown[]) =>
          ready.then(
            () => next(...args),
            (error: unknown) => {
              const report = args[2]
              if (typeof report === 'function') return report(error)
              throw error
            },
          )
      },
    },
    transformer: { ...config.transformer, babelTransformerPath: filename },
  } as zyzz.ReturnType<config>
}

/** Configuration returned by the Metro adapter. */
export declare namespace zyzz {
  /** Preserves caller configuration fields and the existing transformer options. */
  type ReturnType<config extends Config> = Omit<config, 'transformer'> & {
    /** Existing transformer configuration with the native compilation entrypoint. */
    transformer: Omit<
      NonNullable<config['transformer']>,
      'babelTransformerPath'
    > & { babelTransformerPath: string }
  }
}
