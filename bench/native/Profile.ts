/** Captures a CPU profile of warm unique-style compilation outside timed samples. @module */
import * as Fs from 'node:fs/promises'
import * as Inspector from 'node:inspector/promises'
import * as Compile from './Compile.js'
import * as Corpus from './Corpus.js'

const platform = process.argv[2]
if (platform !== 'ios' && platform !== 'android')
  throw new Error('Usage: Profile.mjs ios|android')

const workload = { count: 1000, kind: 'unique' } as const
const source = Corpus.source('zyzz', workload)
Compile.compile('zyzz', workload, platform, false, source)

const session = new Inspector.Session()
session.connect()
try {
  await session.post('Profiler.enable')
  await session.post('Profiler.start')
  for (let index = 0; index < 3; index++)
    Compile.compile('zyzz', workload, platform, false, source)
  const { profile } = await session.post('Profiler.stop')
  await Fs.writeFile(
    `bench/results/native/unique-${platform}.cpuprofile`,
    JSON.stringify(profile),
  )
} finally {
  session.disconnect()
}
