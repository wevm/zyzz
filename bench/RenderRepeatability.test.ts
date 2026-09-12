/**
 * Exercises the repeatability report CLI with complete and interrupted run files.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import type * as Render from './Render.js'

describe('render repeatability', () => {
  test('reports dispersion and overlap across runs and rejects incomplete input', async () => {
    const directory = await Fs.mkdtemp(
      Path.join(Os.tmpdir(), 'zyzz-render-repeatability-'),
    )

    try {
      const runs = [1, 2, 3].map((run) => {
        const groups: Render.Group[] = []

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
              for (const pass of [1, 2]) {
                // Zyzz drifts by 0.1 ms per run; the plain control is separated and
                // every other framework sits inside Zyzz's interval.
                const offset = (() => {
                  if (library === 'zyzz') return (run - 1) * 0.1
                  if (library === 'baseline') return 1

                  return 0.1
                })()

                groups.push({
                  components,
                  count: components / 10,
                  kind,
                  library,
                  pass,
                  samples: Array.from({ length: 20 }, () =>
                    (['mount', 'update', 'remount'] as const).map(
                      (operation) => ({
                        commit: 1 + offset,
                        commitLayout: 2 + offset,
                        frame: 32 + offset,
                        operation,
                      }),
                    ),
                  ).flat(),
                })
              }

        return groups
      })

      const paths = await Promise.all(
        runs.map(async (groups, index) => {
          const run = Path.join(directory, `run-${index + 1}`)

          await Fs.mkdir(run)
          await Fs.writeFile(
            Path.join(run, 'render-timings.json'),
            JSON.stringify({ groups, userAgent: 'repeatability fixture' }),
          )

          return run
        }),
      )

      const result = ChildProcess.spawnSync(
        process.execPath,
        ['bench/RenderRepeatability.ts', ...paths],
        { encoding: 'utf8' },
      )

      expect(result.status).toMatchInlineSnapshot(`0`)
      expect(
        result.stdout.includes(
          '| Zyzz | mount | commit | 1.00 | 1.10 | 1.20 | 20.0% | 9.1% | 1.00 / 1.10 / 1.20 |',
        ),
      ).toMatchInlineSnapshot(`true`)
      expect(
        result.stdout.includes(
          '| Plain class/style | update | commit + layout | 2.00–2.20 | 3.00–3.00 | Zyzz lower in every run |',
        ),
      ).toMatchInlineSnapshot(`true`)
      expect(
        result.stdout.includes(
          '| Panda CSS | remount | frame | 32.00–32.20 | 32.10–32.10 | Overlap — inconclusive |',
        ),
      ).toMatchInlineSnapshot(`true`)
      expect(result.stdout.slice(result.stdout.indexOf('### Gate guidance')))
        .toMatchInlineSnapshot(`
          "### Gate guidance

          Largest Zyzz run-to-run spread on this machine. A single-pair regression threshold must exceed the observed spread with margin, or repeated runs must be confirmed before failing.

          | Metric | Largest Zyzz spread | Workload |
          | --- | ---: | --- |
          | commit | 20.0% | 100 cards callable mount |
          | commit + layout | 10.0% | 100 cards callable mount |
          | frame | 0.6% | 100 cards callable mount |

          These runs share one machine, browser, and source revision. They bound drift between sequential runs; they do not bound differences between machines or runners.

          "
        `)

      const single = ChildProcess.spawnSync(
        process.execPath,
        ['bench/RenderRepeatability.ts', paths[0]!],
        { encoding: 'utf8' },
      )

      expect(single.status).toMatchInlineSnapshot(`1`)
      expect(single.stderr.includes('Usage:')).toMatchInlineSnapshot(`true`)

      runs[2]!.pop()
      await Fs.writeFile(
        Path.join(paths[2]!, 'render-timings.json'),
        JSON.stringify({
          groups: runs[2],
          userAgent: 'repeatability fixture',
        }),
      )

      const incomplete = ChildProcess.spawnSync(
        process.execPath,
        ['bench/RenderRepeatability.ts', ...paths],
        { encoding: 'utf8' },
      )

      expect(incomplete.status).toMatchInlineSnapshot(`1`)
      expect(
        incomplete.stderr.includes('missing or duplicate group'),
      ).toMatchInlineSnapshot(`true`)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })
})
