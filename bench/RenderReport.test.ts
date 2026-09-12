/**
 * Exercises the browser report CLI with complete and interrupted run artifacts.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Path from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import type * as Render from './Render.js'

describe('render report', () => {
  test('reports complete samples and rejects an interrupted run', async () => {
    const directory = await Fs.mkdtemp(
      Path.join(Os.tmpdir(), 'zyzz-render-report-'),
    )

    try {
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
            for (const pass of [1, 2])
              groups.push({
                components,
                count: components / 10,
                kind,
                library,
                pass,
                samples: Array.from({ length: 20 }, () =>
                  (['mount', 'update', 'remount'] as const).map(
                    (operation) =>
                      ({
                        commit: 1,
                        commitLayout: 2,
                        frame: 32,
                        operation,
                      }) as const,
                  ),
                ).flat(),
              })

      const path = Path.join(directory, 'render-timings.json')

      await Fs.writeFile(
        path,
        JSON.stringify({ groups, userAgent: 'report fixture' }),
      )

      const result = ChildProcess.spawnSync(
        process.execPath,
        ['bench/RenderReport.ts', directory],
        { encoding: 'utf8' },
      )

      expect(result.status).toMatchInlineSnapshot(`0`)
      expect(
        result.stdout.includes(
          '| 1000 | callable | zyzz | mount | 1 | 1.00 | 2.00 | 2.00 | 32.00 |',
        ),
      ).toMatchInlineSnapshot(`true`)

      groups.pop()
      await Fs.writeFile(
        path,
        JSON.stringify({ groups, userAgent: 'report fixture' }),
      )

      const incomplete = ChildProcess.spawnSync(
        process.execPath,
        ['bench/RenderReport.ts', directory],
        { encoding: 'utf8' },
      )

      expect(incomplete.status).toMatchInlineSnapshot(`1`)
      expect(
        incomplete.stderr.includes('Missing or duplicate group'),
      ).toMatchInlineSnapshot(`true`)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })
})
