/** Checks compiler reuse and output freshness through isolated adapter processes. @module */
import * as ChildProcess from 'node:child_process'
import * as Util from 'node:util'
import { expect } from 'vite-plus/test'

/** Runs cold, unchanged, edited, and unchanged-after-edit consumer builds. */
export async function verify(adapter: string) {
  const { stdout } = await Util.promisify(ChildProcess.execFile)(
    process.execPath,
    ['test/fixtures/AdapterCache.ts', adapter],
    { maxBuffer: 4 * 1024 * 1024, timeout: 60_000 },
  )
  const result = JSON.parse(stdout) as Record<
    'cold' | 'edited' | 'settled' | 'warm',
    { code: string; extractions: number; parses: number }
  >
  expect(result.warm.code).toBe(result.cold.code)
  expect(result.edited.code).not.toBe(result.cold.code)
  expect(result.settled.code).toBe(result.edited.code)
  return Object.fromEntries(
    Object.entries(result).map(([phase, { code: _code, ...counts }]) => [
      phase,
      counts,
    ]),
  )
}
