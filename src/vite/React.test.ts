/** Exercises React packed variants through SSR, hydration, updates, and production. @module */
import { describe, test } from 'vite-plus/test'
import * as Framework from '../../test/fixtures/Framework.js'
import * as Fixture from '../../test/fixtures/React.js'

describe('zyzz', () => {
  test.each(['atomic', 'grouped'] as const)(
    'React %s SSR, hydration, updates, and production',
    async (cssOutput) => {
      await Framework.verify({
        cssOutput,
        dependencies: {
          '@vitejs/plugin-react': '5.1.1',
          '@types/react': '19.2.18',
          '@types/react-dom': '19.2.7',
          react: '19.2.4',
          'react-dom': '19.2.4',
        },
        files: Fixture.files,
        jsxImportSource: 'react',
        name: 'react',
        output: 'react',
        plugin: '@vitejs/plugin-react',
      })
    },
    240000,
  )
})
