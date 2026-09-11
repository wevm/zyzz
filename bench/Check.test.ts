/**
 * Exercises framework gate exit codes and reports through real result files.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { describe, expect, test } from 'vite-plus/test'

const run = Util.promisify(ChildProcess.execFile)

describe('framework gate', () => {
  test.each([
    'win',
    'speed loss',
    'size loss',
    'tie',
    'missing group',
    'missing competitor',
    'no samples',
    'invalid size',
  ])('%s', async (scenario) => {
    const directory = await Fs.mkdtemp(Path.resolve('.fixture-framework-'))
    try {
      const workloads = [
        ...[
          'small',
          'repeated',
          'unique',
          'partial',
          'palette',
          'independent',
          'sparse',
          'components',
        ].map((name) => ({
          directory: name,
          group: `fresh compilation / ${name}`,
          lanes: ['zyzz'],
        })),
        ...[10, 100].map((count) => ({
          directory: `theme-comparison/${count}`,
          group: `theme comparison / ${count} styles`,
          lanes: ['zyzz', 'zyzz-tokens'],
        })),
      ]
      const groups = []
      for (const workload of workloads) {
        const benchmarks = []
        await Fs.mkdir(Path.join(directory, workload.directory), {
          recursive: true,
        })
        for (const library of [
          ...workload.lanes,
          'panda',
          'stylex',
          'tailwind',
          'vanilla-extract',
        ]) {
          const zyzz = workload.lanes.includes(library)
          // Exercise the last lane so an earlier passing workload cannot mask a loss.
          const target =
            workload.directory === 'theme-comparison/100' &&
            library === 'zyzz-tokens'
          if (
            !(
              scenario === 'missing competitor' &&
              workload.directory === 'theme-comparison/100' &&
              library === 'tailwind'
            )
          )
            benchmarks.push({
              mean: (() => {
                if (target && scenario === 'speed loss') return 3
                if (target && scenario === 'tie') return 2
                return zyzz ? 1 : 2
              })(),
              name: library,
              rme: 1,
              sampleCount: target && scenario === 'no samples' ? 0 : 10,
            })
          const css = target && scenario === 'size loss' ? 30 : 10
          const javascript = zyzz ? 5 : 10
          await Fs.writeFile(
            Path.join(directory, workload.directory, `${library}.json`),
            JSON.stringify({
              css: { gzip: css },
              javascript: { gzip: javascript },
              library,
              total: {
                gzip:
                  target && scenario === 'invalid size' ? -1 : css + javascript,
              },
            }),
          )
        }
        if (
          !(
            scenario === 'missing group' &&
            workload.directory === 'theme-comparison/100'
          )
        )
          groups.push({
            benchmarks,
            fullName: `bench/example.bench.ts > ${workload.group}`,
          })
      }
      await Fs.writeFile(
        Path.join(directory, 'timings.json'),
        JSON.stringify({ files: [{ groups }] }),
      )
      const result = await run(process.execPath, [
        Path.resolve('bench/Check.ts'),
        directory,
      ]).then(
        ({ stdout }) => ({ code: 0, stdout }),
        (error: { code: number; stdout: string }) => ({
          code: error.code,
          stdout: error.stdout,
        }),
      )
      if (scenario === 'win') {
        expect(result.code).toMatchInlineSnapshot('0')
        expect(
          result.stdout
            .split('\n')
            .filter((line) => line.startsWith('| ') && line.includes('🟢'))
            .length,
        ).toMatchInlineSnapshot('12')
        expect(result.stdout.includes('| 🔴')).toMatchInlineSnapshot('false')
      } else {
        expect(result.code).toMatchInlineSnapshot('1')
        if (['speed loss', 'size loss', 'tie'].includes(scenario)) {
          expect(
            result.stdout.includes('<summary>Themes — 100 Components:'),
          ).toMatchInlineSnapshot('true')
          expect(
            result.stdout.includes('| 🔴 Zyzz (token resolution included) |'),
          ).toMatchInlineSnapshot('true')
        } else {
          expect(
            result.stdout
              .split('\n')
              .find((line) => line.startsWith('🔴 Themes')),
          ).toMatchInlineSnapshot(
            '"🔴 Themes — 100 Components: Missing or invalid measurements. See workflow logs."',
          )
        }
      }
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })
})
