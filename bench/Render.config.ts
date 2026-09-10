/**
 * Runs isolated production fixtures under Vitest Browser Mode in Chromium.
 * @module
 */
import * as Path from 'node:path'
import { defineConfig } from 'vite-plus'
import { playwright } from '@vitest/browser-playwright'
import * as Render from './Render.js'

export default defineConfig({
  resolve: { alias: { zyzz: Path.resolve('src') } },
  test: {
    browser: {
      commands: Render.commands(),
      enabled: true,
      headless: true,
      instances: [{ browser: 'chromium' }],
      provider: playwright({ launchOptions: { channel: 'chromium' } }),
      viewport: { height: 1000, width: 1300 },
    },
    include: ['bench/Render.browser.ts'],
    testTimeout: 600000,
  },
})
