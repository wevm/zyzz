/** Generates matched app fixtures without measuring them. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Corpus from './Corpus.js'

const app = Path.resolve('bench/native/app')
const entries: string[] = []
for (const library of Corpus.libraries)
  for (const kind of Corpus.kinds)
    for (const count of Corpus.counts) {
      const name = `${library}_${kind}_${count}`
      const directory = Path.join(app, 'generated', library)
      await Fs.mkdir(directory, { recursive: true })
      await Fs.writeFile(
        Path.join(directory, `${name}.tsx`),
        Corpus.source(library, { kind, count: kind === 'unique' ? count : 1 }),
      )
      // Lazy loaders keep each cold launch to its own lane's modules.
      entries.push(
        `'${library}/${kind}/${count}':() => require('./${library}/${name}.js') as typeof import('./${library}/${name}.js')`,
      )
    }
await Fs.writeFile(
  Path.join(app, 'generated/index.ts'),
  `export const fixtures = {${entries.join(',\n')}};`,
)
