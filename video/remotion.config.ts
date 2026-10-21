/** @module Remotion CLI settings: H.264 output, automatic JSX, and NodeNext-style `.js` imports of TypeScript files. */
import { Config } from '@remotion/cli/config'

Config.setCodec('h264')
Config.setCrf(16)
Config.setJpegQuality(95)
Config.setPixelFormat('yuv420p')
Config.setVideoImageFormat('jpeg')

// Remotion's esbuild loader reads `jsx` through the TypeScript API, which TypeScript 7 no longer exposes, so set it here.
Config.overrideWebpackConfig((config) => ({
  ...config,
  module: {
    ...config.module,
    rules: (config.module?.rules ?? []).map((rule) => {
      if (!rule || typeof rule !== 'object' || !Array.isArray(rule.use))
        return rule
      return {
        ...rule,
        use: rule.use.map((use) =>
          use &&
          typeof use === 'object' &&
          typeof use.loader === 'string' &&
          use.loader.includes('esbuild-loader') &&
          typeof use.options === 'object'
            ? {
                ...use,
                options: {
                  ...use.options,
                  tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } },
                },
              }
            : use,
        ),
      }
    }),
  },
  resolve: {
    ...config.resolve,
    extensionAlias: { '.js': ['.tsx', '.ts', '.js'] },
  },
}))
