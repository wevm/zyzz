/**
 * Exercises the runtime report CLI with complete, uncertain, and missing samples.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'

describe('runtime report', () => {
  for (const scenario of [
    'confirmed loss',
    'one pass loss',
    'overlap',
    'missing',
    'win',
  ] as const)
    test(scenario, async () => {
      const directory = await Fs.mkdtemp(
        Path.join(Os.tmpdir(), 'runtime-report-'),
      )

      try {
        const groups = []

        for (const count of [10, 100])
          for (const kind of [
            'cached',
            'direct',
            'callable',
            'overrides',
            'dynamic',
          ])
            for (const repeat of [1, 2]) {
              const benchmarks = []

              for (const library of [
                'baseline',
                'panda',
                'stylex',
                'tailwind',
                'vanilla-extract',
                'zyzz',
              ]) {
                if (
                  kind === 'dynamic' &&
                  library !== 'baseline' &&
                  library !== 'zyzz'
                )
                  continue

                if (scenario === 'missing' && library === 'stylex') continue

                const mean = (() => {
                  if (library !== 'zyzz') return 0.001
                  if (scenario === 'confirmed loss') return 0.002

                  if (scenario === 'one pass loss')
                    return repeat === 1 ? 0.002 : 0.0005

                  if (scenario === 'overlap') return 0.001

                  return 0.0005
                })()

                benchmarks.push({
                  mean,
                  name: library,
                  rme: 5,
                  sampleCount: 100,
                })

                const path = Path.join(
                  directory,
                  'runtime',
                  String(count),
                  kind,
                )

                await Fs.mkdir(path, { recursive: true })
                await Fs.writeFile(
                  Path.join(path, `${library}.json`),
                  JSON.stringify({
                    css: { gzip: 100 },
                    javascript: { gzip: 100 },
                    library,
                    total: { gzip: 200 },
                  }),
                )
              }

              groups.push({
                benchmarks,
                fullName: `runtime comparison / ${count} styles / ${kind} / repeat ${repeat}`,
              })
            }

        await Fs.writeFile(
          Path.join(directory, 'browser-timings.json'),
          JSON.stringify({ files: [{ groups }] }),
        )

        const result = ChildProcess.spawnSync(
          process.execPath,
          ['bench/RuntimeReport.ts', directory],
          { encoding: 'utf8', timeout: 10_000 },
        )

        if (scenario === 'missing')
          expect(result.status).toMatchInlineSnapshot(`1`)
        else expect(result.status).toMatchInlineSnapshot(`0`)

        if (scenario === 'confirmed loss')
          expect(result.stdout.includes('🔴 Tailwind')).toMatchInlineSnapshot(
            `true`,
          )

        if (scenario === 'one pass loss' || scenario === 'overlap')
          expect(result.stdout.includes('🟡 Zyzz')).toMatchInlineSnapshot(
            `true`,
          )

        if (scenario === 'missing')
          expect(
            result.stdout.includes('Missing or invalid runtime measurements'),
          ).toMatchInlineSnapshot(`true`)

        if (scenario === 'win')
          expect(result.stdout.includes('🟢 Zyzz')).toMatchInlineSnapshot(
            `true`,
          )
      } finally {
        await Fs.rm(directory, { force: true, recursive: true })
      }
    })
})
