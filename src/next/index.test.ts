/** Exercises packed Next.js applications through both production bundlers and real browser updates. @module */
import { describe, test } from 'vite-plus/test'
import * as Next from '../../test/fixtures/Next.js'

describe('zyzz', () => {
  for (const cssOutput of ['atomic', 'grouped'] as const)
    for (const bundler of ['webpack', 'turbopack'] as const)
      test(`builds and updates a packed Next.js ${bundler} ${cssOutput} application`, async () => {
        await Next.verify({ bundler, cssOutput })
      }, 300_000)
})
