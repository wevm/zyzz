/** Compiles scoped animation variable reads through source and packed consumers. @module */
import { Graph } from 'zyzz/compiler'
import { describe, expect, test } from 'vite-plus/test'

describe('useAnimatedVars', () => {
  test.each([false, true])(
    'links aliased and namespace hooks with packed=%s',
    (packed) => {
      const modules = {
        'config.ts': `import {defineConfig} from 'zyzz/react-native';export const {vars}=defineConfig({vars:{color:{ink:{light:'#ff0000',dark:'#00ff00'}},spacing:{gap:'8px'}}});`,
      }
      const native = {
        colorScheme: 'light',
        contextual: true,
        platform: 'ios',
        units: { px: 1 },
      } as const
      const publisher = packed ? Graph.compile({ modules, native }) : undefined
      const consumer = Graph.compile({
        ...(publisher ? { contracts: publisher.contracts } : {}),
        imports: {
          'app.ts': {
            './config.js': 'config.ts',
            'zyzz/react-native/reanimated': null,
          },
          'config.ts': { 'zyzz/react-native': null },
        },
        modules: {
          ...(!packed ? modules : {}),
          'app.ts': `import {useAnimatedVars as read} from 'zyzz/react-native/reanimated';import * as Animation from 'zyzz/react-native/reanimated';import {vars} from './config.js';
          export function App(){const color=read(vars,values=>values.color.ink);const spacing=Animation.useAnimatedVars(vars,values=>values.spacing.gap);return {color,spacing}}`,
        },
        native,
      })

      expect(
        Object.values(consumer.modules).some((module) =>
          module.code.includes('NativeVars'),
        ),
      ).toMatchInlineSnapshot('true')
      expect(
        consumer.modules['app.ts']!.code.includes('useAnimatedVars'),
      ).toMatchInlineSnapshot('true')
    },
  )
})
