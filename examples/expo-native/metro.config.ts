/** Resolves local TypeScript modules written with NodeNext import extensions. @module */
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import { getDefaultConfig } from 'expo/metro-config.js'

const config = getDefaultConfig(import.meta.dirname)

const metro: typeof config = {
  ...config,
  resolver: {
    ...config.resolver,
    resolveRequest: (context, name, platform) => {
      if (name.startsWith('.') && name.endsWith('.js')) {
        const base = Path.resolve(
          Path.dirname(context.originModulePath),
          name.slice(0, -3),
        )
        for (const extension of ['.ts', '.tsx']) {
          if (
            base.startsWith(`${import.meta.dirname}${Path.sep}`) &&
            Fs.existsSync(base + extension)
          )
            return context.resolveRequest(context, base + extension, platform)
        }
      }

      return context.resolveRequest(context, name, platform)
    },
  },
}

export default metro
