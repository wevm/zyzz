/** Exercises Vue through its real compiler, renderer, and Vite lifecycle. @module */
import { describe, test } from 'vite-plus/test'
import * as Framework from '../../test/fixtures/Framework.js'
import * as Fixture from '../../test/fixtures/Vue.js'

describe('zyzz', () => {
  test('Vue types, SSR, hydration, updates, themes, CSS edits, and production', async () => {
    await Framework.verify({
      dependencies: { vue: '3.5.21', '@vitejs/plugin-vue': '6.0.8' },
      files: Fixture.files,
      name: 'vue',
      plugin: '@vitejs/plugin-vue',
    })
  }, 240000)
})
