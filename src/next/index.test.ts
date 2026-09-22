/** Exercises packed Next.js applications through both production bundlers and real browser updates. @module */
import * as ChildProcess from 'node:child_process'
import * as Util from 'node:util'
import { describe, expect, test } from 'vite-plus/test'
import * as Next from '../../test/fixtures/Next.js'

describe('zyzz', () => {
  test('reuses compilation across loader requests and invalidates dependents', async () => {
    const { stdout } = await Util.promisify(ChildProcess.execFile)(
      process.execPath,
      ['test/fixtures/NextCache.ts'],
      { maxBuffer: 4 * 1024 * 1024 },
    )
    const result = JSON.parse(stdout) as Record<
      'cold' | 'edited' | 'settled' | 'warm',
      {
        code: string
        extractions: number
        loads: number
        parses: number
        transforms: number
      }
    >
    // Each invalidated module crosses extraction twice: validation, then linked extraction.
    expect(
      Object.fromEntries(
        Object.entries(result).map(([phase, { code: _code, ...counts }]) => [
          phase,
          counts,
        ]),
      ),
    ).toMatchInlineSnapshot(`
      {
        "cold": {
          "extractions": 6,
          "loads": 3,
          "parses": 9,
          "transforms": 3,
        },
        "edited": {
          "extractions": 4,
          "loads": 3,
          "parses": 6,
          "transforms": 3,
        },
        "settled": {
          "extractions": 0,
          "loads": 3,
          "parses": 0,
          "transforms": 0,
        },
        "warm": {
          "extractions": 0,
          "loads": 3,
          "parses": 0,
          "transforms": 0,
        },
      }
    `)
    expect(result.cold.code).toContain('red')
    expect(result.warm.code).toBe(result.cold.code)
    expect(result.edited.code).toContain('blue')
    expect(result.edited.code).not.toBe(result.cold.code)
    expect(result.settled.code).toBe(result.edited.code)
  })

  for (const cssOutput of ['atomic', 'grouped'] as const)
    for (const bundler of ['webpack', 'turbopack'] as const)
      test(`builds and updates a packed Next.js ${bundler} ${cssOutput} application`, async () => {
        await Next.verify({ bundler, cssOutput })
      }, 300_000)
})
