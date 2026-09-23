/** Exercises packed Next.js applications through both production bundlers and real browser updates. @module */
import * as ChildProcess from 'node:child_process'
import * as Util from 'node:util'
import { describe, expect, test } from 'vite-plus/test'
import * as Next from '../../test/fixtures/Next.js'

describe('zyzz', () => {
  test.each([false, true])(
    'preserves output across repeated loader requests and dependent edits (development: %s)',
    async (development) => {
      const { stdout } = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          'test/fixtures/NextCache.ts',
          ...(development ? ['--development'] : []),
        ],
        { maxBuffer: 4 * 1024 * 1024 },
      )
      const result = JSON.parse(stdout) as Record<
        'cold' | 'edited' | 'settled' | 'warm',
        string
      > & {
        addedClients: readonly string[]
        addedStylesheets: readonly string[]
      }
      if (development) {
        expect(result.addedClients).toMatchInlineSnapshot('[]')
        expect(result.addedStylesheets).toMatchInlineSnapshot('[]')
      }
      expect(result.cold.includes('red')).toMatchInlineSnapshot('true')
      expect(result.warm === result.cold).toMatchInlineSnapshot('true')
      expect(result.edited.includes('blue')).toMatchInlineSnapshot('true')
      expect(result.edited === result.cold).toMatchInlineSnapshot('false')
      expect(result.settled === result.edited).toMatchInlineSnapshot('true')
    },
  )

  test('keeps forwarded runtime exports outside the style graph and refreshes changed export kinds', async () => {
    const { stdout } = await Util.promisify(ChildProcess.execFile)(
      process.execPath,
      ['test/fixtures/NextBarrels.ts'],
      { maxBuffer: 4 * 1024 * 1024 },
    )
    expect(JSON.parse(stdout)).toMatchInlineSnapshot(`
      {
        "cold": {
          "blue": false,
          "dependencies": [
            "barrel.mjs",
            "component.mjs",
            "consumer.mjs",
            "forward.mjs",
          ],
          "green": false,
          "red": true,
        },
        "edited": {
          "blue": true,
          "dependencies": [
            "barrel.mjs",
            "component.mjs",
            "consumer.mjs",
            "forward.mjs",
          ],
          "green": false,
          "red": false,
        },
        "reference": {
          "blue": false,
          "dependencies": [
            "barrel.mjs",
            "component.mjs",
            "consumer.mjs",
            "forward.mjs",
            "unrelated.mjs",
          ],
          "green": true,
          "red": false,
        },
      }
    `)
  })

  for (const cssOutput of ['atomic', 'grouped'] as const)
    for (const bundler of ['webpack', 'turbopack'] as const)
      test(`builds and updates a packed Next.js ${bundler} ${cssOutput} application`, async () => {
        await Next.verify({ bundler, cssOutput })
      }, 300_000)
})
