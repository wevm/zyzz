/** Exercises packed Next.js applications through both production bundlers and real browser updates. @module */
import * as ChildProcess from 'node:child_process'
import * as Util from 'node:util'
import { describe, expect, test } from 'vite-plus/test'
import * as Next from '../../test/fixtures/Next.js'

describe('zyzz', () => {
  test('preserves output across repeated loader requests and dependent edits', async () => {
    const { stdout } = await Util.promisify(ChildProcess.execFile)(
      process.execPath,
      ['test/fixtures/NextCache.ts'],
      { maxBuffer: 4 * 1024 * 1024 },
    )
    const result = JSON.parse(stdout) as Record<
      'cold' | 'edited' | 'settled' | 'warm',
      string
    >
    expect(result.cold.includes('red')).toMatchInlineSnapshot('true')
    expect(result.warm === result.cold).toMatchInlineSnapshot('true')
    expect(result.edited.includes('blue')).toMatchInlineSnapshot('true')
    expect(result.edited === result.cold).toMatchInlineSnapshot('false')
    expect(result.settled === result.edited).toMatchInlineSnapshot('true')
  })

  for (const cssOutput of ['atomic', 'grouped'] as const)
    for (const bundler of ['webpack', 'turbopack'] as const)
      test(`builds and updates a packed Next.js ${bundler} ${cssOutput} application`, async () => {
        await Next.verify({ bundler, cssOutput })
      }, 300_000)
})
