/** Configures native Zyzz compilation in Metro without a separate generation command. @module */
import type { NativeOptions } from '../babel/index.js'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'

/** Minimum Metro configuration consumed by the adapter. */
export type Config = {
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
  options: Omit<NativeOptions, 'platform' | 'target' | 'moduleId'>,
): zyzz.ReturnType<config> {
  const root = Path.resolve(config.projectRoot ?? process.cwd())
  const require = Module.createRequire(Path.join(root, 'package.json'))
  const upstream = config.transformer?.babelTransformerPath
  if (!upstream)
    throw new Error('Zyzz requires a configured Metro Babel transformer.')
  if (options.colorScheme !== 'dark' && options.colorScheme !== 'light')
    throw new Error('Zyzz requires an explicit light or dark color scheme.')

  const adapter = Module.createRequire(import.meta.url).resolve(
    'zyzz/metro/transformer',
  )
  const code = `module.exports = require(${JSON.stringify(adapter)}).create(${JSON.stringify(require.resolve(upstream))}, ${JSON.stringify(options)});\n`
  const directory = Path.join(root, '.zyzz', 'metro')
  const filename = Path.join(directory, `${Crypto.hash('sha256', code)}.cjs`)
  Fs.mkdirSync(directory, { recursive: true })
  try {
    Fs.writeFileSync(filename, code, { flag: 'wx' })
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
      throw error
  }

  return {
    ...config,
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
