/** Exercises type benchmark selection through the real CLI. @module */
import * as ChildProcess from 'node:child_process'
import { describe, expect, test } from 'vite-plus/test'

describe('type benchmark shards', () => {
  test('partitions every selected fixture exactly once', () => {
    const list = (...args: string[]) => {
      const result = ChildProcess.spawnSync(
        process.execPath,
        ['scripts/type-benches.ts', '--list', ...args],
        { encoding: 'utf8', timeout: 10_000 },
      )

      expect(result.status).toBe(0)
      return result.stdout.trim().split('\n')
    }

    const all = list()
    const first = list('--shard', '1/2')
    const second = list('--shard', '2/2')

    expect([...first, ...second]).toEqual(all)
    expect(new Set([...first, ...second]).size).toBe(all.length)
    expect(Math.abs(first.length - second.length)).toBeLessThanOrEqual(1)
    expect(list('--fixture', 'Style.bench-d.ts', '--shard', '1/1')).toEqual([
      'src/Style.bench-d.ts',
    ])
  })

  test.each(['0/2', '3/2', '1/0', '1/1000', 'invalid', ''])(
    'rejects invalid shard %s',
    (shard) => {
      const result = ChildProcess.spawnSync(
        process.execPath,
        ['scripts/type-benches.ts', '--list', '--shard', shard],
        { encoding: 'utf8', timeout: 10_000 },
      )

      expect(result.status).toBe(1)
      expect(result.stderr.trim()).toMatchInlineSnapshot(
        '"--shard requires i/n with 1 <= i <= n <= fixture count."',
      )
    },
  )
})
