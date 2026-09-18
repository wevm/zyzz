/** Restricts each authoring transform to its own lane to preserve the native baseline. @module */
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'
import { getDefaultConfig, type MetroConfig } from 'expo/metro-config.js'

const config: MetroConfig = getDefaultConfig(import.meta.dirname)
const require = Module.createRequire(import.meta.url)
const upstream = require.resolve(config.transformer!.babelTransformerPath!)
const zyzz = require.resolve('zyzz/metro/transformer')
const unistyles = require.resolve('react-native-unistyles/plugin')
const root = import.meta.dirname
const code = `
const upstream = require(${JSON.stringify(upstream)});
const zyzz = require(${JSON.stringify(zyzz)}).create(${JSON.stringify(upstream)}, {root:${JSON.stringify(root)},units:{px:1}});
exports.getCacheKey = (...args) => zyzz.getCacheKey(...args) + ${JSON.stringify(require('react-native-unistyles/package.json').version)};
exports.transform = input => {
  const file = require('node:path').resolve(${JSON.stringify(root)}, input.filename).split(require('node:path').sep).join('/');
  if (file.includes('/generated/zyzz/')) return zyzz.transform(input);
  if (file.includes('/generated/unistyles/')) return upstream.transform({...input,plugins:[[${JSON.stringify(unistyles)},{root:${JSON.stringify('generated/unistyles')}}],...(input.plugins || [])]});
  return upstream.transform(input);
};`
const directory = Path.join(root, '.zyzz')
Fs.mkdirSync(directory, { recursive: true })
const transformer = Path.join(directory, `${Crypto.hash('sha256', code)}.cjs`)
Fs.writeFileSync(transformer, code)
const metro: MetroConfig = {
  ...config,
  transformer: { ...config.transformer!, babelTransformerPath: transformer },
  resolver: {
    ...config.resolver!,
    resolveRequest(context, name, platform) {
      if (name.startsWith('.') && name.endsWith('.js')) {
        const stem = Path.resolve(
          Path.dirname(context.originModulePath),
          name.slice(0, -3),
        )
        if (stem.startsWith(root + Path.sep))
          for (const extension of ['.ts', '.tsx'])
            if (Fs.existsSync(stem + extension))
              return context.resolveRequest(context, stem + extension, platform)
      }
      return context.resolveRequest(context, name, platform)
    },
  },
}
export default metro
