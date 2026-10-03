/** Reads the pinned Tempo DS authoring graph for native package consumers. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'

/** Retains the original token values, configuration, compositions, and imports. */
export async function read(): Promise<Record<string, string>> {
  const paths = ['core/vars.ts', 'platform/vars.ts', 'platform/zyzz.config.ts']
  return Object.fromEntries(
    await Promise.all(
      paths.map(async (name) => [
        name,
        await Fs.readFile(
          Path.join(import.meta.dirname, 'ds', `${name}.txt`),
          'utf8',
        ),
      ]),
    ),
  )
}
