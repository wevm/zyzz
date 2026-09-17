/** Executes one transform in a fresh Node process for startup-inclusive measurements. @module */
import * as Compile from './Compile.js'
import type * as Corpus from './Corpus.js'
const [library, kind, count, platform] = process.argv.slice(2)
if (
  !library ||
  !kind ||
  !count ||
  (platform !== 'ios' && platform !== 'android')
)
  throw new Error('Invalid cold compiler arguments')
const result = Compile.compile(
  library as Corpus.Library,
  { kind: kind as Corpus.Kind, count: Number(count) },
  platform,
)
if (!result.code) throw new Error('Missing compiler output')
process.stdout.write(String(Buffer.byteLength(result.code)))
