/** Exercises Svelte through its real compiler, renderer, and Vite lifecycle. @module */
import { describe, test } from 'vite-plus/test'
import * as Framework from '../../test/fixtures/Framework.js'
import * as Fixture from '../../test/fixtures/Svelte.js'

describe('zyzz', () => {
  test.each(['atomic', 'grouped'] as const)(
    'Svelte %s SSR, hydration, updates, and production',
    async (cssOutput) => {
      await Framework.verify({
        cssOutput,
        dependencies: {
          svelte: '5.46.4',
          '@sveltejs/vite-plugin-svelte': '7.3.0',
        },
        files: Fixture.files,
        name: 'svelte',
        plugin: '@sveltejs/vite-plugin-svelte',
        pluginExport: 'svelte',
      })
    },
    240000,
  )
})
