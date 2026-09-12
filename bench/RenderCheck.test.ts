/**
 * Exercises the Zyzz render regression check CLI with base and candidate run files.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import type * as Render from './Render.js'

describe('render check', () => {
  test('reports advisory changes and enforces an opt-in threshold', async () => {
    const directory = await Fs.mkdtemp(
      Path.join(Os.tmpdir(), 'zyzz-render-check-'),
    )

    try {
      const groups = (candidate: boolean) => {
        const result: Render.Group[] = []

        for (const components of [100, 1000])
          for (const kind of ['callable', 'overrides', 'dynamic'] as const)
            for (const library of kind === 'dynamic'
              ? (['baseline', 'zyzz'] as const)
              : ([
                  'baseline',
                  'panda',
                  'stylex',
                  'tailwind',
                  'vanilla-extract',
                  'zyzz',
                ] as const))
              for (const pass of [1, 2])
                result.push({
                  components,
                  count: components / 10,
                  kind,
                  library,
                  pass,
                  samples: Array.from({ length: 20 }, () =>
                    (['mount', 'update', 'remount'] as const).map(
                      (operation) => {
                        // The candidate regresses one cell by 40% and improves another by 20%.
                        const commitLayout = (() => {
                          if (!candidate || library !== 'zyzz') return 10
                          if (
                            components === 1000 &&
                            kind === 'overrides' &&
                            operation === 'update'
                          )
                            return 14
                          if (
                            components === 100 &&
                            kind === 'callable' &&
                            operation === 'mount'
                          )
                            return 8

                          return 10
                        })()

                        return {
                          commit: 1,
                          commitLayout,
                          frame: 32,
                          operation,
                        }
                      },
                    ),
                  ).flat(),
                })

        return result
      }

      const base = Path.join(directory, 'render-base')

      await Fs.mkdir(base)
      await Fs.writeFile(Path.join(base, 'commit.txt'), 'abcdef0123456789\n')
      await Fs.writeFile(
        Path.join(base, 'render-timings.json'),
        JSON.stringify({ groups: groups(false), userAgent: 'check fixture' }),
      )
      await Fs.writeFile(
        Path.join(directory, 'render-timings.json'),
        JSON.stringify({ groups: groups(true), userAgent: 'check fixture' }),
      )

      const advisory = ChildProcess.spawnSync(
        process.execPath,
        ['bench/RenderCheck.ts', directory],
        {
          encoding: 'utf8',
          env: { ...process.env, BENCH_RENDER_THRESHOLD: '' },
        },
      )

      expect(advisory.status).toMatchInlineSnapshot(`1`)
      expect(
        advisory.stderr.includes('BENCH_RENDER_THRESHOLD must be'),
      ).toMatchInlineSnapshot(`true`)

      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => key !== 'BENCH_RENDER_THRESHOLD',
        ),
      )
      const unset = ChildProcess.spawnSync(
        process.execPath,
        ['bench/RenderCheck.ts', directory],
        { encoding: 'utf8', env },
      )

      expect(unset.status).toMatchInlineSnapshot(`0`)
      expect(unset.stdout).toMatchInlineSnapshot(`
        "## Zyzz Render Regression Check

        Base \`abcdef0\` measured first with the candidate harness on the same runner. Values are the mean of both pass medians for commit + layout, in milliseconds. Changes above +30% are marked; set \`BENCH_RENDER_THRESHOLD\` to enforce the check. One run of each revision cannot separate a change of that size from runner drift unless repeated runs confirm it.

        | Cards | Workload | Operation | Base ms | Candidate ms | Change |
        | ---: | --- | --- | ---: | ---: | ---: |
        | 100 | callable | mount | 10.00 | 8.00 | 🟡 -20.0% |
        | 100 | callable | update | 10.00 | 10.00 | 🟡 0.0% |
        | 100 | callable | remount | 10.00 | 10.00 | 🟡 0.0% |
        | 100 | overrides | mount | 10.00 | 10.00 | 🟡 0.0% |
        | 100 | overrides | update | 10.00 | 10.00 | 🟡 0.0% |
        | 100 | overrides | remount | 10.00 | 10.00 | 🟡 0.0% |
        | 100 | dynamic | mount | 10.00 | 10.00 | 🟡 0.0% |
        | 100 | dynamic | update | 10.00 | 10.00 | 🟡 0.0% |
        | 100 | dynamic | remount | 10.00 | 10.00 | 🟡 0.0% |
        | 1000 | callable | mount | 10.00 | 10.00 | 🟡 0.0% |
        | 1000 | callable | update | 10.00 | 10.00 | 🟡 0.0% |
        | 1000 | callable | remount | 10.00 | 10.00 | 🟡 0.0% |
        | 1000 | overrides | mount | 10.00 | 10.00 | 🟡 0.0% |
        | 1000 | overrides | update | 10.00 | 14.00 | 🔴 +40.0% |
        | 1000 | overrides | remount | 10.00 | 10.00 | 🟡 0.0% |
        | 1000 | dynamic | mount | 10.00 | 10.00 | 🟡 0.0% |
        | 1000 | dynamic | update | 10.00 | 10.00 | 🟡 0.0% |
        | 1000 | dynamic | remount | 10.00 | 10.00 | 🟡 0.0% |

        Advisory only; no threshold enforced.

        "
      `)

      const enforced = ChildProcess.spawnSync(
        process.execPath,
        ['bench/RenderCheck.ts', directory, base],
        { encoding: 'utf8', env: { ...env, BENCH_RENDER_THRESHOLD: '130' } },
      )

      expect(enforced.status).toMatchInlineSnapshot(`1`)
      expect(
        enforced.stdout.includes(
          '🔴 Zyzz render regression above the enforced threshold.',
        ),
      ).toMatchInlineSnapshot(`true`)

      const tolerant = ChildProcess.spawnSync(
        process.execPath,
        ['bench/RenderCheck.ts', directory, base],
        { encoding: 'utf8', env: { ...env, BENCH_RENDER_THRESHOLD: '150' } },
      )

      expect(tolerant.status).toMatchInlineSnapshot(`0`)
      expect(
        tolerant.stdout.includes(
          '| 1000 | overrides | update | 10.00 | 14.00 | 🟡 +40.0% |',
        ),
      ).toMatchInlineSnapshot(`true`)
      expect(
        tolerant.stdout.includes(
          '🟢 No Zyzz render regression above the enforced threshold.',
        ),
      ).toMatchInlineSnapshot(`true`)

      const truncated = groups(true)

      truncated.pop()
      await Fs.writeFile(
        Path.join(directory, 'render-timings.json'),
        JSON.stringify({ groups: truncated, userAgent: 'check fixture' }),
      )

      const incomplete = ChildProcess.spawnSync(
        process.execPath,
        ['bench/RenderCheck.ts', directory],
        { encoding: 'utf8', env },
      )

      expect(incomplete.status).toMatchInlineSnapshot(`1`)
      expect(
        incomplete.stderr.includes('missing or duplicate Zyzz group'),
      ).toMatchInlineSnapshot(`true`)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })
})
