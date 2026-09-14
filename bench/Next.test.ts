/** Measures grouped Next.js builds against native CSS after browser correctness checks. @module */
import { describe, test } from 'vite-plus/test'
import * as Next from '../test/fixtures/Next.js'

describe('build', () => {
  for (const bundler of ['webpack', 'turbopack'] as const)
    test(`compares grouped and native Next.js ${bundler} builds`, async () => {
      await Next.verify({ bundler, compare: true, cssOutput: 'grouped' })
    }, 300_000)
})
