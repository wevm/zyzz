/** Generates matched app fixtures without measuring them. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Corpus from './Corpus.js'

const app = Path.resolve('bench/native/app')
const imports: string[] = []
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
      imports.push(`import * as ${name} from './${library}/${name}.js';`)
      entries.push(`'${library}/${kind}/${count}':${name}`)
    }
await Fs.writeFile(
  Path.join(app, 'generated/index.ts'),
  `${imports.join('\n')}\nexport const fixtures = {${entries.join(',\n')}};`,
)
