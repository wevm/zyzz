/** Exercises Solid through its real compiler, renderer, and Vite lifecycle. @module */
import { describe, test } from 'vite-plus/test'
import * as Framework from '../../test/fixtures/Framework.js'
import * as Fixture from '../../test/fixtures/Solid.js'

describe('zyzz', () => {
  test.each(['atomic', 'grouped'] as const)(
    'Solid %s SSR, hydration, updates, and production',
    async (cssOutput) => {
      await Framework.verify({
        cssOutput,
        dependencies: { 'solid-js': '1.9.9', 'vite-plugin-solid': '2.11.8' },
        files: Fixture.files,
        jsxImportSource: 'solid-js',
        name: 'solid',
        plugin: 'vite-plugin-solid',
        pluginOptions: { ssr: true },
      })
    },
    240000,
  )
})
